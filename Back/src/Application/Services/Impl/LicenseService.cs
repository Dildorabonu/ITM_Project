using Application.Licensing;
using Application.Options;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Application.Services.Impl;

public class LicenseService : ILicenseService
{
    // Soat shu miqdordan ko'proq ortga surilsa — buzish (tamper) deb hisoblanadi.
    private static readonly TimeSpan TamperTolerance = TimeSpan.FromHours(48);

    private readonly DatabaseContext _context;
    private readonly LicenseOptions _options;
    private readonly LicenseGuard _guard;

    public LicenseService(DatabaseContext context, IOptions<LicenseOptions> options, LicenseGuard guard)
    {
        _context = context;
        _options = options.Value;
        _guard = guard;
    }

    // Seed qilingan superadmin foydalanuvchi id'si (AutomatedMigration bilan bir xil).
    private static readonly Guid SuperAdminUserId = new("00000000-0000-0000-0000-000000000001");

    public async Task<LicenseStatus> RefreshAsync(CancellationToken ct = default)
    {
        var status = await EvaluateAsync(ct);
        _guard.Status = status;
        return status;
    }

    public async Task<LicenseActivationResult> ActivateAsync(string token, string secret, CancellationToken ct = default)
    {
        // 1) Superadmin paroli tekshiruvi — bloklangan holatda ham ishlaydi.
        var admin = await _context.Users.FirstOrDefaultAsync(u => u.Id == SuperAdminUserId, ct);
        if (admin is null || !BCrypt.Net.BCrypt.Verify(secret ?? string.Empty, admin.PasswordHash))
        {
            return new LicenseActivationResult { Success = false, Error = "Superadmin paroli noto'g'ri." };
        }

        token = (token ?? string.Empty).Trim();

        // 2) Token imzosi to'g'rimi?
        if (!LicenseTokenValidator.TryValidate(token, out var payload, out var err) || payload is null)
        {
            return new LicenseActivationResult { Success = false, Error = $"Token yaroqsiz: {err}" };
        }

        // 3) Shu serverга bog'langanmi?
        if (!string.IsNullOrWhiteSpace(payload.MachineId) &&
            !string.Equals(payload.MachineId, MachineFingerprint.Get(), StringComparison.OrdinalIgnoreCase))
        {
            return new LicenseActivationResult { Success = false, Error = "Bu token boshqa serverga bog'langan." };
        }

        // 4) Muddati allaqachon o'tmaganmi?
        if (payload.ExpiresUtc <= DateTime.UtcNow)
        {
            return new LicenseActivationResult { Success = false, Error = "Token muddati allaqachon tugagan." };
        }

        // 5) Bazaga saqlaymiz (config/fayldan ustun turadi).
        var state = await _context.LicenseStates.FirstOrDefaultAsync(x => x.Id == LicenseState.SingletonId, ct);
        if (state is null)
        {
            state = new LicenseState { Id = LicenseState.SingletonId, HighWaterUtc = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            _context.LicenseStates.Add(state);
        }
        // Yangi (imzolangan) token faollashtirilishi — "toza start". TAMPER bayrog'ini
        // olib tashlaymiz va soat-ortga-surishga qarshi belgilarni (HighWater + fayl nusxasi)
        // hozirgi vaqtga qayta tiklaymiz. Aks holda soat hali ortga surilgan bo'lsa,
        // keyingi EvaluateAsync darhol qayta TAMPER qo'yadi.
        // Xavfsiz: bu faqat ta'minotchi imzolagan, shu serverga bog'langan va muddati
        // o'tmagan token bilan ishlaydi — mijoz o'zi TAMPER'ni ocha olmaydi.
        var baseline = DateTime.UtcNow;
        state.LicenseKey = token;
        state.TamperDetected = false;
        state.TamperReason = null;
        state.HighWaterUtc = baseline;
        state.UpdatedAt = baseline;
        await _context.SaveChangesAsync(ct);
        WriteMirror(baseline);

        // 6) Holatni qayta hisoblab, guard'ni yangilaymiz.
        var status = await RefreshAsync(ct);
        return new LicenseActivationResult { Success = true, Status = status };
    }

    private async Task<LicenseStatus> EvaluateAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        // Bazadagi yagona holat qatori (avval yuklab olamiz — tokendagi kaliti ham shu yerda).
        var state = await _context.LicenseStates
            .FirstOrDefaultAsync(x => x.Id == LicenseState.SingletonId, ct);

        if (state is null)
        {
            state = new LicenseState { Id = LicenseState.SingletonId, HighWaterUtc = now, UpdatedAt = now };
            _context.LicenseStates.Add(state);
        }

        // Token manbasi: DB (admin panel) > fayl > config.
        var token = ResolveToken(state.LicenseKey);

        if (!LicenseTokenValidator.TryValidate(token, out var payload, out var err) || payload is null)
        {
            return new LicenseStatus
            {
                Valid = false,
                Reason = string.IsNullOrWhiteSpace(token) ? "NO_KEY" : "INVALID",
                Message = $"Litsenziya yaroqsiz: {err}",
            };
        }

        // Serverga bog'lanish: token muayyan mashinaga bog'langan bo'lsa, barmoq izi mos kelishi shart.
        if (!string.IsNullOrWhiteSpace(payload.MachineId) &&
            !string.Equals(payload.MachineId, MachineFingerprint.Get(), StringComparison.OrdinalIgnoreCase))
        {
            return new LicenseStatus
            {
                Valid = false,
                Customer = payload.Customer,
                ExpiresUtc = payload.ExpiresUtc,
                DaysLeft = 0,
                Reason = "MACHINE",
                Message = "Litsenziya bu serverga tegishli emas. Har bir server uchun alohida litsenziya kerak.",
            };
        }

        // OS darajasidagi nusxa (publish/fayllarni qayta ko'chirishdan omon qoladi).
        var fileHighWater = ReadMirror();

        // Barcha manbalardan ko'rilgan eng katta vaqt.
        var highWater = Max(now, state.HighWaterUtc, fileHighWater ?? DateTime.MinValue);

        // Soat qaysidir manbaga nisbatan keskin ortga surilgan bo'lsa — buzishni belgilaymiz.
        var tamper = state.TamperDetected;
        if (now < state.HighWaterUtc - TamperTolerance ||
            (fileHighWater.HasValue && now < fileHighWater.Value - TamperTolerance))
        {
            tamper = true;
            state.TamperReason ??= $"Server soati ortga surildi (now={now:o}, hw={state.HighWaterUtc:o})";
        }

        state.HighWaterUtc = highWater;
        state.TamperDetected = tamper;
        state.UpdatedAt = now;
        await _context.SaveChangesAsync(ct);
        WriteMirror(highWater);

        // Muddatni tekshirishda ortga surishga chidamli "effektiv vaqt" ishlatiladi.
        var effectiveNow = highWater;
        var daysLeft = (int)Math.Ceiling((payload.ExpiresUtc - effectiveNow).TotalDays);

        if (tamper)
        {
            return new LicenseStatus
            {
                Valid = false,
                Customer = payload.Customer,
                ExpiresUtc = payload.ExpiresUtc,
                DaysLeft = 0,
                Reason = "TAMPER",
                Message = "Server vaqti buzilgani aniqlandi. Tizim bloklandi. Iltimos, ta'minotchi bilan bog'laning.",
            };
        }

        if (effectiveNow >= payload.ExpiresUtc)
        {
            return new LicenseStatus
            {
                Valid = false,
                Customer = payload.Customer,
                ExpiresUtc = payload.ExpiresUtc,
                DaysLeft = 0,
                Reason = "EXPIRED",
                Message = "Litsenziya muddati tugagan. Davom etish uchun ta'minotchi bilan bog'laning.",
            };
        }

        return new LicenseStatus
        {
            Valid = true,
            Customer = payload.Customer,
            ExpiresUtc = payload.ExpiresUtc,
            DaysLeft = Math.Max(daysLeft, 0),
            Reason = "OK",
            Message = "Litsenziya faol.",
        };
    }

