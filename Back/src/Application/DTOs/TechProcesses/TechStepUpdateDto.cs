namespace Application.DTOs.TechProcesses;

public class TechStepUpdateDto
{
    public int? StepNumber { get; set; }
    public string? Name { get; set; }
    public string? ResponsibleDept { get; set; }
    public string? Machine { get; set; }
    public string? TimeNorm { get; set; }
    public string? Notes { get; set; }
}
