using Application.Helpers;
using Application.Services.Impl;
using Application.Tests.Infrastructure;
using Core.Entities;
using DataAccess.Persistence;
using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;
using Xunit;
using Task = System.Threading.Tasks.Task;

namespace Application.Tests.Services;

public class SessionGuardTests
{
    private static SessionGuard CreateGuard(DatabaseContext db, IMemoryCache? cache = null) =>
        new(db, cache ?? new MemoryCache(new MemoryCacheOptions()));

    private static Guid SeedFamily(DatabaseContext db, bool isRevoked = false, DateTime? expiresAt = null)
    {
        var familyId = Guid.NewGuid();
        db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            Token = Guid.NewGuid().ToString("N"),
            UserId = Guid.NewGuid(),
            FamilyId = familyId,
            CreatedAt = DateTime.UtcNow.AddMinutes(-5),
            ExpiresAt = expiresAt ?? DateTime.UtcNow.AddDays(7),
            IsRevoked = isRevoked,
        });
        db.SaveChanges();
        return familyId;
    }

    [Fact]
    public async Task IsActiveAsync_ForLiveFamily_ReturnsTrue()
    {
        await using var db = TestDbContextFactory.Create();
        var familyId = SeedFamily(db);

        (await CreateGuard(db).IsActiveAsync(familyId)).Should().BeTrue();
    }

    [Fact]
    public async Task IsActiveAsync_ForRevokedFamily_ReturnsFalse()
    {
        await using var db = TestDbContextFactory.Create();
        var familyId = SeedFamily(db, isRevoked: true);

        (await CreateGuard(db).IsActiveAsync(familyId)).Should().BeFalse();
    }

    [Fact]
    public async Task IsActiveAsync_ForExpiredFamily_ReturnsFalse()
    {
        await using var db = TestDbContextFactory.Create();
        var familyId = SeedFamily(db, expiresAt: DateTime.UtcNow.AddDays(-1));

        (await CreateGuard(db).IsActiveAsync(familyId)).Should().BeFalse();
    }

    [Fact]
    public async Task IsActiveAsync_ForUnknownFamily_ReturnsFalse()
    {
        await using var db = TestDbContextFactory.Create();

        (await CreateGuard(db).IsActiveAsync(Guid.NewGuid())).Should().BeFalse();
    }

    [Fact]
    public async Task MarkRevoked_TakesEffectImmediately_EvenWhileTheRowStillLooksActive()
    {
        // Arrange — bekor qilish keshdagi "faol" javobni darhol bekor qilishi kerak,
        // aks holda tugatilgan seans kesh muddati tugagunicha ishlab turadi.
        await using var db = TestDbContextFactory.Create();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var familyId = SeedFamily(db);
        var guard = CreateGuard(db, cache);

        (await guard.IsActiveAsync(familyId)).Should().BeTrue();

        // Act
        guard.MarkRevoked(familyId);

        // Assert
        (await guard.IsActiveAsync(familyId)).Should().BeFalse();
    }

    [Fact]
    public async Task MarkRevoked_IsVisibleToOtherRequests_ThroughTheSharedCache()
    {
        // Arrange — kesh singleton, guard esa scoped: bir so'rovdagi bekor qilish
        // boshqa so'rovdagi guard nusxasiga ham yetib borishi kerak.
        await using var db = TestDbContextFactory.Create();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var familyId = SeedFamily(db);

        CreateGuard(db, cache).MarkRevoked(familyId);

        // Assert
        (await CreateGuard(db, cache).IsActiveAsync(familyId)).Should().BeFalse();
    }
}
