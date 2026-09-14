using Application.DTOs.ProductCatalog;
using Application.Services;
using Application.Services.Impl;
using Application.Tests.Infrastructure;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using Task = System.Threading.Tasks.Task;

namespace Application.Tests.Services;

public class ProductCatalogServiceTests
{
    private static ProductCatalogService CreateSut(DatabaseContext db)
        => new(db, new Mock<IActivityLogService>().Object);

    private static ProductCatalog SeedCatalog(
        DatabaseContext db,
        string name = "Val",
        string code = "PRD-000001",
        bool isActive = true)
    {
        var entity = new ProductCatalog
        {
            Id = Guid.NewGuid(),
            Name = name,
            NameNormalized = Application.Helpers.TextNormalizer.Normalize(name),
            Code = code,
            Unit = "Dona",
            IsActive = isActive,
            CreatedBy = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
        };
        db.ProductCatalogs.Add(entity);
        db.SaveChanges();
        return entity;
    }

    private static Contract SeedContractWithCatalogProduct(
        DatabaseContext db,
        Guid catalogId,
        ContractStatus status,
        bool contractIsActive = true,
        string contractNo = "C-2026-001",
        Guid? createdBy = null)
    {
        var contract = new Contract
        {
            Id = Guid.NewGuid(),
            ContractNo = contractNo,
            StartDate = new DateOnly(2026, 1, 1),
            EndDate = new DateOnly(2026, 12, 31),
            ContractType = ContractType.Mahalliy,
            ContractParty = "Mijoz",
            Status = status,
            IsActive = contractIsActive,
            CreatedBy = createdBy ?? Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
        };
        db.Contracts.Add(contract);
        db.ContractProducts.Add(new ContractProduct
        {
            Id = Guid.NewGuid(),
            ContractId = contract.Id,
            ProductCatalogId = catalogId,
            ProductType = "Val",
            Quantity = 10,
            Unit = "Dona",
            OrderIndex = 0,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        });
        db.SaveChanges();
        return contract;
    }

    [Fact]
    public async Task ArchiveAsync_WhenLinkedContractStillRunning_FailsAndKeepsProductActive()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var catalog = SeedCatalog(db);
        SeedContractWithCatalogProduct(db, catalog.Id, ContractStatus.InProduction);
        var sut = CreateSut(db);

        // Act
        var result = await sut.ArchiveAsync(catalog.Id);

        // Assert
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(409);
        result.Errors.Should().ContainSingle(e => e.Contains("1"));
        (await db.ProductCatalogs.AsNoTracking().SingleAsync()).IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task ArchiveAsync_WhenAllContractsFinished_DeactivatesWithoutDeleting()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var catalog = SeedCatalog(db);
        SeedContractWithCatalogProduct(db, catalog.Id, ContractStatus.Completed, contractNo: "C-1");
        SeedContractWithCatalogProduct(db, catalog.Id, ContractStatus.Cancelled, contractNo: "C-2");
        var sut = CreateSut(db);

