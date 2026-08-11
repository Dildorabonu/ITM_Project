# Energiya monitoringi — dizayn

**Sana:** 2026-08-11
**Sahifa:** `/meter-data` ("Hisoblagichlar")

## Muammo

Hozirgi `/meter-data` sahifasi bitta qurilmaning oxirgi 100 ta xom o'lchovini ko'rsatadi:
jonli jadval va 4 ta line chart (U, I, P, f). Yetishmayotgani:

- **Umumiy manzara yo'q** — barcha qurilmalar bo'yicha jami sarf ko'rinmaydi.
- **Energiya (kWh) hisoblanmaydi** — faqat lahzalik quvvat (W) ko'rsatiladi.
- **Pul hisobi yo'q** — sarflangan energiya qancha so'm turgani noma'lum.
- **Ko'p qurilmaga tayyor emas** — Modbus poller konfigda faqat 1 ta qurilmani o'qiydi,
  yaqin kelajakda 20 tadan oshadi.

## Maqsad

`/meter-data` sahifasini **umumiy energiya paneli**ga aylantirish: barcha qurilmalar
bo'yicha sarf va xarajat, qurilma kartasi bosilganda o'sha qurilmaning batafsil
ko'rinishi. Backend tomonda kWh agregatsiyasi, tarif tarixi va ko'p qurilmali poller.

---

## 1. Ma'lumot modeli va agregatsiya

### 1.1 Nega rollup kerak

Energiya — quvvatning vaqt bo'yicha integrali. O'lchovlar har 3 soniyada keladi:
20 qurilma × 30 kun ≈ **17 mln qator**. Har dashboard so'rovida bu hajmni skanerlash
qabul qilib bo'lmas darajada sekin.

### 1.2 Jadvallar

| Jadval | Mazmuni | Kim yozadi |
|---|---|---|
| `MeterReadings` (mavjud) | Xom o'lchovlar, ~3 soniyada bitta | `MeterPollerService` |
| `MeterEnergyHourly` (yangi) | Qurilma × soat kesimida agregat | `EnergyRollupService` (yangi) |

**`MeterEnergyHourly` maydonlari:**

| Maydon | Tur | Izoh |
|---|---|---|
| `Id` | `Guid` | PK |
| `DeviceName` | `string` | |
| `HourUtc` | `DateTime` | Soat boshi (UTC), daqiqa/soniya = 0 |
| `Kwh` | `double` | Shu soatda sarflangan energiya |
| `AvgPowerW` | `double` | O'rtacha aktiv quvvat |
| `PeakPowerW` | `double` | Maksimal aktiv quvvat |
| `MinPowerW` | `double` | Minimal aktiv quvvat |
| `AvgVoltage` | `double` | O'rtacha kuchlanish (A faza) |
| `SampleCount` | `int` | Shu soatdagi xom yozuvlar soni |
| `UpdatedAt` | `DateTime` | Oxirgi qayta hisoblangan vaqt |

Unique indeks: `(DeviceName, HourUtc)`.

### 1.3 kWh formulasi

Har ketma-ket ikki o'lchov orasidagi energiya = `ActivePower × Δt`:

```
kWh = Σ ( P_i × min(Δt_i, 60) ) / 3 600 000        // W·s → kWh
Δt_i = (t_i − t_{i−1}) soniyada
```

`Δt` **60 soniya bilan cheklanadi** — qurilma uzilib qolsa (masalan 3 soat jim tursa)
bo'shliq energiyani soxta ravishda shishirmaydi.

**Hisob C# tomonda bajariladi**, raw SQL emas:

- Bitta soatlik oyna kichik (~1200 qator/qurilma), xotiraga o'qish arzon.
- `LAG`/`date_trunc` PostgreSQL'ga xos — test loyihasi InMemory/SQLite provayderda
  ishlaydi, raw SQL u yerda tarjima qilinmaydi.
- Yagona kod yo'li: bir xil funksiya ham rollup uchun, ham joriy soatni hisoblash
  uchun ishlatiladi (§4.2).

Toza funksiya: `EnergyMath.ComputeKwh(samples, maxGapSeconds: 60)`.

### 1.4 `EnergyRollupService`

Yangi `BackgroundService`:

