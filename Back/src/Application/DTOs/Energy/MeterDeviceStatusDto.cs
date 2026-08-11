namespace Application.DTOs.Energy;

/// <summary>
/// Qurilma va uning jonli holati. Ro'yxat konfiguratsiyadagi qurilmalar bilan
/// bazada uchragan nomlarning birlashmasi — hech qachon ma'lumot yubormagan
/// qurilma ham "offline" bo'lib ko'rinadi.
/// </summary>
public class MeterDeviceStatusDto
{
    public string Name { get; set; } = string.Empty;
    public bool IsOnline { get; set; }
    public DateTime? LastSeen { get; set; }
    public double? LastPowerW { get; set; }

    /// <summary>Konfiguratsiyada (MeterPoller:Devices) e'lon qilinganmi.</summary>
    public bool IsConfigured { get; set; }
}
