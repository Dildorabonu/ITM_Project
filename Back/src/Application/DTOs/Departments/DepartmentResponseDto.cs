namespace Application.DTOs.Departments;

public class DepartmentResponseDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int EmployeeCount { get; set; }
    public DateTime CreatedAt { get; set; }
}
