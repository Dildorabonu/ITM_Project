namespace Application.DTOs.Users;

public class UserLookupDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? DepartmentName { get; set; }
}
