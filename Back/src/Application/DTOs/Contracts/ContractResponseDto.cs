using Core.Enums;

namespace Application.DTOs.Contracts;

public class ContractResponseDto
{
    public Guid Id { get; set; }
    public string ContractNo { get; set; } = string.Empty;
    public string ProductType { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public Guid? DepartmentId { get; set; }
    public string? DepartmentName { get; set; }
    public Priority Priority { get; set; }
    public string ContractParty { get; set; } = string.Empty;
    public ContractStatus Status { get; set; }
    public string? Notes { get; set; }
    public Guid CreatedBy { get; set; }
    public string? CreatedByFullName { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<ContractUserDto> AssignedUsers { get; set; } = [];
}
