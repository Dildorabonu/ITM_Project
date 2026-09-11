<#
  ITM litsenziya: barmoq izi -> token imzolash -> serverda faollashtirish.

  -Server: to'liq manzil ham, faqat IP ham bo'ladi. Port yozilmasa 3000 va 5223
  navbat bilan sinaladi (deploy'da backend loopback'da, tashqariga 3000 chiqadi).

  Misollar:
    .\litsenziya.ps1 -Customer "Korxona nomi" -Days 365 -Server 192.168.1.50
    .\litsenziya.ps1 -Customer "Korxona nomi" -Days 365 -Server http://localhost:5223
    .\litsenziya.ps1 -Customer "Korxona nomi" -Days 365 -Machine A7878E94418398BD -NoActivate
#>
param(
  [Parameter(Mandatory = $true)][string]$Customer,
  [string]$Server,
  [int]$Days = 365,
  [string]$Machine,
  [string]$Password,
  [switch]$NoActivate
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Serverni topib, barmoq izini qaytaradi. Port ko'rsatilmagan bo'lsa nomzodlarni sinaydi.
function Find-Server([string]$Raw) {
  if ($Raw -notmatch '^https?://') { $Raw = "http://$Raw" }
  $Raw = $Raw.TrimEnd('/')
  $uri = [Uri]$Raw

  if ($Raw -match '^https?://[^/]+:\d+') {
    $candidates = @($Raw)
  } else {
    $candidates = @("$($uri.Scheme)://$($uri.Host):3000", "$($uri.Scheme)://$($uri.Host):5223")
  }

  foreach ($c in $candidates) {
    try {
      $fp = (Invoke-RestMethod -Uri "$c/api/license/fingerprint" -Method Get -TimeoutSec 6).result.fingerprint
      return [pscustomobject]@{ Url = $c; Fingerprint = $fp }
    } catch {
      Write-Host "      urinish: $c — javob yo'q" -ForegroundColor DarkGray
    }
  }

  throw ("Server topilmadi: {0}. Tekshiring — ITM ishlab turibdimi, IP to'g'rimi, " +
         "3000-port firewall'da ochiqmi. Tarmoq yopiq bo'lsa -NoActivate bilan " +
         "faqat token yasab, admin panel orqali kiriting.") -f ($candidates -join ", ")
}

if ($Server) {
  Write-Host "[1/4] Server tekshirilmoqda" -ForegroundColor Cyan
  $found = Find-Server $Server
  $Server = $found.Url
  Write-Host "      Server     : $Server" -ForegroundColor Green
  if (-not $Machine) { $Machine = $found.Fingerprint }
  elseif ($Machine -ne $found.Fingerprint) {
    Write-Host "      OGOHLANTIRISH: berilgan barmoq izi serverdagidan farq qiladi ($($found.Fingerprint))" -ForegroundColor Yellow
  }
}

if (-not $Machine) { throw "-Machine yoki -Server dan kamida bittasi kerak." }
Write-Host "      Barmoq izi : $Machine" -ForegroundColor Green

Write-Host "[2/4] Token imzolanmoqda ($Customer / $Days kun)" -ForegroundColor Cyan
$out = & dotnet run --project . -- sign --customer $Customer --days $Days --machine $Machine
$token = $out | Where-Object { $_ -match '^[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$' } | Select-Object -First 1
if (-not $token) { $out | Write-Host; throw "Token chiqmadi — yuqoridagi xatoga qarang." }

$tokenFile = Join-Path $PSScriptRoot ("token-{0}.txt" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
Set-Content -Path $tokenFile -Value $token -Encoding utf8
Write-Host "      Saqlandi   : $tokenFile" -ForegroundColor Green

if ($NoActivate -or -not $Server) {
  Write-Host "`nTOKEN:`n$token"
  return
}

if (-not $Password) {
  $sec = Read-Host "      Superadmin paroli" -AsSecureString
  $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
}

Write-Host "[3/4] Faollashtirilmoqda: $Server" -ForegroundColor Cyan
$body = @{ token = $token; secret = $Password } | ConvertTo-Json -Compress
try {
  Invoke-RestMethod -Uri "$Server/api/license/activate" -Method Post -ContentType "application/json" -Body $body | Out-Null
} catch {
  $resp = $_.Exception.Response
  if ($resp) {
    $reader = New-Object IO.StreamReader($resp.GetResponseStream())
    Write-Host ("      XATO: " + $reader.ReadToEnd()) -ForegroundColor Red
  }
  throw
}

Write-Host "[4/4] Holat" -ForegroundColor Cyan
(Invoke-RestMethod -Uri "$Server/api/license/status" -Method Get).result | Format-List
