namespace Application.DTOs.Auth;

public class AuthUserDto
{
    public Guid Id { get; set; }
    public string Login { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public Guid? DepartmentId { get; set; }
    public List<string> Permissions { get; set; } = new();
}
