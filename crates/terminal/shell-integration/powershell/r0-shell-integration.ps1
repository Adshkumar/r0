# R0 shell integration for PowerShell (Windows PowerShell 5.1 and pwsh 7+).
# Loaded with -NoExit -Command so the user's profile has already run; wraps the
# prompt to emit OSC 133 marks and OSC 7 directory reports, and uses PSReadLine
# to mark the moment a command starts.
if ($env:R0_SHELL_INTEGRATION_LOADED -or -not $env:R0_SHELL_INTEGRATION) {
    return
}
$env:R0_SHELL_INTEGRATION_LOADED = "1"

$Global:__R0Esc = [char]27
$Global:__R0Bel = [char]7
$Global:__R0CommandRunning = $false
$Global:__R0UserPrompt = $null
if (Test-Path Function:\Prompt) {
    $Global:__R0UserPrompt = (Get-Item Function:\Prompt).ScriptBlock
}

function Global:__R0Osc([string] $payload) {
    return "$Global:__R0Esc]$payload$Global:__R0Bel"
}

function Global:__R0CurrentDirectoryReport {
    $path = $PWD.ProviderPath
    if (-not $path) {
        return ""
    }
    $path = $path -replace '\\', '/'
    if ($path -notmatch '^/') {
        $path = "/$path"
    }
    $host_name = if ($env:COMPUTERNAME) { $env:COMPUTERNAME } else { "localhost" }
    return __R0Osc "7;file://$host_name$path"
}

function Global:Prompt {
    $lastSucceeded = $?
    $nativeExit = $Global:LASTEXITCODE
    $exitCode = if ($lastSucceeded) { 0 } elseif ($nativeExit -is [int] -and $nativeExit -ne 0) { $nativeExit } else { 1 }

    $output = ""
    if ($Global:__R0CommandRunning) {
        $output += __R0Osc "133;D;$exitCode"
        $Global:__R0CommandRunning = $false
    }
    $output += __R0CurrentDirectoryReport
    $output += __R0Osc "133;A"

    $promptText = if ($Global:__R0UserPrompt) { & $Global:__R0UserPrompt } else { "PS $($PWD.Path)> " }
    if ($promptText -is [array]) {
        $promptText = -join $promptText
    }

    return "$output$promptText$(__R0Osc '133;B')"
}

if (Get-Module -Name PSReadLine) {
    Set-PSReadLineKeyHandler -Chord Enter -ScriptBlock {
        $Global:__R0CommandRunning = $true
        [Console]::Write((__R0Osc "133;C"))
        [Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine()
    }
}
