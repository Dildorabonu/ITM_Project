namespace Application.DTOs.Energy;

/// <summary>Grafikning bitta ustuni: vaqt kaliti, energiya va uning puldagi qiymati.</summary>
public class EnergyBucketPointDto
{
    /// <summary>Mahalliy vaqt kaliti: soatlik "2026-08-11T14:00:00", kunlik "2026-08-11".</summary>
    public string Bucket { get; set; } = string.Empty;

    public double Kwh { get; set; }

    /// <summary>Tarif topilmasa null.</summary>
    public decimal? Cost { get; set; }
}

/// <summary>Bitta qurilmaning vaqt bo'yicha qatori — stacked grafik uchun.</summary>
public class DeviceSeriesDto
{
    public string DeviceName { get; set; } = string.Empty;
    public List<EnergyBucketPointDto> Points { get; set; } = [];
}

/// <summary>Umumiy ko'rinishdagi bitta qurilma kartasi.</summary>
public class DeviceEnergyDto
{
    public string DeviceName { get; set; } = string.Empty;
    public double Kwh { get; set; }
    public decimal? Cost { get; set; }

    /// <summary>Umumiy sarfdagi ulushi, foizda (0–100).</summary>
    public double SharePercent { get; set; }

    public double AvgPowerW { get; set; }
    public double PeakPowerW { get; set; }

    /// <summary>Oxirgi o'lchovdagi quvvat — qurilma yaqinda yozmagan bo'lsa null.</summary>
    public double? LastPowerW { get; set; }

    public DateTime? LastSeen { get; set; }
    public bool IsOnline { get; set; }

    /// <summary>Karta ichidagi mini-grafik uchun bucket kWh qiymatlari.</summary>
    public List<double> Sparkline { get; set; } = [];
}

/// <summary>Barcha qurilmalar bo'yicha yig'ma ko'rsatkichlar.</summary>
public class EnergyTotalsDto
{
    public double Kwh { get; set; }
    public decimal? Cost { get; set; }
    public double AvgPowerW { get; set; }
    public double PeakPowerW { get; set; }
    public DateTime? PeakAt { get; set; }

    /// <summary>Hozirgi umumiy quvvat — onlayn qurilmalarning oxirgi qiymatlari yig'indisi.</summary>
    public double CurrentPowerW { get; set; }

    public int DeviceCount { get; set; }
    public int OnlineCount { get; set; }
}

/// <summary>Energiya panelining umumiy ko'rinishi.</summary>
public class EnergySummaryDto
{
    public DateTime From { get; set; }
    public DateTime To { get; set; }

    /// <summary>Normallashtirilgan davr kaliti: today | 24h | 7d | 30d | month.</summary>
    public string PeriodKey { get; set; } = string.Empty;

    /// <summary>"hour" yoki "day".</summary>
    public string Bucket { get; set; } = string.Empty;

    /// <summary>Davr oxiriga amal qilgan narx — UI'da chip sifatida ko'rsatiladi.</summary>
    public decimal? PricePerKwh { get; set; }

    public string Currency { get; set; } = "so'm";

    public EnergyTotalsDto Total { get; set; } = new();
    public List<DeviceEnergyDto> Devices { get; set; } = [];
    public List<EnergyBucketPointDto> Series { get; set; } = [];
    public List<DeviceSeriesDto> ByDevice { get; set; } = [];
}
