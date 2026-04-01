namespace Core.Entities;

public class ContractDepartment
{
    public Guid ContractId { get; set; }
    public Guid DepartmentId { get; set; }

    // Navigation properties
    public Contract Contract { get; set; } = null!;
    public Department Department { get; set; } = null!;
}
