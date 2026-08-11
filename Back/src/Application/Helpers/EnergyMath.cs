namespace Application.Helpers;

/// <summary>Bitta quvvat namunasi: o'lchov vaqti (UTC) va aktiv quvvat (W).</summary>
public readonly record struct PowerSample(DateTime At, double PowerW);

/// <summary>
/// Quvvat namunalaridan energiya (kWh) hisoblash. Energiya — quvvatning vaqt
/// bo'yicha integrali; ketma-ket ikki namuna orasi trapetsiya qoidasi bilan olinadi:
///   E += (P[i-1] + P[i]) / 2 * min(Δt, MaxGapSeconds)
/// Δt cheklovi qurilma uzilib qolganda (soatlab jim tursa) bo'shliq energiyani
/// soxta shishirmasligi uchun kerak.
/// </summary>
public static class EnergyMath
{
    /// <summary>Ikki namuna orasidagi eng katta hisobga olinadigan interval (soniya).</summary>
    public const double MaxGapSeconds = 60;

    private const double WattSecondsPerKwh = 3_600_000d;

    /// <param name="orderedSamples">
    /// <see cref="PowerSample.At"/> bo'yicha o'sish tartibida bo'lishi kutiladi.
    /// Tartibsiz (Δt &lt;= 0) oraliqlar e'tiborsiz qoldiriladi.
    /// </param>
    public static double ComputeKwh(
        IReadOnlyList<PowerSample> orderedSamples,
        double maxGapSeconds = MaxGapSeconds)
    {
        if (orderedSamples is null || orderedSamples.Count < 2)
            return 0;

        var wattSeconds = 0d;

        for (var i = 1; i < orderedSamples.Count; i++)
        {
            var prev = orderedSamples[i - 1];
            var curr = orderedSamples[i];

            var seconds = (curr.At - prev.At).TotalSeconds;
            if (seconds <= 0)
                continue;

            if (seconds > maxGapSeconds)
                seconds = maxGapSeconds;

            wattSeconds += (prev.PowerW + curr.PowerW) / 2d * seconds;
        }

        return wattSeconds / WattSecondsPerKwh;
    }

    /// <summary>
    /// Oynadan oldingi namunalardan faqat ENG OXIRGISINI ("anchor") qoldiradi,
    /// undan oldingilarini tashlab yuboradi.
    ///
    /// Anchor birinchi intervalning energiyasini bermasa, oyna boshidagi sarf
    /// yo'qoladi. Lekin anchordan oldingi namunalar ham qoldirilsa, ular orasidagi
    /// intervallar allaqachon OLDINGI oynaga yozilgan energiyani ikkinchi marta
    /// qo'shadi. Rollup va "jonli joriy soat" yo'llari shu bitta qoidaga tayanishi
    /// uchun mantiq shu yerda — bitta joyda — saqlanadi.
    /// </summary>
    /// <param name="orderedSamples">Vaqt bo'yicha o'sish tartibida.</param>
    /// <param name="windowStart">Oyna boshi (UTC) — undan oldingilari anchor hisoblanadi.</param>
    /// <param name="timeOf">Element vaqtini qaytaruvchi funksiya.</param>
    /// <returns>
    /// Anchor (bo'lsa) + oyna ichidagi barcha namunalar. Oyna ichida namuna
    /// bo'lmasa — bo'sh ro'yxat (yakka anchordan energiya chiqmaydi).
    /// </returns>
    public static List<T> TrimToAnchor<T>(
        IEnumerable<T> orderedSamples,
        DateTime windowStart,
        Func<T, DateTime> timeOf)
    {
        var result = new List<T>();
        var anchor = default(T);
        var hasAnchor = false;

        foreach (var sample in orderedSamples)
        {
            if (timeOf(sample) < windowStart)
            {
                anchor = sample;
                hasAnchor = true;
                continue;
            }

            if (hasAnchor)
            {
                result.Add(anchor!);
                hasAnchor = false;
            }

            result.Add(sample);
        }

        return result;
    }
}
