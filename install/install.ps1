<#
.SYNOPSIS
Installs DataMind MCP while preserving the existing MCP credential protocol.
#>
param(
    [Parameter(Mandatory = $true)][string]$Tool,
    [Parameter(Mandatory = $true)][string]$ApiBase,
    [Parameter(Mandatory = $true)][string]$Credential,
    [Parameter(Mandatory = $true)][string]$MasterKey,
    [string]$Version = "latest",
    [string]$ReleaseBase = "https://github.com/hujiangyi/data-mind-mcp/releases/download",
    [string]$BinaryUrl = "",
    [switch]$SkipChecksum
)

$ErrorActionPreference = "Stop"

if ($Tool -notin @("claude-desktop", "claude-code", "cursor", "vscode", "opencode", "continue")) {
    throw "Unsupported tool: $Tool"
}
if ($ApiBase -notmatch "^https?://\S+$") {
    throw "--ApiBase must be an HTTP or HTTPS URL"
}

$Arch = if ([Environment]::Is64BitOperatingSystem) { "amd64" } else { "386" }
$InstallDir = Join-Path $env:USERPROFILE ".local\bin"
$BinaryPath = Join-Path $InstallDir "datamind-mcp.js"
$Asset = "datamind-mcp-windows-$Arch.js"
$TemporaryBinary = Join-Path $InstallDir ".datamind-mcp-$([guid]::NewGuid().ToString('N')).tmp"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

function Get-ReleaseRoot([string]$Base, [string]$ReleaseVersion) {
    $baseRoot = $Base.TrimEnd("/")
    if ($ReleaseVersion -eq "latest" -and $baseRoot.EndsWith("/download")) {
        return "$($baseRoot.Substring(0, $baseRoot.Length - 8))/latest/download"
    }
    return "$baseRoot/$ReleaseVersion"
}

try {
    $ReleaseRoot = Get-ReleaseRoot $ReleaseBase $Version
    $DownloadUrl = if ($BinaryUrl) { $BinaryUrl } else { "$ReleaseRoot/$Asset" }
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $TemporaryBinary
    if (-not (Test-Path $TemporaryBinary) -or (Get-Item $TemporaryBinary).Length -eq 0) {
        throw "Downloaded MCP file is empty"
    }
    if (-not $BinaryUrl -and -not $SkipChecksum) {
        $ChecksumPath = "$TemporaryBinary.checksums"
        Invoke-WebRequest -Uri "$ReleaseRoot/checksums.txt" -OutFile $ChecksumPath
        $ChecksumLine = Get-Content $ChecksumPath | Where-Object { $_ -match "\s$([regex]::Escape($Asset))$" } | Select-Object -First 1
        $Expected = ($ChecksumLine -split "\s+")[0]
        $Actual = (Get-FileHash -Algorithm SHA256 -Path $TemporaryBinary).Hash.ToLowerInvariant()
        if (-not $Expected -or $Actual -ne $Expected.ToLowerInvariant()) {
            throw "Checksum verification failed for $Asset"
        }
        Remove-Item -Force $ChecksumPath
    }
    Move-Item -Force $TemporaryBinary $BinaryPath
}
finally {
    if (Test-Path $TemporaryBinary) { Remove-Item -Force $TemporaryBinary }
}

function Write-Config([string]$ConfigPath) {
    $ConfigDir = Split-Path $ConfigPath -Parent
    New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
    if (Test-Path $ConfigPath) {
        $Root = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    } else {
        $Root = [pscustomobject]@{}
    }
    if (-not $Root.PSObject.Properties["mcpServers"]) {
        $Root | Add-Member -NotePropertyName mcpServers -NotePropertyValue ([pscustomobject]@{})
    }
    $NodePath = (Get-Command node -ErrorAction Stop).Source
    $Server = [pscustomobject]@{
        command = $NodePath
        args = @($BinaryPath)
        env = [pscustomobject]@{
            DATAMIND_API_BASE = $ApiBase
            DATAMIND_CREDENTIAL = $Credential
            DATAMIND_MASTER_KEY = $MasterKey
        }
    }
    $Root.mcpServers | Add-Member -NotePropertyName datamind -NotePropertyValue $Server -Force
    $TemporaryConfig = "$ConfigPath.$([guid]::NewGuid().ToString('N')).tmp"
    $Root | ConvertTo-Json -Depth 10 | Set-Content $TemporaryConfig -Encoding UTF8
    Move-Item -Force $TemporaryConfig $ConfigPath
}

switch ($Tool) {
    "claude-desktop" { $ConfigPath = Write-Config (Join-Path $env:APPDATA "Claude\claude_desktop_config.json") }
    "claude-code" { $ConfigPath = Write-Config (Join-Path $env:USERPROFILE ".claude\settings.json") }
    "cursor" { $ConfigPath = Write-Config (Join-Path $env:APPDATA "Cursor\mcp.json") }
    "vscode" { $ConfigPath = Write-Config (Join-Path $env:APPDATA "Code\User\settings.json") }
    "opencode" { $ConfigPath = Write-Config (Join-Path $env:USERPROFILE ".opencode.json") }
    "continue" { $ConfigPath = Write-Config (Join-Path $env:USERPROFILE ".continue\config.json") }
}

if ($Tool -eq "claude-code") {
    $SkillDir = Join-Path $env:USERPROFILE ".claude\skills\data-mind-query"
    New-Item -ItemType Directory -Force -Path $SkillDir | Out-Null
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/hujiangyi/data-mind-mcp/main/skills/data-mind-query/SKILL.md" `
        -OutFile (Join-Path $SkillDir "SKILL.md")
}

$UseBody = @{ credential = $Credential; masterKey = $MasterKey } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "$($ApiBase.TrimEnd('/'))/api/v1/mcp/setup/use" `
    -Method Post -ContentType "application/json" -Body $UseBody | Out-Null

Write-Host "DataMind MCP installed at $BinaryPath"
Write-Host "MCP configuration updated at $ConfigPath"
Write-Host "The cloud API key is configured separately in the Go service."
