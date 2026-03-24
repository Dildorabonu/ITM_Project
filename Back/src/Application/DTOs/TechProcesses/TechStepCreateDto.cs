namespace Application.DTOs.TechProcesses;

public class TechStepCreateDto
{
    public int StepNumber { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ResponsibleDept { get; set; } = string.Empty;
    public string? Machine { get; set; }
    public string? TimeNorm { get; set; }
    public string? Notes { get; set; }
}
