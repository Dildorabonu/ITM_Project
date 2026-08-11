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
