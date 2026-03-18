using System.ComponentModel.DataAnnotations;

namespace Core.Enums;

public enum PermissionAction
{
    [Display(Name = "Ko'rish", Description = "eye")]
    View = 1,

    [Display(Name = "Qo'shish", Description = "plus-circle")]
    Create = 2,

    [Display(Name = "Tahrirlash", Description = "edit")]
    Update = 3,

    [Display(Name = "O'chirish", Description = "trash")]
    Delete = 4,
}
