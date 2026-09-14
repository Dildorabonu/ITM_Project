$ErrorActionPreference = "Stop"

$Root        = Split-Path -Parent $PSScriptRoot
$BackendDir  = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"
$LogDir      = Join-Path $Root "logs"
$NodeExe     = Join-Path $Root "runtime\node.exe"
$ApiExe      = Join-Path $BackendDir "API.exe"
$AppSettings = Join-Path $BackendDir "appsettings.Production.json"
$Marker      = Join-Path $Root "sozlama.ok"

$BackendPort = 5223
$BackendUrl  = "http://127.0.0.1:$BackendPort"
$FrontPort   = 3000
$TaskName    = "ITM Factory"

function Write-Head([string]$Text) {
    Write-Host ""
    Write-Host ("  " + $Text) -ForegroundColor Cyan
    Write-Host ("  " + ("-" * $Text.Length)) -ForegroundColor DarkGray
}

function Write-Ok([string]$Text)   { Write-Host "  [OK]   $Text" -ForegroundColor Green }
function Write-Info([string]$Text) { Write-Host "  [ i ]  $Text" -ForegroundColor Gray }
function Write-Warn2([string]$Text){ Write-Host "  [ ! ]  $Text" -ForegroundColor Yellow }
function Write-Err([string]$Text)  { Write-Host "  [XATO] $Text" -ForegroundColor Red }

function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    return (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-PortListening([int]$Port) {
    try { return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop) }
    catch { return $false }
}

function Wait-Tcp([string]$Address, [int]$Port, [int]$TimeoutSec) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $client = New-Object System.Net.Sockets.TcpClient
        try { $client.Connect($Address, $Port); return $true }
        catch { Start-Sleep -Seconds 2 }
        finally { $client.Dispose() }
    }
    return $false
}

# Faqat shu papka ichidan ishga tushgan jarayonlar — tizimdagi boshqa node.exe
# yoki API.exe ga tegmaslik uchun yo'l bo'yicha filtrlaymiz.
function Get-ItmProcess {
    $prefix = $Root.TrimEnd('\') + '\'
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.ExecutablePath -and $_.ExecutablePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
    }
}

function Stop-Itm {
    $procs = @(Get-ItmProcess)
    foreach ($p in $procs) {
        try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch { }
    }
    return $procs.Count
}

function Start-Itm {
    New-Item -ItemType Directory -Force $LogDir | Out-Null

    if (-not (Test-PortListening $BackendPort)) {
        # Publish qilingan API launchSettings.json ni o'qimaydi — portni shu yerda beramiz.
        $env:ASPNETCORE_ENVIRONMENT = "Production"
        $env:ASPNETCORE_URLS        = $BackendUrl
        Start-Process -FilePath $ApiExe -WorkingDirectory $BackendDir -WindowStyle Hidden `
            -RedirectStandardOutput (Join-Path $LogDir "backend.log") `
            -RedirectStandardError  (Join-Path $LogDir "backend.err.log")
    }

    if (-not (Test-PortListening $FrontPort)) {
        $env:NODE_ENV = "production"
        $env:PORT     = "$FrontPort"
        $env:HOSTNAME = "0.0.0.0"
        Start-Process -FilePath $NodeExe -ArgumentList "server.js" -WorkingDirectory $FrontendDir -WindowStyle Hidden `
            -RedirectStandardOutput (Join-Path $LogDir "frontend.log") `
            -RedirectStandardError  (Join-Path $LogDir "frontend.err.log")
    }
}

function Wait-Backend([int]$TimeoutSec = 240) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri "$BackendUrl/api/license/status" -UseBasicParsing -TimeoutSec 5
            if ($r.StatusCode -eq 200) { return $true }
        } catch { }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Wait-Frontend([int]$TimeoutSec = 90) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortListening $FrontPort) { return $true }
        Start-Sleep -Seconds 2
    }
    return $false
}

# VMware/Hyper-V/WSL virtual adapterlari ham IPv4 manzilga ega bo'ladi, lekin ular
# orqali boshqa kompyuterlar kira olmaydi. Shuning uchun default gateway'i bor
# adapterlarni oldinga qo'yamiz — foydalanuvchiga birinchi bo'lib o'sha ko'rinadi.
function Get-LanIp {
    try {
        $routed = @(Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue |
                    Sort-Object RouteMetric | Select-Object -ExpandProperty InterfaceIndex)
        $all = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
                 Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' })
        $first = @($all | Where-Object { $routed -contains $_.InterfaceIndex } |
                  Select-Object -ExpandProperty IPAddress)
        $rest  = @($all | Where-Object { $routed -notcontains $_.InterfaceIndex } |
                  Select-Object -ExpandProperty IPAddress)
        return @($first + $rest)
    } catch { @() }
}

function Get-Fingerprint {
    try { (Invoke-RestMethod "$BackendUrl/api/license/fingerprint" -TimeoutSec 5).result.fingerprint }
    catch { $null }
}

function Get-LicenseStatus {
    try { (Invoke-RestMethod "$BackendUrl/api/license/status" -TimeoutSec 5).result }
    catch { $null }
}

function Get-PostgresSettings {
    if (-not (Test-Path $AppSettings)) { return $null }
    try {
        $conn = (Get-Content $AppSettings -Raw | ConvertFrom-Json).ConnectionStrings.DefaultConnection
    } catch { return $null }
    if (-not $conn) { return $null }

    $result = @{ Address = "localhost"; Port = 5432 }
    foreach ($part in $conn.Split(';')) {
        $kv = $part.Split('=', 2)
        if ($kv.Count -ne 2) { continue }
        switch ($kv[0].Trim().ToLowerInvariant()) {
            "host" { $result.Address = $kv[1].Trim() }
            "port" { $p = 0; if ([int]::TryParse($kv[1].Trim(), [ref]$p)) { $result.Port = $p } }
        }
    }
    return $result
}

function Show-BackendLog {
    foreach ($name in @("backend.err.log", "backend.log")) {
        $path = Join-Path $LogDir $name
        if (Test-Path $path) {
            $tail = Get-Content $path -Tail 15 -ErrorAction SilentlyContinue
            if ($tail) {
                Write-Host ""
                Write-Host "  --- $name (oxirgi satrlar) ---" -ForegroundColor DarkGray
                $tail | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
            }
        }
    }
}
