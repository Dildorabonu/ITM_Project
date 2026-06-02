using Application.DTOs.ContractTasks;
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

public class ContractTaskServiceTests
{
    // ─────────────────────────────────────────────────────────────────────
    //  Infrastructure
    //
    //  ⚠️  Note: ContractTaskService is a *progress-tracking* task service — it
    //  has no Pending→InProgress→Done state machine, no user-assignment, and no
    //  due-date logic. Vazifalar shartnomaga (va ixtiyoriy mahsulotga) bog'lanadi,
    //  CompletedAmount/TotalAmount progress sifatida kuzatiladi, va maxsus
    //  "ombor topshirish" vazifasi uchun cap (sibling min) qoidasi bor.
    //  Servis INotificationService ga emas, IManufacturedProductService va
    //  IActivityLogService ga bog'liq.
    // ─────────────────────────────────────────────────────────────────────

    private const string WarehouseTaskName = "Tayyor mahsulotni omborga topshirish";

    private sealed record SutBundle(
        ContractTaskService Service,
        Mock<IManufacturedProductService> Manufactured,
        Mock<IActivityLogService> ActivityLog);

    private static SutBundle CreateSut(DatabaseContext db)
    {
        var manufactured = new Mock<IManufacturedProductService>();
        var activityLog = new Mock<IActivityLogService>();
        var service = new ContractTaskService(db, manufactured.Object, activityLog.Object);
        return new SutBundle(service, manufactured, activityLog);
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

    private static ContractTask SeedTask(
        DatabaseContext db,
        Guid contractId,
        string name = "Vazifa",
        decimal completedAmount = 0,
        decimal totalAmount = 100,
        Guid? contractProductId = null,
        int orderNo = 1,
        bool isActive = true,
        Guid? id = null)
    {
        var task = new ContractTask
        {
            Id = id ?? Guid.NewGuid(),
            ContractId = contractId,
            ContractProductId = contractProductId,
            OrderNo = orderNo,
            Name = name,
            CompletedAmount = completedAmount,
            TotalAmount = totalAmount,
            Importance = 50,
            IsActive = isActive,
            CreatedBy = EnsureUser(db),
            CreatedAt = DateTime.UtcNow,
        };
        db.ContractTasks.Add(task);
        db.SaveChanges();
        return task;
    }

    // ─────────────────────────────────────────────────────────────────────
    //  CreateAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_WithValidDto_LinksTaskToContract_AndReturns201()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var creator = Guid.NewGuid();
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ContractTaskCreateDto
        {
            ContractId = contract.Id,
            Name = "Kesish",
            TotalAmount = 100,
            CompletedAmount = 0,
            Importance = 80,
        }, creator);

        result.Succeeded.Should().BeTrue();
        result.StatusCode.Should().Be(201);

