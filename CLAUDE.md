# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ITM Factory System** — ishlab chiqarish va ombor boshqaruv tizimi. Full-stack loyiha:
- **Backend**: .NET 8, Clean Architecture, PostgreSQL, EF Core, JWT auth
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Zustand, Axios

## Running the Project

**Backend** (`http://localhost:5223`, Swagger: `http://localhost:5223/swagger`):
```bash
cd Back/src/API
dotnet run
```

**Frontend** (`http://localhost:3000`):
```bash
cd client
npm run dev
```

**Environment**: `client/.env.local` — `NEXT_PUBLIC_API_URL=http://localhost:5223`

## Backend Architecture

Clean Architecture, 4 project layers (`Back/src/`):

| Layer | Description |
|---|---|
| `Core` | Domain: Entities, Enums. No dependencies on other layers. |
| `DataAccess` | EF Core `DatabaseContext`, Migrations. Depends on Core. |
| `Application` | Service interfaces (`IXxxService`) + `Impl/` implementations, DTOs, Helpers. |
| `API` | Controllers, JWT setup, Permission authorization, `Program.cs`. |

**DI registration**: `ApplicationDependencyInjection.cs` va `DataAccessDependencyInjection.cs` extension metodlari orqali.

**API response pattern**: barcha controller javoblari `{ result: ... }` formatida — frontendda `res.data.result` bilan olinadi.

**File uploads**: `/uploads` endpoint orqali statik fayl sifatida serve qilinadi (`Back/src/API/uploads/` papkasi).

## Permission System

Permissions `PermissionModule` × `PermissionAction` kombinatsiyasi: `"Contracts.View"`, `"Users.Create"`, va h.k.

**Backend** — controller metodiga qo'yiladi:
```csharp
[HasPermission("Contracts.View")]
```

**Frontend** — `useAuthStore` dan:
```ts
const hasPermission = useAuthStore(s => s.hasPermission);
hasPermission("Contracts.View");         // aniq permission
hasModulePermission("Contracts");        // moduldan birontasi bo'lsa
```

JWT tokenida permissions `"perm"` claim sifatida keladi (array yoki string).

## Frontend Architecture

**State management**:
- `lib/store/authStore.ts` — Zustand + persist (`localStorage: "itm_auth"`). Foydalanuvchi ma'lumotlari, tokenlar, permission tekshirish metodlari.
- `lib/store/toastStore.ts` — global toast bildirishnomalar.

**API client** (`lib/api.ts`): Axios instance, request interceptor-da `itm_auth` dan token oladi, 401 da refresh token bilan avtomatik yangilaydi.

**Layout** (`app/layout.tsx`): `"use client"` root layout. Sidebar, topbar, dark mode, accent color, font/radius — hammasi shu faylda. Yangi route `readyRoutes` setiga qo'shilmasa "Tez kunda" overlay ko'rsatiladi.

**Notifications**: har 30 sekundda polling, o'qilganda `window.dispatchEvent(new Event("notif-read"))` chaqiriladi.

**Shared components** (`app/_components/`): `CheckSelect`, `ConfirmModal`, `ToastContainer`.

## Typography (Shriftlar)

Fontlar `app/layout.tsx` da Next.js `next/font/google` orqali yuklanadi:

| CSS o'zgaruvchi | Font | Ishlatilishi |
|---|---|---|
| `--font-inter` | Inter | Asosiy body va heading shrift |
| `--font-mono` | Roboto Mono | Kod, badge, raqamlar |

**Utility klasslar** (`globals.css`):
- `.font-head-itm` — sarlavhalar uchun (Inter)
- `.font-body-itm` — asosiy matn uchun (Inter)

`body` default: `font-size: 14px`, `font-family: Inter`. Foydalanuvchi `appearance_scale` (50–150) bilan font o'lchamini, `appearance_font` bilan esa familiyani o'zgartira oladi — bu `applyAppearanceFont()` orqali `body.style` ga to'g'ridan-to'g'ri yoziladi.