- **Har 5 daqiqada** oxirgi **2 soat**ni qayta hisoblab upsert qiladi (idempotent —
  joriy tugallanmagan soat ham to'g'ri yangilanib boradi).
- **Startda** eng erta xom yozuvdan hozirgacha bo'lgan **yetishmayotgan soatlar**ni
  to'ldiradi (backfill), 24 soatlik bo'laklar bilan, log yozib.
- Xato bo'lsa log qilib keyingi tsiklga o'tadi — servis to'xtamaydi.

### 1.5 Indekslar

`MeterReadings` da kerakli kompozit indeks **allaqachon mavjud**
(`MeterReadingConfiguration`: `HasIndex(x => new { x.DeviceName, x.CreatedAt })`) —
qo'shimcha ish talab qilinmaydi.

Yangi `MeterEnergyHourly` uchun unique indeks: `(DeviceName, HourUtc)`.

---

## 2. Tarif (narx) tizimi

### 2.1 Entity `EnergyTariff`

| Maydon | Tur | Izoh |
|---|---|---|
| `Id` | `Guid` | PK |
| `PricePerKwh` | `decimal(18,2)` | 1 kVt·soat narxi |
| `Currency` | `string` | Default `"so'm"` |
| `EffectiveFrom` | `DateTime` | Shu sanadan boshlab amal qiladi (UTC) |
| `Note` | `string?` | Masalan: "Yuridik shaxslar, 1-iyun 2026" |
| `CreatedAt` | `DateTime` | |
| `CreatedByUserId` | `Guid?` | Kim kiritgani |

Indeks: `EffectiveFrom` bo'yicha.

### 2.2 Tarix bilan hisoblash

Xarajat har **soatlik bucket** darajasida hisoblanadi: bucket vaqtiga mos keluvchi
tarif = `EffectiveFrom <= bucket` shartini qanoatlantiruvchi eng kech tarif.
Tariflar kam bo'lgani uchun hammasi xotiraga o'qilib, C# tomonda mos keladigani
tanlanadi.

Agar bucket hech qanday tarifdan oldin bo'lsa — eng erta tarif qo'llaniladi
(narx `0` chiqmasligi uchun).

### 2.3 Seed

`AutomatedMigration` da: agar `EnergyTariffs` bo'sh bo'lsa —
`1100 so'm/kWh`, `EffectiveFrom = 2026-06-01`, izoh:
`"Yuridik shaxslar uchun tarif (2026-yil 1-iyundan)"`.

Manba: 2026-yil 1-iyundan yuridik shaxslar uchun 1 kVt·soat = 1 100 so'm.

### 2.4 Permission

Yangi `PermissionModule.Energy = 17`, Display: `"Elektr energiya"`, icon `"zap"`.

`AutomatedMigration.ModuleActions` ga: `[PermissionAction.Update]`.