        var saved = db.ContractTasks.AsNoTracking().Single();
        saved.Id.Should().Be(result.Result);
        saved.ContractId.Should().Be(contract.Id);
        saved.Name.Should().Be("Kesish");
        saved.CreatedBy.Should().Be(creator);
        saved.OrderNo.Should().Be(1, "birinchi vazifa OrderNo = 1");
    }

    [Fact]
    public async Task CreateAsync_NonExistentContract_Returns404Failure()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ContractTaskCreateDto
        {
            ContractId = Guid.NewGuid(),
            Name = "Kesish",
            TotalAmount = 100,
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
        result.Errors.Should().ContainSingle().Which.Should().Contain("not found");
        db.ContractTasks.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_AssignsIncrementingOrderNo_PerContract()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedTask(db, contract.Id, name: "Mavjud", orderNo: 3);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ContractTaskCreateDto
        {
            ContractId = contract.Id,
            Name = "Yangi",
            TotalAmount = 50,
        }, Guid.NewGuid());

        result.Succeeded.Should().BeTrue();
        db.ContractTasks.AsNoTracking().Single(t => t.Name == "Yangi")
            .OrderNo.Should().Be(4, "eng katta OrderNo (3) dan keyingisi");
    }

    [Fact]
    public async Task CreateAsync_ContractProductFromAnotherContract_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var contractA = SeedContract(db, contractNo: "C-A");
        var contractB = SeedContract(db, contractNo: "C-B");
        var productOfB = SeedProduct(db, contractB.Id);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ContractTaskCreateDto
        {
            ContractId = contractA.Id,
            ContractProductId = productOfB.Id,
            Name = "Noto'g'ri mahsulot",
            TotalAmount = 10,
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle()
            .Which.Should().Contain("ushbu shartnomaga tegishli emas");
        db.ContractTasks.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_ContractProductBelongingToContract_Succeeds()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var product = SeedProduct(db, contract.Id);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ContractTaskCreateDto
        {
            ContractId = contract.Id,
            ContractProductId = product.Id,
            Name = "Mahsulot vazifasi",
            TotalAmount = 10,
        }, Guid.NewGuid());

        result.Succeeded.Should().BeTrue();
        db.ContractTasks.AsNoTracking().Single()
            .ContractProductId.Should().Be(product.Id);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  CreateBulkAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateBulkAsync_PersistsAll_WithSequentialOrderNos()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedTask(db, contract.Id, name: "Mavjud", orderNo: 1);
        var creator = Guid.NewGuid();
        var sut = CreateSut(db);

        var result = await sut.Service.CreateBulkAsync(new[]
        {
            new ContractTaskCreateDto { ContractId = contract.Id, Name = "B1", TotalAmount = 10 },
            new ContractTaskCreateDto { ContractId = contract.Id, Name = "B2", TotalAmount = 20 },
        }, creator);

        result.Succeeded.Should().BeTrue();
        result.StatusCode.Should().Be(201);
        result.Result.Should().Be(2);

        var created = db.ContractTasks.AsNoTracking()
            .Where(t => t.Name == "B1" || t.Name == "B2")
            .OrderBy(t => t.OrderNo)
            .ToList();
        created.Select(t => t.OrderNo).Should().Equal(new[] { 2, 3 },
            "mavjud OrderNo (1) dan keyin ketma-ket");
    }

    [Fact]
    public async Task CreateBulkAsync_EmptyList_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.CreateBulkAsync(Array.Empty<ContractTaskCreateDto>(), Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.Errors.Should().ContainSingle().Which.Should().Contain("Kamida bitta vazifa");
    }

    [Fact]
    public async Task CreateBulkAsync_NonExistentContract_Returns404()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.CreateBulkAsync(new[]
        {
            new ContractTaskCreateDto { ContractId = Guid.NewGuid(), Name = "X", TotalAmount = 1 },
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
        db.ContractTasks.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateBulkAsync_OneProductNotInContract_RejectsWholeBatch()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var otherContract = SeedContract(db, contractNo: "C-OTHER");
        var foreignProduct = SeedProduct(db, otherContract.Id);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateBulkAsync(new[]
        {
            new ContractTaskCreateDto { ContractId = contract.Id, Name = "OK", TotalAmount = 1 },
            new ContractTaskCreateDto { ContractId = contract.Id, Name = "Bad", TotalAmount = 1, ContractProductId = foreignProduct.Id },
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("ushbu shartnomaga tegishli emas");
        db.ContractTasks.Should().BeEmpty("butun batch rad etiladi");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  UpdateAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateAsync_NonExistentId_Returns404()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(Guid.NewGuid(), new ContractTaskUpdateDto { Name = "X" });

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task UpdateAsync_PartialUpdate_OnlyChangesProvidedFields()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var task = SeedTask(db, contract.Id, name: "Eski", completedAmount: 5, totalAmount: 100);
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(task.Id, new ContractTaskUpdateDto
        {
            Name = "Yangi nom",
        });

        result.Succeeded.Should().BeTrue();
        var refreshed = db.ContractTasks.AsNoTracking().Single(t => t.Id == task.Id);
        refreshed.Name.Should().Be("Yangi nom");
        refreshed.CompletedAmount.Should().Be(5, "tegilmagan maydon o'zgarmaydi");
        refreshed.TotalAmount.Should().Be(100);
    }

    [Fact]
    public async Task UpdateAsync_ClearContractProduct_RemovesLink()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var product = SeedProduct(db, contract.Id);
        var task = SeedTask(db, contract.Id, contractProductId: product.Id);
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(task.Id, new ContractTaskUpdateDto
        {
            ClearContractProduct = true,
        });

        result.Succeeded.Should().BeTrue();
        db.ContractTasks.AsNoTracking().Single(t => t.Id == task.Id)
            .ContractProductId.Should().BeNull();
    }

    [Fact]
    public async Task UpdateAsync_ContractProductFromAnotherContract_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var otherContract = SeedContract(db, contractNo: "C-OTHER");
        var foreignProduct = SeedProduct(db, otherContract.Id);
        var task = SeedTask(db, contract.Id);
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(task.Id, new ContractTaskUpdateDto
        {
            ContractProductId = foreignProduct.Id,
        });

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("ushbu shartnomaga tegishli emas");
    }

    [Fact]
    public async Task UpdateAsync_WarehouseTask_CompletedAmountAboveSiblingMin_ReturnsFailure()
    {
        // Ombor topshirish vazifasi uchun cap = boshqa vazifalarning eng kam
        // CompletedAmount qiymati. Bundan oshirilsa — rad etiladi.
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedTask(db, contract.Id, name: "Kesish", completedAmount: 30, orderNo: 1);
        SeedTask(db, contract.Id, name: "Payvand", completedAmount: 20, orderNo: 2);
        var warehouse = SeedTask(db, contract.Id, name: WarehouseTaskName, completedAmount: 0, orderNo: 3);
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(warehouse.Id, new ContractTaskUpdateDto
        {
            CompletedAmount = 25, // cap = min(30, 20) = 20
        });

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("oshmasligi kerak");
        db.ContractTasks.AsNoTracking().Single(t => t.Id == warehouse.Id)
            .CompletedAmount.Should().Be(0, "rad etilgani uchun saqlanmaydi");
    }

    [Fact]
    public async Task UpdateAsync_WarehouseTask_CompletedAmountWithinCap_Succeeds()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedTask(db, contract.Id, name: "Kesish", completedAmount: 30, orderNo: 1);
        SeedTask(db, contract.Id, name: "Payvand", completedAmount: 20, orderNo: 2);
        var warehouse = SeedTask(db, contract.Id, name: WarehouseTaskName, completedAmount: 0, orderNo: 3);
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(warehouse.Id, new ContractTaskUpdateDto
        {
            CompletedAmount = 20, // == cap, ruxsat etiladi
        });

        result.Succeeded.Should().BeTrue();
        db.ContractTasks.AsNoTracking().Single(t => t.Id == warehouse.Id)
            .CompletedAmount.Should().Be(20);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  DeleteAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteAsync_ExistingTask_RemovesRow()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var task = SeedTask(db, contract.Id);
        var sut = CreateSut(db);

        var result = await sut.Service.DeleteAsync(task.Id);

        result.Succeeded.Should().BeTrue();
        result.StatusCode.Should().Be(200);
        db.ContractTasks.Should().BeEmpty();
    }

    [Fact]
    public async Task DeleteAsync_NonExistentId_Returns404()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.DeleteAsync(Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  LogProgressAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task LogProgressAsync_AddsLog_IncrementsCompletedAmount_AndLogsActivity()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db, contractNo: "C-LOG");
        var task = SeedTask(db, contract.Id, name: "Kesish", completedAmount: 10);
        var creator = Guid.NewGuid();
        var sut = CreateSut(db);

        var result = await sut.Service.LogProgressAsync(task.Id, new ContractTaskLogCreateDto
        {
            Amount = 15,
            Note = "Bugungi ishlab chiqarish",
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
        }, creator);

        result.Succeeded.Should().BeTrue();
        result.StatusCode.Should().Be(201);

        db.ContractTasks.AsNoTracking().Single(t => t.Id == task.Id)
            .CompletedAmount.Should().Be(25, "10 + 15");
        var log = db.ContractTaskDailyLogs.AsNoTracking().Single();
        log.TaskId.Should().Be(task.Id);
        log.Amount.Should().Be(15);
        log.CreatedBy.Should().Be(creator);

        sut.ActivityLog.Verify(a => a.LogAsync(
            "task-log",
            It.Is<string>(t => t.Contains("Kesish")),
            "C-LOG",
            creator,
            task.Id),
            Times.Once);
    }

    [Fact]
    public async Task LogProgressAsync_NonExistentTask_Returns404()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.LogProgressAsync(Guid.NewGuid(), new ContractTaskLogCreateDto
        {
            Amount = 5,
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public async Task LogProgressAsync_NonPositiveAmount_Returns400(decimal amount)
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var task = SeedTask(db, contract.Id);
        var sut = CreateSut(db);

        var result = await sut.Service.LogProgressAsync(task.Id, new ContractTaskLogCreateDto
        {
            Amount = amount,
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.Errors.Should().ContainSingle().Which.Should().Contain("0 dan katta");
        db.ContractTaskDailyLogs.Should().BeEmpty();
    }

    [Fact]
    public async Task LogProgressAsync_WarehouseTask_ExceedingCap_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedTask(db, contract.Id, name: "Kesish", completedAmount: 20, orderNo: 1);
        var warehouse = SeedTask(db, contract.Id, name: WarehouseTaskName, completedAmount: 15, orderNo: 2);
        var sut = CreateSut(db);

        // cap = 20, hozir 15 → +10 = 25 > 20 → rad
        var result = await sut.Service.LogProgressAsync(warehouse.Id, new ContractTaskLogCreateDto
        {
            Amount = 10,
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("Qoldiq");
        db.ContractTaskDailyLogs.Should().BeEmpty();
        db.ContractTasks.AsNoTracking().Single(t => t.Id == warehouse.Id)
            .CompletedAmount.Should().Be(15, "rad etilgani uchun o'zgarmaydi");
    }

    [Fact]
    public async Task LogProgressAsync_WarehouseTaskWithProduct_SyncsManufacturedQuantity()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var product = SeedProduct(db, contract.Id);
        var warehouse = SeedTask(db, contract.Id, name: WarehouseTaskName,
            completedAmount: 0, contractProductId: product.Id);
        var sut = CreateSut(db);

        var result = await sut.Service.LogProgressAsync(warehouse.Id, new ContractTaskLogCreateDto
        {
            Amount = 5,
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
        }, Guid.NewGuid());

        result.Succeeded.Should().BeTrue();
        sut.Manufactured.Verify(m => m.UpdateProducedQuantityAsync(contract.Id, product.Id), Times.Once);
    }

    [Fact]
    public async Task LogProgressAsync_NonWarehouseTask_DoesNotSyncManufactured()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var product = SeedProduct(db, contract.Id);
        var task = SeedTask(db, contract.Id, name: "Kesish", contractProductId: product.Id);
        var sut = CreateSut(db);

        await sut.Service.LogProgressAsync(task.Id, new ContractTaskLogCreateDto
        {
            Amount = 5,
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
        }, Guid.NewGuid());

        sut.Manufactured.Verify(m => m.UpdateProducedQuantityAsync(It.IsAny<Guid>(), It.IsAny<Guid?>()),
            Times.Never);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GetByContractIdAsync / GetByIdAsync / GetLogsAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetByContractIdAsync_NonExistentContract_Returns404()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.GetByContractIdAsync(Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetByContractIdAsync_ReturnsTasksOrderedByOrderNo()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        SeedTask(db, contract.Id, name: "Uchinchi", orderNo: 3);
        SeedTask(db, contract.Id, name: "Birinchi", orderNo: 1);
        SeedTask(db, contract.Id, name: "Ikkinchi", orderNo: 2);
        var sut = CreateSut(db);

        var result = await sut.Service.GetByContractIdAsync(contract.Id);

        result.Succeeded.Should().BeTrue();
        result.Result!.Select(t => t.Name).Should().Equal("Birinchi", "Ikkinchi", "Uchinchi");
    }

    [Fact]
    public async Task GetByIdAsync_NotFound_Returns404()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.GetByIdAsync(Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetByIdAsync_ComputesPercentComplete()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var task = SeedTask(db, contract.Id, completedAmount: 25, totalAmount: 100);
        var sut = CreateSut(db);

        var result = await sut.Service.GetByIdAsync(task.Id);

        result.Succeeded.Should().BeTrue();
        result.Result!.PercentComplete.Should().Be(25.0m);
    }

    [Fact]
    public async Task GetLogsAsync_NonExistentTask_Returns404()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.GetLogsAsync(Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetLogsAsync_ReturnsLogsNewestFirst()
    {
        await using var db = TestDbContextFactory.Create();
        var contract = SeedContract(db);
        var task = SeedTask(db, contract.Id);
        var older = new ContractTaskDailyLog
        {
            Id = Guid.NewGuid(),
            TaskId = task.Id,
            Amount = 5,
            Date = new DateOnly(2026, 1, 1),
            CreatedBy = EnsureUser(db),
            CreatedAt = DateTime.UtcNow,
        };
        var newer = new ContractTaskDailyLog
        {
            Id = Guid.NewGuid(),
            TaskId = task.Id,
            Amount = 7,
            Date = new DateOnly(2026, 2, 1),
            CreatedBy = EnsureUser(db),
            CreatedAt = DateTime.UtcNow,
        };
        db.ContractTaskDailyLogs.AddRange(older, newer);
        db.SaveChanges();
        var sut = CreateSut(db);

        var result = await sut.Service.GetLogsAsync(task.Id);

        result.Succeeded.Should().BeTrue();
        result.Result!.Select(l => l.Amount).Should().Equal(new[] { 7m, 5m },
            "Date kamayish tartibida");
    }
}
