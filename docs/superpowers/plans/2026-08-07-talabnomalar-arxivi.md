# Talabnomalar arxivi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Talabnomalar ro'yxatidan real bajarilgan hujjatlarni vaqt asosida avtomatik chiqarib, ularni "Yaqinda yakunlangan" bloki va alohida arxiv ko'rinishiga o'tkazish.

**Architecture:** Bajarilish `Released` / `Delivered` / `Rejected` statuslari bilan aniqlanadi (tasdiqlangan, lekin hali berilmagan talabnoma faol qoladi). Bajarilgan payt yangi `Requisition.CompletedAt` ustunida saqlanadi. Backend uchta rejim beradi — faol (`completed=false`), arxiv (`completed=true`, `rejected` sub-filtri bilan) va yengil `recent-completed` endpointi. Frontend asosiy sahifada faol ro'yxatni, uning ostida oxirgi 7 kunlik blokni va toolbar orqali arxiv ko'rinishini ko'rsatadi.

**Tech Stack:** .NET 8 / EF Core (PostgreSQL), xUnit + FluentAssertions + EF InMemory, Next.js 16 / React 19 / TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-07-talabnomalar-arxivi-design.md`

## Global Constraints

- Backend buyruqlari `Back/src/` papkasidan bajariladi; testlar `Back/test/` dan (`dotnet test`).
- Migration: `dotnet ef migrations add <Nom> --project DataAccess --startup-project API`. Migrationlar `Program.cs` da avtomatik qo'llanadi (`ApplyMigrationsAsync()`), qo'lda `database update` shart emas.
- API javoblari `{ result: ... }` formatida — frontendda `res.data?.result ?? res.data`.
- Bajarilgan statuslar to'plami backend `FulfilledStatuses` va frontend `FULFILLED_STATUSES` da **aynan bir xil** bo'lishi shart: `Released` (11), `Delivered` (12), `Rejected` (3).
- "Yaqinda yakunlangan" oynasi — 7 kun, limit 10 ta yozuv.
- Frontendda barcha yangi UI matni `t("...")` ichida bo'ladi va uning ruscha tarjimasi `client/lib/i18n/ru.ts` ga qo'shiladi. Tarjima qilinmaydi: permission satrlari, API maydon nomlari, status kodlari.
- Ranglar faqat CSS tokenlar orqali: `--surface`, `--border`, `--text2`, `--text3`, `--success`, `--danger`, `--accent`, `--radius`.
- Frontend tekshiruvi: `cd client && npx tsc --noEmit` va `npm run lint` (client'da avtomatik test yo'q).

---

## File Structure

| Fayl | Mas'uliyati |
|---|---|
| `Back/src/Core/Entities/Requisition.cs` | `CompletedAt` ustuni |
| `Back/src/DataAccess/Migrations/*_AddRequisitionCompletedAt.cs` | Ustun + bir martalik backfill |
| `Back/src/Application/Services/Impl/RequisitionService.cs` | `FulfilledStatuses`, `GetPagedAsync` filtrlari, `GetRecentCompletedAsync`, `CompletedAt` yozilishi |
| `Back/src/Application/Services/IRequisitionService.cs` | Yangi imzolar |
| `Back/src/Application/DTOs/Requisitions/RequisitionResponseDto.cs` | `CompletedAt` maydoni |
| `Back/src/API/Controllers/RequisitionController.cs` | `rejected` query param, `recent-completed` endpoint |
| `Back/test/Application.Tests/Services/RequisitionServiceTests.cs` | Barcha yangi testlar |
| `client/lib/userService.ts` | `completedAt`, `rejected` opt, `getRecentCompleted` |
| `client/app/(documents)/requisitions/_types.ts` | `FULFILLED_STATUSES`, `fmtRelativeDays` |
| `client/app/(documents)/requisitions/_components/RecentCompleted.tsx` | "Yaqinda yakunlangan" bloki (yangi, alohida fayl) |
| `client/app/(documents)/requisitions/page.tsx` | Faol/arxiv ko'rinishi, kontekstli filtr |
| `client/lib/i18n/ru.ts` | Yangi satrlar tarjimasi |

---

## Task 1: `CompletedAt` — ustun, migration va yozilishi

**Files:**
- Modify: `Back/src/Core/Entities/Requisition.cs`
- Create: `Back/src/DataAccess/Migrations/<timestamp>_AddRequisitionCompletedAt.cs` (generatsiya qilinadi)
- Modify: `Back/src/Application/Services/Impl/RequisitionService.cs` (`RejectAsync` ~679-682, `ReleaseAsync` ~842-844)
- Test: `Back/test/Application.Tests/Services/RequisitionServiceTests.cs`

**Interfaces:**
- Consumes: mavjud `SeedParentRequisition`, `CreateService`, `CreateDb`, `TestData.SeedUser`, `SeedDept`, `SeedProduct`, `MakeItem` helperlari.
- Produces: `Requisition.CompletedAt` (`DateTime?`) — 2 va 3-tasklar shu ustundan foydalanadi.

- [ ] **Step 1: Ikkita failing test yozish**

`RequisitionServiceTests.cs` ichida, `RejectAsync` bo'limining oxiriga (`RejectAsync_WrongStatus_ReturnsFailure` dan keyin) qo'shing:

```csharp
    [Fact]
    public async Task RejectAsync_SetsCompletedAtToApprovedAt()
    {
        await using var db = CreateDb();
        var director = TestData.SeedUser(db, login: "dir-completed");
        var creator = TestData.SeedUser(db, login: "c-completed");
        var child = SeedParentRequisition(db, creator.Id, no: "REQ-REJ-COMPLETED",
            status: RequisitionStatus.PendingApproval,
            items: [MakeItem(quantity: 10m, freeName: "X")]);
        child.Source = RequisitionSource.Purchase;
        db.SaveChanges();

        var result = await CreateService(db).RejectAsync(child.Id, director.Id,
            new RequisitionRejectDto { RejectionReason = "Byudjet yo'q" });

        result.Succeeded.Should().BeTrue();
        var saved = db.Requisitions.Single(r => r.Id == child.Id);
        saved.CompletedAt.Should().NotBeNull("rad etish ham yakunlanish hisoblanadi");
        saved.CompletedAt.Should().Be(saved.ApprovedAt);
    }
```

`ReleaseAsync` bo'limining oxiriga (`ReleaseAsync_ReservedSourceProductMissing_...` dan keyin) qo'shing:

```csharp
    [Fact]
    public async Task ReleaseAsync_SetsCompletedAt()
    {
        await using var db = CreateDb();
        var warehouse = SeedDept(db, name: "Korxona ombori", type: DepartmentType.Omborxona);
        var targetDept = SeedDept(db, name: "Sex-1", type: DepartmentType.Bolim);
        var source = SeedProduct(db, warehouse.Id, name: "Sement",
            quantity: 100m, reservedQuantity: 10m);
        var creator = TestData.SeedUser(db, login: "c-rel-completed");
        var releaser = TestData.SeedUser(db, login: "rel-completed");

        var child = SeedParentRequisition(db, creator.Id, no: "REQ-REL-COMPLETED",
            departmentId: targetDept.Id,
            status: RequisitionStatus.ReadyForWarehouseRelease,
            items: [MakeItem(quantity: 10m, freeName: "Sement", reservedProductId: source.Id)]);
        child.Items.First().FreeTextUnit = "kg";
        db.SaveChanges();

        var before = DateTime.UtcNow;
        var result = await CreateService(db).ReleaseAsync(child.Id, releaser.Id);

        result.Succeeded.Should().BeTrue();
        var saved = db.Requisitions.Single(r => r.Id == child.Id);
        saved.Status.Should().Be(RequisitionStatus.Released);
        saved.CompletedAt.Should().NotBeNull();
        saved.CompletedAt!.Value.Should().BeOnOrAfter(before);
    }
```

- [ ] **Step 2: Testlarni ishga tushirib, kompilyatsiya xatosini ko'rish**

Run: `cd Back && dotnet test --filter "FullyQualifiedName~RequisitionServiceTests"`
Expected: BUILD FAIL — `'Requisition' does not contain a definition for 'CompletedAt'`

- [ ] **Step 3: Entity'ga ustun qo'shish**

`Back/src/Core/Entities/Requisition.cs` — `ApprovedAt` / `QrCodeData` blokidan keyin, `CreatedBy` dan oldin:

```csharp
    // ── Yakunlanish ────────────────────────────────────────────────────
    // Talabnoma real bajarilgan (berilgan / yetkazilgan / rad etilgan) payt.
    // Faqat Released, Delivered va Rejected statuslarida to'ldiriladi —
    // "Ombordan olishga" / "Sotib olishga" hali bajarilgan hisoblanmaydi.
    // Arxiv saralashi va "Yaqinda yakunlangan" bloki shu maydonga tayanadi.
    public DateTime? CompletedAt { get; set; }
```

- [ ] **Step 4: `RejectAsync` da to'ldirish**

`RequisitionService.cs` da `r.ApprovedAt = DateTime.UtcNow;` (RejectAsync ichidagi, ~682-qator) satridan keyin:

```csharp
        r.CompletedAt = r.ApprovedAt;
```

- [ ] **Step 5: `ReleaseAsync` da to'ldirish**

`RequisitionService.cs` da status o'rnatilgandan keyin (~844-qator, `await _context.SaveChangesAsync();` dan oldin):

```csharp
        r.Status = r.Source == RequisitionSource.Purchase
            ? RequisitionStatus.Delivered
            : RequisitionStatus.Released;
        r.CompletedAt = DateTime.UtcNow;
```

- [ ] **Step 6: Testlarni qayta ishga tushirish**

Run: `cd Back && dotnet test --filter "FullyQualifiedName~RequisitionServiceTests"`
Expected: PASS (barcha mavjud testlar ham o'tadi)

- [ ] **Step 7: Migration yaratish**

Run: `cd Back/src && dotnet ef migrations add AddRequisitionCompletedAt --project DataAccess --startup-project API`
Expected: `DataAccess/Migrations/` ichida yangi juftlik fayl paydo bo'ladi.

- [ ] **Step 8: Migration'ga backfill qo'shish**

Yangi migration faylining `Up(MigrationBuilder migrationBuilder)` metodi oxiriga, `AddColumn` chaqiruvidan **keyin**:

```csharp
            // Bir martalik backfill: mavjud bajarilgan talabnomalarda aniq yakunlanish
            // vaqti saqlanmagan — yagona mavjud manba direktor qarori sanasi.
            // 3 = Rejected, 11 = Released, 12 = Delivered.
            migrationBuilder.Sql("""
                UPDATE "Requisitions"
                SET "CompletedAt" = "ApprovedAt"
                WHERE "Status" IN (3, 11, 12) AND "CompletedAt" IS NULL;
                """);
```

- [ ] **Step 9: Backend build**

Run: `cd Back/src/API && dotnet build`
Expected: 0 error.

- [ ] **Step 10: Commit**

```bash
git add Back/src/Core/Entities/Requisition.cs Back/src/DataAccess/Migrations Back/src/Application/Services/Impl/RequisitionService.cs Back/test/Application.Tests/Services/RequisitionServiceTests.cs
git commit -m "feat(requisitions): record CompletedAt on release and reject"
```

---

## Task 2: Bajarilish semantikasi va arxiv filtrlari

**Files:**
- Modify: `Back/src/Application/Services/Impl/RequisitionService.cs:72-151`
- Modify: `Back/src/Application/Services/IRequisitionService.cs:11`
- Modify: `Back/src/API/Controllers/RequisitionController.cs:42-56`
- Test: `Back/test/Application.Tests/Services/RequisitionServiceTests.cs`

**Interfaces:**
- Consumes: `Requisition.CompletedAt` (Task 1).
- Produces:
  - `RequisitionService.FulfilledStatuses` — `private static readonly RequisitionStatus[]`
  - `GetPagedAsync(Guid currentUserId, bool viewAll, PaginationParams pagination, string? search = null, RequisitionStatus? status = null, bool? completed = null, bool? rejected = null)`
  - `GET /api/requisition/paged?...&rejected=true|false`

- [ ] **Step 1: Failing testlar yozish**

`RequisitionServiceTests.cs` ga yangi bo'lim qo'shing (fayl oxiriga, oxirgi `}` dan oldin):

```csharp
    // ─────────────────────────────────────────────────────────────────────
    //  GetPagedAsync — faol / arxiv
    // ─────────────────────────────────────────────────────────────────────

    private static PaginationParams Page1(int size = 20) => new() { Page = 1, PageSize = size };

    [Fact]
    public async Task GetPagedAsync_ActiveView_KeepsApprovedButUnfulfilled()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c-active");
        SeedParentRequisition(db, creator.Id, no: "REQ-READY-W",
            status: RequisitionStatus.ReadyForWarehouseRelease);
        SeedParentRequisition(db, creator.Id, no: "REQ-READY-P",
            status: RequisitionStatus.ReadyForPurchase);
        SeedParentRequisition(db, creator.Id, no: "REQ-RELEASED",
            status: RequisitionStatus.Released);

        var result = await CreateService(db).GetPagedAsync(
            creator.Id, viewAll: true, Page1(), completed: false);

        result.Succeeded.Should().BeTrue();
        result.Result!.Items.Select(i => i.RequisitionNo)
            .Should().BeEquivalentTo(["REQ-READY-W", "REQ-READY-P"],
                "tasdiqlangan, lekin hali berilmagan talabnoma faol qoladi");
    }

    [Fact]
    public async Task GetPagedAsync_ArchiveView_ReturnsOnlyFulfilled()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c-arch");
        SeedParentRequisition(db, creator.Id, no: "REQ-RELEASED", status: RequisitionStatus.Released);
        SeedParentRequisition(db, creator.Id, no: "REQ-DELIVERED", status: RequisitionStatus.Delivered);
        SeedParentRequisition(db, creator.Id, no: "REQ-REJECTED", status: RequisitionStatus.Rejected);
        SeedParentRequisition(db, creator.Id, no: "REQ-READY-W",
            status: RequisitionStatus.ReadyForWarehouseRelease);

        var result = await CreateService(db).GetPagedAsync(
            creator.Id, viewAll: true, Page1(), completed: true);

        result.Result!.Items.Select(i => i.RequisitionNo)
            .Should().BeEquivalentTo(["REQ-RELEASED", "REQ-DELIVERED", "REQ-REJECTED"]);
    }

    [Fact]
    public async Task GetPagedAsync_SplitParent_IsActiveUntilEveryChildIsFulfilled()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c-split");
        var parent = SeedParentRequisition(db, creator.Id, no: "REQ-SPLIT",
            status: RequisitionStatus.Split);

        var releasedChild = SeedParentRequisition(db, creator.Id, no: "REQ-SPLIT-W",
            status: RequisitionStatus.Released);
        releasedChild.ParentRequisitionId = parent.Id;
        releasedChild.CompletedAt = DateTime.UtcNow;

        var pendingChild = SeedParentRequisition(db, creator.Id, no: "REQ-SPLIT-P",
            status: RequisitionStatus.ReadyForPurchase);
        pendingChild.ParentRequisitionId = parent.Id;
        db.SaveChanges();

        var svc = CreateService(db);

        var active = await svc.GetPagedAsync(creator.Id, viewAll: true, Page1(), completed: false);
        active.Result!.Items.Select(i => i.RequisitionNo).Should().Contain("REQ-SPLIT");

        pendingChild.Status = RequisitionStatus.Delivered;
        pendingChild.CompletedAt = DateTime.UtcNow;
        db.SaveChanges();

        var archive = await svc.GetPagedAsync(creator.Id, viewAll: true, Page1(), completed: true);
        archive.Result!.Items.Select(i => i.RequisitionNo).Should().Contain("REQ-SPLIT");
    }

    [Fact]
    public async Task GetPagedAsync_RejectedFilter_SeparatesFullyRejectedFromPartial()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c-rejfilter");

        // 1) o'zi rad etilgan (bo'linmagan)
        SeedParentRequisition(db, creator.Id, no: "REQ-SELF-REJ", status: RequisitionStatus.Rejected);

        // 2) split — ikkala child ham rad etilgan
        var allRejected = SeedParentRequisition(db, creator.Id, no: "REQ-ALL-REJ",
            status: RequisitionStatus.Split);
        foreach (var no in new[] { "REQ-ALL-REJ-W", "REQ-ALL-REJ-P" })
        {
            var c = SeedParentRequisition(db, creator.Id, no: no, status: RequisitionStatus.Rejected);
            c.ParentRequisitionId = allRejected.Id;
        }

        // 3) split — bittasi rad, bittasi berilgan
        var partial = SeedParentRequisition(db, creator.Id, no: "REQ-PARTIAL",
            status: RequisitionStatus.Split);
        var rejectedChild = SeedParentRequisition(db, creator.Id, no: "REQ-PARTIAL-W",
            status: RequisitionStatus.Rejected);
        rejectedChild.ParentRequisitionId = partial.Id;
        var releasedChild = SeedParentRequisition(db, creator.Id, no: "REQ-PARTIAL-P",
            status: RequisitionStatus.Delivered);
        releasedChild.ParentRequisitionId = partial.Id;
        db.SaveChanges();

        var svc = CreateService(db);

        var rejected = await svc.GetPagedAsync(creator.Id, viewAll: true, Page1(), rejected: true);
        rejected.Result!.Items.Select(i => i.RequisitionNo)
            .Should().BeEquivalentTo(["REQ-SELF-REJ", "REQ-ALL-REJ"]);

        var completed = await svc.GetPagedAsync(creator.Id, viewAll: true, Page1(),
            completed: true, rejected: false);
        completed.Result!.Items.Select(i => i.RequisitionNo)
            .Should().BeEquivalentTo(["REQ-PARTIAL"],
                "qisman rad etilganda haqiqiy natija bor — u Yakunlangan sub-tabida qoladi");
    }

    [Fact]
    public async Task GetPagedAsync_ArchiveView_OrdersByCompletedAtDescending()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c-order");
        var old = SeedParentRequisition(db, creator.Id, no: "REQ-OLD", status: RequisitionStatus.Released);
        old.CompletedAt = DateTime.UtcNow.AddDays(-30);
        var fresh = SeedParentRequisition(db, creator.Id, no: "REQ-FRESH", status: RequisitionStatus.Delivered);
        fresh.CompletedAt = DateTime.UtcNow.AddDays(-1);
        db.SaveChanges();

        var result = await CreateService(db).GetPagedAsync(
            creator.Id, viewAll: true, Page1(), completed: true);

        result.Result!.Items.Select(i => i.RequisitionNo)
            .Should().ContainInOrder("REQ-FRESH", "REQ-OLD");
    }
```

- [ ] **Step 2: Testlarni ishga tushirish**

Run: `cd Back && dotnet test --filter "FullyQualifiedName~RequisitionServiceTests.GetPagedAsync"`
Expected: BUILD FAIL — `GetPagedAsync` da `rejected` nomli parametr yo'q.

- [ ] **Step 3: `FulfilledStatuses` ga o'tish**

`RequisitionService.cs:67-79` — izoh va massivni almashtiring:

```csharp
    // Talabnoma REAL bajarilgan hisoblanadigan holatlar: material bo'lim omboriga
    // berildi, xarid yetkazildi yoki direktor rad etdi. Tasdiqlangan, lekin hali
    // berilmagan ("Ombordan olishga") yoki hali kelmagan ("Sotib olishga")
    // talabnoma faol ish hisoblanadi va ro'yxatdan chiqmaydi.
    // Frontenddagi FULFILLED_STATUSES (client/app/(documents)/requisitions/_types.ts)
    // bilan aynan bir xil bo'lishi shart — aks holda badge bilan ro'yxat mos kelmaydi.
    private static readonly RequisitionStatus[] FulfilledStatuses =
    [
        RequisitionStatus.Released,
        RequisitionStatus.Delivered,
        RequisitionStatus.Rejected,
    ];
```

`TerminalStatuses` ning qolgan barcha ishlatilishini (`:113`, `:114`, `:120`, `:121`, `:142`, `:143`) `FulfilledStatuses` ga o'zgartiring.

- [ ] **Step 4: `GetPagedAsync` imzosi va `rejected` filtri**

Imzoga qo'shing:

```csharp
    public async Task<ApiResult<PagedResult<RequisitionResponseDto>>> GetPagedAsync(
        Guid currentUserId,
        bool viewAll,
        PaginationParams pagination,
        string? search = null,
        RequisitionStatus? status = null,
        bool? completed = null,
        bool? rejected = null)
```

`completed` blokidan keyin (`:123` dan keyin) qo'shing:

```csharp
        // Arxiv sub-tablari: to'liq rad etilgan (o'zi yoki barcha childlari) —
        // qisman rad etilgan split parent "Yakunlangan" tomonda qoladi.
        if (rejected.HasValue)
        {
            if (rejected.Value)
            {
                query = query.Where(r =>
                    r.Children.Any()
                        ? r.Children.All(c => c.Status == RequisitionStatus.Rejected)
                        : r.Status == RequisitionStatus.Rejected);
            }
            else
            {
                query = query.Where(r =>
                    r.Children.Any()
                        ? !r.Children.All(c => c.Status == RequisitionStatus.Rejected)
                        : r.Status != RequisitionStatus.Rejected);
            }
        }
```

- [ ] **Step 5: Saralashni ko'rinishga qarab ajratish**

`:138-147` dagi `var items = await query.OrderBy(...)` blokini almashtiring:

```csharp
        // Arxivda yakunlanish vaqti muhim; faol ro'yxatda esa tekshiruv kutayotganlar
        // yuqorida turadi. Split parentning yakunlanish vaqti — childlarining eng
        // kechkisi.
        IOrderedQueryable<Requisition> ordered = completed == true
            ? query
                .OrderByDescending(r => r.Children.Any()
                    ? r.Children.Max(c => c.CompletedAt)
                    : r.CompletedAt)
                .ThenByDescending(r => r.CreatedAt)
            : query
                .OrderBy(r => r.Status == RequisitionStatus.PendingWarehouseCheck ? 1 : 2)
                .ThenByDescending(r => r.CreatedAt);

        var items = await ordered
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .ToListAsync();
```

- [ ] **Step 6: Interfeysni yangilash**

`IRequisitionService.cs` — `GetPagedAsync` satrini almashtiring:

```csharp
    Task<ApiResult<PagedResult<RequisitionResponseDto>>> GetPagedAsync(Guid currentUserId, bool viewAll, PaginationParams pagination, string? search = null, RequisitionStatus? status = null, bool? completed = null, bool? rejected = null);
```

- [ ] **Step 7: Controller'ga `rejected` parametri**

`RequisitionController.cs` — `GetPaged` metodini yangilang:

```csharp
    [HasPermission("Requisitions.View")]
    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] RequisitionStatus? status = null,
        [FromQuery] bool? completed = null,
        [FromQuery] bool? rejected = null)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var viewAll = User.HasClaim("perm", "Requisitions.ViewAll");
        var pagination = new PaginationParams { Page = page, PageSize = pageSize };
        var result = await _requisitionService.GetPagedAsync(userId.Value, viewAll, pagination, search, status, completed, rejected);
        return Ok(result);
    }
```

- [ ] **Step 8: Testlarni qayta ishga tushirish**

Run: `cd Back && dotnet test --filter "FullyQualifiedName~RequisitionServiceTests"`
Expected: PASS — yangi 5 ta test va barcha eskilari.

- [ ] **Step 9: Commit**

```bash
git add Back/src/Application Back/src/API/Controllers/RequisitionController.cs Back/test/Application.Tests/Services/RequisitionServiceTests.cs
git commit -m "feat(requisitions): archive by real fulfilment, add rejected filter"
```

---

## Task 3: `recent-completed` endpoint

**Files:**
- Modify: `Back/src/Application/DTOs/Requisitions/RequisitionResponseDto.cs`
- Modify: `Back/src/Application/Services/Impl/RequisitionService.cs` (`MapToResponse`, yangi metod)
- Modify: `Back/src/Application/Services/IRequisitionService.cs`
- Modify: `Back/src/API/Controllers/RequisitionController.cs`
- Test: `Back/test/Application.Tests/Services/RequisitionServiceTests.cs`

**Interfaces:**
- Consumes: `FulfilledStatuses`, `Requisition.CompletedAt`, `MapToResponse` (Task 1-2).
- Produces:
  - `Task<ApiResult<IEnumerable<RequisitionResponseDto>>> GetRecentCompletedAsync(Guid currentUserId, bool viewAll, int days)`
  - `RequisitionResponseDto.CompletedAt` (`DateTime?`)
  - `GET /api/requisition/recent-completed?days=7`

- [ ] **Step 1: Failing testlar yozish**

`RequisitionServiceTests.cs` fayl oxiriga qo'shing:

```csharp
    // ─────────────────────────────────────────────────────────────────────
    //  GetRecentCompletedAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetRecentCompletedAsync_ReturnsOnlyInsideWindow()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c-recent");
        var inside = SeedParentRequisition(db, creator.Id, no: "REQ-6-DAYS",
            status: RequisitionStatus.Released);
        inside.CompletedAt = DateTime.UtcNow.AddDays(-6);
        var outside = SeedParentRequisition(db, creator.Id, no: "REQ-8-DAYS",
            status: RequisitionStatus.Delivered);
        outside.CompletedAt = DateTime.UtcNow.AddDays(-8);
        db.SaveChanges();

        var result = await CreateService(db).GetRecentCompletedAsync(creator.Id, viewAll: true, days: 7);

        result.Succeeded.Should().BeTrue();
        result.Result!.Select(i => i.RequisitionNo).Should().BeEquivalentTo(["REQ-6-DAYS"]);
    }

    [Fact]
    public async Task GetRecentCompletedAsync_LimitsToTenNewest()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c-recent-limit");
        for (var i = 0; i < 14; i++)
        {
            var r = SeedParentRequisition(db, creator.Id, no: $"REQ-{i:D2}",
                status: RequisitionStatus.Released);
            r.CompletedAt = DateTime.UtcNow.AddHours(-i);
        }
        db.SaveChanges();

        var result = await CreateService(db).GetRecentCompletedAsync(creator.Id, viewAll: true, days: 7);

        result.Result!.Should().HaveCount(10);
        result.Result!.First().RequisitionNo.Should().Be("REQ-00", "eng yangisi birinchi");
    }

    [Fact]
    public async Task GetRecentCompletedAsync_SplitParent_UsesLatestChildCompletion()
    {
        await using var db = CreateDb();
        var creator = TestData.SeedUser(db, login: "c-recent-split");
        var parent = SeedParentRequisition(db, creator.Id, no: "REQ-SPLIT-RECENT",
            status: RequisitionStatus.Split);

        var oldChild = SeedParentRequisition(db, creator.Id, no: "REQ-SPLIT-RECENT-W",
            status: RequisitionStatus.Released);
        oldChild.ParentRequisitionId = parent.Id;
        oldChild.CompletedAt = DateTime.UtcNow.AddDays(-20);

        var newChild = SeedParentRequisition(db, creator.Id, no: "REQ-SPLIT-RECENT-P",
            status: RequisitionStatus.Delivered);
        newChild.ParentRequisitionId = parent.Id;
        newChild.CompletedAt = DateTime.UtcNow.AddDays(-2);
        db.SaveChanges();

        var result = await CreateService(db).GetRecentCompletedAsync(creator.Id, viewAll: true, days: 7);

        var dto = result.Result!.Single();
        dto.RequisitionNo.Should().Be("REQ-SPLIT-RECENT");
        dto.CompletedAt.Should().Be(newChild.CompletedAt, "oxirgi child yakunlangan payt");
    }

    [Fact]
    public async Task GetRecentCompletedAsync_ViewAllFalse_ReturnsOnlyOwn()
    {
        await using var db = CreateDb();
        var mine = TestData.SeedUser(db, login: "c-recent-mine");
        var other = TestData.SeedUser(db, login: "c-recent-other");
        var a = SeedParentRequisition(db, mine.Id, no: "REQ-MINE", status: RequisitionStatus.Released);
        a.CompletedAt = DateTime.UtcNow.AddDays(-1);
        var b = SeedParentRequisition(db, other.Id, no: "REQ-OTHER", status: RequisitionStatus.Released);
        b.CompletedAt = DateTime.UtcNow.AddDays(-1);
        db.SaveChanges();

        var result = await CreateService(db).GetRecentCompletedAsync(mine.Id, viewAll: false, days: 7);

        result.Result!.Select(i => i.RequisitionNo).Should().BeEquivalentTo(["REQ-MINE"]);
    }
```

- [ ] **Step 2: Testlarni ishga tushirish**

Run: `cd Back && dotnet test --filter "FullyQualifiedName~RequisitionServiceTests.GetRecentCompletedAsync"`
Expected: BUILD FAIL — `GetRecentCompletedAsync` mavjud emas.

- [ ] **Step 3: DTO ga maydon qo'shish**

`RequisitionResponseDto.cs` — `ApprovedAt` / `QrCodeData` blokidan keyin:

```csharp
    // Real yakunlangan payt: split parent uchun childlarning eng kechki CompletedAt i.
    public DateTime? CompletedAt { get; set; }
```

- [ ] **Step 4: `MapToResponse` ni to'ldirish**

`RequisitionService.cs` `MapToResponse` ichida `ApprovedAt = r.ApprovedAt,` satridan keyin:

```csharp
        CompletedAt = r.Children.Count > 0 ? r.Children.Max(c => c.CompletedAt) : r.CompletedAt,
```

- [ ] **Step 5: Servis metodini yozish**

`RequisitionService.cs` — `GetPendingWarehouseCheckCountAsync` dan keyin, `FulfilledStatuses` e'lonidan oldin qo'shing:

```csharp
    // "Yaqinda yakunlangan" bloki uchun: faqat oxirgi N kunda real bajarilganlar,
    // sahifalanmaydi — ro'yxat qisqa bo'lishi shart.
    private const int RecentCompletedLimit = 10;

    public async Task<ApiResult<IEnumerable<RequisitionResponseDto>>> GetRecentCompletedAsync(
        Guid currentUserId, bool viewAll, int days)
    {
        var since = DateTime.UtcNow.AddDays(-Math.Clamp(days, 1, 90));

        var query = _context.Requisitions
            .Include(r => r.Creator)
            .Include(r => r.Approver)
            .Include(r => r.WarehouseChecker)
            .Include(r => r.Contract)
            .Include(r => r.Department)
            .Include(r => r.Parent)
            .Include(r => r.Children)
            .Include(r => r.Items).ThenInclude(i => i.Material)
            .AsNoTracking()
            .Where(r => r.ParentRequisitionId == null);

        if (!viewAll)
            query = query.Where(r => r.CreatedBy == currentUserId);

        query = query.Where(r => r.Children.Any()
            ? r.Children.All(c => FulfilledStatuses.Contains(c.Status))
              && r.Children.Max(c => c.CompletedAt) >= since
            : FulfilledStatuses.Contains(r.Status) && r.CompletedAt >= since);

        var items = await query
            .OrderByDescending(r => r.Children.Any()
                ? r.Children.Max(c => c.CompletedAt)
                : r.CompletedAt)
            .Take(RecentCompletedLimit)
            .ToListAsync();

        return ApiResult<IEnumerable<RequisitionResponseDto>>.Success(items.Select(MapToResponse));
    }
```

- [ ] **Step 6: Interfeysga qo'shish**

`IRequisitionService.cs` — `GetPendingWarehouseCheckCountAsync` dan keyin:

```csharp
    /// Faol ro'yxat ostidagi "Yaqinda yakunlangan" bloki: oxirgi N kunda real
    /// bajarilgan talabnomalar, eng ko'pi 10 ta.
    Task<ApiResult<IEnumerable<RequisitionResponseDto>>> GetRecentCompletedAsync(Guid currentUserId, bool viewAll, int days);
```

- [ ] **Step 7: Controller endpointi**

`RequisitionController.cs` — `GetPendingCheckCount` dan keyin:

```csharp
    /// Faol ro'yxat ostidagi "Yaqinda yakunlangan" bloki uchun.
    [HasPermission("Requisitions.View")]
    [HttpGet("recent-completed")]
    public async Task<IActionResult> GetRecentCompleted([FromQuery] int days = 7)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var viewAll = User.HasClaim("perm", "Requisitions.ViewAll");
        var result = await _requisitionService.GetRecentCompletedAsync(userId.Value, viewAll, days);
        return Ok(result);
    }
```

- [ ] **Step 8: Testlarni qayta ishga tushirish**

Run: `cd Back && dotnet test --filter "FullyQualifiedName~RequisitionServiceTests"`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add Back/src Back/test
git commit -m "feat(requisitions): add recent-completed endpoint"
```

---

## Task 4: Frontend — tiplar va API klient

**Files:**
- Modify: `client/app/(documents)/requisitions/_types.ts:26-46`
- Modify: `client/lib/userService.ts:1424-1488`

**Interfaces:**
- Consumes: `GET /api/requisition/recent-completed`, `paged?rejected=` (Task 2-3).
- Produces:
  - `FULFILLED_STATUSES: Set<RequisitionStatus>`
  - `isRequisitionCompleted(r: RequisitionResponse): boolean`
  - `fmtRelativeDays(d?: string | null): { days: number; today: boolean }`
  - `requisitionService.getRecentCompleted(days?: number): Promise<RequisitionResponse[]>`
  - `requisitionService.getPaged(page, pageSize, { search, status, completed, rejected })`

- [ ] **Step 1: `_types.ts` — bajarilish to'plami va nisbiy sana**

`_types.ts:26-46` dagi "Yakunlanganlik" blokini shu bilan almashtiring:

```ts
// ─── Bajarilganlik ─────────────────────────────────────────────────────────────

// Talabnoma REAL bajarilgan hisoblanadigan holatlar: material berildi, xarid
// yetkazildi yoki rad etildi. "Ombordan olishga" / "Sotib olishga" — tasdiqlangan,
// lekin hali bajarilmagan ish, shuning uchun bu ro'yxatda yo'q.
// Backenddagi RequisitionService.FulfilledStatuses bilan aynan bir xil bo'lishi shart.
export const FULFILLED_STATUSES = new Set<RequisitionStatus>([
  RequisitionStatus.Released,
  RequisitionStatus.Delivered,
  RequisitionStatus.Rejected,
]);

// Bo'lingan (Split) talabnoma barcha child'lari bajarilgandagina bajarilgan;
// bo'linmagani esa o'z holatiga qarab.
export function isRequisitionCompleted(r: RequisitionResponse): boolean {
  if (r.children && r.children.length > 0) {
    return r.children.every(c => FULFILLED_STATUSES.has(c.status));
  }
  return FULFILLED_STATUSES.has(r.status);
}
```

- [ ] **Step 2: `_types.ts` — `fmtRelativeDays`**

`fmtDateTime` dan keyin, fayl oxiriga qo'shing:

```ts
// "Yaqinda yakunlangan" bloki uchun: 0 → "bugun", 1 → "1 kun oldin".
// Tarjima chaqiruvchi tomonda: t("kun oldin"), t("bugun").
export function fmtRelativeDays(d?: string | null): { days: number; today: boolean } {
  if (!d) return { days: 0, today: true };
  const diffMs = Date.now() - new Date(d).getTime();
  const days = Math.max(0, Math.floor(diffMs / 86_400_000));
  return { days, today: days === 0 };
}
```

- [ ] **Step 3: `userService.ts` — DTO maydoni va yangi chaqiruvlar**

`RequisitionResponse` interfeysida `approvedAt?: string;` dan keyin:

```ts
  completedAt?: string | null;
```

`getPaged` ni almashtiring:

```ts
  getPaged: async (
    page = 1,
    pageSize = 20,
    opts: { search?: string; status?: RequisitionStatus; completed?: boolean; rejected?: boolean } = {},
  ): Promise<PagedResult<RequisitionResponse>> => {
    const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
    if (opts.search?.trim()) params.search = opts.search.trim();
    if (opts.status !== undefined) params.status = String(opts.status);
    if (opts.completed !== undefined) params.completed = String(opts.completed);
    if (opts.rejected !== undefined) params.rejected = String(opts.rejected);
    const res = await api.get("/api/requisition/paged", { params });
    return res.data?.result ?? res.data;
  },
```

`getPendingCheckCount` dan keyin qo'shing:

```ts
  /** Faol ro'yxat ostidagi blok: oxirgi N kunda bajarilganlar (eng ko'pi 10 ta). */
  getRecentCompleted: async (days = 7): Promise<RequisitionResponse[]> => {
    try {
      const res = await api.get("/api/requisition/recent-completed", { params: { days } });
      return res.data?.result ?? res.data ?? [];
    } catch {
      return [];
    }
  },
