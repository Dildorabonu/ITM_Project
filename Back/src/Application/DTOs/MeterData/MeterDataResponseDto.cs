namespace Application.DTOs.MeterData;

/// <summary>
/// UI ko'rsatadigan o'lchov maydonlari. Yozuv (DeviceName + CreatedAt)
/// juftligi bilan yagona aniqlanadi — alohida Id uzatilmaydi.
/// </summary>
public class MeterDataResponseDto
{
    public string DeviceName { get; set; } = string.Empty;
    public double VoltagePhaseA { get; set; }
    public double CurrentPhaseA { get; set; }
    public double ActivePower { get; set; }
    public double Frequency { get; set; }
    public DateTime CreatedAt { get; set; }
}
