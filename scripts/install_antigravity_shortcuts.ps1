<#
.SYNOPSIS
    Updates Desktop and Start Menu shortcuts for Antigravity to use the dynamic gateway launcher.
    Preserves the official icon and creates backups of the original shortcuts (.lnk.bak).
#>

$WshShell = New-Object -ComObject WScript.Shell
$vbsLauncher = 'E:\02_Projects\Antigravity-Manager\scripts\antigravity_launcher.vbs'
$iconPath = 'C:\Users\X\AppData\Local\Programs\antigravity\Antigravity.exe'

$targets = @(
    "$env:USERPROFILE\Desktop\Antigravity.lnk",
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Antigravity.lnk"
)

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
        $shortcut.Description = 'Antigravity (Dynamic Proxymateur Gateway)'
        $shortcut.Save()
        
        Write-Host "Updated shortcut: $target -> $vbsLauncher (Icon: $iconPath)" -ForegroundColor Green
    } else {
        Write-Host "Shortcut not found: $target" -ForegroundColor Yellow
    }
}
