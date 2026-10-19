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

Write-Host "All bundled skills successfully installed! They are now active in Antigravity CLI and IDE." -ForegroundColor Cyan
