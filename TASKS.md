# ITM Project — Vazifalar ro'yxati

> Oxirgi yangilanish: 2026-03-24 (TechProcess moduli to'liq bajarildi)
> Jarayon: Klient taklifi → Shartnoma → Tex protses → Norma rasxod → Ombor tekshiruvi → Zayavka

---

## Holat belgilari
- ⬜ Bajarilmagan
- 🔄 Jarayonda
- ✅ Bajarildi

---

## 1. Contracts (Shartnomalar) — Marketing bo'limi
> Klient bilan tuzilgan shartnomalarni boshqarish

### Backend
- ✅ `ContractService` interfeysi va implementatsiyasi (`IContractService`)
- ✅ `ContractController` — CRUD endpointlar
  - `GET /api/contract` — barchasi (filter: status, departmentId)
  - `GET /api/contract/{id}` — bitta
  - `POST /api/contract` — yangi shartnoma
  - `PUT /api/contract/{id}` — tahrirlash
  - `PUT /api/contract/{id}/status` — statusni o'zgartirish
  - `DELETE /api/contract/{id}` — o'chirish
- ✅ `ContractResponseDto`, `ContractCreateDto`, `ContractUpdateDto`, `ContractStatusUpdateDto`
- ✅ Permission: `Contracts` moduli `PermissionModule` enumiga qo'shildi (= 5)
- ✅ `[HasPermission]` attributlari ContractController'ga qo'shildi
- ✅ SuperAdmin avtomatik seed (AutomatedMigration orqali)

### Frontend
- ✅ `/contracts` sahifasi — shartnomalar ro'yxati (table)
- ✅ Yangi shartnoma qo'shish (inline form)
- ✅ Shartnoma detail ko'rish (side drawer)
- ✅ Status o'zgartirish modal (Draft → Active → Completed → Cancelled)
- ✅ Filter: status, bo'lim, qidiruv
- ✅ Tahrirlash va o'chirish

---

## 2. TechProcess (Texnologik jarayon) — Texnologlar
> Har bir shartnoma uchun mahsulot ishlab chiqarish texnologik jarayoni

### Backend
- ✅ `TechProcessService` interfeysi va implementatsiyasi (`ITechProcessService`)
- ✅ `TechProcessController` — CRUD + bosqichlar boshqaruvi
  - `GET /api/techprocess` — barchasi
  - `GET /api/techprocess/{id}` — bitta (steps va materials bilan)
  - `GET /api/techprocess/by-contract/{contractId}` — shartnoma bo'yicha
  - `POST /api/techprocess` — yangi
  - `PUT /api/techprocess/{id}` — tahrirlash
  - `PUT /api/techprocess/{id}/approve` — tasdiqlash
  - `POST /api/techprocess/{id}/steps` — qadam qo'shish
  - `PUT /api/techprocess/{id}/steps/{stepId}` — qadam tahrirlash
  - `DELETE /api/techprocess/{id}/steps/{stepId}` — qadam o'chirish
  - `POST /api/techprocess/{id}/materials` — material qo'shish
  - `DELETE /api/techprocess/{id}/materials/{materialId}` — material o'chirish
  - `PUT /api/techprocess/{id}/send-to-warehouse` — omborga yuborish
  - `DELETE /api/techprocess/{id}` — o'chirish
- ✅ DTOlar: `TechProcessCreateDto`, `TechProcessUpdateDto`, `TechStepCreateDto`, `TechStepUpdateDto`, `TechProcessMaterialCreateDto`, response DTOlar
- ✅ Permission: `TechProcess` moduli `PermissionModule` enumiga qo'shildi
- ✅ EF Core konfiguratsiyasi va migration (`AddTechProcessModule`)

### Frontend
- ✅ `/techprocess` sahifasi — jarayonlar ro'yxati (contracts dizayni bilan)
- ✅ Yangi texnologik jarayon yaratish (shartnomaga bog'lash)
- ✅ Qadamlar (TechStep) qo'shish/o'chirish
- ✅ Materiallar ro'yxati qo'shish/o'chirish
- ✅ "Omborga yuborish" tugmasi
- ✅ Tasdiqlash workflow (approve)

---

## 3. CostNorm (Norma Rasxod) — Buxgalterlar ⚠️ YANGI MODUL
> Mahsulot ishlab chiqarish uchun umumiy sarf-xarajatlar normasi

### Backend
- ⬜ `CostNorm` entity yaratish:
  - id, contractId, techProcessId
  - materialCost, laborCost, overheadCost, totalCost
  - approvedBy, approvedAt, status, notes, createdAt
- ⬜ EF Core konfiguratsiyasi va migration
- ⬜ `CostNormService` interfeysi va implementatsiyasi
- ⬜ `CostNormController`
  - `GET /api/costnorm/by-contract/{contractId}`
  - `POST /api/costnorm` — yangi norma rasxod
  - `PUT /api/costnorm/{id}` — tahrirlash
  - `PUT /api/costnorm/{id}/approve` — tasdiqlash
- ⬜ DTOlar

### Frontend
- ⬜ Norma rasxod sahifasi (yoki TechProcess ichida tab sifatida)
- ⬜ Xarajat kiritish formasi (material, mehnat, umumiy)
- ⬜ Tasdiqlash workflow

---

## 4. Warehouse / Material (Ombor) — Omborchi
> Materiallar zaxirasi va harakati

### Backend
- ⬜ `MaterialService` interfeysi va implementatsiyasi
- ⬜ `MaterialController`
  - `GET /api/material` — barchasi (filter: category, status)
  - `GET /api/material/{id}`
  - `POST /api/material` — yangi material
  - `PUT /api/material/{id}` — tahrirlash
  - `DELETE /api/material/{id}`
  - `GET /api/material/check-availability` — mavjudlik tekshiruvi (techProcessId bo'yicha)
- ⬜ `StockController`
  - `POST /api/stock/in` — kiruvchi tovar
  - `POST /api/stock/out` — chiquvchi tovar
  - `GET /api/stock/history/{materialId}` — harakat tarixi
- ⬜ DTOlar

### Frontend
- ⬜ `/warehouse` sahifasi — materiallar ro'yxati
- ⬜ `/inventory` sahifasi — inventar ko'rish
- ⬜ Kirim/chiqim qayd etish
- ⬜ Tex protses bo'yicha mavjudlik tekshiruvi ko'rsatish

---

## 5. Requisition (Zayavka) — Omborchi → Birja ⚠️ YANGI MODUL
> Yetishmayotgan materiallar uchun so'rov

### Backend
- ⬜ `Requisition` entity yaratish:
  - id, contractId, techProcessId, materialId
  - requiredQty, availableQty, deficitQty
  - status (Draft, Sent, Approved, Fulfilled)
  - sentTo (birja/supplier nomi)
  - createdBy, sentAt, fulfilledAt, notes, createdAt
- ⬜ EF Core konfiguratsiyasi va migration
- ⬜ `RequisitionService` interfeysi va implementatsiyasi
- ⬜ `RequisitionController`
  - `GET /api/requisition` — barchasi
  - `GET /api/requisition/by-contract/{contractId}`
  - `POST /api/requisition` — yangi zayavka
  - `POST /api/requisition/auto-generate/{techProcessId}` — tex protses bo'yicha avtomatik
  - `PUT /api/requisition/{id}/send` — birjaga yuborish
  - `PUT /api/requisition/{id}/fulfill` — bajarildi deb belgilash
- ⬜ DTOlar

### Frontend
- ⬜ `/deficit` sahifasi — yetishmovchiliklar ro'yxati
- ⬜ Avtomatik zayavka generatsiyasi
- ⬜ Zayavkani birjaga yuborish
- ⬜ Status kuzatuvi

---

## 6. Tasks (Vazifalar)
> Xodimlarga topshiriqlar berish

### Backend
- ⬜ `TaskService` interfeysi va implementatsiyasi
- ⬜ `TaskController`
  - `GET /api/task` — barchasi (filter: status, departmentId, assignedTo)
  - `GET /api/task/{id}`
  - `POST /api/task` — yangi vazifa
  - `PUT /api/task/{id}` — tahrirlash
  - `PUT /api/task/{id}/status` — status o'zgartirish
  - `DELETE /api/task/{id}`
- ⬜ DTOlar

### Frontend
- ⬜ `/tasks` sahifasi — vazifalar ro'yxati
- ⬜ Yangi vazifa qo'shish
- ⬜ Status o'zgartirish (Pending → InProgress → Done)

---

## 7. Notifications (Bildirishnomalar)
> Jarayon o'tishlarida avtomatik xabarnomalar

### Backend
- ⬜ `NotificationService` interfeysi va implementatsiyasi
- ⬜ `NotificationController`
  - `GET /api/notification` — joriy foydalanuvchi uchun
  - `PUT /api/notification/{id}/read` — o'qildi
  - `PUT /api/notification/read-all` — hammasini o'qildi
  - `DELETE /api/notification/{id}`
- ⬜ Avtomatik notification trigger qilish:
  - Shartnoma Active bo'lganda → Texnolog xabardor bo'lsin
  - TechProcess omborga yuborilganda → Omborchi xabardor bo'lsin
  - Zayavka yuborilganda → Mas'ul xabardor bo'lsin

### Frontend
- ⬜ `/notifications` sahifasi
- ⬜ Header'da notification bell (o'qilmagan soni)
- ⬜ Real-time yoki polling

---

## Umumiy / Infratuzilma
- 🔄 `PermissionModule` enumiga yangi modullar qo'shish — Contracts ✅, TechProcess ✅, qolganlar ⬜
- ⬜ Swagger/OpenAPI hujjatlashtirish
- ✅ Frontend API service fayllari — `contractService`, `techProcessService`, `materialService` (`userService.ts`)
- ⬜ Frontend Zustand store yangilash

---

## Bajarish tartibi (tavsiya)

```
1. Contracts      → asosiy kalit, boshqalar shunga bog'liq
2. TechProcess    → shartnomadan keyin
3. Warehouse      → tex protses materiallarini tekshirish uchun
4. CostNorm       → tex protses bilan parallel
5. Requisition    → ombor tekshiruvidan keyin
6. Tasks          → istalgan payt
7. Notifications  → oxirida, trigger qiluvchi modullar tayyor bo'lgach
```