```

- [ ] **Step 4: Tip tekshiruvi**

Run: `cd client && npx tsc --noEmit`
Expected: 0 error. (`TERMINAL_STATUSES` hech qayerda import qilinmagan — faqat `_types.ts` ichida ishlatilgan, shuning uchun nomni o'zgartirish boshqa fayllarni buzmaydi.)

- [ ] **Step 5: Commit**

```bash
git add client/lib/userService.ts "client/app/(documents)/requisitions/_types.ts"
git commit -m "feat(requisitions): align frontend types with fulfilment semantics"
```

---

## Task 5: Frontend — "Yaqinda yakunlangan" bloki

**Files:**
- Create: `client/app/(documents)/requisitions/_components/RecentCompleted.tsx`
- Modify: `client/app/(documents)/requisitions/page.tsx`
- Modify: `client/lib/i18n/ru.ts`

**Interfaces:**
- Consumes: `requisitionService.getRecentCompleted`, `fmtRelativeDays`, `isRequisitionCompleted`, `RequisitionStatusBadge` (Task 4).
- Produces: `<RecentCompleted onOpen={(r: RequisitionResponse) => void} reloadKey={number} />` — o'zi yuklaydi, bo'sh bo'lsa `null` qaytaradi.

- [ ] **Step 1: Komponentni yaratish**

`client/app/(documents)/requisitions/_components/RecentCompleted.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { requisitionService, type RequisitionResponse } from "@/lib/userService";
import { fmtRelativeDays, isRequisitionCompleted } from "../_types";
import { RequisitionStatusBadge } from "./StatusBadge";
import { useT } from "@/lib/i18n";

