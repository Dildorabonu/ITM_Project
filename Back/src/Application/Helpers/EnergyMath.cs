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
}
