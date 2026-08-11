# Energiya monitoringi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/meter-data` sahifasini barcha qurilmalar bo'yicha energiya (kWh) va xarajat (so'm) ko'rsatuvchi panelga aylantirish, qurilma kartasi bosilganda batafsil ko'rinish bilan.

**Architecture:** Xom o'lchovlar (`MeterReadings`, ~3 s) ustidan soatlik agregat jadval (`MeterEnergyHourly`) quriladi — uni background servis to'ldiradi. Summary endpointlari tugallangan soatlarni rollupdan, joriy tugallanmagan soatni xom jadvaldan oladi. Narx `EnergyTariff` jadvalida tarix bilan saqlanadi. Modbus poller konfigdagi qurilmalar massivini parallel o'qiydi.

**Tech Stack:** .NET 8 (Clean Architecture, EF Core, PostgreSQL, xUnit + FluentAssertions + EF InMemory), Next.js 16 / React 19 / TypeScript / Tailwind v4, qo'lda yozilgan SVG grafiklar (yangi kutubxona yo'q).

**Spec:** `docs/superpowers/specs/2026-08-11-energiya-monitoringi-design.md`

## Global Constraints

- **Kod izohlari va UI matni — o'zbekcha (lotin).** Backend izohlari mavjud uslubda.
- **Barcha yangi UI matni `t("...")` ichida**, ruscha tarjimasi `client/lib/i18n/ru.ts` ga qo'shiladi. Tarjima qilinmaydi: permission satrlari, API maydon nomlari, enum kodlari, birlik belgilari (`kWh`, `kW`, `V`, `A`, `Hz`).
- **CSS tokenlardan tashqari rang/radius hardcode qilinmaydi** (`--accent`, `--surface`, `--radius`, …). CLAUDE.md "Frontend Dizayn Qoidalari" bo'limi majburiy.
- **Yangi npm paketi qo'shilmaydi.** Grafiklar qo'lda yozilgan SVG.
- **Vaqt zonasi:** baza UTC saqlaydi; bucketlar `Asia/Tashkent` = **UTC+5** (DST yo'q), konstanta `EnergyPeriod.TashkentOffset`.
- **kWh bo'shliq chegarasi:** `EnergyMath.MaxGapSeconds = 60`.
- **Tarif seed:** `1100`, `EffectiveFrom = 2026-06-01T00:00:00Z`, izoh `"Yuridik shaxslar uchun tarif (2026-yil 1-iyundan)"`.
- **Permission:** `PermissionModule.Energy = 17`, faqat `PermissionAction.Update`. O'qish endpointlari `[Authorize]` — hozirgi kirish huquqi o'zgarmaydi.
- **Enum'lar API javobida `string` sifatida** qaytariladi (`Bucket` maydoni `"hour"`/`"day"`) — enum serializatsiya muammosini oldini olish uchun.
- **Test naming:** `MetodNomi_Shart_KutilganNatija`, bloklar `// Arrange` / `// Act` / `// Assert`.
- **Test buyrug'i** (`Back/` papkasidan): `dotnet test test/Application.Tests/Application.Tests.csproj`
- **Frontend tekshiruv** (`client/` papkasidan): `npx tsc --noEmit` va `npm run lint`. Frontend uchun avtomatik test freymvorki yo'q — tekshiruv tip/lint + brauzerda qo'lda.

---

## File Structure

**Backend — yaratiladi:**

| Fayl | Mas'uliyati |
|---|---|
| `Back/src/Application/Helpers/EnergyMath.cs` | Toza kWh integratsiyasi (`PowerSample`, `ComputeKwh`) |
| `Back/src/Application/Helpers/EnergyPeriod.cs` | `period` satri → `(FromUtc, ToUtc, Bucket)`; local kun/soat bucket kalitlari |
| `Back/src/Application/Helpers/TariffResolver.cs` | Sanaga mos tarif narxini topish |
| `Back/src/Core/Entities/MeterEnergyHourly.cs` | Soatlik agregat entity |
| `Back/src/Core/Entities/EnergyTariff.cs` | Tarif entity |
| `Back/src/DataAccess/Configurations/MeterEnergyHourlyConfiguration.cs` | Unique indeks `(DeviceName, HourUtc)` |
| `Back/src/DataAccess/Configurations/EnergyTariffConfiguration.cs` | `EffectiveFrom` indeksi, `decimal(18,2)` |
| `Back/src/Application/DTOs/Energy/*.cs` | Summary, device detail, tarif, qurilma statusi DTO'lari |
| `Back/src/Application/Services/IEnergyRollupService.cs` + `Impl/EnergyRollupService.cs` | Xom → soatlik agregat upsert |
| `Back/src/Application/Services/IEnergyTariffService.cs` + `Impl/EnergyTariffService.cs` | Tarif CRUD |
| `Back/src/Application/Services/IEnergySummaryService.cs` + `Impl/EnergySummaryService.cs` | Panel ma'lumoti (umumiy + qurilma detali + statuslar) |
| `Back/src/API/Services/EnergyRollupBackgroundService.cs` | Har 5 daqiqada rollup + startda backfill |
| `Back/src/API/Controllers/EnergyTariffController.cs` | Tarif endpointlari |
| `Back/src/Application/Options/MeterDeviceOptions.cs` | Bitta qurilma konfigi |
| `Back/test/Application.Tests/Helpers/EnergyMathTests.cs` | |
| `Back/test/Application.Tests/Helpers/EnergyPeriodTests.cs` | |
| `Back/test/Application.Tests/Helpers/TariffResolverTests.cs` | |
| `Back/test/Application.Tests/Services/EnergyRollupServiceTests.cs` | |
| `Back/test/Application.Tests/Services/EnergyTariffServiceTests.cs` | |
| `Back/test/Application.Tests/Services/EnergySummaryServiceTests.cs` | |
| `Back/test/Application.Tests/Options/MeterPollerOptionsTests.cs` | |

**Backend — o'zgartiriladi:** `Core/Enums/PermissionModule.cs`, `DataAccess/Persistence/DatabaseContext.cs`, `DataAccess/Persistence/AutomatedMigration.cs`, `Application/ApplicationDependencyInjection.cs`, `Application/Options/MeterPollerOptions.cs`, `API/Services/MeterPollerService.cs`, `API/Controllers/MeterDataController.cs`, `API/Program.cs`, `API/appsettings.json`.

**Frontend — yaratiladi:**

| Fayl | Mas'uliyati |
|---|---|
| `client/lib/energyFormat.ts` | kWh/so'm/kW formatlash, qurilma rang palitrasi |
| `client/lib/energyTariff.ts` | Tarif CRUD servisi |
| `client/app/(main)/meter-data/_components/PeriodBar.tsx` | Davr tanlash + jonli + tarif chip |
| `client/app/(main)/meter-data/_components/KpiRow.tsx` | 5 ta KPI karta |
| `client/app/(main)/meter-data/_components/EnergyBarChart.tsx` | Stacked bar (qurilma ranglari) + xarajat |
| `client/app/(main)/meter-data/_components/DeviceDonut.tsx` | Qurilmalar ulushi |
| `client/app/(main)/meter-data/_components/Sparkline.tsx` | Karta ichidagi mini-grafik |
| `client/app/(main)/meter-data/_components/DeviceGrid.tsx` | Qurilma kartalari + qidiruv/saralash |
| `client/app/(main)/meter-data/_components/LiveCharts.tsx` | Mavjud `ChartCard` ko'chiriladi |
| `client/app/(main)/meter-data/_components/ReadingsTable.tsx` | Xom o'lchovlar jadvali |
| `client/app/(main)/meter-data/_components/DeviceDetail.tsx` | Qurilma detali ko'rinishi |
| `client/app/(main)/meter-data/_components/TariffModal.tsx` | Tarif ro'yxati/tahriri |

**Frontend — o'zgartiriladi:** `client/lib/meterData.ts`, `client/app/(main)/meter-data/page.tsx`, `client/lib/i18n/ru.ts`.

---

## Task 1: kWh matematikasi (`EnergyMath`)

**Files:**
- Create: `Back/src/Application/Helpers/EnergyMath.cs`
- Test: `Back/test/Application.Tests/Helpers/EnergyMathTests.cs`

**Interfaces:**
- Consumes: —
- Produces:
  - `public readonly record struct Application.Helpers.PowerSample(DateTime At, double PowerW)`
  - `public static double EnergyMath.ComputeKwh(IReadOnlyList<PowerSample> orderedSamples, double maxGapSeconds = EnergyMath.MaxGapSeconds)`
  - `public const double EnergyMath.MaxGapSeconds = 60`

- [ ] **Step 1: Write the failing test**

Create `Back/test/Application.Tests/Helpers/EnergyMathTests.cs`:

```csharp
using Application.Helpers;
using FluentAssertions;
using Xunit;

namespace Application.Tests.Helpers;

public class EnergyMathTests
{
    private static readonly DateTime T0 = new(2026, 8, 11, 10, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void ComputeKwh_WithConstantPower_ReturnsPowerTimesDuration()
    {
        // Arrange — 1000 W, 3600 soniya (1 soat) => 1 kWh
        var samples = new List<PowerSample>();
        for (var i = 0; i <= 120; i++)
            samples.Add(new PowerSample(T0.AddSeconds(i * 30), 1000));

        // Act
        var kwh = EnergyMath.ComputeKwh(samples);

        // Assert
        kwh.Should().BeApproximately(1.0, 0.0001);
    }

    [Fact]
    public void ComputeKwh_WithFewerThanTwoSamples_ReturnsZero()
    {
        // Arrange
        var one = new List<PowerSample> { new(T0, 5000) };

        // Act & Assert
        EnergyMath.ComputeKwh(one).Should().Be(0);
        EnergyMath.ComputeKwh([]).Should().Be(0);
    }

    [Fact]
    public void ComputeKwh_WithLongGap_CapsIntervalAtMaxGapSeconds()
    {
        // Arrange — 3 soatlik uzilish; faqat 60 soniya hisobga olinishi kerak
        var samples = new List<PowerSample>
        {
            new(T0, 3600),
            new(T0.AddHours(3), 3600),
        };

        // Act
        var kwh = EnergyMath.ComputeKwh(samples);

        // Assert — 3600 W × 60 s = 216 000 W·s = 0.06 kWh
        kwh.Should().BeApproximately(0.06, 0.0001);
    }

    [Fact]
    public void ComputeKwh_WithVaryingPower_UsesTrapezoidRule()
    {
        // Arrange — 0 W dan 2000 W ga 10 soniyada => o'rtacha 1000 W × 10 s
        var samples = new List<PowerSample>
        {
            new(T0, 0),
            new(T0.AddSeconds(10), 2000),
        };

        // Act
        var kwh = EnergyMath.ComputeKwh(samples);

        // Assert — 1000 × 10 = 10 000 W·s
        kwh.Should().BeApproximately(10_000d / 3_600_000d, 1e-9);
    }

    [Fact]
    public void ComputeKwh_WithNonIncreasingTimestamps_SkipsThoseIntervals()
    {
        // Arrange — teskari tartibdagi (buzuq) yozuv oralig'i e'tiborsiz qoldiriladi
        var samples = new List<PowerSample>
        {
            new(T0.AddSeconds(10), 1000),
            new(T0, 1000),
            new(T0.AddSeconds(20), 1000),
        };

        // Act
        var kwh = EnergyMath.ComputeKwh(samples);

        // Assert — faqat oxirgi juftlik (0 s → 20 s) hisobga olinadi: 1000 × 20
        kwh.Should().BeApproximately(20_000d / 3_600_000d, 1e-9);
    }

    [Fact]
    public void ComputeKwh_WithZeroPower_ReturnsZero()
    {
        // Arrange
        var samples = new List<PowerSample>
        {
            new(T0, 0),
            new(T0.AddSeconds(30), 0),
            new(T0.AddSeconds(60), 0),
        };

        // Act & Assert
        EnergyMath.ComputeKwh(samples).Should().Be(0);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run (`Back/` papkasidan):
```bash
dotnet test test/Application.Tests/Application.Tests.csproj --filter "FullyQualifiedName~EnergyMathTests"
```
Expected: kompilyatsiya xatosi — `EnergyMath` va `PowerSample` topilmaydi.

- [ ] **Step 3: Write minimal implementation**

Create `Back/src/Application/Helpers/EnergyMath.cs`:

```csharp
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
dotnet test test/Application.Tests/Application.Tests.csproj --filter "FullyQualifiedName~EnergyMathTests"
```
Expected: 6 test PASS.

- [ ] **Step 5: Commit**

```bash
git add Back/src/Application/Helpers/EnergyMath.cs Back/test/Application.Tests/Helpers/EnergyMathTests.cs
git commit -m "feat(energy): kWh integratsiyasi uchun EnergyMath helper"
```

---

## Task 2: Davr va bucket hisobi (`EnergyPeriod`)

**Files:**
- Create: `Back/src/Application/Helpers/EnergyPeriod.cs`
- Test: `Back/test/Application.Tests/Helpers/EnergyPeriodTests.cs`

**Interfaces:**
- Consumes: —
- Produces:
  - `public static readonly TimeSpan EnergyPeriod.TashkentOffset` (= 5 soat)
  - `public static (DateTime FromUtc, DateTime ToUtc, string Bucket, string PeriodKey) EnergyPeriod.Resolve(string? period, DateTime nowUtc)` — `Bucket` = `"hour"` yoki `"day"`
  - `public static string EnergyPeriod.BucketKey(DateTime hourUtc, string bucket)` — ISO-8601 satr: soat uchun `"2026-08-11T14:00:00"`, kun uchun `"2026-08-11"` (ikkalasi ham **mahalliy** vaqtda)
  - `public static IReadOnlyList<string> EnergyPeriod.BucketKeys(DateTime fromUtc, DateTime toUtc, string bucket)` — bo'sh bucketlarni ham qamrab oluvchi to'liq ketma-ketlik

- [ ] **Step 1: Write the failing test**

Create `Back/test/Application.Tests/Helpers/EnergyPeriodTests.cs`:

```csharp
using Application.Helpers;
using FluentAssertions;
using Xunit;

namespace Application.Tests.Helpers;

public class EnergyPeriodTests
{
    // 2026-08-11 09:30 UTC = 14:30 Toshkent
    private static readonly DateTime Now = new(2026, 8, 11, 9, 30, 0, DateTimeKind.Utc);

    [Fact]
    public void Resolve_WithToday_StartsAtLocalMidnightAndBucketsByHour()
    {
        // Act
        var (from, to, bucket, key) = EnergyPeriod.Resolve("today", Now);

        // Assert — 2026-08-11 00:00 Toshkent = 2026-08-10 19:00 UTC
        from.Should().Be(new DateTime(2026, 8, 10, 19, 0, 0, DateTimeKind.Utc));
        to.Should().Be(Now);
        bucket.Should().Be("hour");
        key.Should().Be("today");
    }

    [Fact]
    public void Resolve_With24h_StartsExactly24HoursBefore()
    {
        // Act
        var (from, to, bucket, _) = EnergyPeriod.Resolve("24h", Now);

        // Assert
        from.Should().Be(Now.AddHours(-24));
        to.Should().Be(Now);
        bucket.Should().Be("hour");
    }

    [Fact]
    public void Resolve_With7d_StartsAtLocalMidnightSixDaysAgoAndBucketsByDay()
    {
        // Act
        var (from, _, bucket, _) = EnergyPeriod.Resolve("7d", Now);

        // Assert — 2026-08-05 00:00 Toshkent = 2026-08-04 19:00 UTC
        from.Should().Be(new DateTime(2026, 8, 4, 19, 0, 0, DateTimeKind.Utc));
        bucket.Should().Be("day");
    }

    [Fact]
    public void Resolve_With30d_StartsAtLocalMidnight29DaysAgo()
    {
        // Act
        var (from, _, bucket, _) = EnergyPeriod.Resolve("30d", Now);

        // Assert — 2026-07-13 00:00 Toshkent = 2026-07-12 19:00 UTC
        from.Should().Be(new DateTime(2026, 7, 12, 19, 0, 0, DateTimeKind.Utc));
        bucket.Should().Be("day");
    }

    [Fact]
    public void Resolve_WithMonth_StartsAtLocalFirstOfMonth()
    {
        // Act
        var (from, _, bucket, _) = EnergyPeriod.Resolve("month", Now);

        // Assert — 2026-08-01 00:00 Toshkent = 2026-07-31 19:00 UTC
        from.Should().Be(new DateTime(2026, 7, 31, 19, 0, 0, DateTimeKind.Utc));
        bucket.Should().Be("day");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("xato-qiymat")]
    public void Resolve_WithUnknownPeriod_FallsBackTo24h(string? period)
    {
        // Act
        var (from, _, bucket, key) = EnergyPeriod.Resolve(period, Now);

        // Assert
        from.Should().Be(Now.AddHours(-24));
        bucket.Should().Be("hour");
        key.Should().Be("24h");
    }

    [Fact]
    public void BucketKey_WithHourBucket_ReturnsLocalHourIsoString()
    {
        // Arrange — 09:00 UTC = 14:00 Toshkent
        var hourUtc = new DateTime(2026, 8, 11, 9, 0, 0, DateTimeKind.Utc);

        // Act & Assert
        EnergyPeriod.BucketKey(hourUtc, "hour").Should().Be("2026-08-11T14:00:00");
    }

    [Fact]
    public void BucketKey_WithDayBucket_ReturnsLocalDate()
    {
        // Arrange — 20:00 UTC = ertasi kun 01:00 Toshkent
        var hourUtc = new DateTime(2026, 8, 11, 20, 0, 0, DateTimeKind.Utc);

        // Act & Assert
        EnergyPeriod.BucketKey(hourUtc, "day").Should().Be("2026-08-12");
    }

    [Fact]
    public void BucketKeys_WithDayBucket_ReturnsEveryLocalDayInRange()
    {
        // Arrange — 2026-08-09 00:00 Toshkent dan 2026-08-11 14:30 Toshkent gacha
        var from = new DateTime(2026, 8, 8, 19, 0, 0, DateTimeKind.Utc);

        // Act
        var keys = EnergyPeriod.BucketKeys(from, Now, "day");

        // Assert
        keys.Should().Equal("2026-08-09", "2026-08-10", "2026-08-11");
    }

    [Fact]
    public void BucketKeys_WithHourBucket_ReturnsEveryHourInclusiveOfCurrent()
    {
        // Arrange — 07:10 UTC dan 09:30 UTC gacha => 07, 08, 09 soatlari
        var from = new DateTime(2026, 8, 11, 7, 10, 0, DateTimeKind.Utc);

        // Act
        var keys = EnergyPeriod.BucketKeys(from, Now, "hour");

        // Assert — mahalliy vaqtda 12:00, 13:00, 14:00
        keys.Should().Equal("2026-08-11T12:00:00", "2026-08-11T13:00:00", "2026-08-11T14:00:00");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
dotnet test test/Application.Tests/Application.Tests.csproj --filter "FullyQualifiedName~EnergyPeriodTests"
```
Expected: kompilyatsiya xatosi — `EnergyPeriod` topilmaydi.

- [ ] **Step 3: Write minimal implementation**

Create `Back/src/Application/Helpers/EnergyPeriod.cs`:

```csharp
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
    public static DateTime ToLocal(DateTime utc) =>
        DateTime.SpecifyKind(utc + TashkentOffset, DateTimeKind.Unspecified);

    /// <summary>Mahalliy vaqtni UTC ga qaytaradi.</summary>
    public static DateTime ToUtc(DateTime local) =>
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
                keys.Add(day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
dotnet test test/Application.Tests/Application.Tests.csproj --filter "FullyQualifiedName~EnergyPeriodTests"
```
Expected: 11 test PASS (Theory 3 ta holat bilan).

- [ ] **Step 5: Commit**

```bash
git add Back/src/Application/Helpers/EnergyPeriod.cs Back/test/Application.Tests/Helpers/EnergyPeriodTests.cs
git commit -m "feat(energy): davr va bucket hisobi uchun EnergyPeriod helper"
```

---

## Task 3: Entity'lar, DbSet'lar va migratsiya

**Files:**
- Create: `Back/src/Core/Entities/MeterEnergyHourly.cs`
- Create: `Back/src/Core/Entities/EnergyTariff.cs`
- Create: `Back/src/DataAccess/Configurations/MeterEnergyHourlyConfiguration.cs`
- Create: `Back/src/DataAccess/Configurations/EnergyTariffConfiguration.cs`
- Modify: `Back/src/DataAccess/Persistence/DatabaseContext.cs` (DbSet'lar, ~46-qator atrofida)
- Create: migratsiya fayllari (`dotnet ef migrations add` avtomatik yaratadi)

**Interfaces:**
- Consumes: —
- Produces:
  - `Core.Entities.MeterEnergyHourly` — `Id`, `DeviceName`, `HourUtc`, `Kwh`, `AvgPowerW`, `PeakPowerW`, `MinPowerW`, `AvgVoltage`, `SampleCount`, `UpdatedAt`
  - `Core.Entities.EnergyTariff` — `Id`, `PricePerKwh` (`decimal`), `Currency`, `EffectiveFrom`, `Note`, `CreatedAt`, `CreatedByUserId`
  - `DatabaseContext.MeterEnergyHourly` (`DbSet<MeterEnergyHourly>`), `DatabaseContext.EnergyTariffs` (`DbSet<EnergyTariff>`)

- [ ] **Step 1: Create the `MeterEnergyHourly` entity**

Create `Back/src/Core/Entities/MeterEnergyHourly.cs`:

```csharp
namespace Core.Entities;

/// <summary>
/// Bitta qurilmaning bitta soatdagi agregat ko'rsatkichlari. Xom
/// <see cref="MeterReading"/> yozuvlaridan background rollup servisi hisoblab yozadi —
/// panel so'rovlari millionlab qatorni skanerlamasligi uchun.
/// </summary>
public class MeterEnergyHourly
{
    public Guid Id { get; set; }

    public string DeviceName { get; set; } = string.Empty;

    /// <summary>Soat boshi (UTC) — daqiqa/soniya har doim 0.</summary>
    public DateTime HourUtc { get; set; }

    /// <summary>Shu soatda sarflangan energiya (kVt·soat).</summary>
    public double Kwh { get; set; }

    public double AvgPowerW { get; set; }
    public double PeakPowerW { get; set; }
    public double MinPowerW { get; set; }

    /// <summary>O'rtacha kuchlanish (A faza), V.</summary>
    public double AvgVoltage { get; set; }

    /// <summary>Shu soatga tushgan xom o'lchovlar soni — ish vaqti (uptime) uchun.</summary>
    public int SampleCount { get; set; }

    /// <summary>Oxirgi marta qayta hisoblangan vaqt.</summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
```

- [ ] **Step 2: Create the `EnergyTariff` entity**

Create `Back/src/Core/Entities/EnergyTariff.cs`:

```csharp
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
```

- [ ] **Step 3: Create the EF configurations**

Create `Back/src/DataAccess/Configurations/MeterEnergyHourlyConfiguration.cs`:

```csharp
using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class MeterEnergyHourlyConfiguration : IEntityTypeConfiguration<MeterEnergyHourly>
{
    public void Configure(EntityTypeBuilder<MeterEnergyHourly> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.DeviceName).HasMaxLength(200).IsRequired();

        // Rollup upsert va davr bo'yicha o'qish — ikkalasi ham shu kalit ustidan.
        builder.HasIndex(x => new { x.DeviceName, x.HourUtc }).IsUnique();

        // Umumiy (barcha qurilma) davr so'rovi uchun.
        builder.HasIndex(x => x.HourUtc);
    }
}
```

Create `Back/src/DataAccess/Configurations/EnergyTariffConfiguration.cs`:

```csharp
using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class EnergyTariffConfiguration : IEntityTypeConfiguration<EnergyTariff>
{
    public void Configure(EntityTypeBuilder<EnergyTariff> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.PricePerKwh).HasPrecision(18, 2);
        builder.Property(x => x.Currency).HasMaxLength(16).IsRequired();
        builder.Property(x => x.Note).HasMaxLength(512);

        // Bitta sanada bitta tarif — takrorlanish tarifni noaniq qiladi.
        builder.HasIndex(x => x.EffectiveFrom).IsUnique();
    }
}
```

- [ ] **Step 4: Register the DbSets**

`Back/src/DataAccess/Persistence/DatabaseContext.cs` — `public DbSet<MeterReading> MeterReadings { get; set; }` qatoridan keyin qo'shing:

```csharp
    public DbSet<MeterEnergyHourly> MeterEnergyHourly { get; set; }
    public DbSet<EnergyTariff> EnergyTariffs { get; set; }
```

- [ ] **Step 5: Create the migration**

Run (`Back/src/` papkasidan):
```bash
dotnet ef migrations add AddEnergyRollupAndTariff --project DataAccess --startup-project API
```
Expected: `DataAccess/Migrations/` da yangi `*_AddEnergyRollupAndTariff.cs` fayli. Uni oching va `Up()` ichida `MeterEnergyHourly` hamda `EnergyTariffs` jadvallari yaratilayotganini, boshqa jadvalga o'zgarish kiritilmayotganini tasdiqlang. Agar aloqasiz o'zgarishlar bo'lsa — ularni migratsiyadan olib tashlang.

- [ ] **Step 6: Verify the build and the whole test suite**

Run (`Back/` papkasidan):
```bash
dotnet build Back.sln
dotnet test test/Application.Tests/Application.Tests.csproj
```
Expected: build muvaffaqiyatli; mavjud testlarning barchasi hamon PASS (InMemory provayder yangi jadvallarni `EnsureCreated()` bilan yaratadi).

- [ ] **Step 7: Commit**

```bash
git add Back/src/Core/Entities/MeterEnergyHourly.cs Back/src/Core/Entities/EnergyTariff.cs \
        Back/src/DataAccess/Configurations/MeterEnergyHourlyConfiguration.cs \
        Back/src/DataAccess/Configurations/EnergyTariffConfiguration.cs \
        Back/src/DataAccess/Persistence/DatabaseContext.cs \
        Back/src/DataAccess/Migrations/
git commit -m "feat(energy): MeterEnergyHourly va EnergyTariff jadvallari"
```

---

## Task 4: `Energy` permission moduli va tarif seed'i

**Files:**
- Modify: `Back/src/Core/Enums/PermissionModule.cs` (oxiriga, `Employees = 16` dan keyin)
- Modify: `Back/src/DataAccess/Persistence/AutomatedMigration.cs` (`ModuleActions` lug'ati va `ApplyMigrationsAsync`)

**Interfaces:**
- Consumes: —
- Produces: `PermissionModule.Energy = 17`; `"Energy.Update"` permission satri; bazada kamida bitta `EnergyTariff` yozuvi

- [ ] **Step 1: Add the enum value**

`Back/src/Core/Enums/PermissionModule.cs` — `Employees = 16,` dan keyin:

```csharp

    [Display(Name = "Elektr energiya", Description = "zap")]
    Energy = 17,
```

- [ ] **Step 2: Register the module's actions**

`Back/src/DataAccess/Persistence/AutomatedMigration.cs` — `ModuleActions` lug'atida `[PermissionModule.Employees] = [PermissionAction.View],` qatoridan keyin:

```csharp
        [PermissionModule.Energy]             = [PermissionAction.Update],
```

- [ ] **Step 3: Add the tariff seeder**

`Back/src/DataAccess/Persistence/AutomatedMigration.cs` — `ApplyMigrationsAsync` ichida `await BackfillProductQrCodesAsync(context);` dan keyin:

```csharp
        await SeedEnergyTariffAsync(context);
```

Shu faylning oxiriga (sinf ichida) metodni qo'shing:

```csharp
    /// <summary>
    /// Boshlang'ich elektr tarifi. Faqat jadval butunlay bo'sh bo'lsa yoziladi —
    /// administrator keyin UI orqali yangi tarif qo'shsa, bu qayta tiklanmaydi.
    /// </summary>
    private static async System.Threading.Tasks.Task SeedEnergyTariffAsync(DatabaseContext context)
    {
        if (await context.EnergyTariffs.AnyAsync())
            return;

        context.EnergyTariffs.Add(new EnergyTariff
        {
            Id = Guid.NewGuid(),
            PricePerKwh = 1100m,
            Currency = "so'm",
            EffectiveFrom = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc),
            Note = "Yuridik shaxslar uchun tarif (2026-yil 1-iyundan)",
            CreatedAt = DateTime.UtcNow,
        });

        await context.SaveChangesAsync();
    }
```

- [ ] **Step 4: Verify the build and existing tests**

Run (`Back/` papkasidan):
```bash
dotnet build Back.sln
dotnet test test/Application.Tests/Application.Tests.csproj
```
Expected: build muvaffaqiyatli, barcha mavjud testlar PASS.

- [ ] **Step 5: Commit**

```bash
git add Back/src/Core/Enums/PermissionModule.cs Back/src/DataAccess/Persistence/AutomatedMigration.cs
git commit -m "feat(energy): Energy.Update permission va boshlang'ich tarif seed'i"
```

---

## Task 5: Tarif narxini topish (`TariffResolver`)

**Files:**
- Create: `Back/src/Application/Helpers/TariffResolver.cs`
- Test: `Back/test/Application.Tests/Helpers/TariffResolverTests.cs`

**Interfaces:**
- Consumes: `Core.Entities.EnergyTariff` (Task 3)
- Produces: `public static decimal? TariffResolver.PriceAt(IReadOnlyList<EnergyTariff> ascendingByEffectiveFrom, DateTime atUtc)`

- [ ] **Step 1: Write the failing test**

Create `Back/test/Application.Tests/Helpers/TariffResolverTests.cs`:

```csharp
using Application.Helpers;
using Core.Entities;
using FluentAssertions;
using Xunit;

namespace Application.Tests.Helpers;

public class TariffResolverTests
{
    private static EnergyTariff Tariff(int year, int month, int day, decimal price) => new()
    {
        Id = Guid.NewGuid(),
        PricePerKwh = price,
        Currency = "so'm",
        EffectiveFrom = new DateTime(year, month, day, 0, 0, 0, DateTimeKind.Utc),
    };

    private static List<EnergyTariff> TwoTariffs() =>
    [
        Tariff(2025, 6, 1, 1000m),
        Tariff(2026, 6, 1, 1100m),
    ];

    [Fact]
    public void PriceAt_WithDateAfterLatestTariff_ReturnsLatestPrice()
    {
        // Act
        var price = TariffResolver.PriceAt(TwoTariffs(), new DateTime(2026, 8, 11, 0, 0, 0, DateTimeKind.Utc));

        // Assert
        price.Should().Be(1100m);
    }

    [Fact]
    public void PriceAt_WithDateBetweenTariffs_ReturnsEarlierPrice()
    {
        // Act
        var price = TariffResolver.PriceAt(TwoTariffs(), new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc));

        // Assert
        price.Should().Be(1000m);
    }

    [Fact]
    public void PriceAt_ExactlyOnEffectiveFrom_ReturnsThatTariff()
    {
        // Act
        var price = TariffResolver.PriceAt(TwoTariffs(), new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc));

        // Assert
        price.Should().Be(1100m);
    }

    [Fact]
    public void PriceAt_WithDateBeforeAllTariffs_ReturnsEarliestPrice()
    {
        // Act — eng erta tarifdan oldingi davr ham 0 emas, eng erta narx bilan baholanadi
        var price = TariffResolver.PriceAt(TwoTariffs(), new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc));

        // Assert
        price.Should().Be(1000m);
    }

    [Fact]
    public void PriceAt_WithEmptyList_ReturnsNull()
    {
        // Act
        var price = TariffResolver.PriceAt([], DateTime.UtcNow);

        // Assert
        price.Should().BeNull();
    }

    [Fact]
    public void PriceAt_WithUnsortedList_StillResolvesCorrectly()
    {
        // Arrange — tartibsiz ro'yxat
        var tariffs = new List<EnergyTariff>
        {
            Tariff(2026, 6, 1, 1100m),
            Tariff(2025, 6, 1, 1000m),
        };

        // Act
        var price = TariffResolver.PriceAt(tariffs, new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));

        // Assert
        price.Should().Be(1000m);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
