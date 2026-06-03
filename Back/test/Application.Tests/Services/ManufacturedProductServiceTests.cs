using Application.DTOs.ManufacturedProducts;
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

public class ManufacturedProductServiceTests
{
    // ─────────────────────────────────────────────────────────────────────
    //  Infrastructure
    //
    //  ManufacturedProductService — *tayyor mahsulot* yozuvlarini boshqaradi.
    //  Ikki turdagi yozuv mavjud:
    //   • Qo'lda kiritilgan — ContractProductId == null, ContractId == null.
    //     CreateAsync/UpdateAsync/DeleteAsync faqat shularni boshqaradi.
    //   • Avtomatik (shartnomadan derived) — ContractProductId != null. Bularni
    //     qo'lda tahrir/o'chirib bo'lmaydi (SyncForContractAsync boshqaradi).
    //  Asosiy biznes qoidalari: nom bo'sh emas, bo'lim mavjud, miqdorlar manfiy
    //  emas, ProducedQuantity <= Quantity, va to'liq ishlab chiqarilganda status
    //  avtomatik Completed ga o'tadi.
    //  Servis IActivityLogService ga bog'liq.
    // ─────────────────────────────────────────────────────────────────────

    private sealed record SutBundle(
        ManufacturedProductService Service,
        Mock<IActivityLogService> ActivityLog);

    private static SutBundle CreateSut(DatabaseContext db)
    {
        var activityLog = new Mock<IActivityLogService>();
        var service = new ManufacturedProductService(db, activityLog.Object);
        return new SutBundle(service, activityLog);
    }

    private static Department SeedDepartment(
        DatabaseContext db,
        string name = "Ishlab chiqarish",
        Guid? id = null)
    {
        var dept = new Department
        {
            Id = id ?? Guid.NewGuid(),
            Name = name,
            Type = DepartmentType.IshlabChiqarish,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        db.Departments.Add(dept);
        db.SaveChanges();
        return dept;
    }

    /// <summary>
    /// Adds a User row for <paramref name="id"/> if missing — keeps Creator-joined
    /// reads from dropping rows under the EF InMemory provider.
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
    /// Seeds a ManufacturedProduct directly. <paramref name="contractProductId"/> non-null
    /// marks the row as auto-derived (read-only via the write API).
    /// </summary>
    private static ManufacturedProduct SeedProduct(
        DatabaseContext db,
        Guid departmentId,
        string name = "Eshik",
        decimal quantity = 10,
        decimal producedQuantity = 0,
        ManufacturingStatus status = ManufacturingStatus.InProgress,
        Guid? contractId = null,
        Guid? contractProductId = null)
    {
        var entity = new ManufacturedProduct
        {
            Id = Guid.NewGuid(),
            Name = name,
            Quantity = quantity,
            ProducedQuantity = producedQuantity,
            Unit = ProductUnit.Dona,
            Status = status,
            DepartmentId = departmentId,
            ContractId = contractId,
            ContractProductId = contractProductId,
            CreatedBy = EnsureUser(db),
            CreatedAt = DateTime.UtcNow,
        };
        db.ManufacturedProducts.Add(entity);
        db.SaveChanges();
        return entity;
    }

    private static ManufacturedProductCreateDto ValidCreateDto(Guid departmentId) => new()
    {
        Name = "Metall eshik",
        Code = "ME-01",
        Description = "Tavsif",
        Quantity = 10,
        ProducedQuantity = 0,
        Unit = ProductUnit.Dona,
        Status = ManufacturingStatus.InProgress,
        DepartmentId = departmentId,
        Notes = "Izoh",
    };

    // ─────────────────────────────────────────────────────────────────────
    //  CreateAsync — validation
    // ─────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CreateAsync_BlankName_ReturnsFailure(string name)
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db);
        var sut = CreateSut(db);

        var dto = ValidCreateDto(dept.Id);
        dto.Name = name;

        var result = await sut.Service.CreateAsync(dto, EnsureUser(db));

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("nomi bo'sh");
        db.ManufacturedProducts.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_EmptyDepartmentId_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var dto = ValidCreateDto(Guid.Empty);

        var result = await sut.Service.CreateAsync(dto, EnsureUser(db));

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("Bo'lim tanlanishi shart");
        db.ManufacturedProducts.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_NonExistentDepartment_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var dto = ValidCreateDto(Guid.NewGuid());

