# Talabnomada zaxira foizi — dizayn

Sana: 2026-09-25

## Muammo

Shartnoma tipidagi talabnoma me'yoriy sarfdan to'ldiriladi: har qator miqdori
`TotalQty × shartnomadagi mahsulot soni`. Backend buni qat'iy tekshiradi
(`RequisitionService.LineMatchesItem`, tolerans ~0.01%) — boshqa miqdor bilan
talabnoma yaratib bo'lmaydi.

Me'yorda texnologik chiqindi allaqachon bor: `TotalQty = ReadyQty + WasteQty`,
bazadagi 631 ta me'yor qatorining 590 tasida `WasteQty` to'ldirilgan (metallda
ko'pincha 20–50%). Lekin **brak** (ishlab chiqarishdagi nuqson) va **sifatsiz kelgan
material** hisobga olinmagan — material yetmay qolsa, qo'shimcha talabnoma rasmiylashtirish
kerak bo'ladi.

## Yechim

Tizim bo'yicha **yagona zaxira foizi** (boshlang'ich qiymati 3%):

- Foizni faqat `RequisitionAllowance.Update` ruxsati bor foydalanuvchi o'zgartiradi;
  har o'zgartirish tarixda qoladi (kim, qachon, nechaga, nima uchun).
- Talabnoma yaratuvchi me'yordan to'ldirganda **"+3% zaxira"** tanlovini o'zi yoqadi
  yoki yoqmaydi. Standart holati — **o'chiq** (aniq me'yor bo'yicha).
- Foiz qiymatini foydalanuvchi talabnomada o'zgartira olmaydi — faqat qo'llash yoki
  qo'llamaslikni tanlaydi. Backend foizni o'zi (bazadan) oladi va miqdorni shunga
  qarab tekshiradi.
- Talabnoma yaratilgan paytdagi foizni o'zida saqlaydi — keyin foiz o'zgarsa ham eski
  talabnomalar o'zgarmaydi.

Chop etiladigan blank shakli o'zgarmaydi: "Миқдори" ustunida zaxira qo'shilgan jami
miqdor turadi.

Qo'llanish doirasi: faqat shartnoma tipidagi, me'yoriy sarfdan to'ldiriladigan
talabnomalar. Individual talabnomalar va allaqachon yaratilgan talabnomalar o'zgarmaydi.

## 1. Hisoblash qoidasi

```
zaxirasiz:   miqdor = TotalQty × son
zaxira bilan: miqdor = TotalQty × son × (1 + foiz / 100)
```

