namespace Application.Services;

/// <summary>
/// Xom <c>MeterReadings</c> yozuvlarini soatlik agregatga (<c>MeterEnergyHourly</c>)
/// yig'adi. Barcha metodlar idempotent — bir xil oraliqni qayta hisoblash xavfsiz.
/// </summary>
public interface IEnergyRollupService
{
    /// <summary>
    /// Berilgan oraliqdagi (soat chegaralarigacha kengaytiriladi) barcha qurilmalar
    /// uchun soatlik agregatni qayta hisoblab upsert qiladi.
    /// </summary>
    /// <returns>Yozilgan/yangilangan soat-qatorlar soni.</returns>
    Task<int> RollupRangeAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct = default);

    /// <summary>Hozirdan orqaga <paramref name="lookback"/> oralig'ini qayta hisoblaydi.</summary>
    Task<int> RollupRecentAsync(TimeSpan lookback, CancellationToken ct = default);

    /// <summary>
    /// Oxirgi hisoblangan soatdan (yoki eng erta o'lchovdan) hozirgacha bo'lgan
    /// bo'shliqni to'ldiradi — servis o'chib turgan davr uchun.
    /// </summary>
    Task<int> BackfillAsync(CancellationToken ct = default);
}
