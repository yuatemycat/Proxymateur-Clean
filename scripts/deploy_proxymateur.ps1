<#
.SYNOPSIS
  Deploys the Proxymateur build (proxymateur.exe) over the old "Antigravity Tools" install and
  (optionally) removes the old name's footprint. The data dir (~\.proxymateur, formerly
  ~\.antigravity_tools) is never modified or deleted.

.DESCRIPTION
  Default is a DRY RUN: nothing is changed, the plan is printed.

  Phase 1  -Apply            backup -> stop the app -> copy the new exe to the bin + install dirs
                             -> start it -> wait (max 30 s) for ~\.proxymateur to appear and
                             ~\.antigravity_tools to disappear (both states are printed)
  Phase 2  -Apply -Cleanup   (run AFTER you confirmed the app works and the migration happened)
                             remove the old Add/Remove + vendor registry keys, rename the install
                             folder to "Proxymateur", replace the old shortcuts with new ones,
                             delete legacy antigravity-tools.exe / .exe.bak* files (only where
                             proxymateur.exe exists), rewrite a stale HKCU Run value, and report
                             leftover legacy data-dir pointer files (report only).

.EXAMPLE
  .\scripts\deploy_proxymateur.ps1                      # dry run of phase 1
  .\scripts\deploy_proxymateur.ps1 -Apply               # phase 1
  .\scripts\deploy_proxymateur.ps1 -Cleanup             # dry run of phase 2
  .\scripts\deploy_proxymateur.ps1 -Apply -Cleanup      # phase 2
#>
[CmdletBinding()]
param(
    [switch]$Apply,
    [switch]$Cleanup,
    [string]$Source = 'E:\02_Projects\Antigravity-Manager\src-tauri\target\release\proxymateur.exe',
    [string]$BinDir = 'E:\03_Devops\AntigravityManager\bin',
    [string]$OldInstallDir = 'E:\01_Apps\Installed\Antigravity Tools',
    [string]$NewInstallDir = 'E:\01_Apps\Installed\Proxymateur'
)

$ErrorActionPreference = 'Stop'
$newDataDir  = Join-Path $env:USERPROFILE '.proxymateur'
$oldDataDir  = Join-Path $env:USERPROFILE '.antigravity_tools'
$newPointer  = Join-Path $env:USERPROFILE '.proxymateur_location'
$oldPointer  = Join-Path $env:USERPROFILE '.antigravity_tools_location'
$oldLocal    = Join-Path $env:LOCALAPPDATA 'com.lbjlaq.antigravity-tools'
$oldRoam     = Join-Path $env:APPDATA 'com.lbjlaq.antigravity-tools'
$newLocal    = Join-Path $env:LOCALAPPDATA 'com.proxymateur.app'
$newRoam     = Join-Path $env:APPDATA 'com.proxymateur.app'
$exeName     = 'proxymateur.exe'
$oldExeName  = 'antigravity-tools.exe'
$procNew     = 'proxymateur'
$procOld     = 'antigravity-tools'
$runKey      = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$runValue    = 'Proxymateur'

function Step($msg) { Write-Host ("[{0}] {1}" -f ($(if ($Apply) {'DO'} else {'PLAN'}), $msg)) -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "  ok: $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  !!  $msg" -ForegroundColor Yellow }
function Run([scriptblock]$act) { if ($Apply) { & $act } }

# Legacy exe artifacts in a directory: antigravity-tools.exe and antigravity-tools.exe.bak*
function Get-LegacyExes([string]$dir) {
    if (-not (Test-Path -LiteralPath $dir)) { return @() }
    return @(Get-ChildItem -LiteralPath $dir -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ieq $oldExeName -or $_.Name -like "$oldExeName.bak*" })
}

