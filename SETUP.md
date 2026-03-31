# Loyihani ishga tushirish

## Talablar

- [Node.js](https://nodejs.org) v18+
- [.NET SDK](https://dotnet.microsoft.com/download) 8+
- PostgreSQL

---

## Backend (.NET)

```bash
cd Back/src/API
dotnet run
```

> API manzili: `http://localhost:5223`
> Swagger: `http://localhost:5223/swagger`

---

## Client (Next.js)

```bash
cd client
npm install       # faqat birinchi marta
npm run dev
```

> Ilova manzili: `http://localhost:3000`

### PowerShell xatosi

Agar `npm run dev` da quyidagi xato chiqsa:

```
npm.ps1 cannot be loaded because running scripts is disabled on this system
```

PowerShell-da bir marta quyidagini bajaring:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

`Y` bosing, keyin `npm run dev` ni qayta ishga tushiring.

**Yoki** PowerShell o'rniga oddiy **cmd** (Command Prompt) ishlatsa ham bo'ladi.

---

## Environment

`client/.env.local` fayli (allaqachon mavjud):

```env
NEXT_PUBLIC_API_URL=http://localhost:5223
```

`Back/src/API/appsettings.json` ichida database connection string va JWT sozlamalari mavjud.

---

## Git

### Oxirgi o'zgarishlarni olish (pull)

```bash
git pull origin main
```

> Agar o'zingizda ham o'zgarishlar bo'lsa va conflict chiqsa — quyidagi bo'limga qarang.

---

### O'zgarishlarni yuklash (push)

**1. Qaysi fayllar o'zgardi — ko'rish:**

```bash
git status
```

**2. O'zgarishlarni staging ga qo'shish:**

```bash
# Barcha o'zgarishlarni qo'shish
git add .

# Yoki faqat ma'lum fayllarni
git add client/app/departments/page.tsx
```

**3. Commit qilish:**

```bash
git commit -m "Qisqa tavsif: nima o'zgardi"
```

**4. Push qilish:**

```bash
git push origin main
```

---

### Agar pull qilganda conflict chiqsa

```bash
git pull origin main
```

Conflict bo'lgan fayllar `git status` da ko'rinadi. Faylni oching — quyidagi ko'rinishda bo'ladi:

```
<<<<<<< HEAD
Sizning o'zgarishingiz
=======
Serverdan kelgan o'zgarish
>>>>>>> origin/main
```

Kerakli qismini qoldiring, qolganini o'chiring. Keyin: 

```bash
git add .
git commit -m "Conflict hal qilindi"
git push origin main
```

---

### Hali push qilinmagan o'zgarishlarni vaqtinchalik saqlash (stash)

Pull qilish kerak, lekin o'zgarishlar bor bo'lsa:

```bash
# O'zgarishlarni saqlash
git stash

# Pull qilish
git pull origin main

# Saqlangan o'zgarishlarni qaytarish
git stash pop
```

---

## Migration (EF Core)

> Barcha migration buyruqlari `Back/src` papkasidan bajariladi.

```bash
cd Back/src
```

### Yangi migration yaratish

```bash
dotnet ef migrations add MigrationNomi --project DataAccess --startup-project API
```

**Misol:**

```bash
dotnet ef migrations add RemoveDepartmentHeadUser --project DataAccess --startup-project API
```

### Migrationni bazaga qo'llash

```bash
dotnet ef database update --project DataAccess --startup-project API
```

### Oxirgi migrationni bekor qilish (rollback)

```bash
# Oldingi migration ga qaytish
dotnet ef database update OldingiMigrationNomi --project DataAccess --startup-project API

# Keyin migration faylini o'chirish
dotnet ef migrations remove --project DataAccess --startup-project API
```

### Barcha migrationlar ro'yxati

```bash
dotnet ef migrations list --project DataAccess --startup-project API
```
