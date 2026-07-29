namespace Application.DTOs.MeterData;

public class MeterDataResponseDto
{
    public Guid Id { get; set; }
    public string DeviceName { get; set; } = string.Empty;
    public double VoltagePhaseA { get; set; }
    public double VoltagePhaseB { get; set; }
    public double VoltagePhaseC { get; set; }
    public double CurrentPhaseA { get; set; }
    public double CurrentPhaseB { get; set; }
    public double CurrentPhaseC { get; set; }
    public double ActivePower { get; set; }
    public double Frequency { get; set; }
    public DateTime CreatedAt { get; set; }
}