if (-not $Cleanup) {
    # ---------------- Phase 1: backup + deploy ----------------
    if (-not (Test-Path $Source)) { throw "Source exe not found: $Source (build first)" }
    $stamp  = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = Join-Path $env:USERPROFILE ".proxymateur_backup_$stamp"

    # Back up whichever data dir is live: the new one if it already exists, otherwise the legacy one.
    $backupSrc = if (Test-Path $newDataDir) { $newDataDir } else { $oldDataDir }
    $backupLeaf = (Split-Path $backupSrc -Leaf).TrimStart('.')

    Step "Backup data ($backupSrc) + old-identity folders to $backup (logs excluded)"
    Run {
        New-Item -ItemType Directory -Path $backup | Out-Null
        if (Test-Path $backupSrc) { robocopy $backupSrc (Join-Path $backup $backupLeaf) /E /XD logs /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null }
        foreach ($ptr in @($oldPointer, $newPointer)) {
            if (Test-Path $ptr) { Copy-Item -LiteralPath $ptr -Destination (Join-Path $backup (Split-Path $ptr -Leaf)) }
        }
        if (Test-Path $oldLocal) { robocopy $oldLocal (Join-Path $backup 'local_identity') /E /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null }
        if (Test-Path $oldRoam)  { robocopy $oldRoam  (Join-Path $backup 'roaming_identity') /E /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null }
        # robocopy exit codes 0-7 are success
        Ok "backup written: $backup"
    }

    Step "Stop all $exeName / $oldExeName processes (GUI + headless; a locked WebView2 profile cannot be migrated)"
    Run {
        Get-Process -Name $procNew, $procOld -ErrorAction SilentlyContinue | Stop-Process -Force
        Start-Sleep -Seconds 2
        if (Get-Process -Name $procNew, $procOld -ErrorAction SilentlyContinue) { throw "$procNew / $procOld is still running" }
        Ok 'stopped'
    }

    foreach ($dir in @($BinDir, $OldInstallDir, $NewInstallDir) | Select-Object -Unique) {
        Step "Copy new exe -> $dir\$exeName"
        Run {
            if (-not (Test-Path $dir)) { Warn "missing dir, skipped: $dir"; return }
            Copy-Item -Force $Source (Join-Path $dir $exeName)
            Ok 'copied'
        }
    }

    Step "Start $BinDir\$exeName (first launch runs the data-dir + identity migration)"
    Run { Start-Process (Join-Path $BinDir $exeName); Ok 'started' }

    Step "Verify data-dir migration: wait up to 30 s for $newDataDir to exist and $oldDataDir to be gone"
    Run {
        $deadline = (Get-Date).AddSeconds(30)
        do {
            $newThere = Test-Path $newDataDir
            $oldThere = Test-Path $oldDataDir
            if ($newThere -and -not $oldThere) { break }
            Start-Sleep -Seconds 1
        } while ((Get-Date) -lt $deadline)
        Write-Host ("  {0}: {1}" -f $newDataDir, $(if ($newThere) {'EXISTS'} else {'missing'}))
        Write-Host ("  {0}: {1}" -f $oldDataDir, $(if ($oldThere) {'still present'} else {'gone'}))
        if ($newThere -and -not $oldThere) { Ok 'data dir migrated' }
        else { Warn 'migration not confirmed within 30 s; check the app and its logs before running -Cleanup' }
    }

    Write-Host "`nNext: confirm the app opens with your accounts and settings, then check:" -ForegroundColor Cyan
    Write-Host "  - $newLocal\EBWebView exists and $oldLocal is gone"
    Write-Host "  - $newRoam\.window-state.json exists"
    Write-Host "  - ~\.proxymateur\logs contains '[identity-migration]' lines"
    Write-Host "Then run:  .\scripts\deploy_proxymateur.ps1 -Apply -Cleanup"
    if (-not $Apply) { Write-Host "`n(dry run: nothing was changed)" -ForegroundColor Yellow }
    return
}

# ---------------- Phase 2: remove the old name's footprint ----------------
if ($Apply) {
    if (-not (Test-Path (Join-Path $newLocal 'EBWebView'))) { throw "Migration not confirmed: $newLocal\EBWebView missing. Run phase 1 and open the app first." }
    if (Test-Path $oldLocal) { throw "Old folder still present ($oldLocal): migration copied instead of moved. Verify the app, then delete it manually." }
    if (Get-Process -Name $procNew, $procOld -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$OldInstallDir*" }) {
        throw "An instance is running from $OldInstallDir; stop it before renaming that folder."
    }
}