## Appearance (Tashqi ko'rinish) Tizimi

Tashqi ko'rinish sozlamalari `localStorage` da saqlanadi va sahifa yuklanishida `app/layout.tsx` da qo'llaniladi:

| `localStorage` kalit | Qiymat | Funksiya |
|---|---|---|
| `theme` | `"dark"` \| `"light"` | Dark/light mode |
| `appearance_accent` | HEX rang (`#1a6eeb`) | `applyAppearanceAccent()` |
| `appearance_radius` | `"small"` \| `"medium"` \| `"large"` | `applyAppearanceRadius()` |
| `appearance_font` | Font family nomi | `applyAppearanceFont()` |
| `appearance_scale` | Raqam (50–150) | `applyAppearanceFont()` |

**`applyAppearanceAccent(hex)`** — bitta hex rangdan avtomatik 6 ta CSS token hisoblaydi:
```
--accent, --accent2 (82%), --accent3 (62%), --accent-light (+50% light)
--accent-dim (8% opacity), --accent-mid (15% opacity)
--sidebar-hover, --sidebar-active, --profile-text, --profile-text2
```

**`applyAppearanceRadius(value)`** — `--radius` va `--radius2` ga mos qiymat yozadi:
- `small` → 3px / 6px
- `medium` → 6px / 10px (default)
- `large` → 10px / 16px

**CSS o'zgaruvchilar** (`globals.css :root`):

| Guruh | O'zgaruvchilar |
|---|---|
| Fon | `--bg`, `--bg2`, `--bg3`, `--surface`, `--surface2` |
| Chegara | `--border`, `--border2` |
| Matn | `--text`, `--text2`, `--text3` |
| Accent | `--accent`, `--accent2`, `--accent3`, `--accent-light`, `--accent-dim`, `--accent-mid` |
| Holat ranglari | `--warn`, `--danger`, `--success`, `--purple` (+ `-dim` variantlari) |
| Sidebar | `--sidebar-bg`, `--sidebar-hover`, `--sidebar-active`, `--sidebar-text`, `--sidebar-text2`, `--sidebar-border` |
| Boshqa | `--radius`, `--radius2`, `--shadow`, `--shadow2` |

Dark mode `layout.tsx` da inline `themeVars` ob'ekt orqali `--bg`, `--text` va h.k. override qilinadi. `theme-change` hodisasi `window.dispatchEvent(new CustomEvent("appearance-theme", { detail: { theme } }))` orqali uzatiladi.

## Frontend Dizayn Qoidalari

> Bu bo'lim Claude Code ga yangi sahifa, komponent yoki UI element yaratishda qanday dizayn qilishni ko'rsatadi.

### Kodlashdan oldin o'yla

Har bir yangi sahifa yoki komponent uchun:
1. **Maqsad** — bu UI kimga, nima uchun? (ishlab chiqarish operatori? admin? menejer?)
2. **Ton** — ITM Factory tizimi: **industrial/utilitarian** + **refined dark** aralashmasi. Og'ir ma'lumot, toza ko'rinish.
3. **Differensiatsiya** — foydalanuvchi sahifani ochinganida "aha, bu ITM" deb bilishi kerak.

### Tipografiya qoidalari

Mavjud font tizimi (`--font-inter`, `--font-mono`) saqlanadi. Lekin **sarlavhalar va accent matnlar uchun** quyidagi qoidalar:

```tsx
// ✅ Sarlavhalar — katta, bold, letter-spacing bilan
<h1 className="font-head-itm text-2xl font-bold tracking-tight text-[--text]">
  Ombor Hisoboti
</h1>

// ✅ Raqamlar, kodlar, ID lar — har doim mono font
<span className="font-mono text-sm text-[--accent]">
  KTK-2024-001
</span>

// ✅ Kichik labellar — uppercase + letter-spacing
<span className="text-[10px] font-semibold uppercase tracking-widest text-[--text3]">
  Holati
</span>

// ❌ MAN — hamma matn bir xil o'lcham va og'irlikda
<p className="text-sm">Sarlavha</p>
<p className="text-sm">Qiymat</p>
```

