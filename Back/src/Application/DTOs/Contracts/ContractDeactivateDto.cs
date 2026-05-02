using Core.Enums;

namespace Application.DTOs.Contracts;

public class ContractDeactivateDto
{
    public ContractDeactivationReason Reason { get; set; }
    public string? Note { get; set; }
}
