# r0 Windows Installer
# Served from https://r0-ide.vercel.app/install

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  r0 Installer" -ForegroundColor Magenta
Write-Host "  ------------" -ForegroundColor DarkGray
Write-Host ""

try {
    $scriptUrl = "https://raw.githubusercontent.com/Adshkumar/r0/main/scripts/install/install-windows.ps1"
    Invoke-Expression (Invoke-RestMethod -Uri $scriptUrl -Headers @{ "User-Agent" = "r0-ide-installer" })
}
catch {
    Write-Host ""
    Write-Host "  Failed to start installer." -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Manual download: https://github.com/Adshkumar/r0/releases/latest" -ForegroundColor Yellow
    exit 1
}
