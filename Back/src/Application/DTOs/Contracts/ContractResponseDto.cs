using Core.Enums;

namespace Application.DTOs.Contracts;

public class ContractDepartmentDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DepartmentType Type { get; set; }
}

public class ContractResponseDto
{
    public Guid Id { get; set; }
    public string ContractNo { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public List<ContractDepartmentDto> Departments { get; set; } = [];
    public ContractType ContractType { get; set; }
    public string ContractParty { get; set; } = string.Empty;
    public ContractStatus Status { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; }
    public ContractDeactivationReason? DeactivationReason { get; set; }
    public string? DeactivationNote { get; set; }
    public DateTime? DeactivatedAt { get; set; }
    public Guid CreatedBy { get; set; }
    public string? CreatedByFullName { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<ContractUserDto> AssignedUsers { get; set; } = [];
    public List<ContractProductResponseDto> Products { get; set; } = [];
}