### Rang ishlatish qoidalari

Mavjud CSS o'zgaruvchilarini **to'g'ri kontekstda** ishlatish:

```tsx
// Fon ierarxiyasi — chuqurlik uchun
--bg        → sahifa asosi
--bg2       → sidebar, panel background
--bg3       → nested panel, modal backdrop
--surface   → karta, jadval, input background
--surface2  → hover holat, active row

// Matn ierarxiyasi
--text      → asosiy ma'lumot (sarlavha, qiymat)
--text2     → ikkinchi darajali (label, tavsif)
--text3     → hint, placeholder, meta info

// Accent — faqat muhim elementlarda
--accent        → primary action tugma, active nav, link
--accent-dim    → accent background (badge, tag bg)
--accent-mid    → hover accent bg

// Holat ranglari — faqat status uchun
--success / --success-dim  → tayyor, to'langan, active
--warn / --warn-dim        → kutilmoqda, ogohlantirish
--danger / --danger-dim    → xato, bekor, muddati o'tgan
--purple / --purple-dim    → maxsus holat, VIP, priority
```

### Komponent dizayn patterns

#### Karta (Card)
```tsx
// ✅ To'g'ri — chuqurlik va chegara bilan
<div className="bg-[--surface] border border-[--border] rounded-[--radius] p-4
                hover:border-[--border2] transition-colors duration-200">

// ✅ Elevated karta — muhim metrika uchun
<div className="bg-[--surface] border border-[--border] rounded-[--radius] p-4
                shadow-[0_2px_8px_rgba(0,0,0,0.25)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.35)]
                transition-shadow duration-200">

// ❌ MAN — fon rangsiz, chegarasiz
<div className="p-4">
```

#### Tugma (Button)
```tsx
// Primary
<button className="px-4 py-2 bg-[--accent] text-white text-sm font-semibold
                   rounded-[--radius] hover:bg-[--accent2] active:scale-[0.97]
                   transition-all duration-150 cursor-pointer">

// Ghost (ikkinchi darajali)
<button className="px-4 py-2 bg-transparent border border-[--border2] text-[--text2]
                   text-sm rounded-[--radius] hover:bg-[--surface2] hover:text-[--text]
                   transition-all duration-150">

// Danger
<button className="px-4 py-2 bg-[--danger-dim] text-[--danger] text-sm font-semibold
                   rounded-[--radius] hover:bg-[--danger] hover:text-white
                   transition-all duration-150">
```

#### Badge / Status tag
```tsx
// ✅ Rang + icon + mono font kombinatsiyasi
<span className="inline-flex items-center gap-1.5 px-2 py-0.5
                 bg-[--success-dim] text-[--success]
                 text-[11px] font-mono font-medium rounded-full">
  <span className="w-1.5 h-1.5 rounded-full bg-[--success] animate-pulse" />
  Aktiv
</span>
```

#### Jadval (Table)
```tsx
// ✅ Sticky header, hover row highlight
<table className="w-full text-sm">
  <thead className="sticky top-0 z-10 bg-[--bg2]">
    <tr>
      <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase
                     tracking-widest text-[--text3] border-b border-[--border]">
        Mahsulot
      </th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-[--border] hover:bg-[--surface2]
                   transition-colors duration-100 cursor-pointer">
      <td className="px-3 py-2.5 text-[--text]">...</td>
    </tr>
  </tbody>
</table>
```

