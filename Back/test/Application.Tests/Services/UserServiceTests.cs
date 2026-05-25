using Application.DTOs.Users;
using Application.Helpers;
using Application.Services.Impl;
using Application.Tests.Infrastructure;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;
using Xunit;
using Task = System.Threading.Tasks.Task;

namespace Application.Tests.Services;

public class UserServiceTests
{
    private const string ValidPassword = "P@ssw0rd!";
    private const string NewValidPassword = "N3w!Secret";

    private static readonly Guid SuperAdminId = new("00000000-0000-0000-0000-000000000001");

    private static UserService CreateService(DatabaseContext db, IMemoryCache? cache = null) =>
        new(db, cache ?? new MemoryCache(new MemoryCacheOptions()));

    private static Department SeedDepartment(
        DatabaseContext db,
        string name = "Ishlab chiqarish",
        DepartmentType type = DepartmentType.Bolim)
    {
        var dep = new Department
        {
            Id = Guid.NewGuid(),
            Name = name,
            Type = type,
            CreatedAt = DateTime.UtcNow,
            IsActive = true,
        };
        db.Departments.Add(dep);
        db.SaveChanges();
        return dep;
    }

    // ─────────────────────────────────────────────────────────────────────
    //  CreateAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_WithValidDto_PersistsUserWithHashedPassword()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var role = TestData.SeedRole(db, "Manager");
        var sut = CreateService(db);

        var dto = new UserCreateDto
        {
            FirstName = "Ali",
            LastName = "Valiyev",
            Login = "ali.valiyev",
            Password = ValidPassword,
            RoleId = role.Id,
        };

        // Act
        var result = await sut.CreateAsync(dto);

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result.Should().Be(201);

