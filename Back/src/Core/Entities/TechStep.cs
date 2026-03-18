using Core.Enums;

namespace Core.Entities;

public class TechStep
{
    public Guid Id { get; set; }
    public Guid TechProcessId { get; set; }
    public int StepNumber { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ResponsibleDept { get; set; } = string.Empty;
    public string? Machine { get; set; }
    public string? TimeNorm { get; set; }
    public ProcessStatus Status { get; set; }
    public string? Notes { get; set; }

    // Navigation properties
    public TechProcess? TechProcess { get; set; }
}
