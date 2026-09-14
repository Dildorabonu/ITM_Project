using Core.Enums;

namespace Application.DTOs.Departments;

public class DepartmentLookupDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DepartmentType Type { get; set; }
}
