namespace Application.Options;

/// <summary>
/// Bitta hisoblagich qurilmasining Modbus TCP sozlamalari.
/// Har qurilma o'z IP/SlaveId'iga ega bo'lishi mumkin — 20+ qurilmali ombor uchun.
/// </summary>
public class MeterDeviceOptions
{
    /// <summary>Bazadagi <c>MeterDevice.Id</c>; appsettings'dan o'qilganda bo'sh.</summary>
    public Guid Id { get; set; }

    /// <summary>Bazada saqlanadigan qurilma nomi. Bo'sh bo'lsa IP ishlatiladi.</summary>
    public string Name { get; set; } = "";

    public string Ip { get; set; } = "";
    public int Port { get; set; } = 502;
    public int SlaveId { get; set; } = 1;
    public int StartAddress { get; set; } = 100;
    public int RegisterCount { get; set; } = 55;

    /// <summary>Kuchlanish transformatori koeffitsienti.</summary>
    public double PtRatio { get; set; } = 1.0;

    /// <summary>Shu qurilma uchun alohida o'qish davri; null bo'lsa global qiymat.</summary>
    public int? IntervalSeconds { get; set; }

    public bool Enabled { get; set; } = true;
}
