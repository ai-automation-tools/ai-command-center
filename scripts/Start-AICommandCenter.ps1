<#
.SYNOPSIS
    Starts AI Command Center without leaving a console window open.

.DESCRIPTION
    Launches the repo's own electron.exe directly with the repo as the app, so no
    npm or node console hangs around. For a shortcut or Start menu entry, use:

        pwsh -NoProfile -WindowStyle Hidden -File <repo>\scripts\Start-AICommandCenter.ps1

    If the app is already running, the new instance hands off to it and it comes
    to the front (single-instance lock in src/main/main.js).
#>
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'node_modules\electron\dist'
$pathTxt = Join-Path $root 'node_modules\electron\path.txt'

if (-not (Test-Path $pathTxt)) {
    throw "Electron isn't installed in $root. Run 'npm install' there first."
}
$exe = Join-Path $dist (Get-Content $pathTxt -Raw).Trim()
if (-not (Test-Path $exe)) {
    throw "Electron's binary is missing ($exe). Run 'node node_modules/electron/install.js' in $root."
}

# Set by some Node tooling; it would make electron.exe behave as plain Node.
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

Start-Process -FilePath $exe -ArgumentList "`"$root`"" -WorkingDirectory $root
