using Application.Helpers;
using FluentAssertions;
using Xunit;

namespace Application.Tests.Helpers;

public class NormAllowanceTests
{
    [Theory]
    [InlineData(75, "кг", 3, 77.25)]
    [InlineData(0.007, "кг", 3, 0.0073)]
    [InlineData(416.625, "кг", 3, 429.1238)]
    [InlineData(10, "м2", 2.5, 10.25)]
    [InlineData(1, "шт", 3, 1)]
    [InlineData(14, "шт", 3, 14)]
    [InlineData(1000, "шт", 3, 1030)]
    [InlineData(7, " ШТ. ", 3, 7)]
    [InlineData(17, "дона", 3, 18)]
    [InlineData(50, "Dona", 3, 52)]
    [InlineData(1.5, "шт", 3, 2)]
    [InlineData(1.4, "шт", 3, 1.4)]
    public void Apply_RaisesByPercent_RoundingPiecesToNearestNotBelowNorm(double quantity, string unit, double percent, double expected)
    {
        NormAllowance.Apply((decimal)quantity, unit, (decimal)percent).Should().Be((decimal)expected);
    }

    [Fact]
    public void Apply_ZeroPercent_ReturnsQuantityUnchanged()
    {
        NormAllowance.Apply(14.5m, "шт", 0m).Should().Be(14.5m);
    }

    [Fact]
    public void Apply_ZeroPercent_RoundsUpToStoredScale()
    {
        NormAllowance.Apply(0.00021m, "кг", 0m).Should().Be(0.0003m);
    }

    [Theory]
    [InlineData("шт", true)]
    [InlineData("шт.", true)]
    [InlineData(" ШТ ", true)]
    [InlineData("дона", true)]
    [InlineData("dona", true)]
    [InlineData("кг", false)]
    [InlineData("м2", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsPieceUnit_RecognisesPieceSpellings(string? unit, bool expected)
    {
        NormAllowance.IsPieceUnit(unit).Should().Be(expected);
    }
}
