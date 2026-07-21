using Application.DTOs.Shipments;
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

public class ShipmentBatchServiceTests
{
    // ─────────────────────────────────────────────────────────────────────
    //  Infrastructure
    //
    //  ⚠️  Note: ShipmentBatchService bu — *jo'natma partiyalari* servisi. Unda
    //  Preparing→Shipped→Delivered kabi status mashinasi yoki batch-item ro'yxati
    //  YO'Q. Har partiya shartnomaga (va ixtiyoriy mahsulot/bo'limga) bog'lanadi.
    //  Asosiy biznes qoidasi: partiya miqdori "ombor topshirish" vazifasining
    //  CompletedAmount qoldig'idan (allaqachon jo'natilgan miqdor ayirilgan) oshmasligi.
    //  BatchNo har (shartnoma, mahsulot) juftligi uchun ketma-ket o'sadi.
    //  Servis faqat IActivityLogService ga bog'liq (INotificationService emas).
    // ─────────────────────────────────────────────────────────────────────

    private const string WarehouseTaskName = "Tayyor mahsulotni omborga topshirish";

    private sealed record SutBundle(
        ShipmentBatchService Service,
        Mock<IActivityLogService> ActivityLog);

    private static SutBundle CreateSut(DatabaseContext db)
    {
        var activityLog = new Mock<IActivityLogService>();
        var service = new ShipmentBatchService(db, activityLog.Object);
        return new SutBundle(service, activityLog);
    }

