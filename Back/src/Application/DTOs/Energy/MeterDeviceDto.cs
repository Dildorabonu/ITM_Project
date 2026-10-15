namespace Application.DTOs.Energy;

/// <summary>UI ga qaytariladigan hisoblagich qurilmasi sozlamalari.</summary>
public class MeterDeviceDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Ip { get; set; } = string.Empty;
    public int Port { get; set; }
    public int SlaveId { get; set; }
    public int StartAddress { get; set; }
    public int RegisterCount { get; set; }
    public double PtRatio { get; set; }
    public int? IntervalSeconds { get; set; }
    public bool Enabled { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>Shu nom bilan o'lchov yozilganmi — bo'lsa nomni o'zgartirib bo'lmaydi.</summary>
    public bool HasReadings { get; set; }
}

/// <summary>Qurilma yaratish/tahrirlash va ulanishni tekshirish uchun kiruvchi ma'lumot.</summary>
public class MeterDeviceSaveDto
{
    public string Name { get; set; } = string.Empty;
    public string Ip { get; set; } = string.Empty;
    public int Port { get; set; } = 502;
    public int SlaveId { get; set; } = 1;
    public int StartAddress { get; set; } = 100;
    public int RegisterCount { get; set; } = 55;
    public double PtRatio { get; set; } = 1.0;
    public int? IntervalSeconds { get; set; }
    public bool Enabled { get; set; } = true;
}

/// <summary>"Ulanishni tekshirish" natijasi — qurilmadan bir marta o'qilgan qiymatlar.</summary>
public class MeterDeviceTestResultDto
{
    public double Voltage { get; set; }
    public double Current { get; set; }
    public double Power { get; set; }
    public double Frequency { get; set; }
}
