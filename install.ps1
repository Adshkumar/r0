# r0 one-line installer for Windows
$ErrorActionPreference = 'Stop'

$setupUrl = 'https://github.com/Adshkumar/r0/releases/latest/download/r0-latest-setup.exe'
$msiUrl   = 'https://github.com/Adshkumar/r0/releases/latest/download/r0-latest.msi'

$tmp = Join-Path $env:TEMP 'r0-setup.exe'

Write-Host "Downloading r0 (latest)..." -ForegroundColor Cyan
try {
  Invoke-WebRequest -Uri $setupUrl -OutFile $tmp -UseBasicParsing
} catch {
  Write-Host "Setup.exe unavailable, falling back to MSI..." -ForegroundColor Yellow
  $tmp = Join-Path $env:TEMP 'r0-latest.msi'
  Invoke-WebRequest -Uri $msiUrl -OutFile $tmp -UseBasicParsing
  Start-Process msiexec.exe -ArgumentList "/i `"$tmp`" /qb" -Wait
  Write-Host "r0 installed. Launch it from the Start Menu." -ForegroundColor Green
  return
}

Write-Host "Launching installer..." -ForegroundColor Cyan
Start-Process -FilePath $tmp -Wait
Write-Host "r0 installed. Launch it from the Start Menu." -ForegroundColor Green