    private static Contract SeedContract(
        DatabaseContext db,
        string contractNo = "C-2026-001",
        bool isActive = true,
        Guid? id = null)
    {
        var contract = new Contract
        {
            Id = id ?? Guid.NewGuid(),
            ContractNo = contractNo,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(6)),
            ContractType = ContractType.Mahalliy,
            ContractParty = "Partner",
            Status = ContractStatus.InProduction,
            IsActive = isActive,
            CreatedBy = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
        };
        db.Contracts.Add(contract);
        db.SaveChanges();
        return contract;
    }

    private static ContractProduct SeedProduct(
        DatabaseContext db,
        Guid contractId,
        string productType = "Eshik",
        Guid? id = null)
    {
        var product = new ContractProduct
        {
            Id = id ?? Guid.NewGuid(),
            ContractId = contractId,
            ProductType = productType,
            Quantity = 10,
            Unit = "dona",
            OrderIndex = 0,
            Status = ContractProductStatus.InProduction,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        db.ContractProducts.Add(product);
        db.SaveChanges();
        return product;
    }

    private static Department SeedDepartment(
        DatabaseContext db,
        string name = "Ombor",
        Guid? id = null)
    {
        var dept = new Department
        {
            Id = id ?? Guid.NewGuid(),
            Name = name,
            Type = DepartmentType.Bolim,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        db.Departments.Add(dept);
        db.SaveChanges();
        return dept;
    }

    /// <summary>
    /// Adds a User row for <paramref name="id"/> if missing. EF InMemory treats the
    /// non-nullable CreatedBy FK as a required join, so reads that Include the Creator
    /// drop rows whose creator doesn't exist — seed one to keep them visible.
    /// </summary>
    private static Guid EnsureUser(DatabaseContext db, Guid? id = null)
    {
        var userId = id ?? Guid.NewGuid();
        if (!db.Users.Any(u => u.Id == userId))
        {
            db.Users.Add(new User
            {
                Id = userId,
                Login = $"user-{userId:N}",
                FirstName = "First",
                LastName = "Last",
                PasswordHash = "hash",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            });
            db.SaveChanges();
        }
        return userId;
    }

    /// <summary>
    /// Seeds the "ombor topshirish" task — its <c>CompletedAmount</c> is the ceiling
    /// for how much can be shipped for the (contract, product) pair.
    /// </summary>
    private static ContractTask SeedWarehouseTask(
        DatabaseContext db,
        Guid contractId,
        decimal completedAmount,
        Guid? contractProductId = null,
        bool isActive = true)
    {
        var task = new ContractTask
        {
            Id = Guid.NewGuid(),
            ContractId = contractId,
            ContractProductId = contractProductId,
            OrderNo = 1,
            Name = WarehouseTaskName,
            CompletedAmount = completedAmount,
            TotalAmount = 100,
            Importance = 50,
            IsActive = isActive,
            CreatedBy = EnsureUser(db),
            CreatedAt = DateTime.UtcNow,
        };
        db.ContractTasks.Add(task);
        db.SaveChanges();
        return task;
    }

    private static ShipmentBatch SeedBatch(
        DatabaseContext db,
        Guid contractId,
        decimal amount,
        int batchNo,
        Guid? contractProductId = null,
        Guid? createdBy = null,
        ShipmentBatchKind kind = ShipmentBatchKind.Production)
    {
        var batch = new ShipmentBatch
        {
            Id = Guid.NewGuid(),
            ContractId = contractId,
            ContractProductId = contractProductId,
            Kind = kind,
            BatchNo = batchNo,
            Amount = amount,
            CreatedBy = EnsureUser(db, createdBy),
            CreatedAt = DateTime.UtcNow,
        };
        db.ShipmentBatches.Add(batch);
        db.SaveChanges();
        return batch;
    }

    // ─────────────────────────────────────────────────────────────────────
    //  CreateAsync — validation
    // ─────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public async Task CreateAsync_NonPositiveAmount_ReturnsFailure(decimal amount)
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            Amount = amount,
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("0 dan katta");
        db.ShipmentBatches.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_NonExistentContract_Returns404()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = Guid.NewGuid(),
            Amount = 5,
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
        result.Errors.Should().ContainSingle().Which.Should().Contain("topilmadi");
        db.ShipmentBatches.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_ContractProductFromAnotherContract_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var contractA = SeedContract(db, contractNo: "C-A");
        var contractB = SeedContract(db, contractNo: "C-B");
        var productOfB = SeedProduct(db, contractB.Id);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contractA.Id,
            ContractProductId = productOfB.Id,
            Amount = 5,
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("ushbu shartnomaga tegishli emas");
        db.ShipmentBatches.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_NonExistentDepartment_Returns404()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedWarehouseTask(db, contract.Id, completedAmount: 100);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            DepartmentId = Guid.NewGuid(),
            Amount = 5,
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
        result.Errors.Should().ContainSingle().Which.Should().Contain("topilmadi");
        db.ShipmentBatches.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_NoWarehouseTask_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            Amount = 5,
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("ombor vazifasi topilmadi");
        db.ShipmentBatches.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_InactiveWarehouseTask_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedWarehouseTask(db, contract.Id, completedAmount: 100, isActive: false);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            Amount = 5,
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("ombor vazifasi topilmadi");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  CreateAsync — availability cap (qty vs warehouse completed amount)
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_AmountExceedingWarehouseCompletedAmount_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedWarehouseTask(db, contract.Id, completedAmount: 30);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            Amount = 31, // 30 tayyor, 31 — oshib ketadi
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("oshib ketdi");
        db.ShipmentBatches.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_AmountEqualToAvailable_Succeeds()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedWarehouseTask(db, contract.Id, completedAmount: 30);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            Amount = 30, // == mavjud, ruxsat etiladi
        }, EnsureUser(db));

        result.Succeeded.Should().BeTrue();
        result.StatusCode.Should().Be(201);
    }

    [Fact]
    public async Task CreateAsync_AlreadyShippedReducesAvailable_RejectsOverage()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedWarehouseTask(db, contract.Id, completedAmount: 30);
        SeedBatch(db, contract.Id, amount: 25, batchNo: 1); // qoldiq = 5
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            Amount = 6, // qoldiq 5 dan oshadi
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("Mavjud: 5");
        db.ShipmentBatches.Should().ContainSingle("yangi partiya qo'shilmaydi");
    }

    [Fact]
    public async Task CreateAsync_WithinRemainingAfterPriorShipment_Succeeds()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedWarehouseTask(db, contract.Id, completedAmount: 30);
        SeedBatch(db, contract.Id, amount: 25, batchNo: 1); // qoldiq = 5
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            Amount = 5,
        }, EnsureUser(db));

        result.Succeeded.Should().BeTrue();
        db.ShipmentBatches.Should().HaveCount(2);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  CreateAsync — persistence, batch numbering, activity log
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_Valid_PersistsBatch_WithBatchNo1_AndReturns201()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db, contractNo: "C-SHIP");
        SeedWarehouseTask(db, contract.Id, completedAmount: 50);
        var creator = EnsureUser(db);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            Amount = 20,
        }, creator);

        result.Succeeded.Should().BeTrue();
        result.StatusCode.Should().Be(201);
        result.Result!.BatchNo.Should().Be(1);
        result.Result.Amount.Should().Be(20);

        var saved = db.ShipmentBatches.AsNoTracking().Single();
        saved.ContractId.Should().Be(contract.Id);
        saved.BatchNo.Should().Be(1);
        saved.Amount.Should().Be(20);
        saved.CreatedBy.Should().Be(creator);
    }

    [Fact]
    public async Task CreateAsync_Valid_LogsShipmentActivity()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db, contractNo: "C-LOG");
        SeedWarehouseTask(db, contract.Id, completedAmount: 50);
        var creator = EnsureUser(db);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            Amount = 12,
        }, creator);

        result.Succeeded.Should().BeTrue();
        sut.ActivityLog.Verify(a => a.LogAsync(
            "shipment",
            It.Is<string>(t => t.Contains("#1") && t.Contains("12")),
            "C-LOG",
            creator,
            It.Is<Guid?>(id => id == result.Result!.Id)),
            Times.Once);
    }

    [Fact]
    public async Task CreateAsync_SecondBatch_IncrementsBatchNo()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedWarehouseTask(db, contract.Id, completedAmount: 100);
        SeedBatch(db, contract.Id, amount: 10, batchNo: 1);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            Amount = 10,
        }, EnsureUser(db));

        result.Succeeded.Should().BeTrue();
        result.Result!.BatchNo.Should().Be(2, "mavjud eng katta BatchNo (1) dan keyingisi");
    }

    [Fact]
    public async Task CreateAsync_BatchNo_IsScopedPerProduct()
    {
        // BatchNo har (shartnoma, mahsulot) juftligi uchun alohida sanaladi.
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var product = SeedProduct(db, contract.Id);
        SeedWarehouseTask(db, contract.Id, completedAmount: 100, contractProductId: product.Id);
        // Boshqa mahsulotsiz partiya — bu BatchNo ga ta'sir qilmasligi kerak.
        SeedBatch(db, contract.Id, amount: 10, batchNo: 7, contractProductId: null);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            ContractProductId = product.Id,
            Amount = 10,
        }, EnsureUser(db));

        result.Succeeded.Should().BeTrue();
        result.Result!.BatchNo.Should().Be(1, "bu mahsulot uchun birinchi partiya");
    }

    [Fact]
    public async Task CreateAsync_WithDepartment_PersistsDepartmentName()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var dept = SeedDepartment(db, name: "Tayyor mahsulot ombori");
        SeedWarehouseTask(db, contract.Id, completedAmount: 50);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            DepartmentId = dept.Id,
            Amount = 10,
        }, EnsureUser(db));

        result.Succeeded.Should().BeTrue();
        result.Result!.DepartmentName.Should().Be("Tayyor mahsulot ombori");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GetByContractAsync — filters
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetByContractAsync_ReturnsBatchesForContract_OrderedByBatchNo()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedBatch(db, contract.Id, amount: 5, batchNo: 2);
        SeedBatch(db, contract.Id, amount: 5, batchNo: 1);
        SeedBatch(db, contract.Id, amount: 5, batchNo: 3);
        var sut = CreateSut(db);

        var result = await sut.Service.GetByContractAsync(contract.Id, null, null);

        result.Succeeded.Should().BeTrue();
        result.Result!.Select(b => b.BatchNo).Should().Equal(1, 2, 3);
    }

    [Fact]
    public async Task GetByContractAsync_OtherContractsExcluded()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db, contractNo: "C-MINE");
        var other = SeedContract(db, contractNo: "C-OTHER");
        SeedBatch(db, contract.Id, amount: 5, batchNo: 1);
        SeedBatch(db, other.Id, amount: 9, batchNo: 1);
        var sut = CreateSut(db);

        var result = await sut.Service.GetByContractAsync(contract.Id, null, null);

        result.Succeeded.Should().BeTrue();
        result.Result!.Should().ContainSingle().Which.Amount.Should().Be(5);
    }

    [Fact]
    public async Task GetByContractAsync_FiltersByContractProductId()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var productA = SeedProduct(db, contract.Id, productType: "A");
        var productB = SeedProduct(db, contract.Id, productType: "B");
        SeedBatch(db, contract.Id, amount: 5, batchNo: 1, contractProductId: productA.Id);
        SeedBatch(db, contract.Id, amount: 5, batchNo: 1, contractProductId: productB.Id);
        SeedBatch(db, contract.Id, amount: 5, batchNo: 2, contractProductId: productA.Id);
        var sut = CreateSut(db);

        var result = await sut.Service.GetByContractAsync(contract.Id, productA.Id, null);

        result.Succeeded.Should().BeTrue();
        result.Result!.Should().HaveCount(2);
        result.Result!.Select(b => b.BatchNo).Should().BeEquivalentTo(new[] { 1, 2 });
    }

    [Fact]
    public async Task GetByContractAsync_NoBatches_ReturnsEmptySuccess()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var sut = CreateSut(db);

        var result = await sut.Service.GetByContractAsync(contract.Id, null, null);

        result.Succeeded.Should().BeTrue();
        result.Result.Should().BeEmpty();
    }

    // ─────────────────────────────────────────────────────────────────────
    //  Kind isolation — production partiya va mijoz olib ketishi aralashmaydi
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_ProductionBatches_DoNotConsumePickupAvailability()
    {
        // Vazifadan 30 ning hammasi partiya qilingan — mijoz baribir 30 gacha
        // olib keta oladi (foydalanuvchi shikoyati: partiya ≠ olib ketish).
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedWarehouseTask(db, contract.Id, completedAmount: 30);
        SeedBatch(db, contract.Id, amount: 30, batchNo: 1, kind: ShipmentBatchKind.Production);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            Amount = 30,
            Kind = ShipmentBatchKind.CustomerPickup,
        }, EnsureUser(db));

        result.Succeeded.Should().BeTrue();
        result.Result!.BatchNo.Should().Be(1, "BatchNo har tur uchun alohida sanaladi");
    }

    [Fact]
    public async Task CreateAsync_PickupBatches_DoNotConsumeProductionAvailability()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedWarehouseTask(db, contract.Id, completedAmount: 30);
        SeedBatch(db, contract.Id, amount: 30, batchNo: 1, kind: ShipmentBatchKind.CustomerPickup);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            Amount = 30,
            Kind = ShipmentBatchKind.Production,
        }, EnsureUser(db));

        result.Succeeded.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_PickupOverage_IsRejectedAgainstPickupSumOnly()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedWarehouseTask(db, contract.Id, completedAmount: 30);
        SeedBatch(db, contract.Id, amount: 25, batchNo: 1, kind: ShipmentBatchKind.CustomerPickup);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            Amount = 6, // pickup qoldiq 5
            Kind = ShipmentBatchKind.CustomerPickup,
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("Mavjud: 5");
    }

    [Fact]
    public async Task GetByContractAsync_FiltersByKind()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedBatch(db, contract.Id, amount: 5, batchNo: 1, kind: ShipmentBatchKind.Production);
        SeedBatch(db, contract.Id, amount: 9, batchNo: 1, kind: ShipmentBatchKind.CustomerPickup);
        var sut = CreateSut(db);

        var pickups = await sut.Service.GetByContractAsync(contract.Id, null, ShipmentBatchKind.CustomerPickup);
        var production = await sut.Service.GetByContractAsync(contract.Id, null, ShipmentBatchKind.Production);
        var all = await sut.Service.GetByContractAsync(contract.Id, null, null);

        pickups.Result!.Should().ContainSingle().Which.Amount.Should().Be(9);
        production.Result!.Should().ContainSingle().Which.Amount.Should().Be(5);
        all.Result!.Should().HaveCount(2);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  SourceBatch — olib ketish qaysi partiyadan ekani va partiya qoldig'i
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_PickupWithSourceBatch_PersistsLink_AndReturnsSourceBatchNo()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var product = SeedProduct(db, contract.Id);
        SeedWarehouseTask(db, contract.Id, completedAmount: 10, contractProductId: product.Id);
        var source = SeedBatch(db, contract.Id, amount: 6, batchNo: 3,
            contractProductId: product.Id, kind: ShipmentBatchKind.Production);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            ContractProductId = product.Id,
            Amount = 4,
            Kind = ShipmentBatchKind.CustomerPickup,
            SourceBatchId = source.Id,
        }, EnsureUser(db));

        result.Succeeded.Should().BeTrue();
        result.Result!.SourceBatchId.Should().Be(source.Id);
        result.Result.SourceBatchNo.Should().Be(3);
        db.ShipmentBatches.Single(s => s.Kind == ShipmentBatchKind.CustomerPickup)
            .SourceBatchId.Should().Be(source.Id);
    }

    [Fact]
    public async Task CreateAsync_PartialPickupsFromSameBatch_TrackRemaining()
    {
        // Bitta partiyadan bo'lib-bo'lib olib ketish: 6 dan avval 4, keyin 2
        // sig'adi, undan ortig'i rad etiladi.
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var product = SeedProduct(db, contract.Id);
        SeedWarehouseTask(db, contract.Id, completedAmount: 10, contractProductId: product.Id);
        var source = SeedBatch(db, contract.Id, amount: 6, batchNo: 1,
            contractProductId: product.Id, kind: ShipmentBatchKind.Production);
        var sut = CreateSut(db);

        ShipmentBatchCreateDto Dto(decimal amount) => new()
        {
            ContractId = contract.Id,
            ContractProductId = product.Id,
            Amount = amount,
            Kind = ShipmentBatchKind.CustomerPickup,
            SourceBatchId = source.Id,
        };

        (await sut.Service.CreateAsync(Dto(4), EnsureUser(db))).Succeeded.Should().BeTrue();

        var overflow = await sut.Service.CreateAsync(Dto(3), EnsureUser(db));
        overflow.Succeeded.Should().BeFalse();
        overflow.Errors.Should().ContainSingle().Which.Should().Contain("Qoldiq: 2");

        (await sut.Service.CreateAsync(Dto(2), EnsureUser(db))).Succeeded.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_SourceBatchFromAnotherProduct_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var productA = SeedProduct(db, contract.Id, productType: "A");
        var productB = SeedProduct(db, contract.Id, productType: "B");
        SeedWarehouseTask(db, contract.Id, completedAmount: 10, contractProductId: productA.Id);
        var sourceOfB = SeedBatch(db, contract.Id, amount: 5, batchNo: 1,
            contractProductId: productB.Id, kind: ShipmentBatchKind.Production);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            ContractProductId = productA.Id,
            Amount = 2,
            Kind = ShipmentBatchKind.CustomerPickup,
            SourceBatchId = sourceOfB.Id,
        }, EnsureUser(db));

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("boshqa mahsulotga tegishli");
    }

    [Fact]
    public async Task CreateAsync_SourceBatchMustBeProductionKind()
    {
        // Olib ketish yozuvini manba qilib bo'lmaydi — faqat ishlab chiqarish partiyasi.
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedWarehouseTask(db, contract.Id, completedAmount: 10);
        var pickup = SeedBatch(db, contract.Id, amount: 3, batchNo: 1,
            kind: ShipmentBatchKind.CustomerPickup);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            Amount = 2,
            Kind = ShipmentBatchKind.CustomerPickup,
            SourceBatchId = pickup.Id,
        }, EnsureUser(db));

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("topilmadi yoki ushbu shartnomaga tegishli emas");
    }

    [Fact]
    public async Task CreateAsync_ProductionBatchWithSourceBatch_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedWarehouseTask(db, contract.Id, completedAmount: 10);
        var source = SeedBatch(db, contract.Id, amount: 5, batchNo: 1,
            kind: ShipmentBatchKind.Production);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ShipmentBatchCreateDto
        {
            ContractId = contract.Id,
            Amount = 2,
            Kind = ShipmentBatchKind.Production,
            SourceBatchId = source.Id,
        }, EnsureUser(db));

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("faqat mijozga topshirishda");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  CreatePickupAutoAsync — FIFO taqsimlash
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreatePickupAutoAsync_SpansBatches_Fifo()
    {
        // Partiyalar: #1=6, #2=10 (jami 16). 9 ta olib ketish → #1 dan 6, #2 dan 3.
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var product = SeedProduct(db, contract.Id);
        SeedWarehouseTask(db, contract.Id, completedAmount: 10, contractProductId: product.Id);
        var src1 = SeedBatch(db, contract.Id, amount: 6, batchNo: 1,
            contractProductId: product.Id, kind: ShipmentBatchKind.Production);
        var src2 = SeedBatch(db, contract.Id, amount: 10, batchNo: 2,
            contractProductId: product.Id, kind: ShipmentBatchKind.Production);
        var sut = CreateSut(db);

        var result = await sut.Service.CreatePickupAutoAsync(new ShipmentPickupAutoCreateDto
        {
            ContractId = contract.Id,
            ContractProductId = product.Id,
            Amount = 9,
        }, EnsureUser(db));

        result.Succeeded.Should().BeTrue();
        result.StatusCode.Should().Be(201);
        var rows = result.Result!.ToList();
        rows.Should().HaveCount(2);
        rows[0].SourceBatchId.Should().Be(src1.Id);
        rows[0].Amount.Should().Be(6);
        rows[1].SourceBatchId.Should().Be(src2.Id);
        rows[1].Amount.Should().Be(3);
        rows.Select(r => r.BatchNo).Should().Equal(1, 2);
    }

    [Fact]
    public async Task CreatePickupAutoAsync_SkipsExhaustedBatches_AndRespectsPriorPickups()
    {
        // #1 dan 4 tasi avval olingan (qoldiq 2) — 5 ta so'ralsa: #1 dan 2, #2 dan 3.
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var product = SeedProduct(db, contract.Id);
        SeedWarehouseTask(db, contract.Id, completedAmount: 10, contractProductId: product.Id);
        var src1 = SeedBatch(db, contract.Id, amount: 6, batchNo: 1,
            contractProductId: product.Id, kind: ShipmentBatchKind.Production);
        var src2 = SeedBatch(db, contract.Id, amount: 4, batchNo: 2,
            contractProductId: product.Id, kind: ShipmentBatchKind.Production);
        var prior = SeedBatch(db, contract.Id, amount: 4, batchNo: 1,
            contractProductId: product.Id, kind: ShipmentBatchKind.CustomerPickup);
        prior.SourceBatchId = src1.Id;
        db.SaveChanges();
        var sut = CreateSut(db);

        var result = await sut.Service.CreatePickupAutoAsync(new ShipmentPickupAutoCreateDto
        {
            ContractId = contract.Id,
            ContractProductId = product.Id,
            Amount = 5,
        }, EnsureUser(db));

        result.Succeeded.Should().BeTrue();
        var rows = result.Result!.ToList();
        rows.Should().HaveCount(2);
        rows[0].SourceBatchId.Should().Be(src1.Id);
        rows[0].Amount.Should().Be(2);
        rows[1].SourceBatchId.Should().Be(src2.Id);
        rows[1].Amount.Should().Be(3);
        // BatchNo avvalgi olib ketishdan keyin davom etadi
        rows.Select(r => r.BatchNo).Should().Equal(2, 3);
    }

    [Fact]
    public async Task CreatePickupAutoAsync_InsufficientBatchRemaining_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var product = SeedProduct(db, contract.Id);
        SeedWarehouseTask(db, contract.Id, completedAmount: 10, contractProductId: product.Id);
        SeedBatch(db, contract.Id, amount: 4, batchNo: 1,
            contractProductId: product.Id, kind: ShipmentBatchKind.Production);
        var sut = CreateSut(db);

        var result = await sut.Service.CreatePickupAutoAsync(new ShipmentPickupAutoCreateDto
        {
            ContractId = contract.Id,
            ContractProductId = product.Id,
            Amount = 7, // partiyalarda faqat 4 bor
        }, EnsureUser(db));

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("Partiyalarda mavjud: 4");
        db.ShipmentBatches.Count(s => s.Kind == ShipmentBatchKind.CustomerPickup)
            .Should().Be(0, "hech narsa yozilmaydi — hammasi yoki hech narsa");
    }

    [Fact]
    public async Task CreatePickupAutoAsync_AmountOverReady_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var product = SeedProduct(db, contract.Id);
        SeedWarehouseTask(db, contract.Id, completedAmount: 5, contractProductId: product.Id);
        SeedBatch(db, contract.Id, amount: 5, batchNo: 1,
            contractProductId: product.Id, kind: ShipmentBatchKind.Production);
        var sut = CreateSut(db);

        var result = await sut.Service.CreatePickupAutoAsync(new ShipmentPickupAutoCreateDto
        {
            ContractId = contract.Id,
            ContractProductId = product.Id,
            Amount = 6, // omborda tayyor 5
        }, EnsureUser(db));

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("Mavjud: 5");
    }

    [Fact]
    public async Task CreatePickupAutoAsync_NoBatches_CreatesSingleUnlinkedPickup()
    {
        // Partiyasiz mahsulot (holati qo'lda Completed) — bitta bog'lanmagan yozuv.
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var product = SeedProduct(db, contract.Id);
        product.Status = ContractProductStatus.Completed;
        db.SaveChanges();
        var sut = CreateSut(db);

        var result = await sut.Service.CreatePickupAutoAsync(new ShipmentPickupAutoCreateDto
        {
            ContractId = contract.Id,
            ContractProductId = product.Id,
            Amount = 8,
        }, EnsureUser(db));

        result.Succeeded.Should().BeTrue();
        result.Result!.Should().ContainSingle();
        result.Result!.Single().SourceBatchId.Should().BeNull();
        result.Result!.Single().Amount.Should().Be(8);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GetReadyByContractAsync — per-product ready (warehouse) amounts
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetReadyByContractAsync_WarehouseTaskCompletedAmount_IsReady()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var product = SeedProduct(db, contract.Id); // Quantity = 10, InProduction
        SeedWarehouseTask(db, contract.Id, completedAmount: 4, contractProductId: product.Id);
        var sut = CreateSut(db);

        var result = await sut.Service.GetReadyByContractAsync(contract.Id);

        result.Succeeded.Should().BeTrue();
        result.Result!.Should().ContainSingle()
            .Which.Should().BeEquivalentTo(new { ContractProductId = product.Id, ReadyQuantity = 4m });
    }

    [Fact]
    public async Task GetReadyByContractAsync_NoTask_InProductionProduct_ReadyIsZero()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var product = SeedProduct(db, contract.Id);
        var sut = CreateSut(db);

        var result = await sut.Service.GetReadyByContractAsync(contract.Id);

        result.Result!.Should().ContainSingle()
            .Which.Should().BeEquivalentTo(new { ContractProductId = product.Id, ReadyQuantity = 0m });
    }

    [Fact]
    public async Task GetReadyByContractAsync_NoTask_CompletedProduct_ReadyIsFullQuantity()
    {
        // Holat qo'lda Completed qilingan mahsulot — CreateAsync bilan bir xil
        // qoida: to'liq miqdor omborda deb hisoblanadi.
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var product = SeedProduct(db, contract.Id);
        product.Status = ContractProductStatus.Completed;
        db.SaveChanges();
        var sut = CreateSut(db);

        var result = await sut.Service.GetReadyByContractAsync(contract.Id);

        result.Result!.Should().ContainSingle()
            .Which.ReadyQuantity.Should().Be(product.Quantity);
    }

    [Fact]
    public async Task GetReadyByContractAsync_ReadyIsCappedAtProductQuantity()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var product = SeedProduct(db, contract.Id); // Quantity = 10
        SeedWarehouseTask(db, contract.Id, completedAmount: 50, contractProductId: product.Id);
        var sut = CreateSut(db);

        var result = await sut.Service.GetReadyByContractAsync(contract.Id);

        result.Result!.Should().ContainSingle()
            .Which.ReadyQuantity.Should().Be(10, "shartnomadagi miqdor — yuqori chegara");
    }

    [Fact]
    public async Task GetReadyByContractAsync_CancelledProductExcluded()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var active = SeedProduct(db, contract.Id, productType: "A");
        var cancelled = SeedProduct(db, contract.Id, productType: "B");
        cancelled.Status = ContractProductStatus.Cancelled;
        db.SaveChanges();
        var sut = CreateSut(db);

        var result = await sut.Service.GetReadyByContractAsync(contract.Id);

        result.Result!.Should().ContainSingle()
            .Which.ContractProductId.Should().Be(active.Id);
    }

    [Fact]
    public async Task GetReadyByContractAsync_InactiveWarehouseTaskIgnored()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var product = SeedProduct(db, contract.Id);
        SeedWarehouseTask(db, contract.Id, completedAmount: 7, contractProductId: product.Id, isActive: false);
        var sut = CreateSut(db);

        var result = await sut.Service.GetReadyByContractAsync(contract.Id);

        result.Result!.Should().ContainSingle()
            .Which.ReadyQuantity.Should().Be(0);
    }

}
