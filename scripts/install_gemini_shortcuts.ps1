<#
.SYNOPSIS
    Updates Desktop and Start Menu shortcuts for Google Gemini Desktop to use the dynamic gateway launcher.
    Preserves the official icon and creates backups of the original shortcuts (.lnk.bak).
    Use -Restore to revert shortcuts from backups.
#>

param(
    [switch]$Restore
)

$WshShell = New-Object -ComObject WScript.Shell
$vbsLauncher = 'E:\02_Projects\Antigravity-Manager\scripts\gemini_launcher.vbs'
$iconPath = 'C:\Users\X\AppData\Local\Google\Gemini\Gemini.exe'

$targets = @(
    "$env:USERPROFILE\Desktop\Gemini.lnk",
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Gemini.lnk"
)

if ($Restore) {
    foreach ($target in $targets) {
        $backup = "$target.bak"
        if (Test-Path -LiteralPath $backup) {
            Copy-Item -LiteralPath $backup -Destination $target -Force
            Remove-Item -LiteralPath $backup -Force
            Write-Host "Restored original shortcut from $backup -> $target" -ForegroundColor Green
        } else {
            Write-Host "No backup found for $target" -ForegroundColor Yellow
        }
    }
    exit 0
}

foreach ($target in $targets) {
    if (Test-Path -LiteralPath $target) {
        $backup = "$target.bak"
        if (-not (Test-Path -LiteralPath $backup)) {
            Copy-Item -LiteralPath $target -Destination $backup -Force
            Write-Host "Backed up original shortcut to $backup" -ForegroundColor Gray
        }
        
        $shortcut = $WshShell.CreateShortcut($target)
        $shortcut.TargetPath = 'wscript.exe'
        $shortcut.Arguments = "`"$vbsLauncher`""
        $shortcut.WorkingDirectory = Split-Path -Parent $vbsLauncher
        $shortcut.IconLocation = "$iconPath,0"
        $shortcut.Description = 'Google Gemini (Dynamic Proxymateur Gateway)'
        $shortcut.Save()
        
        Write-Host "Updated shortcut: $target -> $vbsLauncher (Icon: $iconPath)" -ForegroundColor Green
    } else {
        Write-Host "Shortcut not found: $target" -ForegroundColor Yellow
    }
}
