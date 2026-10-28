param([string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $projectRoot 'dist\HomeKanban-Source-v0.18.59-Public' }
$sourceRoot = [IO.Path]::GetFullPath($OutputDirectory)
$archivePath = "$sourceRoot.zip"
if ((Test-Path -LiteralPath $sourceRoot) -or (Test-Path -LiteralPath $archivePath)) { throw 'Choose a new output directory; existing source exports are never overwritten.' }
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'public-files.json') -Raw | ConvertFrom-Json
foreach ($relative in $manifest.files) {
    if ([IO.Path]::IsPathRooted($relative) -or $relative -match '(^|/)\.\.(/|$)') { throw 'Invalid public file path.' }
    $original = Join-Path $projectRoot $relative
    if (-not (Test-Path -LiteralPath $original -PathType Leaf)) { throw "Missing public file: $relative" }
}
New-Item -ItemType Directory -Force $sourceRoot | Out-Null
foreach ($relative in $manifest.files) {
    $target = Join-Path $sourceRoot $relative
    New-Item -ItemType Directory -Force (Split-Path -Parent $target) | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot $relative) -Destination $target
}
Compress-Archive -LiteralPath $sourceRoot -DestinationPath $archivePath
$archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
"$archiveHash  $([IO.Path]::GetFileName($archivePath))" | Set-Content -LiteralPath "$archivePath.sha256" -Encoding ASCII
Write-Output $archivePath
