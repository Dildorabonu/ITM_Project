using Application.DTOs.Requisitions;
using Application.Services.Impl;
using Application.Tests.Infrastructure;
using Core.Entities;
using DataAccess.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Task = System.Threading.Tasks.Task;

namespace Application.Tests.Services;

public class RequisitionAllowanceServiceTests
{
    private static readonly DateTime Base = new(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);

    private static RequisitionAllowanceRate Seed(DatabaseContext db, decimal percent, DateTime createdAt, Guid? userId = null)
    {
        var rate = new RequisitionAllowanceRate
        {
            Id = Guid.NewGuid(),
            Percent = percent,
            CreatedAt = createdAt,
            CreatedByUserId = userId,
        };
        db.RequisitionAllowanceRates.Add(rate);
        db.SaveChanges();
        return rate;
    }

    [Fact]
    public async Task GetAllAsync_ReturnsNewestFirstWithAuthorName()
    {
        await using var db = TestDbContextFactory.Create();
        var user = TestData.SeedUser(db, login: "ali", firstName: "Ali", lastName: "Valiyev");
        Seed(db, 3m, Base);
        Seed(db, 5m, Base.AddDays(1), user.Id);

        var result = await new RequisitionAllowanceService(db).GetAllAsync();

        result.Succeeded.Should().BeTrue();
        var rates = result.Result!.ToList();
        rates.Select(r => r.Percent).Should().Equal(5m, 3m);
        rates[0].CreatedByName.Should().Be("Valiyev Ali");
        rates[1].CreatedByName.Should().BeNull();
    }

    [Fact]
    public async Task GetCurrentPercentAsync_ReturnsLatestRate()
    {
        await using var db = TestDbContextFactory.Create();
        Seed(db, 5m, Base.AddDays(1));
        Seed(db, 3m, Base);

        (await new RequisitionAllowanceService(db).GetCurrentPercentAsync()).Should().Be(5m);
    }

    [Fact]
    public async Task GetCurrentPercentAsync_WithoutRates_ReturnsZero()
    {
        await using var db = TestDbContextFactory.Create();

        (await new RequisitionAllowanceService(db).GetCurrentPercentAsync()).Should().Be(0m);
    }

    [Fact]
    public async Task CreateAsync_WithValidPercent_AppendsRate()
    {
        await using var db = TestDbContextFactory.Create();
        Seed(db, 3m, Base);
        var userId = Guid.NewGuid();

        var result = await new RequisitionAllowanceService(db)
            .CreateAsync(new RequisitionAllowanceSaveDto { Percent = 5m, Note = "  brak ko'paydi  " }, userId);

        result.Succeeded.Should().BeTrue();
        result.StatusCode.Should().Be(201);
        db.RequisitionAllowanceRates.Should().HaveCount(2);
        var saved = await db.RequisitionAllowanceRates.SingleAsync(r => r.Id == result.Result);
        saved.Percent.Should().Be(5m);
        saved.Note.Should().Be("brak ko'paydi");
        saved.CreatedByUserId.Should().Be(userId);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(20.01)]
    public async Task CreateAsync_OutOfRange_ReturnsFailure(double percent)
    {
        await using var db = TestDbContextFactory.Create();

        var result = await new RequisitionAllowanceService(db)
            .CreateAsync(new RequisitionAllowanceSaveDto { Percent = (decimal)percent }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("0 dan 20 gacha");
        db.RequisitionAllowanceRates.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_MoreThanTwoDecimals_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();

        var result = await new RequisitionAllowanceService(db)
            .CreateAsync(new RequisitionAllowanceSaveDto { Percent = 3.125m }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("2 xonali");
    }

    [Fact]
    public async Task CreateAsync_SameAsCurrent_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        Seed(db, 3m, Base);

        var result = await new RequisitionAllowanceService(db)
            .CreateAsync(new RequisitionAllowanceSaveDto { Percent = 3m }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("o'zgarmagan");
        db.RequisitionAllowanceRates.Should().HaveCount(1);
    }

    [Fact]
    public async Task CreateAsync_NoteTooLong_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();

        var result = await new RequisitionAllowanceService(db)
            .CreateAsync(new RequisitionAllowanceSaveDto { Percent = 4m, Note = new string('a', 501) }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("500");
    }
}
