. (Join-Path $PSScriptRoot "umumiy.ps1")

$Host.UI.RawUI.WindowTitle = "ITM Factory — to'xtatish"

Write-Head "TO'XTATILMOQDA"

$count = Stop-Itm
if ($count -gt 0) {
    Start-Sleep -Seconds 2
    Write-Ok "$count ta jarayon to'xtatildi."
} else {
    Write-Info "Ishlab turgan jarayon topilmadi."
}

if ((Test-PortListening $FrontPort) -or (Test-PortListening $BackendPort)) {
    Write-Warn2 "Portlar hali band. Avtomatik ishga tushirish yoqilgan bo'lsa,"
    Write-Warn2 "jarayonlar SYSTEM nomidan ishlaydi — bu oynani Administrator sifatida oching."
} else {
    Write-Ok "Tizim to'liq to'xtadi."
}

Write-Host ""
Write-Host "  Yopish uchun istalgan tugmani bosing..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
