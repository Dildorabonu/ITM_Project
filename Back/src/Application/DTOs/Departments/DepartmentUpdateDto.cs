using Core.Enums;

namespace Application.DTOs.Departments;

public class DepartmentUpdateDto
{
    public string? Name { get; set; }
    public DepartmentType? Type { get; set; }
    public int? EmployeeCount { get; set; }
}
