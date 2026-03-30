using Core.Enums;

namespace Application.DTOs.Contracts;

public class ContractUpdateDto
{
    public string? ContractNo { get; set; }
    public string? ProductType { get; set; }
    public int? Quantity { get; set; }
    public string? Unit { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public Guid? DepartmentId { get; set; }
    public Priority? Priority { get; set; }
    public string? ContractParty { get; set; }
    public string? Notes { get; set; }
}
