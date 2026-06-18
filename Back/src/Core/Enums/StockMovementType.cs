namespace Core.Enums;

// Ombor harakatlari jurnali (StockMovement) uchun harakat turi.
// Miqdor (Quantity) har doim musbat saqlanadi — ishorasi shu Type orqali aniqlanadi.
public enum StockMovementType
{
    In = 0,        // Omborga kirim (xarid qabul qilish)
    Out = 1,       // Ombordan chiqim
    Transfer = 2,  // Bir bo'limdan boshqasiga ko'chirish (markaziy ombor → bo'lim ombori)
    Adjust = 3,    // Qo'lda tuzatish (inventarizatsiya, yo'qotish)
    Reserve = 4,   // Rezervga olish (ReservedQuantity oshishi)
    Release = 5    // Rezervdan chiqarish (ReservedQuantity kamayishi)
}
