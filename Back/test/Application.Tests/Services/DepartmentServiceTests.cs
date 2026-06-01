using Application.DTOs.Departments;
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

public class DepartmentServiceTests
{
    private static DepartmentService CreateService(DatabaseContext db) => new(db);

    private static Department SeedDepartment(
        DatabaseContext db,
        string name = "Ishlab chiqarish",
        DepartmentType type = DepartmentType.Bolim,
        int employeeCount = 0,
        bool isActive = true,
        Guid? id = null)
    {
        var dep = new Department
        {
            Id = id ?? Guid.NewGuid(),
            Name = name,
            Type = type,
            EmployeeCount = employeeCount,
            IsActive = isActive,
            CreatedAt = DateTime.UtcNow,
        };
        db.Departments.Add(dep);
        db.SaveChanges();
        return dep;
    }

    // ─────────────────────────────────────────────────────────────────────
    //  CreateAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_WithUniqueName_PersistsDepartmentAndReturns201()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateService(db);

        var dto = new DepartmentCreateDto
        {
            Name = "Ishlab chiqarish",
            Type = DepartmentType.IshlabChiqarish,
            EmployeeCount = 25,
        };

        // Act
        var result = await sut.CreateAsync(dto);

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result.Should().Be(201, "CreateAsync 201 ni Result sifatida qaytaradi (status code emas)");

