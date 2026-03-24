namespace Core.Entities;

public class ContractUser
{
    public Guid ContractId { get; set; }
    public Guid UserId { get; set; }

    // Navigation properties
    public Contract Contract { get; set; } = null!;
    public User User { get; set; } = null!;
}
