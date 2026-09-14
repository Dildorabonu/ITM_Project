# ITM Factory — mijoz serveri uchun paket yig'ish skripti.
#
# Ishlatish:  .\deploy.ps1                      (natija: Desktop\ITM_Deploy + ITM_Deploy.zip)
#             .\deploy.ps1 -OutDir "D:\ITM"     (boshqa joyga)
#             .\deploy.ps1 -NoZip               (arxiv yasamasin)
#
# Natija papkasi target kompyuterga ko'chiriladi va u yerda BOSHLASH.bat bosiladi.
# Manba kod (.cs / .tsx) paketga tushmaydi.

param(
    [string]$OutDir = (Join-Path ([Environment]::GetFolderPath("Desktop")) "ITM_Deploy"),
    [switch]$NoZip
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# Frontend proxy manzili build paytida routes-manifest'ga yoziladi (runtime'da
# o'zgartirib bo'lmaydi), backend esa BOSHLASH.bat da aynan shu manzilga bog'lanadi.
$backendUrl = "http://127.0.0.1:5223"

function Step([string]$Text) {
    Write-Host ""
    Write-Host "==> $Text" -ForegroundColor Cyan
}

Step "Chiqish papkasi: $OutDir"
if (Test-Path $OutDir) { Remove-Item -Recurse -Force $OutDir }
New-Item -ItemType Directory -Force $OutDir | Out-Null

# ---------------------------------------------------------------
# 1. BACKEND — self-contained publish (.NET runtime ichida, source kod yo'q)
# ---------------------------------------------------------------
Step "[1/6] Backend publish qilinmoqda..."
# DebugType=none — .pdb yasalmasin. Ular ichida Source Link bor: GitHub repo
# manzili va commit hash'i, ustiga metod nomlari va satr raqamlari. Ular bilan
# dekompilyatsiya deyarli manba kodga teng bo'lib qoladi.
# Release chiqishini tozalaymiz: aks holda oldingi build'dan qolgan DLL'lar
# ishlatiladi va ular ichida hali ham pdb yo'li (ishlab chiquvchi papkasi) qoladi.
# Debug papkalariga tegilmaydi — ular dev serverga kerak.
foreach ($proj in @("API", "Application", "Core", "DataAccess")) {
    foreach ($sub in @("bin\Release", "obj\Release")) {
        $path = Join-Path $root "Back\src\$proj\$sub"
        if (Test-Path $path) { Remove-Item -Recurse -Force $path }
    }
}

dotnet publish (Join-Path $root "Back\src\API\API.csproj") `
    -c Release -r win-x64 --self-contained true `
    -p:DebugType=none -p:DebugSymbols=false `
    -o (Join-Path $OutDir "backend")
if ($LASTEXITCODE -ne 0) { throw "dotnet publish xato bilan tugadi" }

# uploads BO'SH ketadi — bu yerdagi fayllar ishlab chiquvchining test ma'lumotlari
# (shartnomalar, chizmalar, texprotsess) va mijoz serveriga tushmasligi kerak.
$pkgUploads = Join-Path $OutDir "backend\uploads"
if (Test-Path $pkgUploads) { Remove-Item -Recurse -Force $pkgUploads }
New-Item -ItemType Directory -Force $pkgUploads | Out-Null

# Dev bazasining paroli va umumiy JWT kaliti mijoz serveriga ketmasin —
# ikkalasini ham BOSHLASH.bat birinchi sozlashda o'zi to'ldiradi.
$prodSettings = Join-Path $OutDir "backend\appsettings.Production.json"
if (Test-Path $prodSettings) {
    $json = Get-Content $prodSettings -Raw | ConvertFrom-Json

    # Bo'lim yoki maydon ishlab chiquvchi faylida yo'q bo'lsa ham paketda bo'lishi shart:
    # aks holda mijozga tozalanmagan (yoki umuman yo'q) sozlama ketadi.
    function Set-Field($obj, [string]$section, [string]$field, $value) {
        if (-not $obj.PSObject.Properties[$section]) {
            $obj | Add-Member -MemberType NoteProperty -Name $section -Value ([pscustomobject]@{})
        }
        if (-not $obj.$section.PSObject.Properties[$field]) {
            $obj.$section | Add-Member -MemberType NoteProperty -Name $field -Value $value
        } else {
            $obj.$section.$field = $value
        }
    }

    Set-Field $json "ConnectionStrings" "DefaultConnection" ""
    Set-Field $json "JwtOptions" "SecretKey" ""
    Set-Field $json "License" "//" 'LicenseGen bilan server barmoq iziga boglab yasaladi: dotnet run -- sign --customer "..." --days 365 --machine <FINGERPRINT>'
    Set-Field $json "License" "Key" ""
    Set-Field $json "License" "KeyFilePath" $null

    ($json | ConvertTo-Json -Depth 20) | Set-Content -Path $prodSettings -Encoding UTF8
    Write-Host "    appsettings.Production.json tozalandi (parol/JWT/litsenziya bo'sh)."
} else {
    throw "appsettings.Production.json publish tarkibida topilmadi"
}

# ---------------------------------------------------------------
# 2. FRONTEND — Next.js standalone build (minifikatsiya qilingan JS, .tsx yo'q)
# ---------------------------------------------------------------
Step "[2/6] Frontend build qilinmoqda..."
$feDir = Join-Path $OutDir "frontend"
Push-Location (Join-Path $root "client")
try {
    # Next .env.local'ni allaqachon o'rnatilgan muhit o'zgaruvchisidan ustun qo'ymaydi,
    # shuning uchun bu qiymat build'ga tushadi.
    $env:BACKEND_URL = $backendUrl
    $env:NEXT_PUBLIC_API_URL = ""
    $env:CSP_REPORT_ONLY = "false"

    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build xato bilan tugadi" }

    Copy-Item -Recurse -Force ".next\standalone" $feDir
    New-Item -ItemType Directory -Force (Join-Path $feDir ".next") | Out-Null
    Copy-Item -Recurse -Force ".next\static" (Join-Path $feDir ".next\static")
    if (Test-Path "public") {
        Copy-Item -Recurse -Force "public" (Join-Path $feDir "public")
    }

    # Bo'sh source-map fayllar — mijoz serverida keraksiz.
    Get-ChildItem $feDir -Recurse -Filter *.map |
        Where-Object { $_.FullName -notmatch "\\node_modules\\" } |
        Remove-Item -Force
} finally {
    Remove-Item Env:\BACKEND_URL -ErrorAction SilentlyContinue
    Remove-Item Env:\NEXT_PUBLIC_API_URL -ErrorAction SilentlyContinue
    Remove-Item Env:\CSP_REPORT_ONLY -ErrorAction SilentlyContinue
    Pop-Location
}

# ---------------------------------------------------------------
# 3. NODE — bitta node.exe yetarli, target kompyuterga Node o'rnatilmaydi
# ---------------------------------------------------------------
Step "[3/6] node.exe nusxalanmoqda..."
$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) { throw "node.exe topilmadi — Node.js o'rnatilganini tekshiring" }
New-Item -ItemType Directory -Force (Join-Path $OutDir "runtime") | Out-Null
Copy-Item -Force $node.Source (Join-Path $OutDir "runtime\node.exe")
Write-Host "    $($node.Source)  ($(node -v))"

# ---------------------------------------------------------------
# 4. Ishga tushirish skriptlari
# ---------------------------------------------------------------
Step "[4/6] Ishga tushirish skriptlari nusxalanmoqda..."
Copy-Item -Recurse -Force (Join-Path $root "deploy\*") $OutDir

# cmd.exe LF bilan yozilgan .bat fayllarda goto/label'ni noto'g'ri o'qishi mumkin.
# .bat da BOM bo'lmasligi shart — aks holda birinchi satr ("@echo off") buziladi.
foreach ($bat in Get-ChildItem $OutDir -Filter *.bat) {
    $text = [IO.File]::ReadAllText($bat.FullName) -replace "`r`n", "`n" -replace "`n", "`r`n"
    [IO.File]::WriteAllText($bat.FullName, $text, (New-Object Text.UTF8Encoding($false)))
}

# Aksincha: Windows PowerShell 5.1 BOM'siz .ps1 ni ANSI deb o'qiydi va o'zbekcha
# belgilar qo'shtirnoqqa aylanib skript ishlamay qoladi.
$utf8Bom = New-Object Text.UTF8Encoding($true)
foreach ($ps in Get-ChildItem (Join-Path $OutDir "skript") -Filter *.ps1) {
    $text = [IO.File]::ReadAllText($ps.FullName, (New-Object Text.UTF8Encoding($false)))
    [IO.File]::WriteAllText($ps.FullName, $text, $utf8Bom)
}

# ---------------------------------------------------------------
# 5. Tekshiruvlar — paket haqiqatan to'liqmi
# ---------------------------------------------------------------
Step "[5/6] Paket tekshirilmoqda..."
$required = @(
    "backend\API.exe",
    "backend\appsettings.Production.json",
    "frontend\server.js",
    "runtime\node.exe",
    "BOSHLASH.bat", "TOXTATISH.bat", "AVTOMATIK.bat",
    "AVTOMATIK-OCHIRISH.bat", "SOZLASH.bat", "README.txt",
    "skript\umumiy.ps1", "skript\boshlash.ps1", "skript\toxtatish.ps1",
    "skript\avtomatik.ps1", "skript\xizmat.ps1"
)
foreach ($rel in $required) {
    if (-not (Test-Path (Join-Path $OutDir $rel))) { throw "Paketda yetishmayapti: $rel" }
}

$manifest = Get-ChildItem $feDir -Recurse -Filter "routes-manifest.json" | Select-Object -First 1
if (-not $manifest) { throw "routes-manifest.json topilmadi — standalone build to'liq emas" }
$manifestText = Get-Content $manifest.FullName -Raw
if ($manifestText -notmatch [regex]::Escape("$backendUrl/api/")) {
    throw "Frontend proxy manzili noto'g'ri baked bo'lgan — kutilgan: $backendUrl"
}
Write-Host "    Proxy manzili to'g'ri: $backendUrl"

$srcLeak = Get-ChildItem $OutDir -Recurse -Include *.cs, *.tsx -ErrorAction SilentlyContinue |
           Where-Object { $_.FullName -notmatch "\\node_modules\\" }
if ($srcLeak) { Write-Warning "Paketda manba fayllar bor: $($srcLeak.Count) ta" }

$leftover = @(Get-ChildItem $pkgUploads -Recurse -File -ErrorAction SilentlyContinue)
if ($leftover.Count -gt 0) { throw "uploads bo'sh emas — $($leftover.Count) ta fayl mijozga ketardi" }
Write-Host "    uploads bo'sh (test fayllar ketmaydi)."

$pdb = @(Get-ChildItem $OutDir -Recurse -Filter *.pdb -ErrorAction SilentlyContinue)
if ($pdb.Count -gt 0) { throw "paketda $($pdb.Count) ta .pdb bor — ular repo manzili va commit hash'ini oshkor qiladi" }

$projectFolder = Split-Path $root -Leaf
foreach ($name in @("API.dll", "Application.dll", "Core.dll", "DataAccess.dll")) {
    $dll = Join-Path $OutDir "backend\$name"
    if (-not (Test-Path $dll)) { continue }
    $text = [Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($dll))
    if ($text -match [regex]::Escape($projectFolder)) {
        throw "$name ichida ishlab chiquvchi papkasining yo'li qolgan"
    }
}

$maps = @(Get-ChildItem $OutDir -Recurse -Filter *.map -ErrorAction SilentlyContinue |
          Where-Object { $_.FullName -notmatch "\\node_modules\\" })
if ($maps.Count -gt 0) { throw "paketda $($maps.Count) ta source-map qoldi" }
Write-Host "    .pdb va source-map yo'q."

$sizeMb = [math]::Round((Get-ChildItem $OutDir -Recurse -File | Measure-Object Length -Sum).Sum / 1MB, 1)
Write-Host "    Papka hajmi: $sizeMb MB"

# ---------------------------------------------------------------
# 6. Arxiv
# ---------------------------------------------------------------
if (-not $NoZip) {
    Step "[6/6] Arxiv yasalmoqda..."
    $zip = "$OutDir.zip"
    if (Test-Path $zip) { Remove-Item -Force $zip }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::CreateFromDirectory(
        $OutDir, $zip, [IO.Compression.CompressionLevel]::Optimal, $false)
    $zipMb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
    Write-Host "    $zip  ($zipMb MB)"
} else {
    Step "[6/6] Arxiv o'tkazib yuborildi (-NoZip)."
}

Write-Host ""
Write-Host "TAYYOR" -ForegroundColor Green
Write-Host "  Papka : $OutDir"
if (-not $NoZip) { Write-Host "  Arxiv : $OutDir.zip" }
Write-Host ""
Write-Host "  Target kompyuterda: papkani C:\ITM ga ko'chirib, BOSHLASH.bat ni bosing."
