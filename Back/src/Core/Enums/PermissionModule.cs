using System.ComponentModel.DataAnnotations;

namespace Core.Enums;

public enum PermissionModule
{
    [Display(Name = "Foydalanuvchilar", Description = "users")]
    Users = 1,

    [Display(Name = "Rollar", Description = "shield")]
    Roles = 2,

    [Display(Name = "Tuzilma", Description = "briefcase")]
    Departments = 3,

    [Display(Name = "Omborxona mahsulotlari", Description = "package")]
    Products = 4,

    [Display(Name = "Shartnomalar", Description = "file-text")]
    Contracts = 5,

    [Display(Name = "Tex jarayon", Description = "settings")]
    TechProcess = 6,

    [Display(Name = "Texnik chizmalar", Description = "pen-tool")]
    TechnicalDrawings = 7,

    [Display(Name = "Xarajat normalar", Description = "calculator")]
    CostNorm = 8,

    [Display(Name = "Ombor tekshiruvi", Description = "package")]
    WarehouseCheck = 9,

    [Display(Name = "Vazifalar", Description = "check-square")]
    Tasks = 10,

    [Display(Name = "Bildirishnomalar", Description = "bell")]
    Notifications = 11,

    [Display(Name = "Talabnomalar", Description = "clipboard")]
    Requisitions = 12,

    [Display(Name = "Tayyor mahsulotlar", Description = "factory")]
    ManufacturedProducts = 13,

    [Display(Name = "Jo'natmalar", Description = "send")]
    Shipments = 14,

    [Display(Name = "Mahsulotlar katalogi", Description = "box")]
    ProductCatalog = 15,
}
