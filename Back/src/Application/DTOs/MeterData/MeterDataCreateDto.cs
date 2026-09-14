namespace Application.DTOs.MeterData;

/// <summary>
/// Hisoblagichdan o'qilgan bitta o'lchov — MeterPollerService dan
/// MeterDataService ga uzatiladi. Faqat A faza o'qiladi (DR134 registrlari).
/// </summary>
public class MeterDataCreateDto
{
    public double VoltagePhaseA { get; set; }
    public double CurrentPhaseA { get; set; }
    public double ActivePower { get; set; }
    public double Frequency { get; set; }
}
