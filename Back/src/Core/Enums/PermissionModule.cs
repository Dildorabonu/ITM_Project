using System.ComponentModel.DataAnnotations;

namespace Core.Enums;

public enum PermissionModule
{
    [Display(Name = "Foydalanuvchilar", Description = "users")]
    Users = 1,

    [Display(Name = "Rollar", Description = "shield")]
    Roles = 2,

    [Display(Name = "Bo'limlar", Description = "building")]
    Departments = 3,

    [Display(Name = "Shartnomalar", Description = "file-text")]
    Contracts = 4,

    [Display(Name = "Texnologik jarayonlar", Description = "settings")]
    TechProcesses = 5,

    [Display(Name = "Materiallar", Description = "package")]
    Materials = 6,

    [Display(Name = "Kirim (StockIn)", Description = "arrow-down-circle")]
    StockIn = 7,

    [Display(Name = "Chiqim (StockOut)", Description = "arrow-up-circle")]
    StockOut = 8,

    [Display(Name = "Vazifalar", Description = "check-square")]
    Tasks = 9,

    [Display(Name = "Bildirishnomalar", Description = "bell")]
    Notifications = 10,
}
