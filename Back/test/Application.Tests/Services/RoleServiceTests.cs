using Application.DTOs;
using Application.DTOs.Roles;
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

public class RoleServiceTests
{
    private static readonly Guid SuperAdminRoleId = new("00000000-0000-0000-0000-000000000001");

    private static RoleService CreateService(DatabaseContext db) => new(db);

    // ─────────────────────────────────────────────────────────────────────
    //  CreateAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_WithUniqueName_PersistsRoleAndReturns201()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateService(db);

        var dto = new RoleCreateDto
        {
            Name = "Sklad Menejeri",
            Description = "Ombor uchun mas'ul",
        };

        // Act
        var result = await sut.CreateAsync(dto);

        // Assert
        result.Succeeded.Should().BeTrue();
        result.StatusCode.Should().Be(201);

        var saved = db.Roles.Single(r => r.Name == "Sklad Menejeri");
        saved.Id.Should().NotBeEmpty();
        saved.Description.Should().Be("Ombor uchun mas'ul");
        saved.IsActive.Should().BeTrue();
        saved.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));
    }

    [Fact]
    public async Task CreateAsync_WithDuplicateName_ReturnsFailureAndDoesNotInsert()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        TestData.SeedRole(db, "Admin");
        var sut = CreateService(db);

        var dto = new RoleCreateDto { Name = "Admin" };

        // Act
        var result = await sut.CreateAsync(dto);

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("'Admin'").And.Contain("already exists");
        db.Roles.Count(r => r.Name == "Admin").Should().Be(1);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  UpdateAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateAsync_WithValidDto_UpdatesNameDescriptionAndIsActive()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var role = TestData.SeedRole(db, "Operator");
        role.Description = "Eski tavsif";
        db.SaveChanges();
        var sut = CreateService(db);

        var dto = new RoleUpdateDto
        {
            Name = "Yangi Operator",
            Description = "Yangilangan tavsif",
            IsActive = false,
        };

        // Act
        var result = await sut.UpdateAsync(role.Id, dto);

        // Assert
        result.Succeeded.Should().BeTrue();

        var refreshed = db.Roles.Single(r => r.Id == role.Id);
        refreshed.Name.Should().Be("Yangi Operator");
        refreshed.Description.Should().Be("Yangilangan tavsif");
        refreshed.IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task UpdateAsync_RenamingToTakenName_ReturnsFailureAndKeepsOldName()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        TestData.SeedRole(db, "Admin");
        var role = TestData.SeedRole(db, "Operator");
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(role.Id, new RoleUpdateDto { Name = "Admin" });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("'Admin'").And.Contain("already exists");
        db.Roles.Single(r => r.Id == role.Id).Name.Should().Be("Operator");
    }

    [Fact]
    public async Task UpdateAsync_OnSuperAdmin_ReturnsForbidden()
    {
        // Arrange — SuperAdmin avtomatik HasData orqali bazaga seed qilinadi
        await using var db = TestDbContextFactory.Create();
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(SuperAdminRoleId, new RoleUpdateDto { Name = "Hacked" });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(403);
        db.Roles.Single(r => r.Id == SuperAdminRoleId).Name.Should().Be("SuperAdmin");
    }

    [Fact]
    public async Task UpdateAsync_WithNonExistentId_ReturnsNotFound()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateService(db);

        // Act
        var result = await sut.UpdateAsync(Guid.NewGuid(), new RoleUpdateDto { Name = "X" });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
        result.Errors.Should().ContainSingle().Which.Should().Contain("not found");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  SetPermissionsAsync — "permissionlar to'liq almashtiriladi"
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task SetPermissionsAsync_ReplacesAllExistingPermissionsWithNewSet()
    {
        // Arrange — rolda 2 ta eski permission bor
        await using var db = TestDbContextFactory.Create();
        var role = TestData.SeedRole(db, "Manager");

        var pOldView = TestData.SeedPermission(db, PermissionModule.Users, PermissionAction.View);
        var pOldCreate = TestData.SeedPermission(db, PermissionModule.Users, PermissionAction.Create);
        TestData.AttachPermissions(db, role.Id, pOldView.Id, pOldCreate.Id);

        var pNewUpdate = TestData.SeedPermission(db, PermissionModule.Users, PermissionAction.Update);
        var pNewDelete = TestData.SeedPermission(db, PermissionModule.Users, PermissionAction.Delete);

        var sut = CreateService(db);

        // Act — yangi 2 ta permission bilan to'liq almashtirish
        var result = await sut.SetPermissionsAsync(
            role.Id,
            new SetPermissionsDto { ActionIds = [pNewUpdate.Id, pNewDelete.Id] });

        // Assert
        result.Succeeded.Should().BeTrue();

        var finalIds = db.RolePermissions
            .Where(rp => rp.RoleId == role.Id)
            .Select(rp => rp.PermissionId)
            .ToList();

        finalIds.Should().HaveCount(2);
        finalIds.Should().BeEquivalentTo(new[] { pNewUpdate.Id, pNewDelete.Id });
        finalIds.Should().NotContain(pOldView.Id);
        finalIds.Should().NotContain(pOldCreate.Id);
    }

    [Fact]
    public async Task SetPermissionsAsync_WithEmptyList_RemovesAllPermissions()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var role = TestData.SeedRole(db, "Operator");
        var p = TestData.SeedPermission(db, PermissionModule.Tasks, PermissionAction.View);
        TestData.AttachPermissions(db, role.Id, p.Id);

        var sut = CreateService(db);

        // Act
        var result = await sut.SetPermissionsAsync(role.Id, new SetPermissionsDto { ActionIds = [] });

        // Assert
        result.Succeeded.Should().BeTrue();
        db.RolePermissions.Any(rp => rp.RoleId == role.Id).Should().BeFalse();
    }

    [Fact]
    public async Task SetPermissionsAsync_OnSuperAdmin_ReturnsForbidden()
    {
        // Arrange — SuperAdmin avtomatik HasData orqali seed qilinadi
        await using var db = TestDbContextFactory.Create();
        var p = TestData.SeedPermission(db, PermissionModule.Users, PermissionAction.View);
        var sut = CreateService(db);

        // Act
        var result = await sut.SetPermissionsAsync(
            SuperAdminRoleId,
            new SetPermissionsDto { ActionIds = [p.Id] });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(403);
        db.RolePermissions.Any(rp => rp.RoleId == SuperAdminRoleId).Should().BeFalse();
    }

    // ─────────────────────────────────────────────────────────────────────
    //  DeleteAsync — soft-delete + foydalanuvchili rolni bloklash
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteAsync_WhenRoleHasAssignedUsers_ReturnsFailureAndDoesNotDeactivate()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var role = TestData.SeedRole(db, "Operator");
        TestData.SeedUser(db, login: "ali", roleId: role.Id);
        var sut = CreateService(db);

        // Act
        var result = await sut.DeleteAsync(role.Id);

        // Assert — kodga ko'ra blok qilinadi (cascade emas)
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.Errors.Should().ContainSingle().Which.Should().Contain("foydalanuvchi");

        var stillThere = db.Roles.Single(r => r.Id == role.Id);
        stillThere.IsActive.Should().BeTrue("rolga bog'liq user bor, soft-delete bo'lmasligi kerak");
    }

    [Fact]
    public async Task DeleteAsync_WhenRoleHasNoUsers_SoftDeletesByDeactivating()
    {
        // Arrange — bo'sh rol, hech bir user bog'lanmagan
        await using var db = TestDbContextFactory.Create();
        var role = TestData.SeedRole(db, "Eski rol");
        var sut = CreateService(db);

        // Act
        var result = await sut.DeleteAsync(role.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        var refreshed = db.Roles.Single(r => r.Id == role.Id);
        refreshed.IsActive.Should().BeFalse("DeleteAsync soft-delete (IsActive=false) sifatida ishlaydi");
    }

    [Fact]
    public async Task DeleteAsync_OnSuperAdmin_ReturnsForbidden()
    {
        // Arrange — SuperAdmin avtomatik HasData orqali seed qilinadi
        await using var db = TestDbContextFactory.Create();
        var sut = CreateService(db);

        // Act
        var result = await sut.DeleteAsync(SuperAdminRoleId);

        // Assert
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(403);
        db.Roles.Single(r => r.Id == SuperAdminRoleId).IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteAsync_WithNonExistentId_ReturnsNotFound()
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
    //  GetAllAsync / GetLookupAsync / GetPermissionsAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAllAsync_ReturnsAllRolesIncludingInactive()
    {
        // Arrange — SuperAdmin avtomatik seeded; tashqari 3 ta qo'shamiz
        await using var db = TestDbContextFactory.Create();
        TestData.SeedRole(db, "Admin");
        TestData.SeedRole(db, "Operator");
        TestData.SeedRole(db, "Arxiv", isActive: false);
        var sut = CreateService(db);

        // Act
        var result = await sut.GetAllAsync();

        // Assert
        result.Succeeded.Should().BeTrue();
        var names = result.Result!.Select(r => r.Name).ToList();
        names.Should().Contain(["SuperAdmin", "Admin", "Operator", "Arxiv"]);
        result.Result!.Should().Contain(r => r.Name == "Arxiv" && !r.IsActive,
            "GetAll faol va nofaol rollarni ham qaytarishi kerak");
    }

    [Fact]
    public async Task GetLookupAsync_ReturnsOnlyActiveRolesOrderedByName()
    {
        // Arrange — SuperAdmin avtomatik seeded (faol)
        await using var db = TestDbContextFactory.Create();
        TestData.SeedRole(db, "Operator");
        TestData.SeedRole(db, "Admin");
        TestData.SeedRole(db, "Arxiv", isActive: false);
        var sut = CreateService(db);

        // Act
        var result = await sut.GetLookupAsync();

        // Assert
        result.Succeeded.Should().BeTrue();
        var names = result.Result!.Select(r => r.Name).ToList();
        names.Should().Equal("Admin", "Operator", "SuperAdmin");
        names.Should().NotContain("Arxiv", "nofaol rollar lookupga tushmasligi kerak");
    }

    [Fact]
    public async Task GetPermissionsAsync_ReturnsAllPermissionIdsAttachedToRole()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var role = TestData.SeedRole(db, "Manager");
        var p1 = TestData.SeedPermission(db, PermissionModule.Users, PermissionAction.View);
        var p2 = TestData.SeedPermission(db, PermissionModule.Roles, PermissionAction.View);
        TestData.AttachPermissions(db, role.Id, p1.Id, p2.Id);

        // boshqa rolga bog'liq permission natijaga tushmasligi kerak
        var other = TestData.SeedRole(db, "Boshqa");
        var p3 = TestData.SeedPermission(db, PermissionModule.Tasks, PermissionAction.View);
        TestData.AttachPermissions(db, other.Id, p3.Id);

        var sut = CreateService(db);

        // Act
        var result = await sut.GetPermissionsAsync(role.Id);

        // Assert
        result.Succeeded.Should().BeTrue();
        result.Result.Should().BeEquivalentTo(new[] { p1.Id, p2.Id });
    }

    [Fact]
    public async Task GetPagedAsync_FiltersBySearchAndPaginatesByName()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        TestData.SeedRole(db, "Admin");
        TestData.SeedRole(db, "Manager");
        TestData.SeedRole(db, "Menejer");
        TestData.SeedRole(db, "Operator");
        var sut = CreateService(db);

        // Act
        var result = await sut.GetPagedAsync(
            new PaginationParams { Page = 1, PageSize = 10 },
            search: "man");

        // Assert
        result.Succeeded.Should().BeTrue();
        var paged = result.Result!;
        paged.TotalCount.Should().Be(1);
        paged.Items.Should().ContainSingle().Which.Name.Should().Be("Manager");
    }
}
