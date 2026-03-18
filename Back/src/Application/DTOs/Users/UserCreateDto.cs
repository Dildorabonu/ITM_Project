namespace Application.DTOs.Users;

public class UserCreateDto
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Login { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public Guid? RoleId { get; set; }
    public Guid? DepartmentId { get; set; }
}
