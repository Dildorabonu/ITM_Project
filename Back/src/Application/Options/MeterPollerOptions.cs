namespace Application.Options;

/// <summary>
/// Hisoblagichni Modbus TCP orqali faol so'rab turish sozlamalari.
/// Backend o'zi qurilmaning 502-portiga ulanib, holding registrlarni o'qiydi —
/// qurilma tomonida hech qanday "push" sozlamasi kerak emas.
/// </summary>
public class MeterPollerOptions
{
    public const string SectionName = "MeterPoller";

    public bool Enabled { get; set; } = false;

    /// <summary>Qurilma (DR134 shlyuz) IP manzili.</summary>
    public string Ip { get; set; } = "";

    public int Port { get; set; } = 502;
    public int SlaveId { get; set; } = 1;
    public int StartAddress { get; set; } = 100;
    public int RegisterCount { get; set; } = 55;

    /// <summary>Kuchlanish transformatori koeffitsienti.</summary>
    public double PtRatio { get; set; } = 1.0;

    /// <summary>Necha soniyada bir o'qish.</summary>
    public int IntervalSeconds { get; set; } = 3;

    /// <summary>Bazada saqlanadigan qurilma nomi.</summary>
    public string DeviceName { get; set; } = "DR134";
}
