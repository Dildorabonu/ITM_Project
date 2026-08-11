using Core.Entities;

namespace Application.Helpers;

/// <summary>
/// Berilgan vaqtga amal qilgan tarif narxini topadi. Tariflar soni kam
/// (yiliga bir-ikkita), shu sababli hammasi xotiraga o'qilib shu yerda tanlanadi —
/// har bucket uchun alohida DB so'rovi kerak emas.
/// </summary>
public static class TariffResolver
{
    /// <summary>
    /// <paramref name="atUtc"/> vaqtida amal qilgan narx. Agar vaqt eng erta
    /// tarifdan ham oldin bo'lsa — eng erta narx qaytariladi (xarajat 0 chiqib
    /// foydalanuvchini chalg'itmasligi uchun). Tariflar umuman bo'lmasa — null.
    /// </summary>
    public static decimal? PriceAt(IReadOnlyList<EnergyTariff> tariffs, DateTime atUtc)
    {
        if (tariffs is null || tariffs.Count == 0)
            return null;

        EnergyTariff? best = null;
        EnergyTariff? earliest = null;

        foreach (var tariff in tariffs)
        {
            if (earliest is null || tariff.EffectiveFrom < earliest.EffectiveFrom)
                earliest = tariff;

            if (tariff.EffectiveFrom <= atUtc && (best is null || tariff.EffectiveFrom > best.EffectiveFrom))
                best = tariff;
        }

        return (best ?? earliest)!.PricePerKwh;
    }
}
