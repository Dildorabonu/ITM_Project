# Talabnomada zaxira foizi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Me'yoriy sarfdan to'ldiriladigan shartnoma talabnomasiga foydalanuvchi ixtiyoriy
ravishda tizim bo'yicha yagona zaxira foizini (boshlang'ich 3%) qo'sha olsin; foizni faqat
`RequisitionAllowance.Update` ruxsati bor odam o'zgartirsin.

**Architecture:** Foiz tarixi alohida `RequisitionAllowanceRates` jadvalida (faqat qo'shiladi,
amaldagi — eng oxirgi yozuv). Talabnoma yaratilganda klient qo'llagan foizni yuboradi, backend
uni bazadagi amaldagi foiz bilan solishtiradi, miqdorlarni `NormAllowance.Apply` bilan tekshiradi
va foizni `Requisition.AllowancePercent` ga snapshot qiladi. Frontend yaratish sahifasida toggle,
ko'rish sahifalarida badge, ro'yxat sahifasida foizni boshqarish oynasi.

**Tech Stack:** .NET 8, EF Core (PostgreSQL; testlarda InMemory), xUnit + FluentAssertions + Moq;
Next.js 16, React 19, TypeScript, Axios, Zustand.

**Spec:** `docs/superpowers/specs/2026-09-25-talabnoma-zaxira-foizi-design.md`

## Global Constraints

- Foiz oralig'i: `0` dan `20` gacha, ko'pi bilan 2 xonali kasr; saqlash turi `decimal(5,2)`.
- Boshlang'ich seed: `Percent = 3`, `Note = "Boshlang'ich qiymat"`, `CreatedByUserId = null`.
- Dona birliklari (katta-kichik harf farqsiz, chetdagi bo'shliq va oxiridagi nuqta kesiladi):
  `шт`, `дона`, `dona` — zaxirali natija **yuqoriga** butun songa yaxlitlanadi; boshqa birliklar aniq o'nlik.
- Zaxirasiz holatda yaxlitlash **yo'q** — hozirgi xatti-harakat saqlanadi.
- Ruxsat: `PermissionModule.RequisitionAllowance = 18`, faqat `PermissionAction.Update`;
  `[Display(Name = "Talabnoma zaxirasi", Description = "percent")]`.
- API: `GET/POST /api/requisition-allowance`; GET — `[Authorize]` (hamma), POST —
  `[HasPermission("RequisitionAllowance.Update")]`.
- Eskirgan foiz xatosi matni aynan: `Zaxira foizi o'zgargan (hozir {X}%) — me'yoriy sarfdan qayta to'ldiring.`
  (`{X}` — `0.##` formatida, InvariantCulture).
- Chop etiladigan blank shakli o'zgarmaydi; toggle — `no-print` asboblar panelida.
- Kodda izoh kam (CLAUDE.md): faqat koddan ko'rinmaydigan sabab uchun; bo'lim sarlavhasi yo'q.
- Har yangi UI satri `t("...")` ga o'raladi va `client/lib/i18n/ru.ts` ga (fayl oxiridagi `};`
  dan oldin) ruscha tarjimasi qo'shiladi; mavjud kalitlar takror qo'shilmaydi (TS dublikat kalit xatosi).