        var result = await sut.Service.CreateAsync(dto, EnsureUser(db));

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("bo'lim topilmadi");
        db.ManufacturedProducts.Should().BeEmpty();
    }

    [Theory]
    [InlineData(-1, 0)]
    [InlineData(0, -1)]
    [InlineData(-5, -5)]
    public async Task CreateAsync_NegativeQuantity_ReturnsFailure(decimal quantity, decimal produced)
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db);
        var sut = CreateSut(db);

        var dto = ValidCreateDto(dept.Id);
        dto.Quantity = quantity;
        dto.ProducedQuantity = produced;

        var result = await sut.Service.CreateAsync(dto, EnsureUser(db));

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("manfiy");
        db.ManufacturedProducts.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_ProducedExceedsQuantity_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db);
        var sut = CreateSut(db);

        var dto = ValidCreateDto(dept.Id);
        dto.Quantity = 10;
        dto.ProducedQuantity = 11;

        var result = await sut.Service.CreateAsync(dto, EnsureUser(db));

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("ko'p bo'lishi mumkin emas");
        db.ManufacturedProducts.Should().BeEmpty();
    }

    // ─────────────────────────────────────────────────────────────────────
    //  CreateAsync — persistence, status derivation, activity log
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_Valid_PersistsManualRow_AndReturns201()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db);
        var creator = EnsureUser(db);
        var sut = CreateSut(db);

        var dto = ValidCreateDto(dept.Id);
        dto.Quantity = 8;
        dto.ProducedQuantity = 3;

        var result = await sut.Service.CreateAsync(dto, creator);

        result.Succeeded.Should().BeTrue();
        result.Result.Should().Be(201, "servis HTTP holat kodini Result qiymati sifatida qaytaradi");

        var saved = db.ManufacturedProducts.AsNoTracking().Single();
        saved.Name.Should().Be("Metall eshik");
        saved.Code.Should().Be("ME-01");
        saved.Quantity.Should().Be(8);
        saved.ProducedQuantity.Should().Be(3);
        saved.Status.Should().Be(ManufacturingStatus.InProgress);
        saved.DepartmentId.Should().Be(dept.Id);
        saved.CreatedBy.Should().Be(creator);
        // Qo'lda kiritilgan yozuv hech qachon shartnomaga bog'lanmaydi.
        saved.ContractId.Should().BeNull();
        saved.ContractProductId.Should().BeNull();
        saved.CompletedAt.Should().BeNull();
    }

    [Fact]
    public async Task CreateAsync_TrimsTextFields()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db);
        var sut = CreateSut(db);

        var dto = ValidCreateDto(dept.Id);
        dto.Name = "  Stol  ";
        dto.Code = "  ST-9  ";
        dto.Notes = "   ";

        var result = await sut.Service.CreateAsync(dto, EnsureUser(db));

        result.Succeeded.Should().BeTrue();
        var saved = db.ManufacturedProducts.AsNoTracking().Single();
        saved.Name.Should().Be("Stol");
        saved.Code.Should().Be("ST-9");
        saved.Notes.Should().BeNull("faqat bo'sh joydan iborat matn null ga aylanadi");
    }

    [Fact]
    public async Task CreateAsync_ProducedEqualsQuantity_AutoCompletes()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db);
        var sut = CreateSut(db);

        var dto = ValidCreateDto(dept.Id);
        dto.Quantity = 5;
        dto.ProducedQuantity = 5;
        dto.Status = ManufacturingStatus.InProgress; // status so'ralgan bo'lsa ham...

        var result = await sut.Service.CreateAsync(dto, EnsureUser(db));

        result.Succeeded.Should().BeTrue();
        var saved = db.ManufacturedProducts.AsNoTracking().Single();
        saved.Status.Should().Be(ManufacturingStatus.Completed, "to'liq ishlab chiqarilgan");
        saved.CompletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task CreateAsync_Valid_LogsManufacturedActivity()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db, name: "Payvand sexi");
        var creator = EnsureUser(db);
        var sut = CreateSut(db);

        var dto = ValidCreateDto(dept.Id);
        dto.Name = "Karkas";

        var result = await sut.Service.CreateAsync(dto, creator);

        result.Succeeded.Should().BeTrue();
        sut.ActivityLog.Verify(a => a.LogAsync(
            "manufactured",
            It.Is<string>(t => t.Contains("Karkas")),
            "Payvand sexi",
            creator,
            It.IsAny<Guid?>()),
            Times.Once);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  UpdateAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateAsync_NonExistentId_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(Guid.NewGuid(), new ManufacturedProductUpdateDto
        {
            Name = "Yangi nom",
        });

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("topilmadi");
    }

    [Fact]
    public async Task UpdateAsync_AutoDerivedRow_IsRejected()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db);
        // ContractProductId != null → avtomatik boshqariladigan yozuv.
        var row = SeedProduct(db, dept.Id, contractId: Guid.NewGuid(), contractProductId: Guid.NewGuid());
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(row.Id, new ManufacturedProductUpdateDto
        {
            Name = "Tahrir",
        });

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("qo'lda tahrirlab bo'lmaydi");
    }

    [Fact]
    public async Task UpdateAsync_BlankName_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db);
        var row = SeedProduct(db, dept.Id);
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(row.Id, new ManufacturedProductUpdateDto
        {
            Name = "   ",
        });

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("nomi bo'sh");
    }

    [Fact]
    public async Task UpdateAsync_NegativeQuantity_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db);
        var row = SeedProduct(db, dept.Id);
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(row.Id, new ManufacturedProductUpdateDto
        {
            Quantity = -1,
        });

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("manfiy");
    }

    [Fact]
    public async Task UpdateAsync_ProducedExceedsQuantity_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db);
        var row = SeedProduct(db, dept.Id, quantity: 10, producedQuantity: 0);
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(row.Id, new ManufacturedProductUpdateDto
        {
            ProducedQuantity = 11,
        });

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("ko'p bo'lishi mumkin emas");
    }

    [Fact]
    public async Task UpdateAsync_NonExistentDepartment_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db);
        var row = SeedProduct(db, dept.Id);
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(row.Id, new ManufacturedProductUpdateDto
        {
            DepartmentId = Guid.NewGuid(),
        });

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("bo'lim topilmadi");
    }

    [Fact]
    public async Task UpdateAsync_Valid_PersistsChanges()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db);
        var newDept = SeedDepartment(db, name: "Bo'yoq sexi");
        var row = SeedProduct(db, dept.Id, name: "Eski", quantity: 10, producedQuantity: 2);
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(row.Id, new ManufacturedProductUpdateDto
        {
            Name = "Yangi nom",
            Quantity = 20,
            ProducedQuantity = 5,
            DepartmentId = newDept.Id,
            Notes = "Yangilangan izoh",
        });

        result.Succeeded.Should().BeTrue();
        result.Result.Should().Be(200);

        var saved = db.ManufacturedProducts.AsNoTracking().Single(p => p.Id == row.Id);
        saved.Name.Should().Be("Yangi nom");
        saved.Quantity.Should().Be(20);
        saved.ProducedQuantity.Should().Be(5);
        saved.DepartmentId.Should().Be(newDept.Id);
        saved.Notes.Should().Be("Yangilangan izoh");
    }

    [Fact]
    public async Task UpdateAsync_ProducedReachesQuantity_AutoCompletes()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db);
        var row = SeedProduct(db, dept.Id, quantity: 10, producedQuantity: 2,
            status: ManufacturingStatus.InProgress);
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(row.Id, new ManufacturedProductUpdateDto
        {
            ProducedQuantity = 10,
        });

        result.Succeeded.Should().BeTrue();
        var saved = db.ManufacturedProducts.AsNoTracking().Single(p => p.Id == row.Id);
        saved.Status.Should().Be(ManufacturingStatus.Completed);
        saved.CompletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateAsync_BackToInProgress_ClearsCompletedAt()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db);
        var row = SeedProduct(db, dept.Id, quantity: 10, producedQuantity: 10,
            status: ManufacturingStatus.Completed);
        row.CompletedAt = DateTime.UtcNow;
        db.SaveChanges();
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(row.Id, new ManufacturedProductUpdateDto
        {
            Status = ManufacturingStatus.InProgress,
            ProducedQuantity = 4, // endi to'liq emas, auto-finalize ishlamaydi
        });

        result.Succeeded.Should().BeTrue();
        var saved = db.ManufacturedProducts.AsNoTracking().Single(p => p.Id == row.Id);
        saved.Status.Should().Be(ManufacturingStatus.InProgress);
        saved.CompletedAt.Should().BeNull("Completed bo'lmagan yozuvda tugatilgan vaqt bo'lmaydi");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  DeleteAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteAsync_NonExistentId_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.DeleteAsync(Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("topilmadi");
    }

    [Fact]
    public async Task DeleteAsync_AutoDerivedRow_IsRejected()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db);
        var row = SeedProduct(db, dept.Id, contractId: Guid.NewGuid(), contractProductId: Guid.NewGuid());
        var sut = CreateSut(db);

        var result = await sut.Service.DeleteAsync(row.Id);

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("qo'lda o'chirib bo'lmaydi");
        db.ManufacturedProducts.Should().ContainSingle();
    }

    [Fact]
    public async Task DeleteAsync_ManualRow_RemovesRow()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db);
        var row = SeedProduct(db, dept.Id);
        var sut = CreateSut(db);

        var result = await sut.Service.DeleteAsync(row.Id);

        result.Succeeded.Should().BeTrue();
        result.Result.Should().Be(200);
        db.ManufacturedProducts.Should().BeEmpty();
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GetByIdAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetByIdAsync_Existing_ReturnsMappedDto()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db, name: "Yig'ish sexi");
        var row = SeedProduct(db, dept.Id, name: "Rama", quantity: 7, producedQuantity: 3);
        var sut = CreateSut(db);

        var result = await sut.Service.GetByIdAsync(row.Id);

        result.Succeeded.Should().BeTrue();
        result.Result!.Name.Should().Be("Rama");
        result.Result.Quantity.Should().Be(7);
        result.Result.ProducedQuantity.Should().Be(3);
        result.Result.DepartmentName.Should().Be("Yig'ish sexi");
    }

    [Fact]
    public async Task GetByIdAsync_NonExistent_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.GetByIdAsync(Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("not found");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GetAllAsync — filters, search, orphan exclusion
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAllAsync_ExcludesOrphanAutoRows()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db);
        // Qo'lda kiritilgan (ContractId == null) — ko'rinadi.
        SeedProduct(db, dept.Id, name: "Manual");
        // Avtomatik (ContractProductId != null) — ko'rinadi.
        SeedProduct(db, dept.Id, name: "Auto", contractId: Guid.NewGuid(), contractProductId: Guid.NewGuid());
        // Orphan: ContractId != null lekin ContractProductId == null — yashirin.
        SeedProduct(db, dept.Id, name: "Orphan", contractId: Guid.NewGuid(), contractProductId: null);
        var sut = CreateSut(db);

        var result = await sut.Service.GetAllAsync(1, 50, null, null, null);

        result.Succeeded.Should().BeTrue();
        result.Result!.Items.Select(i => i.Name).Should().BeEquivalentTo(new[] { "Manual", "Auto" });
    }

    [Fact]
    public async Task GetAllAsync_FiltersByDepartmentAndStatus()
    {
        await using var db = TestDbContextFactory.Create();
        var deptA = SeedDepartment(db, name: "A");
        var deptB = SeedDepartment(db, name: "B");
        SeedProduct(db, deptA.Id, name: "A-progress", status: ManufacturingStatus.InProgress);
        SeedProduct(db, deptA.Id, name: "A-done", quantity: 5, producedQuantity: 5,
            status: ManufacturingStatus.Completed);
        SeedProduct(db, deptB.Id, name: "B-progress", status: ManufacturingStatus.InProgress);
        var sut = CreateSut(db);

        var byDept = await sut.Service.GetAllAsync(1, 50, null, deptA.Id, null);
        byDept.Result!.Items.Select(i => i.Name).Should().BeEquivalentTo(new[] { "A-progress", "A-done" });

        var byStatus = await sut.Service.GetAllAsync(1, 50, null, null, ManufacturingStatus.Completed);
        byStatus.Result!.Items.Select(i => i.Name).Should().BeEquivalentTo(new[] { "A-done" });
    }

    [Fact]
    public async Task GetAllAsync_SearchMatchesName()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db);
        SeedProduct(db, dept.Id, name: "Metall eshik");
        SeedProduct(db, dept.Id, name: "Yog'och stol");
        var sut = CreateSut(db);

        var result = await sut.Service.GetAllAsync(1, 50, "eshik", null, null);

        result.Succeeded.Should().BeTrue();
        result.Result!.Items.Should().ContainSingle().Which.Name.Should().Be("Metall eshik");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GetStatsAsync — aggregate counts
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetStatsAsync_CountsByStatus_ExcludingOrphans()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDepartment(db);
        SeedProduct(db, dept.Id, status: ManufacturingStatus.InProgress);
        SeedProduct(db, dept.Id, status: ManufacturingStatus.InProgress);
        SeedProduct(db, dept.Id, quantity: 5, producedQuantity: 5, status: ManufacturingStatus.Completed);
        // Avtomatik (derived) yozuv — hisobga kiradi.
        SeedProduct(db, dept.Id, status: ManufacturingStatus.Completed,
            contractId: Guid.NewGuid(), contractProductId: Guid.NewGuid());
        // Orphan — hisobga kirmaydi.
        SeedProduct(db, dept.Id, status: ManufacturingStatus.InProgress,
            contractId: Guid.NewGuid(), contractProductId: null);
        var sut = CreateSut(db);

        var result = await sut.Service.GetStatsAsync();

        result.Succeeded.Should().BeTrue();
        result.Result!.Total.Should().Be(4);
        result.Result.InProgress.Should().Be(2);
        result.Result.Completed.Should().Be(2);
    }

    [Fact]
    public async Task GetStatsAsync_NoRows_ReturnsZeros()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.GetStatsAsync();

        result.Succeeded.Should().BeTrue();
        result.Result!.Total.Should().Be(0);
        result.Result.InProgress.Should().Be(0);
        result.Result.Completed.Should().Be(0);
    }
}
