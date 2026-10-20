param(
  [Parameter(Mandatory = $true)]
  [string]$SetupPath,
  [switch]$UpgradeFromLatestRelease
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$version = (Get-Content (Join-Path $repoRoot "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json).version
$installDirectory = Join-Path $env:LOCALAPPDATA "R0"
$uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\R0"
$menuKeys = @(
  "HKCU:\Software\Classes\*\shell\R0\command",
  "HKCU:\Software\Classes\Directory\shell\R0\command",
  "HKCU:\Software\Classes\Directory\Background\shell\R0\command"
)

function Invoke-Installer {
  param([string]$Path)

  $process = Start-Process -FilePath $Path -ArgumentList "/S" -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    throw "Installer '$Path' failed with exit code $($process.ExitCode)."
  }
}

if ($UpgradeFromLatestRelease) {
  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/Adshkumar/r0/releases/latest" -Headers @{
    "User-Agent" = "r0-installer-smoke-test"
  }
  $previousSetup = $release.assets |
    Where-Object { $_.name -match "^R0_\d+\.\d+\.\d+_x64-setup\.exe$" } |
    Select-Object -First 1
  $checksums = $release.assets |
    Where-Object { $_.name -eq "SHA256SUMS.txt" } |
    Select-Object -First 1

  if (-not $previousSetup -or -not $checksums) {
    throw "The latest stable release is missing its x64 installer or SHA256SUMS.txt."
  }

  $tempDirectory = Join-Path $env:RUNNER_TEMP "r0-installer-upgrade"
  New-Item -ItemType Directory -Path $tempDirectory -Force | Out-Null
  $previousSetupPath = Join-Path $tempDirectory $previousSetup.name
  $checksumsPath = Join-Path $tempDirectory "SHA256SUMS.txt"
  Invoke-WebRequest -Uri $previousSetup.browser_download_url -OutFile $previousSetupPath
  Invoke-WebRequest -Uri $checksums.browser_download_url -OutFile $checksumsPath

  $checksumPattern = "^\s*([0-9a-fA-F]{64})\s+\*?$([regex]::Escape($previousSetup.name))$"
  $checksumLine = Get-Content -LiteralPath $checksumsPath |
    Where-Object { $_ -match $checksumPattern } |
    Select-Object -First 1
  if (-not $checksumLine -or $checksumLine -notmatch $checksumPattern) {
    throw "SHA-256 checksum for $($previousSetup.name) was not found."
  }

  $expectedChecksum = $Matches[1]
  $actualChecksum = (Get-FileHash -LiteralPath $previousSetupPath -Algorithm SHA256).Hash
  if ($actualChecksum -ne $expectedChecksum) {
    throw "Checksum verification failed for the previous release installer."
  }

  Write-Host "Installing previous stable release $($release.tag_name) before testing the upgrade..."
  Invoke-Installer -Path $previousSetupPath
  if (-not (Test-Path (Join-Path $installDirectory "r0.exe"))) {
    throw "The previous release did not install to $installDirectory."
  }
}

Write-Host "Installing candidate version $version..."
Invoke-Installer -Path (Resolve-Path $SetupPath).Path

if (-not (Test-Path (Join-Path $installDirectory "r0.exe"))) {
  throw "r0.exe was not installed to $installDirectory."
}

$installedApp = Get-ItemProperty -LiteralPath $uninstallKey
if ($installedApp.Publisher -ne "Adarsh Kumar") {
  throw "Publisher is '$($installedApp.Publisher)', expected 'Adarsh Kumar'."
}
if ($installedApp.DisplayVersion -ne $version) {
  throw "Installed version is '$($installedApp.DisplayVersion)', expected '$version'."
}

foreach ($key in $menuKeys) {
  $command = (Get-Item -LiteralPath $key).GetValue("")
  if ($command -notlike "*r0.exe*") {
    throw "Missing Open with R0 command at $key."
  }
}

$uninstaller = Join-Path $installDirectory "uninstall.exe"
$uninstall = Start-Process -FilePath $uninstaller -ArgumentList @("/S", "_?=$installDirectory") -Wait -PassThru
if ($uninstall.ExitCode -ne 0) {
  throw "Uninstaller failed with exit code $($uninstall.ExitCode)."
}

foreach ($key in $menuKeys) {
  if (Test-Path -LiteralPath (Split-Path $key -Parent)) {
    throw "Uninstall left $key behind."
  }
}

Write-Host "Windows installer smoke test passed for version $version."
