using Core.Enums;

namespace Application.DTOs.Contracts;

public class ContractUpdateDto
{
    public string? ContractNo { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public List<Guid>? DepartmentIds { get; set; }
    public ContractType? ContractType { get; set; }
    public string? ContractParty { get; set; }
    public string? Notes { get; set; }
    public List<ContractProductCreateDto>? Products { get; set; }
}
