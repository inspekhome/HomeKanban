param(
    [ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version = '0.18.8',
    [string]$OutputDirectory,
    [string]$NodeLicense
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $projectRoot "dist\HomeKanban-Windows-v$Version" }
$packageRoot = [IO.Path]::GetFullPath($OutputDirectory)
$archivePath = "$packageRoot.zip"
if ((Test-Path -LiteralPath $packageRoot) -or (Test-Path -LiteralPath $archivePath)) { throw 'Choose a new output directory; existing releases are never overwritten.' }
$nodeSource = if ($env:HOMEKANBAN_NODE) { $env:HOMEKANBAN_NODE } elseif ($env:SOLOINSPECT_NODE) { $env:SOLOINSPECT_NODE } else { (Get-Command node.exe -ErrorAction Stop).Source }
if (-not (Test-Path -LiteralPath $nodeSource)) { throw 'Set HOMEKANBAN_NODE to a Node.js 24 executable.' }
$runtimeVersion = (& $nodeSource -p 'process.version').Trim()
if ($LASTEXITCODE -ne 0 -or $runtimeVersion -notmatch '^v24\.') { throw 'A Node.js 24 runtime is required.' }
if (-not $NodeLicense) {
    if ($runtimeVersion -ne 'v24.19.0') { throw 'The included license is for Node.js 24.19.0. For another 24.x runtime, supply -NodeLicense with its complete upstream LICENSE and update THIRD_PARTY_NOTICES.md.' }
    $NodeLicense = Join-Path $projectRoot 'docs\NODE-LICENSE.txt'
}
if (-not (Test-Path -LiteralPath $NodeLicense -PathType Leaf)) { throw 'The complete Node.js third-party license file is required.' }
$manifest = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'public-files.json') | ConvertFrom-Json
$appFiles = @($manifest.files | Where-Object { $_.StartsWith('app/') })
if ($appFiles.Count -eq 0) { throw 'Public application manifest is empty.' }
foreach ($relative in $appFiles) {
    if ($relative -match '(^|/)\.\.(/|$)' -or [IO.Path]::IsPathRooted($relative)) { throw 'Invalid public file path.' }
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $relative) -PathType Leaf)) { throw "Missing application file: $relative" }
}
New-Item -ItemType Directory -Force (Join-Path $packageRoot 'runtime') | Out-Null
Copy-Item -LiteralPath $nodeSource -Destination (Join-Path $packageRoot 'runtime\node.exe')
foreach ($relative in $appFiles) {
    $target = Join-Path $packageRoot $relative
    New-Item -ItemType Directory -Force (Split-Path -Parent $target) | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot $relative) -Destination $target
}
& $nodeSource (Join-Path $PSScriptRoot 'bundle-frontend.js') $packageRoot
if ($LASTEXITCODE -ne 0) { throw 'Frontend bundling failed.' }
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs\USER-GUIDE.md') -Destination (Join-Path $packageRoot 'USER-GUIDE.md') -Force
foreach ($notice in @('LICENSE', 'THIRD_PARTY_NOTICES.md')) { Copy-Item -LiteralPath (Join-Path $projectRoot $notice) -Destination (Join-Path $packageRoot $notice) }
Copy-Item -LiteralPath $NodeLicense -Destination (Join-Path $packageRoot 'runtime\LICENSE.txt')
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$appIcon = Join-Path $projectRoot 'app\public\branding\homekanban.ico'
if (-not (Test-Path -LiteralPath $appIcon)) { throw 'The HomeKanban house icon is required.' }
& $compiler /nologo /target:winexe /reference:System.Windows.Forms.dll "/win32icon:$appIcon" "/out:$packageRoot\HomeKanban.exe" (Join-Path $PSScriptRoot 'Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
@'
@echo off
cd /d "%~dp0"
runtime\node.exe app\server.js
pause
'@ | Set-Content -LiteralPath (Join-Path $packageRoot 'Start-with-console.cmd') -Encoding ASCII
Compress-Archive -LiteralPath $packageRoot -DestinationPath $archivePath
$archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
"$archiveHash  $([IO.Path]::GetFileName($archivePath))" | Set-Content -LiteralPath "$archivePath.sha256" -Encoding ASCII
Write-Output $archivePath
