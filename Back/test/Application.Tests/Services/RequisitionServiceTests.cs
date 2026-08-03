using Application.DTOs.Requisitions;
using Application.Helpers;
using Application.Services;
using Application.Services.Impl;
using Application.Tests.Infrastructure;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Moq;
using Xunit;
using Task = System.Threading.Tasks.Task;

namespace Application.Tests.Services;

public class RequisitionServiceTests
{
    // ─────────────────────────────────────────────────────────────────────
    //  Infrastructure
    // ─────────────────────────────────────────────────────────────────────

    /// <summary>
    /// EF InMemory provider <c>BeginTransaction()</c> chaqirilganda
    /// <see cref="InMemoryEventId.TransactionIgnoredWarning"/> ni warning-as-error
    /// sifatida ko'taradi. RequisitionService WarehouseCheck/Release ichida transaction
    /// ochadi — shu sababli shu test fayli uchun maxsus DbContext yasaymiz: warning'ni
    /// ignore qiladi va transaction no-op bo'lib o'tadi.
    /// </summary>
    private static DatabaseContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<DatabaseContext>()
            .UseInMemoryDatabase($"itm-req-{Guid.NewGuid():N}")
            .EnableSensitiveDataLogging()
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        var ctx = new DatabaseContext(options);
        ctx.Database.EnsureCreated();
        return ctx;
    }

    private static RequisitionService CreateService(DatabaseContext db, Mock<INotificationService>? notifications = null)
    {
        notifications ??= new Mock<INotificationService>();
        return new RequisitionService(db, notifications.Object, new Mock<IQrCodeService>().Object);
    }

    private static Department SeedDept(
        DatabaseContext db,
        string name = "Sex-1",
        DepartmentType type = DepartmentType.Bolim,
        bool isActive = true)
    {
        var d = new Department
        {
            Id = Guid.NewGuid(),
            Name = name,
            Type = type,
            IsActive = isActive,
            CreatedAt = DateTime.UtcNow,
        };
        db.Departments.Add(d);
        db.SaveChanges();
        return d;
    }

    private static Contract SeedContract(DatabaseContext db, Guid? creatorId = null)
    {
        var c = new Contract
        {
            Id = Guid.NewGuid(),
            ContractNo = "C-2026-001",
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(1)),
            ContractType = ContractType.Mahalliy,
            ContractParty = "Test partner",
            Status = ContractStatus.InProduction,
            IsActive = true,
            CreatedBy = creatorId ?? Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
        };
        db.Contracts.Add(c);
        db.SaveChanges();
        return c;
    }

    private static Material SeedMaterial(
        DatabaseContext db,
        string name = "Sement",
        string code = "MAT-001",
        string unit = "kg",
        decimal quantity = 1000m)
    {
        var m = new Material
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = name,
            Category = "Qurilish",
            Unit = unit,
            Quantity = quantity,
            Status = MaterialStatus.Available,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Materials.Add(m);
        db.SaveChanges();
        return m;
    }

    private static Product SeedProduct(
        DatabaseContext db,
        Guid departmentId,
        string name = "Sement",
        decimal quantity = 500m,
        decimal reservedQuantity = 0m,
        ProductUnit unit = ProductUnit.Kilogramm,
        string invoiceNumber = "INV-1")
    {
        var p = new Product
        {
            Id = Guid.NewGuid(),
            Name = name,
            InvoiceNumber = invoiceNumber,
            Quantity = quantity,
            ReservedQuantity = reservedQuantity,
            Unit = unit,
            DepartmentId = departmentId,
            CreatedAt = DateTime.UtcNow,
        };
        db.Products.Add(p);
        db.SaveChanges();
        return p;
    }

    /// <summary>
    /// Parent requisition (ombor tekshiruvini kutayotgan, default PendingWarehouseCheck statusda).
    /// </summary>
    private static Requisition SeedParentRequisition(
        DatabaseContext db,
        Guid createdBy,
        Guid? contractId = null,
        Guid? departmentId = null,
        IEnumerable<RequisitionItem>? items = null,
        RequisitionStatus status = RequisitionStatus.PendingWarehouseCheck,
        string no = "REQ-2026-001")
    {
        var r = new Requisition
        {
            Id = Guid.NewGuid(),
            RequisitionNo = no,
            Type = contractId.HasValue ? RequisitionType.Contract : RequisitionType.Individual,
            Status = status,
            ContractId = contractId,
            DepartmentId = departmentId,
            Purpose = "Test",
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow,
            Items = (items ?? []).ToList(),
        };
        db.Requisitions.Add(r);
        db.SaveChanges();
        return r;
    }

    private static RequisitionItem MakeItem(
        decimal quantity,
        Guid? materialId = null,
        string? freeName = null,
        decimal? available = null,
        Guid? reservedProductId = null) => new()
        {
            Id = Guid.NewGuid(),
            MaterialId = materialId,
            FreeTextName = freeName ?? (materialId.HasValue ? null : "Erkin material"),
            Quantity = quantity,
            AvailableQuantity = available,
            ReservedProductId = reservedProductId,
        };

    /// <summary>
    /// Warehouse-check permissionga ega userni seed qiladi — NotifyWarehouseCheckers
    /// to'g'ri ishlashini testlash uchun.
    /// </summary>
    private static User SeedWarehouseChecker(DatabaseContext db, string login = "checker")
    {
        var role = TestData.SeedRole(db, $"Omborchi-{Guid.NewGuid():N}");
        var perm = TestData.SeedPermission(db, PermissionModule.Requisitions, PermissionAction.WarehouseCheck);
        TestData.AttachPermissions(db, role.Id, perm.Id);
        return TestData.SeedUser(db, login: login, roleId: role.Id);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  CreateAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_WithValidContractDto_PersistsAsPendingWarehouseCheck()
    {
        // Arrange
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "creator");
        var contract = SeedContract(db);
        var material = SeedMaterial(db, name: "Sement");

        var dto = new RequisitionCreateDto
        {
            RequisitionNo = "  REQ-1  ",
            Type = RequisitionType.Contract,
            ContractId = contract.Id,
            Purpose = "Maqsad",
            Items =
            [
                new RequisitionItemCreateDto { MaterialId = material.Id, Quantity = 10m },
                new RequisitionItemCreateDto { FreeTextName = "Yangi tovar", Quantity = 3m },
            ],
        };

        // Act
        var result = await CreateService(db).CreateAsync(dto, creator.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        var saved = db.Requisitions.Include(r => r.Items).Single();
        saved.RequisitionNo.Should().Be("REQ-1", "talabnoma raqami trim qilinishi kerak");
        saved.Status.Should().Be(RequisitionStatus.PendingWarehouseCheck);
        saved.Type.Should().Be(RequisitionType.Contract);
        saved.ContractId.Should().Be(contract.Id);
        saved.CreatedBy.Should().Be(creator.Id);
        saved.Items.Should().HaveCount(2);
    }

    [Fact]
    public async Task CreateAsync_WithEmptyRequisitionNo_ReturnsFailure()
    {
        await using var db = CreateDb();
        var contract = SeedContract(db);
        var material = SeedMaterial(db);

        var result = await CreateService(db).CreateAsync(new RequisitionCreateDto
        {
            RequisitionNo = "   ",
            Type = RequisitionType.Contract,
            ContractId = contract.Id,
            Items = [new RequisitionItemCreateDto { MaterialId = material.Id, Quantity = 1m }],
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("nomini kiriting");
        db.Requisitions.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_ContractTypeWithoutContractId_ReturnsFailure()
    {
        await using var db = CreateDb();
        var material = SeedMaterial(db);

        var result = await CreateService(db).CreateAsync(new RequisitionCreateDto
        {
            RequisitionNo = "REQ-1",
            Type = RequisitionType.Contract,
            ContractId = null,
            Items = [new RequisitionItemCreateDto { MaterialId = material.Id, Quantity = 1m }],
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("ContractId majburiy");
    }

    [Fact]
    public async Task CreateAsync_IndividualTypeWithoutDepartmentId_ReturnsFailure()
    {
        await using var db = CreateDb();
        var material = SeedMaterial(db);

        var result = await CreateService(db).CreateAsync(new RequisitionCreateDto
        {
            RequisitionNo = "REQ-1",
            Type = RequisitionType.Individual,
            DepartmentId = null,
            Items = [new RequisitionItemCreateDto { MaterialId = material.Id, Quantity = 1m }],
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("DepartmentId majburiy");
    }

    [Fact]
    public async Task CreateAsync_WithoutItems_ReturnsFailure()
    {
        await using var db = CreateDb();
        var contract = SeedContract(db);

        var result = await CreateService(db).CreateAsync(new RequisitionCreateDto
        {
            RequisitionNo = "REQ-1",
            Type = RequisitionType.Contract,
            ContractId = contract.Id,
            Items = [],
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("bitta material");
    }

    [Fact]
    public async Task CreateAsync_ItemMissingBothMaterialAndFreeText_ReturnsFailure()
    {
        await using var db = CreateDb();
        var contract = SeedContract(db);

        var result = await CreateService(db).CreateAsync(new RequisitionCreateDto
        {
            RequisitionNo = "REQ-1",
            Type = RequisitionType.Contract,
            ContractId = contract.Id,
            Items = [new RequisitionItemCreateDto { Quantity = 5m }],
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("MaterialId yoki nomi");
    }

    [Fact]
    public async Task CreateAsync_DuplicateRequisitionNo_ReturnsFailure()
    {
        await using var db = CreateDb();
        var contract = SeedContract(db);
        var material = SeedMaterial(db);
        SeedParentRequisition(db, Guid.NewGuid(), contractId: contract.Id, no: "REQ-DUP");

        var result = await CreateService(db).CreateAsync(new RequisitionCreateDto
        {
            RequisitionNo = "REQ-DUP",
            Type = RequisitionType.Contract,
            ContractId = contract.Id,
            Items = [new RequisitionItemCreateDto { MaterialId = material.Id, Quantity = 1m }],
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("allaqachon mavjud");
    }

    [Fact]
    public async Task CreateAsync_NotifiesEligibleWarehouseCheckers()
    {
        // Arrange — bitta foydalanuvchida WarehouseCheck permission bor, ikkinchisida — yo'q.
        // Individual tip tanlandi: shartnoma tipida qo'shimcha me'yoriy sarf
        // validatsiyasi bor, bu test esa faqat bildirishnoma yo'nalishini tekshiradi.
        await using var db = CreateDb();
        var dept = SeedDept(db);
        var creator = TestData.SeedUser(db, login: "creator", departmentId: dept.Id);
        var checker = SeedWarehouseChecker(db);
        TestData.SeedUser(db, login: "no-perm");
        var notifications = new Mock<INotificationService>();

        // Act
        var result = await CreateService(db, notifications).CreateAsync(new RequisitionCreateDto
        {
            RequisitionNo = "REQ-N",
            Type = RequisitionType.Individual,
            DepartmentId = dept.Id,
            Items = [new RequisitionItemCreateDto { FreeTextName = "Sement", Quantity = 1m }],
        }, creator.Id);

        // Assert — bitta batch chaqiruv (har qabul qiluvchi uchun alohida
        // SaveChanges qilinmaydi) va ro'yxatda faqat WarehouseCheck permissionli user
        result.Succeeded.Should().BeTrue();
        notifications.Verify(
            n => n.NotifyManyAsync(
                It.Is<IEnumerable<Guid>>(ids => ids.SequenceEqual(new[] { checker.Id })),
                It.IsAny<string>(), It.IsAny<string>(), NotificationType.Info, It.IsAny<Guid?>()),
            Times.Once);
        notifications.Verify(
            n => n.CreateAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<NotificationType>(), It.IsAny<Guid?>()),
            Times.Never);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GetAllAsync / GetByIdAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAllAsync_ViewAllFalse_ReturnsOnlyOwnRequisitions()
    {
        // Arrange — Creator user'lar seed qilingan: InMemory + AsNoTracking + Include
        // chain'i navigation reference null bo'lganda yo'qotuvchan, shu sababli real User kerak.
        await using var db = CreateDb();
        var me = TestData.SeedUser(db, login: "me").Id;
        var other = TestData.SeedUser(db, login: "other").Id;
        SeedParentRequisition(db, me, no: "REQ-MINE-1");
        SeedParentRequisition(db, me, no: "REQ-MINE-2");
        SeedParentRequisition(db, other, no: "REQ-OTHER");

        // Act
        var result = await CreateService(db).GetAllAsync(me, viewAll: false);

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result!.Should().HaveCount(2)
            .And.OnlyContain(r => r.RequisitionNo.StartsWith("REQ-MINE"));
    }

    [Fact]
    public async Task GetAllAsync_ViewAllTrue_ReturnsAllRequisitions()
    {
        await using var db = CreateDb();
        var u1 = TestData.SeedUser(db, login: "u1").Id;
        var u2 = TestData.SeedUser(db, login: "u2").Id;
        SeedParentRequisition(db, u1, no: "A");
        SeedParentRequisition(db, u2, no: "B");

        // Sanity check: data persisted before query
        db.Requisitions.Count().Should().Be(2);

        var result = await CreateService(db).GetAllAsync(u1, viewAll: true);

        result.Succeeded.Should().BeTrue();
        result.Result!.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetAllAsync_WithStatusFilter_OnlyReturnsMatchingStatus()
    {
        await using var db = CreateDb();
        var me = TestData.SeedUser(db, login: "me").Id;
        SeedParentRequisition(db, me, no: "P", status: RequisitionStatus.PendingApproval);
        SeedParentRequisition(db, me, no: "W", status: RequisitionStatus.PendingWarehouseCheck);
        SeedParentRequisition(db, me, no: "R", status: RequisitionStatus.Rejected);

        var result = await CreateService(db).GetAllAsync(me, viewAll: true,
            status: RequisitionStatus.PendingApproval);

        result.Result!.Should().ContainSingle()
            .Which.RequisitionNo.Should().Be("P");
    }

    [Fact]
    public async Task GetByIdAsync_WhenNotFound_Returns404()
    {
        await using var db = CreateDb();

        var result = await CreateService(db).GetByIdAsync(Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsMappedDtoWithCreatorAndStatusLabels()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "alex", firstName: "Aleks", lastName: "Petrov");
        var req = SeedParentRequisition(db, creator.Id, no: "REQ-X", status: RequisitionStatus.PendingApproval);

        var result = await CreateService(db).GetByIdAsync(req.Id);

        result.Succeeded.Should().BeTrue();
        var dto = result.Result!;
        dto.RequisitionNo.Should().Be("REQ-X");
        dto.Status.Should().Be(RequisitionStatus.PendingApproval);
        dto.StatusLabel.Should().Be("Tasdiqlash kutilmoqda");
        dto.CreatedByName.Should().Be("Aleks Petrov");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  WarehouseCheckAsync — yangi parent → Split + children
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task WarehouseCheckAsync_WrongStatus_ReturnsFailure()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c");
        var checker = TestData.SeedUser(db, login: "ch");
        SeedDept(db, name: "Korxona ombori", type: DepartmentType.Omborxona);
        var req = SeedParentRequisition(db, creator.Id,
            status: RequisitionStatus.PendingApproval,  // noto'g'ri start status
            items: [MakeItem(quantity: 10m, freeName: "X")]);

        var result = await CreateService(db).WarehouseCheckAsync(req.Id,
            new RequisitionWarehouseCheckDto
            {
                Items = [new RequisitionWarehouseCheckItemDto
                {
                    ItemId = req.Items.First().Id,
                    AvailableQuantity = 5m,
                }],
            }, checker.Id);

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("ombor tekshiruvini kutayotgan");
    }

    [Fact]
    public async Task WarehouseCheckAsync_NoActiveWarehouseDepartment_ReturnsFailure()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c");
        var checker = TestData.SeedUser(db, login: "ch");
        // Omborxona bo'limi nofaol — IsActive=false
        SeedDept(db, name: "Eskirgan ombor", type: DepartmentType.Omborxona, isActive: false);
        var req = SeedParentRequisition(db, creator.Id,
            items: [MakeItem(quantity: 10m, freeName: "X")]);

        var result = await CreateService(db).WarehouseCheckAsync(req.Id,
            new RequisitionWarehouseCheckDto
            {
                Items = [new RequisitionWarehouseCheckItemDto
                {
                    ItemId = req.Items.First().Id,
                    AvailableQuantity = 0m,
                }],
            }, checker.Id);

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("Omborxona bo'limi sozlanmagan");
    }

    [Fact]
    public async Task WarehouseCheckAsync_NegativeAvailable_ReturnsFailure()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c");
        var checker = TestData.SeedUser(db, login: "ch");
        SeedDept(db, name: "Korxona", type: DepartmentType.Omborxona);
        var req = SeedParentRequisition(db, creator.Id,
            items: [MakeItem(quantity: 10m, freeName: "X")]);

        var result = await CreateService(db).WarehouseCheckAsync(req.Id,
            new RequisitionWarehouseCheckDto
            {
                Items = [new RequisitionWarehouseCheckItemDto
                {
                    ItemId = req.Items.First().Id,
                    AvailableQuantity = -1m,
                }],
            }, checker.Id);

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("manfiy");
    }

    [Fact]
    public async Task WarehouseCheckAsync_AvailableExceedsRequested_ReturnsFailure()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c");
        var checker = TestData.SeedUser(db, login: "ch");
        SeedDept(db, name: "Korxona", type: DepartmentType.Omborxona);
        var req = SeedParentRequisition(db, creator.Id,
            items: [MakeItem(quantity: 10m, freeName: "X")]);

        var result = await CreateService(db).WarehouseCheckAsync(req.Id,
            new RequisitionWarehouseCheckDto
            {
                Items = [new RequisitionWarehouseCheckItemDto
                {
                    ItemId = req.Items.First().Id,
                    AvailableQuantity = 15m,  // > so'ralgan 10
                }],
            }, checker.Id);

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("ko'p bo'lishi mumkin emas");
    }

    [Fact]
    public async Task WarehouseCheckAsync_AllAvailable_CreatesWarehouseChildAndReservesProduct()
    {
        // Arrange — omborxonada Sement 100 ta bor, talab 30 → hammasi mavjud
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c");
        var checker = TestData.SeedUser(db, login: "checker");
        var warehouse = SeedDept(db, name: "Korxona ombori", type: DepartmentType.Omborxona);
        var product = SeedProduct(db, warehouse.Id, name: "Sement",
            quantity: 100m, reservedQuantity: 0m);
        var contract = SeedContract(db);
        var req = SeedParentRequisition(db, creator.Id, contractId: contract.Id,
            items: [MakeItem(quantity: 30m, freeName: "Sement")]);
        var notifications = new Mock<INotificationService>();

        // Act
        var result = await CreateService(db, notifications).WarehouseCheckAsync(req.Id,
            new RequisitionWarehouseCheckDto
            {
                Items = [new RequisitionWarehouseCheckItemDto
                {
                    ItemId = req.Items.First().Id,
                    AvailableQuantity = 30m,
                    WarehouseNotes = "Mavjud",
                }],
            }, checker.Id);

        // Assert — parent Split, bitta W-child, P-child yo'q
        result.Succeeded.Should().BeTrue();
        var children = db.Requisitions.Include(r => r.Items).Where(r => r.ParentRequisitionId == req.Id).ToList();
        children.Should().ContainSingle();
        var whChild = children.Single();
        whChild.Source.Should().Be(RequisitionSource.Warehouse);
        whChild.Status.Should().Be(RequisitionStatus.PendingApproval);
        whChild.RequisitionNo.Should().EndWith("-W");
        whChild.Items.Single().Quantity.Should().Be(30m);
        whChild.Items.Single().OriginalQuantity.Should().Be(30m);
        whChild.Items.Single().ReservedProductId.Should().Be(product.Id);

        db.Requisitions.Single(r => r.Id == req.Id).Status.Should().Be(RequisitionStatus.Split);
        db.Requisitions.Single(r => r.Id == req.Id).WarehouseCheckedBy.Should().Be(checker.Id);
        db.Requisitions.Single(r => r.Id == req.Id).WarehouseCheckQrCodeData.Should().NotBeNullOrWhiteSpace();
        db.Products.Single(p => p.Id == product.Id).ReservedQuantity.Should().Be(30m);
    }

    [Fact]
    public async Task WarehouseCheckAsync_PartialAvailable_CreatesBothWarehouseAndPurchaseChildren()
    {
        // Arrange — talab 30, omborda 10 → W-child 10, P-child 20
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c");
        var checker = TestData.SeedUser(db, login: "ch");
        var warehouse = SeedDept(db, name: "Korxona", type: DepartmentType.Omborxona);
        SeedProduct(db, warehouse.Id, name: "Sement", quantity: 100m);
        var req = SeedParentRequisition(db, creator.Id,
            items: [MakeItem(quantity: 30m, freeName: "Sement")]);

        // Act
        var result = await CreateService(db).WarehouseCheckAsync(req.Id,
            new RequisitionWarehouseCheckDto
            {
                Items = [new RequisitionWarehouseCheckItemDto
                {
                    ItemId = req.Items.First().Id,
                    AvailableQuantity = 10m,
                }],
            }, checker.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result!.Should().HaveCount(2);
        var children = db.Requisitions.Include(r => r.Items).Where(r => r.ParentRequisitionId == req.Id).ToList();
        children.Should().HaveCount(2);
        children.Single(c => c.Source == RequisitionSource.Warehouse).Items.Single().Quantity.Should().Be(10m);
        children.Single(c => c.Source == RequisitionSource.Purchase).Items.Single().Quantity.Should().Be(20m);
        children.Single(c => c.Source == RequisitionSource.Warehouse).RequisitionNo.Should().EndWith("-W");
        children.Single(c => c.Source == RequisitionSource.Purchase).RequisitionNo.Should().EndWith("-P");
    }

    [Fact]
    public async Task WarehouseCheckAsync_NoneAvailable_CreatesPurchaseChildOnly()
    {
        // Arrange — talab 30, omborda 0 → faqat P-child
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c");
        var checker = TestData.SeedUser(db, login: "ch");
        SeedDept(db, name: "Korxona", type: DepartmentType.Omborxona);
        var req = SeedParentRequisition(db, creator.Id,
            items: [MakeItem(quantity: 30m, freeName: "Mavjud emas")]);

        // Act
        var result = await CreateService(db).WarehouseCheckAsync(req.Id,
            new RequisitionWarehouseCheckDto
            {
                Items = [new RequisitionWarehouseCheckItemDto
                {
                    ItemId = req.Items.First().Id,
                    AvailableQuantity = 0m,
                }],
            }, checker.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        var children = db.Requisitions.Where(r => r.ParentRequisitionId == req.Id).ToList();
        children.Should().ContainSingle()
            .Which.Source.Should().Be(RequisitionSource.Purchase);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  ApproveAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ApproveAsync_WarehouseSource_TransitionsToReadyForRelease_AndGeneratesQr()
    {
        await using var db = CreateDb();
        var director = TestData.SeedUser(db, login: "dir", firstName: "Direktor", lastName: "Bosh");
        var creator = TestData.SeedUser(db, login: "c");
        var child = SeedParentRequisition(db, creator.Id, no: "REQ-1-W",
            status: RequisitionStatus.PendingApproval,
            items: [MakeItem(quantity: 10m, freeName: "Sement")]);
        child.Source = RequisitionSource.Warehouse;
        db.SaveChanges();

        var result = await CreateService(db).ApproveAsync(child.Id, director.Id);

        result.Succeeded.Should().BeTrue();
        var saved = db.Requisitions.Single(r => r.Id == child.Id);
        saved.Status.Should().Be(RequisitionStatus.ReadyForWarehouseRelease);
        saved.ApprovedBy.Should().Be(director.Id);
        saved.ApprovedAt.Should().NotBeNull();
        saved.QrCodeData.Should().NotBeNullOrWhiteSpace("QR PNG base64 sifatida yozilishi kerak");
    }

    [Fact]
    public async Task ApproveAsync_PurchaseSource_TransitionsToReadyForPurchase()
    {
        await using var db = CreateDb();
        var director = TestData.SeedUser(db, login: "dir");
        var creator = TestData.SeedUser(db, login: "c");
        var child = SeedParentRequisition(db, creator.Id, no: "REQ-1-P",
            status: RequisitionStatus.PendingApproval,
            items: [MakeItem(quantity: 10m, freeName: "Yangi")]);
        child.Source = RequisitionSource.Purchase;
        db.SaveChanges();

        var result = await CreateService(db).ApproveAsync(child.Id, director.Id);

        result.Succeeded.Should().BeTrue();
        db.Requisitions.Single(r => r.Id == child.Id).Status
            .Should().Be(RequisitionStatus.ReadyForPurchase);
    }

    [Fact]
    public async Task ApproveAsync_WrongStatus_ReturnsFailure()
    {
        await using var db = CreateDb();
        var director = TestData.SeedUser(db, login: "dir");
        var creator = TestData.SeedUser(db, login: "c");
        var req = SeedParentRequisition(db, creator.Id, no: "REQ-PWC",
            status: RequisitionStatus.PendingWarehouseCheck);

        var result = await CreateService(db).ApproveAsync(req.Id, director.Id);

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("tasdiqlash kutayotgan");
    }

    [Fact]
    public async Task ApproveAsync_AlreadyRejected_BlockedByStatusGuard()
    {
        // Rad etilgan talabnoma qaytadan tasdiqlanishi mumkin emas — terminal status himoyasi
        await using var db = CreateDb();
        var director = TestData.SeedUser(db, login: "dir");
        var creator = TestData.SeedUser(db, login: "c");
        var req = SeedParentRequisition(db, creator.Id, no: "REQ-X",
            status: RequisitionStatus.Rejected);
        req.Source = RequisitionSource.Warehouse;
        db.SaveChanges();

        var result = await CreateService(db).ApproveAsync(req.Id, director.Id);

        result.Succeeded.Should().BeFalse();
        db.Requisitions.Single().Status.Should().Be(RequisitionStatus.Rejected);
    }

    [Fact]
    public async Task ApproveAsync_NotFound_Returns404()
    {
        await using var db = CreateDb();
        TestData.SeedUser(db, login: "dir");

        var result = await CreateService(db).ApproveAsync(Guid.NewGuid(), Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  RejectAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task RejectAsync_PendingApproval_SetsStatusAndReason()
    {
        await using var db = CreateDb();
        var director = TestData.SeedUser(db, login: "dir");
        var creator = TestData.SeedUser(db, login: "c");
        var child = SeedParentRequisition(db, creator.Id, no: "REQ-1-P",
            status: RequisitionStatus.PendingApproval,
            items: [MakeItem(quantity: 10m, freeName: "X")]);
        child.Source = RequisitionSource.Purchase;
        db.SaveChanges();

        var result = await CreateService(db).RejectAsync(child.Id, director.Id,
            new RequisitionRejectDto { RejectionReason = "Byudjet yo'q" });

        result.Succeeded.Should().BeTrue();
        var saved = db.Requisitions.Single(r => r.Id == child.Id);
        saved.Status.Should().Be(RequisitionStatus.Rejected);
        saved.RejectionReason.Should().Be("Byudjet yo'q");
        saved.ApprovedBy.Should().Be(director.Id);
        saved.ApprovedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task RejectAsync_WarehouseSource_ReleasesProductReservation()
    {
        // Arrange — omborchi 10 tani rezerv qilgan; Reject paytida 10 ta yana erkin bo'lishi kerak
        await using var db = CreateDb();
        var director = TestData.SeedUser(db, login: "dir");
        var creator = TestData.SeedUser(db, login: "c");
        var warehouse = SeedDept(db, name: "Korxona", type: DepartmentType.Omborxona);
        var product = SeedProduct(db, warehouse.Id, name: "Sement",
            quantity: 100m, reservedQuantity: 10m);
        var child = SeedParentRequisition(db, creator.Id, no: "REQ-1-W",
            status: RequisitionStatus.PendingApproval,
            items: [MakeItem(quantity: 10m, freeName: "Sement", reservedProductId: product.Id)]);
        child.Source = RequisitionSource.Warehouse;
        db.SaveChanges();

        // Act
        var result = await CreateService(db).RejectAsync(child.Id, director.Id,
            new RequisitionRejectDto { RejectionReason = "Kerakmas" });

        // Assert
        result.Succeeded.Should().BeTrue();
        db.Products.Single(p => p.Id == product.Id).ReservedQuantity.Should().Be(0m,
            "rad etilganda omborchi qo'ygan rezerv qaytarilishi kerak");
    }

    [Fact]
    public async Task RejectAsync_PurchaseSource_DoesNotTouchProductReservations()
    {
        // Sotib olinadigan childda hech qanday Product rezervi yo'q — Reject ta'sir qilmaydi
        await using var db = CreateDb();
        var director = TestData.SeedUser(db, login: "dir");
        var creator = TestData.SeedUser(db, login: "c");
        var warehouse = SeedDept(db, name: "Korxona", type: DepartmentType.Omborxona);
        var product = SeedProduct(db, warehouse.Id, name: "Sement",
            quantity: 100m, reservedQuantity: 25m);
        var child = SeedParentRequisition(db, creator.Id, no: "REQ-P",
            status: RequisitionStatus.PendingApproval,
            items: [MakeItem(quantity: 10m, freeName: "Sement", reservedProductId: product.Id)]);
        child.Source = RequisitionSource.Purchase;
        db.SaveChanges();

        var result = await CreateService(db).RejectAsync(child.Id, director.Id,
            new RequisitionRejectDto { RejectionReason = "—" });

        result.Succeeded.Should().BeTrue();
        db.Products.Single(p => p.Id == product.Id).ReservedQuantity
            .Should().Be(25m, "Purchase source rad etilganda Product.ReservedQuantity tegilmasin");
    }

    [Fact]
    public async Task RejectAsync_WrongStatus_ReturnsFailure()
    {
        await using var db = CreateDb();
        var director = TestData.SeedUser(db, login: "dir");
        var creator = TestData.SeedUser(db, login: "c");
        var req = SeedParentRequisition(db, creator.Id,
            status: RequisitionStatus.ReadyForPurchase);  // PendingApproval emas

        var result = await CreateService(db).RejectAsync(req.Id, director.Id,
            new RequisitionRejectDto { RejectionReason = "kech" });

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("tasdiqlash kutayotgan");
        db.Requisitions.Single().Status.Should().Be(RequisitionStatus.ReadyForPurchase);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  ReleaseAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ReleaseAsync_DeductsSourceProduct_UpsertsTargetProduct_TransitionsToReleased()
    {
        // Arrange:
        //   - omborxonada Sement 100 (10 ta rezervda)
        //   - target sex omborida hozircha shu nomdagi Product yo'q
        //   - child status=ReadyForWarehouseRelease, source=Warehouse, 10 ta sement
        await using var db = CreateDb();
        var warehouse = SeedDept(db, name: "Korxona ombori", type: DepartmentType.Omborxona);
        var targetDept = SeedDept(db, name: "Sex-1", type: DepartmentType.Bolim);
        var source = SeedProduct(db, warehouse.Id, name: "Sement",
            quantity: 100m, reservedQuantity: 10m);
        var creator = TestData.SeedUser(db, login: "c");
        var releaser = TestData.SeedUser(db, login: "rel");

        var child = SeedParentRequisition(db, creator.Id, no: "REQ-RELEASE",
            departmentId: targetDept.Id,
            status: RequisitionStatus.ReadyForWarehouseRelease,
            items: [MakeItem(quantity: 10m, freeName: "Sement", reservedProductId: source.Id)]);
        // Material orqali emas, free-text orqali ishlatamiz — `unit` default kg unitiga mos kelmaydi,
        // shu sababli FreeTextUnit qo'shamiz
        child.Items.First().FreeTextUnit = "kg";
        db.SaveChanges();

        // Act
        var result = await CreateService(db).ReleaseAsync(child.Id, releaser.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        db.Requisitions.Single(r => r.Id == child.Id).Status
            .Should().Be(RequisitionStatus.Released);

        var sourceAfter = db.Products.Single(p => p.Id == source.Id);
        sourceAfter.Quantity.Should().Be(90m, "korxona omborxonasidan 10 ta chiqib ketishi kerak");
        sourceAfter.ReservedQuantity.Should().Be(0m, "rezerv ham 10 ga kamayadi");

        var targetProduct = db.Products.SingleOrDefault(p =>
            p.DepartmentId == targetDept.Id && p.Name == "Sement");
        targetProduct.Should().NotBeNull("target bo'limda yangi Product yaratilishi kerak");
        targetProduct!.Quantity.Should().Be(10m);
        targetProduct.Unit.Should().Be(ProductUnit.Kilogramm);
    }

    [Fact]
    public async Task ReleaseAsync_WrongStatus_ReturnsFailure()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c");
        var releaser = TestData.SeedUser(db, login: "rel");
        var dept = SeedDept(db);
        var req = SeedParentRequisition(db, creator.Id,
            departmentId: dept.Id,
            status: RequisitionStatus.PendingApproval);

        var result = await CreateService(db).ReleaseAsync(req.Id, releaser.Id);

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("ombordan olishga tayyor");
    }

    [Fact]
    public async Task ReleaseAsync_WithoutDepartment_ReturnsFailure()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c");
        var releaser = TestData.SeedUser(db, login: "rel");
        var req = SeedParentRequisition(db, creator.Id,
            departmentId: null,
            status: RequisitionStatus.ReadyForWarehouseRelease,
            items: [MakeItem(quantity: 5m, freeName: "X")]);

        var result = await CreateService(db).ReleaseAsync(req.Id, releaser.Id);

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("bo'limga bog'lanmagan");
    }

    [Fact]
    public async Task ReleaseAsync_ReservedSourceProductMissing_FailsAndCreatesNoPhantomInventory()
    {
        // Phantom inventory regressiyasi: ReservedProductId belgilangan, lekin manba
        // Product mavjud emas (oraliqda o'chirilgan). Bunday holda chiqarish bekor
        // qilinishi va bo'lim omboriga HECH NARSA qo'shilmasligi kerak — aks holda
        // hech qaysi manbadan ayrilmagan zaxira "yo'qdan" paydo bo'lardi.
        await using var db = CreateDb();
        var targetDept = SeedDept(db, name: "Sex-1", type: DepartmentType.Bolim);
        var creator = TestData.SeedUser(db, login: "c");
        var releaser = TestData.SeedUser(db, login: "rel");

        var missingProductId = Guid.NewGuid(); // DB da yo'q
        var child = SeedParentRequisition(db, creator.Id, no: "REQ-PHANTOM",
            departmentId: targetDept.Id,
            status: RequisitionStatus.ReadyForWarehouseRelease,
            items: [MakeItem(quantity: 10m, freeName: "Sement", reservedProductId: missingProductId)]);
        child.Items.First().FreeTextUnit = "kg";
        db.SaveChanges();

        var result = await CreateService(db).ReleaseAsync(child.Id, releaser.Id);

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("zaxiralangan ombor mahsuloti topilmadi");

        // Bo'lim omborida hech narsa yaratilmagan bo'lishi kerak
        db.Products.Any(p => p.DepartmentId == targetDept.Id).Should().BeFalse(
            "manba topilmaganda phantom zaxira yaratilmasligi shart");

        // Talabnoma hali Released bo'lmasligi kerak
        db.Requisitions.Single(r => r.Id == child.Id).Status
            .Should().Be(RequisitionStatus.ReadyForWarehouseRelease);
    }

}