#### Input / Form field
```tsx
// ✅ Focus ring accent bilan
<input className="w-full bg-[--surface] border border-[--border] rounded-[--radius]
                  px-3 py-2 text-sm text-[--text] placeholder:text-[--text3]
                  focus:outline-none focus:border-[--accent] focus:ring-1 focus:ring-[--accent-dim]
                  transition-colors duration-150" />
```

### Layout va Kompozitsiya

```tsx
// Sahifa tuzilmasi — har doim shu pattern
<div className="page-transition min-h-screen bg-[--bg] p-6">
  {/* Page header */}
  <div className="flex items-center justify-between mb-6">
    <div>
      <h1 className="font-head-itm text-xl font-bold text-[--text] tracking-tight">
        Sahifa Nomi
      </h1>
      <p className="text-sm text-[--text3] mt-0.5">Qisqa tavsif</p>
    </div>
    <div className="flex items-center gap-2">
      {/* Action tugmalar */}
    </div>
  </div>

  {/* Stats row — agar kerak */}
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
    {/* Stat kartalar */}
  </div>

  {/* Asosiy kontent */}
  <div className="bg-[--surface] border border-[--border] rounded-[--radius2]">
    {/* ... */}
  </div>
</div>

// ✅ Stats karta pattern
<div className="bg-[--surface] border border-[--border] rounded-[--radius] p-4
                relative overflow-hidden group hover:border-[--accent-dim] transition-colors">
  {/* Shimmer effekt hover da */}
  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity
                  bg-gradient-to-r from-transparent via-[--accent-dim] to-transparent
                  -translate-x-full group-hover:translate-x-full duration-700" />
  <p className="text-[10px] font-semibold uppercase tracking-widest text-[--text3] mb-1">
    Jami Mahsulot
  </p>
  <p className="text-2xl font-bold font-mono text-[--text]">1,247</p>
  <p className="text-xs text-[--success] mt-1">↑ 12% o'tgan oyga nisbatan</p>
</div>
```

### Animatsiya qo'shish qoidalari

Yangi komponent yozganda quyidagilarga amal qil:

```tsx
// 1. Sahifaga page-transition klassi — har doim
<div className="page-transition ...">

// 2. List elementlari — nd-fadein klasslari bilan
{items.map((item, i) => (
  <div key={item.id} className={`nd-fadein-${Math.min(i, 4)}`}>
    {/* ... */}
  </div>
))}

// 3. Modal/Drawer — panel-appear
<div className="... [animation:panel-appear_0.28s_ease]">

// 4. Skeleton loader — raqam o'rnida
<div className="h-4 w-24 bg-[--surface2] rounded animate-pulse" />

// 5. Hover mikrointeraksiyalar — Tailwind transition bilan
className="transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]"
```

### MAN qilinadigan narsalar

| ❌ MAN | ✅ BUNING O'RNIGA |
|--------|-----------------|
| `className="bg-white text-black"` | `className="bg-[--surface] text-[--text]"` |
| `style={{ color: '#666' }}` | `text-[--text3]` Tailwind token |
| `border: '1px solid #eee'` | `border-[--border]` |
| `border-radius: '8px'` hardcode | `rounded-[--radius]` |
| Har xil joyda har xil spacing | `p-4`, `gap-3`, `mb-6` — izchil |
| `opacity-50` disabled holat uchun | `text-[--text3] cursor-not-allowed` |
| Rangni to'g'ridan-to'g'ri yozish | CSS token (`--accent`, `--success`) |
| `hover:bg-gray-100` | `hover:bg-[--surface2]` |

---

## Animatsiyalar

Barcha global animatsiyalar `globals.css` da, komponent-spesifik animatsiyalar `app/layout.tsx` `<style>` tegida.

### Global animatsiyalar (`globals.css`)