dotnet test test/Application.Tests/Application.Tests.csproj --filter "FullyQualifiedName~TariffResolverTests"
```
Expected: kompilyatsiya xatosi — `TariffResolver` topilmaydi.

- [ ] **Step 3: Write minimal implementation**

Create `Back/src/Application/Helpers/TariffResolver.cs`:

```csharp
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
dotnet test test/Application.Tests/Application.Tests.csproj --filter "FullyQualifiedName~TariffResolverTests"
```
Expected: 6 test PASS.

- [ ] **Step 5: Commit**

```bash
git add Back/src/Application/Helpers/TariffResolver.cs Back/test/Application.Tests/Helpers/TariffResolverTests.cs
git commit -m "feat(energy): sanaga mos tarifni topuvchi TariffResolver"
```

---

## Task 6: Rollup servisi (`EnergyRollupService`)

**Files:**
- Create: `Back/src/Application/Services/IEnergyRollupService.cs`
- Create: `Back/src/Application/Services/Impl/EnergyRollupService.cs`
- Modify: `Back/src/Application/ApplicationDependencyInjection.cs` (`IMeterDataService` qatoridan keyin)
- Test: `Back/test/Application.Tests/Services/EnergyRollupServiceTests.cs`

**Interfaces:**
- Consumes: `EnergyMath.ComputeKwh`, `PowerSample` (Task 1); `MeterEnergyHourly` (Task 3)
- Produces:
  - `Task<int> IEnergyRollupService.RollupRangeAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct = default)` — upsert qilingan soat-qatorlar soni
  - `Task<int> IEnergyRollupService.RollupRecentAsync(TimeSpan lookback, CancellationToken ct = default)`
  - `Task<int> IEnergyRollupService.BackfillAsync(CancellationToken ct = default)`
  - Test uchun konstruktor: `EnergyRollupService(DatabaseContext, Func<DateTime> nowUtc)` — `RollupRecentAsync`/`BackfillAsync` "hozir"ga tayanadi, shu sababli soat testda boshqariladi bo'lmasa test soat vaqtiga bog'liq (flaky) bo'lib qoladi

- [ ] **Step 1: Write the failing test**

Create `Back/test/Application.Tests/Services/EnergyRollupServiceTests.cs`:

```csharp
using Application.Services.Impl;
using Application.Tests.Infrastructure;
using Core.Entities;
using DataAccess.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Task = System.Threading.Tasks.Task;

namespace Application.Tests.Services;

public class EnergyRollupServiceTests
{
    private static readonly DateTime Hour10 = new(2026, 8, 11, 10, 0, 0, DateTimeKind.Utc);

    /// <summary>"Hozir" — 12:00, ya'ni seed qilingan soatlardan keyin. Real soatga bog'lanmaydi.</summary>
    private static readonly DateTime Now = Hour10.AddHours(2);

    private static EnergyRollupService CreateSut(DatabaseContext db) => new(db, () => Now);

    /// <summary>Berilgan soat davomida har 30 soniyada bir xil quvvatli o'lchov yozadi.</summary>
    private static void SeedConstantHour(DatabaseContext db, string device, DateTime hourUtc, double powerW)
    {
        for (var i = 0; i < 120; i++)
        {
            db.MeterReadings.Add(new MeterReading
            {
                Id = Guid.NewGuid(),
                DeviceName = device,
                VoltagePhaseA = 230,
                CurrentPhaseA = powerW / 230,
                ActivePower = powerW,
                Frequency = 50,
                CreatedAt = hourUtc.AddSeconds(i * 30),
            });
        }

        db.SaveChanges();
    }

    [Fact]
    public async Task RollupRangeAsync_WithOneFullHour_WritesSingleHourlyRow()
    {
        // Arrange — 1000 W, soat davomida
        await using var db = TestDbContextFactory.Create();
        SeedConstantHour(db, "DR134", Hour10, 1000);
        var sut = CreateSut(db);

        // Act
        var written = await sut.RollupRangeAsync(Hour10, Hour10.AddHours(1));

        // Assert
        written.Should().Be(1);

        var row = await db.MeterEnergyHourly.SingleAsync();
        row.DeviceName.Should().Be("DR134");
        row.HourUtc.Should().Be(Hour10);
        // 119 ta 30-soniyalik interval × 1000 W = 3 570 000 W·s ≈ 0.9917 kWh
        row.Kwh.Should().BeApproximately(0.9917, 0.001);
        row.AvgPowerW.Should().BeApproximately(1000, 0.001);
        row.PeakPowerW.Should().Be(1000);
        row.MinPowerW.Should().Be(1000);
        row.AvgVoltage.Should().BeApproximately(230, 0.001);
        row.SampleCount.Should().Be(120);
    }

    [Fact]
    public async Task RollupRangeAsync_RunTwice_IsIdempotent()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedConstantHour(db, "DR134", Hour10, 1000);
        var sut = CreateSut(db);

        // Act
        await sut.RollupRangeAsync(Hour10, Hour10.AddHours(1));
        var firstKwh = (await db.MeterEnergyHourly.SingleAsync()).Kwh;
        await sut.RollupRangeAsync(Hour10, Hour10.AddHours(1));

        // Assert — qator ko'paymaydi, qiymat o'zgarmaydi
        var rows = await db.MeterEnergyHourly.ToListAsync();
        rows.Should().HaveCount(1);
        rows[0].Kwh.Should().BeApproximately(firstKwh, 1e-9);
    }

    [Fact]
    public async Task RollupRangeAsync_WithTwoDevices_WritesRowPerDevicePerHour()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedConstantHour(db, "DR134", Hour10, 1000);
        SeedConstantHour(db, "DR201", Hour10, 2000);
        var sut = CreateSut(db);

        // Act
        var written = await sut.RollupRangeAsync(Hour10, Hour10.AddHours(1));

        // Assert
        written.Should().Be(2);
        var rows = await db.MeterEnergyHourly.OrderBy(r => r.DeviceName).ToListAsync();
        rows[0].DeviceName.Should().Be("DR134");
        rows[1].DeviceName.Should().Be("DR201");
        rows[1].Kwh.Should().BeApproximately(rows[0].Kwh * 2, 0.001);
    }

    [Fact]
    public async Task RollupRangeAsync_AssignsEnergyToHourOfLaterSample()
    {
        // Arrange — soat chegarasidan o'tuvchi o'lchovlar
        await using var db = TestDbContextFactory.Create();
        db.MeterReadings.AddRange(
            new MeterReading { Id = Guid.NewGuid(), DeviceName = "DR134", ActivePower = 3600, VoltagePhaseA = 230, Frequency = 50, CreatedAt = Hour10.AddMinutes(59).AddSeconds(50) },
            new MeterReading { Id = Guid.NewGuid(), DeviceName = "DR134", ActivePower = 3600, VoltagePhaseA = 230, Frequency = 50, CreatedAt = Hour10.AddHours(1).AddSeconds(10) });
        await db.SaveChangesAsync();
        var sut = CreateSut(db);

        // Act — 11:00 soatini hisoblaymiz; oldingi soatdagi o'lchov anchor sifatida olinishi kerak
        await sut.RollupRangeAsync(Hour10.AddHours(1), Hour10.AddHours(2));

        // Assert — 20 soniyalik interval to'liq 11:00 soatiga yoziladi
        var row = await db.MeterEnergyHourly.SingleAsync(r => r.HourUtc == Hour10.AddHours(1));
        row.Kwh.Should().BeApproximately(3600d * 20d / 3_600_000d, 1e-9);
    }

    [Fact]
    public async Task RollupRangeAsync_WithNoReadings_WritesNothing()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        // Act
        var written = await sut.RollupRangeAsync(Hour10, Hour10.AddHours(1));

        // Assert
        written.Should().Be(0);
        (await db.MeterEnergyHourly.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task RollupRangeAsync_WhenReadingsChange_UpdatesExistingRow()
    {
        // Arrange — avval yarim soat, keyin to'liq soat
        await using var db = TestDbContextFactory.Create();
        for (var i = 0; i < 60; i++)
        {
            db.MeterReadings.Add(new MeterReading
            {
                Id = Guid.NewGuid(), DeviceName = "DR134", ActivePower = 1000,
                VoltagePhaseA = 230, Frequency = 50, CreatedAt = Hour10.AddSeconds(i * 30),
            });
        }
        await db.SaveChangesAsync();
        var sut = CreateSut(db);
        await sut.RollupRangeAsync(Hour10, Hour10.AddHours(1));
        var halfKwh = (await db.MeterEnergyHourly.SingleAsync()).Kwh;

        // Act — qolgan yarmi keldi, qayta hisoblaymiz
        for (var i = 60; i < 120; i++)
        {
            db.MeterReadings.Add(new MeterReading
            {
                Id = Guid.NewGuid(), DeviceName = "DR134", ActivePower = 1000,
                VoltagePhaseA = 230, Frequency = 50, CreatedAt = Hour10.AddSeconds(i * 30),
            });
        }
        await db.SaveChangesAsync();
        await sut.RollupRangeAsync(Hour10, Hour10.AddHours(1));

        // Assert
        var rows = await db.MeterEnergyHourly.ToListAsync();
        rows.Should().HaveCount(1);
        rows[0].Kwh.Should().BeApproximately(halfKwh * 2, 0.01);
        rows[0].SampleCount.Should().Be(120);
    }

    [Fact]
    public async Task BackfillAsync_WithNoRollupRows_CoversAllReadingHours()
    {
        // Arrange — ketma-ket ikki soat
        await using var db = TestDbContextFactory.Create();
        SeedConstantHour(db, "DR134", Hour10, 1000);
        SeedConstantHour(db, "DR134", Hour10.AddHours(1), 1000);
        var sut = CreateSut(db);

        // Act
        await sut.BackfillAsync();

        // Assert
        var hours = await db.MeterEnergyHourly.Select(r => r.HourUtc).OrderBy(h => h).ToListAsync();
        hours.Should().Contain(Hour10).And.Contain(Hour10.AddHours(1));
    }

    [Fact]
    public async Task BackfillAsync_WithNoReadings_DoesNothing()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        // Act
        var written = await sut.BackfillAsync();

        // Assert
        written.Should().Be(0);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
dotnet test test/Application.Tests/Application.Tests.csproj --filter "FullyQualifiedName~EnergyRollupServiceTests"
```
Expected: kompilyatsiya xatosi — `EnergyRollupService` topilmaydi.

- [ ] **Step 3: Write the interface**

Create `Back/src/Application/Services/IEnergyRollupService.cs`:

```csharp
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
```

- [ ] **Step 4: Write the implementation**

Create `Back/src/Application/Services/Impl/EnergyRollupService.cs`:

```csharp
using Application.Helpers;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class EnergyRollupService : IEnergyRollupService
{
    /// <summary>Bir marta xotiraga o'qiladigan eng katta oraliq — xotirani cheklaydi.</summary>
    private static readonly TimeSpan ChunkSize = TimeSpan.FromHours(6);

    private readonly DatabaseContext _context;
    private readonly Func<DateTime> _nowUtc;

    public EnergyRollupService(DatabaseContext context)
        : this(context, () => DateTime.UtcNow)
    {
    }

    /// <summary>Test uchun — "hozir"ni tashqaridan berish imkoni bilan.</summary>
    public EnergyRollupService(DatabaseContext context, Func<DateTime> nowUtc)
    {
        _context = context;
        _nowUtc = nowUtc;
    }

    public async Task<int> RollupRecentAsync(TimeSpan lookback, CancellationToken ct = default)
    {
        var now = _nowUtc();
        return await RollupRangeAsync(now - lookback, now, ct);
    }

    public async Task<int> BackfillAsync(CancellationToken ct = default)
    {
        // Qayerdan boshlash: oxirgi hisoblangan soatdan, u ham bo'lmasa eng erta o'lchovdan.
        var lastHour = await _context.MeterEnergyHourly
            .AsNoTracking()
            .OrderByDescending(r => r.HourUtc)
            .Select(r => (DateTime?)r.HourUtc)
            .FirstOrDefaultAsync(ct);

        var from = lastHour ?? await _context.MeterReadings
            .AsNoTracking()
            .OrderBy(r => r.CreatedAt)
            .Select(r => (DateTime?)r.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (from is null)
            return 0;

        return await RollupRangeAsync(from.Value, _nowUtc(), ct);
    }

    public async Task<int> RollupRangeAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct = default)
    {
        var from = FloorHour(fromUtc);
        var to = CeilHour(toUtc);

        if (to <= from)
            return 0;

        var total = 0;

        for (var chunkStart = from; chunkStart < to; chunkStart += ChunkSize)
        {
            ct.ThrowIfCancellationRequested();

            var chunkEnd = chunkStart + ChunkSize;
            if (chunkEnd > to)
                chunkEnd = to;

            total += await RollupChunkAsync(chunkStart, chunkEnd, ct);
        }

        return total;
    }

    /// <summary>
    /// Bitta bo'lakni hisoblaydi. Oraliq boshidan oldingi <see cref="EnergyMath.MaxGapSeconds"/>
    /// soniyalik "anchor" ham o'qiladi — birinchi interval energiyasi yo'qolmasligi uchun.
    /// </summary>
    private async Task<int> RollupChunkAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct)
    {
        var anchorFrom = fromUtc.AddSeconds(-EnergyMath.MaxGapSeconds);

        var readings = await _context.MeterReadings
            .AsNoTracking()
            .Where(r => r.CreatedAt >= anchorFrom && r.CreatedAt < toUtc)
            .OrderBy(r => r.DeviceName)
            .ThenBy(r => r.CreatedAt)
            .Select(r => new ReadingRow(r.DeviceName, r.CreatedAt, r.ActivePower, r.VoltagePhaseA))
            .ToListAsync(ct);

        if (readings.Count == 0)
            return 0;

        // (qurilma, soat) → agregat
        var buckets = new Dictionary<(string Device, DateTime Hour), Bucket>();

        foreach (var group in readings.GroupBy(r => r.DeviceName))
        {
            var ordered = group.OrderBy(r => r.CreatedAt).ToList();

            for (var i = 0; i < ordered.Count; i++)
            {
                var curr = ordered[i];
                var hour = FloorHour(curr.CreatedAt);

                // Anchor o'lchovi (oraliqdan oldingi) statistikaga kirmaydi —
                // u faqat birinchi intervalning energiyasini berish uchun kerak.
                var insideRange = curr.CreatedAt >= fromUtc;

                if (insideRange)
                {
                    var bucket = GetOrAdd(buckets, (curr.DeviceName, hour));
                    bucket.Add(curr.ActivePower, curr.VoltagePhaseA);
                }

                if (i == 0)
                    continue;

                // Interval energiyasi kechki namunaning soatiga yoziladi.
                var prev = ordered[i - 1];
                var pair = new List<PowerSample>
                {
                    new(prev.CreatedAt, prev.ActivePower),
                    new(curr.CreatedAt, curr.ActivePower),
                };

                var kwh = EnergyMath.ComputeKwh(pair);
                if (kwh <= 0 || hour < FloorHour(fromUtc))
                    continue;

                GetOrAdd(buckets, (curr.DeviceName, hour)).Kwh += kwh;
            }
        }

        if (buckets.Count == 0)
            return 0;

        await UpsertAsync(buckets, fromUtc, toUtc, ct);
        return buckets.Count;
    }

    private async Task UpsertAsync(
        Dictionary<(string Device, DateTime Hour), Bucket> buckets,
        DateTime fromUtc,
        DateTime toUtc,
        CancellationToken ct)
    {
        var existing = await _context.MeterEnergyHourly
            .Where(r => r.HourUtc >= fromUtc && r.HourUtc < toUtc)
            .ToListAsync(ct);

        var index = existing.ToDictionary(r => (r.DeviceName, r.HourUtc));
        var now = DateTime.UtcNow;

        foreach (var ((device, hour), bucket) in buckets)
        {
            if (!index.TryGetValue((device, hour), out var row))
            {
                row = new MeterEnergyHourly
                {
                    Id = Guid.NewGuid(),
                    DeviceName = device,
                    HourUtc = hour,
                };
                _context.MeterEnergyHourly.Add(row);
            }

            row.Kwh = bucket.Kwh;
            row.AvgPowerW = bucket.AvgPower;
            row.PeakPowerW = bucket.PeakPower;
            row.MinPowerW = bucket.MinPower;
            row.AvgVoltage = bucket.AvgVoltage;
            row.SampleCount = bucket.Count;
            row.UpdatedAt = now;
        }

        await _context.SaveChangesAsync(ct);
    }

    private static Bucket GetOrAdd(
        Dictionary<(string, DateTime), Bucket> buckets, (string Device, DateTime Hour) key)
    {
        if (!buckets.TryGetValue(key, out var bucket))
        {
            bucket = new Bucket();
            buckets[key] = bucket;
        }

        return bucket;
    }

    private static DateTime FloorHour(DateTime value) =>
        new(value.Year, value.Month, value.Day, value.Hour, 0, 0, DateTimeKind.Utc);

    private static DateTime CeilHour(DateTime value)
    {
        var floor = FloorHour(value);
        return floor == value ? floor : floor.AddHours(1);
    }

    private readonly record struct ReadingRow(
        string DeviceName, DateTime CreatedAt, double ActivePower, double VoltagePhaseA);

    private sealed class Bucket
    {
        private double _powerSum;
        private double _voltageSum;

        public double Kwh { get; set; }
        public int Count { get; private set; }
        public double PeakPower { get; private set; } = double.MinValue;
        public double MinPower { get; private set; } = double.MaxValue;

        public double AvgPower => Count == 0 ? 0 : _powerSum / Count;
        public double AvgVoltage => Count == 0 ? 0 : _voltageSum / Count;

        public void Add(double powerW, double voltage)
        {
            Count++;
            _powerSum += powerW;
            _voltageSum += voltage;

            if (powerW > PeakPower) PeakPower = powerW;
            if (powerW < MinPower) MinPower = powerW;
        }
    }
}
```

> **Diqqat:** `Bucket.PeakPower`/`MinPower` sentinel qiymatlari (`double.MinValue`/`MaxValue`) bilan boshlanadi. Agar bucketga birorta ham namuna qo'shilmagan bo'lsa (faqat energiya yozilgan holat), ular sentinel qoladi. Buni oldini olish uchun `UpsertAsync` da yozishdan oldin normallashtiring — Step 5 da tekshiriladi.

- [ ] **Step 5: Normalise the empty-bucket sentinels**

`EnergyRollupService.Bucket` sinfiga qo'shing (`AvgVoltage` dan keyin):

```csharp
        public double SafePeakPower => Count == 0 ? 0 : PeakPower;
        public double SafeMinPower => Count == 0 ? 0 : MinPower;
