using Core.Enums;

namespace Core.Entities;

public class ContractUser
{
    public Guid ContractId { get; set; }
    public Guid UserId { get; set; }
    public ContractUserRole Role { get; set; } = ContractUserRole.Responsible;
    public bool IsActive { get; set; } = true;

    // Navigation properties
    public Contract Contract { get; set; } = null!;
    public User User { get; set; } = null!;
}
