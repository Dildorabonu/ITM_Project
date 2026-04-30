using System.ComponentModel.DataAnnotations;

namespace Core.Enums;

public enum ManufacturingStatus
{
    [Display(Name = "Ishlab chiqarilmoqda")]
    InProgress = 0,

    [Display(Name = "Ishlab chiqarilgan")]
    Completed = 1,
}
