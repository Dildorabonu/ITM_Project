using Application.DTOs.Scan;
using Application.Services;
using Application.Services.Impl;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using Task = System.Threading.Tasks.Task;

namespace Application.Tests.Services;

public class ScanServiceTests
{
    private static DatabaseContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<DatabaseContext>()
            .UseInMemoryDatabase($"itm-scan-{Guid.NewGuid():N}")
            .EnableSensitiveDataLogging()
            .Options;

        var ctx = new DatabaseContext(options);
        ctx.Database.EnsureCreated();
        return ctx;
    }

    private static ScanService CreateService(DatabaseContext db) =>
        new(db, new Mock<IQrCodeService>().Object);

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

    private static Product SeedProduct(DatabaseContext db, Guid departmentId, decimal quantity, decimal reserved = 0m)
    {
        var p = new Product
        {
            Id = Guid.NewGuid(),
            Name = "Bolt M8",
            NameNormalized = "bolt m8",
            Quantity = quantity,
            ReservedQuantity = reserved,
            Unit = ProductUnit.Dona,
            DepartmentId = departmentId,
        };
        db.Products.Add(p);
        db.SaveChanges();
        return p;
    }

    [Fact]
    public async Task ActionAsync_Out_MovesStockToTargetDepartment()
    {
        // Chiqim ko'chirish mantiqida ishlaydi: tovar yo'qolmaydi, bo'lim omboriga o'tadi.
        await using var db = CreateDb();
        var warehouse = SeedDept(db, "Omborxona");
        var uchastka = SeedDept(db, "2-uchastka");
        var product = SeedProduct(db, warehouse.Id, 10m);

        var result = await CreateService(db).ActionAsync(new ScanActionDto
        {
            ProductId = product.Id,
            Type = StockMovementType.Out,
            Quantity = 4m,
            TargetDepartmentId = uchastka.Id,
        }, Guid.NewGuid());

        result.Succeeded.Should().BeTrue();
        db.Products.Single(p => p.Id == product.Id).Quantity.Should().Be(6m);
        db.Products.Single(p => p.DepartmentId == uchastka.Id).Quantity.Should().Be(4m);

        var movement = db.StockMovements.Single();
        movement.Type.Should().Be(StockMovementType.Out);
        movement.SourceDepartmentId.Should().Be(warehouse.Id);
        movement.TargetDepartmentId.Should().Be(uchastka.Id);
    }

    [Fact]
    public async Task ActionAsync_Out_WithoutTargetDepartment_Fails()
    {
        await using var db = CreateDb();
        var warehouse = SeedDept(db, "Omborxona");
        var product = SeedProduct(db, warehouse.Id, 10m);

        var result = await CreateService(db).ActionAsync(new ScanActionDto
        {
            ProductId = product.Id,
            Type = StockMovementType.Out,
            Quantity = 4m,
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        db.Products.Single(p => p.Id == product.Id).Quantity.Should().Be(10m);
        db.StockMovements.Should().BeEmpty();
    }

    [Fact]
    public async Task ActionAsync_Adjust_SetsNewQuantityAndRecordsMovement()
    {
        await using var db = CreateDb();
        var warehouse = SeedDept(db, "Omborxona");
        var product = SeedProduct(db, warehouse.Id, 10m);
        var userId = Guid.NewGuid();

        var result = await CreateService(db).ActionAsync(new ScanActionDto
        {
            ProductId = product.Id,
            Type = StockMovementType.Adjust,
            Quantity = 7m,
            Notes = "Inventarizatsiya: 3 ta kam chiqdi",
        }, userId);

        result.Succeeded.Should().BeTrue();
        db.Products.Single(p => p.Id == product.Id).Quantity.Should().Be(7m);

        var movement = db.StockMovements.Single();
        movement.Type.Should().Be(StockMovementType.Adjust);
        movement.Quantity.Should().Be(3m);
        movement.QuantityAfter.Should().Be(7m);
        movement.UserId.Should().Be(userId);
        movement.Notes.Should().Be("Inventarizatsiya: 3 ta kam chiqdi");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("   ")]
    public async Task ActionAsync_Adjust_WithoutReason_Fails(string? notes)
    {
        await using var db = CreateDb();
        var warehouse = SeedDept(db, "Omborxona");
        var product = SeedProduct(db, warehouse.Id, 10m);

        var result = await CreateService(db).ActionAsync(new ScanActionDto
        {
            ProductId = product.Id,
            Type = StockMovementType.Adjust,
            Quantity = 7m,
            Notes = notes,
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("sabab");
        db.Products.Single(p => p.Id == product.Id).Quantity.Should().Be(10m);
        db.StockMovements.Should().BeEmpty();
    }

    [Fact]
    public async Task ActionAsync_Adjust_BelowReservedQuantity_Fails()
    {
        // Rezervdan kam qoldiq talabnomani ombordan berish bosqichida to'xtatib qo'yadi.
        await using var db = CreateDb();
        var warehouse = SeedDept(db, "Omborxona");
        var product = SeedProduct(db, warehouse.Id, 10m, reserved: 6m);

        var result = await CreateService(db).ActionAsync(new ScanActionDto
        {
            ProductId = product.Id,
            Type = StockMovementType.Adjust,
            Quantity = 5m,
            Notes = "Shikastlangan",
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("rezerv");
        db.Products.Single(p => p.Id == product.Id).Quantity.Should().Be(10m);
        db.StockMovements.Should().BeEmpty();
    }

    [Fact]
    public async Task ActionAsync_Adjust_DownToReservedQuantity_Succeeds()
    {
        await using var db = CreateDb();
        var warehouse = SeedDept(db, "Omborxona");
        var product = SeedProduct(db, warehouse.Id, 10m, reserved: 6m);

        var result = await CreateService(db).ActionAsync(new ScanActionDto
        {
            ProductId = product.Id,
            Type = StockMovementType.Adjust,
            Quantity = 6m,
            Notes = "Shikastlangan",
        }, Guid.NewGuid());

        result.Succeeded.Should().BeTrue();
        db.Products.Single(p => p.Id == product.Id).Quantity.Should().Be(6m);
    }
}
