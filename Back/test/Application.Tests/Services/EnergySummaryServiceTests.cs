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

    [Fact]
    public async Task GetSummaryAsync_CurrentHourAnchorSampleAffectsKwhButNotStats()
    {
        // Arrange — soat boshidan oldingi "anchor" namuna (yuqori quvvat) energiya
        // integraliga qo'shilishi kerak, lekin soat statistikasiga (Peak/Avg) kirmasligi kerak —
        // ular faqat soat ICHIDAGI namunalardan hisoblanadi.
        await using var db = TestDbContextFactory.Create();
        SeedTariff(db);
        var hourStart = new DateTime(2026, 8, 11, 9, 0, 0, DateTimeKind.Utc);
        SeedReading(db, "DR134", hourStart.AddSeconds(-10), 9000); // anchor: soatdan oldin
        SeedReading(db, "DR134", hourStart.AddSeconds(20), 1000);  // soat ichida
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetSummaryAsync("24h");

        // Assert
        var device = result.Result!.Devices.Single(d => d.DeviceName == "DR134");

        // kWh: trapetsiya (9000+1000)/2 W * 30 s = 150 000 W·s ≈ 0.0416667 kWh —
        // anchor namuna integralga hisobga olingan.
        device.Kwh.Should().BeApproximately(150_000d / 3_600_000d, 1e-6);

        // Peak faqat soat ICHIDAGI yagona namunadan (1000 W) — anchor (9000 W) chiqarib
        // tashlanadi. Agar statistikaga anchor ham kirsa, bu qiymat 9000 bo'lardi.
        device.PeakPowerW.Should().Be(1000);
    }

    [Fact]
    public async Task GetSummaryAsync_PricesEachHourAtItsOwnTariff_WhenTariffChangesMidPeriod()
    {
        // Arrange — eski tarif (1000) va davr ichida kiritilgan yangi tarif (2500)
        await using var db = TestDbContextFactory.Create();
        SeedTariff(db, 1000m); // EffectiveFrom = 2026-06-01, hali yangi tarif kirmagan
        db.EnergyTariffs.Add(new EnergyTariff
        {
            Id = Guid.NewGuid(),
            PricePerKwh = 2500m,
            Currency = "so'm",
            EffectiveFrom = Now.AddHours(-2),
        });
        db.SaveChanges();

        SeedHour(db, "DR134", Now.AddHours(-3), 2.0); // eski tarif (1000) ostida
        SeedHour(db, "DR134", Now.AddHours(-2), 3.0); // yangi tarif (2500) ostida
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetSummaryAsync("24h");

        // Assert — har soat o'z tarifi bilan hisoblanadi: 2×1000 + 3×2500 = 9 500 so'm.
        // Agar xato ravishda "jami kWh × oxirgi narx" hisoblansa, natija 5×2500 = 12 500 bo'lardi.
        result.Result!.Total.Cost.Should().Be(9_500m);
    }
}