$uninst = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Antigravity Tools'
Step "Remove old Add/Remove entry (registry only; the old uninstaller is NOT run): $uninst"
Run {
    if (Test-Path $uninst) {
        $loc = (Get-ItemProperty $uninst).InstallLocation
        if ($loc) { $loc = $loc.Trim('"') }   # NSIS stores the path wrapped in quotes
        if ($loc -and ($loc.TrimEnd('\') -ne $OldInstallDir.TrimEnd('\'))) { throw "Unexpected InstallLocation '$loc'; refusing to touch it." }
        Remove-Item $uninst -Recurse -Force; Ok 'removed'
    } else { Ok 'not present' }
}

$vendor = 'HKCU:\Software\lbjlaq'
Step "Remove old vendor key: $vendor"
Run { if (Test-Path $vendor) { Remove-Item $vendor -Recurse -Force; Ok 'removed' } else { Ok 'not present' } }

Step "Rename install folder '$OldInstallDir' -> '$NewInstallDir'"
Run {
    if (-not (Test-Path $OldInstallDir)) { Ok 'old folder absent'; return }
    if (Test-Path $NewInstallDir) { throw "$NewInstallDir already exists" }
    Rename-Item -LiteralPath $OldInstallDir -NewName (Split-Path $NewInstallDir -Leaf)
    Ok 'renamed'
}

$desktop  = [Environment]::GetFolderPath('Desktop')
$programs = [Environment]::GetFolderPath('Programs')
foreach ($dir in @($desktop, $programs)) {
    $old = Join-Path $dir 'Antigravity Tools.lnk'
    $new = Join-Path $dir 'Proxymateur.lnk'
    Step "Replace shortcut $old -> $new"
    Run {
        $target = Join-Path $NewInstallDir $exeName
        if (-not (Test-Path $target)) { Warn "target missing, not creating $new"; return }
        $ws = New-Object -ComObject WScript.Shell
        $lnk = $ws.CreateShortcut($new)
        $lnk.TargetPath = $target
        $lnk.WorkingDirectory = $NewInstallDir
        $lnk.IconLocation = "$target,0"
        $lnk.Save()
        if (Test-Path $old) { Remove-Item $old -Force }
        Ok 'done'
    }
}

# Legacy exe files: removed only where the new exe is present, and never while an old-name process runs.
foreach ($dir in @($BinDir, $NewInstallDir, $OldInstallDir) | Select-Object -Unique) {
    $legacy = Get-LegacyExes $dir
    if ($legacy.Count -eq 0) { continue }
    Step "Remove legacy exe files in ${dir}: $($legacy.Name -join ', ')"
    Run {
        if (-not (Test-Path -LiteralPath (Join-Path $dir $exeName))) { Warn "$exeName missing in $dir; legacy files kept"; return }
        if (Get-Process -Name $procOld -ErrorAction SilentlyContinue) { Warn "$procOld is running; legacy files kept"; return }
        foreach ($f in (Get-LegacyExes $dir)) { Remove-Item -LiteralPath $f.FullName -Force }
        Ok 'removed'
    }
}

# Legacy autostart: the migrated Run value keeps whatever command it had, which may still name the old exe.
Step "Check HKCU Run value '$runValue' for a legacy exe path"
Run {
    $cur = (Get-ItemProperty -Path $runKey -Name $runValue -ErrorAction SilentlyContinue).$runValue
    if (-not $cur) { Ok 'no Run value (autostart not enabled)'; return }
    if ($cur -notmatch [regex]::Escape($oldExeName)) { Ok "already current: $cur"; return }
    $fixed = $cur -replace [regex]::Escape($oldExeName), $exeName
    $fixed = $fixed -replace ('(?i)' + [regex]::Escape($OldInstallDir)), $NewInstallDir
    $exePath = if ($fixed -match '^\s*"([^"]+)"') { $Matches[1] } else { ($fixed -split '\s+--')[0].Trim() }
    if (-not (Test-Path -LiteralPath $exePath)) { Warn "rewritten target does not exist ($exePath); Run value left unchanged: $cur"; return }
    Set-ItemProperty -Path $runKey -Name $runValue -Value $fixed -Type String
    Ok "rewritten: $cur -> $fixed"
}
if ((Get-ItemProperty -Path $runKey -ErrorAction SilentlyContinue).PSObject.Properties.Name -contains 'Antigravity Tools') {
    Warn "HKCU Run value 'Antigravity Tools' still exists (not modified; remove it manually if unused)."
}

# Legacy data-dir pointer: report only, never delete the data dir.
Step "Report legacy data-dir pointer state"
if ((Test-Path $oldPointer) -and (Test-Path $newPointer)) {
    Warn "$oldPointer still exists while $newPointer exists (report only; nothing deleted)."
    Warn "Review both pointer files and $oldDataDir manually."
} elseif (Test-Path $oldPointer) {
    Warn "$oldPointer exists but $newPointer does not: the pointer migration has not run yet."
} else {
    Ok 'no legacy pointer file'
}
if ((Test-Path $oldDataDir) -and (Test-Path $newDataDir)) {
    Warn "Both $oldDataDir and $newDataDir exist (report only; nothing deleted)."
}

Write-Host "`nNot touched: $newDataDir / $oldDataDir (your data), $BinDir (apart from legacy exe files), the repo, the update/quota settings." -ForegroundColor Cyan
Write-Host "Update your deploy commands: the installed copy now lives in $NewInstallDir as $exeName." -ForegroundColor Cyan
if (-not $Apply) { Write-Host "`n(dry run: nothing was changed)" -ForegroundColor Yellow }
