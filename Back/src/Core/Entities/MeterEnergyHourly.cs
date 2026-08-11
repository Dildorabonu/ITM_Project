namespace Core.Entities;

/// <summary>
/// Bitta qurilmaning bitta soatdagi agregat ko'rsatkichlari. Xom
/// <see cref="MeterReading"/> yozuvlaridan background rollup servisi hisoblab yozadi —
/// panel so'rovlari millionlab qatorni skanerlamasligi uchun.
/// </summary>
public class MeterEnergyHourly
{
    public Guid Id { get; set; }

    public string DeviceName { get; set; } = string.Empty;

    /// <summary>Soat boshi (UTC) — daqiqa/soniya har doim 0.</summary>
    public DateTime HourUtc { get; set; }

    /// <summary>Shu soatda sarflangan energiya (kVt·soat).</summary>
    public double Kwh { get; set; }

    public double AvgPowerW { get; set; }
    public double PeakPowerW { get; set; }
    public double MinPowerW { get; set; }

    /// <summary>O'rtacha kuchlanish (A faza), V.</summary>
    public double AvgVoltage { get; set; }

    /// <summary>Shu soatga tushgan xom o'lchovlar soni — ish vaqti (uptime) uchun.</summary>
    public int SampleCount { get; set; }

    /// <summary>Oxirgi marta qayta hisoblangan vaqt.</summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
