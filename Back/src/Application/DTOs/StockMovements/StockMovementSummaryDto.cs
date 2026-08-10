namespace Application.DTOs.StockMovements;

// Jurnal ustidagi filtr tugmachalari uchun sonlar.
//
// Faqat HARAKATLAR SONI qaytariladi, miqdorlar yig'indisi emas: bitta filtrga
// kg, dona va metrdagi qatorlar birga tushadi, ularning yig'indisi ma'nosiz raqam
// bo'lar edi.
public class StockMovementSummaryDto
{
    public int Total { get; set; }

    // Kalit — StockMovementType nomi ("In", "Out", ...). Oltala tur har doim
    // mavjud bo'ladi (mos qator bo'lmasa 0), shunda tugmachalar yo'qolib qolmaydi.
    public Dictionary<string, int> ByType { get; set; } = new();
}
