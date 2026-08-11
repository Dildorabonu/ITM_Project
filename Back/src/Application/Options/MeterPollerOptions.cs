namespace Application.Options;

/// <summary>
/// Hisoblagichlarni Modbus TCP orqali faol so'rab turish sozlamalari.
/// Backend o'zi qurilmaning 502-portiga ulanib, holding registrlarni o'qiydi —
/// qurilma tomonida hech qanday "push" sozlamasi kerak emas.
///
/// Ko'p qurilma <see cref="Devices"/> massivi orqali beriladi. Eski yakka-qurilma
/// konfiguratsiyasi (Ip/SlaveId/DeviceName) ham ishlashda davom etadi.
/// </summary>
public class MeterPollerOptions
{
    public const string SectionName = "MeterPoller";

    public bool Enabled { get; set; } = false;

    /// <summary>Necha soniyada bir o'qish (qurilma o'z qiymati bilan almashtira oladi).</summary>
    public int IntervalSeconds { get; set; } = 3;

    /// <summary>So'raladigan qurilmalar ro'yxati.</summary>
    public List<MeterDeviceOptions> Devices { get; set; } = [];

    // ── Eski (yakka qurilma) maydonlari — orqaga moslik uchun saqlanadi ──────

    /// <summary>Eski format: qurilma IP manzili.</summary>
    public string Ip { get; set; } = "";

    public int Port { get; set; } = 502;
    public int SlaveId { get; set; } = 1;
    public int StartAddress { get; set; } = 100;
    public int RegisterCount { get; set; } = 55;
    public double PtRatio { get; set; } = 1.0;

    /// <summary>Eski format: bazada saqlanadigan qurilma nomi.</summary>
    public string DeviceName { get; set; } = "DR134";

    /// <summary>
    /// So'ralishi kerak bo'lgan qurilmalar. <see cref="Devices"/> bo'sh bo'lsa —
    /// eski yakka maydonlardan bitta qurilma yasaladi.
    /// IPsiz yoki o'chirilgan yozuvlar tashlab ketiladi.
    /// </summary>
    public IReadOnlyList<MeterDeviceOptions> ResolveDevices()
    {
        var source = Devices.Count > 0
            ? Devices
            : string.IsNullOrWhiteSpace(Ip)
                ? []
                : new List<MeterDeviceOptions>
                {
                    new()
                    {
                        Name = DeviceName,
                        Ip = Ip,
                        Port = Port,
                        SlaveId = SlaveId,
                        StartAddress = StartAddress,
                        RegisterCount = RegisterCount,
                        PtRatio = PtRatio,
                        Enabled = true,
                    },
                };

        return source
            .Where(d => d.Enabled && !string.IsNullOrWhiteSpace(d.Ip))
            .Select(d => new MeterDeviceOptions
            {
                Name = string.IsNullOrWhiteSpace(d.Name) ? d.Ip.Trim() : d.Name.Trim(),
                Ip = d.Ip.Trim(),
                Port = d.Port,
                SlaveId = d.SlaveId,
                StartAddress = d.StartAddress,
                RegisterCount = d.RegisterCount,
                PtRatio = d.PtRatio,
                IntervalSeconds = d.IntervalSeconds,
                Enabled = true,
            })
            .ToList();
    }

    /// <summary>Qurilma uchun amaldagi o'qish davri (soniya), minimum 1.</summary>
    public int EffectiveInterval(MeterDeviceOptions device) =>
        Math.Max(1, device.IntervalSeconds ?? IntervalSeconds);
}
