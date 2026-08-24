using Application.DTOs.Auth;
using Application.Helpers;
using Application.Options;
using Application.Services.Impl;
using Application.Tests.Infrastructure;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Task = System.Threading.Tasks.Task;

namespace Application.Tests.Services;

public class AuthServiceTests
{
    private const string ValidPassword = "P@ssw0rd!";

    private static JwtOptions DefaultJwt() => new()
    {
        SecretKey = "test-secret-key-must-be-long-enough-for-hs256-signing-32+chars",
        Issuer = "itm-tests",
        Audience = "itm-tests",
        TokenExpirationMinutes = 60,
        RefreshTokenExpirationDays = 7,
    };

    private static AuthService CreateService(
        DatabaseContext db,
        JwtOptions? jwt = null,
        Guid? userId = null)
    {
        var http = TestHttpContext.CreateAccessor(userId: userId, ip: "10.0.0.1");
        return new AuthService(db, OptionsHelper.Wrap(jwt ?? DefaultJwt()), http.Object);
    }

    private static User SeedActiveUser(
        DatabaseContext db,
        string login = "ali",
        string password = ValidPassword,
        bool isActive = true,
        DateTime? lockoutEnd = null,
        Guid? roleId = null)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Login = login,
            FirstName = "Ali",
            LastName = "Valiyev",
            PasswordHash = PasswordHelper.HashPassword(password),
            RoleId = roleId,
            IsActive = isActive,
            LockoutEnd = lockoutEnd,
            CreatedAt = DateTime.UtcNow,
        };
        db.Users.Add(user);
        db.SaveChanges();
        return user;
    }

    // ─────────────────────────────────────────────────────────────────────
    //  LoginAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task LoginAsync_WithValidCredentials_ReturnsSuccessAndPersistsRefreshToken()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var role = TestData.SeedRole(db, "Admin");
        var perm = TestData.SeedPermission(db, PermissionModule.Users, PermissionAction.View);
        TestData.AttachPermissions(db, role.Id, perm.Id);
        var user = SeedActiveUser(db, login: "ali", password: ValidPassword, roleId: role.Id);

        var sut = CreateService(db);

        // Act
        var result = await sut.LoginAsync(new LoginDto { Login = "ali", Password = ValidPassword });

        // Assert
        result.Succeeded.Should().BeTrue();
        result.StatusCode.Should().Be(200);
        result.Result.Should().NotBeNull();
        result.Result!.AccessToken.Should().NotBeNullOrWhiteSpace();
        result.Result.RefreshToken.Should().NotBeNullOrWhiteSpace();
        result.Result.User.Login.Should().Be("ali");
        result.Result.User.Role.Should().Be("Admin");
        result.Result.User.Permissions.Should().Contain("Users.View");

        var persisted = await db.RefreshTokens.SingleAsync(rt => rt.UserId == user.Id);
        persisted.Token.Should().Be(result.Result.RefreshToken);
        persisted.IsRevoked.Should().BeFalse();
        persisted.CreatedByIp.Should().Be("10.0.0.1");
    }

    [Fact]
    public async Task LoginAsync_WithInvalidPassword_ReturnsUnauthorized()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedActiveUser(db, login: "ali", password: ValidPassword);
        var sut = CreateService(db);

        // Act
        var result = await sut.LoginAsync(new LoginDto { Login = "ali", Password = "wrong-password" });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(401);
        result.Result.Should().BeNull();
        (await db.RefreshTokens.AnyAsync()).Should().BeFalse();
    }

    [Fact]
    public async Task LoginAsync_WithNonExistentLogin_ReturnsUnauthorized()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateService(db);

        // Act
        var result = await sut.LoginAsync(new LoginDto { Login = "nobody", Password = "whatever" });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(401);
        result.Errors.Should().ContainSingle().Which.Should().Contain("Login yoki parol noto'g'ri");

        var attempt = await db.LoginAttempts.SingleAsync();
        attempt.UserId.Should().BeNull();
        attempt.Login.Should().Be("nobody");
        attempt.Success.Should().BeFalse();
    }

    [Fact]
    public async Task LoginAsync_WithInactiveUser_CannotLogIn()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedActiveUser(db, login: "ali", password: ValidPassword, isActive: false);
        var sut = CreateService(db);

        // Act
        var result = await sut.LoginAsync(new LoginDto { Login = "ali", Password = ValidPassword });

        // Assert — inactive user is filtered out, so flow goes through the "invalid login" branch
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(401);
        (await db.RefreshTokens.AnyAsync()).Should().BeFalse();
    }

    [Fact]
    public async Task LoginAsync_AfterFiveConsecutiveFailures_LocksAccountForAbout15Minutes()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var user = SeedActiveUser(db, login: "ali", password: ValidPassword);
        var sut = CreateService(db);
        var before = DateTime.UtcNow;

        // Act — 5 ta noto'g'ri urinish
        for (var i = 0; i < 4; i++)
        {
            var early = await sut.LoginAsync(new LoginDto { Login = "ali", Password = "wrong" });
            early.StatusCode.Should().Be(401);
        }
        var lockoutResult = await sut.LoginAsync(new LoginDto { Login = "ali", Password = "wrong" });

        // Assert
        lockoutResult.Succeeded.Should().BeFalse();
        lockoutResult.StatusCode.Should().Be(423);

        var persisted = await db.Users.SingleAsync(u => u.Id == user.Id);
        persisted.LockoutEnd.Should().NotBeNull();
        persisted.LockoutEnd!.Value.Should().BeCloseTo(before.AddMinutes(15), TimeSpan.FromSeconds(30));
    }

    [Fact]
    public async Task LoginAsync_WhenLockoutInFuture_ReturnsLockedAndCreatesNoToken()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var user = SeedActiveUser(
            db, login: "ali", password: ValidPassword,
            lockoutEnd: DateTime.UtcNow.AddMinutes(10));
        var sut = CreateService(db);

        // Act — to'g'ri parol kiritilsa ham qulflangan
        var result = await sut.LoginAsync(new LoginDto { Login = "ali", Password = ValidPassword });

        // Assert
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(423);
        result.Result.Should().BeNull();

        (await db.RefreshTokens.AnyAsync(rt => rt.UserId == user.Id)).Should().BeFalse();

        var attempt = await db.LoginAttempts.SingleAsync();
        attempt.Success.Should().BeFalse();
        attempt.UserId.Should().Be(user.Id);
    }

    [Fact]
    public async Task LoginAsync_AfterLockoutExpires_DoesNotImmediatelyReLock_DosPrevention()
    {
        // DoS himoyasi: blok muddati tugagach, uni keltirib chiqargan eski
        // muvaffaqiyatsiz urinishlar hisobga olinmasligi kerak — aks holda hujumchi
        // hisobni abadiy bloklab qo'yardi (har safar bitta urinish bilan qayta blok).
        await using var db = TestDbContextFactory.Create();
        var now = DateTime.UtcNow;
        // Blok yaqinda qo'yilib, hozir tugagan (10 soniya oldin).
        var user = SeedActiveUser(db, login: "ali", password: ValidPassword,
            lockoutEnd: now.AddSeconds(-10));

        // Blokni keltirib chiqargan 5 ta urinish — oyna ichida (2 daqiqa oldin),
        // lekin LockoutEnd dan oldin yozilgan.
        for (var i = 0; i < 5; i++)
        {
            db.LoginAttempts.Add(new LoginAttempt
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                Login = "ali",
                AttemptedAt = now.AddMinutes(-2),
                Success = false,
            });
        }
        await db.SaveChangesAsync();

        var sut = CreateService(db);

        // Act — endi bitta noto'g'ri urinish
        var result = await sut.LoginAsync(new LoginDto { Login = "ali", Password = "wrong" });

        // Assert — qayta bloklanmaydi (423 emas, 401), eski urinishlar sanalmaydi
        result.StatusCode.Should().Be(401, "eski urinishlar LockoutEnd dan oldin — hisobga olinmaydi");

        var persisted = await db.Users.SingleAsync(u => u.Id == user.Id);
        persisted.LockoutEnd!.Value.Should().BeBefore(now, "hisob qayta bloklanmasligi kerak");
    }

    [Fact]
    public async Task LoginAsync_OnSuccess_ClearsExistingLockoutEnd()
    {
        // Arrange — qulf muddati o'tib ketgan (lekin hali tozalanmagan)
        await using var db = TestDbContextFactory.Create();
        var user = SeedActiveUser(
            db, login: "ali", password: ValidPassword,
            lockoutEnd: DateTime.UtcNow.AddMinutes(-1));
        var sut = CreateService(db);

        // Act
        var result = await sut.LoginAsync(new LoginDto { Login = "ali", Password = ValidPassword });

        // Assert
        result.Succeeded.Should().BeTrue();
        var persisted = await db.Users.SingleAsync(u => u.Id == user.Id);
        persisted.LockoutEnd.Should().BeNull();
    }

    // ─────────────────────────────────────────────────────────────────────
    //  RefreshTokenAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task RefreshTokenAsync_WithValidToken_RotatesAndRevokesPrevious()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var user = SeedActiveUser(db, login: "ali", password: ValidPassword);
        var sut = CreateService(db);

        var login = await sut.LoginAsync(new LoginDto { Login = "ali", Password = ValidPassword });
        var oldRefresh = login.Result!.RefreshToken;

        // Act
        var refresh = await sut.RefreshTokenAsync(oldRefresh);

        // Assert
        refresh.Succeeded.Should().BeTrue();
        refresh.Result!.AccessToken.Should().NotBeNullOrWhiteSpace();
        refresh.Result.RefreshToken.Should().NotBeNullOrWhiteSpace();
        refresh.Result.RefreshToken.Should().NotBe(oldRefresh);

        var old = await db.RefreshTokens.SingleAsync(rt => rt.Token == oldRefresh);
        old.IsRevoked.Should().BeTrue();
        old.RevokedReason.Should().Be("Rotated");
        old.ReplacedByTokenId.Should().NotBeNull();

        var fresh = await db.RefreshTokens.SingleAsync(rt => rt.Token == refresh.Result.RefreshToken);
        fresh.IsRevoked.Should().BeFalse();
        fresh.UserId.Should().Be(user.Id);
        fresh.FamilyId.Should().Be(old.FamilyId);
        old.ReplacedByTokenId.Should().Be(fresh.Id);
    }

    [Fact]
    public async Task RefreshTokenAsync_WithAlreadyRevokedToken_ReturnsFailure()
    {
        // Arrange — SQLite, chunki RevokeFamilyAsync ExecuteUpdateAsync ishlatadi
        await using var db = TestDbContextFactory.CreateSqlite();
        var user = SeedActiveUser(db, login: "ali", password: ValidPassword);
        var token = new RefreshToken
        {
            Id = Guid.NewGuid(),
            Token = "revoked-token",
            UserId = user.Id,
            FamilyId = Guid.NewGuid(),
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow,
            IsRevoked = true,
            RevokedAt = DateTime.UtcNow.AddMinutes(-5),
            RevokedReason = "ManualRevoke",
        };
        db.RefreshTokens.Add(token);
        await db.SaveChangesAsync();

        var sut = CreateService(db);

        // Act
        var result = await sut.RefreshTokenAsync("revoked-token");

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Result.Should().BeNull();
    }

    [Fact]
    public async Task RefreshTokenAsync_WhenRevokedTokenIsReused_RevokesWholeFamily()
    {
        // Arrange — SQLite, chunki RevokeFamilyAsync ExecuteUpdateAsync ishlatadi
        await using var db = TestDbContextFactory.CreateSqlite();
        var user = SeedActiveUser(db, login: "ali", password: ValidPassword);
        var familyId = Guid.NewGuid();

        var rotated = new RefreshToken
        {
            Id = Guid.NewGuid(),
            Token = "rotated-token",
            UserId = user.Id,
            FamilyId = familyId,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow.AddMinutes(-10),
            IsRevoked = true,
            RevokedAt = DateTime.UtcNow.AddMinutes(-9),
            RevokedReason = "Rotated",
        };
        var liveA = new RefreshToken
        {
            Id = Guid.NewGuid(),
            Token = "live-a",
            UserId = user.Id,
            FamilyId = familyId,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow.AddMinutes(-9),
            IsRevoked = false,
        };
        var liveB = new RefreshToken
        {
            Id = Guid.NewGuid(),
            Token = "live-b",
            UserId = user.Id,
            FamilyId = familyId,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow.AddMinutes(-1),
            IsRevoked = false,
        };
        db.RefreshTokens.AddRange(rotated, liveA, liveB);
        await db.SaveChangesAsync();

        var sut = CreateService(db);

        // Act — eski (revoke qilingan) tokenni yana ishlatib ko'ramiz
        var result = await sut.RefreshTokenAsync("rotated-token");

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("reuse");

        // ExecuteUpdate change tracker'ni chetlab o'tadi — keshlangan entity'larni tashlab,
        // bevosita DB dan o'qib chiqamiz
        db.ChangeTracker.Clear();
        var familyTokens = await db.RefreshTokens
            .Where(rt => rt.FamilyId == familyId)
            .ToListAsync();
        familyTokens.Should().OnlyContain(rt => rt.IsRevoked);
        familyTokens.Where(rt => rt.Token is "live-a" or "live-b")
            .Should().OnlyContain(rt => rt.RevokedReason == "ReuseDetected");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  RevokeTokenAsync (Logout)
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task RevokeTokenAsync_OnLogout_MarksTokenRevoked()
    {
        // Arrange — RevokeTokenAsync ExecuteUpdateAsync ishlatadi, uni InMemory
        // provider tarjima qila olmaydi: relyatsion (SQLite) kontekst kerak.
        await using var db = TestDbContextFactory.CreateSqlite();
        var user = SeedActiveUser(db, login: "ali", password: ValidPassword);
        var sut = CreateService(db);

        var login = await sut.LoginAsync(new LoginDto { Login = "ali", Password = ValidPassword });
        var refreshToken = login.Result!.RefreshToken;

        // Act
        var result = await sut.RevokeTokenAsync(refreshToken);

        // Assert
        result.Succeeded.Should().BeTrue();

        var stored = await db.RefreshTokens.AsNoTracking().SingleAsync(rt => rt.Token == refreshToken);
        stored.IsRevoked.Should().BeTrue();
        stored.RevokedAt.Should().NotBeNull();
        stored.RevokedReason.Should().Be("ManualRevoke");
    }
}
