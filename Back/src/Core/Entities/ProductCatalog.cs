namespace Core.Entities;

// Korxona ishlab chiqaradigan tayyor mahsulotlarning yagona katalogi. Har bir mahsulot
// turi bu yerda bir marta, o'z noyob Id va Code'i bilan saqlanadi. Shartnoma yaratishda
// mahsulot shu katalogdan tanlanadi (yoki yo'q bo'lsa, shu yerga qo'shiladi) — erkin matn
// o'rniga. Bu ManufacturedProduct (shartnomadan avtomatik hosil bo'ladigan ishlab chiqarish
// yozuvi) dan farq qiladi: ProductCatalog — dublikatsiz, barqaror ma'lumotnoma (master data).
public class ProductCatalog
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    // Nomning kanonik (translit + normalize) ko'rinishi — fuzzy/dublikat qidiruvi uchun.
    // TextNormalizer.Normalize(Name) orqali to'ldiriladi, qo'lda o'zgartirilmaydi.
    public string NameNormalized { get; set; } = string.Empty;

    // Barqaror, skanerlanadigan qisqa kod (masalan "PRD-9F3A1C") — fizik yorliq / ma'lumotnoma uchun.
    public string Code { get; set; } = string.Empty;

    // Taklif qilinadigan standart o'lchov birligi (shartnoma mahsulotining Unit maydoniga mos,
    // erkin matn: "Dona", "Kilogramm" va h.k.). Tanlashda formani oldindan to'ldirish uchun.
    public string? Unit { get; set; }

    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<ContractProduct> ContractProducts { get; set; } = [];
}
