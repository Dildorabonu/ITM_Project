# Talabnoma nomini qo'lda kiritish (dizayn)

Sana: 2026-08-06

## Muammo

Talabnoma nomi backendda o'zbek lotin yozuvida avtomatik yasaladi
(`"{ContractNo} shartnoma talabnomasi"` / `"{Bo'lim} bo'lim talabnomasi"`) va DB ga
matn sifatida qotib yoziladi. Xodimlarning bir qismi kirill yozuvini afzal ko'radi,
saytda rus tili ham bor — natijada avtomatik nom ular uchun noqulay.

Ko'rib chiqilgan muqobillar:

1. **Nomni tildan ajratish** (DB da bo'laklar, ekranda `t()` bilan yig'ish) — migration,
   qidiruv o'zgarishi, PDF nomi foydalanuvchiga qarab farq qiladi.
2. **Yaratuvchi tilida qotirish** — arzon, lekin kirill masalasini yechmaydi va ro'yxatni
   aralash tillarga bo'lib yuboradi.
3. **Kirill transliteratsiya qatlami** — butun saytni qamraydi, lekin transliteratsiya
   aniqligi va ikki yozuvli qidiruv muammosini keltiradi.

**Tanlangan yechim:** nomni foydalanuvchining o'zi kiritishi. Backend buni allaqachon
qo'llab-quvvatlaydi (`RequisitionCreateDto.RequisitionNo` ixtiyoriy), shuning uchun
transliteratsiya, migration va template i18n keraksiz. Kim kirillda yozmoqchi — kirillda
yozadi, kim ruscha — ruscha.

## Qarorlar

| Savol | Qaror |
|---|---|
| Maydon shakli | Avtomatik **to'ldirilgan, tahrirlanadigan** input (bo'sh yoki majburiy emas) |
| Takroriy nom | Backend jimgina ` (2)`, ` (3)` qo'shadi — xatolik qaytarmaydi |
| Default nom tili | UI tiliga ergashadi (`t()` orqali yasaladi) |
| DB sxemasi | O'zgarmaydi — migration yo'q |

## Dizayn

### 1. Frontend — nom maydoni

Fayl: `client/app/(documents)/requisitions/print/page.tsx` (blank talabnoma sahifasi —
talabnoma shu yerda yaratiladi).

Mavjud `autoReqName` memo'si (109-116 qatorlar) saqlanadi, lekin ikkita o'zgarish bilan:

- ichidagi ikkita ibora `t("shartnoma talabnomasi")` / `t("bo'lim talabnomasi")` ga o'raladi,
  shunda rus rejimida default nom ham ruscha chiqadi;
- u endi to'g'ridan-to'g'ri ishlatilmaydi, balki tahrirlanadigan `reqName` state'ining
  manbasi bo'ladi.

Yangi holat:

```
const [reqName, setReqName]       — ko'rsatiladigan/yuboriladigan nom
const [nameTouched, setNameTouched] — foydalanuvchi maydonga teginganmi
```

`nameTouched === false` bo'lganda `reqName` `autoReqName` bilan sinxron turadi — ya'ni
shartnoma yoki bo'lim almashtirilsa nom ham yangilanadi. Foydalanuvchi bir marta yozgandan
keyin tizim maydonga tegmaydi. Bu naqsh loyihada allaqachon bor
(`CostNormA4Sheet.tsx` — `autoNamed`).

UI: toolbar'ning yuqori qatori bilan tugmalar qatori orasiga yangi qator qo'shiladi —
label + input + o'ng tomonda holat ko'rsatkichi. Foydalanuvchi nomni o'zgartirgan bo'lsa,
holat o'rnida "Avtomatik nom" tugmasi chiqadi va `nameTouched` ni qaytadan `false` qiladi.

Chegaralar: `maxLength = 190` (backend ustuni 200, ` (12)` suffiksi uchun 10 zaxira).

Yuborishda: `requisitionNo: reqName.trim() || undefined`. Bo'sh qolsa backend hozirgidek
o'zi yasaydi — xavfsizlik to'ri.

`handleClear` nomni ham tozalaydi (`setReqName("")`, `setNameTouched(false)`).

### 2. Frontend — PDF fayl nomi

`page.tsx:769` da PDF fayl nomi `[^A-Za-z0-9_-]` belgilarni olib tashlaydi. Kirill yoki
ruscha nomda natija bo'sh/faqat pastki chiziqlardan iborat bo'lib qoladi. Sanitizatsiyadan
keyin harf-raqam qolmasa `"talabnoma"` fallback ishlatiladi.

### 3. Backend — takrorlanishni bir joyga yig'ish

Fayl: `Back/src/Application/Services/Impl/RequisitionService.cs`

Hozir qo'lda berilgan nom band bo'lsa `Failure` qaytadi (206-216 qatorlar), avtomatik nom
esa ` (2)` qo'shadi (296-312). Ikkala yo'l bitta yordamchiga birlashtiriladi:

```
EnsureUniqueRequisitionNoAsync(string baseName) -> string
```

— `GenerateRequisitionNoAsync` ichidagi "bo'sh tartib raqamini topish" qismi shu metodga
ko'chiriladi va uzunlik chegarasi (`RequisitionNoMaxLength - RequisitionNoSuffixReserve`)
ham shu yerda qo'llaniladi. `CreateAsync` qo'lda kelgan nomni ham shu metoddan o'tkazadi.

### 4. i18n

Yangi UI satrlari `client/lib/i18n/ru.ts` ga qo'shiladi: `"Talabnoma nomi"`,
`"shartnoma talabnomasi"`, `"bo'lim talabnomasi"`, `"Avtomatik nom"`,
`"Manba hujjatdan olindi"`, input placeholder'i.

## Ta'sir doirasi

O'zgaradi: `print/page.tsx`, `lib/i18n/ru.ts`, `RequisitionService.cs`,
`RequisitionServiceTests.cs`.

Tegilmaydi: DB sxemasi, migration, ro'yxat/drawer/detal sahifalari, PDF generatori,
bildirishnomalar — ular baribir tayyor `requisitionNo` matnini o'qiydi.

## Testlar

`CreateAsync_DuplicateRequisitionNo_ReturnsFailure` ma'nosi o'zgaradi: takroriy nom endi
xato emas, ` (2)` bilan saqlanadi. Test shunga mos qayta yoziladi. Qo'shimcha:

- qo'lda kirill nom berilsa o'zgarishsiz saqlanadi;
- nom bo'sh yuborilsa avtomatik yasash ishlaydi (regressiya).

## Cheklov

Bu yechim **talabnoma nomini** hal qiladi, saytning umumiy kirill masalasini emas — menyu,
bo'lim va mahsulot nomlari lotinda qoladi. Agar xodimlar butun interfeysni kirillda
o'qishni so'rasa, yuqoridagi 3-variant (transliteratsiya qatlami) alohida ish sifatida
ko'rib chiqiladi.
