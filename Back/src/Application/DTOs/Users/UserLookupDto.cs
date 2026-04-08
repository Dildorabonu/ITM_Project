using Core.Enums;

namespace Application.DTOs.Users;

public class UserLookupDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public Guid? DepartmentId { get; set; }
    public string? DepartmentName { get; set; }
    public DepartmentType? DepartmentType { get; set; }
}
