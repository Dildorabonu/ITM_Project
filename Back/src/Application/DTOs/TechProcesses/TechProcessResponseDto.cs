using Core.Enums;

namespace Application.DTOs.TechProcesses;

public class TechProcessResponseDto
{
    public Guid Id { get; set; }
    public string ContractNo { get; set; } = string.Empty;
    public string? ProductType { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public ProcessStatus Status { get; set; }
    public string? ApprovedByFullName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
