using Core.Enums;

namespace Application.DTOs.TechProcesses;

public class TechStepResponseDto
{
    public Guid Id { get; set; }
    public int StepNumber { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ResponsibleDept { get; set; } = string.Empty;
    public string? Machine { get; set; }
    public string? TimeNorm { get; set; }
    public ProcessStatus Status { get; set; }
    public string? Notes { get; set; }
}