        // Act
        var result = await sut.ArchiveAsync(catalog.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        var stored = await db.ProductCatalogs.AsNoTracking().SingleAsync();
        stored.IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task ArchiveAsync_WhenDeactivatedContractIsUnfinished_StillArchives()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var catalog = SeedCatalog(db);
        SeedContractWithCatalogProduct(db, catalog.Id, ContractStatus.InProduction, contractIsActive: false);
        var sut = CreateSut(db);

        // Act
        var result = await sut.ArchiveAsync(catalog.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        (await db.ProductCatalogs.AsNoTracking().SingleAsync()).IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task ArchiveAsync_WhenNeverUsedInAnyContract_Deactivates()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var catalog = SeedCatalog(db);
        var sut = CreateSut(db);

        // Act
        var result = await sut.ArchiveAsync(catalog.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        (await db.ProductCatalogs.AsNoTracking().SingleAsync()).IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task ArchiveAsync_WhenAlreadyArchived_ReturnsNotFound()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var catalog = SeedCatalog(db, isActive: false);
        var sut = CreateSut(db);

        // Act
        var result = await sut.ArchiveAsync(catalog.Id);

        // Assert
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task RestoreAsync_WhenArchived_MakesItActiveAgain()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var catalog = SeedCatalog(db, isActive: false);
        var sut = CreateSut(db);

        // Act
        var result = await sut.RestoreAsync(catalog.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        (await db.ProductCatalogs.AsNoTracking().SingleAsync()).IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task RestoreAsync_WhenAnActiveProductHasTheSameName_Fails()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var archived = SeedCatalog(db, name: "Val", code: "PRD-000001", isActive: false);
        SeedCatalog(db, name: "val", code: "PRD-000002");
        var sut = CreateSut(db);

        // Act
        var result = await sut.RestoreAsync(archived.Id);

        // Assert
        result.Succeeded.Should().BeFalse();
        var stored = await db.ProductCatalogs.AsNoTracking().SingleAsync(p => p.Id == archived.Id);
        stored.IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task GetAllAsync_ByDefault_ExcludesArchivedProducts()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedCatalog(db, name: "Val", code: "PRD-000001");
        SeedCatalog(db, name: "Podshipnik", code: "PRD-000002", isActive: false);
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetAllAsync(1, 20, null, archived: false);

        // Assert
        result.Result!.Items.Should().ContainSingle().Which.Name.Should().Be("Val");
    }

    [Fact]
    public async Task GetAllAsync_WhenArchivedRequested_ReturnsOnlyArchivedProducts()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedCatalog(db, name: "Val", code: "PRD-000001");
        SeedCatalog(db, name: "Podshipnik", code: "PRD-000002", isActive: false);
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetAllAsync(1, 20, null, archived: true);

        // Assert
        result.Result!.Items.Should().ContainSingle().Which.Name.Should().Be("Podshipnik");
    }

    [Fact]
    public async Task GetAllAsync_CountsContractsThatBlockArchiving()
    {
        // Arrange — relational provider: to'siq sonini hisoblovchi ichki so'rov (Distinct().Count())
        // haqiqatan SQL'ga tarjima bo'lishi kerak, InMemory buni tekshirmaydi.
        await using var db = TestDbContextFactory.CreateSqlite();
        var creator = TestData.SeedUser(db).Id;
        var catalog = SeedCatalog(db);
        SeedContractWithCatalogProduct(db, catalog.Id, ContractStatus.InProduction, contractNo: "C-1", createdBy: creator);
        SeedContractWithCatalogProduct(db, catalog.Id, ContractStatus.Completed, contractNo: "C-2", createdBy: creator);
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetAllAsync(1, 20, null, archived: false);

        // Assert
        var row = result.Result!.Items.Should().ContainSingle().Subject;
        row.UsageCount.Should().Be(2);
        row.BlockingContractCount.Should().Be(1);
    }

    [Fact]
    public async Task LookupAsync_ReturnsArchivedProductsMarkedAsInactive()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedCatalog(db, name: "Val", code: "PRD-000001");
        SeedCatalog(db, name: "Podshipnik", code: "PRD-000002", isActive: false);
        var sut = CreateSut(db);

        // Act
        var result = await sut.LookupAsync(1, 20, null);

        // Assert
        result.Result!.Items.Should().HaveCount(2);
        result.Result.Items.Single(i => i.Name == "Podshipnik").IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task CreateAsync_WhenNameMatchesArchivedProduct_RestoresItInsteadOfDuplicating()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var archived = SeedCatalog(db, name: "Val", isActive: false);
        var sut = CreateSut(db);

        // Act
        var result = await sut.CreateAsync(new ProductCatalogCreateDto { Name = "val", Unit = "Dona" }, Guid.NewGuid());

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result!.Id.Should().Be(archived.Id);
        (await db.ProductCatalogs.AsNoTracking().SingleAsync()).IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateAsync_WhenRenamingOntoAnArchivedProductName_Fails()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedCatalog(db, name: "Podshipnik", code: "PRD-000002", isActive: false);
        var target = SeedCatalog(db, name: "Val", code: "PRD-000001");
        var sut = CreateSut(db);

        // Act
        var result = await sut.UpdateAsync(target.Id, new ProductCatalogUpdateDto { Name = "podshipnik", Unit = "Dona" });

        // Assert
        result.Succeeded.Should().BeFalse();
    }

    [Fact]
    public async Task GetDetailAsync_WhenProductIsArchived_StillReturnsDetail()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var catalog = SeedCatalog(db, isActive: false);
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetDetailAsync(catalog.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result!.Name.Should().Be("Val");
    }
}
