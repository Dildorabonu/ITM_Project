namespace Application.DTOs.Energy;

/// <summary>UI ga qaytariladigan tarif yozuvi.</summary>
public class EnergyTariffDto
{
    public Guid Id { get; set; }
    public decimal PricePerKwh { get; set; }
    public string Currency { get; set; } = "so'm";
    public DateTime EffectiveFrom { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid? CreatedByUserId { get; set; }

    /// <summary>Kiritgan foydalanuvchi ismi — o'chirilgan bo'lsa null.</summary>
    public string? CreatedByName { get; set; }
}

/// <summary>Tarif yaratish/tahrirlash uchun kiruvchi ma'lumot.</summary>
public class EnergyTariffSaveDto
{
    public decimal PricePerKwh { get; set; }
    public string Currency { get; set; } = "so'm";
    public DateTime EffectiveFrom { get; set; }
    public string? Note { get; set; }
}
