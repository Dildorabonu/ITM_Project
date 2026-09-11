param([switch]$Reconfigure)

. (Join-Path $PSScriptRoot "umumiy.ps1")

$Host.UI.RawUI.WindowTitle = "ITM Factory"

function Read-Plain([string]$Prompt) {
    $secure = Read-Host -Prompt $Prompt -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function Find-Psql {
    # Eng ishonchli manba — ishlab turgan postgres.exe: portativ o'rnatmalarda ham topadi.
    $proc = Get-CimInstance Win32_Process -Filter "Name='postgres.exe'" -ErrorAction SilentlyContinue |
            Select-Object -First 1
    if ($proc -and $proc.ExecutablePath) {
        $candidate = Join-Path (Split-Path $proc.ExecutablePath) "psql.exe"
        if (Test-Path $candidate) { return $candidate }
    }

    $cmd = Get-Command psql.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $found = @()
    foreach ($pattern in @("C:\Program Files\PostgreSQL\*\bin\psql.exe",
                           "C:\Program Files (x86)\PostgreSQL\*\bin\psql.exe",
                           "C:\pgsql\bin\psql.exe",
                           "C:\PostgreSQL\*\bin\psql.exe",
                           (Join-Path $env:USERPROFILE "PostgreSQL\*\bin\psql.exe"))) {
        $found += @(Get-ChildItem $pattern -ErrorAction SilentlyContinue)
    }
    if ($found.Count -gt 0) {
        return ($found | Sort-Object FullName -Descending | Select-Object -First 1).FullName
    }
    return $null
}

# Npgsql ulanish satrida ';' yoki '"' bo'lgan parol qo'shtirnoq ichida beriladi.
function ConvertTo-PgValue([string]$Value) {
    if ($Value -match '[;"]' -or $Value -match '^\s' -or $Value -match '\s$') {
        return '"' + ($Value -replace '"', '""') + '"'
    }
    return $Value
}

function New-JwtSecret {
    $bytes = New-Object byte[] 48
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes)
}

function Invoke-Setup {
    Write-Head "BIRINCHI SOZLASH"
    Write-Info "Bu bir martalik. Keyingi safar BOSHLASH.bat darhol ishga tushadi."
    Write-Host ""

    $psql = Find-Psql
    if ($psql) { Write-Ok "psql topildi: $psql" }
    else { Write-Warn2 "psql.exe topilmadi — parol tekshirilmaydi, bazani backend o'zi yaratadi." }

    $address = Read-Host "  PostgreSQL manzili [localhost]"
    if ([string]::IsNullOrWhiteSpace($address)) { $address = "localhost" }

    $portText = Read-Host "  PostgreSQL porti [5432]"
    $port = 5432
    if (-not [string]::IsNullOrWhiteSpace($portText)) {
        if (-not [int]::TryParse($portText.Trim(), [ref]$port)) { $port = 5432 }
    }

    $user = Read-Host "  PostgreSQL foydalanuvchisi [postgres]"
    if ([string]::IsNullOrWhiteSpace($user)) { $user = "postgres" }

    $database = Read-Host "  Baza nomi [ITM]"
    if ([string]::IsNullOrWhiteSpace($database)) { $database = "ITM" }

    if (-not (Wait-Tcp $address $port 5)) {
        Write-Err "$address`:$port ga ulanib bo'lmadi. PostgreSQL xizmati ishlayaptimi?"
        Write-Info "Xizmatlar (services.msc) ro'yxatidan 'postgresql-...' ni ishga tushiring."
        throw "PostgreSQL javob bermayapti."
    }
    Write-Ok "PostgreSQL porti ochiq: $address`:$port"

    $password = $null
    for ($attempt = 1; $attempt -le 5; $attempt++) {
        $password = Read-Plain "  '$user' foydalanuvchi paroli"
        if (-not $psql) { break }

        $env:PGPASSWORD = $password
        & $psql -h $address -p $port -U $user -d postgres -tAc "SELECT 1" 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { Write-Ok "Parol to'g'ri."; break }

        Write-Err "Parol noto'g'ri yoki ulanish rad etildi. Qayta urinib ko'ring."
        if ($attempt -eq 5) { throw "Parol tasdiqlanmadi." }
    }

    # Bazani ataylab psql bilan yaratmaymiz: PowerShell native buyruqqa uzatganda
    # CREATE DATABASE "ITM" ichidagi qo'shtirnoqni yo'qotadi va nomi kichik harfga
    # tushib ketadi. EF Core migratsiyasi bazani to'g'ri nom bilan o'zi yaratadi.
    if ($psql) {
        $env:PGPASSWORD = $password
        $exists = & $psql -h $address -p $port -U $user -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$database'" 2>&1
        $env:PGPASSWORD = $null
        if ("$exists".Trim() -eq "1") { Write-Ok "'$database' bazasi mavjud — ma'lumotlar saqlanib qoladi." }
        else { Write-Info "'$database' bazasi yo'q — birinchi ishga tushishda yaratiladi." }
    }

    $conn = "Host=$address;Port=$port;Database=$database;Username=$user;Password=" + (ConvertTo-PgValue $password)

    $json = Get-Content $AppSettings -Raw | ConvertFrom-Json
    $json.ConnectionStrings.DefaultConnection = $conn
    # Har bir o'rnatma o'z JWT kalitiga ega bo'lsin — paketdagi umumiy kalit qolib ketmasin.
    $json.JwtOptions.SecretKey = New-JwtSecret
    ($json | ConvertTo-Json -Depth 20) | Set-Content -Path $AppSettings -Encoding UTF8
    Write-Ok "Ulanish sozlamalari yozildi va yangi JWT kaliti yaratildi."

    if (Test-Admin) {
        netsh advfirewall firewall delete rule name="ITM Factory (3000)" 2>&1 | Out-Null
        netsh advfirewall firewall add rule name="ITM Factory (3000)" dir=in action=allow protocol=TCP localport=3000 2>&1 | Out-Null
        Write-Ok "Windows Firewall'da 3000-port ochildi (lokal tarmoq uchun)."
    } else {
        Write-Warn2 "Administrator huquqi yo'q — 3000-port firewall'da ochilmadi."
        Write-Info "Boshqa kompyuterlar kira olmasa, BOSHLASH.bat ni 'Run as administrator' bilan bir marta oching."
    }

    Set-Content -Path $Marker -Value (Get-Date -Format "yyyy-MM-dd HH:mm:ss") -Encoding ASCII
    Write-Ok "Sozlash tugadi."
}

