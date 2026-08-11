using System.Globalization;

namespace Application.Helpers;

/// <summary>
/// Panel davrlari (`period` query parametri) va vaqt bucketlari.
/// Baza UTC saqlaydi, foydalanuvchi esa mahalliy vaqtni ko'radi: Toshkent = UTC+5,
/// yozgi vaqt yo'q, shu sababli oddiy siljish yetarli.
/// </summary>
public static class EnergyPeriod
{
    /// <summary>Asia/Tashkent — UTC+5, DST yo'q.</summary>
    public static readonly TimeSpan TashkentOffset = TimeSpan.FromHours(5);

    public const string BucketHour = "hour";
    public const string BucketDay = "day";

    /// <summary>UTC vaqtni mahalliy vaqtga o'tkazadi (Kind = Unspecified).</summary>
    private static DateTime ToLocal(DateTime utc) =>
        DateTime.SpecifyKind(utc + TashkentOffset, DateTimeKind.Unspecified);

    /// <summary>Mahalliy vaqtni UTC ga qaytaradi.</summary>
    private static DateTime ToUtc(DateTime local) =>
        DateTime.SpecifyKind(local - TashkentOffset, DateTimeKind.Utc);

    /// <summary>
    /// `period` satridan davr chegaralari va bucket turini aniqlaydi.
    /// Noma'lum qiymat "24h" ga tushadi.
    /// </summary>
    public static (DateTime FromUtc, DateTime ToUtc, string Bucket, string PeriodKey) Resolve(
        string? period, DateTime nowUtc)
    {
        var localNow = ToLocal(nowUtc);
        var localMidnight = localNow.Date;

        return (period?.Trim().ToLowerInvariant()) switch
        {
            "today" => (ToUtc(localMidnight), nowUtc, BucketHour, "today"),
            "7d"    => (ToUtc(localMidnight.AddDays(-6)), nowUtc, BucketDay, "7d"),
            "30d"   => (ToUtc(localMidnight.AddDays(-29)), nowUtc, BucketDay, "30d"),
            "month" => (ToUtc(new DateTime(localNow.Year, localNow.Month, 1)), nowUtc, BucketDay, "month"),
            _       => (nowUtc.AddHours(-24), nowUtc, BucketHour, "24h"),
        };
    }

    /// <summary>
    /// Soat boshi (UTC) qaysi bucketga tushishini satr kalit sifatida qaytaradi.
    /// Soatlik: "2026-08-11T14:00:00" · kunlik: "2026-08-11" (ikkalasi mahalliy vaqtda).
    /// </summary>
    public static string BucketKey(DateTime hourUtc, string bucket)
    {
        var local = ToLocal(hourUtc);

        return bucket == BucketDay
            ? local.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
            : local.ToString("yyyy-MM-ddTHH:00:00", CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Davrdagi barcha bucket kalitlari — ma'lumot kelmagan oraliqlar ham
    /// grafikda "0" bo'lib turishi uchun.
    /// </summary>
    public static IReadOnlyList<string> BucketKeys(DateTime fromUtc, DateTime toUtc, string bucket)
    {
        var keys = new List<string>();
        if (toUtc <= fromUtc)
            return keys;

        if (bucket == BucketDay)
        {
            var day = ToLocal(fromUtc).Date;
            var lastDay = ToLocal(toUtc).Date;

            while (day <= lastDay)
            {
                keys.Add(BucketKey(ToUtc(day), BucketDay));
                day = day.AddDays(1);
            }

            return keys;
        }

        var hour = new DateTime(fromUtc.Year, fromUtc.Month, fromUtc.Day, fromUtc.Hour, 0, 0, DateTimeKind.Utc);
        var lastHour = new DateTime(toUtc.Year, toUtc.Month, toUtc.Day, toUtc.Hour, 0, 0, DateTimeKind.Utc);

        while (hour <= lastHour)
        {
            keys.Add(BucketKey(hour, BucketHour));
            hour = hour.AddHours(1);
        }

        return keys;
    }
}
