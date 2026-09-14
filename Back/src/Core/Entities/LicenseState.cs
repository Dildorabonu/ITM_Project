namespace Core.Entities;

/// <summary>
/// Litsenziya holati — yagona (singleton) qator. Faqat soatni ortga surishga qarshi
/// "yuqori suv belgisi" (high-water mark) va buzish (tamper) bayrog'ini saqlaydi.
/// Muddatning o'zi imzolangan token ichida bo'lgani uchun bu jadval bazadan
/// o'chirilsa ham muddat qayta boshlanmaydi.
/// </summary>
public class LicenseState
{
    // Barcha instansiyalar shu qat'iy Id bilan ishlaydi.
    public static readonly Guid SingletonId = new("0f1e2d3c-4b5a-6987-8f01-abcdef012345");

    public Guid Id { get; set; }

    // Admin panel orqali kiritilgan litsenziya tokeni. To'ldirilgan bo'lsa,
    // config/fayldagi kalitdan ustun turadi — appsettings'ni tahrirlash shart emas.
    public string? LicenseKey { get; set; }

    // Ko'rilgan eng katta vaqt — soat ortga surilsa ham bu qiymatdan pastga tushmaydi.
    public DateTime HighWaterUtc { get; set; }

    // Bepul sinov (trial) birinchi ishga tushganda yoziladi va boshqa o'zgarmaydi.
    // Token yo'q bo'lsa muddat shundan sanaladi. To'ldirilgach qayta yozilmaydi.
    public DateTime? TrialStartUtc { get; set; }

    // Soat keskin ortga surilgani aniqlansa — abadiy blok.
    public bool TamperDetected { get; set; }
    public string? TamperReason { get; set; }

    public DateTime UpdatedAt { get; set; }
}
