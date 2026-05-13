using Core.Enums;

namespace Application.DTOs.Contracts;

public class ContractCreateDto
{
    public string ContractNo { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public List<Guid> DepartmentIds { get; set; } = [];
    public ContractType ContractType { get; set; }
    public string ContractParty { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public List<ContractProductCreateDto> Products { get; set; } = [];
}