```

Va `UpsertAsync` ichida ishlatilishini almashtiring:

```csharp
            row.PeakPowerW = bucket.SafePeakPower;
            row.MinPowerW = bucket.SafeMinPower;
```

- [ ] **Step 6: Register the service in DI**

`Back/src/Application/ApplicationDependencyInjection.cs` — `services.AddScoped<IMeterDataService, MeterDataService>();` qatoridan keyin:

```csharp
        services.AddScoped<IEnergyRollupService, EnergyRollupService>();
```

- [ ] **Step 7: Run tests to verify they pass**

Run:
```bash
dotnet test test/Application.Tests/Application.Tests.csproj --filter "FullyQualifiedName~EnergyRollupServiceTests"
```
Expected: 8 test PASS.

- [ ] **Step 8: Run the whole suite**

Run:
```bash
dotnet test test/Application.Tests/Application.Tests.csproj
```
Expected: barcha testlar PASS.

- [ ] **Step 9: Commit**

```bash
git add Back/src/Application/Services/IEnergyRollupService.cs \
        Back/src/Application/Services/Impl/EnergyRollupService.cs \
        Back/src/Application/ApplicationDependencyInjection.cs \
        Back/test/Application.Tests/Services/EnergyRollupServiceTests.cs
git commit -m "feat(energy): soatlik rollup servisi"
```

---

## Task 7: Rollup background servisi

**Files:**
- Create: `Back/src/API/Services/EnergyRollupBackgroundService.cs`
- Modify: `Back/src/API/Program.cs` (`AddHostedService<API.Services.MeterPollerService>()` yonida, ~183-qator)

**Interfaces:**
- Consumes: `IEnergyRollupService` (Task 6)
- Produces: — (hosted servis, tashqi API bermaydi)

- [ ] **Step 1: Write the background service**

Create `Back/src/API/Services/EnergyRollupBackgroundService.cs`:

```csharp
using Application.Services;

namespace API.Services;

/// <summary>
/// Xom o'lchovlarni soatlik agregatga yig'ib turadi.
/// Startda bo'shliqni to'ldiradi (servis o'chib turgan davr uchun), so'ng har
/// <see cref="CycleInterval"/> da oxirgi <see cref="Lookback"/> oralig'ini qayta
/// hisoblaydi — joriy tugallanmagan soat ham to'g'ri yangilanib boradi.
/// </summary>
public class EnergyRollupBackgroundService : BackgroundService
{
    private static readonly TimeSpan CycleInterval = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan Lookback = TimeSpan.FromHours(2);
    private static readonly TimeSpan StartupDelay = TimeSpan.FromSeconds(20);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<EnergyRollupBackgroundService> _logger;

    public EnergyRollupBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<EnergyRollupBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Migratsiya va seed tugashini kutamiz.
        try
        {
            await Task.Delay(StartupDelay, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        await RunSafelyAsync(
            async service =>
            {
                var written = await service.BackfillAsync(stoppingToken);
                _logger.LogInformation("Energiya rollup backfill: {Count} soat hisoblandi.", written);
            },
            stoppingToken);

        using var timer = new PeriodicTimer(CycleInterval);

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await RunSafelyAsync(
                    service => service.RollupRecentAsync(Lookback, stoppingToken),
                    stoppingToken);
            }
        }
        catch (OperationCanceledException)
        {
            // normal to'xtash
        }
    }

    /// <summary>Xato bo'lsa log qilib davom etamiz — servis to'xtamasligi kerak.</summary>
    private async Task RunSafelyAsync(Func<IEnergyRollupService, Task> action, CancellationToken ct)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<IEnergyRollupService>();
            await action(service);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // to'xtatilmoqda
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Energiya rollup xatosi: {Message}", ex.Message);
        }
    }
}
```

- [ ] **Step 2: Register the hosted service**

`Back/src/API/Program.cs` — `builder.Services.AddHostedService<API.Services.MeterPollerService>();` qatoridan keyin:

```csharp
            builder.Services.AddHostedService<API.Services.EnergyRollupBackgroundService>();
```

- [ ] **Step 3: Verify the build**

Run (`Back/` papkasidan):
```bash
dotnet build Back.sln
```
Expected: build muvaffaqiyatli, ogohlantirishsiz.

- [ ] **Step 4: Commit**

```bash
git add Back/src/API/Services/EnergyRollupBackgroundService.cs Back/src/API/Program.cs
git commit -m "feat(energy): rollup background servisi (startda backfill + har 5 daqiqada)"
```

---

## Task 8: Tarif DTO'lari, servisi va controlleri

**Files:**
- Create: `Back/src/Application/DTOs/Energy/EnergyTariffDto.cs`
- Create: `Back/src/Application/Services/IEnergyTariffService.cs`
- Create: `Back/src/Application/Services/Impl/EnergyTariffService.cs`
- Create: `Back/src/API/Controllers/EnergyTariffController.cs`
- Modify: `Back/src/Application/ApplicationDependencyInjection.cs`
- Test: `Back/test/Application.Tests/Services/EnergyTariffServiceTests.cs`

**Interfaces:**
- Consumes: `EnergyTariff` (Task 3), `ApiResult<T>` (mavjud)
- Produces:
  - `Application.DTOs.Energy.EnergyTariffDto` — `Id`, `PricePerKwh`, `Currency`, `EffectiveFrom`, `Note`, `CreatedAt`, `CreatedByUserId`, `CreatedByName`
  - `Application.DTOs.Energy.EnergyTariffSaveDto` — `PricePerKwh`, `Currency`, `EffectiveFrom`, `Note`
  - `Task<ApiResult<IEnumerable<EnergyTariffDto>>> IEnergyTariffService.GetAllAsync()`
  - `Task<ApiResult<Guid>> IEnergyTariffService.CreateAsync(EnergyTariffSaveDto dto, Guid userId)`
  - `Task<ApiResult<bool>> IEnergyTariffService.UpdateAsync(Guid id, EnergyTariffSaveDto dto)`
  - `Task<ApiResult<bool>> IEnergyTariffService.DeleteAsync(Guid id)`
  - Endpointlar: `GET/POST/PUT/DELETE /api/energy-tariffs`

- [ ] **Step 1: Write the failing test**

Create `Back/test/Application.Tests/Services/EnergyTariffServiceTests.cs`:

```csharp
using Application.DTOs.Energy;
using Application.Services.Impl;
using Application.Tests.Infrastructure;
using Core.Entities;
using DataAccess.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Task = System.Threading.Tasks.Task;

namespace Application.Tests.Services;

public class EnergyTariffServiceTests
{
    private static readonly DateTime June2026 = new(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);

    private static EnergyTariff Seed(DatabaseContext db, DateTime effectiveFrom, decimal price)
    {
        var tariff = new EnergyTariff
        {
            Id = Guid.NewGuid(),
            PricePerKwh = price,
            Currency = "so'm",
            EffectiveFrom = effectiveFrom,
            CreatedAt = DateTime.UtcNow,
        };

        db.EnergyTariffs.Add(tariff);
        db.SaveChanges();
        return tariff;
    }

    private static EnergyTariffSaveDto SaveDto(DateTime effectiveFrom, decimal price) => new()
    {
        PricePerKwh = price,
        Currency = "so'm",
        EffectiveFrom = effectiveFrom,
        Note = "test",
    };

    [Fact]
    public async Task GetAllAsync_ReturnsTariffsNewestFirst()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        Seed(db, June2026.AddYears(-1), 1000m);
        Seed(db, June2026, 1100m);
        var sut = new EnergyTariffService(db);

        // Act
        var result = await sut.GetAllAsync();

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result!.Select(t => t.PricePerKwh).Should().Equal(1100m, 1000m);
    }

    [Fact]
    public async Task CreateAsync_WithValidDto_PersistsTariff()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = new EnergyTariffService(db);
        var userId = Guid.NewGuid();

        // Act
        var result = await sut.CreateAsync(SaveDto(June2026, 1100m), userId);

        // Assert
        result.Succeeded.Should().BeTrue();
        var saved = await db.EnergyTariffs.SingleAsync();
        saved.PricePerKwh.Should().Be(1100m);
        saved.CreatedByUserId.Should().Be(userId);
        saved.EffectiveFrom.Kind.Should().Be(DateTimeKind.Utc);
    }

    [Fact]
    public async Task CreateAsync_WithNonPositivePrice_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = new EnergyTariffService(db);

        // Act
        var result = await sut.CreateAsync(SaveDto(June2026, 0m), Guid.NewGuid());

        // Assert
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        (await db.EnergyTariffs.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task CreateAsync_WithDuplicateEffectiveFrom_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        Seed(db, June2026, 1100m);
        var sut = new EnergyTariffService(db);

        // Act
        var result = await sut.CreateAsync(SaveDto(June2026, 1200m), Guid.NewGuid());

        // Assert
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task UpdateAsync_WithExistingId_ChangesPrice()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var tariff = Seed(db, June2026, 1100m);
        var sut = new EnergyTariffService(db);

        // Act
        var result = await sut.UpdateAsync(tariff.Id, SaveDto(June2026, 1250m));

        // Assert
        result.Succeeded.Should().BeTrue();
        (await db.EnergyTariffs.SingleAsync()).PricePerKwh.Should().Be(1250m);
    }

    [Fact]
    public async Task UpdateAsync_WithMissingId_ReturnsNotFound()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = new EnergyTariffService(db);

        // Act
        var result = await sut.UpdateAsync(Guid.NewGuid(), SaveDto(June2026, 1100m));

        // Assert
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteAsync_WithMoreThanOneTariff_RemovesIt()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var old = Seed(db, June2026.AddYears(-1), 1000m);
        Seed(db, June2026, 1100m);
        var sut = new EnergyTariffService(db);

        // Act
        var result = await sut.DeleteAsync(old.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        (await db.EnergyTariffs.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task DeleteAsync_WithLastRemainingTariff_ReturnsFailure()
    {
        // Arrange — oxirgi tarif o'chirilsa xarajat hisoblab bo'lmaydi
        await using var db = TestDbContextFactory.Create();
        var only = Seed(db, June2026, 1100m);
        var sut = new EnergyTariffService(db);

        // Act
        var result = await sut.DeleteAsync(only.Id);

        // Assert
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        (await db.EnergyTariffs.CountAsync()).Should().Be(1);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
dotnet test test/Application.Tests/Application.Tests.csproj --filter "FullyQualifiedName~EnergyTariffServiceTests"
```
Expected: kompilyatsiya xatosi — `EnergyTariffService`, `EnergyTariffSaveDto` topilmaydi.

- [ ] **Step 3: Write the DTOs**

Create `Back/src/Application/DTOs/Energy/EnergyTariffDto.cs`:

```csharp
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
```

- [ ] **Step 4: Write the service interface**

Create `Back/src/Application/Services/IEnergyTariffService.cs`:

```csharp
using Application.DTOs;
using Application.DTOs.Energy;

namespace Application.Services;

/// <summary>Elektr tariflari (1 kVt·soat narxi) — tarix bilan.</summary>
public interface IEnergyTariffService
{
    Task<ApiResult<IEnumerable<EnergyTariffDto>>> GetAllAsync();
    Task<ApiResult<Guid>> CreateAsync(EnergyTariffSaveDto dto, Guid userId);
    Task<ApiResult<bool>> UpdateAsync(Guid id, EnergyTariffSaveDto dto);
    Task<ApiResult<bool>> DeleteAsync(Guid id);
}
```

- [ ] **Step 5: Write the service implementation**

Create `Back/src/Application/Services/Impl/EnergyTariffService.cs`:

```csharp
using Application.DTOs;
using Application.DTOs.Energy;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class EnergyTariffService : IEnergyTariffService
{
    private readonly DatabaseContext _context;

    public EnergyTariffService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<IEnumerable<EnergyTariffDto>>> GetAllAsync()
    {
        var tariffs = await _context.EnergyTariffs
            .AsNoTracking()
            .OrderByDescending(t => t.EffectiveFrom)
            .Select(t => new EnergyTariffDto
            {
                Id = t.Id,
                PricePerKwh = t.PricePerKwh,
                Currency = t.Currency,
                EffectiveFrom = t.EffectiveFrom,
                Note = t.Note,
                CreatedAt = t.CreatedAt,
                CreatedByUserId = t.CreatedByUserId,
                CreatedByName = _context.Users
                    .Where(u => u.Id == t.CreatedByUserId)
                    .Select(u => u.LastName + " " + u.FirstName)
                    .FirstOrDefault(),
            })
            .ToListAsync();

        return ApiResult<IEnumerable<EnergyTariffDto>>.Success(tariffs);
    }

    public async Task<ApiResult<Guid>> CreateAsync(EnergyTariffSaveDto dto, Guid userId)
    {
        var validation = Validate(dto);
        if (validation is not null)
            return ApiResult<Guid>.Failure([validation], 400);

        var effectiveFrom = Normalize(dto.EffectiveFrom);

        if (await _context.EnergyTariffs.AnyAsync(t => t.EffectiveFrom == effectiveFrom))
            return ApiResult<Guid>.Failure(["Bu sanada tarif allaqachon mavjud."], 400);

        var tariff = new EnergyTariff
        {
            Id = Guid.NewGuid(),
            PricePerKwh = dto.PricePerKwh,
            Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "so'm" : dto.Currency.Trim(),
            EffectiveFrom = effectiveFrom,
            Note = dto.Note?.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = userId,
        };

        _context.EnergyTariffs.Add(tariff);
        await _context.SaveChangesAsync();

        return ApiResult<Guid>.Success(tariff.Id, 201);
    }

    public async Task<ApiResult<bool>> UpdateAsync(Guid id, EnergyTariffSaveDto dto)
    {
        var validation = Validate(dto);
        if (validation is not null)
            return ApiResult<bool>.Failure([validation], 400);

        var tariff = await _context.EnergyTariffs.FirstOrDefaultAsync(t => t.Id == id);
        if (tariff is null)
            return ApiResult<bool>.Failure(["Tarif topilmadi."], 404);

        var effectiveFrom = Normalize(dto.EffectiveFrom);

        if (await _context.EnergyTariffs.AnyAsync(t => t.Id != id && t.EffectiveFrom == effectiveFrom))
            return ApiResult<bool>.Failure(["Bu sanada boshqa tarif mavjud."], 400);

        tariff.PricePerKwh = dto.PricePerKwh;
        tariff.Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "so'm" : dto.Currency.Trim();
        tariff.EffectiveFrom = effectiveFrom;
        tariff.Note = dto.Note?.Trim();

        await _context.SaveChangesAsync();
        return ApiResult<bool>.Success(true);
    }

    public async Task<ApiResult<bool>> DeleteAsync(Guid id)
    {
        var tariff = await _context.EnergyTariffs.FirstOrDefaultAsync(t => t.Id == id);
        if (tariff is null)
            return ApiResult<bool>.Failure(["Tarif topilmadi."], 404);

        // Kamida bitta tarif qolishi shart — aks holda xarajat hisoblab bo'lmaydi.
        if (await _context.EnergyTariffs.CountAsync() <= 1)
            return ApiResult<bool>.Failure(["Oxirgi tarifni o'chirib bo'lmaydi."], 400);

        _context.EnergyTariffs.Remove(tariff);
        await _context.SaveChangesAsync();

        return ApiResult<bool>.Success(true);
    }

    private static string? Validate(EnergyTariffSaveDto dto)
    {
        if (dto.PricePerKwh <= 0)
            return "Narx noldan katta bo'lishi kerak.";

        if (dto.EffectiveFrom == default)
            return "Amal qilish sanasi ko'rsatilmagan.";

        return null;
    }

    /// <summary>Sanani UTC kun boshiga keltiradi — tarif kun aniqligida amal qiladi.</summary>
    private static DateTime Normalize(DateTime value) =>
        DateTime.SpecifyKind(value.Date, DateTimeKind.Utc);
}
```

> `User` entity'sida yagona `FullName` maydoni yo'q — `FirstName` va `LastName` alohida, shuning uchun ular yuqoridagidek birlashtiriladi.

- [ ] **Step 6: Register the service in DI**

`Back/src/Application/ApplicationDependencyInjection.cs` — `IEnergyRollupService` qatoridan keyin:

```csharp
        services.AddScoped<IEnergyTariffService, EnergyTariffService>();
```

- [ ] **Step 7: Run tests to verify they pass**

Run:
```bash
dotnet test test/Application.Tests/Application.Tests.csproj --filter "FullyQualifiedName~EnergyTariffServiceTests"
```
Expected: 8 test PASS.

- [ ] **Step 8: Write the controller**

Create `Back/src/API/Controllers/EnergyTariffController.cs`:

```csharp
using API.Authorization;
using Application.DTOs.Energy;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

/// <summary>
/// Elektr tariflari. O'qish — autentifikatsiyadan o'tgan hammaga (panelda narx
/// ko'rinishi kerak); o'zgartirish — faqat "Energy.Update" ruxsati bilan.
/// </summary>
[ApiController]
[Route("api/energy-tariffs")]
[Authorize]
public class EnergyTariffController : ControllerBase
{
    private readonly IEnergyTariffService _service;

    public EnergyTariffController(IEnergyTariffService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _service.GetAllAsync();
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("Energy.Update")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] EnergyTariffSaveDto dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _service.CreateAsync(dto, userId);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("Energy.Update")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] EnergyTariffSaveDto dto)
    {
        var result = await _service.UpdateAsync(id, dto);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("Energy.Update")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _service.DeleteAsync(id);
        return StatusCode(result.StatusCode, result);
    }
}
```

- [ ] **Step 9: Verify the build and the whole suite**

Run (`Back/` papkasidan):
```bash
dotnet build Back.sln
dotnet test test/Application.Tests/Application.Tests.csproj
```
Expected: build muvaffaqiyatli, barcha testlar PASS.

- [ ] **Step 10: Commit**

```bash
git add Back/src/Application/DTOs/Energy/EnergyTariffDto.cs \
        Back/src/Application/Services/IEnergyTariffService.cs \
        Back/src/Application/Services/Impl/EnergyTariffService.cs \
        Back/src/API/Controllers/EnergyTariffController.cs \
        Back/src/Application/ApplicationDependencyInjection.cs \
        Back/test/Application.Tests/Services/EnergyTariffServiceTests.cs
git commit -m "feat(energy): tarif CRUD servisi va controlleri"
```

---

## Task 9: Energiya paneli DTO'lari

**Files:**
- Create: `Back/src/Application/DTOs/Energy/EnergySummaryDto.cs`
- Create: `Back/src/Application/DTOs/Energy/DeviceEnergyDetailDto.cs`
- Create: `Back/src/Application/DTOs/Energy/MeterDeviceStatusDto.cs`

**Interfaces:**
- Consumes: —
- Produces (barchasi `Application.DTOs.Energy` namespace'ida):
  - `EnergyBucketPointDto { string Bucket; double Kwh; decimal? Cost; }`
  - `DeviceSeriesDto { string DeviceName; List<EnergyBucketPointDto> Points; }`
  - `DeviceEnergyDto { string DeviceName; double Kwh; decimal? Cost; double SharePercent; double AvgPowerW; double PeakPowerW; double? LastPowerW; DateTime? LastSeen; bool IsOnline; List<double> Sparkline; }`
  - `EnergyTotalsDto { double Kwh; decimal? Cost; double AvgPowerW; double PeakPowerW; DateTime? PeakAt; double CurrentPowerW; int DeviceCount; int OnlineCount; }`
  - `EnergySummaryDto { DateTime From; DateTime To; string PeriodKey; string Bucket; decimal? PricePerKwh; string Currency; EnergyTotalsDto Total; List<DeviceEnergyDto> Devices; List<EnergyBucketPointDto> Series; List<DeviceSeriesDto> ByDevice; }`
  - `DeviceDetailPointDto { string Bucket; double Kwh; decimal? Cost; double AvgPowerW; double PeakPowerW; }`
  - `DeviceEnergyDetailDto { string DeviceName; bool IsOnline; DateTime? LastSeen; DateTime From; DateTime To; string PeriodKey; string Bucket; decimal? PricePerKwh; string Currency; double Kwh; decimal? Cost; double AvgPowerW; double PeakPowerW; DateTime? PeakAt; double UptimePercent; double AvgVoltage; double MinVoltage; double MaxVoltage; double AvgFrequency; List<DeviceDetailPointDto> Series; }`
  - `MeterDeviceStatusDto { string Name; bool IsOnline; DateTime? LastSeen; double? LastPowerW; bool IsConfigured; }`

- [ ] **Step 1: Write the summary DTOs**

Create `Back/src/Application/DTOs/Energy/EnergySummaryDto.cs`:

```csharp
namespace Application.DTOs.Energy;

/// <summary>Grafikning bitta ustuni: vaqt kaliti, energiya va uning puldagi qiymati.</summary>
public class EnergyBucketPointDto
{
    /// <summary>Mahalliy vaqt kaliti: soatlik "2026-08-11T14:00:00", kunlik "2026-08-11".</summary>
    public string Bucket { get; set; } = string.Empty;

    public double Kwh { get; set; }

    /// <summary>Tarif topilmasa null.</summary>
    public decimal? Cost { get; set; }
}

/// <summary>Bitta qurilmaning vaqt bo'yicha qatori — stacked grafik uchun.</summary>
public class DeviceSeriesDto
{
    public string DeviceName { get; set; } = string.Empty;
    public List<EnergyBucketPointDto> Points { get; set; } = [];
}

/// <summary>Umumiy ko'rinishdagi bitta qurilma kartasi.</summary>
public class DeviceEnergyDto
{
    public string DeviceName { get; set; } = string.Empty;
    public double Kwh { get; set; }
    public decimal? Cost { get; set; }

    /// <summary>Umumiy sarfdagi ulushi, foizda (0–100).</summary>
    public double SharePercent { get; set; }

    public double AvgPowerW { get; set; }
    public double PeakPowerW { get; set; }

    /// <summary>Oxirgi o'lchovdagi quvvat — qurilma yaqinda yozmagan bo'lsa null.</summary>
    public double? LastPowerW { get; set; }

    public DateTime? LastSeen { get; set; }
    public bool IsOnline { get; set; }

    /// <summary>Karta ichidagi mini-grafik uchun bucket kWh qiymatlari.</summary>
    public List<double> Sparkline { get; set; } = [];
}

/// <summary>Barcha qurilmalar bo'yicha yig'ma ko'rsatkichlar.</summary>
public class EnergyTotalsDto
{
    public double Kwh { get; set; }
    public decimal? Cost { get; set; }
    public double AvgPowerW { get; set; }
    public double PeakPowerW { get; set; }
    public DateTime? PeakAt { get; set; }

    /// <summary>Hozirgi umumiy quvvat — onlayn qurilmalarning oxirgi qiymatlari yig'indisi.</summary>
    public double CurrentPowerW { get; set; }

    public int DeviceCount { get; set; }
    public int OnlineCount { get; set; }
}

/// <summary>Energiya panelining umumiy ko'rinishi.</summary>
public class EnergySummaryDto
{
    public DateTime From { get; set; }
    public DateTime To { get; set; }

    /// <summary>Normallashtirilgan davr kaliti: today | 24h | 7d | 30d | month.</summary>
    public string PeriodKey { get; set; } = string.Empty;

    /// <summary>"hour" yoki "day".</summary>
    public string Bucket { get; set; } = string.Empty;

    /// <summary>Davr oxiriga amal qilgan narx — UI'da chip sifatida ko'rsatiladi.</summary>
    public decimal? PricePerKwh { get; set; }

    public string Currency { get; set; } = "so'm";

    public EnergyTotalsDto Total { get; set; } = new();
    public List<DeviceEnergyDto> Devices { get; set; } = [];
    public List<EnergyBucketPointDto> Series { get; set; } = [];
    public List<DeviceSeriesDto> ByDevice { get; set; } = [];
}
```

- [ ] **Step 2: Write the device detail DTO**

Create `Back/src/Application/DTOs/Energy/DeviceEnergyDetailDto.cs`:

```csharp
namespace Application.DTOs.Energy;

/// <summary>Qurilma detalidagi bitta ustun — energiya + quvvat ko'rsatkichlari bilan.</summary>
public class DeviceDetailPointDto
{
    public string Bucket { get; set; } = string.Empty;
    public double Kwh { get; set; }
    public decimal? Cost { get; set; }
    public double AvgPowerW { get; set; }
    public double PeakPowerW { get; set; }
}

/// <summary>Bitta qurilmaning davr bo'yicha batafsil ko'rsatkichlari.</summary>
public class DeviceEnergyDetailDto
{
    public string DeviceName { get; set; } = string.Empty;
    public bool IsOnline { get; set; }
    public DateTime? LastSeen { get; set; }

    public DateTime From { get; set; }
    public DateTime To { get; set; }
    public string PeriodKey { get; set; } = string.Empty;
    public string Bucket { get; set; } = string.Empty;

    public decimal? PricePerKwh { get; set; }
    public string Currency { get; set; } = "so'm";

    public double Kwh { get; set; }
    public decimal? Cost { get; set; }
    public double AvgPowerW { get; set; }
    public double PeakPowerW { get; set; }
    public DateTime? PeakAt { get; set; }

    /// <summary>
    /// Ish vaqti: haqiqiy o'lchovlar sonining kutilgan songa nisbati (0–100).
    /// Qurilma uzilib turgan vaqtni ko'rsatadi.
    /// </summary>
    public double UptimePercent { get; set; }

    public double AvgVoltage { get; set; }
    public double MinVoltage { get; set; }
    public double MaxVoltage { get; set; }
    public double AvgFrequency { get; set; }

    public List<DeviceDetailPointDto> Series { get; set; } = [];
}
```

- [ ] **Step 3: Write the device status DTO**

Create `Back/src/Application/DTOs/Energy/MeterDeviceStatusDto.cs`:

```csharp
namespace Application.DTOs.Energy;

/// <summary>
/// Qurilma va uning jonli holati. Ro'yxat konfiguratsiyadagi qurilmalar bilan
/// bazada uchragan nomlarning birlashmasi — hech qachon ma'lumot yubormagan
/// qurilma ham "offline" bo'lib ko'rinadi.
/// </summary>
public class MeterDeviceStatusDto
{
    public string Name { get; set; } = string.Empty;
    public bool IsOnline { get; set; }
    public DateTime? LastSeen { get; set; }
    public double? LastPowerW { get; set; }

    /// <summary>Konfiguratsiyada (MeterPoller:Devices) e'lon qilinganmi.</summary>
    public bool IsConfigured { get; set; }
}
```

- [ ] **Step 4: Verify the build**

Run (`Back/` papkasidan):
```bash
dotnet build Back.sln
```
Expected: build muvaffaqiyatli.

- [ ] **Step 5: Commit**

```bash
git add Back/src/Application/DTOs/Energy/
git commit -m "feat(energy): panel DTO'lari"
```

---

## Task 10: Ko'p qurilmali poller konfiguratsiyasi

**Files:**
- Create: `Back/src/Application/Options/MeterDeviceOptions.cs`
- Modify: `Back/src/Application/Options/MeterPollerOptions.cs`
- Modify: `Back/src/API/Services/MeterPollerService.cs` (to'liq qayta yoziladi)
- Modify: `Back/src/API/appsettings.json`
- Test: `Back/test/Application.Tests/Options/MeterPollerOptionsTests.cs`

**Interfaces:**
- Consumes: —
- Produces:
  - `Application.Options.MeterDeviceOptions` — `Name`, `Ip`, `Port`, `SlaveId`, `StartAddress`, `RegisterCount`, `PtRatio`, `IntervalSeconds` (`int?`), `Enabled`
  - `List<MeterDeviceOptions> MeterPollerOptions.Devices`
  - `IReadOnlyList<MeterDeviceOptions> MeterPollerOptions.ResolveDevices()` — yoqilgan qurilmalar; `Devices` bo'sh bo'lsa eski yakka maydonlardan bittasini yasaydi
  - `int MeterPollerOptions.EffectiveInterval(MeterDeviceOptions device)` — qurilma override'i yoki global qiymat, minimum 1

- [ ] **Step 1: Write the failing test**

Create `Back/test/Application.Tests/Options/MeterPollerOptionsTests.cs`:

```csharp
using Application.Options;
using FluentAssertions;
using Xunit;

namespace Application.Tests.Options;

public class MeterPollerOptionsTests
{
    [Fact]
    public void ResolveDevices_WithDevicesArray_ReturnsOnlyEnabledOnes()
    {
        // Arrange
        var options = new MeterPollerOptions
        {
            Enabled = true,
            Devices =
            [
                new MeterDeviceOptions { Name = "DR134", Ip = "10.0.0.1", Enabled = true },
                new MeterDeviceOptions { Name = "DR201", Ip = "10.0.0.2", Enabled = false },
                new MeterDeviceOptions { Name = "DR202", Ip = "10.0.0.3", Enabled = true },
            ],
        };

        // Act
        var devices = options.ResolveDevices();

        // Assert
        devices.Select(d => d.Name).Should().Equal("DR134", "DR202");
    }

    [Fact]
    public void ResolveDevices_WithLegacySingleDeviceConfig_ReturnsOneDevice()
    {
        // Arrange — eski appsettings formati: Devices yo'q, yakka maydonlar to'ldirilgan
        var options = new MeterPollerOptions
        {
            Enabled = true,
            Ip = "192.168.30.222",
            Port = 502,
            SlaveId = 3,
            StartAddress = 100,
            RegisterCount = 55,
            PtRatio = 2.0,
            DeviceName = "DR134",
        };

        // Act
        var devices = options.ResolveDevices();

        // Assert
        devices.Should().HaveCount(1);
        devices[0].Name.Should().Be("DR134");
        devices[0].Ip.Should().Be("192.168.30.222");
        devices[0].SlaveId.Should().Be(3);
        devices[0].PtRatio.Should().Be(2.0);
    }

    [Fact]
    public void ResolveDevices_WithNoIpAndNoDevices_ReturnsEmpty()
    {
        // Arrange
        var options = new MeterPollerOptions { Enabled = true };

        // Act & Assert
        options.ResolveDevices().Should().BeEmpty();
    }

    [Fact]
    public void ResolveDevices_WithDeviceMissingIp_SkipsIt()
    {
        // Arrange
        var options = new MeterPollerOptions
        {
            Devices =
            [
                new MeterDeviceOptions { Name = "Yaxshi", Ip = "10.0.0.1" },
                new MeterDeviceOptions { Name = "IPsiz", Ip = "" },
            ],
        };

        // Act & Assert
        options.ResolveDevices().Select(d => d.Name).Should().Equal("Yaxshi");
    }

    [Fact]
    public void ResolveDevices_WithDeviceMissingName_UsesIpAsName()
    {
        // Arrange
        var options = new MeterPollerOptions
        {
            Devices = [new MeterDeviceOptions { Name = "", Ip = "10.0.0.7" }],
        };

        // Act & Assert
        options.ResolveDevices()[0].Name.Should().Be("10.0.0.7");
    }

    [Fact]
    public void EffectiveInterval_WithDeviceOverride_PrefersDeviceValue()
    {
        // Arrange
        var options = new MeterPollerOptions { IntervalSeconds = 3 };
        var device = new MeterDeviceOptions { Name = "DR134", Ip = "10.0.0.1", IntervalSeconds = 10 };

        // Act & Assert
        options.EffectiveInterval(device).Should().Be(10);
    }

    [Fact]
    public void EffectiveInterval_WithoutOverride_UsesGlobalValue()
    {
        // Arrange
        var options = new MeterPollerOptions { IntervalSeconds = 3 };
        var device = new MeterDeviceOptions { Name = "DR134", Ip = "10.0.0.1" };

        // Act & Assert
        options.EffectiveInterval(device).Should().Be(3);
    }

    [Fact]
    public void EffectiveInterval_WithZeroOrNegative_ClampsToOneSecond()
    {
        // Arrange
        var options = new MeterPollerOptions { IntervalSeconds = 0 };
        var device = new MeterDeviceOptions { Name = "DR134", Ip = "10.0.0.1" };

        // Act & Assert
        options.EffectiveInterval(device).Should().Be(1);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
dotnet test test/Application.Tests/Application.Tests.csproj --filter "FullyQualifiedName~MeterPollerOptionsTests"
```
Expected: kompilyatsiya xatosi — `MeterDeviceOptions` topilmaydi.

- [ ] **Step 3: Write `MeterDeviceOptions`**

Create `Back/src/Application/Options/MeterDeviceOptions.cs`:

```csharp
namespace Application.Options;

/// <summary>
/// Bitta hisoblagich qurilmasining Modbus TCP sozlamalari.
/// Har qurilma o'z IP/SlaveId'iga ega bo'lishi mumkin — 20+ qurilmali ombor uchun.
/// </summary>
public class MeterDeviceOptions
{
    /// <summary>Bazada saqlanadigan qurilma nomi. Bo'sh bo'lsa IP ishlatiladi.</summary>
    public string Name { get; set; } = "";

    public string Ip { get; set; } = "";
    public int Port { get; set; } = 502;
    public int SlaveId { get; set; } = 1;
    public int StartAddress { get; set; } = 100;
    public int RegisterCount { get; set; } = 55;

    /// <summary>Kuchlanish transformatori koeffitsienti.</summary>
    public double PtRatio { get; set; } = 1.0;

    /// <summary>Shu qurilma uchun alohida o'qish davri; null bo'lsa global qiymat.</summary>
    public int? IntervalSeconds { get; set; }

    public bool Enabled { get; set; } = true;
}
```

- [ ] **Step 4: Extend `MeterPollerOptions`**

`Back/src/Application/Options/MeterPollerOptions.cs` — faylni to'liq quyidagi bilan almashtiring:

```csharp
namespace Application.Options;

/// <summary>
/// Hisoblagichlarni Modbus TCP orqali faol so'rab turish sozlamalari.
/// Backend o'zi qurilmaning 502-portiga ulanib, holding registrlarni o'qiydi —
/// qurilma tomonida hech qanday "push" sozlamasi kerak emas.
///
/// Ko'p qurilma <see cref="Devices"/> massivi orqali beriladi. Eski yakka-qurilma
/// konfiguratsiyasi (Ip/SlaveId/DeviceName) ham ishlashda davom etadi.
/// </summary>
public class MeterPollerOptions
{
    public const string SectionName = "MeterPoller";

    public bool Enabled { get; set; } = false;

    /// <summary>Necha soniyada bir o'qish (qurilma o'z qiymati bilan almashtira oladi).</summary>
    public int IntervalSeconds { get; set; } = 3;

    /// <summary>So'raladigan qurilmalar ro'yxati.</summary>
    public List<MeterDeviceOptions> Devices { get; set; } = [];

    // ── Eski (yakka qurilma) maydonlari — orqaga moslik uchun saqlanadi ──────

    /// <summary>Eski format: qurilma IP manzili.</summary>
    public string Ip { get; set; } = "";

    public int Port { get; set; } = 502;
    public int SlaveId { get; set; } = 1;
    public int StartAddress { get; set; } = 100;
    public int RegisterCount { get; set; } = 55;
    public double PtRatio { get; set; } = 1.0;

    /// <summary>Eski format: bazada saqlanadigan qurilma nomi.</summary>
    public string DeviceName { get; set; } = "DR134";

    /// <summary>
    /// So'ralishi kerak bo'lgan qurilmalar. <see cref="Devices"/> bo'sh bo'lsa —
    /// eski yakka maydonlardan bitta qurilma yasaladi.
    /// IPsiz yoki o'chirilgan yozuvlar tashlab ketiladi.
    /// </summary>
    public IReadOnlyList<MeterDeviceOptions> ResolveDevices()
    {
        var source = Devices.Count > 0
            ? Devices
            : string.IsNullOrWhiteSpace(Ip)
                ? []
                : new List<MeterDeviceOptions>
                {
                    new()
                    {
                        Name = DeviceName,
                        Ip = Ip,
                        Port = Port,
                        SlaveId = SlaveId,
                        StartAddress = StartAddress,
                        RegisterCount = RegisterCount,
                        PtRatio = PtRatio,
                        Enabled = true,
                    },
                };

        return source
            .Where(d => d.Enabled && !string.IsNullOrWhiteSpace(d.Ip))
            .Select(d => new MeterDeviceOptions
            {
                Name = string.IsNullOrWhiteSpace(d.Name) ? d.Ip.Trim() : d.Name.Trim(),
                Ip = d.Ip.Trim(),
                Port = d.Port,
                SlaveId = d.SlaveId,
                StartAddress = d.StartAddress,
                RegisterCount = d.RegisterCount,
                PtRatio = d.PtRatio,
                IntervalSeconds = d.IntervalSeconds,
                Enabled = true,
            })
            .ToList();
    }

    /// <summary>Qurilma uchun amaldagi o'qish davri (soniya), minimum 1.</summary>
    public int EffectiveInterval(MeterDeviceOptions device) =>
        Math.Max(1, device.IntervalSeconds ?? IntervalSeconds);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
dotnet test test/Application.Tests/Application.Tests.csproj --filter "FullyQualifiedName~MeterPollerOptionsTests"
```
Expected: 8 test PASS.

- [ ] **Step 6: Rewrite `MeterPollerService` for parallel devices**

`Back/src/API/Services/MeterPollerService.cs` — faylni to'liq quyidagi bilan almashtiring:

```csharp
using System.Net.Sockets;
using Application.DTOs.MeterData;
using Application.Options;
using Application.Services;
using Microsoft.Extensions.Options;
using NModbus;

namespace API.Services;

/// <summary>
/// Konfiguratsiyadagi har bir hisoblagichni Modbus TCP orqali faol so'rab turadi.
/// Har qurilma alohida, parallel siklda o'qiladi — biri uzilsa boshqalari
/// ta'sirlanmaydi. Har IntervalSeconds da holding registrlar o'qiladi (FC 3):
///   - Kuchlanish A: reg[StartAddress+0]  * 0.1 * PtRatio
///   - Aktiv quvvat: reg[StartAddress+11]
///   - Chastota:     reg[StartAddress+50] * 0.01
///   - Tok A:        P / U (hisoblab topiladi)
/// </summary>
public class MeterPollerService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MeterPollerService> _logger;
    private readonly MeterPollerOptions _options;

    public MeterPollerService(
        IServiceScopeFactory scopeFactory,
        IOptions<MeterPollerOptions> options,
        ILogger<MeterPollerService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("Meter poller o'chirilgan (MeterPoller:Enabled=false).");
            return;
        }

        var devices = _options.ResolveDevices();

        if (devices.Count == 0)
        {
            _logger.LogInformation("Meter poller uchun qurilma sozlanmagan (MeterPoller:Devices bo'sh).");
            return;
        }

        _logger.LogInformation("Meter poller ishga tushdi: {Count} ta qurilma.", devices.Count);

        await Task.WhenAll(devices.Select(device => PollDeviceAsync(device, stoppingToken)));
    }

    /// <summary>Bitta qurilmaning mustaqil o'qish sikli — o'z TCP ulanishi bilan.</summary>
    private async Task PollDeviceAsync(MeterDeviceOptions device, CancellationToken stoppingToken)
    {
        var interval = _options.EffectiveInterval(device);

        _logger.LogInformation(
            "Meter [{Device}]: {Ip}:{Port} (SlaveId={SlaveId}, har {Interval}s da)",
            device.Name, device.Ip, device.Port, device.SlaveId, interval);

        var factory = new ModbusFactory();
        TcpClient? client = null;
        IModbusMaster? master = null;

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(interval));

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    if (client is not { Connected: true } || master is null)
                    {
                        master?.Dispose();
                        client?.Dispose();

                        client = new TcpClient();
                        using var connectCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                        connectCts.CancelAfter(TimeSpan.FromSeconds(5));
                        await client.ConnectAsync(device.Ip, device.Port, connectCts.Token);

                        master = factory.CreateMaster(client);
                        master.Transport.ReadTimeout = 5000;
                        master.Transport.WriteTimeout = 5000;

                        _logger.LogInformation("Meter [{Device}] ulandi: {Ip}:{Port}",
                            device.Name, device.Ip, device.Port);
                    }

                    var regs = await master.ReadHoldingRegistersAsync(
                        (byte)device.SlaveId, (ushort)device.StartAddress, (ushort)device.RegisterCount);

                    // Registr manzillari StartAddress ga nisbatan: 100 -> [0], 111 -> [11], 150 -> [50]
                    var voltageA = regs[0] * 0.1 * device.PtRatio;
                    var powerA = regs[11] * 1.0;
                    var frequency = regs[50] * 0.01;
                    var currentA = voltageA > 0 ? powerA / voltageA : 0.0;

                    _logger.LogInformation(
                        "Meter o'qildi [{Device}]: U={Voltage:F1} V | I={Current:F2} A | P={Power:F1} W | f={Frequency:F2} Hz",
                        device.Name, voltageA, currentA, powerA, frequency);

                    var dto = new MeterDataCreateDto
                    {
                        VoltagePhaseA = Math.Round(voltageA, 1),
                        CurrentPhaseA = Math.Round(currentA, 2),
                        ActivePower = powerA,
                        Frequency = Math.Round(frequency, 2),
                    };

                    using var scope = _scopeFactory.CreateScope();
                    var service = scope.ServiceProvider.GetRequiredService<IMeterDataService>();
                    var result = await service.CreateAsync(dto, device.Name);

                    if (!result.Succeeded)
                        _logger.LogWarning("Meter-data saqlanmadi [{Device}]: {Errors}",
                            device.Name, string.Join("; ", result.Errors));
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("Meter o'qishda xato [{Device}] ({Ip}:{Port}): {Message}",
                        device.Name, device.Ip, device.Port, ex.Message);

                    // Keyingi urinishda toza ulanish ochamiz
                    master?.Dispose();
                    master = null;
                    client?.Dispose();
                    client = null;
                }
            }
        }
        catch (OperationCanceledException)
        {
            // normal to'xtash
        }
        finally
        {
            master?.Dispose();
            client?.Dispose();
        }
    }
}
```

- [ ] **Step 7: Move the existing device into the new config shape**

`Back/src/API/appsettings.json` — `MeterPoller` bo'limini almashtiring:

```json
  "MeterPoller": {
    "Enabled": true,
    "IntervalSeconds": 3,
    "Devices": [
      {
        "Name": "DR134",
        "Ip": "192.168.30.222",
        "Port": 502,
        "SlaveId": 1,
        "StartAddress": 100,
        "RegisterCount": 55,
        "PtRatio": 1.0,
        "Enabled": true
      }
    ]
  }
