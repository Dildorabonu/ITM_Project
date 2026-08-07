# Talabnomalar arxivi — dizayn

Sana: 2026-08-07

## Muammo

Talabnomalar ro'yxati jarayondagi va allaqachon yopilgan hujjatlarni bir joyda ko'rsatadi.
Yakunlanganlar vaqt o'tishi bilan to'planib, faol ishni ko'rishni qiyinlashtiradi.
Shartnomalar bo'limida "Faol / Arxiv" ko'rinishi bor — talabnomalarda yo'q.

Bundan tashqari mavjud "yakunlangan" ta'rifi noto'g'ri: `ReadyForWarehouseRelease` va
`ReadyForPurchase` terminal deb belgilangan, ya'ni direktor imzolagan, lekin material
hali ombordan berilmagan yoki hali yetib kelmagan talabnoma "Yakunlangan" badge'ini
oladi. Bu operatordan haqiqiy ishni yashiradi.

## Yechim

Arxivlash hujjat qarori bo'yicha emas — **real bajarilish** bo'yicha, va vaqt asosida
avtomatik:

```
JARAYONDA            → tekshiruv / tasdiq kutilmoqda / bo'lingan
                       + tasdiqlangan, lekin hali berilmagan yoki kelmagan
YAQINDA YAKUNLANGAN  → Berildi / Yetkazildi / Rad etildi — oxirgi 7 kun
ARXIV                → undan eskisi
```

Foydalanuvchi hech narsani qo'lda arxivlamaydi va yangi yopilgan hujjatni yo'qotmaydi.
Bajarilmagan talabnoma ro'yxatda ko'rinib turgani uchun alohida "ogohlantirish
indikatori" ham kerak emas.

## 1. Semantika

Hozirgi `TerminalStatuses` ikki xil narsani anglatadi — hujjat qarori va real
bajarilish. Ular ajratiladi, yagona ta'rif qoladi:

| | Statuslar |
|---|---|
| **Bajarilgan** (`FulfilledStatuses`) | `Released` (11), `Delivered` (12), `Rejected` (3) |
| **Faol** | qolgan hammasi, shu jumladan `ReadyForWarehouseRelease` (9), `ReadyForPurchase` (10) |

- Split parent barcha childlari bajarilgandagina bajarilgan; qisman bo'lsa faol.
- Bajarilish vaqti — `CompletedAt`; split parent uchun `MAX(children.CompletedAt)`.

**Kutilgan yon ta'sir:** status badge endi `Ombordan olishga` / `Sotib olishga`
talabnomani "Yakunlangan" deb ko'rsatmaydi, o'z holatini ko'rsatadi. Bu ataylab —
badge, ro'yxat va arxiv bitta ta'rifga bo'ysunadi.

## 2. Backend

### 2.1 Entity va migration

`Core/Entities/Requisition.cs`:

```csharp
// Talabnoma real bajarilgan (berilgan / yetkazilgan / rad etilgan) payt.
// Faol emas, arxiv va "yaqinda yakunlangan" bloki uchun.
public DateTime? CompletedAt { get; set; }
```

Migration `AddRequisitionCompletedAt` — bitta nullable ustun.
`Up()` ichida bir martalik backfill:

```sql
UPDATE "Requisitions"
SET "CompletedAt" = "ApprovedAt"
WHERE "Status" IN (3, 11, 12) AND "CompletedAt" IS NULL;
```

Bu taxminiy (berilgan sana emas, imzo sanasi), lekin mavjud yozuvlar uchun yagona
mavjud manba. Yangi yozuvlar aniq vaqt oladi.

### 2.2 `CompletedAt` yoziladigan joylar

Status bajarilganga o'tadigan **ikkita** joy bor:

