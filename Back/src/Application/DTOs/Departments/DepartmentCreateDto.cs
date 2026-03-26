namespace Application.DTOs.Departments;

public class DepartmentCreateDto
{
    public string Name { get; set; } = string.Empty;
    public int EmployeeCount { get; set; }
}
