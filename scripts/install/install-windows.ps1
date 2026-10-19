$ErrorActionPreference = "Stop"

$releaseUrl = "https://api.github.com/repos/Adshkumar/r0/releases/latest"
$release = Invoke-RestMethod -Uri $releaseUrl -Headers @{ "User-Agent" = "r0-installer" }
$architecture = $env:PROCESSOR_ARCHITEW6432
if (-not $architecture) {
  $architecture = $env:PROCESSOR_ARCHITECTURE
}

if ($architecture -eq "ARM64") {
  $installerArchitecture = "arm64"
} elseif ($architecture -eq "AMD64") {
  $installerArchitecture = "x64"
} else {
  throw "r0 does not publish a Windows installer for architecture '$architecture'."
}

$version = $release.tag_name -replace "^v", ""
$installerName = "R0_${version}_${installerArchitecture}-setup.exe"
$installerAsset = $release.assets | Where-Object { $_.name -eq $installerName } | Select-Object -First 1
$checksumAsset = $release.assets | Where-Object { $_.name -eq "SHA256SUMS.txt" } | Select-Object -First 1
if (-not $installerAsset -or -not $checksumAsset) {
  throw "The latest r0 release is missing $installerName or SHA256SUMS.txt."
}

$downloadDirectory = Join-Path $env:TEMP "r0-installer"
New-Item -ItemType Directory -Path $downloadDirectory -Force | Out-Null
$installerPath = Join-Path $downloadDirectory $installerName
$checksumPath = Join-Path $downloadDirectory "SHA256SUMS.txt"

Write-Host "Downloading r0 $version ($installerArchitecture)..."
Invoke-WebRequest -Uri $installerAsset.browser_download_url -OutFile $installerPath
Invoke-WebRequest -Uri $checksumAsset.browser_download_url -OutFile $checksumPath

$checksumPattern = "^\s*([0-9a-fA-F]{64})\s+\*?$([regex]::Escape($installerName))$"
$checksumLine = Get-Content -LiteralPath $checksumPath |
  Where-Object { $_ -match $checksumPattern } |
  Select-Object -First 1
if (-not $checksumLine -or $checksumLine -notmatch $checksumPattern) {
  throw "SHA-256 checksum for $installerName was not found in the release."
}

$expectedChecksum = $Matches[1]
$actualChecksum = (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash
if ($actualChecksum -ne $expectedChecksum) {
  throw "Checksum verification failed for $installerName; the installer will not be run."
}

Write-Host "Checksum verified. Starting the r0 installer..."
Start-Process -FilePath $installerPath -Wait