const WINDOW_DAYS = 7;

interface Props {
  /** Qator bosilganda ochiladigan drawer. */
  onOpen: (req: RequisitionResponse) => void;
  /** Qiymati o'zgarganda blok qayta yuklanadi (asosiy ro'yxat yangilanishi bilan birga). */
  reloadKey: number;
}

export function RecentCompleted({ onOpen, reloadKey }: Props) {
  const t = useT();
  const [items, setItems] = useState<RequisitionResponse[]>([]);

  useEffect(() => {
    let cancelled = false;
    requisitionService.getRecentCompleted(WINDOW_DAYS).then(list => {
      if (!cancelled) setItems(list);
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  if (items.length === 0) return null;

  return (
    <div className="itm-card" style={{ marginTop: 8, padding: "10px 14px 12px", flexShrink: 0 }}>
      <p style={{
        fontSize: 10, fontWeight: 600, color: "var(--text3)",
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
      }}>
        {t("Yaqinda yakunlangan")} · {WINDOW_DAYS} {t("kun")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map(r => {
          const rel = fmtRelativeDays(r.completedAt);
          return (
            <button
              key={r.id}
              onClick={() => onOpen(r)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 8px", border: "none", background: "transparent",
                borderRadius: "var(--radius)", cursor: "pointer", textAlign: "left",
                color: "var(--text2)", fontSize: 13, transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.requisitionNo}
              </span>
              <span style={{ flexShrink: 0 }}>
                <RequisitionStatusBadge status={r.status} completed={isRequisitionCompleted(r)} small />
              </span>
              <span style={{
                flexShrink: 0, minWidth: 92, textAlign: "right",
                fontSize: 12, color: "var(--text3)", fontFamily: "var(--font-mono)",
              }}>
                {rel.today ? t("bugun") : `${rel.days} ${t("kun oldin")}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Sahifaga ulash**

`page.tsx` — importlarga qo'shing:

```tsx
import { RecentCompleted } from "./_components/RecentCompleted";
```

`load` funksiyasidagi `opts` qurilishini almashtiring (endi asosiy jadval doim faol ro'yxat):

```tsx
      const opts: { search?: string; status?: RequisitionStatus; completed?: boolean } = { completed: false };
      if (search.trim()) opts.search = search.trim();
      if (filterStatus !== "") opts.status = Number(filterStatus) as RequisitionStatus;
```

`STATUS_FILTER` dan `COMPLETED_FILTER` ni olib tashlang va faol statuslar ro'yxatiga almashtiring:

```tsx
const STATUS_FILTER = [
  { value: String(RequisitionStatus.PendingWarehouseCheck),    label: REQUISITION_STATUS_LABELS[RequisitionStatus.PendingWarehouseCheck] },
  { value: String(RequisitionStatus.WarehouseChecked),         label: REQUISITION_STATUS_LABELS[RequisitionStatus.WarehouseChecked] },
  { value: String(RequisitionStatus.PendingApproval),          label: REQUISITION_STATUS_LABELS[RequisitionStatus.PendingApproval] },
  { value: String(RequisitionStatus.Split),                    label: REQUISITION_STATUS_LABELS[RequisitionStatus.Split] },
  { value: String(RequisitionStatus.ReadyForWarehouseRelease), label: REQUISITION_STATUS_LABELS[RequisitionStatus.ReadyForWarehouseRelease] },
  { value: String(RequisitionStatus.ReadyForPurchase),         label: REQUISITION_STATUS_LABELS[RequisitionStatus.ReadyForPurchase] },
];
```

`COMPLETED_FILTER` konstantasini butunlay o'chiring.

- [ ] **Step 3: Blokni jadval ostiga qo'yish**

`page.tsx` — pagination footer'dan keyin, `{drawerReq && (` dan oldin:

```tsx
      {/* Qidiruv/filtr qo'llangan bo'lsa ko'rsatilmaydi — blok filtrlarga bo'ysunmaydi */}
      {!search.trim() && filterStatus === "" && (
        <RecentCompleted reloadKey={recentKey} onOpen={setDrawerReq} />
      )}
```

`recentKey` holatini qo'shing (`const [drawerReq, ...]` satri yoniga):

```tsx
  const [recentKey, setRecentKey] = useState(0);
```

Va "Yangilash" tugmasining `onClick` ini yangilang, ikkalasi birga yangilansin:

```tsx
        <button className="btn-icon" onClick={() => { load(); setRecentKey(k => k + 1); }} title={t("Yangilash")}
```

- [ ] **Step 4: `ru.ts` ga tarjimalar**

`client/lib/i18n/ru.ts` ga qo'shing (alifbo tartibiga qarab mos joyga):

```ts
  "Yaqinda yakunlangan": "Недавно завершённые",
  "kun oldin": "дн. назад",
  "kun": "дн.",
  "bugun": "сегодня",
```

- [ ] **Step 5: Tekshirish**

Run: `cd client && npx tsc --noEmit && npm run lint`
Expected: 0 error, 0 warning.

- [ ] **Step 6: Qo'lda tekshirish**

Backend (`cd Back/src/API && dotnet run`) va frontend (`cd client && npm run dev`) ni ishga tushiring, `/requisitions` ni oching:
- Tasdiqlangan, lekin berilmagan talabnoma asosiy jadvalda turibdi.
- Berilgan/rad etilgan talabnoma jadvaldan chiqib, pastdagi blokda "N kun oldin" bilan ko'rinadi.
- Qidiruvga biror narsa yozilsa blok yo'qoladi.

- [ ] **Step 7: Commit**

```bash
git add "client/app/(documents)/requisitions" client/lib/i18n/ru.ts
git commit -m "feat(requisitions): show recently completed block under active list"
```

---

## Task 6: Frontend — arxiv ko'rinishi va kontekstli filtr

**Files:**
- Modify: `client/app/(documents)/requisitions/page.tsx`
- Modify: `client/lib/i18n/ru.ts`

**Interfaces:**
- Consumes: `requisitionService.getPaged` `rejected` opti (Task 4), `RecentCompleted` (Task 5).
- Produces: yakuniy sahifa — boshqa fayl unga tayanmaydi.

- [ ] **Step 1: Ko'rinish holatlarini qo'shish**

`page.tsx` — `filterStatus` holatidan keyin:

```tsx
  const [viewMode, setViewMode]     = useState<"active" | "archive">("active");
  const [archiveTab, setArchiveTab] = useState<"completed" | "rejected">("completed");
```

Arxiv uchun status variantlari — `STATUS_FILTER` yonida:

```tsx
const ARCHIVE_STATUS_FILTER = [
  { value: String(RequisitionStatus.Released),  label: REQUISITION_STATUS_LABELS[RequisitionStatus.Released] },
  { value: String(RequisitionStatus.Delivered), label: REQUISITION_STATUS_LABELS[RequisitionStatus.Delivered] },
];
```

- [ ] **Step 2: `load` ni ko'rinishga moslashtirish**

`load` ichidagi `opts` qurilishini almashtiring:

```tsx
      const opts: { search?: string; status?: RequisitionStatus; completed?: boolean; rejected?: boolean } =
        viewMode === "active"
          ? { completed: false }
          : archiveTab === "completed"
            ? { completed: true, rejected: false }
            : { rejected: true };
      if (search.trim()) opts.search = search.trim();
      if (filterStatus !== "") opts.status = Number(filterStatus) as RequisitionStatus;
```

`load` ning dependency massiviga va ikkala `useEffect` ga `viewMode`, `archiveTab` qo'shing:

```tsx
  }, [page, search, filterStatus, viewMode, archiveTab]);

  // Ko'rinish yoki filtr o'zgarsa — birinchi sahifaga qaytish
  useEffect(() => { setPage(1); }, [search, filterStatus, viewMode, archiveTab]);

  useEffect(() => {
    const timer = setTimeout(() => { load(page); }, search ? 250 : 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, filterStatus, viewMode, archiveTab]);
```

Ko'rinish almashganda filtr tozalanishi uchun alohida effekt qo'shing:

```tsx
  // Faol va arxiv status variantlari umumiy emas — ko'rinish almashganda tozalanadi
  useEffect(() => {
    setFilterStatus("");
    setPendingStatus("");
  }, [viewMode, archiveTab]);
```

- [ ] **Step 3: Tab toggle'larini toolbar boshiga qo'yish**

`page.tsx` — toolbar `itm-card` div'i ichida, `search-wrap` dan **oldin**:

```tsx
        {/* Faol / Arxiv */}
        <div style={{ display: "inline-flex", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 2, gap: 2, flexShrink: 0 }}>
          <button
            onClick={() => setViewMode("active")}
            style={{
              padding: "6px 14px", borderRadius: "var(--radius)", border: "none",
              background: viewMode === "active" ? "var(--accent)" : "transparent",
              color: viewMode === "active" ? "#fff" : "var(--text2)",
              fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {t("Faol")}
          </button>
          <button
            onClick={() => setViewMode("archive")}
            style={{
              padding: "6px 14px", borderRadius: "var(--radius)", border: "none",
              background: viewMode === "archive" ? "var(--text3)" : "transparent",
              color: viewMode === "archive" ? "#fff" : "var(--text2)",
              fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="21 8 21 21 3 21 3 8"/>
              <rect x="1" y="3" width="22" height="5"/>
              <line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
            {t("Arxiv")}
          </button>
        </div>

        {/* Arxiv sub-tablari */}
        {viewMode === "archive" && (
          <div style={{ display: "inline-flex", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 2, gap: 2, flexShrink: 0, animation: "panel-appear 0.18s ease" }}>
            <button
              onClick={() => setArchiveTab("completed")}
              style={{
                padding: "6px 12px", borderRadius: "var(--radius)", border: "none",
                background: archiveTab === "completed" ? "var(--success)" : "transparent",
                color: archiveTab === "completed" ? "#fff" : "var(--text2)",
                fontSize: 12.5, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {t("Yakunlangan")}
            </button>
            <button
              onClick={() => setArchiveTab("rejected")}
              style={{
                padding: "6px 12px", borderRadius: "var(--radius)", border: "none",
                background: archiveTab === "rejected" ? "var(--danger)" : "transparent",
                color: archiveTab === "rejected" ? "#fff" : "var(--text2)",
                fontSize: 12.5, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {t("Rad etilgan")}
            </button>
          </div>
        )}
```

- [ ] **Step 4: Filtr tugmasini kontekstga bog'lash**

Filtr dropdown'ini o'rab turgan `<div style={{ position: "relative", flexShrink: 0 }}>` ni shartga oling — `Rad etilgan` sub-tabida yagona status bo'lgani uchun filtr yashiriladi:

```tsx
        {!(viewMode === "archive" && archiveTab === "rejected") && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            {/* Mavjud kod: <button ref={filterBtnRef} ...> dan boshlab
                {filterPanelOpen && ( ... )} blokining yopilishigacha —
                bir qator ham o'zgartirilmaydi, faqat shu shartga o'raladi. */}
          </div>
        )}
```

Panel ichidagi `CheckSelect` ning `options` ini ko'rinishga bog'lang:

```tsx
                    options={(viewMode === "archive" ? ARCHIVE_STATUS_FILTER : STATUS_FILTER)
                      .map(o => ({ id: o.value, name: t(o.label) }))}
```

- [ ] **Step 5: Bo'sh holat matni va blokni shartlash**

Jadvaldagi bo'sh holat qatorini almashtiring:

```tsx
                  <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>
                    {viewMode === "active"
                      ? t("Talabnomalar topilmadi")
                      : archiveTab === "completed"
                        ? t("Yakunlangan talabnomalar yo'q")
                        : t("Rad etilgan talabnomalar yo'q")}
                  </td></tr>
```

`RecentCompleted` blokini faqat faol ko'rinishda ko'rsating:

```tsx
      {viewMode === "active" && !search.trim() && filterStatus === "" && (
        <RecentCompleted reloadKey={recentKey} onOpen={setDrawerReq} />
      )}
```

- [ ] **Step 6: `ru.ts` ga tarjimalar**

```ts
  "Rad etilgan": "Отклонённые",
  "Yakunlangan talabnomalar yo'q": "Завершённых заявок нет",
  "Rad etilgan talabnomalar yo'q": "Отклонённых заявок нет",
```

("Arxiv", "Faol", "Yakunlangan" allaqachon mavjud — takrorlamang.)

- [ ] **Step 7: Tekshirish**

Run: `cd client && npx tsc --noEmit && npm run lint`
Expected: 0 error, 0 warning.

- [ ] **Step 8: Qo'lda tekshirish**

`/requisitions` sahifasida:
- "Arxiv" → "Yakunlangan": faqat berilgan/yetkazilgan (va qisman rad etilgan split) talabnomalar, eng yangisi yuqorida.
- "Arxiv" → "Rad etilgan": filtr tugmasi yo'q, faqat to'liq rad etilganlar.
- Tab almashganda filtr tozalanadi va sahifa 1 ga qaytadi.
- Arxivda pastdagi "Yaqinda yakunlangan" bloki ko'rinmaydi.
- Til rus tiliga o'zgartirilsa barcha yangi matn tarjima bo'ladi.

- [ ] **Step 9: Commit**

```bash
git add "client/app/(documents)/requisitions/page.tsx" client/lib/i18n/ru.ts
git commit -m "feat(requisitions): add archive view with completed/rejected tabs"
```

---

## Yakuniy tekshiruv

- [ ] `cd Back && dotnet test` — barcha testlar o'tadi.
- [ ] `cd client && npx tsc --noEmit && npm run lint` — toza.
- [ ] Migration bazaga qo'llangan (backend `dotnet run` da avtomatik) va eski bajarilgan talabnomalarda `CompletedAt` to'ldirilgan.
