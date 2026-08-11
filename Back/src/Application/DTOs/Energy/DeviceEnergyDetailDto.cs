namespace Application.DTOs.Energy;

/// <summary>Qurilma detalidagi bitta ustun — energiya + quvvat ko'rsatkichlari bilan.</summary>
public class DeviceDetailPointDto
{
    public string Bucket { get; set; } = string.Empty;
    public double Kwh { get; set; }
    public decimal? Cost { get; set; }
    public double AvgPowerW { get; set; }
    public double PeakPowerW { get; set; }
}

/// <summary>Bitta qurilmaning davr bo'yicha batafsil ko'rsatkichlari.</summary>
public class DeviceEnergyDetailDto
{
    public string DeviceName { get; set; } = string.Empty;
    public bool IsOnline { get; set; }
    public DateTime? LastSeen { get; set; }

    public DateTime From { get; set; }
    public DateTime To { get; set; }
    public string PeriodKey { get; set; } = string.Empty;
    public string Bucket { get; set; } = string.Empty;

    public decimal? PricePerKwh { get; set; }
    public string Currency { get; set; } = "so'm";

    public double Kwh { get; set; }
    public decimal? Cost { get; set; }
    public double AvgPowerW { get; set; }
    public double PeakPowerW { get; set; }
    public DateTime? PeakAt { get; set; }

    /// <summary>
    /// Ish vaqti: haqiqiy o'lchovlar sonining kutilgan songa nisbati (0–100).
    /// Qurilma uzilib turgan vaqtni ko'rsatadi.
    /// </summary>
    public double UptimePercent { get; set; }

    public double AvgVoltage { get; set; }
    public double MinVoltage { get; set; }
    public double MaxVoltage { get; set; }
    public double AvgFrequency { get; set; }

    public List<DeviceDetailPointDto> Series { get; set; } = [];
}
