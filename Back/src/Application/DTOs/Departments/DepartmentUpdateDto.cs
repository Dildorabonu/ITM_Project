namespace Application.DTOs.Departments;

public class DepartmentUpdateDto
{
    public string? Name { get; set; }
    public Guid? HeadUserId { get; set; }
    public int? EmployeeCount { get; set; }
}