```

- [ ] **Step 8: Verify the build and the whole suite**

Run (`Back/` papkasidan):
```bash
dotnet build Back.sln
dotnet test test/Application.Tests/Application.Tests.csproj
```
Expected: build muvaffaqiyatli, barcha testlar PASS.

- [ ] **Step 9: Commit**

```bash
git add Back/src/Application/Options/MeterDeviceOptions.cs \
        Back/src/Application/Options/MeterPollerOptions.cs \
        Back/src/API/Services/MeterPollerService.cs \
        Back/src/API/appsettings.json \
        Back/test/Application.Tests/Options/MeterPollerOptionsTests.cs
git commit -m "feat(energy): ko'p qurilmali Modbus poller"
```

---

## Task 11: Summary servisi (`EnergySummaryService`)

**Files:**
- Create: `Back/src/Application/Services/IEnergySummaryService.cs`
- Create: `Back/src/Application/Services/Impl/EnergySummaryService.cs`
- Modify: `Back/src/Application/ApplicationDependencyInjection.cs`
- Test: `Back/test/Application.Tests/Services/EnergySummaryServiceTests.cs`

**Interfaces:**
- Consumes: `EnergyMath`, `PowerSample` (Task 1); `EnergyPeriod` (Task 2); `TariffResolver` (Task 5); Task 9 DTO'lari; `MeterPollerOptions.ResolveDevices()` (Task 10)
- Produces:
  - `Task<ApiResult<EnergySummaryDto>> IEnergySummaryService.GetSummaryAsync(string? period)`
  - `Task<ApiResult<DeviceEnergyDetailDto>> IEnergySummaryService.GetDeviceDetailAsync(string deviceName, string? period)`
  - `Task<ApiResult<IEnumerable<MeterDeviceStatusDto>>> IEnergySummaryService.GetDeviceStatusesAsync()`
  - Test uchun konstruktor: `EnergySummaryService(DatabaseContext, IOptions<MeterPollerOptions>, Func<DateTime> nowUtc)`

- [ ] **Step 1: Write the failing test**

Create `Back/test/Application.Tests/Services/EnergySummaryServiceTests.cs`:

```csharp
using Application.Options;
using Application.Services.Impl;
using Application.Tests.Infrastructure;
using Core.Entities;
using DataAccess.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Task = System.Threading.Tasks.Task;

namespace Application.Tests.Services;

public class EnergySummaryServiceTests
{
    // 2026-08-11 09:30 UTC = 14:30 Toshkent
    private static readonly DateTime Now = new(2026, 8, 11, 9, 30, 0, DateTimeKind.Utc);

    private static EnergySummaryService CreateSut(DatabaseContext db, MeterPollerOptions? options = null) =>
        new(db, OptionsHelper.Wrap(options ?? new MeterPollerOptions
        {
            Enabled = true,
            IntervalSeconds = 3,
            Devices = [new MeterDeviceOptions { Name = "DR134", Ip = "10.0.0.1" }],
        }), () => Now);

