# Arena Kingdom one-command online host launcher
$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))

$Port = 2567
$RuleName = "Arena Kingdom Server TCP $Port"

Write-Host ""
Write-Host "=== Arena Kingdom Online Host ===" -ForegroundColor Cyan
try {
    $PublicIP = (Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 5).ToString().Trim()
} catch {
    $PublicIP = "<unable-to-detect>"
}

Write-Host "LAN server : http://192.168.0.218:$Port"
Write-Host "Public     : http://$PublicIP`:$Port"
Write-Host ""

Write-Host "[1/4] Syncing dependencies..." -ForegroundColor Yellow
npm ci

$rule = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
if (-not $rule) {
    Write-Host "[2/4] Opening Windows Firewall TCP $Port (Administrator approval may appear)..." -ForegroundColor Yellow
    $cmd = "New-NetFirewallRule -DisplayName `"$RuleName`" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any"
    Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList @("-NoProfile","-Command",$cmd)
} else {
    Write-Host "[2/4] Windows Firewall rule already exists." -ForegroundColor Green
}

Write-Host "[3/4] Building Arena Kingdom..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed. Online server was not started." }

Write-Host "[4/4] Starting Arena Kingdom..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Players connect to: http://$PublicIP`:$Port" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor DarkGray
Write-Host ""
npm start
