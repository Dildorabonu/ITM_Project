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
        // Butun User entity emas — faqat parol xeshi kerak.
        var passwordHash = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == SuperAdminUserId)
            .Select(u => u.PasswordHash)
            .FirstOrDefaultAsync(ct);

        if (passwordHash is null || !BCrypt.Net.BCrypt.Verify(secret ?? string.Empty, passwordHash))
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

        // 4) Joriy holat (tokendagi kalit ham shu yerda).
        var state = await _context.LicenseStates.FirstOrDefaultAsync(x => x.Id == LicenseState.SingletonId, ct);
        if (state is null)
        {
            state = new LicenseState { Id = LicenseState.SingletonId, HighWaterUtc = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            _context.LicenseStates.Add(state);
        }

        // 5) Bu token amaldagi tokendan YANGIROQ bo'lishi shart.
        // Aks holda mijoz soatni ortga surib, eski (yoki aynan o'sha) tokenni qayta
        // kiritib muddatni cheksiz "tiklab" olardi: faollashtirish TAMPER'ni tozalab,
        // high-water'ni ortga surilgan soatga tushirib yuborardi.
        // IssuedUtc'ni faqat ta'minotchi imzolaydi — shuning uchun u mijoz soatidan
        // qat'i nazar ishonchli vaqt manbai.
        var currentToken = ResolveToken(state.LicenseKey);
        if (LicenseTokenValidator.TryValidate(currentToken, out var currentPayload, out _) &&
            currentPayload is not null && payload.IssuedUtc <= currentPayload.IssuedUtc)
        {
            var same = string.Equals(payload.Id, currentPayload.Id, StringComparison.OrdinalIgnoreCase);
            return new LicenseActivationResult
            {
                Success = false,
                Error = same
                    ? "Bu token allaqachon faollashtirilgan. Uzaytirish uchun ta'minotchidan yangi token oling."
                    : "Bu token amaldagi litsenziyadan eski. Uzaytirish uchun ta'minotchidan yangi token oling.",
            };
        }

        // 6) Muddati o'tmaganmi? Tekshiruv mijoz soatiga emas, ortga surishga chidamli
        // "effektiv vaqt"ga tayanadi (imzolangan IssuedUtc ham hisobga olinadi).
        if (payload.ExpiresUtc <= Max(DateTime.UtcNow, payload.IssuedUtc))
        {
            return new LicenseActivationResult { Success = false, Error = "Token muddati allaqachon tugagan." };
        }

        // 7) Bazaga saqlaymiz (config/fayldan ustun turadi).
        // Yangi (imzolangan va amaldagidan yangiroq) token — "toza start". TAMPER
        // bayrog'ini olib tashlaymiz va soat-ortga-surishga qarshi belgilarni
        // (HighWater + fayl nusxasi) qayta tiklaymiz. Aks holda soat hali noto'g'ri
        // bo'lsa, keyingi EvaluateAsync darhol qayta TAMPER qo'yadi.
        // Boshlang'ich nuqta — max(hozirgi soat, tokenning imzolangan IssuedUtc'si):
        // soat ortga surilgan bo'lsa ham ta'minotchi imzolagan sanadan pastga tushmaydi,
        // soat oldinga surib "high-water"ni zaharlab qo'yilgan bo'lsa esa yangi token
        // uni haqiqiy sanaga qaytaradi.
        var baseline = Max(DateTime.UtcNow, payload.IssuedUtc);
        state.LicenseKey = token;
        state.TamperDetected = false;
        state.TamperReason = null;
        state.HighWaterUtc = baseline;
        state.UpdatedAt = baseline;
        await _context.SaveChangesAsync(ct);
        WriteMirror(baseline);

        // 8) Holatni qayta hisoblab, guard'ni yangilaymiz.
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
        var hasToken = !string.IsNullOrWhiteSpace(token);

        LicensePayload? payload = null;
        string tokenErr = string.Empty;
        if (hasToken)
            LicenseTokenValidator.TryValidate(token, out payload, out tokenErr);

        // Soatni ortga surishga qarshi belgilar token bor-yo'qligidan mustaqil hisoblanadi —
        // shunda sinov (trial) ham xuddi token kabi himoyalanadi.
        var fileHighWater = ReadMirror();
        var highWater = Max(now, state.HighWaterUtc, fileHighWater ?? DateTime.MinValue);

        var tamper = state.TamperDetected;
        if (now < state.HighWaterUtc - TamperTolerance ||
            (fileHighWater.HasValue && now < fileHighWater.Value - TamperTolerance))
        {
            tamper = true;
            state.TamperReason ??= $"Server soati ortga surildi (now={now:o}, hw={state.HighWaterUtc:o})";
        }

        // Sinov rejimi: haqiqiy token umuman yo'q va sinov yoqilgan bo'lsa.
        var trialEnabled = !hasToken && _options.TrialDays > 0;

        // Sinov boshlanish sanasini tiklaymiz: baza > OS nusxasi. Baza o'chirilib qayta
        // yaratilgan bo'lsa ham nusxadan olib sinovni qaytadan boshlamaymiz.
        if (state.TrialStartUtc is null)
        {
            var mirrored = ReadTrialMirror();
            if (mirrored.HasValue) state.TrialStartUtc = mirrored;
        }
        if (trialEnabled && state.TrialStartUtc is null)
            state.TrialStartUtc = highWater;

        state.HighWaterUtc = highWater;
        state.TamperDetected = tamper;
        state.UpdatedAt = now;
        await _context.SaveChangesAsync(ct);
        WriteMirror(highWater);
        if (state.TrialStartUtc.HasValue) WriteTrialMirror(state.TrialStartUtc.Value);

        if (tamper)
        {
            return new LicenseStatus
            {
                Valid = false,
                Customer = payload?.Customer,
                ExpiresUtc = payload?.ExpiresUtc,
                Reason = "TAMPER",
                Message = "Server vaqti buzilgani aniqlandi. Tizim bloklandi. Iltimos, ta'minotchi bilan bog'laning.",
            };
        }

        // Haqiqiy token bo'lmasa — sinov yo'li.
        if (!hasToken)
            return EvaluateTrial(state.TrialStartUtc, highWater);

        // Token bor, lekin yaroqsiz (buzilgan/imzo mos emas) — sinovga o'tmaymiz.
        if (payload is null)
        {
            return new LicenseStatus
            {
                Valid = false,
                Reason = "INVALID",
                Message = $"Litsenziya yaroqsiz: {tokenErr}",
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
                Reason = "MACHINE",
                Message = "Litsenziya bu serverga tegishli emas. Har bir server uchun alohida litsenziya kerak.",
            };
        }

        // Muddat tekshiruvi mijoz soatiga emas, ortga surishga chidamli "effektiv vaqt"ga (highWater) tayanadi.
        if (highWater >= payload.ExpiresUtc)
        {
            return new LicenseStatus
            {
                Valid = false,
                Customer = payload.Customer,
                ExpiresUtc = payload.ExpiresUtc,
                Reason = "EXPIRED",
                Message = "Litsenziya muddati tugagan. Davom etish uchun ta'minotchi bilan bog'laning.",
            };
        }

        return new LicenseStatus
        {
            Valid = true,
            Customer = payload.Customer,
            ExpiresUtc = payload.ExpiresUtc,
            Reason = "OK",
            Message = "Litsenziya faol.",
        };
    }

    private LicenseStatus EvaluateTrial(DateTime? trialStart, DateTime highWater)
    {
        if (_options.TrialDays <= 0 || trialStart is null)
        {
            return new LicenseStatus
            {
                Valid = false,
                Reason = "NO_KEY",
                Message = "Litsenziya kaliti mavjud emas.",
            };
        }

        var trialEnd = trialStart.Value.AddDays(_options.TrialDays);

        if (highWater >= trialEnd)
        {
            return new LicenseStatus
            {
                Valid = false,
                ExpiresUtc = trialEnd,
                Reason = "TRIAL_EXPIRED",
                Message = "Bepul sinov muddati tugadi. Davom etish uchun ta'minotchidan litsenziya oling.",
            };
        }

        var daysLeft = (int)Math.Ceiling((trialEnd - highWater).TotalDays);
        return new LicenseStatus
        {
            Valid = true,
            ExpiresUtc = trialEnd,
            Reason = "TRIAL",
            Message = $"Bepul sinov muddati: {daysLeft} kun qoldi.",
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

    // Sinov boshlanish sanasining OS darajasidagi nusxasi — baza butunlay
    // o'chirilib qayta yaratilsa ham sinov muddati qaytadan boshlanmasligi uchun.
    private static string TrialMirrorPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ITM", "trial.dat");

    private static DateTime? ReadTrialMirror()
    {
        try
        {
            if (!File.Exists(TrialMirrorPath)) return null;
            var raw = File.ReadAllText(TrialMirrorPath).Trim();
            if (long.TryParse(raw, out var ticks) && ticks > 0)
                return new DateTime(ticks, DateTimeKind.Utc);
        }
        catch { /* nusxa yo'q yoki o'qib bo'lmadi */ }
        return null;
    }

    private static void WriteTrialMirror(DateTime trialStart)
    {
        try
        {
            var dir = Path.GetDirectoryName(TrialMirrorPath)!;
            Directory.CreateDirectory(dir);
            // Faqat bir marta yoziladi — nusxa allaqachon bo'lsa, eng erta sanani saqlaymiz.
            var existing = ReadTrialMirror();
            var earliest = existing.HasValue && existing.Value < trialStart ? existing.Value : trialStart;
            File.WriteAllText(TrialMirrorPath, earliest.Ticks.ToString());
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
