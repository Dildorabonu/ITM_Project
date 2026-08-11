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
