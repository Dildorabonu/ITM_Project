namespace Application.DTOs.Users;

public class UserUpdateDto
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Login { get; set; }
    public string? Password { get; set; }
    public Guid? RoleId { get; set; }
    public Guid? DepartmentId { get; set; }
    public bool? IsActive { get; set; }
    public bool? IsHead { get; set; }
}