        var saved = db.Users.Single(u => u.Login == "ali.valiyev");
        saved.PasswordHash.Should().NotBeNullOrWhiteSpace();
        saved.PasswordHash.Should().NotBe(ValidPassword, "parol plain text saqlanmasligi kerak");
        PasswordHelper.VerifyPassword(ValidPassword, saved.PasswordHash).Should().BeTrue();
        saved.IsActive.Should().BeTrue();
        saved.IsHead.Should().BeFalse();
        saved.RoleId.Should().Be(role.Id);
    }

    [Fact]
    public async Task CreateAsync_WithDuplicateLogin_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        TestData.SeedUser(db, login: "ali");
        var sut = CreateService(db);

        var dto = new UserCreateDto
        {
            FirstName = "Vali",
            LastName = "Aliyev",
            Login = "ali",
            Password = ValidPassword,
        };

        // Act
        var result = await sut.CreateAsync(dto);

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("'ali'").And.Contain("taken");
        db.Users.Count(u => u.Login == "ali").Should().Be(1);
    }

    [Fact]
    public async Task CreateAsync_WithWeakPassword_ReturnsFailureAndDoesNotPersist()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateService(db);

        var dto = new UserCreateDto
        {
            FirstName = "Vali",
            LastName = "Aliyev",
            Login = "vali",
            Password = "short", // 8 ta belgi yo'q, katta harf yo'q, raqam yo'q, maxsus belgi yo'q
        };

        // Act
        var result = await sut.CreateAsync(dto);

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("Parol");
        db.Users.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_WhenDepartmentAlreadyHasHead_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        TestData.SeedUser(db, login: "old.head", firstName: "Eski", lastName: "Rahbar",
            departmentId: dep.Id, isHead: true);
        var sut = CreateService(db);

        var dto = new UserCreateDto
        {
            FirstName = "Yangi",
            LastName = "Rahbar",
            Login = "new.head",
            Password = ValidPassword,
            DepartmentId = dep.Id,
            IsHead = true,
        };

        // Act
        var result = await sut.CreateAsync(dto);

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("Eski Rahbar");
        db.Users.Any(u => u.Login == "new.head").Should().BeFalse();
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
        var result = await sut.UpdateAsync(Guid.NewGuid(), new UserUpdateDto { FirstName = "X" });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("not found");
    }

    [Fact]
    public async Task UpdateAsync_WhenPasswordChanged_RewritesHashAndOldPasswordNoLongerVerifies()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var user = TestData.SeedUser(
            db,
            login: "ali",
            passwordHash: PasswordHelper.HashPassword(ValidPassword));
        var sut = CreateService(db);
        var originalHash = user.PasswordHash;

        // Act
        var result = await sut.UpdateAsync(user.Id, new UserUpdateDto { Password = NewValidPassword });

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result.Should().Be(200);

        var refreshed = db.Users.Single(u => u.Id == user.Id);
        refreshed.PasswordHash.Should().NotBe(originalHash);
        refreshed.PasswordHash.Should().NotBe(NewValidPassword, "parol plain text saqlanmasligi kerak");
        PasswordHelper.VerifyPassword(NewValidPassword, refreshed.PasswordHash).Should().BeTrue();
        PasswordHelper.VerifyPassword(ValidPassword, refreshed.PasswordHash).Should().BeFalse();
    }

    [Fact]
    public async Task UpdateAsync_WithWeakPassword_ReturnsFailureAndKeepsOldHash()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var user = TestData.SeedUser(
            db,
            login: "ali",
            passwordHash: PasswordHelper.HashPassword(ValidPassword));
        var sut = CreateService(db);
        var originalHash = user.PasswordHash;

        // Act
        var result = await sut.UpdateAsync(user.Id, new UserUpdateDto { Password = "weakpw" });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("Parol");
        db.Users.Single(u => u.Id == user.Id).PasswordHash.Should().Be(originalHash);
    }

    [Fact]
    public async Task UpdateAsync_DeactivatingUser_SetsIsActiveFalseAndClearsIsHead()
    {
        // Arrange — User ayni paytda bo'lim rahbari
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        var user = TestData.SeedUser(db, login: "head", departmentId: dep.Id, isHead: true);
        var sut = CreateService(db);

        // Act — deactivate (kodda DeleteAsync yo'q, IsActive=false orqali "o'chiriladi")
        var result = await sut.UpdateAsync(user.Id, new UserUpdateDto { IsActive = false });

        // Assert
        result.Succeeded.Should().BeTrue();
        var refreshed = db.Users.Single(u => u.Id == user.Id);
        refreshed.IsActive.Should().BeFalse();
        refreshed.IsHead.Should().BeFalse("nofaol foydalanuvchi rahbar bo'lib qola olmaydi");
    }

    [Fact]
    public async Task UpdateAsync_ChangingLoginToOneTakenByAnotherUser_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        TestData.SeedUser(db, login: "taken");
        var user = TestData.SeedUser(db, login: "mine");
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(user.Id, new UserUpdateDto { Login = "taken" });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("'taken'").And.Contain("taken");
        db.Users.Single(u => u.Id == user.Id).Login.Should().Be("mine");
    }

    [Fact]
    public async Task UpdateAsync_PromotingToHeadWhenDepartmentAlreadyHasHead_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dep = SeedDepartment(db);
        TestData.SeedUser(db, login: "current.head", firstName: "Joriy", lastName: "Rahbar",
            departmentId: dep.Id, isHead: true);
        var candidate = TestData.SeedUser(db, login: "candidate", departmentId: dep.Id);
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(candidate.Id, new UserUpdateDto { IsHead = true });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("Joriy Rahbar");
        db.Users.Single(u => u.Id == candidate.Id).IsHead.Should().BeFalse();
    }

    [Fact]
    public async Task UpdateAsync_OnSuperAdminId_ReturnsForbiddenAndDoesNothing()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var superAdmin = TestData.SeedUser(db, login: "superadmin", id: SuperAdminId);
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(SuperAdminId, new UserUpdateDto { FirstName = "Hacked" });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(403);
        db.Users.Single(u => u.Id == superAdmin.Id).FirstName.Should().Be(superAdmin.FirstName);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GetByIdAsync / GetAllAsync — DTO only exposes safe fields
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetByIdAsync_WhenUserExists_ReturnsDtoWithoutPasswordFields()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var role = TestData.SeedRole(db, "Admin");
        var dep = SeedDepartment(db, name: "IT");
        var user = TestData.SeedUser(
            db,
            login: "ali",
            firstName: "Ali",
            lastName: "Valiyev",
            roleId: role.Id,
            departmentId: dep.Id);
        var sut = CreateService(db);

        // Act
        var result = await sut.GetByIdAsync(user.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        var dto = result.Result!;
        dto.Id.Should().Be(user.Id);
        dto.Login.Should().Be("ali");
        dto.FirstName.Should().Be("Ali");
        dto.LastName.Should().Be("Valiyev");
        dto.RoleId.Should().Be(role.Id);
        dto.RoleName.Should().Be("Admin");
        dto.DepartmentId.Should().Be(dep.Id);
        dto.DepartmentName.Should().Be("IT");
        dto.IsActive.Should().BeTrue();

        // UserResponseDto da PasswordHash maydoni umuman bo'lmasligi kerak — kompilyatsiya himoyasi sifatida
        typeof(UserResponseDto).GetProperties()
            .Select(p => p.Name)
            .Should().NotContain(name => name.Contains("Password", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task GetByIdAsync_WhenUserMissing_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateService(db);

        // Act
        var result = await sut.GetByIdAsync(Guid.NewGuid());

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Result.Should().BeNull();
        result.Errors.Should().ContainSingle().Which.Should().Contain("not found");
    }

    [Fact]
    public async Task GetAllAsync_ReturnsPagedResultOrderedByFirstNameWithoutPasswordHashes()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        TestData.SeedUser(db, login: "b.user", firstName: "Bekzod", lastName: "B");
        TestData.SeedUser(db, login: "a.user", firstName: "Alisher", lastName: "A");
        TestData.SeedUser(db, login: "c.user", firstName: "Sardor", lastName: "C");
        var sut = CreateService(db);

        // Act
        var result = await sut.GetAllAsync(new PaginationParams { Page = 1, PageSize = 2 });

        // Assert
        result.Succeeded.Should().BeTrue();
        var paged = result.Result!;
        paged.TotalCount.Should().Be(3);
        paged.Page.Should().Be(1);
        paged.PageSize.Should().Be(2);
        paged.HasNextPage.Should().BeTrue();
        paged.Items.Should().HaveCount(2);
        paged.Items.Select(u => u.FirstName).Should().ContainInOrder("Alisher", "Bekzod");
    }
}
