using System.Text.Json;
using Application.DTOs.StockMovements;
using Application.Services.Impl;
using Application.Tests.Infrastructure;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Task = System.Threading.Tasks.Task;

namespace Application.Tests.Services;

public class StockMovementServiceTests
{
    // ─────────────────────────────────────────────────────────────────────
    //  Infrastructure
    // ─────────────────────────────────────────────────────────────────────

    private static DatabaseContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<DatabaseContext>()
            .UseInMemoryDatabase($"itm-mov-{Guid.NewGuid():N}")
            .EnableSensitiveDataLogging()
            .Options;

        var ctx = new DatabaseContext(options);
        ctx.Database.EnsureCreated();
        return ctx;
    }

    private static Department SeedDept(DatabaseContext db, string name)
    {
        var d = new Department
        {
            Id = Guid.NewGuid(),
            Name = name,
            Type = DepartmentType.Bolim,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        db.Departments.Add(d);
        db.SaveChanges();
        return d;
    }

    private static void SeedMovement(
        DatabaseContext db,
        StockMovementType type,
        Guid? targetDeptId = null,
        DateTime? createdAt = null)
    {
        db.StockMovements.Add(new StockMovement
        {
            Id = Guid.NewGuid(),
            Type = type,
            ProductId = Guid.NewGuid(),
            TargetDepartmentId = targetDeptId,
            Quantity = 1m,
            QuantityAfter = 1m,
            UserId = Guid.NewGuid(),
            CreatedAt = createdAt ?? DateTime.UtcNow,
        });
        db.SaveChanges();
    }

    // ─────────────────────────────────────────────────────────────────────
    //  JSON serializatsiya
    // ─────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Frontend `type` ni satr sifatida kutadi (STOCK_MOVEMENT_COLOR["Reserve"]).
    /// Default System.Text.Json enumni raqam qilib yuboradi — o'shanda badge ranglari,
    /// +/- ishorasi va tooltiplar `undefined` bo'lib qoladi.
    /// JsonSerializerDefaults.Web — ASP.NET Core MVC ishlatadigan sozlama.
    /// </summary>
    [Fact]
    public void ResponseDto_SerializesTypeAsEnumName_NotNumber()
    {
        var dto = new StockMovementResponseDto { Type = StockMovementType.Reserve };

        var json = JsonSerializer.Serialize(dto, new JsonSerializerOptions(JsonSerializerDefaults.Web));

        json.Should().Contain("\"type\":\"Reserve\"");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GetSummaryAsync — filtr tugmachalaridagi sonlar
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetSummaryAsync_CountsMovementsPerTypeAndTotal()
    {
        await using var db = CreateDb();
        SeedMovement(db, StockMovementType.In);
        SeedMovement(db, StockMovementType.In);
        SeedMovement(db, StockMovementType.Reserve);

        var result = await new StockMovementService(db).GetSummaryAsync(new StockMovementFilter());

        result.Succeeded.Should().BeTrue();
        result.Result!.Total.Should().Be(3);
        result.Result.ByType["In"].Should().Be(2);
        result.Result.ByType["Reserve"].Should().Be(1);
    }

    [Fact]
    public async Task GetSummaryAsync_IncludesEveryTypeWithZero()
    {
        // Tugmachalar har doim ko'rinib turishi kerak — nol bo'lsa ham yo'qolmasin.
        await using var db = CreateDb();
        SeedMovement(db, StockMovementType.In);

        var result = await new StockMovementService(db).GetSummaryAsync(new StockMovementFilter());

        result.Result!.ByType.Should().HaveCount(6);
        result.Result.ByType["Out"].Should().Be(0);
        result.Result.ByType["Release"].Should().Be(0);
    }

    [Fact]
    public async Task GetSummaryAsync_IgnoresTypeFilter()
    {
        // Tur tanlanganda ham qolgan tugmachalar o'z sonini ko'rsatishi kerak,
        // aks holda bitta tur tanlangach hammasi nolga tushib qolardi.
        await using var db = CreateDb();
        SeedMovement(db, StockMovementType.In);
        SeedMovement(db, StockMovementType.Out);

        var result = await new StockMovementService(db)
            .GetSummaryAsync(new StockMovementFilter { Type = StockMovementType.In });

        result.Result!.Total.Should().Be(2);
        result.Result.ByType["Out"].Should().Be(1);
    }

    [Fact]
    public async Task GetSummaryAsync_RespectsDepartmentFilter()
    {
        await using var db = CreateDb();
        var sex1 = SeedDept(db, "Sex-1");
        var sex2 = SeedDept(db, "Sex-2");
        SeedMovement(db, StockMovementType.In, targetDeptId: sex1.Id);
        SeedMovement(db, StockMovementType.In, targetDeptId: sex2.Id);

        var result = await new StockMovementService(db)
            .GetSummaryAsync(new StockMovementFilter { DepartmentId = sex1.Id });

        result.Result!.Total.Should().Be(1);
        result.Result.ByType["In"].Should().Be(1);
    }

    [Fact]
    public async Task GetSummaryAsync_RespectsDateRangeFilter()
    {
        await using var db = CreateDb();
        var now = DateTime.UtcNow;
        SeedMovement(db, StockMovementType.In, createdAt: now.AddDays(-10));
        SeedMovement(db, StockMovementType.In, createdAt: now);

        var result = await new StockMovementService(db)
            .GetSummaryAsync(new StockMovementFilter { From = now.AddDays(-1) });

        result.Result!.Total.Should().Be(1);
    }
}