| Endpoint | Himoya |
|---|---|
| Barcha `GET` (meter-data, summary, tariflar ro'yxati) | `[Authorize]` — **hozirgidek**, hech kim kirishdan mahrum bo'lmaydi |
| `POST`/`PUT`/`DELETE /api/energy-tariffs` | `[HasPermission("Energy.Update")]` |

Frontendda "Tarif" tahrirlash tugmasi faqat `hasPermission("Energy.Update")` bo'lsa
ko'rinadi. Superadmin barcha permissionlarni avtomatik oladi
(`SeedSuperAdminPermissionsAsync`).

Nav menyudagi "Hisoblagichlar" elementi **permissionsiz** qoladi (hozirgidek).

---

## 3. Ko'p qurilmali poller

### 3.1 Konfiguratsiya

`MeterPollerOptions` ga `Devices` massivi qo'shiladi:

```json
"MeterPoller": {
  "Enabled": true,
  "IntervalSeconds": 3,
  "Devices": [
    { "Name": "DR134", "Ip": "192.168.30.222", "Port": 502, "SlaveId": 1,
      "StartAddress": 100, "RegisterCount": 55, "PtRatio": 1.0, "Enabled": true }
  ]
}
```

**Backward compatibility:** agar `Devices` bo'sh, lekin eski yakka `Ip`/`DeviceName`
maydonlari to'ldirilgan bo'lsa — ular bitta elementli massivga aylantiriladi.
Mavjud `appsettings.json` o'zgarishsiz ishlashda davom etadi.

Har qurilma ixtiyoriy `IntervalSeconds` bilan global qiymatni override qila oladi.

### 3.2 `MeterPollerService`

Har qurilma uchun **alohida parallel loop** (`Task.WhenAll` bilan). Har biri o'z
`TcpClient`/`IModbusMaster` ulanishini saqlaydi va mustaqil qayta ulanadi — bitta
qurilma uzilsa boshqalari ta'sirlanmaydi. Loglarda qurilma nomi ko'rsatiladi.

### 3.3 Qurilmalar ro'yxati

`GET /api/meter-data/devices` endi konfigdagi qurilmalar **∪** bazada uchragan
`DeviceName`larni qaytaradi — hech qachon ma'lumot yubormagan qurilma ham ro'yxatda
"Offline" holatida ko'rinadi.

Javob boyitiladi:

```ts
{ name, isOnline, lastSeen, lastPowerW, isConfigured }
```

**Onlayn mezoni:** oxirgi yozuv `max(3 × IntervalSeconds, 30s)` ichida kelgan bo'lsa.

---

## 4. API

### 4.1 Yangi/o'zgargan endpointlar

```
GET  /api/meter-data                       — o'zgarishsiz (xom yozuvlar jadvali)
GET  /api/meter-data/devices               — status bilan boyitilgan (3.3)
GET  /api/meter-data/summary?period=…      — umumiy panel ma'lumoti
GET  /api/meter-data/summary/{device}?…    — bitta qurilma detali

GET    /api/energy-tariffs                 — [Authorize]
POST   /api/energy-tariffs                 — [HasPermission("Energy.Update")]
PUT    /api/energy-tariffs/{id}            — [HasPermission("Energy.Update")]
DELETE /api/energy-tariffs/{id}            — [HasPermission("Energy.Update")]
```

### 4.2 Gibrid o'qish: rollup + joriy soat

Rollup servisi 5 daqiqada bir ishlaydi, ya'ni joriy (tugallanmagan) soat 5 daqiqagacha
kechikishi mumkin. Shu sababli `summary` ma'lumotni **ikki manbadan** yig'adi:

- **Tugallangan soatlar** → `MeterEnergyHourly` dan (tez)
- **Joriy soat** → har safar xom `MeterReadings` dan hisoblanadi (aniq, so'nggi
  soniyagacha; bitta soatlik oyna — arzon)

Shu tufayli "Bugun" ko'rinishi har doim so'nggi o'lchovni ham o'z ichiga oladi va
yangi bazada (rollup hali hech narsa yozmaganida) ham to'g'ri ishlaydi.

### 4.3 `period` parametri

| Qiymat | Davr | Bucket |
|---|---|---|
| `today` | Bugun 00:00 dan hozirgacha | soatlik |
| `24h` | Oxirgi 24 soat | soatlik |
| `7d` | Oxirgi 7 kun | kunlik |
| `30d` | Oxirgi 30 kun | kunlik |
| `month` | Joriy oy boshidan | kunlik |

Noto'g'ri/bo'sh qiymat → `24h`. Vaqt zonasi: bucketlar mahalliy vaqtda
(`Asia/Tashkent`, UTC+5) hisoblanadi, ma'lumot bazada UTC saqlanadi.

### 4.4 Summary javobi

```ts
{
  from, to, periodKey,
  pricePerKwh, currency,
  total: {
    kwh, cost,
    avgPowerW, peakPowerW, peakAt,
    currentPowerW,              // barcha onlayn qurilmalar oxirgi quvvati yig'indisi
    deviceCount, onlineCount
  },
  devices: [{
    deviceName, kwh, cost, sharePercent,
    avgPowerW, peakPowerW, lastPowerW, lastSeen, isOnline,
    sparkline: number[]         // bucket kWh qiymatlari, karta ichidagi mini-grafik
  }],
  series:  [{ bucket, kwh, cost }],
  byDevice:[{ deviceName, points: [{ bucket, kwh }] }]
}
```

### 4.5 Qurilma detali javobi

Summary'dagi bitta qurilma ma'lumoti + qo'shimcha:

```ts
{
  deviceName, isOnline, lastSeen,
  kwh, cost, avgPowerW, peakPowerW, peakAt,
  uptimePercent,                // kutilgan namunalar soniga nisbatan haqiqiy
  avgVoltage, minVoltage, maxVoltage,
  avgFrequency,
  series: [{ bucket, kwh, cost, avgPowerW, peakPowerW }]
}
```

Kuchlanish/chastota statistikasi har doim xom jadvaldan, **DB tomonidagi agregat
so'rov** bilan olinadi (`AVG`/`MIN`/`MAX`) — qator ko'chirilmaydi, shu sababli uzoq
davrlar uchun ham arzon va kod yagona yo'lda qoladi.

---

## 5. Frontend

### 5.1 Tuzilma

Bitta route `/meter-data`, ikki ko'rinish `useState` bilan almashadi
(`view: "overview" | { device: string }`). Detalga o'tishda `panel-appear`
animatsiyasi, `← Orqaga` tugmasi bilan qaytadi.

Fayl bo'linishi (hozirgi `page.tsx` 400 qatordan oshib ketmasligi uchun):

```
app/(main)/meter-data/
  page.tsx                    — holat, ma'lumot yuklash, ko'rinish almashinuvi
  _components/
    PeriodBar.tsx             — davr tanlash + jonli toggle + tarif chip
    KpiRow.tsx                — yuqoridagi 5 ta KPI karta
    EnergyBarChart.tsx        — stacked bar (qurilma ranglari) + xarajat
    DeviceDonut.tsx           — qurilmalar ulushi
    DeviceGrid.tsx            — qurilma kartalari (+ sparkline)
    DeviceDetail.tsx          — bitta qurilma ko'rinishi
    LiveCharts.tsx            — mavjud 4 ta line chart (ChartCard ko'chiriladi)
    ReadingsTable.tsx         — xom o'lchovlar jadvali
    TariffModal.tsx           — tarif ro'yxati va tahrirlash
lib/meterData.ts              — yangi tiplar va servis metodlari
lib/energyTariff.ts           — tarif CRUD servisi
```

### 5.2 Umumiy ko'rinish

```
┌ Davr: [Bugun][24 soat][7 kun][30 kun][Oy]  ● Jonli  ⟳  [1 100 so'm/kWh ✎]
│
├ ┌─────────┬─────────┬─────────┬─────────┬─────────┐
│ │SARFLANDI│ XARAJAT │ HOZIRGI │  PIK    │QURILMALAR│
│ │  1 284  │1,41 mln │ 42.6 kW │ 78.2 kW │  18/20  │
│ │   kWh   │  so'm   │  jonli  │ 14:20da │ onlayn  │
│ └─────────┴─────────┴─────────┴─────────┴─────────┘
│
├ ┌─ Sarf dinamikasi (stacked bar + xarajat) ──┬─ Ulush (donut) ─┐
│ │  ▁▃▅█▇▅▃▂                                  │  qurilmalar %   │
│ └────────────────────────────────────────────┴─────────────────┘
│
├ QURILMALAR   [qidiruv]  [saralash: kWh ▾]
│ ┌ DR134 ●────┬ DR201 ●────┬ DR202 ○────┐
│ │ 12.4 kW    │ 8.1 kW     │ Offline    │   ← karta bosilsa detal
│ │ 342 kWh    │ 210 kWh    │ 0 kWh      │
│ │ 376 200so'm│ 231 000so'm│ —          │
│ │ ▁▃▅█▇  27% │ ▁▂▃▄▃  16% │ ─────   0% │
│ └────────────┴────────────┴────────────┘
```

### 5.3 Qurilma detali

- **Sarlavha:** `← Orqaga` · qurilma nomi (mono) · onlayn badge · oxirgi ko'rilgan
- **KPI qatori:** kWh · xarajat · o'rtacha kW · pik kW · ish vaqti % · o'rtacha kuchlanish
- **Energiya bar chart** — davr bo'yicha soatlik/kunlik kWh + xarajat
- **Jonli line chartlar** — mavjud 4 tasi (U, I, P, f) o'zgarishsiz
- **Xom o'lchovlar jadvali** — faqat shu qurilma

### 5.4 Tarif modali

Tariflar ro'yxati (amal qilish sanasi · narx · izoh · kim kiritgan). `Energy.Update`
bo'lsa: yangi tarif qo'shish, mavjudini tahrirlash/o'chirish. Ruxsat bo'lmasa —
faqat ko'rish rejimi, tahrir tugmalari ko'rinmaydi.

### 5.5 Vizual qoidalar

- Grafiklar — **qo'lda yozilgan SVG** (yangi kutubxona qo'shilmaydi), hozirgi
  `ChartCard` uslubida: gradient area, crosshair tooltip, mono raqamlar.