    private static void SeedTariff(DatabaseContext db, decimal price = 1100m)
    {
        db.EnergyTariffs.Add(new EnergyTariff
        {
            Id = Guid.NewGuid(),
            PricePerKwh = price,
            Currency = "so'm",
            EffectiveFrom = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc),
        });
        db.SaveChanges();
    }

    private static void SeedHour(DatabaseContext db, string device, DateTime hourUtc, double kwh,
        double avgPower = 1000, double peakPower = 1500, int samples = 1200)
    {
        db.MeterEnergyHourly.Add(new MeterEnergyHourly
        {
            Id = Guid.NewGuid(),
            DeviceName = device,
            HourUtc = hourUtc,
            Kwh = kwh,
            AvgPowerW = avgPower,
            PeakPowerW = peakPower,
            MinPowerW = 0,
            AvgVoltage = 230,
            SampleCount = samples,
            UpdatedAt = Now,
        });
        db.SaveChanges();
    }

    private static void SeedReading(DatabaseContext db, string device, DateTime at,
        double powerW, double voltage = 230, double frequency = 50)
    {
        db.MeterReadings.Add(new MeterReading
        {
            Id = Guid.NewGuid(),
            DeviceName = device,
            VoltagePhaseA = voltage,
            CurrentPhaseA = voltage > 0 ? powerW / voltage : 0,
            ActivePower = powerW,
            Frequency = frequency,
            CreatedAt = at,
        });
        db.SaveChanges();
    }

    [Fact]
    public async Task GetSummaryAsync_SumsRollupHoursAcrossDevices()
    {
        // Arrange — 24h davri ichidagi ikki soat, ikki qurilma
        await using var db = TestDbContextFactory.Create();
        SeedTariff(db);
        SeedHour(db, "DR134", Now.AddHours(-3), 2.0);
        SeedHour(db, "DR201", Now.AddHours(-3), 3.0);
        SeedHour(db, "DR134", Now.AddHours(-2), 1.0);
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetSummaryAsync("24h");

        // Assert
        result.Succeeded.Should().BeTrue();
        var dto = result.Result!;
        dto.Total.Kwh.Should().BeApproximately(6.0, 0.001);
        dto.Devices.Should().HaveCount(2);
        dto.Devices.Single(d => d.DeviceName == "DR134").Kwh.Should().BeApproximately(3.0, 0.001);
        dto.Devices.Single(d => d.DeviceName == "DR201").Kwh.Should().BeApproximately(3.0, 0.001);
    }

    [Fact]
    public async Task GetSummaryAsync_MultipliesEnergyByTariffPrice()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedTariff(db, 1100m);
        SeedHour(db, "DR134", Now.AddHours(-2), 10.0);
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetSummaryAsync("24h");

        // Assert — 10 kWh × 1100 = 11 000 so'm
        result.Result!.Total.Cost.Should().Be(11_000m);
        result.Result.PricePerKwh.Should().Be(1100m);
        result.Result.Currency.Should().Be("so'm");
    }

    [Fact]
    public async Task GetSummaryAsync_WithNoTariffs_ReturnsNullCost()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedHour(db, "DR134", Now.AddHours(-2), 10.0);
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetSummaryAsync("24h");

        // Assert
        result.Result!.Total.Cost.Should().BeNull();
        result.Result.PricePerKwh.Should().BeNull();
        result.Result.Total.Kwh.Should().BeApproximately(10.0, 0.001);
    }

    [Fact]
    public async Task GetSummaryAsync_IncludesCurrentHourFromRawReadings()
    {
        // Arrange — joriy soat (09:00) hali rollupda yo'q, xom o'lchovlardan chiqishi kerak
        await using var db = TestDbContextFactory.Create();
        SeedTariff(db);
        var hourStart = new DateTime(2026, 8, 11, 9, 0, 0, DateTimeKind.Utc);
        SeedReading(db, "DR134", hourStart, 3600);
        SeedReading(db, "DR134", hourStart.AddSeconds(30), 3600);
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetSummaryAsync("24h");

        // Assert — 3600 W × 30 s = 108 000 W·s = 0.03 kWh
        result.Result!.Total.Kwh.Should().BeApproximately(0.03, 1e-6);
    }

    [Fact]
    public async Task GetSummaryAsync_ComputesDeviceSharePercent()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedTariff(db);
        SeedHour(db, "DR134", Now.AddHours(-2), 3.0);
        SeedHour(db, "DR201", Now.AddHours(-2), 1.0);
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetSummaryAsync("24h");

        // Assert
        result.Result!.Devices.Single(d => d.DeviceName == "DR134").SharePercent
            .Should().BeApproximately(75, 0.01);
        result.Result.Devices.Single(d => d.DeviceName == "DR201").SharePercent
            .Should().BeApproximately(25, 0.01);
    }

    [Fact]
    public async Task GetSummaryAsync_ListsConfiguredDeviceThatNeverReported()
    {
        // Arrange — konfigda bor, bazada yozuvi yo'q
        await using var db = TestDbContextFactory.Create();
        SeedTariff(db);
        var options = new MeterPollerOptions
        {
            Enabled = true,
            IntervalSeconds = 3,
            Devices =
            [
                new MeterDeviceOptions { Name = "DR134", Ip = "10.0.0.1" },
                new MeterDeviceOptions { Name = "DR999", Ip = "10.0.0.9" },
            ],
        };
        SeedHour(db, "DR134", Now.AddHours(-2), 2.0);
        var sut = CreateSut(db, options);

        // Act
        var result = await sut.GetSummaryAsync("24h");

        // Assert
        var offline = result.Result!.Devices.Single(d => d.DeviceName == "DR999");
        offline.Kwh.Should().Be(0);
        offline.IsOnline.Should().BeFalse();
        offline.LastSeen.Should().BeNull();
        result.Result.Total.DeviceCount.Should().Be(2);
        result.Result.Total.OnlineCount.Should().Be(0);
    }

    [Fact]
    public async Task GetSummaryAsync_MarksDeviceOnlineWhenRecentReadingExists()
    {
        // Arrange — 5 soniya oldin yozuv kelgan (chegara: max(3 × 3s, 30s) = 30s)
        await using var db = TestDbContextFactory.Create();
        SeedTariff(db);
        SeedReading(db, "DR134", Now.AddSeconds(-5), 4200);
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetSummaryAsync("24h");

        // Assert
        var device = result.Result!.Devices.Single(d => d.DeviceName == "DR134");
        device.IsOnline.Should().BeTrue();
        device.LastPowerW.Should().Be(4200);
        result.Result.Total.OnlineCount.Should().Be(1);
        result.Result.Total.CurrentPowerW.Should().Be(4200);
    }

    [Fact]
    public async Task GetSummaryAsync_MarksDeviceOfflineWhenLastReadingIsOld()
    {
        // Arrange — 2 soat oldingi yozuv
        await using var db = TestDbContextFactory.Create();
        SeedTariff(db);
        SeedReading(db, "DR134", Now.AddHours(-2), 4200);
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetSummaryAsync("24h");

        // Assert
        var device = result.Result!.Devices.Single(d => d.DeviceName == "DR134");
        device.IsOnline.Should().BeFalse();
        device.LastSeen.Should().Be(Now.AddHours(-2));
        result.Result.Total.CurrentPowerW.Should().Be(0);
    }

    [Fact]
    public async Task GetSummaryAsync_WithDayBucket_GroupsHoursIntoLocalDays()
    {
        // Arrange — 2026-08-10 20:00 UTC = 2026-08-11 01:00 Toshkent (ertangi kunga tushadi)
        await using var db = TestDbContextFactory.Create();
        SeedTariff(db);
        SeedHour(db, "DR134", new DateTime(2026, 8, 10, 20, 0, 0, DateTimeKind.Utc), 1.0);
        SeedHour(db, "DR134", new DateTime(2026, 8, 10, 18, 0, 0, DateTimeKind.Utc), 2.0);
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetSummaryAsync("7d");

        // Assert
        result.Result!.Bucket.Should().Be("day");
        result.Result.Series.Single(p => p.Bucket == "2026-08-11").Kwh.Should().BeApproximately(1.0, 0.001);
        result.Result.Series.Single(p => p.Bucket == "2026-08-10").Kwh.Should().BeApproximately(2.0, 0.001);
    }

    [Fact]
    public async Task GetSummaryAsync_FillsEmptyBucketsWithZero()
    {
        // Arrange — 7 kunlik davr, faqat bitta kunda ma'lumot
        await using var db = TestDbContextFactory.Create();
        SeedTariff(db);
        SeedHour(db, "DR134", Now.AddHours(-2), 5.0);
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetSummaryAsync("7d");

        // Assert — 7 ta kun bucketi, hammasi mavjud
        result.Result!.Series.Should().HaveCount(7);
        result.Result.Series.Count(p => p.Kwh == 0).Should().Be(6);
    }

    [Fact]
    public async Task GetSummaryAsync_ProducesSparklineAlignedWithSeries()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedTariff(db);
        SeedHour(db, "DR134", Now.AddHours(-2), 5.0);
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetSummaryAsync("7d");

        // Assert
        var device = result.Result!.Devices.Single();
        device.Sparkline.Should().HaveCount(result.Result.Series.Count);
        device.Sparkline.Sum().Should().BeApproximately(5.0, 0.001);
    }

    [Fact]
    public async Task GetSummaryAsync_ReportsPeakPowerAndItsHour()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedTariff(db);
        SeedHour(db, "DR134", Now.AddHours(-3), 1.0, peakPower: 1200);
        SeedHour(db, "DR134", Now.AddHours(-2), 1.0, peakPower: 4800);
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetSummaryAsync("24h");

        // Assert
        result.Result!.Total.PeakPowerW.Should().Be(4800);
        result.Result.Total.PeakAt.Should().Be(Now.AddHours(-2));
    }

    [Fact]
    public async Task GetDeviceDetailAsync_WithUnknownDevice_ReturnsNotFound()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetDeviceDetailAsync("YO'Q", "24h");

        // Assert
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetDeviceDetailAsync_ReturnsVoltageAndFrequencyStats()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedTariff(db);
        SeedReading(db, "DR134", Now.AddHours(-2), 1000, voltage: 220, frequency: 49.9);
        SeedReading(db, "DR134", Now.AddHours(-1), 1000, voltage: 240, frequency: 50.1);
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetDeviceDetailAsync("DR134", "24h");

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result!.MinVoltage.Should().Be(220);
        result.Result.MaxVoltage.Should().Be(240);
        result.Result.AvgVoltage.Should().BeApproximately(230, 0.001);
        result.Result.AvgFrequency.Should().BeApproximately(50.0, 0.001);
    }

    [Fact]
    public async Task GetDeviceDetailAsync_ComputesUptimeFromSampleCount()
    {
        // Arrange — 1 soatda kutilgani 1200 ta (3s), kelgani 600 ta => 50%
        await using var db = TestDbContextFactory.Create();
        SeedTariff(db);
        SeedHour(db, "DR134", Now.AddHours(-2), 1.0, samples: 600);
        var sut = CreateSut(db);

        // Act — "today" davri: 00:00 Toshkent (19:00 UTC) dan 09:30 UTC gacha
        var result = await sut.GetDeviceDetailAsync("DR134", "today");

        // Assert — davr uzun, shu sababli uptime past bo'ladi, lekin 0 dan katta va 100 dan kichik
        result.Result!.UptimePercent.Should().BeGreaterThan(0).And.BeLessThan(100);
    }

    [Fact]
    public async Task GetDeviceStatusesAsync_MergesConfiguredAndReportedDevices()
    {
        // Arrange — konfigda DR134, bazada esa DR134 va eski DR000
        await using var db = TestDbContextFactory.Create();
        SeedReading(db, "DR134", Now.AddSeconds(-5), 1000);
        SeedReading(db, "DR000", Now.AddDays(-40), 500);
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetDeviceStatusesAsync();

        // Assert
        var list = result.Result!.ToList();
        list.Select(d => d.Name).Should().BeEquivalentTo(["DR000", "DR134"]);
        list.Single(d => d.Name == "DR134").IsConfigured.Should().BeTrue();
        list.Single(d => d.Name == "DR134").IsOnline.Should().BeTrue();
        list.Single(d => d.Name == "DR000").IsConfigured.Should().BeFalse();
        list.Single(d => d.Name == "DR000").IsOnline.Should().BeFalse();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
dotnet test test/Application.Tests/Application.Tests.csproj --filter "FullyQualifiedName~EnergySummaryServiceTests"
```
Expected: kompilyatsiya xatosi — `EnergySummaryService` topilmaydi.

- [ ] **Step 3: Write the interface**

Create `Back/src/Application/Services/IEnergySummaryService.cs`:

```csharp
using Application.DTOs;
using Application.DTOs.Energy;

namespace Application.Services;

/// <summary>
/// Energiya paneli uchun agregat ma'lumot. Tugallangan soatlar
/// <c>MeterEnergyHourly</c> dan, joriy tugallanmagan soat xom
/// <c>MeterReadings</c> dan olinadi — panel so'nggi soniyagacha aniq bo'ladi.
/// </summary>
public interface IEnergySummaryService
{
    Task<ApiResult<EnergySummaryDto>> GetSummaryAsync(string? period);

    Task<ApiResult<DeviceEnergyDetailDto>> GetDeviceDetailAsync(string deviceName, string? period);

    Task<ApiResult<IEnumerable<MeterDeviceStatusDto>>> GetDeviceStatusesAsync();
}
```

- [ ] **Step 4: Write the implementation**

Create `Back/src/Application/Services/Impl/EnergySummaryService.cs`:

```csharp
using Application.DTOs;
using Application.DTOs.Energy;
using Application.Helpers;
using Application.Options;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Application.Services.Impl;

public class EnergySummaryService : IEnergySummaryService
{
    /// <summary>Qurilma "onlayn" hisoblanishi uchun oxirgi yozuv shu muddat ichida bo'lishi kerak.</summary>
    private static readonly TimeSpan MinOnlineWindow = TimeSpan.FromSeconds(30);

    /// <summary>Oxirgi quvvat qiymatini olish uchun xom yozuvlar oynasi.</summary>
    private static readonly TimeSpan LastPowerWindow = TimeSpan.FromMinutes(10);

    private readonly DatabaseContext _context;
    private readonly MeterPollerOptions _pollerOptions;
    private readonly Func<DateTime> _nowUtc;

    public EnergySummaryService(DatabaseContext context, IOptions<MeterPollerOptions> pollerOptions)
        : this(context, pollerOptions, () => DateTime.UtcNow)
    {
    }

    /// <summary>Test uchun — "hozir"ni tashqaridan berish imkoni bilan.</summary>
    public EnergySummaryService(
        DatabaseContext context,
        IOptions<MeterPollerOptions> pollerOptions,
        Func<DateTime> nowUtc)
    {
        _context = context;
        _pollerOptions = pollerOptions.Value;
        _nowUtc = nowUtc;
    }

    // ─────────────────────────────────────────────────────────────────────
    //  Umumiy ko'rinish
    // ─────────────────────────────────────────────────────────────────────

    public async Task<ApiResult<EnergySummaryDto>> GetSummaryAsync(string? period)
    {
        var now = _nowUtc();
        var (from, to, bucket, periodKey) = EnergyPeriod.Resolve(period, now);

        // Rollup soat aniqligida — davr boshini soat chegarasiga tushiramiz.
        var fromHour = FloorHour(from);

        var tariffs = await _context.EnergyTariffs.AsNoTracking().ToListAsync();
        var hours = await LoadHoursAsync(fromHour, now, device: null);
        var statuses = await LoadStatusesAsync(now);

        var bucketKeys = EnergyPeriod.BucketKeys(fromHour, now, bucket);
        var currency = tariffs.FirstOrDefault()?.Currency ?? "so'm";

        // Har soat o'z tarifidan baholanadi — tarif davr o'rtasida o'zgargan bo'lsa ham to'g'ri.
        var costOf = (HourAggregate h) =>
        {
            var price = TariffResolver.PriceAt(tariffs, h.HourUtc);
            return price is null ? (decimal?)null : (decimal)h.Kwh * price.Value;
        };

        // Umumiy vaqt qatori
        var series = BuildSeries(hours, bucketKeys, bucket, costOf);

        // Qurilmalar bo'yicha
        var deviceNames = statuses.Keys
            .Union(hours.Select(h => h.DeviceName))
            .Distinct()
            .OrderBy(n => n, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var totalKwh = hours.Sum(h => h.Kwh);

        var devices = new List<DeviceEnergyDto>();
        var byDevice = new List<DeviceSeriesDto>();

        foreach (var name in deviceNames)
        {
            var deviceHours = hours.Where(h => h.DeviceName == name).ToList();
            var devicePoints = BuildSeries(deviceHours, bucketKeys, bucket, costOf);
            var deviceKwh = deviceHours.Sum(h => h.Kwh);
            var status = statuses.GetValueOrDefault(name);

            devices.Add(new DeviceEnergyDto
            {
                DeviceName = name,
                Kwh = deviceKwh,
                Cost = SumCost(devicePoints),
                SharePercent = totalKwh > 0 ? deviceKwh / totalKwh * 100 : 0,
                AvgPowerW = AveragePower(deviceKwh, fromHour, now),
                PeakPowerW = deviceHours.Count == 0 ? 0 : deviceHours.Max(h => h.PeakPowerW),
                LastPowerW = status?.LastPowerW,
                LastSeen = status?.LastSeen,
                IsOnline = status?.IsOnline ?? false,
                Sparkline = devicePoints.Select(p => p.Kwh).ToList(),
            });

            byDevice.Add(new DeviceSeriesDto { DeviceName = name, Points = devicePoints });
        }

        var peak = hours.Count == 0 ? null : hours.MaxBy(h => h.PeakPowerW);
        var online = devices.Where(d => d.IsOnline).ToList();

        var dto = new EnergySummaryDto
        {
            From = fromHour,
            To = to,
            PeriodKey = periodKey,
            Bucket = bucket,
            PricePerKwh = TariffResolver.PriceAt(tariffs, now),
            Currency = currency,
            Series = series,
            Devices = devices.OrderByDescending(d => d.Kwh).ToList(),
            ByDevice = byDevice,
            Total = new EnergyTotalsDto
            {
                Kwh = totalKwh,
                Cost = SumCost(series),
                AvgPowerW = AveragePower(totalKwh, fromHour, now),
                PeakPowerW = peak?.PeakPowerW ?? 0,
                PeakAt = peak?.HourUtc,
                CurrentPowerW = online.Sum(d => d.LastPowerW ?? 0),
                DeviceCount = devices.Count,
                OnlineCount = online.Count,
            },
        };

        return ApiResult<EnergySummaryDto>.Success(dto);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  Qurilma detali
    // ─────────────────────────────────────────────────────────────────────

    public async Task<ApiResult<DeviceEnergyDetailDto>> GetDeviceDetailAsync(string deviceName, string? period)
    {
        if (string.IsNullOrWhiteSpace(deviceName))
            return ApiResult<DeviceEnergyDetailDto>.Failure(["Qurilma nomi ko'rsatilmagan."], 400);

        var name = deviceName.Trim();
        var now = _nowUtc();
        var statuses = await LoadStatusesAsync(now);

        if (!statuses.ContainsKey(name))
            return ApiResult<DeviceEnergyDetailDto>.Failure(["Qurilma topilmadi."], 404);

        var (from, to, bucket, periodKey) = EnergyPeriod.Resolve(period, now);
        var fromHour = FloorHour(from);

        var tariffs = await _context.EnergyTariffs.AsNoTracking().ToListAsync();
        var hours = await LoadHoursAsync(fromHour, now, name);
        var bucketKeys = EnergyPeriod.BucketKeys(fromHour, now, bucket);

        var byBucket = hours
            .GroupBy(h => EnergyPeriod.BucketKey(h.HourUtc, bucket))
            .ToDictionary(g => g.Key, g => g.ToList());

        var series = bucketKeys.Select(key =>
        {
            var rows = byBucket.GetValueOrDefault(key) ?? [];
            var kwh = rows.Sum(r => r.Kwh);

            return new DeviceDetailPointDto
            {
                Bucket = key,
                Kwh = kwh,
                Cost = SumCost(rows, tariffs),
                AvgPowerW = rows.Count == 0 ? 0 : rows.Average(r => r.AvgPowerW),
                PeakPowerW = rows.Count == 0 ? 0 : rows.Max(r => r.PeakPowerW),
            };
        }).ToList();

        var totalKwh = hours.Sum(h => h.Kwh);
        var peak = hours.Count == 0 ? null : hours.MaxBy(h => h.PeakPowerW);
        var status = statuses[name];

        // Kuchlanish/chastota — DB tomonda agregat, qator ko'chirilmaydi.
        var stats = await _context.MeterReadings
            .AsNoTracking()
            .Where(r => r.DeviceName == name && r.CreatedAt >= fromHour && r.CreatedAt <= now)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                AvgVoltage = g.Average(x => x.VoltagePhaseA),
                MinVoltage = g.Min(x => x.VoltagePhaseA),
                MaxVoltage = g.Max(x => x.VoltagePhaseA),
                AvgFrequency = g.Average(x => x.Frequency),
            })
            .FirstOrDefaultAsync();

        var dto = new DeviceEnergyDetailDto
        {
            DeviceName = name,
            IsOnline = status.IsOnline,
            LastSeen = status.LastSeen,
            From = fromHour,
            To = to,
            PeriodKey = periodKey,
            Bucket = bucket,
            PricePerKwh = TariffResolver.PriceAt(tariffs, now),
            Currency = tariffs.FirstOrDefault()?.Currency ?? "so'm",
            Kwh = totalKwh,
            Cost = SumCost(hours, tariffs),
            AvgPowerW = AveragePower(totalKwh, fromHour, now),
            PeakPowerW = peak?.PeakPowerW ?? 0,
            PeakAt = peak?.HourUtc,
            UptimePercent = UptimePercent(hours, fromHour, now),
            AvgVoltage = stats?.AvgVoltage ?? 0,
            MinVoltage = stats?.MinVoltage ?? 0,
            MaxVoltage = stats?.MaxVoltage ?? 0,
            AvgFrequency = stats?.AvgFrequency ?? 0,
            Series = series,
        };

        return ApiResult<DeviceEnergyDetailDto>.Success(dto);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  Qurilmalar ro'yxati
    // ─────────────────────────────────────────────────────────────────────

    public async Task<ApiResult<IEnumerable<MeterDeviceStatusDto>>> GetDeviceStatusesAsync()
    {
        var statuses = await LoadStatusesAsync(_nowUtc());

        var list = statuses.Values
            .OrderBy(s => s.Name, StringComparer.OrdinalIgnoreCase)
            .Select(s => new MeterDeviceStatusDto
            {
                Name = s.Name,
                IsOnline = s.IsOnline,
                LastSeen = s.LastSeen,
                LastPowerW = s.LastPowerW,
                IsConfigured = s.IsConfigured,
            })
            .ToList();

        return ApiResult<IEnumerable<MeterDeviceStatusDto>>.Success(list);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  Ichki yordamchilar
    // ─────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Davrdagi soatlik agregatlar: tugallangan soatlar rollupdan, joriy soat
    /// xom o'lchovlardan (rollup 5 daqiqagacha kechikishi mumkin).
    /// </summary>
    private async Task<List<HourAggregate>> LoadHoursAsync(DateTime fromHour, DateTime now, string? device)
    {
        var currentHour = FloorHour(now);

        var query = _context.MeterEnergyHourly
            .AsNoTracking()
            .Where(r => r.HourUtc >= fromHour && r.HourUtc < currentHour);

        if (device is not null)
            query = query.Where(r => r.DeviceName == device);

        var hours = await query
            .Select(r => new HourAggregate(
                r.DeviceName, r.HourUtc, r.Kwh, r.AvgPowerW, r.PeakPowerW, r.SampleCount))
            .ToListAsync();

        hours.AddRange(await ComputeCurrentHourAsync(currentHour, now, device));
        return hours;
    }

    /// <summary>
    /// Joriy (tugallanmagan) soatni xom o'lchovlardan hisoblaydi. Soat boshidan
    /// oldingi "anchor" namuna ham olinadi — birinchi interval energiyasi yo'qolmasin.
    /// </summary>
    private async Task<List<HourAggregate>> ComputeCurrentHourAsync(
        DateTime hourStart, DateTime now, string? device)
    {
        var anchorFrom = hourStart.AddSeconds(-EnergyMath.MaxGapSeconds);

        var query = _context.MeterReadings
            .AsNoTracking()
            .Where(r => r.CreatedAt >= anchorFrom && r.CreatedAt <= now);

        if (device is not null)
            query = query.Where(r => r.DeviceName == device);

        var rows = await query
            .OrderBy(r => r.DeviceName)
            .ThenBy(r => r.CreatedAt)
            .Select(r => new { r.DeviceName, r.CreatedAt, r.ActivePower })
            .ToListAsync();

        var result = new List<HourAggregate>();

        foreach (var group in rows.GroupBy(r => r.DeviceName))
        {
            var ordered = group.OrderBy(r => r.CreatedAt).ToList();

            var samples = ordered
                .Select(r => new PowerSample(r.CreatedAt, r.ActivePower))
                .ToList();

            var kwh = EnergyMath.ComputeKwh(samples);

            // Statistika faqat shu soatga tushgan namunalardan.
            var inside = ordered.Where(r => r.CreatedAt >= hourStart).ToList();

            if (inside.Count == 0 && kwh <= 0)
                continue;

            result.Add(new HourAggregate(
                group.Key,
                hourStart,
                kwh,
                inside.Count == 0 ? 0 : inside.Average(r => r.ActivePower),
                inside.Count == 0 ? 0 : inside.Max(r => r.ActivePower),
                inside.Count));
        }

        return result;
    }

    /// <summary>
    /// Qurilmalar holati: konfiguratsiyadagilar bilan bazada uchraganlarning birlashmasi.
    /// Kalit — qurilma nomi.
    /// </summary>
    private async Task<Dictionary<string, DeviceStatus>> LoadStatusesAsync(DateTime now)
    {
        var configured = _pollerOptions.ResolveDevices();
        var onlineThreshold = OnlineThreshold();

        // Har qurilma uchun oxirgi yozuv vaqti — arzon GroupBy.
        var lastSeen = await _context.MeterReadings
            .AsNoTracking()
            .GroupBy(r => r.DeviceName)
            .Select(g => new { Device = g.Key, Last = g.Max(x => x.CreatedAt) })
            .ToListAsync();

        // Oxirgi quvvat faqat yaqinda yozgan qurilmalar uchun kerak.
        var recentRows = await _context.MeterReadings
            .AsNoTracking()
            .Where(r => r.CreatedAt >= now - LastPowerWindow && r.CreatedAt <= now)
            .Select(r => new { r.DeviceName, r.CreatedAt, r.ActivePower })
            .ToListAsync();

        var lastPower = recentRows
            .GroupBy(r => r.DeviceName)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(r => r.CreatedAt).First().ActivePower);

        var statuses = new Dictionary<string, DeviceStatus>(StringComparer.Ordinal);

        foreach (var device in configured)
        {
            statuses[device.Name] = new DeviceStatus
            {
                Name = device.Name,
                IsConfigured = true,
            };
        }

        foreach (var row in lastSeen)
        {
            if (!statuses.TryGetValue(row.Device, out var status))
            {
                status = new DeviceStatus { Name = row.Device, IsConfigured = false };
                statuses[row.Device] = status;
            }

            status.LastSeen = row.Last;
            status.IsOnline = now - row.Last <= onlineThreshold;
            status.LastPowerW = status.IsOnline ? lastPower.GetValueOrDefault(row.Device) : null;
        }

        return statuses;
    }

    /// <summary>Onlayn deb hisoblash oynasi: 3 × o'qish davri, lekin kamida 30 soniya.</summary>
    private TimeSpan OnlineThreshold()
    {
        var interval = Math.Max(1, _pollerOptions.IntervalSeconds);
        var window = TimeSpan.FromSeconds(interval * 3);
        return window < MinOnlineWindow ? MinOnlineWindow : window;
    }

    private static List<EnergyBucketPointDto> BuildSeries(
        List<HourAggregate> hours,
        IReadOnlyList<string> bucketKeys,
        string bucket,
        Func<HourAggregate, decimal?> costOf)
    {
        var grouped = hours
            .GroupBy(h => EnergyPeriod.BucketKey(h.HourUtc, bucket))
            .ToDictionary(g => g.Key, g => g.ToList());

        return bucketKeys.Select(key =>
        {
            var rows = grouped.GetValueOrDefault(key) ?? [];

            decimal? cost = null;
            foreach (var row in rows)
            {
                var rowCost = costOf(row);
                if (rowCost is null) continue;
                cost = (cost ?? 0m) + rowCost.Value;
            }

            return new EnergyBucketPointDto
            {
                Bucket = key,
                Kwh = rows.Sum(r => r.Kwh),
                Cost = cost,
            };
        }).ToList();
    }

    private static decimal? SumCost(IEnumerable<EnergyBucketPointDto> points)
    {
        decimal? total = null;

        foreach (var point in points)
        {
            if (point.Cost is null) continue;
            total = (total ?? 0m) + point.Cost.Value;
        }

        return total;
    }

    private static decimal? SumCost(IEnumerable<HourAggregate> hours, IReadOnlyList<EnergyTariff> tariffs)
    {
        decimal? total = null;

        foreach (var hour in hours)
        {
            var price = TariffResolver.PriceAt(tariffs, hour.HourUtc);
            if (price is null) continue;
            total = (total ?? 0m) + (decimal)hour.Kwh * price.Value;
        }

        return total;
    }

    /// <summary>Davr davomidagi o'rtacha quvvat (W) = energiya / vaqt.</summary>
    private static double AveragePower(double kwh, DateTime fromUtc, DateTime toUtc)
    {
        var hours = (toUtc - fromUtc).TotalHours;
        return hours <= 0 ? 0 : kwh * 1000d / hours;
    }

    /// <summary>Haqiqiy o'lchovlar sonining kutilgan songa nisbati (0–100).</summary>
    private double UptimePercent(List<HourAggregate> hours, DateTime fromUtc, DateTime toUtc)
    {
        var seconds = (toUtc - fromUtc).TotalSeconds;
        var interval = Math.Max(1, _pollerOptions.IntervalSeconds);
        var expected = seconds / interval;

        if (expected <= 0)
            return 0;

        var actual = hours.Sum(h => h.SampleCount);
        return Math.Min(100, actual / expected * 100);
    }

    private static DateTime FloorHour(DateTime value) =>
        new(value.Year, value.Month, value.Day, value.Hour, 0, 0, DateTimeKind.Utc);

    private readonly record struct HourAggregate(
        string DeviceName,
        DateTime HourUtc,
        double Kwh,
        double AvgPowerW,
        double PeakPowerW,
        int SampleCount);

    private sealed class DeviceStatus
    {
        public string Name { get; init; } = string.Empty;
        public bool IsConfigured { get; init; }
        public bool IsOnline { get; set; }
        public DateTime? LastSeen { get; set; }
        public double? LastPowerW { get; set; }
    }
}
```

- [ ] **Step 5: Register the service in DI**

`Back/src/Application/ApplicationDependencyInjection.cs` — `IEnergyTariffService` qatoridan keyin:

```csharp
        services.AddScoped<IEnergySummaryService, EnergySummaryService>();
```

- [ ] **Step 6: Run tests to verify they pass**

Run:
```bash
dotnet test test/Application.Tests/Application.Tests.csproj --filter "FullyQualifiedName~EnergySummaryServiceTests"
```
Expected: 16 test PASS. Agar `GetSummaryAsync_WithDayBucket_GroupsHoursIntoLocalDays` yiqilsa — `EnergyPeriod.BucketKey` mahalliy siljishni to'g'ri qo'llayotganini tekshiring.

- [ ] **Step 7: Run the whole suite**

Run:
```bash
dotnet test test/Application.Tests/Application.Tests.csproj
```
Expected: barcha testlar PASS.

- [ ] **Step 8: Commit**

```bash
git add Back/src/Application/Services/IEnergySummaryService.cs \
        Back/src/Application/Services/Impl/EnergySummaryService.cs \
        Back/src/Application/ApplicationDependencyInjection.cs \
        Back/test/Application.Tests/Services/EnergySummaryServiceTests.cs
git commit -m "feat(energy): panel summary servisi (kWh, xarajat, qurilma statuslari)"
```

---

## Task 12: `MeterDataController` yangi endpointlari

**Files:**
- Modify: `Back/src/API/Controllers/MeterDataController.cs`

**Interfaces:**
- Consumes: `IEnergySummaryService` (Task 11)
- Produces:
  - `GET /api/meter-data/summary?period=…` → `EnergySummaryDto`
  - `GET /api/meter-data/summary/{device}?period=…` → `DeviceEnergyDetailDto`
  - `GET /api/meter-data/devices` → `IEnumerable<MeterDeviceStatusDto>` (**javob shakli o'zgardi**: ilgari `string[]` edi)

- [ ] **Step 1: Rewrite the controller**

`Back/src/API/Controllers/MeterDataController.cs` — faylni to'liq quyidagi bilan almashtiring:

```csharp
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// Hisoblagich o'lchovlari va energiya paneli (UI uchun). Ma'lumot bazaga
/// MeterPollerService (Modbus TCP) orqali yoziladi.
/// </summary>
[ApiController]
[Route("api/meter-data")]
[Authorize]
public class MeterDataController : ControllerBase
{
    private readonly IMeterDataService _service;
    private readonly IEnergySummaryService _summaryService;

    public MeterDataController(IMeterDataService service, IEnergySummaryService summaryService)
    {
        _service = service;
        _summaryService = summaryService;
    }

    /// <summary>Oxirgi xom o'lchovlar ro'yxati (ixtiyoriy ?device= filtri, ?take= limit).</summary>
    [HttpGet]
    public async Task<IActionResult> GetLatest([FromQuery] string? device, [FromQuery] int take = 100)
    {
        var result = await _service.GetLatestAsync(device, take);
        return Ok(result);
    }

    /// <summary>Qurilmalar va ularning jonli holati (onlayn/oflayn, oxirgi quvvat).</summary>
    [HttpGet("devices")]
    public async Task<IActionResult> GetDevices()
    {
        var result = await _summaryService.GetDeviceStatusesAsync();
        return StatusCode(result.StatusCode, result);
    }

    /// <summary>Barcha qurilmalar bo'yicha energiya va xarajat paneli.</summary>
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] string? period)
    {
        var result = await _summaryService.GetSummaryAsync(period);
        return StatusCode(result.StatusCode, result);
    }

    /// <summary>Bitta qurilmaning batafsil energiya ko'rsatkichlari.</summary>
    [HttpGet("summary/{device}")]
    public async Task<IActionResult> GetDeviceSummary(string device, [FromQuery] string? period)
    {
        var result = await _summaryService.GetDeviceDetailAsync(device, period);
        return StatusCode(result.StatusCode, result);
    }
}
```

- [ ] **Step 2: Verify the build**

Run (`Back/` papkasidan):
```bash
dotnet build Back.sln
```
Expected: build muvaffaqiyatli.

- [ ] **Step 3: Smoke-test the endpoints manually**

Backendni ishga tushiring (`Back/src/API` papkasidan `dotnet run`), Swagger'da (`http://localhost:5223/swagger`) tekshiring:

| Endpoint | Kutilgan |
|---|---|
| `GET /api/meter-data/devices` | `result` — obyektlar massivi (`name`, `isOnline`, `lastSeen`, `lastPowerW`, `isConfigured`) |
| `GET /api/meter-data/summary?period=24h` | `result.total.kwh` > 0 (agar ma'lumot bo'lsa), `result.series` massivi to'la |
| `GET /api/meter-data/summary/DR134?period=today` | `result.deviceName` = `"DR134"` |
| `GET /api/meter-data/summary/YOQ` | HTTP 404 |
| `GET /api/energy-tariffs` | Seed qilingan `1100` tarifi |

Loglar orasida `Energiya rollup backfill: N soat hisoblandi.` xabari ko'rinishi kerak.

- [ ] **Step 4: Commit**

```bash
git add Back/src/API/Controllers/MeterDataController.cs
git commit -m "feat(energy): summary va boyitilgan devices endpointlari"
```

---

## Task 13: Frontend servis qatlami va formatlash

**Files:**
- Modify: `client/lib/meterData.ts`
- Create: `client/lib/energyTariff.ts`
- Create: `client/lib/energyFormat.ts`

**Interfaces:**
- Consumes: Task 8/9/11/12 API javoblari
- Produces:
  - `lib/meterData.ts`: `EnergyPeriodKey`, `EnergyBucketPoint`, `DeviceSeries`, `DeviceEnergy`, `EnergyTotals`, `EnergySummary`, `DeviceDetailPoint`, `DeviceEnergyDetail`, `MeterDeviceStatus`; `meterDataService.getDevices()` (endi `MeterDeviceStatus[]`), `.getSummary(period)`, `.getDeviceDetail(device, period)`
  - `lib/energyTariff.ts`: `EnergyTariff`, `EnergyTariffSave`, `energyTariffService.getAll/create/update/remove`
  - `lib/energyFormat.ts`: `formatKwh`, `formatMoney`, `formatMoneyFull`, `formatPower`, `formatPercent`, `buildDeviceColorMap`, `formatBucketLabel`

- [ ] **Step 1: Extend `lib/meterData.ts`**

`client/lib/meterData.ts` — faylni to'liq quyidagi bilan almashtiring:

```ts
import { api } from "./api";

// Elektr hisoblagich o'lchovlari va energiya paneli — backenddagi
// `GET /api/meter-data*` endpointlariga mos.

export interface MeterReading {
  id: string;
  deviceName: string;
  voltagePhaseA: number;
  voltagePhaseB: number;
  voltagePhaseC: number;
  currentPhaseA: number;
  currentPhaseB: number;
  currentPhaseC: number;
  activePower: number;
  frequency: number;
  createdAt: string;
}

export type EnergyPeriodKey = "today" | "24h" | "7d" | "30d" | "month";
export type EnergyBucketKind = "hour" | "day";

/** Grafikning bitta ustuni. `cost` — tarif topilmasa null. */
export interface EnergyBucketPoint {
  bucket: string;
  kwh: number;
  cost: number | null;
}

export interface DeviceSeries {
  deviceName: string;
  points: EnergyBucketPoint[];
}

export interface DeviceEnergy {
  deviceName: string;
  kwh: number;
  cost: number | null;
  sharePercent: number;
  avgPowerW: number;
  peakPowerW: number;
  lastPowerW: number | null;
  lastSeen: string | null;
  isOnline: boolean;
  sparkline: number[];
}

export interface EnergyTotals {
  kwh: number;
  cost: number | null;
  avgPowerW: number;
  peakPowerW: number;
  peakAt: string | null;
  currentPowerW: number;
  deviceCount: number;
  onlineCount: number;
}

export interface EnergySummary {
  from: string;
  to: string;
  periodKey: EnergyPeriodKey;
  bucket: EnergyBucketKind;
  pricePerKwh: number | null;
  currency: string;
  total: EnergyTotals;
  devices: DeviceEnergy[];
  series: EnergyBucketPoint[];
  byDevice: DeviceSeries[];
}

export interface DeviceDetailPoint {
  bucket: string;
  kwh: number;
  cost: number | null;
  avgPowerW: number;
  peakPowerW: number;
}

export interface DeviceEnergyDetail {
  deviceName: string;
  isOnline: boolean;
  lastSeen: string | null;
  from: string;
  to: string;
  periodKey: EnergyPeriodKey;
  bucket: EnergyBucketKind;
  pricePerKwh: number | null;
  currency: string;
  kwh: number;
  cost: number | null;
  avgPowerW: number;
  peakPowerW: number;
  peakAt: string | null;
  uptimePercent: number;
  avgVoltage: number;
  minVoltage: number;
  maxVoltage: number;
  avgFrequency: number;
  series: DeviceDetailPoint[];
}

export interface MeterDeviceStatus {
  name: string;
  isOnline: boolean;
  lastSeen: string | null;
  lastPowerW: number | null;
  isConfigured: boolean;
}

export const meterDataService = {
  async getLatest(device?: string, take = 100): Promise<MeterReading[]> {
    const res = await api.get("/api/meter-data", {
      params: { device: device || undefined, take },
    });
    return res.data.result ?? [];
  },

  async getDevices(): Promise<MeterDeviceStatus[]> {
    const res = await api.get("/api/meter-data/devices");
    return res.data.result ?? [];
  },

  async getSummary(period: EnergyPeriodKey): Promise<EnergySummary | null> {
    const res = await api.get("/api/meter-data/summary", { params: { period } });
    return res.data.result ?? null;
  },

  async getDeviceDetail(device: string, period: EnergyPeriodKey): Promise<DeviceEnergyDetail | null> {
    const res = await api.get(`/api/meter-data/summary/${encodeURIComponent(device)}`, {
      params: { period },
    });
    return res.data.result ?? null;
  },
};
```

- [ ] **Step 2: Create `lib/energyTariff.ts`**

Create `client/lib/energyTariff.ts`:

```ts
import { api } from "./api";

// Elektr tariflari — `/api/energy-tariffs`. O'qish hammaga, yozish
// "Energy.Update" ruxsati bilan.

export interface EnergyTariff {
  id: string;
  pricePerKwh: number;
  currency: string;
  effectiveFrom: string;
  note: string | null;
  createdAt: string;
  createdByUserId: string | null;
  createdByName: string | null;
}

export interface EnergyTariffSave {
  pricePerKwh: number;
  currency: string;
  /** ISO sana — "2026-06-01" yetarli, backend kun boshiga keltiradi. */
  effectiveFrom: string;
  note?: string | null;
}

export const energyTariffService = {
  async getAll(): Promise<EnergyTariff[]> {
    const res = await api.get("/api/energy-tariffs");
    return res.data.result ?? [];
  },

  async create(dto: EnergyTariffSave): Promise<string> {
    const res = await api.post("/api/energy-tariffs", dto);
    return res.data.result;
  },

  async update(id: string, dto: EnergyTariffSave): Promise<void> {
    await api.put(`/api/energy-tariffs/${id}`, dto);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/api/energy-tariffs/${id}`);
  },
};
```

- [ ] **Step 3: Create `lib/energyFormat.ts`**

Create `client/lib/energyFormat.ts`:

```ts
// Energiya panelidagi raqamlarni formatlash va qurilma ranglari.
// Barcha ranglar CSS tokenlardan — dark/light rejimda o'zi moslashadi.

/** Ming ajratgichi sifatida oddiy bo'shliq (ru-RU nozik bo'shliq beradi). */
function group(value: number, decimals = 0): string {
  return value
    .toLocaleString("ru-RU", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    .replace(/ | /g, " ");
}

/** kWh: kichik qiymatda aniqroq, kattasida yaxlit. */
export function formatKwh(kwh: number): string {
  if (!Number.isFinite(kwh)) return "—";
  if (kwh === 0) return "0";
  if (Math.abs(kwh) < 10) return group(kwh, 2);
  if (Math.abs(kwh) < 100) return group(kwh, 1);
  return group(kwh, 0);
}

/** Pul: 1 mln dan oshsa qisqartiriladi ("1,41 mln"). */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000) return `${group(value / 1_000_000, 2)} mln`;
  return group(value, 0);
}

/** To'liq qiymat — `title` atributi uchun. */
export function formatMoneyFull(value: number | null | undefined, currency = "so'm"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${group(value, 0)} ${currency}`;
}

/** Quvvat: 1 kW dan oshsa kW da. Natija: [qiymat, birlik]. */
export function formatPower(watts: number | null | undefined): [string, string] {
  if (watts === null || watts === undefined || !Number.isFinite(watts)) return ["—", "W"];
  if (Math.abs(watts) >= 1000) return [group(watts / 1000, 1), "kW"];
  return [group(watts, 0), "W"];
}

export function formatPercent(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "—";
  return `${group(value, decimals)}%`;
}

/** Bucket kalitidan qisqa yorliq: "14:00" yoki "11-avg". */
const MONTHS_UZ = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

export function formatBucketLabel(bucket: string, kind: "hour" | "day"): string {
  if (kind === "hour") return bucket.slice(11, 16);

  const [, month, day] = bucket.split("-");
  const monthIndex = Number(month) - 1;
  return `${Number(day)}-${MONTHS_UZ[monthIndex] ?? month}`;
}

// ── Qurilma ranglari ────────────────────────────────────────────────────
// Palitra CSS tokenlardan. Rang qurilma nomining hash'i bo'yicha tayinlanadi —
// sahifa yangilanganda yoki tartib o'zgarganda rang o'zgarmaydi.

const DEVICE_PALETTE = [
  "var(--accent)",
  "var(--success)",
  "var(--purple)",
  "var(--warn)",
  "var(--accent3)",
  "var(--danger)",
  "var(--accent-light)",
  "var(--accent2)",
];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Qurilma nomi → rang. To'qnashuv bo'lsa keyingi bo'sh slotga suriladi,
 * shu sababli bitta grafikdagi ikki qurilma bir xil rangda chiqmaydi.
 */
export function buildDeviceColorMap(names: string[]): Record<string, string> {
  const used = new Set<number>();
  const map: Record<string, string> = {};

  for (const name of [...names].sort()) {
    let slot = hash(name) % DEVICE_PALETTE.length;

    for (let i = 0; i < DEVICE_PALETTE.length && used.has(slot); i++) {
      slot = (slot + 1) % DEVICE_PALETTE.length;
    }

    used.add(slot);
    map[name] = DEVICE_PALETTE[slot];
  }

  return map;
}
```

- [ ] **Step 4: Verify types and lint**

Run (`client/` papkasidan):
```bash
npx tsc --noEmit
```
Expected: `page.tsx` da `devices` endi `MeterDeviceStatus[]` bo'lgani uchun tip xatosi chiqadi — bu kutilgan, Task 14 da tuzatiladi. Boshqa fayllarda xato bo'lmasligi kerak.

- [ ] **Step 5: Commit**

```bash
git add client/lib/meterData.ts client/lib/energyTariff.ts client/lib/energyFormat.ts
git commit -m "feat(energy): frontend servis qatlami va formatlash yordamchilari"
```

---

## Task 14: Davr paneli, KPI qatori va sahifa skeleti

**Files:**
- Create: `client/app/(main)/meter-data/_components/PeriodBar.tsx`
- Create: `client/app/(main)/meter-data/_components/KpiRow.tsx`
- Create: `client/app/(main)/meter-data/_components/LiveCharts.tsx`
- Create: `client/app/(main)/meter-data/_components/ReadingsTable.tsx`
- Modify: `client/app/(main)/meter-data/page.tsx`

**Interfaces:**
- Consumes: Task 13 servislari va formatlari
- Produces:
  - `PeriodBar` props: `{ period, onPeriodChange, live, onLiveToggle, lastFetch, pricePerKwh, currency, canEditTariff, onOpenTariff, onRefresh }`
  - `KpiRow` props: `{ total, currency, loading }`
  - `LiveCharts` props: `{ readings: MeterReading[] }` — xronologik tartibga o'zi keltiradi
  - `ReadingsTable` props: `{ items: MeterReading[], loading, error, showDeviceColumn }`

- [ ] **Step 1: Extract the live line charts**

Create `client/app/(main)/meter-data/_components/LiveCharts.tsx` — mavjud `page.tsx` dagi `ChartCard`, `ChartTitle`, `CHART_H`, `CHART_PAD_T`, `CHART_PAD_B` konstantalarini **o'zgarishsiz** shu faylga ko'chiring, so'ng oxiriga `LiveCharts` komponentini qo'shing:

```tsx
"use client";

import { useRef, useState } from "react";
import type { MeterReading } from "@/lib/meterData";
import { useT } from "@/lib/i18n";

// ⬇️ Bu yerga page.tsx dagi CHART_H / CHART_PAD_T / CHART_PAD_B konstantalari,
//    ChartCard va ChartTitle komponentlari o'zgarishsiz ko'chiriladi.
//    (ChartCard `export` qilinmaydi — faqat LiveCharts ishlatadi.)

/**
 * Bitta qurilmaning jonli o'lchov grafiklari. Har birlik alohida grafikda —
 * bitta o'qda turli birliklarni aralashtirmaslik uchun.
 */
export function LiveCharts({ readings }: { readings: MeterReading[] }) {
  const t = useT();

  // Jadval DESC keladi — grafik uchun xronologik tartib kerak.
  const chron = [...readings].reverse();
  const seriesOf = (pick: (r: MeterReading) => number) =>
    chron.map(r => ({ t: r.createdAt, v: pick(r) }));

  if (chron.length < 2) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10 }}>
      <ChartCard title={t("Kuchlanish")} unit="V" decimals={1} points={seriesOf(r => r.voltagePhaseA)} />
      <ChartCard title={t("Tok")} unit="A" decimals={2} points={seriesOf(r => r.currentPhaseA)} />
      <ChartCard title={t("Quvvat")} unit="W" decimals={0} points={seriesOf(r => r.activePower)} />
      <ChartCard title={t("Chastota")} unit="Hz" decimals={2} points={seriesOf(r => r.frequency)} />
    </div>
  );
}
```

- [ ] **Step 2: Extract the readings table**

Create `client/app/(main)/meter-data/_components/ReadingsTable.tsx`:

```tsx
"use client";

import type { MeterReading } from "@/lib/meterData";
import { useT } from "@/lib/i18n";

// "DD-MM-YY · HH:mm:ss" — sekundgacha, jonli oqimda farqlash oson bo'lsin.
function formatDateTime(iso: string): string {
  const date = iso?.slice(0, 10).split("-");
  const time = iso?.slice(11, 19);
  if (!date || date.length !== 3) return "—";
  return `${date[2]}-${date[1]}-${date[0].slice(-2)}${time ? ` · ${time}` : ""}`;
}

export function ReadingsTable({
  items,
  loading,
  error,
  showDeviceColumn = true,
}: {
  items: MeterReading[];
  loading: boolean;
  error: string;
  showDeviceColumn?: boolean;
}) {
  const t = useT();
  const colCount = showDeviceColumn ? 7 : 6;

  return (
    <div className="itm-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "clip" } as React.CSSProperties}>
      {loading ? (
        <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--text2)" }}>{t("Yuklanmoqda...")}</div>
      ) : error ? (
        <div style={{ flex: 1, padding: 40, textAlign: "center", color: "var(--danger)" }}>{error}</div>
      ) : (
        <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0 }}>
          <table className="itm-table">
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr>
                <th style={{ width: 56, minWidth: 56, textAlign: "center", borderRight: "2px solid var(--border)", background: "var(--bg2)" }}>{t("T/r")}</th>
                {showDeviceColumn && <th style={{ textAlign: "center", background: "var(--bg2)" }}>{t("Qurilma")}</th>}
                <th style={{ textAlign: "center", background: "var(--bg2)" }}>Uₐ (V)</th>
                <th style={{ textAlign: "center", background: "var(--bg2)" }}>Iₐ (A)</th>
                <th style={{ textAlign: "center", background: "var(--bg2)" }}>P (W)</th>
                <th style={{ textAlign: "center", background: "var(--bg2)" }}>f (Hz)</th>
                <th style={{ textAlign: "center", background: "var(--bg2)" }}>{t("Sana")}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={colCount} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>
                    {t("Hali ma'lumot kelmagan — qurilma yuborishini kuting.")}
                  </td>
                </tr>
              ) : items.map((r, i) => (
                <tr key={r.id} className={i === 0 ? "nd-fadein-0" : undefined}>
                  <td style={{ textAlign: "center", borderRight: "2px solid var(--border)", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  {showDeviceColumn && (
                    <td style={{ textAlign: "center" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "2px 10px", borderRadius: 999,
                        background: "var(--accent-dim)", color: "var(--accent)",
                        fontSize: 11.5, fontWeight: 600, fontFamily: "var(--font-mono)", whiteSpace: "nowrap",
                      }}>
                        {r.deviceName}
                      </span>
                    </td>
                  )}
                  <td style={{ textAlign: "center", fontFamily: "var(--font-mono)" }}>{r.voltagePhaseA.toFixed(1)}</td>
                  <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", color: "var(--text2)" }}>{r.currentPhaseA.toFixed(2)}</td>
                  <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent)" }}>{r.activePower}</td>
                  <td style={{ textAlign: "center", fontFamily: "var(--font-mono)" }}>{r.frequency.toFixed(2)}</td>
                  <td style={{ textAlign: "center", color: "var(--text2)", fontFamily: "var(--font-mono)", fontSize: 12.5, whiteSpace: "nowrap" }}>
                    {formatDateTime(r.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `PeriodBar`**

Create `client/app/(main)/meter-data/_components/PeriodBar.tsx`:

```tsx
"use client";

import type { EnergyPeriodKey } from "@/lib/meterData";
import { formatMoneyFull } from "@/lib/energyFormat";
import { useT } from "@/lib/i18n";

const PERIODS: { key: EnergyPeriodKey; label: string }[] = [
  { key: "today", label: "Bugun" },
  { key: "24h", label: "24 soat" },
  { key: "7d", label: "7 kun" },
  { key: "30d", label: "30 kun" },
  { key: "month", label: "Oy" },
];

export function PeriodBar({
  period,
  onPeriodChange,
  live,
  onLiveToggle,
  lastFetch,
  pricePerKwh,
  currency,
  canEditTariff,
  onOpenTariff,
  onRefresh,
}: {
  period: EnergyPeriodKey;
  onPeriodChange: (p: EnergyPeriodKey) => void;
  live: boolean;
  onLiveToggle: () => void;
  lastFetch: Date | null;
  pricePerKwh: number | null;
  currency: string;
  canEditTariff: boolean;
  onOpenTariff: () => void;
  onRefresh: () => void;
}) {
  const t = useT();

  return (
    <div
      className="itm-card"
      style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "8px 14px", flexWrap: "wrap", overflow: "visible" }}
    >
      {/* Davr tanlash — segmentli tugmalar */}
      <div style={{ display: "inline-flex", background: "var(--surface2)", borderRadius: 999, padding: 3, gap: 2 }}>
        {PERIODS.map(p => {
          const active = p.key === period;
          return (
            <button
              key={p.key}
              onClick={() => onPeriodChange(p.key)}
              style={{
                padding: "5px 13px", fontSize: 12, fontWeight: 600,
                borderRadius: 999, border: "none", cursor: "pointer",
                background: active ? "var(--accent)" : "transparent",
                color: active ? "#fff" : "var(--text2)",
                transition: "all 0.15s",
              }}
            >
              {t(p.label)}
            </button>
          );
        })}
      </div>

      {/* Jonli yangilanish indikatori */}
      <button
        onClick={onLiveToggle}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px",
          fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)",
          borderRadius: 999, cursor: "pointer",
          background: live ? "var(--success-dim)" : "var(--surface2)",
          border: `1.5px solid ${live ? "var(--success)" : "var(--border)"}`,
          color: live ? "var(--success)" : "var(--text3)",
          transition: "all 0.15s",
        }}
        title={live ? t("Jonli yangilanishni to'xtatish") : t("Jonli yangilanishni yoqish")}
      >
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: live ? "var(--success)" : "var(--text3)",
          animation: live ? "dotPulse 1.6s infinite" : "none",
        }} />
        {live ? t("Jonli") : t("To'xtatilgan")}
      </button>

      {lastFetch && (
        <span style={{ fontSize: 11.5, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
          {t("Yangilandi")}: {lastFetch.toTimeString().slice(0, 8)}
        </span>
      )}

      {/* Tarif chipi — tahrirlash ruxsati bo'lsa bosiladi */}
      <button
        onClick={canEditTariff ? onOpenTariff : undefined}
        disabled={!canEditTariff}
        title={canEditTariff ? t("Tarifni o'zgartirish") : t("Joriy tarif")}
        style={{
          marginLeft: "auto",
          display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px",
          fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)",
          borderRadius: 999,
          background: "var(--accent-dim)", border: "1px solid var(--accent-mid)",
          color: "var(--accent)",
          cursor: canEditTariff ? "pointer" : "default",
          transition: "all 0.15s",
        }}
      >
        {pricePerKwh === null ? t("Tarif belgilanmagan") : `1 kWh = ${formatMoneyFull(pricePerKwh, currency)}`}
        {canEditTariff && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        )}
      </button>

      <button
        className="btn-icon"
        onClick={onRefresh}
        title={t("Yangilash")}
        style={{ background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", width: 36, height: 36 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create `KpiRow`**

Create `client/app/(main)/meter-data/_components/KpiRow.tsx`:

```tsx
"use client";

import type { EnergyTotals } from "@/lib/meterData";
import { formatKwh, formatMoney, formatMoneyFull, formatPower } from "@/lib/energyFormat";
import { useT } from "@/lib/i18n";

/** Bitta KPI karta — hover'da nozik shimmer bilan. */
function StatCard({
  label,
  value,
  unit,
  hint,
  accent,
  title,
  loading,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  accent?: string;
  title?: string;
  loading?: boolean;
}) {
  return (
    <div
      className="itm-card"
      title={title}
      style={{ padding: "12px 16px", flex: 1, minWidth: 160, position: "relative", overflow: "hidden" }}
    >
      <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 4 }}>
        {label}
      </p>

      {loading ? (
        <div style={{ height: 26, width: 90, background: "var(--surface2)", borderRadius: "var(--radius)" }} className="animate-pulse" />
      ) : (
        <p style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: accent ?? "var(--text)", lineHeight: 1.1 }}>
          {value}
          {unit && <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text3)", marginLeft: 4 }}>{unit}</span>}
        </p>
      )}

      {hint && (
        <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function KpiRow({
  total,
  currency,
  loading,
}: {
  total: EnergyTotals | null;
  currency: string;
  loading: boolean;
}) {
  const t = useT();

  const [currentValue, currentUnit] = formatPower(total?.currentPowerW ?? null);
  const [peakValue, peakUnit] = formatPower(total?.peakPowerW ?? null);
  const peakHint = total?.peakAt ? `${t("Pik vaqti")}: ${total.peakAt.slice(11, 16)}` : undefined;

  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
      <StatCard
        loading={loading}
        label={t("Sarflangan energiya")}
        value={total ? formatKwh(total.kwh) : "—"}
        unit="kWh"
      />
      <StatCard
        loading={loading}
        label={t("Xarajat")}
        value={total ? formatMoney(total.cost) : "—"}
        unit={currency}
        accent="var(--accent)"
        title={total ? formatMoneyFull(total.cost, currency) : undefined}
      />
      <StatCard
        loading={loading}
        label={t("Hozirgi quvvat")}
        value={currentValue}
        unit={currentUnit}
        accent={total && total.currentPowerW > 0 ? "var(--success)" : undefined}
      />
      <StatCard
        loading={loading}
        label={t("Eng yuqori quvvat")}
        value={peakValue}
        unit={peakUnit}
        hint={peakHint}
      />
      <StatCard
        loading={loading}
        label={t("Qurilmalar")}
        value={total ? `${total.onlineCount} / ${total.deviceCount}` : "—"}
        hint={t("onlayn")}
        accent={total && total.onlineCount > 0 ? "var(--success)" : "var(--text3)"}
      />
    </div>
  );
}
```

- [ ] **Step 5: Rewrite `page.tsx` with the two-view shell**

`client/app/(main)/meter-data/page.tsx` — faylni to'liq quyidagi bilan almashtiring (grafik va grid komponentlari Task 15–16 da qo'shiladi; hozircha ular o'rniga bo'sh joy qoldiriladi):

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  meterDataService,
  type EnergyPeriodKey,
  type EnergySummary,
  type MeterReading,
} from "@/lib/meterData";
import { useAuthStore } from "@/lib/store/authStore";
import { useT } from "@/lib/i18n";
import { PeriodBar } from "./_components/PeriodBar";
import { KpiRow } from "./_components/KpiRow";
import { ReadingsTable } from "./_components/ReadingsTable";

