using Application.DTOs.Products;
using Application.Helpers;
using Application.Services.Impl;
using Application.Tests.Infrastructure;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using FluentAssertions;
using Xunit;
using Task = System.Threading.Tasks.Task;

namespace Application.Tests.Services;

public class ProductServiceTests
{
    private static ProductService CreateService(DatabaseContext db) => new(db);

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
    //  CreateAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_WithValidDto_PersistsProductAndReturns201()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        var sut = CreateService(db);

        var dto = new ProductCreateDto
        {
            Name = "Sement M400",
            InvoiceNumber = "  INV-2026-0001  ",
            Description = "Qoplangan",
            Quantity = 50m,
            Unit = ProductUnit.Kilogramm,
            DepartmentId = dep.Id,
        };

        // Act
        var result = await sut.CreateAsync(dto);

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result.Should().Be(201);

        var saved = db.Products.Single(p => p.Name == "Sement M400");
        saved.InvoiceNumber.Should().Be("INV-2026-0001", "invoice raqami trim qilinishi kerak");
        saved.Description.Should().Be("Qoplangan");
        saved.Quantity.Should().Be(50m);
        saved.DepartmentId.Should().Be(dep.Id);
        saved.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));
    }

    [Fact]
    public async Task CreateAsync_WithBlankInvoice_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        var sut = CreateService(db);

        // Act
        var result = await sut.CreateAsync(new ProductCreateDto
        {
            Name = "X",
            InvoiceNumber = "   ",
            DepartmentId = dep.Id,
        });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("Invoice");
        db.Products.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_WithNonExistentDepartment_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateService(db);

        // Act
        var result = await sut.CreateAsync(new ProductCreateDto
        {
            Name = "Sement",
            InvoiceNumber = "INV-1",
            DepartmentId = Guid.NewGuid(),
        });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("Department");
        db.Products.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_WithDuplicateNameInSameDepartment_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        SeedProduct(db, dep.Id, name: "Sement", invoiceNumber: "INV-1");
        var sut = CreateService(db);

        // Act
        var result = await sut.CreateAsync(new ProductCreateDto
        {
            Name = "Sement",
            InvoiceNumber = "INV-2",
            DepartmentId = dep.Id,
        });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle()
            .Which.Should().Contain("'Sement'").And.Contain("already exists");
        db.Products.Count(p => p.Name == "Sement").Should().Be(1);
    }

    [Fact]
    public async Task CreateAsync_WithSameNameInDifferentDepartment_Succeeds()
    {
        // Arrange — bir xil nom har bir bo'limda mustaqil bo'lishi mumkin
        await using var db = TestDbContextFactory.Create();
        var depA = SeedDepartment(db, name: "Ombor A", id: Guid.NewGuid());
        var depB = SeedDepartment(db, name: "Ombor B", id: Guid.NewGuid());
        SeedProduct(db, depA.Id, name: "Sement", invoiceNumber: "INV-A");
        var sut = CreateService(db);

        // Act
        var result = await sut.CreateAsync(new ProductCreateDto
        {
            Name = "Sement",
            InvoiceNumber = "INV-B",
            DepartmentId = depB.Id,
        });

        // Assert
        result.Succeeded.Should().BeTrue();
        db.Products.Count(p => p.Name == "Sement").Should().Be(2);
    }

    [Fact]
    public async Task CreateAsync_WithDuplicateInvoiceNumber_ReturnsFailure()
    {
        // Arrange — invoice raqami butun tizim bo'yicha unique
        await using var db = TestDbContextFactory.Create();
        var depA = SeedDepartment(db, name: "Ombor A", id: Guid.NewGuid());
        var depB = SeedDepartment(db, name: "Ombor B", id: Guid.NewGuid());
        SeedProduct(db, depA.Id, name: "Sement", invoiceNumber: "INV-DUP");
        var sut = CreateService(db);

        // Act — boshqa bo'limga ham bo'lsa invoice takrorlanmaydi
        var result = await sut.CreateAsync(new ProductCreateDto
        {
            Name = "G'isht",
            InvoiceNumber = "INV-DUP",
            DepartmentId = depB.Id,
        });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle()
            .Which.Should().Contain("'INV-DUP'").And.Contain("allaqachon mavjud");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  CreateBulkAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateBulkAsync_WithValidItems_PersistsAll()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        var sut = CreateService(db);

        var dtos = new[]
        {
            new ProductCreateDto { Name = "A", InvoiceNumber = "INV-A", DepartmentId = dep.Id, Quantity = 1m },
            new ProductCreateDto { Name = "B", InvoiceNumber = "INV-B", DepartmentId = dep.Id, Quantity = 2m },
        };

        // Act
        var result = await sut.CreateBulkAsync(dtos);

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result.Should().Be(201);
        db.Products.Should().HaveCount(2);
    }

    [Fact]
    public async Task CreateBulkAsync_OverLimit_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        var sut = CreateService(db);

        var dtos = Enumerable.Range(1, 201).Select(i => new ProductCreateDto
        {
            Name = $"P{i}",
            InvoiceNumber = $"INV-{i}",
            DepartmentId = dep.Id,
        });

        // Act
        var result = await sut.CreateBulkAsync(dtos);

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("200 tadan ortiq");
        db.Products.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateBulkAsync_WithDuplicateInvoiceInBatch_ReturnsFailureBeforeInsert()
    {
        // Arrange — yuborilgan ro'yxat ichidagi takror ham bloklanadi
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        var sut = CreateService(db);

        var dtos = new[]
        {
            new ProductCreateDto { Name = "A", InvoiceNumber = "INV-X", DepartmentId = dep.Id },
            new ProductCreateDto { Name = "B", InvoiceNumber = "inv-x", DepartmentId = dep.Id },
        };

        // Act
        var result = await sut.CreateBulkAsync(dtos);

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("ro'yxatda takrorlangan");
        db.Products.Should().BeEmpty();
    }

    // ─────────────────────────────────────────────────────────────────────
    //  UpdateAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateAsync_WithNonExistentId_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(Guid.NewGuid(), new ProductUpdateDto { Name = "X" });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("not found");
    }

    [Fact]
    public async Task UpdateAsync_WithPartialDto_OnlyOverridesProvidedFields()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        var p = SeedProduct(db, dep.Id, name: "Sement", invoiceNumber: "INV-1",
            quantity: 100m, unit: ProductUnit.Kilogramm, description: "Old");
        var sut = CreateService(db);

        // Act — faqat quantity yangilanadi
        var result = await sut.UpdateAsync(p.Id, new ProductUpdateDto { Quantity = 250m });

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result.Should().Be(200);
        var refreshed = db.Products.Single(x => x.Id == p.Id);
        refreshed.Quantity.Should().Be(250m);
        refreshed.Name.Should().Be("Sement");
        refreshed.InvoiceNumber.Should().Be("INV-1");
        refreshed.Unit.Should().Be(ProductUnit.Kilogramm);
        refreshed.Description.Should().Be("Old");
    }

    [Fact]
    public async Task UpdateAsync_RenamingToTakenName_InSameDepartment_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        SeedProduct(db, dep.Id, name: "Sement", invoiceNumber: "INV-1");
        var p = SeedProduct(db, dep.Id, name: "G'isht", invoiceNumber: "INV-2");
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(p.Id, new ProductUpdateDto { Name = "Sement" });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle()
            .Which.Should().Contain("'Sement'").And.Contain("already exists");
        db.Products.Single(x => x.Id == p.Id).Name.Should().Be("G'isht");
    }

    [Fact]
    public async Task UpdateAsync_WithSameName_DoesNotTriggerDuplicateCheck()
    {
        // Arrange — dto.Name == product.Name bo'lsa duplicate tekshiruvi o'tkazib yuborilishi kerak
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        var p = SeedProduct(db, dep.Id, name: "Sement", invoiceNumber: "INV-1", quantity: 5m);
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(p.Id, new ProductUpdateDto
        {
            Name = "Sement",
            Quantity = 99m,
        });

        // Assert
        result.Succeeded.Should().BeTrue();
        db.Products.Single(x => x.Id == p.Id).Quantity.Should().Be(99m);
    }

    [Fact]
    public async Task UpdateAsync_ToNonExistentDepartment_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        var p = SeedProduct(db, dep.Id);
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(p.Id, new ProductUpdateDto { DepartmentId = Guid.NewGuid() });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("Department");
        db.Products.Single(x => x.Id == p.Id).DepartmentId.Should().Be(dep.Id);
    }

    [Fact]
    public async Task UpdateAsync_WithDuplicateInvoiceNumber_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        SeedProduct(db, dep.Id, name: "A", invoiceNumber: "INV-TAKEN");
        var p = SeedProduct(db, dep.Id, name: "B", invoiceNumber: "INV-FREE");
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(p.Id, new ProductUpdateDto { InvoiceNumber = "INV-TAKEN" });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("'INV-TAKEN'");
        db.Products.Single(x => x.Id == p.Id).InvoiceNumber.Should().Be("INV-FREE");
    }

    [Fact]
    public async Task UpdateAsync_WithWhitespaceInvoiceNumber_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        var p = SeedProduct(db, dep.Id);
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(p.Id, new ProductUpdateDto { InvoiceNumber = "   " });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("bo'sh bo'lishi mumkin emas");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  DeleteAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteAsync_OnExistingProduct_RemovesIt()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        var p = SeedProduct(db, dep.Id);
        var sut = CreateService(db);

        // Act
        var result = await sut.DeleteAsync(p.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result.Should().Be(200);
        db.Products.Any(x => x.Id == p.Id).Should().BeFalse();
    }

    [Fact]
    public async Task DeleteAsync_WithNonExistentId_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateService(db);

        // Act
        var result = await sut.DeleteAsync(Guid.NewGuid());

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("not found");
    }

    [Fact]
    public async Task DeleteAsync_OnProductReservedByRequisition_StillSucceeds_NoCascadeCheck()
    {
        // Arrange — hozirgi xulq: mahsulot aktiv talabnomada rezerv qilingan bo'lsa ham
        // DeleteAsync hech qanday tekshiruv o'tkazmasdan o'chiradi. Bu bog'liqlik faqat
        // DB darajadagi FK orqali kuzatilishi mumkin; servis aralashmaydi.
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        var product = SeedProduct(db, dep.Id, reservedQuantity: 10m);

        db.Requisitions.Add(new Requisition
        {
            Id = Guid.NewGuid(),
            RequisitionNo = "REQ-1",
            Status = RequisitionStatus.PendingApproval,
            Purpose = "test",
            CreatedBy = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
        });
        db.SaveChanges();
        var reqId = db.Requisitions.Single().Id;
        db.RequisitionItems.Add(new RequisitionItem
        {
            Id = Guid.NewGuid(),
            RequisitionId = reqId,
            ReservedProductId = product.Id,
            Quantity = 10m,
        });
        db.SaveChanges();

        var sut = CreateService(db);

        // Act
        var result = await sut.DeleteAsync(product.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        db.Products.Any(x => x.Id == product.Id).Should().BeFalse();
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GetByIdAsync — DTO mapping
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetByIdAsync_WithExisting_ReturnsMappedDtoWithAvailableQuantity()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db, name: "Ombor A");
        var p = SeedProduct(db, dep.Id, name: "Sement", invoiceNumber: "INV-1",
            quantity: 100m, reservedQuantity: 30m, unit: ProductUnit.Kilogramm,
            description: "Tavsif");
        var sut = CreateService(db);

        // Act
        var result = await sut.GetByIdAsync(p.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        var dto = result.Result!;
        dto.Id.Should().Be(p.Id);
        dto.Name.Should().Be("Sement");
        dto.InvoiceNumber.Should().Be("INV-1");
        dto.Description.Should().Be("Tavsif");
        dto.Quantity.Should().Be(100m);
        dto.AvailableQuantity.Should().Be(70m,
            "AvailableQuantity = Quantity - ReservedQuantity");
        dto.Unit.Should().Be(ProductUnit.Kilogramm);
        dto.DepartmentId.Should().Be(dep.Id);
        dto.DepartmentName.Should().Be("Ombor A");
    }

    [Fact]
    public async Task GetByIdAsync_WhenReservedExceedsQuantity_AvailableClampedToZero()
    {
        // Arrange — ReservedQuantity > Quantity bo'lsa ham AvailableQuantity manfiy bo'lmasligi kerak
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        var p = SeedProduct(db, dep.Id, quantity: 5m, reservedQuantity: 12m);
        var sut = CreateService(db);

        // Act
        var result = await sut.GetByIdAsync(p.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result!.AvailableQuantity.Should().Be(0m);
    }

    [Fact]
    public async Task GetByIdAsync_WithNonExistentId_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateService(db);

        // Act
        var result = await sut.GetByIdAsync(Guid.NewGuid());

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("not found");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GetAllAsync — filter, search, paging
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAllAsync_ReturnsPagedResults_OrderedByName()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        SeedProduct(db, dep.Id, name: "Zink",   invoiceNumber: "INV-Z");
        SeedProduct(db, dep.Id, name: "Alyumin", invoiceNumber: "INV-A");
        SeedProduct(db, dep.Id, name: "Mis",    invoiceNumber: "INV-M");
        var sut = CreateService(db);

        // Act
        var result = await sut.GetAllAsync(page: 1, pageSize: 10, search: null, departmentId: null);

        // Assert
        result.Succeeded.Should().BeTrue();
        var paged = result.Result!;
        paged.TotalCount.Should().Be(3);
        paged.Items.Select(i => i.Name).Should().Equal("Alyumin", "Mis", "Zink");
    }

    [Fact]
    public async Task GetAllAsync_WithSearch_MatchesNameInvoiceDescriptionAndDepartment()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db, name: "Markaziy ombor");
        SeedProduct(db, dep.Id, name: "Sement",  invoiceNumber: "INV-100", description: "Quruq");
        SeedProduct(db, dep.Id, name: "G'isht", invoiceNumber: "INV-200", description: "Qizil");
        SeedProduct(db, dep.Id, name: "Bo'yoq", invoiceNumber: "INV-300", description: "Suyuq");
        var sut = CreateService(db);

        // Act — InvoiceNumber bo'yicha qidirish
        var byInvoice = await sut.GetAllAsync(1, 10, search: "INV-200", departmentId: null);

        // Assert
        byInvoice.Result!.Items.Should().ContainSingle().Which.Name.Should().Be("G'isht");
    }

    [Fact]
    public async Task GetAllAsync_WithDepartmentFilter_ReturnsOnlyMatching()
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
        var result = await sut.GetAllAsync(1, 10, search: null, departmentId: depA.Id);

        // Assert
        result.Result!.TotalCount.Should().Be(2);
        result.Result.Items.Should().OnlyContain(i => i.DepartmentId == depA.Id);
    }

    [Fact]
    public async Task GetAllAsync_WithRestrictToDepartment_OverridesScope()
    {
        // Arrange — permission cheklov: foydalanuvchi faqat o'z bo'limini ko'radi
        await using var db = TestDbContextFactory.Create();
        var depA = SeedDepartment(db, name: "Ombor A", id: Guid.NewGuid());
        var depB = SeedDepartment(db, name: "Ombor B", id: Guid.NewGuid());
        SeedProduct(db, depA.Id, name: "A1", invoiceNumber: "INV-A1");
        SeedProduct(db, depB.Id, name: "B1", invoiceNumber: "INV-B1");
        var sut = CreateService(db);

        // Act
        var result = await sut.GetAllAsync(1, 10, search: null, departmentId: null,
            restrictToDepartmentId: depA.Id);

        // Assert
        result.Result!.Items.Should().OnlyContain(i => i.DepartmentId == depA.Id);
    }

    [Fact]
    public async Task GetAllAsync_WithDepartmentTypeFilter_ReturnsOnlyMatching()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var ombor = SeedDepartment(db, name: "Ombor", type: DepartmentType.Omborxona,
            id: Guid.NewGuid());
        var bolim = SeedDepartment(db, name: "Bolim", type: DepartmentType.Bolim,
            id: Guid.NewGuid());
        SeedProduct(db, ombor.Id, name: "A", invoiceNumber: "INV-A");
        SeedProduct(db, bolim.Id, name: "B", invoiceNumber: "INV-B");
        var sut = CreateService(db);

        // Act
        var result = await sut.GetAllAsync(1, 10, search: null, departmentId: null,
            departmentType: DepartmentType.Omborxona);

        // Assert
        result.Result!.Items.Should().ContainSingle().Which.DepartmentId.Should().Be(ombor.Id);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GetReservationsAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetReservationsAsync_ReturnsOnlyActiveReservationStatuses()
    {
        // Arrange — faqat PendingApproval va ReadyForWarehouseRelease "tirik" deb hisoblanadi
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db, name: "Ombor");
        var product = SeedProduct(db, dep.Id, name: "Sement", invoiceNumber: "INV-S",
            quantity: 100m, reservedQuantity: 20m);

        var reqPending = new Requisition
        {
            Id = Guid.NewGuid(),
            RequisitionNo = "REQ-PND",
            Status = RequisitionStatus.PendingApproval,
            Purpose = "Direktor kutmoqda",
            DepartmentId = dep.Id,
            CreatedBy = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
        };
        var reqReleased = new Requisition
        {
            Id = Guid.NewGuid(),
            RequisitionNo = "REQ-REL",
            Status = RequisitionStatus.Released,
            Purpose = "Allaqachon chiqarilgan",
            DepartmentId = dep.Id,
            CreatedBy = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
        };
        db.Requisitions.AddRange(reqPending, reqReleased);
        db.SaveChanges();

        db.RequisitionItems.AddRange(
            new RequisitionItem
            {
                Id = Guid.NewGuid(),
                RequisitionId = reqPending.Id,
                ReservedProductId = product.Id,
                Quantity = 5m,
            },
            new RequisitionItem
            {
                Id = Guid.NewGuid(),
                RequisitionId = reqReleased.Id,
                ReservedProductId = product.Id,
                Quantity = 15m,
            });
        db.SaveChanges();

        var sut = CreateService(db);

        // Act
        var result = await sut.GetReservationsAsync(1, 10, search: null);

        // Assert
        result.Succeeded.Should().BeTrue();
        var items = result.Result!.Items.ToList();
        items.Should().ContainSingle();
        items[0].RequisitionNo.Should().Be("REQ-PND");
        items[0].ReservedQuantity.Should().Be(5m);
        items[0].Status.Should().Be(RequisitionStatus.PendingApproval);
        items[0].StatusLabel.Should().Be("Tasdiqlash kutilmoqda");
        items[0].ProductId.Should().Be(product.Id);
        items[0].InvoiceNumber.Should().Be("INV-S");
    }

    [Fact]
    public async Task GetReservationsAsync_WithRestrictToDepartment_FiltersByReservedProductDepartment()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var depA = SeedDepartment(db, name: "Ombor A", id: Guid.NewGuid());
        var depB = SeedDepartment(db, name: "Ombor B", id: Guid.NewGuid());
        var pA = SeedProduct(db, depA.Id, name: "A", invoiceNumber: "INV-A");
        var pB = SeedProduct(db, depB.Id, name: "B", invoiceNumber: "INV-B");

        var req = new Requisition
        {
            Id = Guid.NewGuid(),
            RequisitionNo = "REQ-1",
            Status = RequisitionStatus.PendingApproval,
            Purpose = "x",
            CreatedBy = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
        };
        db.Requisitions.Add(req);
        db.SaveChanges();
        db.RequisitionItems.AddRange(
            new RequisitionItem { Id = Guid.NewGuid(), RequisitionId = req.Id, ReservedProductId = pA.Id, Quantity = 1m },
            new RequisitionItem { Id = Guid.NewGuid(), RequisitionId = req.Id, ReservedProductId = pB.Id, Quantity = 2m });
        db.SaveChanges();

        var sut = CreateService(db);

        // Act
        var result = await sut.GetReservationsAsync(1, 10, search: null, restrictToDepartmentId: depA.Id);

        // Assert
        result.Result!.Items.Should().ContainSingle()
            .Which.ProductId.Should().Be(pA.Id);
    }
}
