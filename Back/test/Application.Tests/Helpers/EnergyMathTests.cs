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
