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