| Keyframe | Ishlatilishi |
|---|---|
| `page-enter` | `.page-transition` klassi — sahifa ochilishida `opacity: 0 → 1`, `translateY(28px) → 0`, `scale(0.98 → 1)`, `0.45s cubic-bezier(0.22,1,0.36,1)` |
| `spin` | `.nd-spinner` — loading spinner, `0.8s linear infinite` |
| `slideInToast` / `slideOutToast` | Toast bildirishnomalar — o'ngdan kirish/chiqish |
| `card-fade-out` | Tasks sahifasida contract kartalar chiqishda `opacity 0, translateY(-8px)` |
| `card-launch` | Tanlangan kontrakt kartasi `scale → scaleY(0.4) translateY(-24px)` |
| `tcb-appear` | Compact contract bar paydo bo'lishi — `translateY(-10px) scaleY(0.6) → normal` |
| `panel-appear` | Task paneli — `translateY(14px) → 0`, `0.28s` |
| `ndShine` | Stat karta hover da shimmer effekt — `left: -100% → 150%` |
| `ndAurora` | Dashboard hero background effekti, `8s infinite alternate` |
| `ndBarGrow` | Bo'lim progress bar — `width: 0 → var(--bar-w)`, `1s` |
| `ndFadeIn` | Dashboard elementlari ketma-ket paydo bo'lishi — `.nd-fadein-0..4`, `.nd-pipeline-fadein[data-delay]` |
| `ndWave` | Dashboard hero greeting'dagi to'lqin emoji animatsiyasi |

### Sidebar/logo animatsiyalar (`app/layout.tsx` `<style>`)

| Keyframe | Ishlatilishi |
|---|---|
| `navItemIn` | Nav item ochilganda — `opacity 0, translateX(-8px) → normal`, `0.2s`, har item uchun `60ms` delay |
| `logoPulse` | Logo icon — `drop-shadow` glow, `2.8s ease-in-out infinite` |
| `omborShimmer` | "FACTORY" sarlavha matni gradient shimmer, `2.5s linear infinite` |
| `dotPulse` | Sidebar "SYSTEM" yonidagi yashil nuqta, `1.6s infinite` |
| `logoSpin` | Logo SVG aylanishi (hover effekt), `5s cubic-bezier` |
| `iconMorph` | Dark/light mode toggle ikonasi o'zgarganda — `rotate(-200deg) scale(0.1) blur → normal`, `0.48s` |
| `btnGlow` | Mode toggle tugmasi bosilganda glow halqa, `0.5s` |

### Komponent animatsiya klasslari

```css
.page-transition       /* sahifa kirishida ishlatiladi */
.nd-fadein-0..4        /* dashboard elementlari, 0.05s–0.25s delay */
.nd-pipeline-fadein    /* data-delay="0..6" attr bilan */
.bar-delay-0..4        /* department bar fills, 0.1s–0.5s */
.tg-exiting            /* tasks grid exit holati */
.tsl-exiting           /* tasks selected layout exit holati */
.theme-icon-morph      /* dark mode icon o'zgarishida */
```

## EF Core Migrations

Barcha migration buyruqlari `Back/src/` papkasidan:

```bash
# Yangi migration
dotnet ef migrations add MigrationNomi --project DataAccess --startup-project API

# Bazaga qo'llash
dotnet ef database update --project DataAccess --startup-project API

# Oxirgi migrationni bekor qilish
dotnet ef database update OldingiMigrationNomi --project DataAccess --startup-project API
dotnet ef migrations remove --project DataAccess --startup-project API
```

Migrations avtomatik qo'llaniladi — `Program.cs` da `ApplyMigrationsAsync()` chaqiriladi.

## Key Conventions

- Yangi route qo'shilganda `app/layout.tsx` dagi `readyRoutes` setiga va `pageTitles` ga ham qo'shish kerak.
- Nav menyu `navGroups` massivida, har bir item `permission` field orqali ko'rinishini cheklaydi.
- Backend `appsettings.json` da: DB connection string, JWT `SecretKey`/`Issuer`/`Audience`, `FileStorageOptions`.