/** Xom o'lchovlar va statuslar — tez-tez. */
const LIVE_POLL_MS = 5000;
/** Agregat panel — sekinroq, u soat aniqligida o'zgaradi. */
const SUMMARY_POLL_MS = 60000;

export default function MeterDataPage() {
  const t = useT();
  const hasPermission = useAuthStore(s => s.hasPermission);
  const canEditTariff = hasPermission("Energy.Update");

  const [period, setPeriod] = useState<EnergyPeriodKey>("today");
  const [summary, setSummary] = useState<EnergySummary | null>(null);
  const [readings, setReadings] = useState<MeterReading[]>([]);

  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [tariffOpen, setTariffOpen] = useState(false);

  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  // Interval callback ichida so'nggi qiymatlar kerak.
  const periodRef = useRef(period);
  periodRef.current = period;
  const deviceRef = useRef(selectedDevice);
  deviceRef.current = selectedDevice;

  const loadLive = useCallback(async () => {
    const items = await meterDataService.getLatest(deviceRef.current ?? undefined, 100);
    setReadings(items);
    setLastFetch(new Date());
  }, []);

  const loadSummary = useCallback(async () => {
    const data = await meterDataService.getSummary(periodRef.current);
    setSummary(data);
  }, []);

  const loadAll = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      await Promise.all([loadLive(), loadSummary()]);
    } catch {
      setError(t("Hisoblagich ma'lumotlarini yuklashda xatolik."));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [loadLive, loadSummary, t]);

  // Davr yoki qurilma o'zgarsa — darhol qayta yuklash.
  useEffect(() => { loadAll(); }, [period, selectedDevice, loadAll]);

  // Jonli oqim: xom o'lchovlar tez, agregat sekin.
  useEffect(() => {
    if (!live) return;

    const liveId = setInterval(() => { loadLive().catch(() => {}); }, LIVE_POLL_MS);
    const summaryId = setInterval(() => { loadSummary().catch(() => {}); }, SUMMARY_POLL_MS);

    return () => { clearInterval(liveId); clearInterval(summaryId); };
  }, [live, loadLive, loadSummary]);

  return (
    <div className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <PeriodBar
        period={period}
        onPeriodChange={setPeriod}
        live={live}
        onLiveToggle={() => setLive(l => !l)}
        lastFetch={lastFetch}
        pricePerKwh={summary?.pricePerKwh ?? null}
        currency={summary?.currency ?? "so'm"}
        canEditTariff={canEditTariff}
        onOpenTariff={() => setTariffOpen(true)}
        onRefresh={() => loadAll()}
      />

      <KpiRow total={summary?.total ?? null} currency={summary?.currency ?? "so'm"} loading={loading} />

      {/* Task 15: grafiklar (EnergyBarChart + DeviceDonut) shu yerga qo'shiladi */}
      {/* Task 16: DeviceGrid / DeviceDetail shu yerga qo'shiladi */}

      <ReadingsTable
        items={readings}
        loading={loading}
        error={error}
        showDeviceColumn={selectedDevice === null}
      />

      {/* Task 17: TariffModal shu yerga qo'shiladi */}
      {tariffOpen && null}
    </div>
  );
}
```

> `selectedDevice` va `tariffOpen` hozircha ishlatilmaydi — ular Task 16/17 da bog'lanadi. `npx tsc --noEmit` "unused variable" xatosi bermaydi (TypeScript'ning `noUnusedLocals` yoqilmagan), lekin `npm run lint` ogohlantirishi mumkin — bu bosqichda qabul qilinadi.

- [ ] **Step 6: Verify types, lint and the page in the browser**

Run (`client/` papkasidan):
```bash
npx tsc --noEmit
npm run lint
```
Expected: tip xatosi yo'q.

Brauzerda `http://localhost:3000/meter-data` ni oching (backend ishlab turishi kerak) va tekshiring:
- Davr tugmalari almashadi, tanlangani accent rangda
- 5 ta KPI karta qiymat ko'rsatadi (`Sarflangan energiya`, `Xarajat`, `Hozirgi quvvat`, `Eng yuqori quvvat`, `Qurilmalar`)
- Tarif chipida `1 kWh = 1 100 so'm` ko'rinadi
- Xom o'lchovlar jadvali ishlaydi, jonli yangilanadi

- [ ] **Step 7: Commit**

```bash
git add client/app/\(main\)/meter-data/
git commit -m "feat(energy): davr paneli, KPI qatori va sahifa skeleti"
```

---

## Task 15: Energiya grafiklari

**Files:**
- Create: `client/app/(main)/meter-data/_components/Sparkline.tsx`
- Create: `client/app/(main)/meter-data/_components/EnergyBarChart.tsx`
- Create: `client/app/(main)/meter-data/_components/DeviceDonut.tsx`
- Modify: `client/app/(main)/meter-data/page.tsx` (grafiklar bloki)

**Interfaces:**
- Consumes: `EnergyBucketPoint`, `DeviceSeries`, `DeviceEnergy` (Task 13); `formatKwh`, `formatMoney`, `formatMoneyFull`, `formatBucketLabel`, `buildDeviceColorMap` (Task 13)
- Produces:
  - `Sparkline` props: `{ values: number[]; color: string; height?: number }`
  - `EnergyBarChart` props: `{ series: EnergyBucketPoint[]; byDevice: DeviceSeries[]; bucket: "hour" | "day"; currency: string; colors: Record<string, string> }`
  - `DeviceDonut` props: `{ devices: DeviceEnergy[]; colors: Record<string, string>; currency: string; onSelect?: (device: string) => void }`

- [ ] **Step 1: Create `Sparkline`**

Create `client/app/(main)/meter-data/_components/Sparkline.tsx`:

```tsx
"use client";

/**
 * Karta ichidagi mini-grafik. O'q, yorliq, tooltip yo'q — u faqat shakl
 * ko'rsatadi, aniq qiymat kartadagi raqamda turadi.
 */
export function Sparkline({
  values,
  color,
  height = 28,
}: {
  values: number[];
  color: string;
  height?: number;
}) {
  const W = 100;

  if (values.length < 2) {
    return (
      <div style={{ height, display: "flex", alignItems: "center" }}>
        <div style={{ height: 1, width: "100%", background: "var(--border)" }} />
      </div>
    );
  }

  const max = Math.max(...values, 0);
  const scale = max > 0 ? max : 1;

  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => height - (v / scale) * (height - 2) - 1;

  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${height} L0,${height} Z`;
  const gradientId = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Create `EnergyBarChart`**

Create `client/app/(main)/meter-data/_components/EnergyBarChart.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { DeviceSeries, EnergyBucketPoint } from "@/lib/meterData";
import { formatBucketLabel, formatKwh, formatMoneyFull } from "@/lib/energyFormat";
import { useT } from "@/lib/i18n";

const CHART_H = 168;

/**
 * Vaqt bo'yicha sarf — qurilmalar bo'yicha bo'lingan (stacked) ustunlar.
 * Ustunlar div bilan chiziladi: responsiv, matn o'lchami bilan cho'zilmaydi
 * va hover holati SVG'ga qaraganda soddaroq.
 */
export function EnergyBarChart({
  series,
  byDevice,
  bucket,
  currency,
  colors,
}: {
  series: EnergyBucketPoint[];
  byDevice: DeviceSeries[];
  bucket: "hour" | "day";
  currency: string;
  colors: Record<string, string>;
}) {
  const t = useT();
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(...series.map(p => p.kwh), 0);

  // Ustunlar soni ko'p bo'lsa har yorliqni chizish o'qni to'ldirib yuboradi.
  const labelStep = Math.max(1, Math.ceil(series.length / 12));

  // Faqat davr ichida sarfi bo'lgan qurilmalar legendaga tushadi.
  const activeDevices = byDevice.filter(d => d.points.some(p => p.kwh > 0));

  const hovered = hover === null ? null : series[hover];
  const hoveredBreakdown = hover === null
    ? []
    : activeDevices
        .map(d => ({ name: d.deviceName, kwh: d.points[hover]?.kwh ?? 0 }))
        .filter(x => x.kwh > 0)
        .sort((a, b) => b.kwh - a.kwh);

  return (
    <div className="itm-card" style={{ padding: "12px 16px", minWidth: 0, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)" }}>
          {t("Sarf dinamikasi")} <span style={{ opacity: 0.7 }}>· kWh</span>
        </span>
        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text3)" }}>
          {t("Eng yuqori")}: {formatKwh(max)} kWh
        </span>
      </div>

      {series.length === 0 ? (
        <div style={{ height: CHART_H, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: 12 }}>
          {t("Ma'lumot yetarli emas")}
        </div>
      ) : (
        <>
          <div
            style={{ display: "flex", alignItems: "flex-end", gap: 2, height: CHART_H, position: "relative" }}
            onMouseLeave={() => setHover(null)}
          >
            {/* Gorizontal gridlar */}
            {[0.25, 0.5, 0.75].map(f => (
              <div
                key={f}
                style={{
                  position: "absolute", left: 0, right: 0, bottom: `${f * 100}%`,
                  height: 1, borderTop: "1px dashed var(--border)", pointerEvents: "none",
                }}
              />
            ))}

            {series.map((point, i) => {
              const totalH = max > 0 ? (point.kwh / max) * 100 : 0;
              const isHover = hover === i;

              return (
                <div
                  key={point.bucket}
                  onMouseEnter={() => setHover(i)}
                  style={{
                    flex: 1, minWidth: 0, height: "100%",
                    display: "flex", flexDirection: "column", justifyContent: "flex-end",
                    cursor: "pointer",
                    background: isHover ? "var(--surface2)" : "transparent",
                    borderRadius: "var(--radius)",
                    transition: "background 0.12s",
                  }}
                >
                  <div
                    style={{
                      height: `${totalH}%`, minHeight: point.kwh > 0 ? 2 : 0,
                      display: "flex", flexDirection: "column-reverse",
                      borderRadius: "var(--radius) var(--radius) 0 0", overflow: "hidden",
                      opacity: hover === null || isHover ? 1 : 0.55,
                      transition: "opacity 0.12s",
                    }}
                  >
                    {activeDevices.map(device => {
                      const kwh = device.points[i]?.kwh ?? 0;
                      if (kwh <= 0) return null;

                      return (
                        <div
                          key={device.deviceName}
                          style={{
                            height: `${(kwh / point.kwh) * 100}%`,
                            background: colors[device.deviceName] ?? "var(--accent)",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vaqt o'qi */}
          <div style={{ display: "flex", gap: 2, marginTop: 6 }}>
            {series.map((point, i) => (
              <span
                key={point.bucket}
                style={{
                  flex: 1, minWidth: 0, textAlign: "center",
                  fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text3)",
                  whiteSpace: "nowrap", overflow: "hidden",
                }}
              >
                {i % labelStep === 0 ? formatBucketLabel(point.bucket, bucket) : ""}
              </span>
            ))}
          </div>

          {/* Legenda */}
          {activeDevices.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
              {activeDevices.map(device => (
                <span key={device.deviceName} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: colors[device.deviceName] ?? "var(--accent)" }} />
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text2)" }}>
                    {device.deviceName}
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Tooltip */}
          {hovered && (
            <div
              style={{
                position: "absolute", top: 8, right: 16, zIndex: 3,
                background: "var(--bg3)", border: "1px solid var(--border2)",
                borderRadius: "var(--radius)", padding: "8px 11px",
                boxShadow: "var(--shadow)", pointerEvents: "none", minWidth: 150,
              }}
            >
              <div style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--text3)", marginBottom: 4 }}>
                {formatBucketLabel(hovered.bucket, bucket)}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                {formatKwh(hovered.kwh)} <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)" }}>kWh</span>
              </div>
              <div style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--accent)", marginTop: 2 }}>
                {formatMoneyFull(hovered.cost, currency)}
              </div>

              {hoveredBreakdown.length > 1 && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 3 }}>
                  {hoveredBreakdown.map(row => (
                    <div key={row.name} style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 2, background: colors[row.name] ?? "var(--accent)" }} />
                        <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--text2)" }}>{row.name}</span>
                      </span>
                      <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                        {formatKwh(row.kwh)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `DeviceDonut`**

Create `client/app/(main)/meter-data/_components/DeviceDonut.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { DeviceEnergy } from "@/lib/meterData";
import { formatKwh, formatMoneyFull, formatPercent } from "@/lib/energyFormat";
import { useT } from "@/lib/i18n";

