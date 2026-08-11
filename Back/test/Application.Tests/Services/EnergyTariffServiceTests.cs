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
