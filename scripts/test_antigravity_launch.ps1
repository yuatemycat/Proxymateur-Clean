$ErrorActionPreference = 'Continue'
$exePath = 'C:\Users\X\AppData\Local\Programs\antigravity\Antigravity.exe'

# Fetch models from Proxymateur
$cfg = (Get-Content -LiteralPath 'C:\Users\X\.proxymateur\gui_config.json' -Raw | ConvertFrom-Json).proxy
$headers = @{ 'Authorization' = "Bearer $($cfg.api_key)" }
$resp = Invoke-RestMethod -Uri "http://127.0.0.1:$($cfg.port)/v1/models" -Headers $headers -TimeoutSec 2
$models = @($resp.data | ForEach-Object { $_.id } | Where-Object { $_ -match '^(gemini|claude|gpt)-' -and $_ -notmatch 'imagen|embed|tts|audio|veo|live|omni|-exp|tiered|\*|\.x(-|$)' } | Sort-Object -Unique)

$env:AGY_LLM_GATEWAY_URL = "http://127.0.0.1:$($cfg.port)"
$env:AGY_LLM_GATEWAY_MODELS = ($models -join ',')
$env:AGY_LLM_GATEWAY_API_KEY = $cfg.api_key

Write-Host "[TEST] Gateway URL: $env:AGY_LLM_GATEWAY_URL"
Write-Host "[TEST] Gateway Models count: $($models.Count)"

$p = Start-Process -FilePath $exePath -PassThru
$id = $p.Id
Write-Host "[TEST] Spawned Antigravity PID: $id"

for ($i = 1; $i -le 20; $i++) {
    Start-Sleep -Seconds 1
    $p.Refresh()
    if ($p.HasExited) {
        Write-Host "[TEST] Process $id EXITED at ${i}s with ExitCode: $($p.ExitCode)"
        break
    }
    $all = @(Get-Process -Name *antigravity*, *language_server* -ErrorAction SilentlyContinue)
    Write-Host "[TEST] ${i}s: $($all.Count) processes running. Window: '$($p.MainWindowTitle)'"
}
