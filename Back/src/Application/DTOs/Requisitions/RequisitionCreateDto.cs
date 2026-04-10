using Core.Enums;

namespace Application.DTOs.Requisitions;

public class RequisitionCreateDto
{
    public RequisitionType Type { get; set; }

    // Type = Contract bo'lsa majburiy
    public Guid? ContractId { get; set; }

    // Type = Individual bo'lsa majburiy
    public Guid? DepartmentId { get; set; }

    public string Purpose { get; set; } = string.Empty;
    public string? Notes { get; set; }

    public List<RequisitionItemCreateDto> Items { get; set; } = [];
}
