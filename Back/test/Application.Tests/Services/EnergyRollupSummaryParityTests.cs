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

/// <summary>
/// Rollup (tugallangan soatlar) va "jonli" joriy soat yo'li bitta soat uchun
/// bir xil kWh berishi kerak. Ikkalasi ham xom o'lchovlardan hisoblaydi, faqat
/// turli kodda — shu sababli ular orasidagi farq panelda ko'rinadigan xatoga
/// aylanadi (davr yig'indisi soatdan soatga "sakraydi").
/// </summary>
public class EnergyRollupSummaryParityTests
{
    private static readonly DateTime Hour10 = new(2026, 8, 11, 10, 0, 0, DateTimeKind.Utc);

    /// <summary>"Hozir" — soat ichida, ya'ni 10:00 hali tugallanmagan joriy soat.</summary>
    private static readonly DateTime Now = Hour10.AddMinutes(30);

    private static void SeedReading(DatabaseContext db, DateTime at, double powerW)
    {
        db.MeterReadings.Add(new MeterReading
        {
            Id = Guid.NewGuid(),
            DeviceName = "DR134",
            VoltagePhaseA = 230,
            CurrentPhaseA = powerW / 230,
            ActivePower = powerW,
            Frequency = 50,
            CreatedAt = at,
        });
    }

    [Fact]
    public async Task CurrentHourLivePath_MatchesRollup_ForTheSameHour()
    {
        // Arrange — soat boshidan OLDINGI 60 soniyada bir nechta namuna bor
        // (anchor oynasi to'la). Ular 09:00 soatiga tegishli energiyani beradi;
        // 10:00 ga faqat oxirgi anchor va soat ichidagi namunalar qo'shilishi kerak.
        await using var db = TestDbContextFactory.Create();

        for (var offset = -60; offset < 0; offset += 3)
            SeedReading(db, Hour10.AddSeconds(offset), 9000);

        for (var offset = 0; offset <= 30 * 60; offset += 3)
            SeedReading(db, Hour10.AddSeconds(offset), 1000);

        await db.SaveChangesAsync();

        var rollup = new EnergyRollupService(db, () => Now);
        var summary = new EnergySummaryService(
            db,
            OptionsHelper.Wrap(new MeterPollerOptions { Enabled = true, IntervalSeconds = 3 }),
            () => Now);

        // Act — rollup 10:00 soatini yozadi; summary esa 10:00 ni joriy soat
        // sifatida xom o'lchovlardan qayta hisoblaydi (rollup qatorini o'qimaydi).
        await rollup.RollupRangeAsync(Hour10, Now);
        var rollupKwh = (await db.MeterEnergyHourly.SingleAsync(r => r.HourUtc == Hour10)).Kwh;

        var result = await summary.GetSummaryAsync("24h");

        // Assert — ikkala yo'l bir xil qiymat berishi shart.
        result.Succeeded.Should().BeTrue();
        result.Result!.Total.Kwh.Should().BeApproximately(rollupKwh, 1e-9);
    }
}
