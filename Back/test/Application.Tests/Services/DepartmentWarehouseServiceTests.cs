using Application.Services.Impl;
using Application.Tests.Infrastructure;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using FluentAssertions;
using Xunit;
using Task = System.Threading.Tasks.Task;

namespace Application.Tests.Services;

// "Bo'lim omborlari" servisi testlari — ProductService dan ajratilgan
// GetByDepartmentAsync va GetDepartmentSummariesAsync mantig'ini qamrab oladi.
public class DepartmentWarehouseServiceTests
{
    private static DepartmentWarehouseService CreateService(DatabaseContext db) => new(db);

    private static Department SeedDepartment(
        DatabaseContext db,
        string name = "Omborxona",
        DepartmentType type = DepartmentType.Omborxona,
        bool isActive = true,
        Guid? id = null)
    {
        var dep = new Department
        {
            Id = id ?? Guid.NewGuid(),
            Name = name,
            Type = type,
            IsActive = isActive,
            CreatedAt = DateTime.UtcNow,
        };
        db.Departments.Add(dep);
        db.SaveChanges();
        return dep;
    }

    private static Product SeedProduct(
        DatabaseContext db,
        Guid departmentId,
        string name = "Sement",
        string invoiceNumber = "INV-0001",
        decimal quantity = 100m,
        decimal reservedQuantity = 0m,
        ProductUnit unit = ProductUnit.Kilogramm,
        string? description = null,
        Guid? id = null)
    {
        var product = new Product
        {
            Id = id ?? Guid.NewGuid(),
            Name = name,
            InvoiceNumber = invoiceNumber,
            Description = description,
            Quantity = quantity,
            ReservedQuantity = reservedQuantity,
            Unit = unit,
            DepartmentId = departmentId,
            CreatedAt = DateTime.UtcNow,
        };
        db.Products.Add(product);
        db.SaveChanges();
        return product;
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GetByDepartmentAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetByDepartmentAsync_ReturnsOnlyProductsOfThatDepartment()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var depA = SeedDepartment(db, name: "Ombor A", id: Guid.NewGuid());
        var depB = SeedDepartment(db, name: "Ombor B", id: Guid.NewGuid());
        SeedProduct(db, depA.Id, name: "A1", invoiceNumber: "INV-A1");
        SeedProduct(db, depA.Id, name: "A2", invoiceNumber: "INV-A2");
        SeedProduct(db, depB.Id, name: "B1", invoiceNumber: "INV-B1");
        var sut = CreateService(db);

        // Act
        var result = await sut.GetByDepartmentAsync(depA.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result!.Should().HaveCount(2)
            .And.OnlyContain(p => p.DepartmentId == depA.Id);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GetDepartmentSummariesAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetDepartmentSummariesAsync_AggregatesProductCountAndTotalQuantity()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var depA = SeedDepartment(db, name: "Ombor A", id: Guid.NewGuid());
        var depB = SeedDepartment(db, name: "Ombor B", id: Guid.NewGuid());
        SeedProduct(db, depA.Id, name: "A1", invoiceNumber: "INV-A1", quantity: 10m);
        SeedProduct(db, depA.Id, name: "A2", invoiceNumber: "INV-A2", quantity: 25m);
        SeedProduct(db, depB.Id, name: "B1", invoiceNumber: "INV-B1", quantity: 7m);
        var sut = CreateService(db);

        // Act
        var result = await sut.GetDepartmentSummariesAsync();

        // Assert
        result.Succeeded.Should().BeTrue();
        var summaries = result.Result!.ToList();
        summaries.Should().HaveCount(2);
        summaries.Single(s => s.DepartmentId == depA.Id).ProductCount.Should().Be(2);
        summaries.Single(s => s.DepartmentId == depA.Id).TotalQuantity.Should().Be(35m);
        summaries.Single(s => s.DepartmentId == depB.Id).ProductCount.Should().Be(1);
        summaries.Single(s => s.DepartmentId == depB.Id).TotalQuantity.Should().Be(7m);
    }

    [Fact]
    public async Task GetDepartmentSummariesAsync_SkipsInactiveDepartments()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var active = SeedDepartment(db, name: "Faol", isActive: true, id: Guid.NewGuid());
        var inactive = SeedDepartment(db, name: "Nofaol", isActive: false, id: Guid.NewGuid());
        SeedProduct(db, active.Id, name: "A", invoiceNumber: "INV-A");
        SeedProduct(db, inactive.Id, name: "B", invoiceNumber: "INV-B");
        var sut = CreateService(db);

        // Act
        var result = await sut.GetDepartmentSummariesAsync();

        // Assert
        result.Result!.Should().ContainSingle()
            .Which.DepartmentId.Should().Be(active.Id);
    }

    [Fact]
    public async Task GetDepartmentSummariesAsync_DepartmentWithoutProducts_ReturnsZeroCounts()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        var sut = CreateService(db);

        // Act
        var result = await sut.GetDepartmentSummariesAsync();

        // Assert
        var summary = result.Result!.Single();
        summary.DepartmentId.Should().Be(dep.Id);
        summary.ProductCount.Should().Be(0);
        summary.TotalQuantity.Should().Be(0m);
    }
}
