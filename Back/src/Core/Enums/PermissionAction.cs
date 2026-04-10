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

    [Display(Name = "Hammasini ko'rish", Description = "eye")]
    ViewAll = 5,

    [Display(Name = "Tasdiqlash", Description = "check-circle")]
    Approve = 6,

    [Display(Name = "Omborga yuborish", Description = "package")]
    SendToWarehouse = 7,
}
