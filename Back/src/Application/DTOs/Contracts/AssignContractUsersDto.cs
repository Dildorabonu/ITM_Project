using Core.Enums;

namespace Application.DTOs.Contracts;

public class AssignContractUsersDto
{
    public List<ContractUserAssignItem> Users { get; set; } = [];
}

public class ContractUserAssignItem
{
    public Guid UserId { get; set; }
    public ContractUserRole Role { get; set; }
}
