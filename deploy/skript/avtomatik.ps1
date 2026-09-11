param(
    [switch]$Remove
)

. (Join-Path $PSScriptRoot "umumiy.ps1")

$Host.UI.RawUI.WindowTitle = "ITM Factory — avtomatik ishga tushirish"

function Show-TaskState {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if (-not $task) { Write-Info "Holat: avtomatik ishga tushirish O'CHIQ."; return }

    Write-Ok "Holat: YOQILGAN."
    $info = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($info -and $info.LastRunTime -gt [datetime]"2000-01-01") {
        Write-Info "Oxirgi ishga tushish: $($info.LastRunTime)  (natija kodi: $($info.LastTaskResult))"
    }
}

try {
    Write-Host ""
    Write-Host "  ITM FACTORY — AVTOMATIK ISHGA TUSHIRISH" -ForegroundColor Cyan
    Write-Host "  =======================================" -ForegroundColor DarkGray

    if (-not (Test-Admin)) {
        Write-Err "Administrator huquqi kerak. Faylni o'ng tugma -> 'Run as administrator'."
        throw "Administrator emas."
    }

    if ($Remove) {
        Write-Head "O'CHIRILMOQDA"
        if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
            Write-Ok "Avtomatik ishga tushirish o'chirildi."
            Write-Info "Tizim hozir ishlab tursa, to'xtamaydi — TOXTATISH.bat bilan to'xtating."
        } else {
            Write-Info "Avtomatik ishga tushirish allaqachon o'chiq edi."
        }
        return
    }

    Write-Head "YOQILMOQDA"

    if (-not (Test-Path $Marker)) {
        Write-Err "Avval BOSHLASH.bat ni ishga tushirib, sozlashni yakunlang."
        throw "Sozlama topilmadi."
    }

    $script = Join-Path $PSScriptRoot "xizmat.ps1"

    $action = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument ("-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"" + $script + "`"")

    # Yuklanishdan 40 soniya keyin — PostgreSQL xizmati ko'tarilib ulgursin
    # (xizmat.ps1 baribir portni alohida kutadi, bu shunchaki birinchi urinishni tejaydi).
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $trigger.Delay = "PT40S"

    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
        -ExecutionTimeLimit ([TimeSpan]::Zero) `
        -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 2)

    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
        -Principal $principal -Settings $settings `
        -Description "ITM Factory: kompyuter yoqilganda backend va frontendni ishga tushiradi." `
        -Force | Out-Null

    Write-Ok "Yoqildi. Endi kompyuter har yoqilganda tizim o'zi ko'tariladi."
    Write-Info "Hech kim tizimga (Windows'ga) kirmasa ham ishlaydi — SYSTEM nomidan."
    Write-Info "Jurnal: logs\avtomatik.log"
    Write-Host ""
    Write-Info "Tekshirish: kompyuterni qayta yoqing va boshqa kompyuterdan"
    Write-Info "http://<server-ip>:3000 ni oching."
    Write-Host ""
    Write-Info "O'chirish uchun: AVTOMATIK-OCHIRISH.bat"
}
catch {
    Write-Host ""
    Write-Err $_.Exception.Message
}
finally {
    Write-Host ""
    Show-TaskState
    Write-Host ""
    Write-Host "  Yopish uchun istalgan tugmani bosing..." -ForegroundColor DarkGray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
