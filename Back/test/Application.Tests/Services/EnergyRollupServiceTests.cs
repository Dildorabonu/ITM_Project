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
