namespace Core.Enums;

public enum ContractStatus
{
    Draft = 0,                // Shartnoma yaratilindi
    DrawingPending = 1,       // Chizmasi tayyorlanmoqda
    TechProcessing = 2,       // Tex jarayon va me'yoriy sarf tayyorlanmoqda
    WarehouseCheck = 3,       // Ombor tekshiruviga uzatildi
    InProduction = 4,         // Ishlab chiqarish jarayoni boshlangan
    Completed = 5,            // Yakunlandi
    Cancelled = 6,            // Bekor qilindi
}
