using Application.DTOs.Materials;
using Application.Services.Impl;
using Application.Tests.Infrastructure;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using FluentAssertions;
using Xunit;
using Task = System.Threading.Tasks.Task;

namespace Application.Tests.Services;

public class MaterialServiceTests
{
    private static MaterialService CreateService(DatabaseContext db) => new(db);

    private static Material SeedMaterial(
        DatabaseContext db,
        string code = "MAT-001",
        string name = "Sement M400",
        string category = "Qurilish",
        string unit = "kg",
        decimal quantity = 100m,
        decimal minQuantity = 10m,
        string? location = "A-1",
        MaterialStatus? status = null,
        Guid? id = null)
    {
        var computedStatus = status ?? (
            quantity <= 0 ? MaterialStatus.OutOfStock :
            quantity <= minQuantity ? MaterialStatus.Low :
            MaterialStatus.Available);

        var material = new Material
        {
            Id = id ?? Guid.NewGuid(),
            Code = code,
            Name = name,
            Category = category,
            Unit = unit,
            Quantity = quantity,
            MinQuantity = minQuantity,
            Location = location,
            Status = computedStatus,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Materials.Add(material);
        db.SaveChanges();
        return material;
    }

    // ─────────────────────────────────────────────────────────────────────
    //  CreateAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_WithValidDto_PersistsMaterialAndReturns201()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateService(db);

        var dto = new MaterialCreateDto
        {
            Code = "MAT-2026-001",
            Name = "Sement M400",
            Category = "Qurilish",
            Unit = "kg",
            Quantity = 50m,
            MinQuantity = 10m,
            Location = "A-1",
        };

        // Act
        var result = await sut.CreateAsync(dto);

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result.Should().Be(201);

        var saved = db.Materials.Single(m => m.Code == "MAT-2026-001");
        saved.Name.Should().Be("Sement M400");
        saved.Category.Should().Be("Qurilish");
        saved.Unit.Should().Be("kg");
        saved.Quantity.Should().Be(50m);
        saved.MinQuantity.Should().Be(10m);
        saved.Location.Should().Be("A-1");
        saved.Status.Should().Be(MaterialStatus.Available,
            "Quantity (50) > MinQuantity (10) — material yetarli");
        saved.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));
    }

    [Fact]
    public async Task CreateAsync_WithDuplicateCode_ReturnsFailure()
    {
        // Arrange — kod butun tizim bo'yicha unique
        await using var db = TestDbContextFactory.Create();
        SeedMaterial(db, code: "MAT-DUP", name: "Birinchi");
        var sut = CreateService(db);

        // Act
        var result = await sut.CreateAsync(new MaterialCreateDto
        {
            Code = "MAT-DUP",
            Name = "Ikkinchi",
            Category = "X",
            Unit = "kg",
        });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.Errors.Should().ContainSingle()
            .Which.Should().Contain("'MAT-DUP'").And.Contain("already exists");
        db.Materials.Should().ContainSingle();
    }

    [Fact]
    public async Task CreateAsync_WithDuplicateName_ButDifferentCode_Succeeds()
    {
        // Arrange — joriy xulq: faqat Code unique tekshiriladi; bir xil Name turli
        // Code lar bilan ruxsat etiladi (masalan, har xil partiyalarda kelgan sement).
        await using var db = TestDbContextFactory.Create();
        SeedMaterial(db, code: "MAT-001", name: "Sement");
        var sut = CreateService(db);

        // Act
        var result = await sut.CreateAsync(new MaterialCreateDto
        {
            Code = "MAT-002",
            Name = "Sement",
            Category = "Qurilish",
            Unit = "kg",
        });

        // Assert
        result.Succeeded.Should().BeTrue();
        db.Materials.Count(m => m.Name == "Sement").Should().Be(2);
    }

    [Fact]
    public async Task CreateAsync_ComputesStatusLow_WhenQuantityEqualsMinQuantity()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateService(db);

        // Act
        var result = await sut.CreateAsync(new MaterialCreateDto
        {
            Code = "MAT-LOW",
            Name = "Past",
            Category = "X",
            Unit = "kg",
            Quantity = 10m,
            MinQuantity = 10m,
        });

        // Assert
        result.Succeeded.Should().BeTrue();
        db.Materials.Single().Status.Should().Be(MaterialStatus.Low,
            "Quantity == MinQuantity bo'lsa Low deb belgilanadi");
    }

    [Fact]
    public async Task CreateAsync_ComputesStatusOutOfStock_WhenQuantityIsZero()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateService(db);

        // Act
        var result = await sut.CreateAsync(new MaterialCreateDto
        {
            Code = "MAT-ZERO",
            Name = "Bo'sh",
            Category = "X",
            Unit = "kg",
            Quantity = 0m,
            MinQuantity = 5m,
        });

        // Assert
        result.Succeeded.Should().BeTrue();
        db.Materials.Single().Status.Should().Be(MaterialStatus.OutOfStock);
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
        var result = await sut.UpdateAsync(Guid.NewGuid(), new MaterialUpdateDto { Name = "X" });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
        result.Errors.Should().ContainSingle().Which.Should().Contain("not found");
    }

    [Fact]
    public async Task UpdateAsync_WithPartialDto_OnlyOverridesProvidedFields()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var m = SeedMaterial(db,
            code: "MAT-1",
            name: "Sement",
            category: "Qurilish",
            unit: "kg",
            quantity: 100m,
            minQuantity: 10m,
            location: "A-1");
        var sut = CreateService(db);

        // Act — faqat Location yangilanadi
        var result = await sut.UpdateAsync(m.Id, new MaterialUpdateDto { Location = "B-2" });

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result.Should().Be(200);
        var refreshed = db.Materials.Single(x => x.Id == m.Id);
        refreshed.Location.Should().Be("B-2");
        refreshed.Code.Should().Be("MAT-1");
        refreshed.Name.Should().Be("Sement");
        refreshed.Category.Should().Be("Qurilish");
        refreshed.Unit.Should().Be("kg");
        refreshed.Quantity.Should().Be(100m);
        refreshed.MinQuantity.Should().Be(10m);
    }

    [Fact]
    public async Task UpdateAsync_TouchesUpdatedAt_OnEveryCall()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var past = DateTime.UtcNow.AddDays(-30);
        var m = SeedMaterial(db);
        m.UpdatedAt = past;
        db.SaveChanges();
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(m.Id, new MaterialUpdateDto { Name = "Yangi nom" });

        // Assert
        result.Succeeded.Should().BeTrue();
        db.Materials.Single(x => x.Id == m.Id).UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));
    }

    // ─────────────────────────────────────────────────────────────────────
    //  Stock logic — Status recomputation on Update
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateAsync_DroppingQuantityToMinOrBelow_TransitionsStatusToLow()
    {
        // Arrange — material yetarli, lekin yangi qoldiq MinQuantity ostiga tushadi
        await using var db = TestDbContextFactory.Create();
        var m = SeedMaterial(db, quantity: 100m, minQuantity: 20m,
            status: MaterialStatus.Available);
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(m.Id, new MaterialUpdateDto { Quantity = 15m });

        // Assert
        result.Succeeded.Should().BeTrue();
        var refreshed = db.Materials.Single(x => x.Id == m.Id);
        refreshed.Quantity.Should().Be(15m);
        refreshed.Status.Should().Be(MaterialStatus.Low,
            "qoldiq MinQuantity (20) ostiga tushgan");
    }

    [Fact]
    public async Task UpdateAsync_RaisingMinQuantity_TransitionsStatusToLow()
    {
        // Arrange — qoldiq o'zgarmagan, lekin minQuantity ko'tarilgan
        await using var db = TestDbContextFactory.Create();
        var m = SeedMaterial(db, quantity: 50m, minQuantity: 10m,
            status: MaterialStatus.Available);
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(m.Id, new MaterialUpdateDto { MinQuantity = 100m });

        // Assert
        result.Succeeded.Should().BeTrue();
        db.Materials.Single(x => x.Id == m.Id).Status.Should().Be(MaterialStatus.Low);
    }

    [Fact]
    public async Task UpdateAsync_DroppingQuantityToZero_TransitionsStatusToOutOfStock()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var m = SeedMaterial(db, quantity: 50m, minQuantity: 10m,
            status: MaterialStatus.Available);
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(m.Id, new MaterialUpdateDto { Quantity = 0m });

        // Assert
        result.Succeeded.Should().BeTrue();
        var refreshed = db.Materials.Single(x => x.Id == m.Id);
        refreshed.Quantity.Should().Be(0m);
        refreshed.Status.Should().Be(MaterialStatus.OutOfStock);
    }

    [Fact]
    public async Task UpdateAsync_RestockingFromOutOfStock_TransitionsStatusBackToAvailable()
    {
        // Arrange — material tugagan edi, endi yetkazib berildi
        await using var db = TestDbContextFactory.Create();
        var m = SeedMaterial(db, quantity: 0m, minQuantity: 10m,
            status: MaterialStatus.OutOfStock);
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(m.Id, new MaterialUpdateDto { Quantity = 200m });

        // Assert
        result.Succeeded.Should().BeTrue();
        var refreshed = db.Materials.Single(x => x.Id == m.Id);
        refreshed.Quantity.Should().Be(200m);
        refreshed.Status.Should().Be(MaterialStatus.Available);
    }

    [Fact]
    public async Task UpdateAsync_WithNegativeQuantity_RecordsStatusOutOfStock_NotPreventedByService()
    {
        // Arrange — joriy xulq: MaterialService manfiy qoldiqni TO'XTATMAYDI.
        // Lekin ComputeStatus quantity <= 0 ni OutOfStock deb belgilaydi, ya'ni
        // status orqali bu holat aniq ko'rinadi. Tashqi tekshiruv qatlami (DTO
        // validation yoki controller) manfiylikni keyinroq qo'shsa, bu test
        // o'zgarishi kerak (failure kutiladi).
        await using var db = TestDbContextFactory.Create();
        var m = SeedMaterial(db, quantity: 5m, minQuantity: 10m);
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(m.Id, new MaterialUpdateDto { Quantity = -50m });

        // Assert
        result.Succeeded.Should().BeTrue("hozir servis manfiy qoldiqni qabul qiladi");
        var refreshed = db.Materials.Single(x => x.Id == m.Id);
        refreshed.Quantity.Should().Be(-50m, "joriy implementatsiya qiymatni shundayligicha saqlaydi");
        refreshed.Status.Should().Be(MaterialStatus.OutOfStock,
            "ComputeStatus manfiy qiymatni OutOfStock deb belgilab, manfiy qoldiqni " +
            "yashirinligicha o'tib ketishiga yo'l qo'ymaydi");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  DeleteAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteAsync_OnExistingMaterial_RemovesIt()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var m = SeedMaterial(db);
        var sut = CreateService(db);

        // Act
        var result = await sut.DeleteAsync(m.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result.Should().Be(200);
        db.Materials.Any(x => x.Id == m.Id).Should().BeFalse();
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
        result.StatusCode.Should().Be(404);
        result.Errors.Should().ContainSingle().Which.Should().Contain("not found");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GetById / GetAll — minimal mapping & filtering checks
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetByIdAsync_WithExisting_ReturnsMappedDto()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var m = SeedMaterial(db,
            code: "MAT-X",
            name: "Sement",
            category: "Qurilish",
            unit: "kg",
            quantity: 80m,
            minQuantity: 5m,
            location: "A-1");
        var sut = CreateService(db);

        // Act
        var result = await sut.GetByIdAsync(m.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        var dto = result.Result!;
        dto.Id.Should().Be(m.Id);
        dto.Code.Should().Be("MAT-X");
        dto.Name.Should().Be("Sement");
        dto.Category.Should().Be("Qurilish");
        dto.Unit.Should().Be("kg");
        dto.Quantity.Should().Be(80m);
        dto.MinQuantity.Should().Be(5m);
        dto.Location.Should().Be("A-1");
        dto.Status.Should().Be(MaterialStatus.Available);
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
        result.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetAllAsync_OrdersByName_AndFiltersByCategory()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedMaterial(db, code: "C-1", name: "Zink",    category: "Metall");
        SeedMaterial(db, code: "C-2", name: "Alyumin", category: "Metall");
        SeedMaterial(db, code: "C-3", name: "Sement",  category: "Qurilish");
        var sut = CreateService(db);

        // Act — kategoriya bo'yicha filter
        var result = await sut.GetAllAsync(category: "Metall");

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result!.Select(x => x.Name).Should().Equal("Alyumin", "Zink");
    }

    [Fact]
    public async Task GetAllAsync_WithoutCategory_ReturnsAll()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedMaterial(db, code: "C-1", name: "B", category: "X");
        SeedMaterial(db, code: "C-2", name: "A", category: "Y");
        var sut = CreateService(db);

        // Act
        var result = await sut.GetAllAsync();

        // Assert
        result.Result!.Should().HaveCount(2);
        result.Result!.Select(x => x.Name).Should().Equal("A", "B");
    }
}
