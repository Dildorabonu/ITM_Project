namespace Application.DTOs.MeterData;

/// <summary>
/// Hisoblagichdan o'qilgan bitta o'lchov — MeterPollerService dan
/// MeterDataService ga uzatiladi.
/// </summary>
public class MeterDataCreateDto
{
    public double VoltagePhaseA { get; set; }
    public double VoltagePhaseB { get; set; }
    public double VoltagePhaseC { get; set; }

    public double CurrentPhaseA { get; set; }
    public double CurrentPhaseB { get; set; }
    public double CurrentPhaseC { get; set; }

    public double ActivePower { get; set; }
    public double Frequency { get; set; }
}
