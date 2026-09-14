# Windows vazifa rejalashtiruvchisi (Task Scheduler) shu skriptni kompyuter
# yoqilganda SYSTEM nomidan, oynasiz ishga tushiradi. Hech qanday savol bermaydi.

. (Join-Path $PSScriptRoot "umumiy.ps1")

New-Item -ItemType Directory -Force $LogDir | Out-Null
$log = Join-Path $LogDir "avtomatik.log"

function Note([string]$Text) {
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $Text" | Add-Content -Path $log -Encoding UTF8
}

try {
    Note "--- Avtomatik ishga tushirish boshlandi ---"

    if (-not (Test-Path $Marker)) {
        Note "XATO: sozlama.ok yo'q. Avval BOSHLASH.bat ishga tushirilishi kerak."
        exit 1
    }

    # Yuklanishdan keyin PostgreSQL xizmati kechroq ko'tarilishi mumkin —
    # baza tayyor bo'lmasa backend migratsiyada yiqiladi.
    $pg = Get-PostgresSettings
    if ($pg) {
        if (-not (Wait-Tcp $pg.Address $pg.Port 300)) {
            Note "XATO: PostgreSQL ($($pg.Address):$($pg.Port)) 5 daqiqada javob bermadi."
            exit 1
        }
        Note "PostgreSQL tayyor."
    }

    Start-Itm
    Note "Jarayonlar ishga tushirildi."

    if (-not (Wait-Backend 300)) {
        Note "XATO: backend javob bermadi. backend.err.log ni ko'ring."
        exit 1
    }
    Note "Backend tayyor."

    if (-not (Wait-Frontend 120)) {
        Note "XATO: frontend javob bermadi."
        exit 1
    }
    Note "Frontend tayyor. Tizim ishlamoqda."
    exit 0
}
catch {
    Note "XATO: $($_.Exception.Message)"
    exit 1
}
