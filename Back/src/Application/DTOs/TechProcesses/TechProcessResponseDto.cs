using Core.Enums;

namespace Application.DTOs.TechProcesses;

public class TechProcessResponseDto
{
    public Guid Id { get; set; }
    public Guid ContractId { get; set; }
    public string ContractNo { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public ProcessStatus Status { get; set; }
    public int CurrentStep { get; set; }
    public Guid? ApprovedBy { get; set; }
    public string? ApprovedByFullName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
