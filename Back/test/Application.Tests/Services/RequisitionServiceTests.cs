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
        return new RequisitionService(db, notifications.Object, new Mock<IQrCodeService>().Object, new RequisitionAllowanceService(db));
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

    private static void SeedAllowanceRate(DatabaseContext db, decimal percent)
    {
        db.RequisitionAllowanceRates.Add(new RequisitionAllowanceRate
        {
            Id = Guid.NewGuid(),
            Percent = percent,
            CreatedAt = DateTime.UtcNow,
        });
        db.SaveChanges();
    }

    /// <summary>
    /// Shartnoma + bitta mahsulot (soni productQty) + bo'limga biriktirilmagan
    /// me'yoriy sarf qatorlari.
    /// </summary>
    private static Contract SeedContractWithNorm(
        DatabaseContext db, int productQty, params (string Name, string Unit, string? TotalQty)[] lines)
    {
        var contract = SeedContract(db);
        var product = new ContractProduct
        {
            Id = Guid.NewGuid(),
            ContractId = contract.Id,
            ProductType = "Mahsulot",
            Quantity = productQty,
            Unit = "dona",
        };
        db.ContractProducts.Add(product);
        db.CostNorms.Add(new CostNorm
        {
            Id = Guid.NewGuid(),
            ContractId = contract.Id,
            ContractProductId = product.Id,
            Title = "Me'yor",
            CreatedBy = Guid.NewGuid(),
            Items = lines.Select((l, i) => new CostNormItem
            {
                Id = Guid.NewGuid(),
                Name = l.Name,
                Unit = l.Unit,
                TotalQty = l.TotalQty,
                SortOrder = i,
            }).ToList(),
        });
        db.SaveChanges();
        return contract;
    }

    // DepartmentId ikkala tipda ham majburiy va yaratuvchining o'z bo'limi bo'lishi shart.
    private static RequisitionCreateDto NormRequisition(
        Guid contractId, User creator, decimal? allowancePercent, params (string Name, string Unit, decimal Quantity)[] items) => new()
    {
        Type = RequisitionType.Contract,
        ContractId = contractId,
        DepartmentId = creator.DepartmentId,
        Purpose = "Test",
        AllowancePercent = allowancePercent,
        Items = items.Select(i => new RequisitionItemCreateDto
        {
            FreeTextName = i.Name,
            FreeTextUnit = i.Unit,
            Quantity = i.Quantity,
        }).ToList(),
    };

    private static User SeedCreatorWithDept(DatabaseContext db)
    {
        var dept = SeedDept(db);
        return TestData.SeedUser(db, login: "creator", departmentId: dept.Id);
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

    /// <summary>
    /// Nom bo'sh yuborilsa xato emas — u manba hujjatdan (bu yerda bo'lim nomidan)
    /// yasaladi. Odatda nomni frontend to'ldirib yuboradi, bu zaxira yo'l.
    /// </summary>
    [Fact]
    public async Task CreateAsync_WithEmptyRequisitionNo_GeneratesNameFromSource()
    {
        await using var db = CreateDb();
        var dept = SeedDept(db);
        var creator = TestData.SeedUser(db, login: "creator", departmentId: dept.Id);
        var material = SeedMaterial(db);

        var result = await CreateService(db).CreateAsync(new RequisitionCreateDto
        {
            RequisitionNo = "   ",
            Type = RequisitionType.Individual,
            DepartmentId = dept.Id,
            Items = [new RequisitionItemCreateDto { MaterialId = material.Id, Quantity = 1m }],
        }, creator.Id);

        result.Succeeded.Should().BeTrue();
        var created = await db.Requisitions.SingleAsync();
        created.RequisitionNo.Should().Be("Sex-1 bo'lim talabnomasi");
    }

    /// <summary>
    /// Nomni foydalanuvchi kiritadi — kirill/rus yozuvi ham o'zgarishsiz saqlanadi
    /// (backend uni tarjima ham, transliteratsiya ham qilmaydi).
    /// </summary>
    [Fact]
    public async Task CreateAsync_WithUserProvidedName_StoresItVerbatim()
    {
        await using var db = CreateDb();
        var dept = SeedDept(db);
        var creator = TestData.SeedUser(db, login: "creator", departmentId: dept.Id);
        var material = SeedMaterial(db);

        var result = await CreateService(db).CreateAsync(new RequisitionCreateDto
        {
            RequisitionNo = "  Сех-1 бўлим талабномаси  ",
            Type = RequisitionType.Individual,
            DepartmentId = dept.Id,
            Items = [new RequisitionItemCreateDto { MaterialId = material.Id, Quantity = 1m }],
        }, creator.Id);

        result.Succeeded.Should().BeTrue();
        var created = await db.Requisitions.SingleAsync();
        created.RequisitionNo.Should().Be("Сех-1 бўлим талабномаси");
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

    /// <summary>
    /// Bitta manba bo'yicha bir nechta talabnoma odatiy hol — takroriy nom xato emas,
    /// oxiriga tartib raqami qo'shiladi. Qo'lda kiritilgan nom ham shu yo'ldan o'tadi.
    /// </summary>
    [Fact]
    public async Task CreateAsync_DuplicateRequisitionNo_AppendsSequence()
    {
        await using var db = CreateDb();
        var dept = SeedDept(db);
        var creator = TestData.SeedUser(db, login: "creator", departmentId: dept.Id);
        var material = SeedMaterial(db);
        SeedParentRequisition(db, creator.Id, departmentId: dept.Id, no: "REQ-DUP");

        var result = await CreateService(db).CreateAsync(new RequisitionCreateDto
        {
            RequisitionNo = "REQ-DUP",
            Type = RequisitionType.Individual,
            DepartmentId = dept.Id,
            Items = [new RequisitionItemCreateDto { MaterialId = material.Id, Quantity = 1m }],
        }, creator.Id);

        result.Succeeded.Should().BeTrue();
        var created = await db.Requisitions.SingleAsync(r => r.Id == result.Result);
        created.RequisitionNo.Should().Be("REQ-DUP (2)");
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
    //  CreateAsync — me'yoriy sarf va zaxira foizi
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_NormWithoutAllowance_AcceptsExactQuantity()
    {
        await using var db = CreateDb();
        var creator = SeedCreatorWithDept(db);
        SeedAllowanceRate(db, 3m);
        var contract = SeedContractWithNorm(db, 500, ("Круг сталь Ст3", "кг", "0,15"));

        var result = await CreateService(db).CreateAsync(
            NormRequisition(contract.Id, creator, null, ("Круг сталь Ст3", "кг", 75m)), creator.Id);

        result.Succeeded.Should().BeTrue();
        (await db.Requisitions.SingleAsync()).AllowancePercent.Should().BeNull();
    }

    [Fact]
    public async Task CreateAsync_NormWithAllowance_AcceptsRaisedQuantityAndStoresPercent()
    {
        await using var db = CreateDb();
        var creator = SeedCreatorWithDept(db);
        SeedAllowanceRate(db, 3m);
        var contract = SeedContractWithNorm(db, 500, ("Круг сталь Ст3", "кг", "0,15"));

        var result = await CreateService(db).CreateAsync(
            NormRequisition(contract.Id, creator, 3m, ("Круг сталь Ст3", "кг", 77.25m)), creator.Id);

        result.Succeeded.Should().BeTrue();
        (await db.Requisitions.SingleAsync()).AllowancePercent.Should().Be(3m);
    }

    [Fact]
    public async Task CreateAsync_NormWithAllowance_RoundsPieceUnitsUp()
    {
        await using var db = CreateDb();
        var creator = SeedCreatorWithDept(db);
        SeedAllowanceRate(db, 3m);
        var contract = SeedContractWithNorm(db, 7, ("Петля универсальная", "шт", "2"));

        // 2 × 7 = 14 → 14 × 1,03 = 14,42 → yuqoriga 15
        var result = await CreateService(db).CreateAsync(
            NormRequisition(contract.Id, creator, 3m, ("Петля универсальная", "шт", 15m)), creator.Id);

        result.Succeeded.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_AllowanceRequestedButExactQuantity_ReturnsFailure()
    {
        await using var db = CreateDb();
        var creator = SeedCreatorWithDept(db);
        SeedAllowanceRate(db, 3m);
        var contract = SeedContractWithNorm(db, 500, ("Круг сталь Ст3", "кг", "0,15"));

        var result = await CreateService(db).CreateAsync(
            NormRequisition(contract.Id, creator, 3m, ("Круг сталь Ст3", "кг", 75m)), creator.Id);

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("me'yoriy sarfiga mos emas");
    }

    [Fact]
    public async Task CreateAsync_AllowancePercentOutdated_ReturnsFailure()
    {
        await using var db = CreateDb();
        var creator = SeedCreatorWithDept(db);
        SeedAllowanceRate(db, 5m);
        var contract = SeedContractWithNorm(db, 500, ("Круг сталь Ст3", "кг", "0,15"));

        var result = await CreateService(db).CreateAsync(
            NormRequisition(contract.Id, creator, 3m, ("Круг сталь Ст3", "кг", 77.25m)), creator.Id);

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle()
            .Which.Should().Be("Zaxira foizi o'zgargan (hozir 5%) — me'yoriy sarfdan qayta to'ldiring.");
        db.Requisitions.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_AllowanceWhenCurrentIsZero_ReturnsFailure()
    {
        await using var db = CreateDb();
        var creator = SeedCreatorWithDept(db);
        var contract = SeedContractWithNorm(db, 500, ("Круг сталь Ст3", "кг", "0,15"));

        var result = await CreateService(db).CreateAsync(
            NormRequisition(contract.Id, creator, 3m, ("Круг сталь Ст3", "кг", 77.25m)), creator.Id);

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("hozir 0%");
    }

    [Fact]
    public async Task CreateAsync_AllowanceZero_TreatedAsWithoutAllowance()
    {
        await using var db = CreateDb();
        var creator = SeedCreatorWithDept(db);
        SeedAllowanceRate(db, 3m);
        var contract = SeedContractWithNorm(db, 500, ("Круг сталь Ст3", "кг", "0,15"));

        var result = await CreateService(db).CreateAsync(
            NormRequisition(contract.Id, creator, 0m, ("Круг сталь Ст3", "кг", 75m)), creator.Id);

        result.Succeeded.Should().BeTrue();
        (await db.Requisitions.SingleAsync()).AllowancePercent.Should().BeNull();
    }

    [Fact]
    public async Task CreateAsync_NormLineWithoutTotalQty_WithAllowance_Succeeds()
    {
        await using var db = CreateDb();
        var creator = SeedCreatorWithDept(db);
        SeedAllowanceRate(db, 3m);
        var contract = SeedContractWithNorm(db, 500,
            ("Круг сталь Ст3", "кг", "0,15"),
            ("Краска Хаки", "кг", null));

        // TotalQty bo'sh qatorga frontend 1 yuboradi — miqdori tekshirilmaydi.
        var result = await CreateService(db).CreateAsync(
            NormRequisition(contract.Id, creator, 3m,
                ("Круг сталь Ст3", "кг", 77.25m),
                ("Краска Хаки", "кг", 1m)), creator.Id);

        result.Succeeded.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_IndividualWithAllowance_StoresNull()
    {
        await using var db = CreateDb();
        var dept = SeedDept(db);
        var creator = TestData.SeedUser(db, login: "creator", departmentId: dept.Id);
        SeedAllowanceRate(db, 3m);

        var result = await CreateService(db).CreateAsync(new RequisitionCreateDto
        {
            Type = RequisitionType.Individual,
            DepartmentId = dept.Id,
            AllowancePercent = 3m,
            Items = [new RequisitionItemCreateDto { FreeTextName = "Sement", Quantity = 1m }],
        }, creator.Id);

        result.Succeeded.Should().BeTrue();
        (await db.Requisitions.SingleAsync()).AllowancePercent.Should().BeNull();
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

    [Fact]
    public async Task GetByIdAsync_ReturnsAllowancePercent()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "alex");
        var req = SeedParentRequisition(db, creator.Id, no: "REQ-A");
        req.AllowancePercent = 3m;
        db.SaveChanges();

        var result = await CreateService(db).GetByIdAsync(req.Id);

        result.Result!.AllowancePercent.Should().Be(3m);
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
    public async Task WarehouseCheckAsync_ChildrenInheritAllowancePercent()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c");
        var checker = TestData.SeedUser(db, login: "ch");
        var warehouse = SeedDept(db, name: "Korxona", type: DepartmentType.Omborxona);
        SeedProduct(db, warehouse.Id, name: "Sement", quantity: 100m);
        var req = SeedParentRequisition(db, creator.Id,
            items: [MakeItem(quantity: 30m, freeName: "Sement")]);
        req.AllowancePercent = 3m;
        db.SaveChanges();

        var result = await CreateService(db).WarehouseCheckAsync(req.Id,
            new RequisitionWarehouseCheckDto
            {
                Items = [new RequisitionWarehouseCheckItemDto
                {
                    ItemId = req.Items.First().Id,
                    AvailableQuantity = 10m,
                }],
            }, checker.Id);

        result.Succeeded.Should().BeTrue();
        db.Requisitions.Where(r => r.ParentRequisitionId == req.Id).ToList()
            .Should().HaveCount(2)
            .And.OnlyContain(c => c.AllowancePercent == 3m);
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
    public async Task RejectAsync_WarehouseSource_WritesReleaseMovement()
    {
        // Arrange — rezerv qaytarilishi ledgerda ham iz qoldirishi kerak, aks holda
        // Product.ReservedQuantity bilan (Reserve − Release) yig'indisi bir-biriga mos kelmaydi.
        await using var db = CreateDb();
        var director = TestData.SeedUser(db, login: "dir");
        var creator = TestData.SeedUser(db, login: "c");
        var warehouse = SeedDept(db, name: "Korxona", type: DepartmentType.Omborxona);
        var product = SeedProduct(db, warehouse.Id, name: "Sement",
            quantity: 100m, reservedQuantity: 10m);
        var contract = SeedContract(db, creator.Id);
        var child = SeedParentRequisition(db, creator.Id, contractId: contract.Id, no: "REQ-1-W",
            status: RequisitionStatus.PendingApproval,
            items: [MakeItem(quantity: 10m, freeName: "Sement", reservedProductId: product.Id)]);
        child.Source = RequisitionSource.Warehouse;
        db.SaveChanges();

        // Act
        var result = await CreateService(db).RejectAsync(child.Id, director.Id,
            new RequisitionRejectDto { RejectionReason = "Kerakmas" });

        // Assert
        result.Succeeded.Should().BeTrue();
        var movement = db.StockMovements.Should().ContainSingle().Subject;
        movement.Type.Should().Be(StockMovementType.Release);
        movement.ProductId.Should().Be(product.Id);
        movement.Quantity.Should().Be(10m);
        movement.QuantityAfter.Should().Be(100m, "rad etishda fizik qoldiq o'zgarmaydi");
        movement.SourceDepartmentId.Should().BeNull();
        movement.TargetDepartmentId.Should().Be(warehouse.Id);
        movement.RequisitionId.Should().Be(child.Id);
        movement.ContractId.Should().Be(contract.Id);
        movement.UserId.Should().Be(director.Id);
        movement.Notes.Should().Contain("REQ-1-W");
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

    [Fact]
    public async Task RejectAsync_SetsCompletedAtToApprovedAt()
    {
        await using var db = CreateDb();
        var director = TestData.SeedUser(db, login: "dir-completed");
        var creator = TestData.SeedUser(db, login: "c-completed");
        var child = SeedParentRequisition(db, creator.Id, no: "REQ-REJ-COMPLETED",
            status: RequisitionStatus.PendingApproval,
            items: [MakeItem(quantity: 10m, freeName: "X")]);
        child.Source = RequisitionSource.Purchase;
        db.SaveChanges();

        var result = await CreateService(db).RejectAsync(child.Id, director.Id,
            new RequisitionRejectDto { RejectionReason = "Byudjet yo'q" });

        result.Succeeded.Should().BeTrue();
        var saved = db.Requisitions.Single(r => r.Id == child.Id);
        saved.CompletedAt.Should().NotBeNull("rad etish ham yakunlanish hisoblanadi");
        saved.CompletedAt.Should().Be(saved.ApprovedAt);
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

    [Fact]
    public async Task ReleaseAsync_SetsCompletedAt()
    {
        await using var db = CreateDb();
        var warehouse = SeedDept(db, name: "Korxona ombori", type: DepartmentType.Omborxona);
        var targetDept = SeedDept(db, name: "Sex-1", type: DepartmentType.Bolim);
        var source = SeedProduct(db, warehouse.Id, name: "Sement",
            quantity: 100m, reservedQuantity: 10m);
        var creator = TestData.SeedUser(db, login: "c-rel-completed");
        var releaser = TestData.SeedUser(db, login: "rel-completed");

        var child = SeedParentRequisition(db, creator.Id, no: "REQ-REL-COMPLETED",
            departmentId: targetDept.Id,
            status: RequisitionStatus.ReadyForWarehouseRelease,
            items: [MakeItem(quantity: 10m, freeName: "Sement", reservedProductId: source.Id)]);
        child.Items.First().FreeTextUnit = "kg";
        db.SaveChanges();

        var before = DateTime.UtcNow;
        var result = await CreateService(db).ReleaseAsync(child.Id, releaser.Id);

        result.Succeeded.Should().BeTrue();
        var saved = db.Requisitions.Single(r => r.Id == child.Id);
        saved.Status.Should().Be(RequisitionStatus.Released);
        saved.CompletedAt.Should().NotBeNull();
        saved.CompletedAt!.Value.Should().BeOnOrAfter(before);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GetPagedAsync — faol / arxiv
    // ─────────────────────────────────────────────────────────────────────

    private static PaginationParams Page1(int size = 20) => new() { Page = 1, PageSize = size };

    [Fact]
    public async Task GetPagedAsync_ReturnsAllowancePercent()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "alex");
        var req = SeedParentRequisition(db, creator.Id, no: "REQ-A");
        req.AllowancePercent = 3m;
        db.SaveChanges();

        var result = await CreateService(db).GetPagedAsync(creator.Id, viewAll: true, Page1());

        result.Result!.Items.Single().AllowancePercent.Should().Be(3m);
    }

    [Fact]
    public async Task GetPagedAsync_ActiveView_KeepsApprovedButUnfulfilled()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c-active");
        SeedParentRequisition(db, creator.Id, no: "REQ-READY-W",
            status: RequisitionStatus.ReadyForWarehouseRelease);
        SeedParentRequisition(db, creator.Id, no: "REQ-READY-P",
            status: RequisitionStatus.ReadyForPurchase);
        SeedParentRequisition(db, creator.Id, no: "REQ-RELEASED",
            status: RequisitionStatus.Released);

        var result = await CreateService(db).GetPagedAsync(
            creator.Id, viewAll: true, Page1(), completed: false);

        result.Succeeded.Should().BeTrue();
        result.Result!.Items.Select(i => i.RequisitionNo)
            .Should().BeEquivalentTo(["REQ-READY-W", "REQ-READY-P"],
                "tasdiqlangan, lekin hali berilmagan talabnoma faol qoladi");
    }

    [Fact]
    public async Task GetPagedAsync_ArchiveView_ReturnsOnlyFulfilled()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c-arch");
        SeedParentRequisition(db, creator.Id, no: "REQ-RELEASED", status: RequisitionStatus.Released);
        SeedParentRequisition(db, creator.Id, no: "REQ-DELIVERED", status: RequisitionStatus.Delivered);
        SeedParentRequisition(db, creator.Id, no: "REQ-REJECTED", status: RequisitionStatus.Rejected);
        SeedParentRequisition(db, creator.Id, no: "REQ-READY-W",
            status: RequisitionStatus.ReadyForWarehouseRelease);

        var result = await CreateService(db).GetPagedAsync(
            creator.Id, viewAll: true, Page1(), completed: true);

        result.Result!.Items.Select(i => i.RequisitionNo)
            .Should().BeEquivalentTo(["REQ-RELEASED", "REQ-DELIVERED", "REQ-REJECTED"]);
    }

    [Fact]
    public async Task GetPagedAsync_SplitParent_IsActiveUntilEveryChildIsFulfilled()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c-split");
        var parent = SeedParentRequisition(db, creator.Id, no: "REQ-SPLIT",
            status: RequisitionStatus.Split);

        var releasedChild = SeedParentRequisition(db, creator.Id, no: "REQ-SPLIT-W",
            status: RequisitionStatus.Released);
        releasedChild.ParentRequisitionId = parent.Id;
        releasedChild.CompletedAt = DateTime.UtcNow;

        var pendingChild = SeedParentRequisition(db, creator.Id, no: "REQ-SPLIT-P",
            status: RequisitionStatus.ReadyForPurchase);
        pendingChild.ParentRequisitionId = parent.Id;
        db.SaveChanges();

        var svc = CreateService(db);

        var active = await svc.GetPagedAsync(creator.Id, viewAll: true, Page1(), completed: false);
        active.Result!.Items.Select(i => i.RequisitionNo).Should().Contain("REQ-SPLIT");

        pendingChild.Status = RequisitionStatus.Delivered;
        pendingChild.CompletedAt = DateTime.UtcNow;
        db.SaveChanges();

        var archive = await svc.GetPagedAsync(creator.Id, viewAll: true, Page1(), completed: true);
        archive.Result!.Items.Select(i => i.RequisitionNo).Should().Contain("REQ-SPLIT");
    }

    [Fact]
    public async Task GetPagedAsync_RejectedFilter_SeparatesFullyRejectedFromPartial()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c-rejfilter");

        // 1) o'zi rad etilgan (bo'linmagan)
        SeedParentRequisition(db, creator.Id, no: "REQ-SELF-REJ", status: RequisitionStatus.Rejected);

        // 2) split — ikkala child ham rad etilgan
        var allRejected = SeedParentRequisition(db, creator.Id, no: "REQ-ALL-REJ",
            status: RequisitionStatus.Split);
        foreach (var no in new[] { "REQ-ALL-REJ-W", "REQ-ALL-REJ-P" })
        {
            var c = SeedParentRequisition(db, creator.Id, no: no, status: RequisitionStatus.Rejected);
            c.ParentRequisitionId = allRejected.Id;
        }

        // 3) split — bittasi rad, bittasi berilgan
        var partial = SeedParentRequisition(db, creator.Id, no: "REQ-PARTIAL",
            status: RequisitionStatus.Split);
        var rejectedChild = SeedParentRequisition(db, creator.Id, no: "REQ-PARTIAL-W",
            status: RequisitionStatus.Rejected);
        rejectedChild.ParentRequisitionId = partial.Id;
        var releasedChild = SeedParentRequisition(db, creator.Id, no: "REQ-PARTIAL-P",
            status: RequisitionStatus.Delivered);
        releasedChild.ParentRequisitionId = partial.Id;
        db.SaveChanges();

        var svc = CreateService(db);

        var rejected = await svc.GetPagedAsync(creator.Id, viewAll: true, Page1(), rejected: true);
        rejected.Result!.Items.Select(i => i.RequisitionNo)
            .Should().BeEquivalentTo(["REQ-SELF-REJ", "REQ-ALL-REJ"]);

        var completed = await svc.GetPagedAsync(creator.Id, viewAll: true, Page1(),
            completed: true, rejected: false);
        completed.Result!.Items.Select(i => i.RequisitionNo)
            .Should().BeEquivalentTo(["REQ-PARTIAL"],
                "qisman rad etilganda haqiqiy natija bor — u Yakunlangan sub-tabida qoladi");
    }

    [Fact]
    public async Task GetPagedAsync_ArchiveView_OrdersByCompletedAtDescending()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c-order");
        var old = SeedParentRequisition(db, creator.Id, no: "REQ-OLD", status: RequisitionStatus.Released);
        old.CompletedAt = DateTime.UtcNow.AddDays(-30);
        var fresh = SeedParentRequisition(db, creator.Id, no: "REQ-FRESH", status: RequisitionStatus.Delivered);
        fresh.CompletedAt = DateTime.UtcNow.AddDays(-1);
        db.SaveChanges();

        var result = await CreateService(db).GetPagedAsync(
            creator.Id, viewAll: true, Page1(), completed: true);

        result.Result!.Items.Select(i => i.RequisitionNo)
            .Should().ContainInOrder("REQ-FRESH", "REQ-OLD");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GetPagedAsync — status filtri: real oqim shakli (Split parent + childlar)
    //  Yuqoridagi status-filtr testlari parent qatorlarga to'g'ridan-to'g'ri
    //  status seed qiladi — bu real WarehouseCheckAsync hech qachon yaratmaydigan
    //  holat (parent faqat PendingWarehouseCheck yoki Split bo'ladi, qolgan
    //  statuslar faqat childlarda yashaydi). Shu testlar haqiqiy shaklni tekshiradi.
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetPagedAsync_StatusFilter_SplitParentMatchesByChildStatus_InActiveList()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c-status-active");
        var parent = SeedParentRequisition(db, creator.Id, no: "REQ-STATUS-ACTIVE",
            status: RequisitionStatus.Split);

        var whChild = SeedParentRequisition(db, creator.Id, no: "REQ-STATUS-ACTIVE-W",
            status: RequisitionStatus.ReadyForWarehouseRelease);
        whChild.ParentRequisitionId = parent.Id;

        var pChild = SeedParentRequisition(db, creator.Id, no: "REQ-STATUS-ACTIVE-P",
            status: RequisitionStatus.ReadyForPurchase);
        pChild.ParentRequisitionId = parent.Id;
        db.SaveChanges();

        var result = await CreateService(db).GetPagedAsync(
            creator.Id, viewAll: true, Page1(), completed: false, status: RequisitionStatus.ReadyForPurchase);

        result.Result!.Items.Select(i => i.RequisitionNo).Should().Contain("REQ-STATUS-ACTIVE",
            "status faqat childda yashaydi — parent shu childning statusi bo'yicha topilishi kerak");
    }

    [Fact]
    public async Task GetPagedAsync_StatusFilter_SplitParentMatchesByChildStatus_InArchiveList()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c-status-archive");
        var parent = SeedParentRequisition(db, creator.Id, no: "REQ-STATUS-ARCH",
            status: RequisitionStatus.Split);

        var releasedChild = SeedParentRequisition(db, creator.Id, no: "REQ-STATUS-ARCH-W",
            status: RequisitionStatus.Released);
        releasedChild.ParentRequisitionId = parent.Id;
        releasedChild.CompletedAt = DateTime.UtcNow;

        var deliveredChild = SeedParentRequisition(db, creator.Id, no: "REQ-STATUS-ARCH-P",
            status: RequisitionStatus.Delivered);
        deliveredChild.ParentRequisitionId = parent.Id;
        deliveredChild.CompletedAt = DateTime.UtcNow;
        db.SaveChanges();

        var result = await CreateService(db).GetPagedAsync(
            creator.Id, viewAll: true, Page1(), completed: true, status: RequisitionStatus.Released);

        result.Result!.Items.Select(i => i.RequisitionNo).Should().Contain("REQ-STATUS-ARCH",
            "arxiv ko'rinishida ham status filtri child statusiga qarab ishlashi kerak");
    }

    [Fact]
    public async Task GetPagedAsync_StatusFilter_UnsplitParentMatchesOwnStatus()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c-status-unsplit");
        SeedParentRequisition(db, creator.Id, no: "REQ-STATUS-PWC",
            status: RequisitionStatus.PendingWarehouseCheck);

        var result = await CreateService(db).GetPagedAsync(
            creator.Id, viewAll: true, Page1(), status: RequisitionStatus.PendingWarehouseCheck);

        result.Result!.Items.Select(i => i.RequisitionNo).Should().Contain("REQ-STATUS-PWC",
            "bo'linmagan parentda status hali o'zida — non-split filial ishlashi kerak");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GetRecentCompletedAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetRecentCompletedAsync_ReturnsOnlyInsideWindow()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c-recent");
        var inside = SeedParentRequisition(db, creator.Id, no: "REQ-6-DAYS",
            status: RequisitionStatus.Released);
        inside.CompletedAt = DateTime.UtcNow.AddDays(-6);
        var outside = SeedParentRequisition(db, creator.Id, no: "REQ-8-DAYS",
            status: RequisitionStatus.Delivered);
        outside.CompletedAt = DateTime.UtcNow.AddDays(-8);
        db.SaveChanges();

        var result = await CreateService(db).GetRecentCompletedAsync(creator.Id, viewAll: true, days: 7);

        result.Succeeded.Should().BeTrue();
        result.Result!.Select(i => i.RequisitionNo).Should().BeEquivalentTo(["REQ-6-DAYS"]);
    }

    [Fact]
    public async Task GetRecentCompletedAsync_LimitsToTenNewest()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c-recent-limit");
        for (var i = 0; i < 14; i++)
        {
            var r = SeedParentRequisition(db, creator.Id, no: $"REQ-{i:D2}",
                status: RequisitionStatus.Released);
            r.CompletedAt = DateTime.UtcNow.AddHours(-i);
        }
        db.SaveChanges();

        var result = await CreateService(db).GetRecentCompletedAsync(creator.Id, viewAll: true, days: 7);

        result.Result!.Should().HaveCount(10);
        result.Result!.First().RequisitionNo.Should().Be("REQ-00", "eng yangisi birinchi");
    }

    [Fact]
    public async Task GetRecentCompletedAsync_SplitParent_UsesLatestChildCompletion()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c-recent-split");
        var parent = SeedParentRequisition(db, creator.Id, no: "REQ-SPLIT-RECENT",
            status: RequisitionStatus.Split);

        var oldChild = SeedParentRequisition(db, creator.Id, no: "REQ-SPLIT-RECENT-W",
            status: RequisitionStatus.Released);
        oldChild.ParentRequisitionId = parent.Id;
        oldChild.CompletedAt = DateTime.UtcNow.AddDays(-20);

        var newChild = SeedParentRequisition(db, creator.Id, no: "REQ-SPLIT-RECENT-P",
            status: RequisitionStatus.Delivered);
        newChild.ParentRequisitionId = parent.Id;
        newChild.CompletedAt = DateTime.UtcNow.AddDays(-2);
        db.SaveChanges();

        var result = await CreateService(db).GetRecentCompletedAsync(creator.Id, viewAll: true, days: 7);

        var dto = result.Result!.Single();
        dto.RequisitionNo.Should().Be("REQ-SPLIT-RECENT");
        dto.CompletedAt.Should().Be(newChild.CompletedAt, "oxirgi child yakunlangan payt");
    }

    [Fact]
    public async Task GetRecentCompletedAsync_ViewAllFalse_ReturnsOnlyOwn()
    {
        await using var db = CreateDb();
        var mine = TestData.SeedUser(db, login: "c-recent-mine");
        var other = TestData.SeedUser(db, login: "c-recent-other");
        var a = SeedParentRequisition(db, mine.Id, no: "REQ-MINE", status: RequisitionStatus.Released);
        a.CompletedAt = DateTime.UtcNow.AddDays(-1);
        var b = SeedParentRequisition(db, other.Id, no: "REQ-OTHER", status: RequisitionStatus.Released);
        b.CompletedAt = DateTime.UtcNow.AddDays(-1);
        db.SaveChanges();

        var result = await CreateService(db).GetRecentCompletedAsync(mine.Id, viewAll: false, days: 7);

        result.Result!.Select(i => i.RequisitionNo).Should().BeEquivalentTo(["REQ-MINE"]);
    }
}