function Show-Summary {
    Write-Head "TIZIM ISHLAYAPTI"

    $ips = Get-LanIp
    Write-Host ""
    Write-Host "  Shu kompyuterda      : " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor White
    if ($ips.Count -gt 0) {
        Write-Host "  Boshqa kompyuterlarda: " -NoNewline
        Write-Host ("http://" + $ips[0] + ":3000") -ForegroundColor White
        foreach ($ip in $ips | Select-Object -Skip 1) {
            Write-Host "                         http://$ip`:3000" -ForegroundColor DarkGray
        }
    } else {
        Write-Warn2 "Tarmoq IP manzili aniqlanmadi (cmd -> ipconfig)."
    }

    $status = Get-LicenseStatus
    if ($status -and $status.valid) {
        Write-Host ""
        Write-Ok "Litsenziya faol. Muddati: $($status.expiresUtc)"
    } else {
        $fp = Get-Fingerprint
        Write-Host ""
        Write-Host "  ================= LITSENZIYA KERAK =================" -ForegroundColor Yellow
        Write-Host "  Serverning barmoq izi:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "        $fp" -ForegroundColor White
        Write-Host ""
        Write-Host "  Shu kodni tizim ta'minotchisiga yuboring. U sizga" -ForegroundColor Yellow
        Write-Host "  litsenziya tokenini beradi. Tokenni brauzerdagi qulf" -ForegroundColor Yellow
        Write-Host "  oynasidan 'Faollashtirish' orqali kiriting" -ForegroundColor Yellow
        Write-Host "  (parol: superadmin foydalanuvchi paroli)." -ForegroundColor Yellow
        Write-Host "  ====================================================" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Info "To'xtatish uchun: TOXTATISH.bat"
    Write-Info "Kompyuter yoqilganda o'zi ishga tushishi uchun: AVTOMATIK.bat"
    Write-Info "Bu oynani yopsangiz ham tizim ishlashda davom etadi."
}

try {
    Write-Host ""
    Write-Host "  ITM FACTORY" -ForegroundColor Cyan
    Write-Host "  ===========" -ForegroundColor DarkGray

    if ($Reconfigure -and (Test-Path $Marker)) { Remove-Item $Marker -Force }

    if (-not (Test-Path $Marker)) {
        if (Get-ItmProcess) {
            Write-Info "Ishlab turgan jarayonlar to'xtatilmoqda (qayta sozlash uchun)..."
            Stop-Itm | Out-Null
            Start-Sleep -Seconds 3
        }
        Invoke-Setup
    }

    $already = (Test-PortListening $FrontPort) -and (Test-PortListening $BackendPort)
    if ($already) {
        Write-Head "TIZIM ALLAQACHON ISHLAYAPTI"
        Write-Info "Qayta ishga tushirilmadi."
    } else {
        Write-Head "ISHGA TUSHIRILMOQDA"

        $pg = Get-PostgresSettings
        if ($pg) {
            if (-not (Wait-Tcp $pg.Address $pg.Port 60)) {
                Write-Err "PostgreSQL ($($pg.Address):$($pg.Port)) javob bermayapti."
                throw "PostgreSQL ishga tushmagan."
            }
            Write-Ok "PostgreSQL tayyor."
        }

        Start-Itm
        Write-Info "Backend kutilmoqda (birinchi safar bazani yaratadi — 1-2 daqiqa)..."
        if (-not (Wait-Backend 300)) {
            Write-Err "Backend ishga tushmadi."
            Show-BackendLog
            throw "Backend javob bermadi."
        }
        Write-Ok "Backend tayyor."

        if (-not (Wait-Frontend 120)) {
            Write-Err "Frontend ishga tushmadi. logs\frontend.err.log ni ko'ring."
            throw "Frontend javob bermadi."
        }
        Write-Ok "Frontend tayyor."
    }

    Show-Summary

    # Brauzerni explorer orqali ochamiz — skript admin huquqi bilan ishlayotgan bo'lsa ham
    # brauzer oddiy foydalanuvchi huquqida ochilsin.
    Start-Process explorer.exe "http://localhost:3000"
}
catch {
    Write-Host ""
    Write-Err $_.Exception.Message
}
finally {
    Write-Host ""
    Write-Host "  Yopish uchun istalgan tugmani bosing..." -ForegroundColor DarkGray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
