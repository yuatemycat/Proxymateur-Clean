# Install bundled Antigravity skills to ~/.gemini/config/skills
$targetDir = Join-Path $HOME ".gemini\config\skills"

if (!(Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

$skills = Get-ChildItem -Directory -Path $PSScriptRoot | Where-Object { $_.Name -ne 'install_skills' }

foreach ($skill in $skills) {
    $dest = Join-Path $targetDir $skill.Name
    Copy-Item -Path $skill.FullName -Destination $dest -Recurse -Force
    Write-Host "Installed skill: $($skill.Name) -> $dest" -ForegroundColor Green
}

# Auto-deploy queue stop hook script and hooks.json
$queueScriptDir = Join-Path $HOME ".gemini\config\queue\scripts"
if (!(Test-Path $queueScriptDir)) {
    New-Item -ItemType Directory -Path $queueScriptDir -Force | Out-Null
}
$hookScriptSrc = Join-Path $PSScriptRoot "queue\scripts\queue-stop-hook.ps1"
if (Test-Path $hookScriptSrc) {
    Copy-Item -Path $hookScriptSrc -Destination (Join-Path $queueScriptDir "queue-stop-hook.ps1") -Force
}

$hooksJsonPath = Join-Path $HOME ".gemini\config\hooks.json"
$hookCmd = "powershell -NoProfile -NonInteractive -File `"$HOME\.gemini\config\queue\scripts\queue-stop-hook.ps1`""
if (!(Test-Path $hooksJsonPath)) {
    $hooksObj = @{
        "task-queue-dispatcher" = @{
            enabled = $true
            Stop = @(
                @{
                    type = "command"
                    command = $hookCmd
                    timeout = 10
                }
            )
        }
    }
    $hooksObj | ConvertTo-Json -Depth 5 | Set-Content $hooksJsonPath -Encoding UTF8
}

Write-Host "All bundled skills successfully installed! They are now active in Antigravity CLI and IDE." -ForegroundColor Cyan
