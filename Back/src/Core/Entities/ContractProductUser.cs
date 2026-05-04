using Core.Enums;

namespace Core.Entities;

public class ContractProductUser
{
    public Guid ContractProductId { get; set; }
    public Guid UserId { get; set; }
    public ContractUserRole Role { get; set; } = ContractUserRole.Responsible;
    public bool IsActive { get; set; } = true;

    // Navigation properties
    public ContractProduct Product { get; set; } = null!;
    public User User { get; set; } = null!;
}
