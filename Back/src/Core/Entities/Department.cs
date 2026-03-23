namespace Core.Entities;

public class Department
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid? HeadUserId { get; set; }
    public int EmployeeCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User? HeadUser { get; set; }
    public ICollection<User> Users { get; set; } = [];
    public ICollection<Contract> Contracts { get; set; } = [];
    public ICollection<Task> Tasks { get; set; } = [];
    public ICollection<StockOut> StockOuts { get; set; } = [];
    public ICollection<Product> Products { get; set; } = [];
}
