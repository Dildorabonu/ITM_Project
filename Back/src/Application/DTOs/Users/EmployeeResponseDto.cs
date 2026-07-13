using Core.Enums;

namespace Application.DTOs.Users;

// Xodimlar sahifasi uchun — UserResponseDto dan farqli ravishda login/rol kabi
// maxfiy maydonlarni oshkor qilmaydi.
public class EmployeeResponseDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public Guid? DepartmentId { get; set; }
    public string? DepartmentName { get; set; }
    public DepartmentType? DepartmentType { get; set; }
    public bool IsActive { get; set; }
    public bool IsHead { get; set; }

    // Xodim hozir ishlayotgan (faol, yakunlanmagan) shartnomalar soni.
    public int ActiveContractCount { get; set; }
}
