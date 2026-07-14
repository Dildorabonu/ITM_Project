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
        Guid? createdBy = null)
    {
        var batch = new ShipmentBatch
        {
            Id = Guid.NewGuid(),
            ContractId = contractId,
            ContractProductId = contractProductId,
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

        var result = await sut.Service.GetByContractAsync(contract.Id, null);

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

        var result = await sut.Service.GetByContractAsync(contract.Id, null);

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

        var result = await sut.Service.GetByContractAsync(contract.Id, productA.Id);

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

        var result = await sut.Service.GetByContractAsync(contract.Id, null);

        result.Succeeded.Should().BeTrue();
        result.Result.Should().BeEmpty();
    }

}
