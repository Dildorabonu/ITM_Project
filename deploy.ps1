# ITM Factory — offline deploy build skripti
# Ishlatish:  .\deploy.ps1          (natija: dist\ papkasi)
#             .\deploy.ps1 -OutDir "D:\ITM_Deploy"
#
# dist\ papkasini flashkaga ko'chirib, internetga ulanmagan kompyuterda
# dist\README.txt dagi qadamlar bo'yicha ishga tushiriladi.

param(
    [string]$OutDir = (Join-Path $PSScriptRoot "dist")
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "==> Chiqish papkasi: $OutDir"
if (Test-Path $OutDir) { Remove-Item -Recurse -Force $OutDir }
New-Item -ItemType Directory -Force $OutDir | Out-Null

# ---------------------------------------------------------------
# 1. BACKEND — self-contained publish (.NET runtime ichida, source kod yo'q)
# ---------------------------------------------------------------
Write-Host "==> [1/3] Backend publish qilinmoqda..."
dotnet publish (Join-Path $root "Back\src\API\API.csproj") `
    -c Release -r win-x64 --self-contained true `
    -o (Join-Path $OutDir "backend")
if ($LASTEXITCODE -ne 0) { throw "dotnet publish xato bilan tugadi" }

# uploads papkasi (mavjud fayllar) — publish tarkibiga kirmaydi, alohida nusxalanadi
$uploads = Join-Path $root "Back\src\API\uploads"
if (Test-Path $uploads) {
    Copy-Item -Recurse -Force $uploads (Join-Path $OutDir "backend\uploads")
}

# ---------------------------------------------------------------
# 2. FRONTEND — Next.js standalone build (minifikatsiya qilingan JS, .tsx yo'q)
# ---------------------------------------------------------------
Write-Host "==> [2/3] Frontend build qilinmoqda..."
Push-Location (Join-Path $root "client")
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build xato bilan tugadi" }

    $fe = Join-Path $OutDir "frontend"
    Copy-Item -Recurse -Force ".next\standalone" $fe
    New-Item -ItemType Directory -Force (Join-Path $fe ".next") | Out-Null
    Copy-Item -Recurse -Force ".next\static" (Join-Path $fe ".next\static")
    if (Test-Path "public") {
        Copy-Item -Recurse -Force "public" (Join-Path $fe "public")
    }
} finally {
    Pop-Location
}

# ---------------------------------------------------------------
# 3. Ishga tushirish skriptlari va yo'riqnoma
# ---------------------------------------------------------------
Write-Host "==> [3/3] Start skriptlar yozilmoqda..."

@'
@echo off
cd /d "%~dp0backend"
API.exe
'@ | Out-File -Encoding ascii (Join-Path $OutDir "start-backend.bat")

@'
@echo off
cd /d "%~dp0frontend"
set PORT=3000
set HOSTNAME=0.0.0.0
node server.js
'@ | Out-File -Encoding ascii (Join-Path $OutDir "start-frontend.bat")

# Firewall'da 3000-portni ochish (bir marta, Administrator sifatida ishga tushiriladi)
@'
@echo off
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Bu skriptni Administrator sifatida ishga tushiring!
    pause
    exit /b 1
)
netsh advfirewall firewall add rule name="ITM Frontend (3000)" dir=in action=allow protocol=TCP localport=3000
echo 3000-port ochildi. Boshqa kompyuterlar http://SERVER_IP:3000 orqali kira oladi.
pause
'@ | Out-File -Encoding ascii (Join-Path $OutDir "setup-firewall.bat")

@'
ITM FACTORY — OFFLINE O'RNATISH YO'RIQNOMASI
=============================================

Target kompyuterga OLDINDAN o'rnatilishi kerak (offline installer bilan):
  1. PostgreSQL  — https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
  2. Node.js LTS — https://nodejs.org  (faqat frontend uchun kerak)
  (.NET o'rnatish SHART EMAS — backend ichida runtime bor)

O'RNATISH QADAMLARI
-------------------
1. Shu papkani (dist) target kompyuterga nusxalang, masalan C:\ITM ga.

2. PostgreSQL o'rnating, "postgres" foydalanuvchi paroliga e'tibor bering.

3. backend\appsettings.Production.json faylini oching va connection
   string'ni shu kompyuterdagi PostgreSQL ga moslang (Password, Database).

4. start-backend.bat ni ishga tushiring.
   - Birinchi ishga tushishda migratsiyalar avtomatik qo'llanadi
     va baza jadvallar yaratiladi.
   - Backend: http://localhost:5223

5. start-frontend.bat ni ishga tushiring.
   - Frontend: http://localhost:3000

6. Brauzerda http://localhost:3000 ni oching.

LOKAL TARMOQ (LAN) ORQALI BOSHQA KOMPYUTERLARDAN KIRISH
--------------------------------------------------------
1. Server kompyuterda setup-firewall.bat ni BIR MARTA Administrator
   sifatida ishga tushiring (o'ng tugma -> Run as administrator).
   Bu Windows Firewall'da 3000-portni ochadi.

2. Server kompyuterning IP manzilini aniqlang:
   cmd da:  ipconfig   (masalan 192.168.1.50)
   IP o'zgarib qolmasligi uchun routerda yoki Windows'da statik IP
   belgilash tavsiya etiladi.

3. Boshqa kompyuterlarda brauzerda oching:
   http://192.168.1.50:3000   (o'z IP manzilingiz bilan)

   Boshqa kompyuterlarga HECH NARSA o'rnatish kerak emas — faqat brauzer.

Qanday ishlaydi: barcha so'rovlar (sahifa, API, fayllar) faqat 3000-port
orqali yuradi. Frontend server API so'rovlarini o'zi ichkarida backend'ga
(localhost:5223) uzatadi. Shuning uchun 5223 va 5432 (PostgreSQL)
portlarini tarmoqqa ochish KERAK EMAS — ular faqat server ichida ishlaydi,
bu xavfsizroq ham.

ESLATMALAR
----------
- Mavjud ma'lumotlar bazasini ko'chirish kerak bo'lsa: eski kompyuterda
  pg_dump bilan dump oling, yangisida pg_restore / psql bilan tiklang.
- Server kompyuter o'chirilsa tizim ishlamaydi — uni doim yoniq saqlang
  yoki backend/frontend'ni Windows service sifatida ro'yxatdan o'tkazing
  (masalan NSSM yordamida).
'@ | Out-File -Encoding utf8 (Join-Path $OutDir "README.txt")

Write-Host ""
Write-Host "==> TAYYOR: $OutDir"
Write-Host "    dist papkasini flashkaga ko'chiring va target kompyuterda README.txt ga amal qiling."
