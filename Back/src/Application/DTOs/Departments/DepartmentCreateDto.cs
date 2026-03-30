using Core.Enums;

namespace Application.DTOs.Departments;

public class DepartmentCreateDto
{
    public string Name { get; set; } = string.Empty;
    public DepartmentType Type { get; set; } = DepartmentType.Bolim;
    public int EmployeeCount { get; set; }
}
