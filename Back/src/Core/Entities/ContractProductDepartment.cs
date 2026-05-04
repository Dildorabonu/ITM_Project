namespace Core.Entities;

public class ContractProductDepartment
{
    public Guid ContractProductId { get; set; }
    public Guid DepartmentId { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation properties
    public ContractProduct Product { get; set; } = null!;
    public Department Department { get; set; } = null!;
}
