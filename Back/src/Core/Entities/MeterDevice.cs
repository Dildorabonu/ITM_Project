namespace Core.Entities;

/// <summary>
/// Modbus TCP orqali so'raladigan hisoblagich qurilmasi.
/// O'lchovlar qurilmaga <see cref="Name"/> orqali bog'lanadi (MeterReading.DeviceName).
/// </summary>
public class MeterDevice
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;
    public string Ip { get; set; } = string.Empty;
    public int Port { get; set; } = 502;
    public int SlaveId { get; set; } = 1;
    public int StartAddress { get; set; } = 100;
    public int RegisterCount { get; set; } = 55;

    /// <summary>Kuchlanish transformatori koeffitsienti.</summary>
    public double PtRatio { get; set; } = 1.0;

    /// <summary>Shu qurilma uchun alohida o'qish davri; null bo'lsa global qiymat.</summary>
    public int? IntervalSeconds { get; set; }

    public bool Enabled { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    /// <summary>
    /// Soft delete. Qator saqlanib qoladi — appsettings'dan boshlang'ich import
    /// "jadval hech qachon to'ldirilmagan" shartiga tayanadi.
    /// </summary>
    public DateTime? DeletedAt { get; set; }
}