        var saved = db.Departments.Single(d => d.Name == "Ishlab chiqarish");
        saved.Id.Should().NotBeEmpty();
        saved.Type.Should().Be(DepartmentType.IshlabChiqarish);
        saved.EmployeeCount.Should().Be(25);
        saved.IsActive.Should().BeTrue();
        saved.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));
    }

    [Fact]
    public async Task CreateAsync_WithDuplicateName_ReturnsFailureAndDoesNotInsert()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedDepartment(db, "Omborxona", DepartmentType.Omborxona);
        var sut = CreateService(db);

        var dto = new DepartmentCreateDto { Name = "Omborxona", Type = DepartmentType.Omborxona };

        // Act
        var result = await sut.CreateAsync(dto);

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle()
            .Which.Should().Contain("'Omborxona'").And.Contain("already exists");
        db.Departments.Count(d => d.Name == "Omborxona").Should().Be(1);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  UpdateAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateAsync_WithValidDto_UpdatesNameTypeAndEmployeeCount()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db, "Eski nom", DepartmentType.Bolim, employeeCount: 5);
        var sut = CreateService(db);

        var dto = new DepartmentUpdateDto
        {
            Name = "Yangi nom",
            Type = DepartmentType.Boshqaruv,
            EmployeeCount = 12,
        };

        // Act
        var result = await sut.UpdateAsync(dep.Id, dto);

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result.Should().Be(200);

        var refreshed = db.Departments.Single(d => d.Id == dep.Id);
        refreshed.Name.Should().Be("Yangi nom");
        refreshed.Type.Should().Be(DepartmentType.Boshqaruv);
        refreshed.EmployeeCount.Should().Be(12);
    }

    [Fact]
    public async Task UpdateAsync_WithPartialDto_OnlyOverridesProvidedFields()
    {
        // Arrange — faqat EmployeeCount yangilanadi, qolgani saqlanadi
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db, "Bolim A", DepartmentType.Bolim, employeeCount: 7);
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(dep.Id, new DepartmentUpdateDto { EmployeeCount = 20 });

        // Assert
        result.Succeeded.Should().BeTrue();
        var refreshed = db.Departments.Single(d => d.Id == dep.Id);
        refreshed.Name.Should().Be("Bolim A", "Name dto da yo'q edi, eskisi saqlanishi kerak");
        refreshed.Type.Should().Be(DepartmentType.Bolim);
        refreshed.EmployeeCount.Should().Be(20);
    }

    [Fact]
    public async Task UpdateAsync_RenamingToTakenName_ReturnsFailureAndKeepsOldName()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedDepartment(db, "Omborxona", DepartmentType.Omborxona);
        var dep = SeedDepartment(db, "Bolim A", DepartmentType.Bolim);
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(dep.Id, new DepartmentUpdateDto { Name = "Omborxona" });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle()
            .Which.Should().Contain("'Omborxona'").And.Contain("already exists");
        db.Departments.Single(d => d.Id == dep.Id).Name.Should().Be("Bolim A");
    }

    [Fact]
    public async Task UpdateAsync_WithSameName_DoesNotTriggerDuplicateCheck()
    {
        // Arrange — dto.Name == department.Name bo'lsa, duplicate tekshiruvi o'tkazib yuborilishi kerak
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db, "Bolim A", DepartmentType.Bolim, employeeCount: 3);
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(
            dep.Id,
            new DepartmentUpdateDto { Name = "Bolim A", EmployeeCount = 10 });

        // Assert
        result.Succeeded.Should().BeTrue();
        db.Departments.Single(d => d.Id == dep.Id).EmployeeCount.Should().Be(10);
    }

    [Fact]
    public async Task UpdateAsync_WithNonExistentId_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(Guid.NewGuid(), new DepartmentUpdateDto { Name = "X" });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("not found");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  DeleteAsync — kodda IsActive toggle qiladi (cascade tekshirilmaydi)
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteAsync_OnActiveDepartment_DeactivatesIt()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db, "Bolim A", isActive: true);
        var sut = CreateService(db);

        // Act
        var result = await sut.DeleteAsync(dep.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result.Should().Be(200);
        db.Departments.Single(d => d.Id == dep.Id).IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteAsync_OnInactiveDepartment_ReactivatesIt()
    {
        // Arrange — DeleteAsync IsActive ni toggle qiladi, faolsizni qaytadan faollashtiradi
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db, "Eski bolim", isActive: false);
        var sut = CreateService(db);

        // Act
        var result = await sut.DeleteAsync(dep.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        db.Departments.Single(d => d.Id == dep.Id).IsActive.Should().BeTrue(
            "DeleteAsync IsActive ni teskariga o'giradi (toggle), shuning uchun nofaol bo'lim qayta faollashadi");
    }

    [Fact]
    public async Task DeleteAsync_WithDependentUsers_StillTogglesIsActive_NoCascadeCheck()
    {
        // Arrange — bo'limga bog'liq foydalanuvchi bo'lsa ham DeleteAsync blok qilmaydi.
        // Bu kodning hozirgi xulqi: foreign-key tekshiruvi yo'q, faqat IsActive teskariga o'giriladi.
        await using var db = TestDbContextFactory.Create();
        var role = TestData.SeedRole(db, "Operator");
        var dep = SeedDepartment(db, "Ishlab chiqarish", isActive: true);
        TestData.SeedUser(db, login: "ali", roleId: role.Id, departmentId: dep.Id);
        var sut = CreateService(db);

        // Act
        var result = await sut.DeleteAsync(dep.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        db.Departments.Single(d => d.Id == dep.Id).IsActive.Should().BeFalse();
        db.Users.Single(u => u.Login == "ali").DepartmentId.Should().Be(dep.Id,
            "user.DepartmentId saqlanib qoladi, bog'lanish faqat IsActive=false orqali bilinadi");
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

    // ─────────────────────────────────────────────────────────────────────
    //  GetAllAsync / GetByIdAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAllAsync_ReturnsAllDepartmentsOrderedByName_WithHeadUserName()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var role = TestData.SeedRole(db, "Operator");

        var ombor = SeedDepartment(db, "Omborxona", DepartmentType.Omborxona);
        var bolim = SeedDepartment(db, "Bolim A", DepartmentType.Bolim);
        SeedDepartment(db, "Arxiv", DepartmentType.Bolim, isActive: false);

        // Boshqaruvchi user (IsHead=true) — HeadUserName ga tushishi kerak
        TestData.SeedUser(db,
            login: "boss",
            firstName: "Ali",
            lastName: "Valiyev",
            roleId: role.Id,
            departmentId: ombor.Id,
            isHead: true);

        // Oddiy user (IsHead=false) — head sifatida tushmasligi kerak
        TestData.SeedUser(db,
            login: "junior",
            firstName: "Vali",
            lastName: "Karimov",
            roleId: role.Id,
            departmentId: bolim.Id,
            isHead: false);

        var sut = CreateService(db);

        // Act
        var result = await sut.GetAllAsync();

        // Assert
        result.Succeeded.Should().BeTrue();
        var items = result.Result!.ToList();
        items.Select(i => i.Name).Should().Equal("Arxiv", "Bolim A", "Omborxona");

        items.Single(i => i.Id == ombor.Id).HeadUserName.Should().Be("Ali Valiyev");
        items.Single(i => i.Id == bolim.Id).HeadUserName.Should().BeNull(
            "IsHead=false foydalanuvchi head sifatida hisoblanmaydi");
        items.Single(i => i.Name == "Arxiv").IsActive.Should().BeFalse(
            "GetAll faol va nofaol bo'limlarni ham qaytaradi");
    }

    [Fact]
    public async Task GetByIdAsync_WithExistingId_ReturnsDepartmentWithHeadUserName()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var role = TestData.SeedRole(db, "Operator");
        var dep = SeedDepartment(db, "Ishlab chiqarish", DepartmentType.IshlabChiqarish, employeeCount: 50);
        TestData.SeedUser(db,
            login: "head",
            firstName: "Olim",
            lastName: "Sodiqov",
            roleId: role.Id,
            departmentId: dep.Id,
            isHead: true);

        var sut = CreateService(db);

        // Act
        var result = await sut.GetByIdAsync(dep.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result!.Id.Should().Be(dep.Id);
        result.Result.Name.Should().Be("Ishlab chiqarish");
        result.Result.Type.Should().Be(DepartmentType.IshlabChiqarish);
        result.Result.EmployeeCount.Should().Be(50);
        result.Result.HeadUserName.Should().Be("Olim Sodiqov");
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
    //  GetPagedAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetPagedAsync_FiltersBySearch_ReturnsMatchingDepartments()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedDepartment(db, "Omborxona", DepartmentType.Omborxona);
        SeedDepartment(db, "Bolim A", DepartmentType.Bolim);
        SeedDepartment(db, "Boshqaruv", DepartmentType.Boshqaruv);
        var sut = CreateService(db);

        // Act
        var result = await sut.GetPagedAsync(
            new PaginationParams { Page = 1, PageSize = 10 },
            search: "bol");

        // Assert
        result.Succeeded.Should().BeTrue();
        var paged = result.Result!;
        paged.TotalCount.Should().Be(1);
        paged.Items.Should().ContainSingle().Which.Name.Should().Be("Bolim A");
    }

    [Fact]
    public async Task GetPagedAsync_FiltersByType_ReturnsOnlyMatching()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedDepartment(db, "Omborxona 1", DepartmentType.Omborxona);
        SeedDepartment(db, "Omborxona 2", DepartmentType.Omborxona);
        SeedDepartment(db, "Bolim A", DepartmentType.Bolim);
        var sut = CreateService(db);

        // Act
        var result = await sut.GetPagedAsync(
            new PaginationParams { Page = 1, PageSize = 10 },
            type: DepartmentType.Omborxona);

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result!.TotalCount.Should().Be(2);
        result.Result.Items.Should().OnlyContain(d => d.Type == DepartmentType.Omborxona);
    }
}
