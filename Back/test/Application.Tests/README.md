# Application.Tests

xUnit test loyihasi — `Application` qatlamining servislari uchun unit/integration testlari.

## Ishga tushirish

`Back/` papkasidan:

```bash
# faqat shu loyiha
dotnet test test/Application.Tests/Application.Tests.csproj

# yoki butun solutiondan
dotnet test Back.sln
```

Bitta sinf yoki testni filtrlash:

```bash
dotnet test test/Application.Tests/Application.Tests.csproj --filter "FullyQualifiedName~SmokeTest"
dotnet test test/Application.Tests/Application.Tests.csproj --filter "DisplayName~MetodNomi_Shart_KutilganNatija"
```

Verbose output uchun:

```bash
dotnet test test/Application.Tests/Application.Tests.csproj --logger "console;verbosity=detailed"
```

## Konvensiyalar

- **Naming**: `MetodNomi_Shart_KutilganNatija` — masalan, `Login_WithInvalidPassword_ReturnsError`.
- **Tuzilma**: har test `// Arrange`, `// Act`, `// Assert` bloklari bilan ajratiladi.
- **DB**: har test uchun unique `InMemory` `DatabaseContext` (`TestDbContextFactory.Create()`) — testlar bir-biriga ta'sir qilmaydi.
- **Mocking**: `Moq`, assertion `FluentAssertions`.

## Infrastructure helperlari (`Infrastructure/`)

| Fayl | Maqsadi |
|---|---|
| `TestDbContextFactory.cs` | Unique nomli InMemory `DatabaseContext` |
| `TestHttpContext.cs` | `IHttpContextAccessor` mock — JWT claim'lar va remote IP bilan |
| `TestData.cs` | `Role`, `User`, `Permission` seed helperlari + `AttachPermissions` |
| `OptionsHelper.cs` | `IOptions<T>` ni tez yasash uchun wrapper |

## Misol

```csharp
public class UserService_GetByIdTests
{
    [Fact]
    public async Task GetById_WhenUserExists_ReturnsUserDto()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var role = TestData.SeedRole(db, "Admin");
        var user = TestData.SeedUser(db, login: "admin", roleId: role.Id);
        var http = TestHttpContext.CreateAccessor(userId: user.Id, role: role.Name);
        var sut = new UserService(db, http.Object /*, ... */);

        // Act
        var result = await sut.GetByIdAsync(user.Id);

        // Assert
        result.Should().NotBeNull();
        result!.Login.Should().Be("admin");
    }
}
```
