using System.ComponentModel.DataAnnotations;

namespace Core.Enums;

public enum PermissionModule
{
    [Display(Name = "Foydalanuvchilar", Description = "users")]
    Users = 1,

    [Display(Name = "Rollar", Description = "shield")]
    Roles = 2,
}