    private string? ResolveToken(string? dbKey)
    {
        // 1) Admin panel orqali bazaga kiritilgan kalit — eng ustun.
        if (!string.IsNullOrWhiteSpace(dbKey)) return dbKey.Trim();

        if (!string.IsNullOrWhiteSpace(_options.KeyFilePath) && File.Exists(_options.KeyFilePath))
        {
            try
            {
                var fromFile = File.ReadAllText(_options.KeyFilePath).Trim();
                if (fromFile.Length > 0) return fromFile;
            }
            catch { /* faylni o'qib bo'lmasa config'ga o'tamiz */ }
        }

        return string.IsNullOrWhiteSpace(_options.Key) ? null : _options.Key.Trim();
    }

    // Yuqori suv belgisining OS darajasidagi nusxasi — ContentRoot'dan tashqarida,
    // shuning uchun ilova fayllari qayta ko'chirilganda ham saqlanadi.
    private static string MirrorPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ITM", "sys.dat");

    private static DateTime? ReadMirror()
    {
        try
        {
            if (!File.Exists(MirrorPath)) return null;
            var raw = File.ReadAllText(MirrorPath).Trim();
            if (long.TryParse(raw, out var ticks) && ticks > 0)
                return new DateTime(ticks, DateTimeKind.Utc);
        }
        catch { /* nusxa yo'q yoki o'qib bo'lmadi */ }
        return null;
    }

    private static void WriteMirror(DateTime highWater)
    {
        try
        {
            var dir = Path.GetDirectoryName(MirrorPath)!;
            Directory.CreateDirectory(dir);
            File.WriteAllText(MirrorPath, highWater.Ticks.ToString());
        }
        catch { /* yozib bo'lmasa ham baza asosiy manba bo'lib qoladi */ }
    }

    private static DateTime Max(params DateTime[] values)
    {
        var max = values[0];
        foreach (var v in values)
            if (v > max) max = v;
        return max;
    }
}