- Birlik `шт`, `шт.`, `дона`, `dona`, `қути`, `пакет` yoki `тўплам` bo'lsa (bo'linmaydigan
  birliklar; katta-kichik harf farqsiz, bo'shliqlar
  kesiladi) — zaxirali natija **eng yaqin** butun songa yaxlitlanadi (yarmi yuqoriga),
  lekin me'yordan kam emas: 14,42 → 14; 17,51 → 18; 51,5 → 52. Doim yuqoriga
  yaxlitlash kichik sonlarni keskin oshirardi (1 → 2, ya'ni +100%).
- Boshqa birliklar (кг, м, м2, ...) — aniq o'nlik: 75 × 1,03 = 77,25.
- Natija — zaxirali ham, zaxirasiz ham — 4 kasr xonagacha **yuqoriga** yaxlitlanadi:
  `RequisitionItem.Quantity` bazada `numeric(18,4)`, ortiqcha xonani baza o'zi
  yaxlitlasa PDF'da 429,12375, bazada 429,1238 chiqadi. 416,625 × 1,03 → 429,1238;
  zaxirasiz 0,00021 → 0,0003.
- Zaxirasiz holatda dona butun songa yaxlitlanmaydi.
- Foiz 0 bo'lsa natija 4 xonaga yaxlitlangan `TotalQty × son`.

Qoida ikki joyda bir xil amalga oshiriladi: backend `NormAllowance.Apply` va frontend
`applyAllowance`. Tekshiruvda backendniki hal qiluvchi.

## 2. Ma'lumotlar modeli

### 2.1 Yangi entity — `RequisitionAllowanceRate`

`Core/Entities/RequisitionAllowanceRate.cs`:

| Maydon | Turi | Izoh |
|---|---|---|
| `Id` | `Guid` | |
| `Percent` | `decimal(5,2)` | 0–20 |
| `Note` | `string?` (≤ 500) | Ixtiyoriy — nega o'zgartirilgani |
| `CreatedAt` | `DateTime` (UTC) | |
| `CreatedByUserId` | `Guid?` | Seed yozuvida `null` |

- Yozuvlar **faqat qo'shiladi** — update/delete endpointi yo'q. Tarix o'zgarmas.
- Amaldagi foiz — `CreatedAt` bo'yicha eng oxirgi yozuv.
- `DatabaseContext.RequisitionAllowanceRates` DbSet, `CreatedAt` bo'yicha indeks.

### 2.2 `Requisition.AllowancePercent`

`decimal(5,2)?`:
- `null` — zaxirasiz (aniq me'yor) yoki individual talabnoma.
- qiymat — yaratilgan paytdagi foiz snapshot'i.

Ombor tekshiruvidan keyin yaratiladigan bola talabnomalar (`-W` / `-P`,
`RequisitionService` dagi bola yasash bloki) parent'ning `AllowancePercent` ini oladi.

### 2.3 Migratsiya

Bitta migratsiya: `AddRequisitionAllowance` — `RequisitionAllowanceRates` jadvali +
`Requisitions.AllowancePercent` ustuni.

### 2.4 Seed

`AutomatedMigration.SeedRequisitionAllowanceAsync` — jadval butunlay bo'sh bo'lsa bitta
yozuv: `Percent = 3`, `Note = "Boshlang'ich qiymat"`, `CreatedByUserId = null`.
(`SeedEnergyTariffAsync` namunasi bo'yicha.)

## 3. Ruxsat

- `PermissionModule.RequisitionAllowance = 18`,
  `[Display(Name = "Talabnoma zaxirasi", Description = "percent")]`.
- `AutomatedMigration.ModuleActions` ga: `[PermissionModule.RequisitionAllowance] = [PermissionAction.Update]`.
- Superadmin uni `SeedSuperAdminPermissionsAsync` orqali avtomatik oladi. Standart
  rollarga qo'shilmaydi — admin Rollar sahifasida biriktiradi.
- `Requisitions.Update` qayta ishlatilmaydi: u oddiy talabnoma yaratuvchi rollarda bor.

## 4. API

### 4.1 `RequisitionAllowanceController` — `api/requisition-allowance`, `[Authorize]`

| So'rov | Ruxsat | Javob |
|---|---|---|
| `GET` | autentifikatsiya | `RequisitionAllowanceRateDto[]` — yangidan eskiga; birinchisi amaldagi |
| `POST` `{ percent, note }` | `[HasPermission("RequisitionAllowance.Update")]` | yangi yozuv `Id` |

`RequisitionAllowanceRateDto`: `Id`, `Percent`, `Note`, `CreatedAt`, `CreatedByName`
(`null` bo'lsa frontend "Tizim" deb ko'rsatadi).

`RequisitionAllowanceSaveDto`: `Percent`, `Note`.

POST validatsiyasi (`ApiResult.Failure`, 400):
- `Percent < 0` yoki `> 20` → "Zaxira foizi 0 dan 20 gacha bo'lishi kerak."
- 2 tadan ko'p kasr raqam → "Zaxira foizi ko'pi bilan 2 xonali kasr bo'lishi mumkin."
- amaldagi foizga teng → "Zaxira foizi o'zgarmagan."
- `Note` 500 belgidan uzun → rad etiladi.

### 4.2 Servis

`IRequisitionAllowanceService` / `RequisitionAllowanceService`:
- `GetAllAsync()` → tarix.
- `CreateAsync(dto, userId)` → yangi yozuv.
- `GetCurrentPercentAsync()` → amaldagi foiz (yozuv bo'lmasa `0`). `RequisitionService`
  shu metoddan foydalanadi.

`ApplicationDependencyInjection` da ro'yxatdan o'tkaziladi.

### 4.3 Talabnoma yaratish

`RequisitionCreateDto.AllowancePercent` — `decimal?`, klient qo'llagan foiz.

`RequisitionService.CreateAsync`:
1. `Type != Contract` yoki `AllowancePercent` `null`/`0` → zaxirasiz yo'l; saqlanadigan
   `AllowancePercent = null`.
2. Aks holda amaldagi foiz bazadan olinadi:
   - amaldagi foiz `0` yoki klient qiymatiga teng emas → xato:
     `"Zaxira foizi o'zgargan (hozir {amaldagi}%) — zaxirani yangi foiz bilan qayta yoqing."`
   - teng → me'yor tekshiruvi zaxira bilan bajariladi.
3. `ValidateItemsAgainstCostNormAsync` / `MatchesNorm` / `LineMatchesItem` ga foiz
   parametri qo'shiladi (`decimal? percent`): kutilgan miqdor
   `percent is null ? TotalQty × son : NormAllowance.Apply(TotalQty × son, unit, percent)`.
   Tolerans hozirgidek.
4. Muvaffaqiyatli bo'lsa `Requisition.AllowancePercent` ga amaldagi foiz yoziladi.

Foiz hisob-kitobda **faqat bazadan** olinadi — klient qiymati faqat moslikni tekshirish
uchun.

### 4.4 Yordamchi — `Application/Helpers/NormAllowance.cs`

```csharp
public static class NormAllowance
{
    public static decimal Apply(decimal qty, string? unit, decimal percent);
    public static bool IsPieceUnit(string? unit);
}
```

### 4.5 Javob DTO'lari

`RequisitionResponseDto.AllowancePercent` va `RequisitionListDto.AllowancePercent`
(`decimal?`) — mapping'larga qo'shiladi.

## 5. Frontend

### 5.1 `lib/requisitionAllowance.ts`

- `getAllowanceRates()`, `createAllowanceRate({ percent, note })` — `api` orqali,
  `res.data.result`.
- `applyAllowance(qty: string, unit: string, percent: number): string` — §1 qoidasi;
  aniq o'nlik uchun `mulDecimalStr`, `шт/дона` uchun eng yaqin butun songa yaxlitlash
  (yaxlitlash aniq o'nlik natijadan olinadi — suzuvchi nuqta xatosi `1030 → 1031`
  bermasligi uchun).
- `isPieceUnit(unit)` — backend bilan bir xil ro'yxat.

`lib/userService.ts`: `RequisitionCreate` interfeysiga `allowancePercent?: number | null`;
talabnoma javob va ro'yxat tiplariga `allowancePercent: number | null`.

### 5.2 Talabnoma yaratish — `requisitions/print/page.tsx`

- Sahifa ochilganda amaldagi foiz yuklanadi (`getAllowanceRates()[0]?.percent`).
- `applyNormRows` har qatorga asosiy miqdorni (`baseQuantity` = `TotalQty × son`) ham
  yozadi.
- Asboblar panelida (normDept chipi yonida, faqat me'yordan to'ldirilgan va foiz > 0
  bo'lsa) **"+3% zaxira"** toggle-chip. Standart — o'chiq. Bosilganda faqat qatorlarning
  `quantity` si `baseQuantity` dan qayta hisoblanadi — `spec`/`notes` saqlanadi.
- Me'yor qayta to'ldirilganda toggle holati saqlanadi va yangi qatorlarga qo'llanadi.
- Yuborishda toggle yoqilgan bo'lsa `allowancePercent` yuboriladi.
- "Zaxira foizi o'zgargan" xatosi kelsa — toast, foiz qayta yuklanadi, toggle o'chiriladi
  va qatorlar asosiy miqdorga qaytariladi.
- Foiz 0 yoki yuklanmasa — toggle ko'rinmaydi; talabnoma zaxirasiz yaratiladi.
- Toggle `no-print` — qog'ozga chiqmaydi.

### 5.3 Talabnomani ko'rish

`requisitions/[id]/page.tsx` va `RequisitionDrawer.tsx` — `allowancePercent` bo'lsa
sarlavhada `+{foiz}% zaxira` badge (`--warn-dim` / `--warn`, mono raqam).

### 5.4 Foizni boshqarish — `requisitions/page.tsx` + `AllowanceModal.tsx`

- Sahifa sarlavhasidagi amallar qatorida `Zaxira: 3%` chipi (hamma ko'radi).
- Bosilganda `requisitions/_components/AllowanceModal.tsx` (`TariffModal` namunasida):
  - amaldagi foiz (katta, mono);
  - tarix jadvali: sana · foiz · izoh · kim;
  - forma (foiz + izoh + Saqlash) — faqat `hasPermission("RequisitionAllowance.Update")`.
- Saqlangandan keyin tarix va chip yangilanadi.

### 5.5 i18n

Barcha yangi UI satrlari `t("...")` ga o'raladi va `lib/i18n/ru.ts` ga ruscha tarjimasi
qo'shiladi. Foizli matnlar raqam + tarjima qilingan so'zdan yig'iladi:
`` `+${percent}% ${t("zaxira")}` ``, `` `${t("Zaxira")}: ${percent}%` ``.

Rollar sahifasidagi modul nomi ("Talabnoma zaxirasi") backend `Display(Name)` dan
keladi va boshqa modullar kabi tarjima qilinmaydi (backend ma'lumoti).

## 6. Xatolar

| Holat | Natija |
|---|---|
| Zaxirali, lekin miqdorlar aniq me'yorda | 400, mavjud "me'yoriy sarfiga mos emas" xatosi |
| Klient foizi ≠ amaldagi | 400, "Zaxira foizi o'zgargan (hozir X%)..." |
| Amaldagi foiz 0, klient foiz yubordi | 400, xuddi yuqoridagi xato (hozir 0%) |
| Individual talabnoma + foiz | xato emas; `AllowancePercent = null` saqlanadi |
| Ruxsatsiz POST | 403 (`HasPermission`) |
| Noto'g'ri foiz (oraliq/kasr/teng) | 400, §4.1 xabarlari |

## 7. Testlar

Backend (`Back/test/Application.Tests`, TDD):

- `NormAllowanceTests`:
  - кг: `75, 3%` → `77.25`; `416.625, 3%` → `429.1238`; `0.00021, 0%` → `0.0003`;
  - шт: `14, 3%` → `14`; `17, 3%` → `18`; `1000, 3%` → `1030`;
  - me'yordan kam emas: `1.4 шт, 3%` → `1.4`;
  - `дона`, `" ШТ. "`, `қути`, `пакет`, `тўплам` — eng yaqin butun songa yaxlitlanadi;
  - `0%` → o'zgarmaydi.
- `RequisitionAllowanceServiceTests`:
  - tarix yangidan eskiga;
  - `-1`, `20.01`, `3.125` rad etiladi;
  - amaldagiga teng foiz rad etiladi;
  - to'g'ri foiz yoziladi, `CreatedByUserId` saqlanadi;
  - yozuv yo'q bo'lsa `GetCurrentPercentAsync` → `0`.
- `RequisitionServiceTests` (shartnoma + me'yor fixture bilan):
  - zaxirasiz, aniq me'yor → yaratiladi, `AllowancePercent = null`;
  - zaxira bilan, to'g'ri miqdor → yaratiladi, `AllowancePercent = 3`;
  - zaxira bilan, `шт` eng yaqin butun songa yaxlitlangan miqdor → yaratiladi;
  - zaxira bilan, `шт` yaxlitlanmagan miqdor (14 → 14,42) → rad etiladi;
  - zaxira so'ralgan, miqdor aniq me'yor → rad etiladi;
  - klient foizi 3, amaldagi 5 → "Zaxira foizi o'zgargan" xatosi;
  - individual talabnoma + foiz → `AllowancePercent = null`;
  - ombor tekshiruvidan keyin `-W`/`-P` bola talabnomalar parent foizini oladi.

Frontend: `tsc --noEmit` va lint.

Qo'lda (brauzer):
- toggle yoqish/o'chirish — miqdorlar va izohlar;
- zaxira bilan yuborish → detail sahifada badge;
- ruxsat bilan foizni o'zgartirish → tarixda yozuv;
- ruxsatsiz foydalanuvchida forma ko'rinmaydi, POST → 403.

## 8. Doiradan tashqari

- Material turi yoki birligiga qarab turli foizlar.
- Blankka alohida "Me'yor / Zaxira" ustunlari.
- Ishlatilmagan zaxirani omborga qaytarish (`Return` harakati) — alohida vazifa.
- Brak uchun "qo'shimcha talabnoma" oqimi.
