namespace Core.Enums;

public enum RequisitionStatus
{
    Draft = 0,                       // Qoralama (hozircha ishlatilmaydi, kelajak uchun)
    Rejected = 3,                    // Direktor rad etgan child talabnoma

    PendingWarehouseCheck = 5,       // Yangi yaratilgan — omborchi tekshiruvini kutmoqda
    WarehouseChecked = 6,            // Omborchi tekshirib qaytargan, yaratuvchi bo'lib yuborishi kerak
    Split = 7,                       // Parent — ikkita childga bo'lingan, arxiv
    PendingApproval = 8,             // Direktor tasdiqini kutmoqda (child)
    ReadyForWarehouseRelease = 9,    // Tasdiqlangan — ombordan olishga
    ReadyForPurchase = 10            // Tasdiqlangan — sotib olishga
}