- Backend xabarlari tarjima qilinmaydi (o'zbekcha).
- Commit xabari oxirida: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`;
  `--no-verify` ishlatilmaydi.
- **Avvaldan yiqilayotgan 5 ta test** (bu reja doirasidan tashqari, tuzatilmaydi):
  `RequisitionServiceTests.CreateAsync_ItemMissingBothMaterialAndFreeText_ReturnsFailure`,
  `…WarehouseCheckAsync_AllAvailable_CreatesWarehouseChildAndReservesProduct`,
  `…ApproveAsync_WarehouseSource_TransitionsToReadyForRelease_AndGeneratesQr`,
  `…CreateAsync_WithoutItems_ReturnsFailure`,
  `…CreateAsync_WithValidContractDto_PersistsAsPendingWarehouseCheck`.
  Boshlang'ich holat: 429 dan 424 o'tadi. Rejadan keyin ham shu 5 tasi yiqilishi, qolganlari (yangilari bilan) o'tishi kerak.
- Backend ishlab turgan bo'lsa (`dotnet run`), `dotnet build`/`dotnet ef` dan oldin to'xtatiladi — DLL qulflanadi.
- Ish shoxobchasi: `feat/requisition-allowance` (spec commit'i shu yerda).

## Review Focus

1. **Foiz to'ldirish va yuborish oralig'ida o'zgarsa** — foydalanuvchi aniq xabarni ko'radi,
   toggle o'chadi, miqdorlar asosiyga qaytadi. Backend qismi Task 3 testida
   (`CreateAsync_AllowancePercentOutdated_ReturnsFailure`), frontend qismi Task 8 qo'lda tekshiruvida.
2. **`TotalQty` bo'sh me'yor qatori** (asosiy miqdor `""`) — toggle uni o'zgartirmaydi, backend
   miqdorni tekshirmaydi. Task 3: `CreateAsync_NormLineWithoutTotalQty_WithAllowance_Succeeds`.
3. **Birlik yozilishi farqlari** (`" ШТ. "`, `Dona`) — ikkala tomonda ham yuqoriga yaxlitlanadi.
   Task 1 `NormAllowanceTests` va Task 4 node tekshiruvi.
4. **Suzuvchi nuqta xatosi** — `1000 шт × 3%` `1031` emas, aniq `1030`; `0.007 × 3%` = `0.00721`.
   Task 4 node tekshiruvi (`addPercentStr` / `ceilDecimalStr`).
5. **Toggle bosilganda qo'lda kiritilgan izoh/texnik ko'rsatkich yo'qolmasligi** — faqat `quantity`
   qayta hisoblanadi. Task 5 kodi (`setAllowance`) va Task 8 qo'lda tekshiruvi.

---

## File Structure

**Backend — yaratiladi**
- `Back/src/Application/Helpers/NormAllowance.cs` — zaxira qoidasi (`Apply`, `IsPieceUnit`).
- `Back/src/Core/Entities/RequisitionAllowanceRate.cs` — foiz tarixi yozuvi.
- `Back/src/DataAccess/Configurations/RequisitionAllowanceRateConfiguration.cs` — EF konfiguratsiya.
- `Back/src/Application/DTOs/Requisitions/RequisitionAllowanceRateDto.cs` — javob va saqlash DTO'lari.
- `Back/src/Application/Services/IRequisitionAllowanceService.cs` + `Impl/RequisitionAllowanceService.cs`.
- `Back/src/API/Controllers/RequisitionAllowanceController.cs`.
- `Back/src/DataAccess/Migrations/<timestamp>_AddRequisitionAllowance.cs` (+ Designer) — `dotnet ef` yaratadi.
- `Back/test/Application.Tests/Helpers/NormAllowanceTests.cs`.
- `Back/test/Application.Tests/Services/RequisitionAllowanceServiceTests.cs`.

**Backend — o'zgartiriladi**
- `Back/src/Core/Entities/Requisition.cs` — `AllowancePercent`.
- `Back/src/Core/Enums/PermissionModule.cs` — `RequisitionAllowance = 18`.
- `Back/src/DataAccess/Configurations/RequisitionConfiguration.cs` — `AllowancePercent` aniqligi.
- `Back/src/DataAccess/Persistence/DatabaseContext.cs` — DbSet.
- `Back/src/DataAccess/Persistence/AutomatedMigration.cs` — `ModuleActions` + seed.
- `Back/src/Application/ApplicationDependencyInjection.cs` — DI.
- `Back/src/Application/DTOs/Requisitions/RequisitionCreateDto.cs`, `RequisitionResponseDto.cs`, `RequisitionListDto.cs`.
- `Back/src/Application/Services/Impl/RequisitionService.cs` — konstruktor, yaratish, tekshiruv, bola talabnoma, proyeksiyalar.
- `Back/test/Application.Tests/Services/RequisitionServiceTests.cs` — `CreateService` + yangi testlar.

**Frontend — yaratiladi**
- `client/lib/requisitionAllowance.ts` — API servis, `isPieceUnit`, `applyAllowance`.
- `client/app/(documents)/requisitions/_components/AllowanceBadge.tsx`.
- `client/app/(documents)/requisitions/_components/AllowanceChip.tsx`.
- `client/app/(documents)/requisitions/_components/AllowanceModal.tsx`.

**Frontend — o'zgartiriladi**
- `client/lib/num.ts` — `addPercentStr`, `ceilDecimalStr`.
- `client/lib/api.ts` — `apiErrorMessage`.
- `client/lib/userService.ts` — `allowancePercent` maydonlari.
- `client/app/(documents)/requisitions/print/page.tsx` — toggle, hisob, yuborish, xato.
- `client/app/(documents)/requisitions/[id]/page.tsx`, `_components/RequisitionDrawer.tsx` — badge.
- `client/app/(documents)/requisitions/page.tsx` — chip.
- `client/lib/i18n/ru.ts` — tarjimalar.

---

### Task 1: `NormAllowance` — zaxira qoidasi (backend)

**Files:**
- Create: `Back/src/Application/Helpers/NormAllowance.cs`
- Test: `Back/test/Application.Tests/Helpers/NormAllowanceTests.cs`

**Interfaces:**
- Consumes: —
- Produces: `Application.Helpers.NormAllowance.Apply(decimal quantity, string? unit, decimal percent) : decimal`;
  `NormAllowance.IsPieceUnit(string? unit) : bool`.

- [ ] **Step 1: Failing testni yozish**

`Back/test/Application.Tests/Helpers/NormAllowanceTests.cs`:

```csharp
using Application.Helpers;
using FluentAssertions;
using Xunit;

namespace Application.Tests.Helpers;

public class NormAllowanceTests
{
    [Theory]
    [InlineData(75, "кг", 3, 77.25)]
    [InlineData(0.007, "кг", 3, 0.00721)]
    [InlineData(10, "м2", 2.5, 10.25)]
    [InlineData(14, "шт", 3, 15)]
    [InlineData(1000, "шт", 3, 1030)]
    [InlineData(7, " ШТ. ", 3, 8)]
    [InlineData(14, "дона", 3, 15)]
    [InlineData(14, "Dona", 3, 15)]
    public void Apply_RaisesByPercent_RoundingPiecesUp(double quantity, string unit, double percent, double expected)
    {
        NormAllowance.Apply((decimal)quantity, unit, (decimal)percent).Should().Be((decimal)expected);
    }

    [Fact]
    public void Apply_ZeroPercent_ReturnsQuantityUnchanged()
    {
        NormAllowance.Apply(14.5m, "шт", 0m).Should().Be(14.5m);
    }

    [Theory]
    [InlineData("шт", true)]
    [InlineData("шт.", true)]
    [InlineData(" ШТ ", true)]
    [InlineData("дона", true)]
    [InlineData("dona", true)]
    [InlineData("кг", false)]
    [InlineData("м2", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsPieceUnit_RecognisesPieceSpellings(string? unit, bool expected)
    {
        NormAllowance.IsPieceUnit(unit).Should().Be(expected);
    }
}
```

- [ ] **Step 2: Test yiqilishini tekshirish**

Run: `cd Back/test/Application.Tests && dotnet test --filter "FullyQualifiedName~NormAllowanceTests"`
Expected: build FAIL — `The name 'NormAllowance' does not exist in the current context`.

- [ ] **Step 3: Minimal implementatsiya**

`Back/src/Application/Helpers/NormAllowance.cs`:

```csharp
namespace Application.Helpers;

public static class NormAllowance
{
    // Dona bilan o'lchanadigan material bo'linmaydi — zaxira doim yuqoriga
    // yaxlitlanadi, aks holda material kam chiqadi. Frontend
    // (client/lib/requisitionAllowance.ts) aynan shu ro'yxatni ishlatadi.
    private static readonly HashSet<string> PieceUnits =
        new(StringComparer.OrdinalIgnoreCase) { "шт", "дона", "dona" };

    public static decimal Apply(decimal quantity, string? unit, decimal percent)
    {
        if (percent == 0)
            return quantity;

        var raised = quantity * (100m + percent) / 100m;
        return IsPieceUnit(unit) ? Math.Ceiling(raised) : raised;
    }

    public static bool IsPieceUnit(string? unit) =>
        PieceUnits.Contains((unit ?? string.Empty).Trim().TrimEnd('.'));
}
```

- [ ] **Step 4: Test o'tishini tekshirish**

Run: `cd Back/test/Application.Tests && dotnet test --filter "FullyQualifiedName~NormAllowanceTests"`
Expected: PASS — 18 ta test.

- [ ] **Step 5: Commit**

```bash
git add Back/src/Application/Helpers/NormAllowance.cs Back/test/Application.Tests/Helpers/NormAllowanceTests.cs
git commit -m "$(cat <<'EOF'
feat(requisitions): add the norm allowance rounding rule

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Zaxira foizi saqlash, ruxsat va API (backend)

**Files:**
- Create: `Back/src/Core/Entities/RequisitionAllowanceRate.cs`
- Create: `Back/src/DataAccess/Configurations/RequisitionAllowanceRateConfiguration.cs`
- Create: `Back/src/Application/DTOs/Requisitions/RequisitionAllowanceRateDto.cs`
- Create: `Back/src/Application/Services/IRequisitionAllowanceService.cs`
- Create: `Back/src/Application/Services/Impl/RequisitionAllowanceService.cs`
- Create: `Back/src/API/Controllers/RequisitionAllowanceController.cs`
- Modify: `Back/src/Core/Entities/Requisition.cs` (RejectionReason'dan keyin)
- Modify: `Back/src/Core/Enums/PermissionModule.cs` (oxiriga)
- Modify: `Back/src/DataAccess/Configurations/RequisitionConfiguration.cs`
- Modify: `Back/src/DataAccess/Persistence/DatabaseContext.cs:48`
- Modify: `Back/src/DataAccess/Persistence/AutomatedMigration.cs:25,113,480-497`
- Modify: `Back/src/Application/ApplicationDependencyInjection.cs:53`
- Create (generated): `Back/src/DataAccess/Migrations/<timestamp>_AddRequisitionAllowance.cs`
- Test: `Back/test/Application.Tests/Services/RequisitionAllowanceServiceTests.cs`

**Interfaces:**
- Consumes: —
- Produces:
  - `Core.Entities.RequisitionAllowanceRate { Guid Id; decimal Percent; string? Note; DateTime CreatedAt; Guid? CreatedByUserId }`
  - `DatabaseContext.RequisitionAllowanceRates : DbSet<RequisitionAllowanceRate>`
  - `Requisition.AllowancePercent : decimal?`
  - `Application.DTOs.Requisitions.RequisitionAllowanceRateDto { Guid Id; decimal Percent; string? Note; DateTime CreatedAt; string? CreatedByName }`
  - `Application.DTOs.Requisitions.RequisitionAllowanceSaveDto { decimal Percent; string? Note }`
  - `IRequisitionAllowanceService.GetAllAsync() : Task<ApiResult<IEnumerable<RequisitionAllowanceRateDto>>>`
  - `IRequisitionAllowanceService.CreateAsync(RequisitionAllowanceSaveDto dto, Guid userId) : Task<ApiResult<Guid>>` (muvaffaqiyatda 201)
  - `IRequisitionAllowanceService.GetCurrentPercentAsync() : Task<decimal>` (yozuv yo'q — `0`)
  - `RequisitionAllowanceService(DatabaseContext context)` konstruktor
  - HTTP: `GET /api/requisition-allowance`, `POST /api/requisition-allowance` `{ percent, note }`

- [ ] **Step 1: Entity, DbSet va Requisition maydoni**

`Back/src/Core/Entities/RequisitionAllowanceRate.cs`:

```csharp
namespace Core.Entities;

// Tarix o'zgarmas: yozuvlar faqat qo'shiladi, amaldagi foiz — eng oxirgi yozuv.
public class RequisitionAllowanceRate
{
    public Guid Id { get; set; }
    public decimal Percent { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid? CreatedByUserId { get; set; }
}
```

`Back/src/Core/Entities/Requisition.cs` — `public string? RejectionReason { get; set; }` qatoridan keyin:

```csharp

    // Me'yoriy sarfga qo'shilgan zaxira foizi (yaratilgan paytdagi qiymat);
    // null — aniq me'yor bo'yicha.
    public decimal? AllowancePercent { get; set; }
```

`Back/src/DataAccess/Persistence/DatabaseContext.cs` — `public DbSet<EnergyTariff> EnergyTariffs { get; set; }` dan keyin:

```csharp
    public DbSet<RequisitionAllowanceRate> RequisitionAllowanceRates { get; set; }
```

- [ ] **Step 2: DTO va servis interfeysi**

`Back/src/Application/DTOs/Requisitions/RequisitionAllowanceRateDto.cs`:

```csharp
namespace Application.DTOs.Requisitions;

public class RequisitionAllowanceRateDto
{
    public Guid Id { get; set; }
    public decimal Percent { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }

    // Seed yozuvida yoki foydalanuvchi o'chirilgan bo'lsa null.
    public string? CreatedByName { get; set; }
}

public class RequisitionAllowanceSaveDto
{
    public decimal Percent { get; set; }
    public string? Note { get; set; }
}
```

`Back/src/Application/Services/IRequisitionAllowanceService.cs`:

```csharp
using Application.DTOs;
using Application.DTOs.Requisitions;

namespace Application.Services;

public interface IRequisitionAllowanceService
{
    Task<ApiResult<IEnumerable<RequisitionAllowanceRateDto>>> GetAllAsync();
    Task<ApiResult<Guid>> CreateAsync(RequisitionAllowanceSaveDto dto, Guid userId);
    Task<decimal> GetCurrentPercentAsync();
}
```

- [ ] **Step 3: Failing servis testlarini yozish**

`Back/test/Application.Tests/Services/RequisitionAllowanceServiceTests.cs`:

```csharp
using Application.DTOs.Requisitions;
using Application.Services.Impl;
using Application.Tests.Infrastructure;
using Core.Entities;
using DataAccess.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Task = System.Threading.Tasks.Task;

namespace Application.Tests.Services;

public class RequisitionAllowanceServiceTests
{
    private static readonly DateTime Base = new(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);

    private static RequisitionAllowanceRate Seed(DatabaseContext db, decimal percent, DateTime createdAt, Guid? userId = null)
    {
        var rate = new RequisitionAllowanceRate
        {
            Id = Guid.NewGuid(),
            Percent = percent,
            CreatedAt = createdAt,
            CreatedByUserId = userId,
        };
        db.RequisitionAllowanceRates.Add(rate);
        db.SaveChanges();
        return rate;
    }

    [Fact]
    public async Task GetAllAsync_ReturnsNewestFirstWithAuthorName()
    {
        await using var db = TestDbContextFactory.Create();
        var user = TestData.SeedUser(db, login: "ali", firstName: "Ali", lastName: "Valiyev");
        Seed(db, 3m, Base);
        Seed(db, 5m, Base.AddDays(1), user.Id);

        var result = await new RequisitionAllowanceService(db).GetAllAsync();

        result.Succeeded.Should().BeTrue();
        var rates = result.Result!.ToList();
        rates.Select(r => r.Percent).Should().Equal(5m, 3m);
        rates[0].CreatedByName.Should().Be("Valiyev Ali");
        rates[1].CreatedByName.Should().BeNull();
    }

    [Fact]
    public async Task GetCurrentPercentAsync_ReturnsLatestRate()
    {
        await using var db = TestDbContextFactory.Create();
        Seed(db, 5m, Base.AddDays(1));
        Seed(db, 3m, Base);

        (await new RequisitionAllowanceService(db).GetCurrentPercentAsync()).Should().Be(5m);
    }

    [Fact]
    public async Task GetCurrentPercentAsync_WithoutRates_ReturnsZero()
    {
        await using var db = TestDbContextFactory.Create();

        (await new RequisitionAllowanceService(db).GetCurrentPercentAsync()).Should().Be(0m);
    }

    [Fact]
    public async Task CreateAsync_WithValidPercent_AppendsRate()
    {
        await using var db = TestDbContextFactory.Create();
        Seed(db, 3m, Base);
        var userId = Guid.NewGuid();

        var result = await new RequisitionAllowanceService(db)
            .CreateAsync(new RequisitionAllowanceSaveDto { Percent = 5m, Note = "  brak ko'paydi  " }, userId);

        result.Succeeded.Should().BeTrue();
        result.StatusCode.Should().Be(201);
        db.RequisitionAllowanceRates.Should().HaveCount(2);
        var saved = await db.RequisitionAllowanceRates.SingleAsync(r => r.Id == result.Result);
        saved.Percent.Should().Be(5m);
        saved.Note.Should().Be("brak ko'paydi");
        saved.CreatedByUserId.Should().Be(userId);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(20.01)]
    public async Task CreateAsync_OutOfRange_ReturnsFailure(double percent)
    {
        await using var db = TestDbContextFactory.Create();

        var result = await new RequisitionAllowanceService(db)
            .CreateAsync(new RequisitionAllowanceSaveDto { Percent = (decimal)percent }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("0 dan 20 gacha");
        db.RequisitionAllowanceRates.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_MoreThanTwoDecimals_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();

        var result = await new RequisitionAllowanceService(db)
            .CreateAsync(new RequisitionAllowanceSaveDto { Percent = 3.125m }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("2 xonali");
    }

    [Fact]
    public async Task CreateAsync_SameAsCurrent_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        Seed(db, 3m, Base);

        var result = await new RequisitionAllowanceService(db)
            .CreateAsync(new RequisitionAllowanceSaveDto { Percent = 3m }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("o'zgarmagan");
        db.RequisitionAllowanceRates.Should().HaveCount(1);
    }

    [Fact]
    public async Task CreateAsync_NoteTooLong_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();

        var result = await new RequisitionAllowanceService(db)
            .CreateAsync(new RequisitionAllowanceSaveDto { Percent = 4m, Note = new string('a', 501) }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("500");
    }
}
```

- [ ] **Step 4: Test yiqilishini tekshirish**

Run: `cd Back/test/Application.Tests && dotnet test --filter "FullyQualifiedName~RequisitionAllowanceServiceTests"`
Expected: build FAIL — `The type or namespace name 'RequisitionAllowanceService' could not be found`.

- [ ] **Step 5: Servis implementatsiyasi**

`Back/src/Application/Services/Impl/RequisitionAllowanceService.cs`:

```csharp
using Application.DTOs;
using Application.DTOs.Requisitions;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class RequisitionAllowanceService : IRequisitionAllowanceService
{
    private const decimal MaxPercent = 20m;
    private const int NoteMaxLength = 500;

    private readonly DatabaseContext _context;

    public RequisitionAllowanceService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<IEnumerable<RequisitionAllowanceRateDto>>> GetAllAsync()
    {
        var rates = await _context.RequisitionAllowanceRates
            .AsNoTracking()
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new RequisitionAllowanceRateDto
            {
                Id = r.Id,
                Percent = r.Percent,
                Note = r.Note,
                CreatedAt = r.CreatedAt,
                CreatedByName = _context.Users
                    .Where(u => u.Id == r.CreatedByUserId)
                    .Select(u => u.LastName + " " + u.FirstName)
                    .FirstOrDefault(),
            })
            .ToListAsync();

        return ApiResult<IEnumerable<RequisitionAllowanceRateDto>>.Success(rates);
    }

    public async Task<decimal> GetCurrentPercentAsync() =>
        await _context.RequisitionAllowanceRates
            .AsNoTracking()
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => (decimal?)r.Percent)
            .FirstOrDefaultAsync() ?? 0m;

    public async Task<ApiResult<Guid>> CreateAsync(RequisitionAllowanceSaveDto dto, Guid userId)
    {
        if (dto.Percent < 0 || dto.Percent > MaxPercent)
            return ApiResult<Guid>.Failure(["Zaxira foizi 0 dan 20 gacha bo'lishi kerak."]);

        if (decimal.Round(dto.Percent, 2) != dto.Percent)
            return ApiResult<Guid>.Failure(["Zaxira foizi ko'pi bilan 2 xonali kasr bo'lishi mumkin."]);

        var note = dto.Note?.Trim();
        if (note?.Length > NoteMaxLength)
            return ApiResult<Guid>.Failure(["Izoh 500 belgidan oshmasligi kerak."]);

        if (dto.Percent == await GetCurrentPercentAsync())
            return ApiResult<Guid>.Failure(["Zaxira foizi o'zgarmagan."]);

        var rate = new RequisitionAllowanceRate
        {
            Id = Guid.NewGuid(),
            Percent = dto.Percent,
            Note = string.IsNullOrEmpty(note) ? null : note,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = userId,
        };

        _context.RequisitionAllowanceRates.Add(rate);
        await _context.SaveChangesAsync();

        return ApiResult<Guid>.Success(rate.Id, 201);
    }
}
```

`Back/src/Application/ApplicationDependencyInjection.cs` — `services.AddScoped<IEnergyTariffService, EnergyTariffService>();` dan keyin:

```csharp
        services.AddScoped<IRequisitionAllowanceService, RequisitionAllowanceService>();
```

- [ ] **Step 6: Test o'tishini tekshirish**

Run: `cd Back/test/Application.Tests && dotnet test --filter "FullyQualifiedName~RequisitionAllowanceServiceTests"`
Expected: PASS — 9 ta test.

- [ ] **Step 7: EF konfiguratsiya, ruxsat, seed, controller**

`Back/src/DataAccess/Configurations/RequisitionAllowanceRateConfiguration.cs`:

```csharp
using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class RequisitionAllowanceRateConfiguration : IEntityTypeConfiguration<RequisitionAllowanceRate>
{
    public void Configure(EntityTypeBuilder<RequisitionAllowanceRate> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Percent).HasPrecision(5, 2);
        builder.Property(x => x.Note).HasMaxLength(500);

        builder.HasIndex(x => x.CreatedAt);
    }
}
```

`Back/src/DataAccess/Configurations/RequisitionConfiguration.cs` — `builder.Property(r => r.RejectionReason).HasMaxLength(500);` dan keyin:

```csharp
        builder.Property(r => r.AllowancePercent).HasPrecision(5, 2);
```

`Back/src/Core/Enums/PermissionModule.cs` — `Energy = 17,` dan keyin (enum `}` dan oldin):

```csharp

    [Display(Name = "Talabnoma zaxirasi", Description = "percent")]
    RequisitionAllowance = 18,
```

`Back/src/DataAccess/Persistence/AutomatedMigration.cs`:

1. `ModuleActions` lug'atida `[PermissionModule.Energy] = [PermissionAction.Update],` dan keyin:

```csharp
        [PermissionModule.RequisitionAllowance] = [PermissionAction.Update],
```

2. `ApplyMigrationsAsync` ichida `await SeedEnergyTariffAsync(context);` dan keyin:

```csharp
        await SeedRequisitionAllowanceAsync(context);
```

3. `SeedEnergyTariffAsync` metodidan keyin (klass `}` dan oldin):

```csharp

    /// <summary>
    /// Boshlang'ich zaxira foizi. Faqat jadval butunlay bo'sh bo'lsa yoziladi —
    /// keyingi o'zgarishlar UI orqali tarixga qo'shiladi.
    /// </summary>
    private static async System.Threading.Tasks.Task SeedRequisitionAllowanceAsync(DatabaseContext context)
    {
        if (await context.RequisitionAllowanceRates.AnyAsync())
            return;

        context.RequisitionAllowanceRates.Add(new RequisitionAllowanceRate
        {
            Id = Guid.NewGuid(),
            Percent = 3m,
            Note = "Boshlang'ich qiymat",
            CreatedAt = DateTime.UtcNow,
        });

        await context.SaveChangesAsync();
    }
```

`Back/src/API/Controllers/RequisitionAllowanceController.cs`:

```csharp
using API.Authorization;
using Application.DTOs.Requisitions;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

/// <summary>
/// Talabnoma zaxira foizi. O'qish — hammaga (talabnoma to'ldiruvchi joriy foizni
/// ko'radi); o'zgartirish — faqat "RequisitionAllowance.Update" ruxsati bilan.
/// </summary>
[ApiController]
[Route("api/requisition-allowance")]
[Authorize]
public class RequisitionAllowanceController : ControllerBase
{
    private readonly IRequisitionAllowanceService _service;

    public RequisitionAllowanceController(IRequisitionAllowanceService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _service.GetAllAsync();
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("RequisitionAllowance.Update")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] RequisitionAllowanceSaveDto dto)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var result = await _service.CreateAsync(dto, userId);
        return StatusCode(result.StatusCode, result);
    }
}
```

(Policy'lar `Program.cs:110-118` da `PermissionModule` enum'idan avtomatik yasaladi — qo'shimcha ro'yxatga olish kerak emas.)

- [ ] **Step 8: Migratsiya yaratish va tekshirish**

Backend ishlab turgan bo'lsa to'xtating. So'ng:

Run: `cd Back/src && dotnet ef migrations add AddRequisitionAllowance --project DataAccess --startup-project API`
Expected: `Done.` — `DataAccess/Migrations/<timestamp>_AddRequisitionAllowance.cs` yaratiladi.

Yaratilgan `Up()` ni o'qing — faqat quyidagilar bo'lishi kerak:
- `migrationBuilder.AddColumn<decimal>(name: "AllowancePercent", table: "Requisitions", type: "numeric(5,2)", precision: 5, scale: 2, nullable: true);`
- `migrationBuilder.CreateTable(name: "RequisitionAllowanceRates", …)` — `Percent numeric(5,2)`, `Note character varying(500)` nullable, `CreatedAt`, `CreatedByUserId uuid` nullable;
- `CreateIndex` — `IX_RequisitionAllowanceRates_CreatedAt`.

Boshqa jadvallarga tegadigan o'zgarish bo'lsa — to'xtab, sababini aniqlang (snapshot bilan model farqi).

Run: `cd Back/src && dotnet ef database update --project DataAccess --startup-project API`
Expected: `Done.`

Run: `cd Back/src && dotnet build API`
Expected: `Build succeeded.` 0 error.

- [ ] **Step 9: Barcha backend testlari**

Run: `cd Back/test/Application.Tests && dotnet test`
Expected: faqat Global Constraints'dagi 5 ta avvaldan yiqilgan test FAIL; qolgan hammasi PASS (424 + 27 yangi = 451 passed).

- [ ] **Step 10: Commit**

```bash
git add Back/src/Core Back/src/DataAccess Back/src/Application Back/src/API/Controllers/RequisitionAllowanceController.cs Back/test/Application.Tests/Services/RequisitionAllowanceServiceTests.cs
git commit -m "$(cat <<'EOF'
feat(requisitions): store the allowance percentage with its change history

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Talabnoma yaratishda zaxirani tekshirish va saqlash (backend)

**Files:**
- Modify: `Back/src/Application/DTOs/Requisitions/RequisitionCreateDto.cs`
- Modify: `Back/src/Application/DTOs/Requisitions/RequisitionResponseDto.cs`
- Modify: `Back/src/Application/DTOs/Requisitions/RequisitionListDto.cs`
- Modify: `Back/src/Application/Services/Impl/RequisitionService.cs` (konstruktor :16-25, CreateAsync :350-390, ValidateItemsAgainstCostNormAsync/MatchesNorm/LineMatchesItem :470-554, bola talabnomalar :739-785, GetById proyeksiyasi :246-262, ListProjection :1376-1389)
- Test: `Back/test/Application.Tests/Services/RequisitionServiceTests.cs`

**Interfaces:**
- Consumes: `NormAllowance.Apply` (Task 1); `IRequisitionAllowanceService.GetCurrentPercentAsync`, `RequisitionAllowanceService(DatabaseContext)`, `DatabaseContext.RequisitionAllowanceRates`, `Requisition.AllowancePercent` (Task 2).
- Produces:
  - `RequisitionCreateDto.AllowancePercent : decimal?`
  - `RequisitionResponseDto.AllowancePercent : decimal?`, `RequisitionListDto.AllowancePercent : decimal?`
  - `RequisitionService(DatabaseContext, INotificationService, IQrCodeService, IRequisitionAllowanceService)` konstruktor
  - JSON: `allowancePercent` (create so'rovida kiruvchi; detal va ro'yxat javoblarida chiquvchi)

- [ ] **Step 1: Test helper'larini yangilash**

`Back/test/Application.Tests/Services/RequisitionServiceTests.cs`:

`CreateService` ni almashtiring:

```csharp
    private static RequisitionService CreateService(DatabaseContext db, Mock<INotificationService>? notifications = null)
    {
        notifications ??= new Mock<INotificationService>();
        return new RequisitionService(db, notifications.Object, new Mock<IQrCodeService>().Object, new RequisitionAllowanceService(db));
    }
```

`SeedWarehouseChecker` metodidan keyin helper'lar qo'shing:

```csharp
    private static void SeedAllowanceRate(DatabaseContext db, decimal percent)
    {
        db.RequisitionAllowanceRates.Add(new RequisitionAllowanceRate
        {
            Id = Guid.NewGuid(),
            Percent = percent,
            CreatedAt = DateTime.UtcNow,
        });
        db.SaveChanges();
    }

    /// <summary>
    /// Shartnoma + bitta mahsulot (soni productQty) + bo'limga biriktirilmagan
    /// me'yoriy sarf qatorlari.
    /// </summary>
    private static Contract SeedContractWithNorm(
        DatabaseContext db, int productQty, params (string Name, string Unit, string? TotalQty)[] lines)
    {
        var contract = SeedContract(db);
        var product = new ContractProduct
        {
            Id = Guid.NewGuid(),
            ContractId = contract.Id,
            ProductType = "Mahsulot",
            Quantity = productQty,
            Unit = "dona",
        };
        db.ContractProducts.Add(product);
        db.CostNorms.Add(new CostNorm
        {
            Id = Guid.NewGuid(),
            ContractId = contract.Id,
            ContractProductId = product.Id,
            Title = "Me'yor",
            CreatedBy = Guid.NewGuid(),
            Items = lines.Select((l, i) => new CostNormItem
            {
                Id = Guid.NewGuid(),
                Name = l.Name,
                Unit = l.Unit,
                TotalQty = l.TotalQty,
                SortOrder = i,
            }).ToList(),
        });
        db.SaveChanges();
        return contract;
    }

    // DepartmentId ikkala tipda ham majburiy va yaratuvchining o'z bo'limi bo'lishi shart.
    private static RequisitionCreateDto NormRequisition(
        Guid contractId, User creator, decimal? allowancePercent, params (string Name, string Unit, decimal Quantity)[] items) => new()
    {
        Type = RequisitionType.Contract,
        ContractId = contractId,
        DepartmentId = creator.DepartmentId,
        Purpose = "Test",
        AllowancePercent = allowancePercent,
        Items = items.Select(i => new RequisitionItemCreateDto
        {
            FreeTextName = i.Name,
            FreeTextUnit = i.Unit,
            Quantity = i.Quantity,
        }).ToList(),
    };

    private static User SeedCreatorWithDept(DatabaseContext db)
    {
        var dept = SeedDept(db);
        return TestData.SeedUser(db, login: "creator", departmentId: dept.Id);
    }
```

- [ ] **Step 2: Failing testlarni yozish**

`CreateAsync_NotifiesEligibleWarehouseCheckers` testidan keyin (`GetAllAsync / GetByIdAsync` bo'limidan oldin):

```csharp
    // ─────────────────────────────────────────────────────────────────────
    //  CreateAsync — me'yoriy sarf va zaxira foizi
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_NormWithoutAllowance_AcceptsExactQuantity()
    {
        await using var db = CreateDb();
        var creator = SeedCreatorWithDept(db);
        SeedAllowanceRate(db, 3m);
        var contract = SeedContractWithNorm(db, 500, ("Круг сталь Ст3", "кг", "0,15"));

        var result = await CreateService(db).CreateAsync(
            NormRequisition(contract.Id, creator, null, ("Круг сталь Ст3", "кг", 75m)), creator.Id);

        result.Succeeded.Should().BeTrue();
        (await db.Requisitions.SingleAsync()).AllowancePercent.Should().BeNull();
    }

    [Fact]
    public async Task CreateAsync_NormWithAllowance_AcceptsRaisedQuantityAndStoresPercent()
    {
        await using var db = CreateDb();
        var creator = SeedCreatorWithDept(db);
        SeedAllowanceRate(db, 3m);
        var contract = SeedContractWithNorm(db, 500, ("Круг сталь Ст3", "кг", "0,15"));

        var result = await CreateService(db).CreateAsync(
            NormRequisition(contract.Id, creator, 3m, ("Круг сталь Ст3", "кг", 77.25m)), creator.Id);

        result.Succeeded.Should().BeTrue();
        (await db.Requisitions.SingleAsync()).AllowancePercent.Should().Be(3m);
    }

    [Fact]
    public async Task CreateAsync_NormWithAllowance_RoundsPieceUnitsUp()
    {
        await using var db = CreateDb();
        var creator = SeedCreatorWithDept(db);
        SeedAllowanceRate(db, 3m);
        var contract = SeedContractWithNorm(db, 7, ("Петля универсальная", "шт", "2"));

        // 2 × 7 = 14 → 14 × 1,03 = 14,42 → yuqoriga 15
        var result = await CreateService(db).CreateAsync(
            NormRequisition(contract.Id, creator, 3m, ("Петля универсальная", "шт", 15m)), creator.Id);

        result.Succeeded.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_AllowanceRequestedButExactQuantity_ReturnsFailure()
    {
        await using var db = CreateDb();
        var creator = SeedCreatorWithDept(db);
        SeedAllowanceRate(db, 3m);
        var contract = SeedContractWithNorm(db, 500, ("Круг сталь Ст3", "кг", "0,15"));

        var result = await CreateService(db).CreateAsync(
            NormRequisition(contract.Id, creator, 3m, ("Круг сталь Ст3", "кг", 75m)), creator.Id);

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("me'yoriy sarfiga mos emas");
    }

    [Fact]
    public async Task CreateAsync_AllowancePercentOutdated_ReturnsFailure()
    {
        await using var db = CreateDb();
        var creator = SeedCreatorWithDept(db);
        SeedAllowanceRate(db, 5m);
        var contract = SeedContractWithNorm(db, 500, ("Круг сталь Ст3", "кг", "0,15"));

        var result = await CreateService(db).CreateAsync(
            NormRequisition(contract.Id, creator, 3m, ("Круг сталь Ст3", "кг", 77.25m)), creator.Id);

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle()
            .Which.Should().Be("Zaxira foizi o'zgargan (hozir 5%) — me'yoriy sarfdan qayta to'ldiring.");
        db.Requisitions.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_AllowanceWhenCurrentIsZero_ReturnsFailure()
    {
        await using var db = CreateDb();
        var creator = SeedCreatorWithDept(db);
        var contract = SeedContractWithNorm(db, 500, ("Круг сталь Ст3", "кг", "0,15"));

        var result = await CreateService(db).CreateAsync(
            NormRequisition(contract.Id, creator, 3m, ("Круг сталь Ст3", "кг", 77.25m)), creator.Id);

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("hozir 0%");
    }

    [Fact]
    public async Task CreateAsync_AllowanceZero_TreatedAsWithoutAllowance()
    {
        await using var db = CreateDb();
        var creator = SeedCreatorWithDept(db);
        SeedAllowanceRate(db, 3m);
        var contract = SeedContractWithNorm(db, 500, ("Круг сталь Ст3", "кг", "0,15"));

        var result = await CreateService(db).CreateAsync(
            NormRequisition(contract.Id, creator, 0m, ("Круг сталь Ст3", "кг", 75m)), creator.Id);

        result.Succeeded.Should().BeTrue();
        (await db.Requisitions.SingleAsync()).AllowancePercent.Should().BeNull();
    }

    [Fact]
    public async Task CreateAsync_NormLineWithoutTotalQty_WithAllowance_Succeeds()
    {
        await using var db = CreateDb();
        var creator = SeedCreatorWithDept(db);
        SeedAllowanceRate(db, 3m);
        var contract = SeedContractWithNorm(db, 500,
            ("Круг сталь Ст3", "кг", "0,15"),
            ("Краска Хаки", "кг", null));

        // TotalQty bo'sh qatorga frontend 1 yuboradi — miqdori tekshirilmaydi.
        var result = await CreateService(db).CreateAsync(
            NormRequisition(contract.Id, creator, 3m,
                ("Круг сталь Ст3", "кг", 77.25m),
                ("Краска Хаки", "кг", 1m)), creator.Id);

        result.Succeeded.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_IndividualWithAllowance_StoresNull()
    {
        await using var db = CreateDb();
        var dept = SeedDept(db);
        var creator = TestData.SeedUser(db, login: "creator", departmentId: dept.Id);
        SeedAllowanceRate(db, 3m);

        var result = await CreateService(db).CreateAsync(new RequisitionCreateDto
        {
            Type = RequisitionType.Individual,
            DepartmentId = dept.Id,
            AllowancePercent = 3m,
            Items = [new RequisitionItemCreateDto { FreeTextName = "Sement", Quantity = 1m }],
        }, creator.Id);

        result.Succeeded.Should().BeTrue();
        (await db.Requisitions.SingleAsync()).AllowancePercent.Should().BeNull();
    }
```

`GetByIdAsync_ReturnsMappedDtoWithCreatorAndStatusLabels` testidan keyin:

```csharp
    [Fact]
    public async Task GetByIdAsync_ReturnsAllowancePercent()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "alex");
        var req = SeedParentRequisition(db, creator.Id, no: "REQ-A");
        req.AllowancePercent = 3m;
        db.SaveChanges();

        var result = await CreateService(db).GetByIdAsync(req.Id);

        result.Result!.AllowancePercent.Should().Be(3m);
    }
```

`WarehouseCheckAsync_PartialAvailable_CreatesBothWarehouseAndPurchaseChildren` testidan keyin:

```csharp
    [Fact]
    public async Task WarehouseCheckAsync_ChildrenInheritAllowancePercent()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c");
        var checker = TestData.SeedUser(db, login: "ch");
        var warehouse = SeedDept(db, name: "Korxona", type: DepartmentType.Omborxona);
        SeedProduct(db, warehouse.Id, name: "Sement", quantity: 100m);
        var req = SeedParentRequisition(db, creator.Id,
            items: [MakeItem(quantity: 30m, freeName: "Sement")]);
        req.AllowancePercent = 3m;
        db.SaveChanges();

        var result = await CreateService(db).WarehouseCheckAsync(req.Id,
            new RequisitionWarehouseCheckDto
            {
                Items = [new RequisitionWarehouseCheckItemDto
                {
                    ItemId = req.Items.First().Id,
                    AvailableQuantity = 10m,
                }],
            }, checker.Id);

        result.Succeeded.Should().BeTrue();
        db.Requisitions.Where(r => r.ParentRequisitionId == req.Id).ToList()
            .Should().HaveCount(2)
            .And.OnlyContain(c => c.AllowancePercent == 3m);
    }
```

Paged testlar bo'limida (`Page1()` helper'idan keyin, birinchi `GetPagedAsync` testidan oldin):

```csharp
    [Fact]
    public async Task GetPagedAsync_ReturnsAllowancePercent()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "alex");
        var req = SeedParentRequisition(db, creator.Id, no: "REQ-A");
        req.AllowancePercent = 3m;
        db.SaveChanges();

        var result = await CreateService(db).GetPagedAsync(creator.Id, viewAll: true, Page1());

        result.Result!.Items.Single().AllowancePercent.Should().Be(3m);
    }
```

- [ ] **Step 3: Test yiqilishini tekshirish**

Run: `cd Back/test/Application.Tests && dotnet test --filter "FullyQualifiedName~RequisitionServiceTests"`
Expected: build FAIL — `'RequisitionCreateDto' does not contain a definition for 'AllowancePercent'` va
`'RequisitionService' does not contain a constructor that takes 4 arguments`.

- [ ] **Step 4: DTO maydonlari**

`RequisitionCreateDto.cs` — `public string? SignDate { get; set; }` dan keyin:

```csharp

    // Klient qo'llagan zaxira foizi; null yoki 0 — aniq me'yor. Faqat moslik
    // tekshiruvi uchun: hisob-kitob bazadagi amaldagi foiz bilan bajariladi.
    public decimal? AllowancePercent { get; set; }
```

`RequisitionResponseDto.cs` — `public string? RejectionReason { get; set; }` dan keyin:

```csharp

    // Me'yorga qo'shilgan zaxira foizi; null — aniq me'yor.
    public decimal? AllowancePercent { get; set; }
```

`RequisitionListDto.cs` — `public string? DepartmentName { get; set; }` dan keyin:

```csharp

    public decimal? AllowancePercent { get; set; }
```

- [ ] **Step 5: `RequisitionService` — konstruktor**

Maydonlar va konstruktorni almashtiring (`Back/src/Application/Services/Impl/RequisitionService.cs:16-25`):

```csharp
    private readonly DatabaseContext _context;
    private readonly INotificationService _notificationService;
    private readonly IQrCodeService _qrCodeService;
    private readonly IRequisitionAllowanceService _allowanceService;

    public RequisitionService(
        DatabaseContext context,
        INotificationService notificationService,
        IQrCodeService qrCodeService,
        IRequisitionAllowanceService allowanceService)
    {
        _context = context;
        _notificationService = notificationService;
        _qrCodeService = qrCodeService;
        _allowanceService = allowanceService;
    }
```

Fayl boshidagi `using` lar orasida `System.Globalization` yo'q bo'lsa qo'shing:

```csharp
using System.Globalization;
```

- [ ] **Step 6: `CreateAsync` — zaxira tekshiruvi va snapshot**

Mavjud blokni:

```csharp
        if (dto.Type == RequisitionType.Contract)
        {
            var normError = await ValidateItemsAgainstCostNormAsync(dto, creator.DepartmentId.Value);
            if (normError is not null)
                return ApiResult<Guid>.Failure([normError]);
        }
```

quyidagiga almashtiring:

```csharp
        decimal? allowancePercent = null;
        if (dto.Type == RequisitionType.Contract)
        {
            if (dto.AllowancePercent is { } requested && requested != 0)
            {
                var current = await _allowanceService.GetCurrentPercentAsync();
                if (current == 0 || current != requested)
                    return ApiResult<Guid>.Failure([
                        $"Zaxira foizi o'zgargan (hozir {current.ToString("0.##", CultureInfo.InvariantCulture)}%) — me'yoriy sarfdan qayta to'ldiring."]);
                allowancePercent = current;
            }

            var normError = await ValidateItemsAgainstCostNormAsync(dto, creator.DepartmentId.Value, allowancePercent);
            if (normError is not null)
                return ApiResult<Guid>.Failure([normError]);
        }
```

`new Requisition { … }` ichida `SignDate = dto.SignDate,` dan keyin:

```csharp
            AllowancePercent = allowancePercent,
```

- [ ] **Step 7: Me'yor tekshiruviga foizni o'tkazish**

`ValidateItemsAgainstCostNormAsync` imzosi va `MatchesNorm` chaqiruvi:

```csharp
    private async Task<string?> ValidateItemsAgainstCostNormAsync(RequisitionCreateDto dto, Guid creatorDeptId, decimal? allowancePercent)
```

```csharp
        if (norms.Any(n => MatchesNorm(n, dto.Items, creatorDeptId, allowancePercent)))
            return null;
```

Metod ustidagi izohdagi `miqdor = TotalQty × mahsulot soni.` ni `miqdor = TotalQty × mahsulot soni (zaxira bo'lsa NormAllowance bilan oshirilgan).` ga almashtiring.

`MatchesNorm`:

```csharp
    private static bool MatchesNorm(NormShape norm, List<RequisitionItemCreateDto> items, Guid creatorDeptId, decimal? allowancePercent)
```

va ichidagi chaqiruv:

```csharp
            var idx = pool.FindIndex(l => LineMatchesItem(l, item, norm.ContractQty, allowancePercent));
```

`LineMatchesItem`:

```csharp
    private static bool LineMatchesItem(NormLine line, RequisitionItemCreateDto item, int contractQty, decimal? allowancePercent)
```

va ichida `var expected = totalQty * contractQty;` ni almashtiring:

```csharp
            var expected = totalQty * contractQty;
            if (allowancePercent is { } percent)
                expected = NormAllowance.Apply(expected, line.Unit, percent);
```

(`Application.Helpers` namespace fayl boshida `using` qilinganini tekshiring; bo'lmasa `using Application.Helpers;` qo'shing.)

- [ ] **Step 8: Bola talabnomalar va proyeksiyalar**

Bola talabnoma yasash blokida ikkala joyda — `Source = RequisitionSource.Warehouse,` va
`Source = RequisitionSource.Purchase,` qatorlaridan keyin:

```csharp
                AllowancePercent = parent.AllowancePercent,
```

`GetByIdAsync` proyeksiyasida `Source = r.Source,` dan keyin:

```csharp
                AllowancePercent = r.AllowancePercent,
```

`ListProjection` da `DepartmentName = r.Department != null ? r.Department.Name : null,` dan keyin:

```csharp
            AllowancePercent = r.AllowancePercent,
```

- [ ] **Step 9: Test o'tishini tekshirish**

Run: `cd Back/test/Application.Tests && dotnet test --filter "FullyQualifiedName~RequisitionServiceTests"`
Expected: yangi 12 ta test PASS; faqat Global Constraints'dagi 5 ta avvaldan yiqilgan test FAIL.

Run: `cd Back/test/Application.Tests && dotnet test`
Expected: 463 passed, 5 failed (o'sha 5 ta).

Run: `cd Back/src && dotnet build API`
Expected: `Build succeeded.`

- [ ] **Step 10: Commit**

```bash
git add Back/src/Application Back/test/Application.Tests/Services/RequisitionServiceTests.cs
git commit -m "$(cat <<'EOF'
feat(requisitions): validate and snapshot the allowance on contract requisitions

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Frontend — zaxira hisobi va API klienti

**Files:**
- Modify: `client/lib/num.ts` (fayl oxiriga)
- Modify: `client/lib/api.ts` (fayl oxiriga)
- Create: `client/lib/requisitionAllowance.ts`
- Modify: `client/lib/userService.ts` (`RequisitionCreate`, `RequisitionListRow`, `RequisitionResponse`)

**Interfaces:**
- Consumes: backend `GET/POST /api/requisition-allowance`, `allowancePercent` JSON maydonlari (Task 2–3).
- Produces:
  - `addPercentStr(value: number | string, percent: number): string | null` (`lib/num.ts`)
  - `ceilDecimalStr(value: number | string): string | null` (`lib/num.ts`)
  - `apiErrorMessage(e: unknown, fallback: string): string` (`lib/api.ts`)
  - `interface RequisitionAllowanceRate { id: string; percent: number; note: string | null; createdAt: string; createdByName: string | null }`
  - `requisitionAllowanceService.getAll(): Promise<RequisitionAllowanceRate[]>` (yangidan eskiga; `[0]` — amaldagi)
  - `requisitionAllowanceService.create(dto: { percent: number; note?: string | null }): Promise<string>`
  - `isPieceUnit(unit: string | null | undefined): boolean`
  - `applyAllowance(baseQty: string, unit: string, percent: number): string`
  - `RequisitionCreate.allowancePercent?: number`; `RequisitionListRow.allowancePercent?: number | null`; `RequisitionResponse.allowancePercent?: number | null`

- [ ] **Step 1: `num.ts` ga aniq foiz va yuqoriga yaxlitlash**

`client/lib/num.ts` oxiriga:

```ts
/**
 * `value × (1 + percent / 100)` ni **aniq** hisoblaydi: `addPercentStr("75", 3) === "77.25"`.
 * Foiz bazis punktga (1/100 %) aylantiriladi — 2 xonali kasrgacha aniq.
 */
export function addPercentStr(value: number | string, percent: number): string | null {
  const scaled = mulDecimalStr(value, 10000 + Math.round(percent * 100));
  return scaled === null ? null : mulDecimalStr(scaled, "0.0001");
}

/** O'nlik satrni yuqoriga butun songa yaxlitlaydi: `"14.42"` → `"15"`, `"1030"` → `"1030"`. */
export function ceilDecimalStr(value: number | string): string | null {
  const d = parseDec(value);
  if (!d) return null;
  const [int, frac = ""] = composeDec(false, d.digits, d.scale).split(".");
  if (d.neg) return int === "0" ? "0" : `-${int}`;
  return /[1-9]/.test(frac) ? String(Number(int) + 1) : int;
}
```

- [ ] **Step 2: Node bilan aniqlikni tekshirish (Review Focus 3–4)**

Run:

```bash
cd client && node --experimental-strip-types -e "const assert=require('node:assert'); import('./lib/num.ts').then(({addPercentStr:a, ceilDecimalStr:c})=>{ assert.equal(a('75',3),'77.25'); assert.equal(a('1000',3),'1030'); assert.equal(a('14',3),'14.42'); assert.equal(a('0.007',3),'0.00721'); assert.equal(a('10',2.5),'10.25'); assert.equal(a('10',12.34),'11.234'); assert.equal(a('0,15',3),'0.1545'); assert.equal(c('14.42'),'15'); assert.equal(c('1030'),'1030'); assert.equal(c('7.21'),'8'); assert.equal(c('0.00721'),'1'); assert.equal(c('-5.5'),'-5'); console.log('ok'); })"
```

Expected: `ok` (ExperimentalWarning satri bo'lishi mumkin — e'tiborsiz).

- [ ] **Step 3: `api.ts` ga umumiy xato matni helper'i**

`client/lib/api.ts` oxiriga:

```ts
/** Backend ApiResult xato matnini oladi — topilmasa `fallback` qaytariladi. */
export function apiErrorMessage(e: unknown, fallback: string): string {
  const msg = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
  return msg ?? fallback;
}
```

- [ ] **Step 4: `lib/requisitionAllowance.ts`**

```ts
import { api } from "./api";
import { addPercentStr, ceilDecimalStr } from "./num";

// Talabnoma zaxira foizi — `/api/requisition-allowance`. O'qish hammaga, yozish
// "RequisitionAllowance.Update" ruxsati bilan. Ro'yxat yangidan eskiga — [0] amaldagi.

export interface RequisitionAllowanceRate {
  id: string;
  percent: number;
  note: string | null;
  createdAt: string;
  createdByName: string | null;
}

export const requisitionAllowanceService = {
  async getAll(): Promise<RequisitionAllowanceRate[]> {
    const res = await api.get("/api/requisition-allowance");
    return res.data.result ?? [];
  },

  async create(dto: { percent: number; note?: string | null }): Promise<string> {
    const res = await api.post("/api/requisition-allowance", dto);
    return res.data.result;
  },
};

// Backend Application/Helpers/NormAllowance.cs bilan bir xil qoida — farq qilsa
// backend talabnomani "me'yoriy sarfiga mos emas" deb rad etadi.
const PIECE_UNITS = new Set(["шт", "дона", "dona"]);

export function isPieceUnit(unit: string | null | undefined): boolean {
  return PIECE_UNITS.has((unit ?? "").trim().toLowerCase().replace(/\.+$/, ""));
}

export function applyAllowance(baseQty: string, unit: string, percent: number): string {
  if (!percent || !baseQty) return baseQty;
  const raised = addPercentStr(baseQty, percent);
  if (raised === null) {
    const n = Number(baseQty) * (1 + percent / 100);
    if (!Number.isFinite(n)) return baseQty;
    return String(isPieceUnit(unit) ? Math.ceil(n) : n);
  }
  return isPieceUnit(unit) ? (ceilDecimalStr(raised) ?? raised) : raised;
}
```

- [ ] **Step 5: `userService.ts` tiplari**

`RequisitionCreate` — `signDate?: string;` dan keyin:

```ts
  // Qo'llangan zaxira foizi — yuborilmasa aniq me'yor bo'yicha.
  allowancePercent?: number;
```

`RequisitionListRow` — `departmentName?: string;` dan keyin:

```ts
  allowancePercent?: number | null;
```

`RequisitionResponse` — `rejectionReason?: string;` dan keyin:

```ts
  allowancePercent?: number | null;
```

- [ ] **Step 6: Typecheck va lint**

Run: `cd client && npx tsc --noEmit`
Expected: 0 error.

Run: `cd client && npx eslint lib/num.ts lib/api.ts lib/requisitionAllowance.ts lib/userService.ts`
Expected: 0 error.

- [ ] **Step 7: Commit**

```bash
git add client/lib/num.ts client/lib/api.ts client/lib/requisitionAllowance.ts client/lib/userService.ts
git commit -m "$(cat <<'EOF'
feat(requisitions): add the client-side allowance math and API

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Talabnoma yaratish sahifasida "+3% zaxira" toggle

**Files:**
- Modify: `client/app/(documents)/requisitions/print/page.tsx` (import :25, `TableRow` :50-60, state :357-364, `applyNormRows` :366-399, `handleClear` :506-523, toolbar :1204-1223, `doSaveSystem` :755-807)
- Modify: `client/lib/i18n/ru.ts`

**Interfaces:**
- Consumes: `requisitionAllowanceService.getAll`, `applyAllowance` (`@/lib/requisitionAllowance`); `fmtDecimal` (`@/lib/num`); `apiErrorMessage` (`@/lib/api`); `RequisitionCreate.allowancePercent` (Task 4).
- Produces: `POST /api/requisition` so'rovida `allowancePercent` (toggle yoqilgan va foiz > 0 bo'lsa).

- [ ] **Step 1: Importlar**

`import { mulDecimalStr } from "@/lib/num";` ni almashtiring:

```ts
import { fmtDecimal, mulDecimalStr } from "@/lib/num";
import { apiErrorMessage } from "@/lib/api";
import { applyAllowance, requisitionAllowanceService } from "@/lib/requisitionAllowance";
```

- [ ] **Step 2: `TableRow` ga asosiy miqdor**

`locked?: boolean; …` qatoridan keyin:

```ts
  baseQuantity?: string; // me'yor × son — zaxira yoqilib-o'chirilganda miqdor shundan qayta hisoblanadi
```

- [ ] **Step 3: Zaxira holati**

`const [normDept, setNormDept] = useState<…>(null);` qatoridan keyin:

```ts
  // Amaldagi zaxira foizi (0 — o'chirilgan yoki yuklanmadi) va foydalanuvchi tanlovi.
  const [allowancePercent, setAllowancePercent] = useState(0);
  const [allowanceOn, setAllowanceOn] = useState(false);

  const loadAllowancePercent = useCallback(async () => {
    try {
      const current = (await requisitionAllowanceService.getAll())[0]?.percent ?? 0;
      setAllowancePercent(current);
      return current;
    } catch {
      setAllowancePercent(0);
      return 0;
    }
  }, []);

  useEffect(() => { loadAllowancePercent(); }, [loadAllowancePercent]);

  // Faqat miqdor qayta hisoblanadi — qo'lda yozilgan izoh va texnik ko'rsatkich saqlanadi.
  const setAllowance = (on: boolean) => {
    setAllowanceOn(on);
    setRows(prev => prev.map(r =>
      r.locked && r.baseQuantity !== undefined
        ? { ...r, quantity: on ? applyAllowance(r.baseQuantity, r.unit, allowancePercent) : r.baseQuantity }
        : r));
  };
```

- [ ] **Step 4: `applyNormRows` — asosiy va zaxirali miqdor**

`newRows` ichidagi:

```ts
      return {
        id: Date.now() + idx,
        name: ni.name ?? ni.no ?? "",
        unit: ni.unit ?? "",
        quantity: exact ?? (Number.isFinite(totalQtyNum) ? String(totalQtyNum * qty) : ""),
```

ni almashtiring:

```ts
      const base = exact ?? (Number.isFinite(totalQtyNum) ? String(totalQtyNum * qty) : "");
      return {
        id: Date.now() + idx,
        name: ni.name ?? ni.no ?? "",
        unit: ni.unit ?? "",
        quantity: allowanceOn ? applyAllowance(base, ni.unit ?? "", allowancePercent) : base,
        baseQuantity: base,
```

(Qolgan maydonlar — `spec`, `notes`, `image`, `imageFile`, `locked` — o'zgarishsiz.)

- [ ] **Step 5: `handleClear` — tanlovni tiklash**

`handleClear` ichida `setNormDept(null);` dan keyin:

```ts
    setAllowanceOn(false);
```

- [ ] **Step 6: Asboblar panelidagi toggle**

`{normDept && ( … )}` blokining yopilishi (`)}`) dan keyin, `</>` dan oldin:

```tsx
            {allowancePercent > 0 && rows.some(r => r.locked) && (
              <button
                type="button"
                onClick={() => setAllowance(!allowanceOn)}
                aria-pressed={allowanceOn}
                title={t("Brak va sifatsiz material uchun me'yorga qo'shimcha zaxira. Qog'ozga chiqmaydi.")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px",
                  background: allowanceOn ? "var(--warn-dim)" : "var(--bg3)",
                  border: `1.5px solid ${allowanceOn ? "var(--warn)" : "var(--border)"}`,
                  borderRadius: "var(--radius)", cursor: "pointer", whiteSpace: "nowrap",
                  fontSize: 12, fontWeight: 600, color: allowanceOn ? "var(--warn)" : "var(--text2)",
                  transition: "border-color 0.15s, color 0.15s, background 0.15s",
                }}
              >
                <span style={{ width: 13, height: 13, borderRadius: 3, border: "1.5px solid currentColor", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {allowanceOn && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span style={{ fontFamily: "var(--font-mono)" }}>+{fmtDecimal(allowancePercent)}%</span>
                {t("zaxira")}
              </button>
            )}
```

- [ ] **Step 7: Yuborish va xato**

`requisitionService.create({ … })` ichida `signDate: signDate || undefined,` dan keyin:

```ts
        allowancePercent: type === RequisitionType.Contract && allowanceOn && allowancePercent > 0 ? allowancePercent : undefined,
```

`doSaveSystem` dagi `catch` blokini:

```ts
    } catch {
      showToast(t("Xatolik yuz berdi"), t("Xatolik"));
      setSubmitStage(null);
    }
```

almashtiring:

```ts
    } catch (e) {
      showToast(apiErrorMessage(e, t("Xatolik yuz berdi")), t("Xatolik"));
      setSubmitStage(null);
      // Foiz to'ldirish va yuborish oralig'ida o'zgargan bo'lishi mumkin — eski
      // foiz bilan hisoblangan miqdorlar qaytariladi, foydalanuvchi qayta yoqadi.
      if (allowanceOn && (await loadAllowancePercent()) !== allowancePercent) setAllowance(false);
    }
```

- [ ] **Step 8: Tarjimalar**

`client/lib/i18n/ru.ts` — oxirgi `};` dan oldin:

```ts
  "zaxira": "запас",
  "Brak va sifatsiz material uchun me'yorga qo'shimcha zaxira. Qog'ozga chiqmaydi.": "Дополнительный запас к норме на брак и некачественный материал. На бумагу не выводится.",
```

- [ ] **Step 9: Typecheck va lint**

Run: `cd client && npx tsc --noEmit`
Expected: 0 error.

Run: `cd client && npx eslint "app/(documents)/requisitions/print/page.tsx" lib/i18n/ru.ts`
Expected: 0 error (mavjud warning'lar bo'lsa — yangi qo'shilmagan bo'lishi kerak).

- [ ] **Step 10: Commit**

```bash
git add "client/app/(documents)/requisitions/print/page.tsx" client/lib/i18n/ru.ts
git commit -m "$(cat <<'EOF'
feat(requisitions): let the creator add the allowance when filling from the norm

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Talabnoma sahifasi va yon panelda zaxira belgisi

**Files:**
- Create: `client/app/(documents)/requisitions/_components/AllowanceBadge.tsx`
- Modify: `client/app/(documents)/requisitions/[id]/page.tsx` (import :15, sarlavha :225)
- Modify: `client/app/(documents)/requisitions/_components/RequisitionDrawer.tsx` (import :17, sarlavha :241)
- Modify: `client/lib/i18n/ru.ts`

**Interfaces:**
- Consumes: `RequisitionResponse.allowancePercent` (Task 4); `fmtDecimal`.
- Produces: `AllowanceBadge({ percent }: { percent?: number | null })` — `percent` bo'sh/0 bo'lsa hech narsa chizmaydi.

- [ ] **Step 1: Komponent**

`client/app/(documents)/requisitions/_components/AllowanceBadge.tsx`:

```tsx
"use client";

import { useT } from "@/lib/i18n";
import { fmtDecimal } from "@/lib/num";

export function AllowanceBadge({ percent }: { percent?: number | null }) {
  const t = useT();
  if (!percent) return null;

  return (
    <span
      title={t("Miqdorlarga me'yoriy sarfdan tashqari zaxira qo'shilgan")}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px",
        background: "var(--warn-dim)", color: "var(--warn)", border: "1px solid var(--warn)",
        borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontFamily: "var(--font-mono)" }}>+{fmtDecimal(percent)}%</span>
      {t("zaxira")}
    </span>
  );
}
```

- [ ] **Step 2: Talabnoma sahifasi**

`[id]/page.tsx` — `import { RequisitionStatusBadge } from "../_components/StatusBadge";` dan keyin:

```tsx
import { AllowanceBadge } from "../_components/AllowanceBadge";
```

Sarlavhadagi `<RequisitionStatusBadge status={req.status} completed=… />` (225-qator, `req.status` bilan) dan **oldin**:

```tsx
        <AllowanceBadge percent={req.allowancePercent} />
```

- [ ] **Step 3: Yon panel**

`RequisitionDrawer.tsx` — `import { RequisitionStatusBadge } from "./StatusBadge";` dan keyin:

```tsx
import { AllowanceBadge } from "./AllowanceBadge";
```

Sarlavhadagi `<RequisitionStatusBadge status={req.status} completed=… />` (241-qator) dan **oldin**:

```tsx
          <AllowanceBadge percent={req.allowancePercent} />
```

- [ ] **Step 4: Tarjima**

`client/lib/i18n/ru.ts` — oxirgi `};` dan oldin (`"zaxira"` Task 5 da qo'shilgan — takrorlamang):

```ts
  "Miqdorlarga me'yoriy sarfdan tashqari zaxira qo'shilgan": "К количествам добавлен запас сверх нормы расхода",
```

- [ ] **Step 5: Typecheck va lint**

Run: `cd client && npx tsc --noEmit`
Expected: 0 error.

Run: `cd client && npx eslint "app/(documents)/requisitions/_components/AllowanceBadge.tsx" "app/(documents)/requisitions/[id]/page.tsx" "app/(documents)/requisitions/_components/RequisitionDrawer.tsx"`
Expected: 0 error.

- [ ] **Step 6: Commit**

```bash
git add "client/app/(documents)/requisitions/_components/AllowanceBadge.tsx" "client/app/(documents)/requisitions/[id]/page.tsx" "client/app/(documents)/requisitions/_components/RequisitionDrawer.tsx" client/lib/i18n/ru.ts
git commit -m "$(cat <<'EOF'
feat(requisitions): mark requisitions created with an allowance

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Talabnomalar sahifasida foizni boshqarish oynasi

**Files:**
- Create: `client/app/(documents)/requisitions/_components/AllowanceModal.tsx`
- Create: `client/app/(documents)/requisitions/_components/AllowanceChip.tsx`
- Modify: `client/app/(documents)/requisitions/page.tsx` (import :18, sarlavha amallari — `{canApprove && (` dan oldin)
- Modify: `client/lib/i18n/ru.ts`

**Interfaces:**
- Consumes: `requisitionAllowanceService.getAll/create`, `RequisitionAllowanceRate` (Task 4); `apiErrorMessage`; `fmtDecimal`; `useAuthStore().hasPermission`.
- Produces: `AllowanceChip()` (propsiz); `AllowanceModal({ canEdit, onClose, onSaved }: { canEdit: boolean; onClose: () => void; onSaved: () => void })`.

- [ ] **Step 1: Oyna**

`client/app/(documents)/requisitions/_components/AllowanceModal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { requisitionAllowanceService, type RequisitionAllowanceRate } from "@/lib/requisitionAllowance";
import { apiErrorMessage } from "@/lib/api";
import { useToastStore } from "@/lib/store/toastStore";
import { useT } from "@/lib/i18n";
import { fmtDecimal } from "@/lib/num";

export function AllowanceModal({
  canEdit,
  onClose,
  onSaved,
}: {
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const showToast = useToastStore(s => s.show);

  const [rates, setRates] = useState<RequisitionAllowanceRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [percent, setPercent] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setRates(await requisitionAllowanceService.getAll());
    } catch {
      showToast(t("Zaxira tarixini yuklashda xatolik."), t("Xatolik"));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const save = async () => {
    const value = Number(percent.replace(",", "."));
    if (!percent.trim() || !Number.isFinite(value) || value < 0 || value > 20) {
      showToast(t("Zaxira foizi 0 dan 20 gacha bo'lishi kerak."), t("Xatolik"));
      return;
    }

    try {
      setSaving(true);
      await requisitionAllowanceService.create({ percent: value, note: note.trim() || null });
      showToast(t("Zaxira foizi saqlandi."), "success");
      setPercent("");
      setNote("");
      await load();
      onSaved();
    } catch (e) {
      showToast(apiErrorMessage(e, t("Zaxira foizini saqlashda xatolik.")), t("Xatolik"));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "7px 10px", fontSize: 13, color: "var(--text)", outline: "none",
  } as const;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="itm-card"
        style={{ width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", padding: 20, animation: "panel-appear 0.28s ease" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div>
            <h2 className="font-head-itm" style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
              {t("Talabnoma zaxirasi")}
            </h2>
            <p style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 2 }}>
              {t("Me'yoriy sarfdan to'ldirilgan talabnomaga foydalanuvchi ixtiyoriy qo'shadigan foiz.")}
            </p>
          </div>
          <button onClick={onClose} className="btn-icon" title={t("Yopish")} style={{ width: 30, height: 30, flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text2)", fontSize: 12.5 }}>{t("Yuklanmoqda...")}</div>
        ) : (
          <>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 4 }}>
              {t("Amaldagi foiz")}
            </p>
            <p style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text)", marginBottom: 16 }}>
              {fmtDecimal(rates[0]?.percent ?? 0)}%
            </p>

            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 8 }}>
              {t("O'zgarishlar tarixi")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: canEdit ? 18 : 0 }}>
              {rates.map((rate, i) => (
                <div
                  key={rate.id}
                  className={`nd-fadein-${Math.min(i, 4)}`}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--surface2)", borderRadius: "var(--radius)" }}
                >
                  <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text3)", width: 82, flexShrink: 0 }}>
                    {rate.createdAt.slice(0, 10)}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text)", width: 52, flexShrink: 0 }}>
                    {fmtDecimal(rate.percent)}%
                  </span>
                  <span
                    title={rate.note ?? undefined}
                    style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {rate.note ?? ""}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text3)", whiteSpace: "nowrap" }}>
                    {rate.createdByName ?? t("Tizim")}
                  </span>
                  {i === 0 && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: "var(--success-dim)", color: "var(--success)" }}>
                      {t("amaldagi")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {canEdit && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 8 }}>
              {t("Yangi foiz")}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <input
                type="number"
                min={0}
                max={20}
                step={0.01}
                value={percent}
                onChange={e => setPercent(e.target.value)}
                placeholder={t("Foiz (0–20)")}
                style={{ ...inputStyle, width: 130, fontFamily: "var(--font-mono)" }}
              />
              <input
                value={note}
                maxLength={500}
                onChange={e => setNote(e.target.value)}
                placeholder={t("Izoh (ixtiyoriy)")}
                style={{ ...inputStyle, flex: 1, minWidth: 180 }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  padding: "7px 16px", background: "var(--accent)", border: "none",
                  borderRadius: "var(--radius)", color: "#fff", fontSize: 12.5, fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? t("Saqlanmoqda...") : t("Saqlash")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Chip**

`client/app/(documents)/requisitions/_components/AllowanceChip.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { requisitionAllowanceService } from "@/lib/requisitionAllowance";
import { useAuthStore } from "@/lib/store/authStore";
import { useT } from "@/lib/i18n";
import { fmtDecimal } from "@/lib/num";
import { AllowanceModal } from "./AllowanceModal";

export function AllowanceChip() {
  const t = useT();
  const hasPermission = useAuthStore(s => s.hasPermission);
  const canEdit = hasPermission("RequisitionAllowance.Update");

  const [percent, setPercent] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      setPercent((await requisitionAllowanceService.getAll())[0]?.percent ?? 0);
    } catch {
      setPercent(null);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  if (percent === null) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={t("Talabnoma zaxirasi")}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600,
          borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--bg3)",
          color: "var(--text2)", cursor: "pointer", transition: "border-color 0.15s, color 0.15s",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <line x1="19" y1="5" x2="5" y2="19" />
          <circle cx="6.5" cy="6.5" r="2.5" />
          <circle cx="17.5" cy="17.5" r="2.5" />
        </svg>
        {t("Zaxira")}:
        <span style={{ fontFamily: "var(--font-mono)" }}>{fmtDecimal(percent)}%</span>
      </button>

      {open && createPortal(
        <AllowanceModal canEdit={canEdit} onClose={() => setOpen(false)} onSaved={load} />,
        document.body,
      )}
    </>
  );
}
```

(`createPortal` — sahifa `page-transition` animatsiyasidagi `transform` `position: fixed` ni buzmasligi uchun, `RequisitionDrawer` ham shunday qiladi.)

- [ ] **Step 3: Sahifa sarlavhasiga qo'shish**

`client/app/(documents)/requisitions/page.tsx` — `import { RequisitionDrawer } from "./_components/RequisitionDrawer";` dan keyin:

```tsx
import { AllowanceChip } from "./_components/AllowanceChip";
```

Sarlavha amallarida:

```tsx
        {canApprove && (
          <button
            onClick={() => router.push("/requisitions/approvals")}
```

dan **oldin**:

```tsx
        <AllowanceChip />

```

- [ ] **Step 4: Tarjimalar**

`client/lib/i18n/ru.ts` — oxirgi `};` dan oldin (`"Tizim"`, `"Izoh (ixtiyoriy)"`, `"Saqlash"`, `"Saqlanmoqda..."`, `"Yuklanmoqda..."`, `"Yopish"`, `"Xatolik"` allaqachon bor — qo'shmang):

```ts
  "Zaxira": "Запас",
  "Talabnoma zaxirasi": "Запас по заявке",
  "Me'yoriy sarfdan to'ldirilgan talabnomaga foydalanuvchi ixtiyoriy qo'shadigan foiz.": "Процент, который пользователь по желанию добавляет к заявке, заполненной по норме расхода.",
  "Amaldagi foiz": "Действующий процент",
  "O'zgarishlar tarixi": "История изменений",
  "amaldagi": "действует",
  "Yangi foiz": "Новый процент",
  "Foiz (0–20)": "Процент (0–20)",
  "Zaxira foizi 0 dan 20 gacha bo'lishi kerak.": "Процент запаса должен быть от 0 до 20.",
  "Zaxira foizi saqlandi.": "Процент запаса сохранён.",
  "Zaxira foizini saqlashda xatolik.": "Ошибка при сохранении процента запаса.",
  "Zaxira tarixini yuklashda xatolik.": "Ошибка при загрузке истории запаса.",
```

Qo'shishdan oldin tekshiring: `grep -n "\"O'zgarishlar tarixi\"\|\"Amaldagi foiz\"\|\"Yangi foiz\"" client/lib/i18n/ru.ts` — topilgani bo'lsa, o'shani qo'shmang.

- [ ] **Step 5: Typecheck va lint**

Run: `cd client && npx tsc --noEmit`
Expected: 0 error.

Run: `cd client && npx eslint "app/(documents)/requisitions/_components/AllowanceModal.tsx" "app/(documents)/requisitions/_components/AllowanceChip.tsx" "app/(documents)/requisitions/page.tsx" lib/i18n/ru.ts`
Expected: 0 error.

- [ ] **Step 6: Commit**

```bash
git add "client/app/(documents)/requisitions/_components/AllowanceModal.tsx" "client/app/(documents)/requisitions/_components/AllowanceChip.tsx" "client/app/(documents)/requisitions/page.tsx" client/lib/i18n/ru.ts
git commit -m "$(cat <<'EOF'
feat(requisitions): manage the allowance percentage from the requisitions page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Yakuniy tekshiruv (avtomatik + brauzerda)

**Files:** — (faqat tekshiruv; topilgan xato tegishli task fayllarida tuzatiladi va alohida commit qilinadi)

**Interfaces:**
- Consumes: Task 1–7 natijalari.
- Produces: tekshiruv hisoboti (qaysi qadam o'tdi / o'tmadi).

- [ ] **Step 1: Avtomatik tekshiruvlar**

Run: `cd Back/test/Application.Tests && dotnet test`
Expected: 463 passed, 5 failed (faqat Global Constraints'dagi 5 ta).

Run: `cd client && npx tsc --noEmit`
Expected: 0 error.

Run: `cd client && npm run lint`
Expected: yangi fayllarda error yo'q (mavjud eski ogohlantirishlar alohida qayd etiladi).

- [ ] **Step 2: Ilovani ishga tushirish va seed**

Run (alohida terminal): `cd Back/src/API && dotnet run`
Expected: server `http://localhost:5223` da ko'tariladi; migratsiya va seed avtomatik.

Run: `PGPASSWORD=1221 "/c/Program Files/PostgreSQL/18/bin/psql.exe" -h localhost -U postgres -d ITM -t -A -c "select \"Percent\", \"Note\" from \"RequisitionAllowanceRates\";"`
Expected: `3.00|Boshlang'ich qiymat`.

Run (alohida terminal): `cd client && npm run dev`

- [ ] **Step 3: Yaratish sahifasi (bo'limga biriktirilgan, `Requisitions.Create` ruxsatli foydalanuvchi)**

`http://localhost:3000/requisitions/print` → tip "Shartnoma", me'yoriy sarfi bor shartnoma tanlanadi.
- [ ] Panelda `+3% zaxira` tugmasi ko'rinadi, **o'chiq**; miqdorlar `me'yor × son`.
- [ ] Bitta qatorning "Изох" ustuniga matn yoziladi, so'ng toggle yoqiladi → кг qatorlari ×1,03 (masalan 75 → 77.25), шт qatorlari yuqoriga yaxlitlangan; yozilgan izoh **saqlangan**.
- [ ] Toggle o'chiriladi → miqdorlar asl holiga qaytadi.
- [ ] "Chop etish"/"PDF saqlash" preview'da toggle ko'rinmaydi.
- [ ] Toggle yoqilgan holda "Talabnomani yuborish" → muvaffaqiyat; talabnoma sahifasida va ro'yxatdan ochilgan yon panelda `+3% zaxira` belgisi.
- [ ] Bazada: `select "RequisitionNo","AllowancePercent" from "Requisitions" order by "CreatedAt" desc limit 1;` → `3.00`.
- [ ] Toggle'siz yaratilgan talabnomada belgi yo'q, `AllowancePercent` bo'sh.

- [ ] **Step 4: Foizni boshqarish (superadmin)**

`http://localhost:3000/requisitions` → sarlavhada `Zaxira: 3%`.
- [ ] Bosilganda oyna: amaldagi 3%, tarixda `Tizim` muallifli `Boshlang'ich qiymat` yozuvi, "amaldagi" belgisi.
- [ ] `5` + izoh saqlanadi → tarix tepasida 5% (superadmin nomi bilan), chip `Zaxira: 5%`.
- [ ] `5` qayta saqlansa → "Zaxira foizi o'zgarmagan." xabari; `25` → "0 dan 20 gacha" xabari.

- [ ] **Step 5: Eskirgan foiz (Review Focus 1)**

- [ ] A tabda yaratish sahifasi ochiladi (5% yuklanadi), shartnoma tanlanadi, toggle yoqiladi.
- [ ] B tabda (superadmin) foiz 4% ga o'zgartiriladi.
- [ ] A tabda yuborish → toast: `Zaxira foizi o'zgargan (hozir 4%) — me'yoriy sarfdan qayta to'ldiring.`; toggle o'chgan, miqdorlar asosiy; toggle endi `+4% zaxira`; qayta yoqib yuborish muvaffaqiyatli.

- [ ] **Step 6: Ruxsatsiz foydalanuvchi**

`RequisitionAllowance.Update` ruxsati bo'lmagan foydalanuvchi bilan kiring.
- [ ] Chip ko'rinadi, oyna ochiladi, lekin "Yangi foiz" formasi **yo'q**.
- [ ] Brauzer konsolida:

```js
const csrf = decodeURIComponent(document.cookie.split("; ").find(c => c.startsWith("XSRF-TOKEN="))?.split("=")[1] ?? "");
fetch("http://localhost:5223/api/requisition-allowance", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ percent: 4 }) }).then(r => r.status)
```

Expected: `403`.
- [ ] Rollar sahifasida "Talabnoma zaxirasi" moduli (Tahrirlash) ko'rinadi; ruxsatni rolga berib, **qayta kirilgach** forma paydo bo'ladi (ruxsatlar JWT ichida keladi).

- [ ] **Step 7: Rus tili**

Tashqi ko'rinish → "Til / Язык" → Русский.
- [ ] Toggle, badge, chip, oyna matnlari ruscha (`+3% запас`, `Запас: 3%`, `Запас по заявке`, ...).

- [ ] **Step 8: Tuzatishlar**

Topilgan har bir xato tegishli faylda tuzatiladi, Step 1 qayta ishga tushiriladi, alohida commit:

```bash
git commit -m "$(cat <<'EOF'
fix(requisitions): <nima tuzatildi>

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
)"
```
