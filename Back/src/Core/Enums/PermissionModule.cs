using System.ComponentModel.DataAnnotations;

namespace Core.Enums;

public enum PermissionModule
{
    [Display(Name = "Foydalanuvchilar", Description = "users")]
    Users = 1,

    [Display(Name = "Rollar", Description = "shield")]
    Roles = 2,

    [Display(Name = "Bo'limlar", Description = "briefcase")]
    Departments = 3,

    [Display(Name = "Mahsulotlar", Description = "package")]
    Products = 4,

    [Display(Name = "Shartnomalar", Description = "file-text")]
    Contracts = 5,

    [Display(Name = "Texnologik jarayon", Description = "settings")]
    TechProcess = 6,

    [Display(Name = "Texnik chizmalar", Description = "pen-tool")]
    TechnicalDrawings = 7,

    [Display(Name = "Xarajat me'yorlari", Description = "calculator")]
    CostNorm = 8,
}
