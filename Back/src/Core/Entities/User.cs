namespace Core.Entities;

public class User
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Login { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public Guid? RoleId { get; set; }
    public Guid? DepartmentId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Role? Role { get; set; }
    public Department? Department { get; set; }
    public ICollection<Contract> CreatedContracts { get; set; } = [];
    public ICollection<Task> AssignedTasks { get; set; } = [];
    public ICollection<Task> CreatedTasks { get; set; } = [];
    public ICollection<StockIn> ReceivedStockIns { get; set; } = [];
    public ICollection<StockOut> IssuedStockOuts { get; set; } = [];
    public ICollection<TechProcess> ApprovedProcesses { get; set; } = [];
    public ICollection<Notification> Notifications { get; set; } = [];
}