const SIZE = 148;
const STROKE = 20;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Qurilmalarning umumiy sarfdagi ulushi. Segment bosilsa detalga o'tadi. */
export function DeviceDonut({
  devices,
  colors,
  currency,
  onSelect,
}: {
  devices: DeviceEnergy[];
  colors: Record<string, string>;
  currency: string;
  onSelect?: (device: string) => void;
}) {
  const t = useT();
  const [hover, setHover] = useState<string | null>(null);

  const active = devices.filter(d => d.kwh > 0);
  const total = active.reduce((sum, d) => sum + d.kwh, 0);
  const hovered = active.find(d => d.deviceName === hover) ?? null;

  let offset = 0;

  return (
    <div className="itm-card" style={{ padding: "12px 16px", minWidth: 0, display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 10 }}>
        {t("Qurilmalar ulushi")}
      </span>

      {total <= 0 ? (
        <div style={{ flex: 1, minHeight: SIZE, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: 12 }}>
          {t("Ma'lumot yetarli emas")}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ position: "relative", width: SIZE, height: SIZE, flexShrink: 0 }}>
            <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
              <circle
                cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
                fill="none" stroke="var(--surface2)" strokeWidth={STROKE}
              />
              {active.map(device => {
                const fraction = device.kwh / total;
                const dash = fraction * CIRCUMFERENCE;
                const circle = (
                  <circle
                    key={device.deviceName}
                    cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
                    fill="none"
                    stroke={colors[device.deviceName] ?? "var(--accent)"}
                    strokeWidth={hover === device.deviceName ? STROKE + 4 : STROKE}
                    strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                    strokeDashoffset={-offset}
                    opacity={hover === null || hover === device.deviceName ? 1 : 0.45}
                    style={{ cursor: onSelect ? "pointer" : "default", transition: "opacity 0.15s, stroke-width 0.15s" }}
                    onMouseEnter={() => setHover(device.deviceName)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => onSelect?.(device.deviceName)}
                  />
                );
                offset += dash;
                return circle;
              })}
            </svg>

            {/* Markazdagi qiymat */}
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <span style={{ fontSize: 17, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                {formatKwh(hovered ? hovered.kwh : total)}
              </span>
              <span style={{ fontSize: 9.5, color: "var(--text3)", letterSpacing: "0.06em" }}>
                {hovered ? hovered.deviceName : t("jami kWh")}
              </span>
            </div>
          </div>

          {/* Ro'yxat */}
          <div style={{ flex: 1, minWidth: 140, display: "flex", flexDirection: "column", gap: 5 }}>
            {active.slice(0, 6).map(device => (
              <button
                key={device.deviceName}
                onMouseEnter={() => setHover(device.deviceName)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(device.deviceName)}
                title={formatMoneyFull(device.cost, currency)}
                style={{
                  display: "flex", alignItems: "center", gap: 7, width: "100%",
                  background: hover === device.deviceName ? "var(--surface2)" : "transparent",
                  border: "none", borderRadius: "var(--radius)", padding: "3px 6px",
                  cursor: onSelect ? "pointer" : "default", textAlign: "left",
                  transition: "background 0.12s",
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: 2, background: colors[device.deviceName] ?? "var(--accent)", flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {device.deviceName}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                  {formatPercent(device.sharePercent)}
                </span>
              </button>
            ))}

            {active.length > 6 && (
              <span style={{ fontSize: 10.5, color: "var(--text3)", paddingLeft: 6 }}>
                +{active.length - 6} {t("qurilma")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire the charts into `page.tsx`**

`client/app/(main)/meter-data/page.tsx`:

Mavjud React importiga `useMemo` ni **qo'shing** (ikkinchi `from "react"` qatori yaratmang):

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
```

Va yangi importlarni qo'shing:

```tsx
import { buildDeviceColorMap } from "@/lib/energyFormat";
import { EnergyBarChart } from "./_components/EnergyBarChart";
import { DeviceDonut } from "./_components/DeviceDonut";
```

`canEditTariff` dan keyin rang xaritasini qo'shing:

```tsx
  // Rang qurilma nomi bo'yicha barqaror — tartib o'zgarganda sakramaydi.
  const deviceColors = useMemo(
    () => buildDeviceColorMap((summary?.devices ?? []).map(d => d.deviceName)),
    [summary],
  );
```

`{/* Task 15: grafiklar ... */}` izohini almashtiring:

```tsx
      {summary && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <EnergyBarChart
            series={summary.series}
            byDevice={summary.byDevice}
            bucket={summary.bucket}
            currency={summary.currency}
            colors={deviceColors}
          />
          <DeviceDonut
            devices={summary.devices}
            colors={deviceColors}
            currency={summary.currency}
            onSelect={setSelectedDevice}
          />
        </div>
      )}
```

- [ ] **Step 5: Verify types, lint and the charts in the browser**

Run (`client/` papkasidan):
```bash
npx tsc --noEmit
npm run lint
```
Expected: xatosiz.

Brauzerda tekshiring:
- Ustunli grafik davrga mos yorliqlar bilan chiqadi (soatlik → `14:00`, kunlik → `11-avg`)
- Ustun ustiga kursor olib borilganda tooltip kWh + so'm ko'rsatadi
- Donutda ulushlar foizda, segment bosilganda hozircha faqat `selectedDevice` o'zgaradi (ko'rinish Task 16 da)
- Dark va light rejimda ranglar o'qiladi

- [ ] **Step 6: Commit**

```bash
git add client/app/\(main\)/meter-data/_components/Sparkline.tsx \
        client/app/\(main\)/meter-data/_components/EnergyBarChart.tsx \
        client/app/\(main\)/meter-data/_components/DeviceDonut.tsx \
        client/app/\(main\)/meter-data/page.tsx
git commit -m "feat(energy): sarf dinamikasi va qurilmalar ulushi grafiklari"
```

---

## Task 16: Qurilma kartalari va detal ko'rinishi

**Files:**
- Create: `client/app/(main)/meter-data/_components/DeviceGrid.tsx`
- Create: `client/app/(main)/meter-data/_components/DeviceDetail.tsx`
- Modify: `client/app/(main)/meter-data/page.tsx`

**Interfaces:**
- Consumes: `DeviceEnergy`, `DeviceEnergyDetail`, `MeterReading` (Task 13); `Sparkline` (Task 15); `EnergyBarChart` (Task 15); `LiveCharts`, `ReadingsTable` (Task 14)
- Produces:
  - `DeviceGrid` props: `{ devices: DeviceEnergy[]; colors: Record<string, string>; currency: string; onSelect: (device: string) => void }`
  - `DeviceDetail` props: `{ detail: DeviceEnergyDetail | null; readings: MeterReading[]; loading: boolean; error: string; colors: Record<string, string>; onBack: () => void }`
  - `agoLabel(iso, t)` — `DeviceGrid.tsx` da `export` qilinadi, `DeviceDetail` uni import qiladi

- [ ] **Step 1: Create `DeviceGrid`**

Create `client/app/(main)/meter-data/_components/DeviceGrid.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import type { DeviceEnergy } from "@/lib/meterData";
import { formatKwh, formatMoney, formatMoneyFull, formatPercent, formatPower } from "@/lib/energyFormat";
import { useT } from "@/lib/i18n";
import { Sparkline } from "./Sparkline";

/** Necha soniya/daqiqa oldin kelgani — "jonli"likni ko'rsatadi. */
export function agoLabel(iso: string, t: (s: string) => string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `${diff} ${t("soniya oldin")}`;
  if (diff < 3600) return `${Math.floor(diff / 60)} ${t("daqiqa oldin")}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ${t("soat oldin")}`;
  return `${Math.floor(diff / 86400)} ${t("kun oldin")}`;
}

type SortKey = "kwh" | "power" | "name";

/** Onlayn/oflayn nuqtasi. */
function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      style={{
        width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
        background: online ? "var(--success)" : "var(--text3)",
        animation: online ? "dotPulse 1.6s infinite" : "none",
      }}
    />
  );
}

export function DeviceGrid({
  devices,
  colors,
  currency,
  onSelect,
}: {
  devices: DeviceEnergy[];
  colors: Record<string, string>;
  currency: string;
  onSelect: (device: string) => void;
}) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("kwh");

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? devices.filter(d => d.deviceName.toLowerCase().includes(query))
      : devices;

    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.deviceName.localeCompare(b.deviceName);
      if (sort === "power") return (b.lastPowerW ?? -1) - (a.lastPowerW ?? -1);
      return b.kwh - a.kwh;
    });
  }, [devices, search, sort]);

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Sarlavha + boshqaruv */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)" }}>
          {t("Qurilmalar")} <span style={{ opacity: 0.7 }}>· {devices.length}</span>
        </span>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t("Qidirish...")}
          style={{
            width: 180, background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: "5px 10px", fontSize: 12.5,
            color: "var(--text)", outline: "none",
          }}
        />

        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: "5px 8px", fontSize: 12.5,
            color: "var(--text2)", outline: "none", cursor: "pointer",
          }}
        >
          <option value="kwh">{t("Sarf bo'yicha")}</option>
          <option value="power">{t("Quvvat bo'yicha")}</option>
          <option value="name">{t("Nom bo'yicha")}</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="itm-card" style={{ padding: 28, textAlign: "center", color: "var(--text3)", fontSize: 12.5 }}>
          {t("Qurilma topilmadi.")}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
          {visible.map((device, i) => {
            const color = colors[device.deviceName] ?? "var(--accent)";
            const [powerValue, powerUnit] = formatPower(device.lastPowerW);

            return (
              <button
                key={device.deviceName}
                onClick={() => onSelect(device.deviceName)}
                className={`itm-card nd-fadein-${Math.min(i, 4)}`}
                style={{
                  padding: "12px 14px", textAlign: "left", cursor: "pointer",
                  display: "flex", flexDirection: "column", gap: 8,
                  borderLeft: `3px solid ${color}`,
                  transition: "transform 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {/* Nom + holat */}
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <StatusDot online={device.isOnline} />
                  <span style={{
                    flex: 1, fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)",
                    color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {device.deviceName}
                  </span>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text3)" }}>
                    {formatPercent(device.sharePercent)}
                  </span>
                </div>

                {/* Hozirgi quvvat */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{
                    fontSize: 20, fontWeight: 700, fontFamily: "var(--font-mono)",
                    color: device.isOnline ? "var(--text)" : "var(--text3)",
                  }}>
                    {device.isOnline ? powerValue : t("Oflayn")}
                  </span>
                  {device.isOnline && (
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>{powerUnit}</span>
                  )}
                </div>

                <Sparkline values={device.sparkline} color={color} />

                {/* Energiya + xarajat */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text2)" }}>
                    {formatKwh(device.kwh)} <span style={{ fontSize: 9.5, color: "var(--text3)" }}>kWh</span>
                  </span>
                  <span
                    title={formatMoneyFull(device.cost, currency)}
                    style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--accent)" }}
                  >
                    {formatMoney(device.cost)} <span style={{ fontSize: 9.5, fontWeight: 400, color: "var(--text3)" }}>{currency}</span>
                  </span>
                </div>

                {/* Oxirgi ko'rilgan */}
                <span style={{ fontSize: 10, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                  {device.lastSeen ? agoLabel(device.lastSeen, t) : t("Ma'lumot kelmagan")}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `DeviceDetail`**

Create `client/app/(main)/meter-data/_components/DeviceDetail.tsx`:

```tsx
"use client";

import type { DeviceEnergyDetail, MeterReading } from "@/lib/meterData";
import { formatKwh, formatMoney, formatMoneyFull, formatPercent, formatPower } from "@/lib/energyFormat";
import { useT } from "@/lib/i18n";
import { EnergyBarChart } from "./EnergyBarChart";
import { LiveCharts } from "./LiveCharts";
import { ReadingsTable } from "./ReadingsTable";
import { agoLabel } from "./DeviceGrid";

/** Detaldagi kichik ko'rsatkich. */
function Metric({ label, value, unit, accent, title }: {
  label: string; value: string; unit?: string; accent?: string; title?: string;
}) {
  return (
    <div className="itm-card" title={title} style={{ padding: "10px 14px", flex: 1, minWidth: 130 }}>
      <p style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 3 }}>
        {label}
      </p>
      <p style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: accent ?? "var(--text)", lineHeight: 1.15 }}>
        {value}
        {unit && <span style={{ fontSize: 10.5, fontWeight: 500, color: "var(--text3)", marginLeft: 3 }}>{unit}</span>}
      </p>
    </div>
  );
}

export function DeviceDetail({
  detail,
  readings,
  loading,
  error,
  colors,
  onBack,
}: {
  detail: DeviceEnergyDetail | null;
  readings: MeterReading[];
  loading: boolean;
  error: string;
  colors: Record<string, string>;
  onBack: () => void;
}) {
  const t = useT();

  if (!detail) {
    return (
      <div className="itm-card" style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>
        {loading ? t("Yuklanmoqda...") : error || t("Qurilma topilmadi.")}
      </div>
    );
  }

  const color = colors[detail.deviceName] ?? "var(--accent)";
  const [avgValue, avgUnit] = formatPower(detail.avgPowerW);
  const [peakValue, peakUnit] = formatPower(detail.peakPowerW);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 8, animation: "panel-appear 0.28s ease" }}>
      {/* Sarlavha */}
      <div className="itm-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", flexWrap: "wrap" }}>
        <button
          onClick={onBack}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px",
            background: "transparent", border: "1px solid var(--border2)", borderRadius: "var(--radius)",
            color: "var(--text2)", fontSize: 12, cursor: "pointer", transition: "all 0.15s",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {t("Orqaga")}
        </button>

        <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} />

        <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
          {detail.deviceName}
        </span>

        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999,
          background: detail.isOnline ? "var(--success-dim)" : "var(--surface2)",
          color: detail.isOnline ? "var(--success)" : "var(--text3)",
          fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: detail.isOnline ? "var(--success)" : "var(--text3)",
            animation: detail.isOnline ? "dotPulse 1.6s infinite" : "none",
          }} />
          {detail.isOnline ? t("Onlayn") : t("Oflayn")}
        </span>

        {detail.lastSeen && (
          <span style={{ fontSize: 11.5, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
            {t("Oxirgi yozuv")}: {agoLabel(detail.lastSeen, t)}
          </span>
        )}
      </div>

      {/* Ko'rsatkichlar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Metric label={t("Sarflangan energiya")} value={formatKwh(detail.kwh)} unit="kWh" />
        <Metric
          label={t("Xarajat")}
          value={formatMoney(detail.cost)}
          unit={detail.currency}
          accent="var(--accent)"
          title={formatMoneyFull(detail.cost, detail.currency)}
        />
        <Metric label={t("O'rtacha quvvat")} value={avgValue} unit={avgUnit} />
        <Metric label={t("Eng yuqori quvvat")} value={peakValue} unit={peakUnit} />
        <Metric
          label={t("Ish vaqti")}
          value={formatPercent(detail.uptimePercent, 1)}
          accent={detail.uptimePercent >= 95 ? "var(--success)" : detail.uptimePercent >= 60 ? "var(--warn)" : "var(--danger)"}
        />
        <Metric
          label={t("O'rtacha kuchlanish")}
          value={detail.avgVoltage.toFixed(1)}
          unit="V"
          title={`${t("Eng past")}: ${detail.minVoltage.toFixed(1)} V · ${t("Eng yuqori")}: ${detail.maxVoltage.toFixed(1)} V`}
        />
      </div>

      {/* Davr bo'yicha energiya */}
      <EnergyBarChart
        series={detail.series.map(p => ({ bucket: p.bucket, kwh: p.kwh, cost: p.cost }))}
        byDevice={[{
          deviceName: detail.deviceName,
          points: detail.series.map(p => ({ bucket: p.bucket, kwh: p.kwh, cost: p.cost })),
        }]}
        bucket={detail.bucket}
        currency={detail.currency}
        colors={colors}
      />

      {/* Jonli grafiklar */}
      <LiveCharts readings={readings} />

      {/* Xom o'lchovlar */}
      <ReadingsTable items={readings} loading={loading} error={error} showDeviceColumn={false} />
    </div>
  );
}
```

- [ ] **Step 3: Wire both views into `page.tsx`**

`client/app/(main)/meter-data/page.tsx`:

Importlarga qo'shing:

```tsx
import type { DeviceEnergyDetail } from "@/lib/meterData";
import { DeviceGrid } from "./_components/DeviceGrid";
import { DeviceDetail } from "./_components/DeviceDetail";
import { LiveCharts } from "./_components/LiveCharts";
```

`summary` state yonida detal holatini qo'shing:

```tsx
  const [detail, setDetail] = useState<DeviceEnergyDetail | null>(null);
```

`loadSummary` dan keyin detal yuklovchini qo'shing:

```tsx
  const loadDetail = useCallback(async () => {
    const device = deviceRef.current;
    if (!device) { setDetail(null); return; }
    setDetail(await meterDataService.getDeviceDetail(device, periodRef.current));
  }, []);
```

`loadAll` ni yangilang:

```tsx
  const loadAll = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      await Promise.all([loadLive(), loadSummary(), loadDetail()]);
    } catch {
      setError(t("Hisoblagich ma'lumotlarini yuklashda xatolik."));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [loadLive, loadSummary, loadDetail, t]);
```

Jonli intervalda ham detalni yangilang:

```tsx
    const summaryId = setInterval(() => {
      loadSummary().catch(() => {});
      loadDetail().catch(() => {});
    }, SUMMARY_POLL_MS);
```

va `useEffect` bog'liqliklariga `loadDetail` ni qo'shing.

Nihoyat, `KpiRow` dan keyingi butun blokni (grafiklar, jadval) ikki ko'rinishga bo'ling:

```tsx
      {selectedDevice ? (
        <DeviceDetail
          detail={detail}
          readings={readings}
          loading={loading}
          error={error}
          colors={deviceColors}
          onBack={() => setSelectedDevice(null)}
        />
      ) : (
        <>
          {summary && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <EnergyBarChart
                series={summary.series}
                byDevice={summary.byDevice}
                bucket={summary.bucket}
                currency={summary.currency}
                colors={deviceColors}
              />
              <DeviceDonut
                devices={summary.devices}
                colors={deviceColors}
                currency={summary.currency}
                onSelect={setSelectedDevice}
              />
            </div>
          )}

          {summary && (
            <DeviceGrid
              devices={summary.devices}
              colors={deviceColors}
              currency={summary.currency}
              onSelect={setSelectedDevice}
            />
          )}

          <ReadingsTable items={readings} loading={loading} error={error} showDeviceColumn />
        </>
      )}
```

> `LiveCharts` importi umumiy ko'rinishda ishlatilmaydi — u faqat `DeviceDetail` ichida. Agar `page.tsx` ga import qilinib ishlatilmasa, lint ogohlantiradi: importni **qo'shmang**, faqat `DeviceDetail.tsx` ichida qoldiring.

- [ ] **Step 4: Verify types, lint and both views in the browser**

Run (`client/` papkasidan):
```bash
npx tsc --noEmit
npm run lint
```
Expected: xatosiz.

Brauzerda tekshiring:
- Qurilma kartalari grid ko'rinishida, chap chekkasida qurilma rangi, ichida sparkline
- Qidiruv va saralash ishlaydi
- Karta bosilganda detal ochiladi (`panel-appear` animatsiyasi bilan), `← Orqaga` qaytaradi
- Detalda 6 ta ko'rsatkich, energiya bar chart, 4 ta jonli line chart va faqat shu qurilmaning jadvali ko'rinadi
- Detalda davr tugmalarini almashtirish ishlaydi

- [ ] **Step 5: Commit**

```bash
git add client/app/\(main\)/meter-data/
git commit -m "feat(energy): qurilma kartalari va batafsil ko'rinish"
```

---

## Task 17: Tarif modali, i18n va yakuniy tekshiruv

**Files:**
- Create: `client/app/(main)/meter-data/_components/TariffModal.tsx`
- Modify: `client/app/(main)/meter-data/page.tsx`
- Modify: `client/lib/i18n/ru.ts`

**Interfaces:**
- Consumes: `energyTariffService`, `EnergyTariff`, `EnergyTariffSave` (Task 13)
- Produces: `TariffModal` props: `{ canEdit: boolean; onClose: () => void; onSaved: () => void }`

- [ ] **Step 1: Create `TariffModal`**

Create `client/app/(main)/meter-data/_components/TariffModal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { energyTariffService, type EnergyTariff } from "@/lib/energyTariff";
import { formatMoneyFull } from "@/lib/energyFormat";
import { useToastStore } from "@/lib/store/toastStore";
import { useT } from "@/lib/i18n";

/** Bo'sh forma — yangi tarif uchun bugungi sana bilan. */
function emptyForm() {
  return {
    id: null as string | null,
    pricePerKwh: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    note: "",
  };
}

export function TariffModal({
  canEdit,
  onClose,
  onSaved,
}: {
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const toast = useToastStore(s => s.show);

  const [tariffs, setTariffs] = useState<EnergyTariff[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setTariffs(await energyTariffService.getAll());
    } catch {
      toast(t("Tariflarni yuklashda xatolik."), "error");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const save = async () => {
    const price = Number(form.pricePerKwh);

    if (!Number.isFinite(price) || price <= 0) {
      toast(t("Narx noldan katta bo'lishi kerak."), "error");
      return;
    }

    try {
      setSaving(true);
      const dto = {
        pricePerKwh: price,
        currency: "so'm",
        effectiveFrom: form.effectiveFrom,
        note: form.note.trim() || null,
      };

      if (form.id) await energyTariffService.update(form.id, dto);
      else await energyTariffService.create(dto);

      toast(t("Tarif saqlandi."), "success");
      setForm(emptyForm());
      await load();
      onSaved();
    } catch {
      toast(t("Tarifni saqlashda xatolik."), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (tariff: EnergyTariff) => {
    try {
      await energyTariffService.remove(tariff.id);
      toast(t("Tarif o'chirildi."), "success");
      await load();
      onSaved();
    } catch {
      toast(t("Tarifni o'chirishda xatolik."), "error");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="itm-card"
        style={{
          width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto",
          padding: 20, animation: "panel-appear 0.28s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h2 className="font-head-itm" style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
              {t("Elektr tariflari")}
            </h2>
            <p style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 2 }}>
              {t("Har tarif o'z sanasidan keyingi tarif kelguncha amal qiladi.")}
            </p>
          </div>

          <button
            onClick={onClose}
            className="btn-icon"
            title={t("Yopish")}
            style={{ width: 30, height: 30 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Ro'yxat */}
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text2)", fontSize: 12.5 }}>
            {t("Yuklanmoqda...")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: canEdit ? 18 : 0 }}>
            {tariffs.map(tariff => (
              <div
                key={tariff.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                  background: "var(--surface2)", borderRadius: "var(--radius)",
                }}
              >
                <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text3)", width: 92, flexShrink: 0 }}>
                  {tariff.effectiveFrom.slice(0, 10)}
                </span>

                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                  {formatMoneyFull(tariff.pricePerKwh, tariff.currency)}
                  <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text3)", marginLeft: 4 }}>/ kWh</span>
                </span>

                {tariff.note && (
                  <span
                    title={tariff.note}
                    style={{ fontSize: 11, color: "var(--text3)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {tariff.note}
                  </span>
                )}

                {canEdit && (
                  <>
                    <button
                      onClick={() => setForm({
                        id: tariff.id,
                        pricePerKwh: String(tariff.pricePerKwh),
                        effectiveFrom: tariff.effectiveFrom.slice(0, 10),
                        note: tariff.note ?? "",
                      })}
                      className="btn-icon"
                      title={t("Tahrirlash")}
                      style={{ width: 26, height: 26 }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>

                    <button
                      onClick={() => remove(tariff)}
                      className="btn-icon"
                      title={t("O'chirish")}
                      style={{ width: 26, height: 26, color: "var(--danger)" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            ))}

            {tariffs.length === 0 && (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: 12.5 }}>
                {t("Tarif kiritilmagan.")}
              </div>
            )}
          </div>
        )}

        {/* Forma */}
        {canEdit && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 8 }}>
              {form.id ? t("Tarifni tahrirlash") : t("Yangi tarif")}
            </p>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <input
                type="number"
                min={0}
                value={form.pricePerKwh}
                onChange={e => setForm(f => ({ ...f, pricePerKwh: e.target.value }))}
                placeholder={t("Narx (so'm / kWh)")}
                style={{
                  flex: 1, minWidth: 150, background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", padding: "7px 10px", fontSize: 13,
                  fontFamily: "var(--font-mono)", color: "var(--text)", outline: "none",
                }}
              />

              <input
                type="date"
                value={form.effectiveFrom}
                onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))}
                style={{
                  width: 160, background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", padding: "7px 10px", fontSize: 13,
                  fontFamily: "var(--font-mono)", color: "var(--text)", outline: "none",
                }}
              />
            </div>

            <input
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder={t("Izoh (ixtiyoriy)")}
              style={{
                width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: "7px 10px", fontSize: 13,
                color: "var(--text)", outline: "none", marginBottom: 10,
              }}
            />

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              {form.id && (
                <button
                  onClick={() => setForm(emptyForm())}
                  style={{
                    padding: "7px 14px", background: "transparent", border: "1px solid var(--border2)",
                    borderRadius: "var(--radius)", color: "var(--text2)", fontSize: 12.5, cursor: "pointer",
                  }}
                >
                  {t("Bekor qilish")}
                </button>
              )}

              <button
                onClick={save}
                disabled={saving}
                style={{
                  padding: "7px 16px", background: "var(--accent)", border: "none",
                  borderRadius: "var(--radius)", color: "#fff", fontSize: 12.5, fontWeight: 600,
                  cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? t("Saqlanmoqda...") : t("Saqlash")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

> `useToastStore` chaqirish shakli (`s => s.show`) va toast argumentlari loyihada boshqacha bo'lishi mumkin — `client/lib/store/toastStore.ts` ni ochib mavjud API'ga moslang (masalan `s.push` yoki `showToast(message, type)`). Boshqa toast ishlatuvchi sahifadan (`requisitions`) nusxa oling.

- [ ] **Step 2: Wire the modal into `page.tsx`**

Importlarga qo'shing:

```tsx
import { TariffModal } from "./_components/TariffModal";
```

`{tariffOpen && null}` ni almashtiring:

```tsx
      {tariffOpen && (
        <TariffModal
          canEdit={canEditTariff}
          onClose={() => setTariffOpen(false)}
          onSaved={() => loadAll(true)}
        />
      )}
```

- [ ] **Step 3: Add the Russian translations**

`client/lib/i18n/ru.ts` — `// Hisoblagichlar (meter-data) sahifasi` bo'limiga qo'shing:

```ts
  "Sarf dinamikasi": "Динамика потребления",
  "Qurilmalar ulushi": "Доля устройств",
  "Sarflangan energiya": "Потреблённая энергия",
  "Xarajat": "Затраты",
  "Hozirgi quvvat": "Текущая мощность",
  "Eng yuqori quvvat": "Пиковая мощность",
  "Eng yuqori": "Максимум",
  "Eng past": "Минимум",
  "Pik vaqti": "Время пика",
  "onlayn": "онлайн",
  "Onlayn": "Онлайн",
  "Oflayn": "Офлайн",
  "Bugun": "Сегодня",
  "24 soat": "24 часа",
  "7 kun": "7 дней",
  "30 kun": "30 дней",
  "Oy": "Месяц",
  "Joriy tarif": "Текущий тариф",
  "Tarifni o'zgartirish": "Изменить тариф",
  "Tarif belgilanmagan": "Тариф не задан",
  "Elektr tariflari": "Тарифы на электроэнергию",
  "Har tarif o'z sanasidan keyingi tarif kelguncha amal qiladi.":
    "Каждый тариф действует с указанной даты до следующего тарифа.",
  "Yangi tarif": "Новый тариф",
  "Tarifni tahrirlash": "Редактировать тариф",
  "Narx (so'm / kWh)": "Цена (сум / кВт·ч)",
  "Izoh (ixtiyoriy)": "Примечание (необязательно)",
  "Tarif kiritilmagan.": "Тарифы не заданы.",
  "Tarif saqlandi.": "Тариф сохранён.",
  "Tarif o'chirildi.": "Тариф удалён.",
  "Tariflarni yuklashda xatolik.": "Ошибка загрузки тарифов.",
  "Tarifni saqlashda xatolik.": "Ошибка сохранения тарифа.",
  "Tarifni o'chirishda xatolik.": "Ошибка удаления тарифа.",
  "Narx noldan katta bo'lishi kerak.": "Цена должна быть больше нуля.",
  "Sarf bo'yicha": "По потреблению",
  "Quvvat bo'yicha": "По мощности",
  "Nom bo'yicha": "По имени",
  "Qurilma topilmadi.": "Устройство не найдено.",
  "Ma'lumot kelmagan": "Данных не поступало",
  "kun oldin": "дн. назад",
  "qurilma": "устройств",
  "Orqaga": "Назад",
  "O'rtacha quvvat": "Средняя мощность",
  "O'rtacha kuchlanish": "Среднее напряжение",
  "Ish vaqti": "Время работы",
  "Oxirgi yozuv": "Последняя запись",
  "Saqlanmoqda...": "Сохранение...",
```

> Bu satrlardan ba'zilari (`"Yuklanmoqda..."`, `"Saqlash"`, `"Bekor qilish"`, `"Yopish"`, `"Qidirish..."`, `"Tahrirlash"`, `"O'chirish"`, `"Qurilmalar"`, `"soniya oldin"`, `"daqiqa oldin"`, `"soat oldin"`, `"Jonli"`, `"To'xtatilgan"`, `"Yangilash"`, `"Yangilandi"`, `"Sana"`, `"T/r"`, `"Kuchlanish"`, `"Tok"`, `"Quvvat"`, `"Chastota"`, `"Ma'lumot yetarli emas"`) `ru.ts` da allaqachon bo'lishi mumkin — takrorlanmasin, qo'shishdan oldin faylni qidirib chiqing.

- [ ] **Step 4: Verify the frontend end to end**

Run (`client/` papkasidan):
```bash
npx tsc --noEmit
npm run lint
npm run build
```
Expected: uchalasi ham xatosiz.

- [ ] **Step 5: Verify the backend end to end**

Run (`Back/` papkasidan):
```bash
dotnet build Back.sln
dotnet test test/Application.Tests/Application.Tests.csproj
```
Expected: build muvaffaqiyatli; **barcha** testlar PASS (yangi ~53 ta test + mavjud 307 ta).

- [ ] **Step 6: Manual acceptance walkthrough**

Backend va frontendni ishga tushirib, brauzerda `http://localhost:3000/meter-data` ni tekshiring:

| # | Tekshiruv | Kutilgan |
|---|---|---|
| 1 | Davr tugmalarini almashtirish | KPI, grafik va kartalar qayta yuklanadi |
| 2 | Grafik ustuniga hover | Tooltipda kWh, so'm va qurilmalar taqsimoti |
| 3 | Donut segmentini bosish | O'sha qurilma detali ochiladi |
| 4 | Qurilma kartasini bosish | Detal ochiladi, `← Orqaga` qaytaradi |
| 5 | Detalda davr almashtirish | Detal ma'lumoti yangilanadi |
| 6 | Tarif chipini bosish (`Energy.Update` bilan) | Modal ochiladi, tarif qo'shish/tahrirlash ishlaydi |
| 7 | Tarif chipini bosish (ruxsatsiz foydalanuvchi) | Chip bosilmaydi, tahrir tugmalari yo'q |
| 8 | Tarifni o'zgartirish | Modal yopilgach xarajat yangi narx bilan qayta hisoblanadi |
| 9 | Rus tiliga o'tish (`/appearance`) | Barcha yangi matn ruschada |
| 10 | Dark ↔ light almashtirish | Ranglar, grafik va donut o'qiladi |
| 11 | Jonli toggle'ni o'chirish | Yangilanish to'xtaydi, `Yangilandi` vaqti qotadi |
| 12 | Oyna kengligini kichraytirish | Grafik va kartalar gorizontal scroll qilmaydi |

- [ ] **Step 7: Verify the permission gate manually**

Spec §7 da `Energy.Update` siz tarif yozishga urinish `403` qaytarishi integration test sifatida ko'zda tutilgan edi. Loyihada controller darajasidagi test infratuzilmasi yo'q (`Application.Tests` faqat servis qatlamini qamraydi), shuning uchun bu **qo'lda** tekshiriladi:

1. `/roles` sahifasida biror rolga **"Elektr energiya → Tahrirlash"** ruxsatini bering — shu rol bilan kirib tarif modalining tahrir rejimi ochilishini tasdiqlang.
2. Ruxsatsiz foydalanuvchi bilan kirib, Swagger yoki `curl` orqali `POST /api/energy-tariffs` yuboring — HTTP **403** kelishi kerak.

- [ ] **Step 8: Commit**

```bash
git add client/app/\(main\)/meter-data/_components/TariffModal.tsx \
        client/app/\(main\)/meter-data/page.tsx \
        client/lib/i18n/ru.ts
git commit -m "feat(energy): tarif modali va ruscha tarjimalar"
```

---

## Yakuniy holat

Bajarilgandan keyin:

- `/meter-data` — barcha qurilmalar bo'yicha energiya va xarajat paneli, qurilma kartasi bosilganda detal
- `GET /api/meter-data/summary`, `/summary/{device}`, boyitilgan `/devices`
- `GET/POST/PUT/DELETE /api/energy-tariffs` — yozish `Energy.Update` ruxsati bilan
- `MeterEnergyHourly` soatlik rollup + `EnergyRollupBackgroundService`
- `MeterPoller:Devices[]` — 20+ qurilmani parallel o'qishga tayyor

**Keyingi qadamlar uchun ochiq qolgan (spec §8):** Excel/PDF eksport, pik quvvat ogohlantirishlari, reaktiv quvvat va `cos φ`, xom yozuvlarni arxivlash siyosati, limitdan oshgan sarf uchun oshirilgan koeffitsient.