| Metod | Qiymat |
|---|---|
| `RejectAsync` | `r.CompletedAt = r.ApprovedAt` (aynan shu tranzaksiyada o'rnatiladi) |
| `ReleaseAsync` | `r.CompletedAt = DateTime.UtcNow` (`Released` / `Delivered` ga o'tish joyi) |

Boshqa hech bir joy `Released` / `Delivered` / `Rejected` ga o'tkazmaydi (xarid qabul
qilingach status `ReadyForWarehouseRelease` bo'ladi — bu hali faol).

### 2.3 `RequisitionService.GetPagedAsync`

- `TerminalStatuses` → `FulfilledStatuses` = `{ Released, Delivered, Rejected }`.
  Frontend `FULFILLED_STATUSES` bilan aynan bir xil bo'lishi shart (izoh saqlanadi).
- `bool? completed` semantikasi: `false` → faol ro'yxat, `true` → arxiv.
- Yangi `bool? rejected` parametri (arxiv sub-tablari uchun):

  ```
  rejected(r) = r.Children.Any()
                  ? r.Children.All(c => c.Status == Rejected)
                  : r.Status == Rejected
  ```

  Qisman rad etilgan split parent (1 tasdiq + 1 rad) → `rejected = false`, ya'ni
  "Yakunlangan" sub-tabida qoladi — unda haqiqiy natija bor.

- Saralash:
  - faol (`completed=false`): tekshiruv kutayotganlar birinchi, keyin `CreatedAt DESC`.
    Mavjud `OrderBy` dagi "yakunlanganlar oxirida" bandi olib tashlanadi — ular endi
    bu ro'yxatda yo'q.
  - arxiv (`completed=true`): `CompletedAt DESC`, keyin `CreatedAt DESC` (backfill
    qilinmagan chetki holatlar uchun barqaror tartib).

### 2.4 Yangi endpoint — yaqinda yakunlanganlar

`GET /api/requisition/recent-completed?days=7`

- `[HasPermission("Requisitions.View")]`, `viewAll` bo'lmasa `CreatedBy == currentUserId`.
- Faqat parent qatorlar (`ParentRequisitionId == null`), bajarilgan bo'lganlari.
- Vaqt: `children.Any() ? MAX(children.CompletedAt) : r.CompletedAt`, va u
  `UtcNow - days` dan keyin bo'lishi kerak.
- `CompletedAt DESC`, **maksimum 10 ta** (pagination yo'q).
- Javob — mavjud `RequisitionResponseDto` (`MapToResponse`), `completedAt` maydoni
  DTO ga qo'shiladi.

`days` parametri 1..90 oralig'ida cheklanadi; standart qiymat 7.

### 2.5 Interfeys

`IRequisitionService`: `GetPagedAsync` imzosiga `bool? rejected = null`,
yangi `GetRecentCompletedAsync(Guid currentUserId, bool viewAll, int days)`.

## 3. Frontend

### 3.1 `_types.ts`

- `TERMINAL_STATUSES` → `FULFILLED_STATUSES` = `{ Released, Delivered, Rejected }`.
- `isRequisitionCompleted(r)` shakli o'zgarmaydi (split parent uchun `every`).
- Yangi helper `fmtRelativeDays(iso)` → "bugun" / "1 kun oldin" / "6 kun oldin".

### 3.2 `requisitions/page.tsx`

Yangi holat: `viewMode: "active" | "archive"`, `archiveTab: "completed" | "rejected"`.

**Faol ko'rinish**
- Jadval — `completed=false`, pagination hozirgidek (20 tadan).
- Jadval ostida **"YAQINDA YAKUNLANGAN · 7 kun"** bloki:
  - alohida so'rov (`recent-completed`), pagination'ga aralashmaydi;
  - och rangli qatorlar (`--text2`), natija badge'i va `fmtRelativeDays`;
  - bo'sh bo'lsa blok butunlay ko'rsatilmaydi;
  - qidiruv yoki filtr qo'llangan bo'lsa ham ko'rsatilmaydi — blok filtrlarga
    bo'ysunmaydi, aks holda natija chalg'ituvchi bo'lardi;
  - qator bosilganda o'sha drawer ochiladi.

**Arxiv ko'rinishi**
- Toolbar'dagi "Arxiv" tugmasi orqali almashadi (contracts'dagi Faol/Arxiv toggle
  uslubi, `--radius`, `--accent` / `--text3` tokenlari bilan).
- Sub-tablar: `Yakunlangan` (`completed=true&rejected=false`, yashil) va
  `Rad etilgan` (`rejected=true`, qizil).
- "Yaqinda yakunlangan" bloki arxivda ko'rsatilmaydi.

**Filtr paneli** — kontekstga moslashadi:

| Ko'rinish | Holat variantlari |
|---|---|
| Faol | Ombor tekshiruvida, Tekshiruv yakunlandi, Tasdiqlash kutilmoqda, Bo'lib yuborilgan, Ombordan olishga, Sotib olishga |
| Arxiv → Yakunlangan | Chiqarib berildi, Xarid yetkazildi |
| Arxiv → Rad etilgan | filtr tugmasi yashiriladi (yagona status) |

Mavjud `COMPLETED_FILTER` varianti paneldan olib tashlanadi — uning o'rnini Arxiv
ko'rinishi egallaydi. Ko'rinish yoki sub-tab almashganda filtr va sahifa raqami
tozalanadi.

**Bo'sh holat matnlari**: faol — "Talabnomalar topilmadi"; arxiv/Yakunlangan —
"Yakunlangan talabnomalar yo'q"; arxiv/Rad etilgan — "Rad etilgan talabnomalar yo'q".

Arxiv tugmasida son ko'rsatilmaydi — buning uchun qo'shimcha count endpoint kerak
bo'lardi, foyda esa kam.

### 3.3 `lib/userService.ts`

- `RequisitionResponse` ga `completedAt?: string | null`.
- `requisitionService.getPaged` opts: `rejected?: boolean`.
- Yangi `requisitionService.getRecentCompleted(days = 7)`.

### 3.4 i18n

`lib/i18n/ru.ts` ga yangi satrlar: "Yaqinda yakunlangan", "Rad etilgan",
"kun oldin", "bugun", "Yakunlangan talabnomalar yo'q", "Rad etilgan talabnomalar yo'q".
"Arxiv", "Faol", "Yakunlangan" allaqachon mavjud.

## 4. Testlar

`Back/test/Application.Tests/Services/RequisitionServiceTests.cs`:

1. `ReadyForWarehouseRelease` va `ReadyForPurchase` — `completed=false` ro'yxatida qoladi.
2. `Released` / `Delivered` / `Rejected` — `completed=true` ro'yxatiga tushadi.
3. Split parent: barcha childlar bajarilgan → arxiv; bittasi hali `ReadyForPurchase` → faol.
4. `rejected=true` — barcha childlari rad etilgan parent tushadi; qisman rad etilgani tushmaydi.
5. `RejectAsync` va `ReleaseAsync` `CompletedAt` ni to'ldiradi.
6. `GetRecentCompletedAsync`: 7 kun chegarasi (6 kunlik tushadi, 8 kunlik tushmaydi),
   10 talik limit, split parent uchun `MAX(children.CompletedAt)`.

## 5. Xavflar

- **Badge ma'nosi o'zgaradi.** Foydalanuvchilar `Ombordan olishga` talabnomada
  "Yakunlangan" yozuvini ko'rib o'rgangan. Yangi ko'rinish to'g'riroq, lekin o'zgarish
  sezilarli — yetkazib berish paytida aytib qo'yish kerak.
- **Backfill taxminiy.** Eski `Released`/`Delivered` yozuvlarning `CompletedAt` i imzo
  sanasiga teng bo'ladi, ya'ni ular "yaqinda yakunlangan" blokiga noto'g'ri tushishi
  mumkin — faqat bir marta, birinchi deploydan keyingi 7 kun ichida.
- **`ApprovedAt` null bo'lgan chetki holat.** Agar bazada imzosiz `Rejected` yozuv
  bo'lsa, `CompletedAt` null qoladi va u arxivda `CreatedAt` bo'yicha saralanadi —
  yo'qolmaydi.

## Qamrovdan tashqarida

- Arxivdan Excel/PDF eksport va sana oralig'i filtri (keyingi bosqich).
- Talabnomani qo'lda arxivlash/tiklash — avtomatik qoida yetarli.
- `7` kunni `appsettings` ga chiqarish — hozircha konstanta.