- Ko'p qurilma uchun **kategorik palitra** — CSS tokenlardan olingan 8 rangli
  ketma-ketlik (`--accent`, `--success`, `--warn`, `--purple`, `--danger` va
  ularning ochiq variantlari), qurilma nomi bo'yicha barqaror tayinlanadi
  (indeks hash) — sahifa yangilanganda rang o'zgarmaydi.
- Pul formatlash: `so'm` uchun ming ajratgich bo'sh joy bilan (`1 410 400 so'm`),
  1 mln dan oshsa qisqartma (`1,41 mln so'm`) + to'liq qiymat `title` da.
- Barcha yangi matn `t()` orqali, ruscha tarjimalari `lib/i18n/ru.ts` ga qo'shiladi.
- CLAUDE.md dagi dizayn tokenlariga qat'iy amal — hardcode rang/radius yo'q.

### 5.6 Jonli yangilanish

Mavjud 5 soniyalik polling saqlanadi, lekin ikki xil tezlikda:

| Ma'lumot | Interval |
|---|---|
| Xom o'lchovlar + qurilma statuslari (jonli KPI, line chartlar) | 5 s |
| `summary` (kWh, xarajat, grafiklar) | 60 s |

Davr yoki qurilma o'zgarganda `summary` darhol qayta yuklanadi. `Jonli` toggle
ikkalasini ham to'xtatadi.

