namespace Core.Entities;

/// <summary>
/// 1 kVt·soat elektr energiya narxi. Tarix saqlanadi: har yozuv o'z
/// <see cref="EffectiveFrom"/> sanasidan boshlab, keyingi tarif kelguncha amal qiladi.
/// Shu tufayli o'tgan davrlar o'sha paytdagi narx bilan hisoblanadi.
/// </summary>
public class EnergyTariff
{
    public Guid Id { get; set; }

    /// <summary>1 kVt·soat narxi.</summary>
    public decimal PricePerKwh { get; set; }

    public string Currency { get; set; } = "so'm";

    /// <summary>Shu sanadan (UTC) boshlab amal qiladi.</summary>
    public DateTime EffectiveFrom { get; set; }

    /// <summary>Ixtiyoriy izoh — masalan qaysi qaror bilan belgilangani.</summary>
    public string? Note { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Tarifni kiritgan foydalanuvchi.</summary>
    public Guid? CreatedByUserId { get; set; }
}