---

## 6. Xatolarni boshqarish

| Holat | Xatti-harakat |
|---|---|
| Hech qanday o'lchov yo'q | Bo'sh holat: "Hali ma'lumot kelmagan — qurilma yuborishini kuting." |
| Rollup hali ishlamagan (yangi baza) | Gibrid o'qish (4.2) tufayli joriy soat baribir xom jadvaldan chiqadi; backfill tugagach qolgan davrlar to'ladi |
| Tarif topilmadi | Eng erta tarif qo'llaniladi; hech biri bo'lmasa xarajat `null` va UI `—` ko'rsatadi |
| Qurilma offline | Kartada kulrang `○` badge, `lastSeen` "3 soat oldin", kWh o'sha davr uchun haqiqiy qiymat |
| Modbus ulanish xatosi | Log (qurilma nomi bilan), keyingi tsiklda qayta ulanish — hozirgidek |
| API xatosi | Sahifada `--danger` rangli xabar, oxirgi muvaffaqiyatli ma'lumot saqlanadi |

---

## 7. Test

- **Backend unit:** kWh formulasi (bo'shliq cheklovi 60s, bitta yozuv, bo'sh oraliq),
  tarif tanlash (bucket sanasiga mos tarif, tarifdan oldingi bucket), `period` →
  `from/to` hisoblash.
- **Backend integration:** `summary` endpointi seed qilingan o'lchovlar bilan;
  rollup servisi idempotentligi (ikki marta ishlatilganda qiymat o'zgarmasligi);
  `Energy.Update` permissionsiz tarif yozishga urinish → `403`.
- **Qo'lda:** ko'p qurilmali konfig bilan poller ishga tushishi, bitta qurilma
  o'chirilganda boshqalari ishlashda davom etishi.

---

## 8. Qamrovdan tashqarida (YAGNI)

- Qurilmalar uchun alohida DB jadval va CRUD (uchastkaga biriktirish, metadata) —
  konfiguratsiyadan yetarli
- Excel/PDF eksport
- Ogohlantirish/alert tizimi (pik quvvat oshganda bildirishnoma)
- Reaktiv quvvat, `cos φ`, B/C fazalar bo'yicha alohida tahlil
- Xom yozuvlarni arxivlash yoki tozalash siyosati
- Limitdan oshgan sarf uchun oshirilgan koeffitsient (1 800 so'm) hisobi
