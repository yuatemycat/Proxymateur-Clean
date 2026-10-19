<#
.SYNOPSIS
    `Antigravity 2.0` GUI launcher: routes through Proxymateur when available, falls back to native instantly.

.DESCRIPTION
    Decides on every launch whether Antigravity 2.0 should connect through Proxymateur or native Google login:

      - If Proxymateur is running and enabled (and toggle is OFF):
          Fetches /v1/models (timeout 1.5s), sets AGY_LLM_GATEWAY_* for the Antigravity GUI process only,
          and starts Antigravity in gateway mode without touching your native account quota or Windows User Variables.
      - If Proxymateur is stopped, disabled, unreachable, or toggle is ON:
          Immediately strips any leftover AGY_LLM_GATEWAY_* variables and launches real `Antigravity.exe`
          natively with zero delay and no blocking warnings.

    Works with Windows PowerShell 5.1 and PowerShell 7+.
#>

$ErrorActionPreference = 'SilentlyContinue'

$launcherFlags = @('--gateway-print-models', '--gateway-dry-run')
$printModels = $args -contains '--gateway-print-models'
$dryRun      = $args -contains '--gateway-dry-run'
$appArgs     = @($args | Where-Object { $launcherFlags -notcontains $_ })

function Resolve-DataDir {
    if ($env:ABV_DATA_DIR) { return $env:ABV_DATA_DIR }
    $home_ = [Environment]::GetFolderPath('UserProfile')
    foreach ($name in '.proxymateur_location', '.antigravity_tools_location') {
        $pointer = Join-Path $home_ $name
        if (Test-Path -LiteralPath $pointer) {
            $target = (Get-Content -LiteralPath $pointer -Raw -ErrorAction SilentlyContinue).Trim()
            if ($target) { return $target }
        }
    }
    return (Join-Path $home_ '.proxymateur')
}

function Read-ProxyConfig {
    $path = Join-Path (Resolve-DataDir) 'gui_config.json'
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    try { return (Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json).proxy } catch { return $null }
}

function Resolve-RealAntigravity {
    if ($env:ANTIGRAVITY_REAL_PATH -and (Test-Path -LiteralPath $env:ANTIGRAVITY_REAL_PATH)) { return $env:ANTIGRAVITY_REAL_PATH }
    
    # Standard locations
    if ($env:LOCALAPPDATA) {
        $candidate = Join-Path $env:LOCALAPPDATA 'Programs\antigravity\Antigravity.exe'
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    if ($env:ProgramFiles) {
        $candidate = Join-Path $env:ProgramFiles 'Antigravity\Antigravity.exe'
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    $found = Get-Command Antigravity.exe -All -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($found) { return $found.Source }
    return $null
}

$exePath = Resolve-RealAntigravity
if (-not $exePath) {
    [Console]::Error.WriteLine('Real Antigravity.exe not found. Set ANTIGRAVITY_REAL_PATH.')
    exit 3
}

$proxyCfg = Read-ProxyConfig
$modeOverride = $env:PROXYMATEUR_AGY_MODE
$useNative = ($modeOverride -eq 'native') -or ($proxyCfg -and ($proxyCfg.allow_standard_gemini_models -eq $true))

if (-not $useNative) {
    $port = if ($proxyCfg -and $proxyCfg.port) { $proxyCfg.port } else { 8045 }
    $url  = if ($env:PROXYMATEUR_URL) { $env:PROXYMATEUR_URL.TrimEnd('/') } else { "http://127.0.0.1:$port" }
    $key  = if ($env:PROXYMATEUR_API_KEY) { $env:PROXYMATEUR_API_KEY } elseif ($proxyCfg) { $proxyCfg.api_key } else { $null }

    $headers = @{}
    if ($key) { $headers['Authorization'] = "Bearer $key" }

    $models = $null
    try {
        $resp = Invoke-RestMethod -Uri "$url/v1/models" -Headers $headers -TimeoutSec 2 -ErrorAction Stop
        $ids = if ($resp.data) { @($resp.data | ForEach-Object { $_.id }) }
               elseif ($resp.models) { @($resp.models | ForEach-Object { ($_.name -replace '^models/', '') }) }
               else { @() }
        $isArgonOnly = ($proxyCfg.gateway_routing_mode -eq 'argon_only') -or ($modeOverride -eq 'argon_only')
        $include = if ($isArgonOnly) { '^gemini-4-argon' } elseif ($env:PROXYMATEUR_AGY_INCLUDE) { $env:PROXYMATEUR_AGY_INCLUDE } else { '^(gemini|claude|gpt)-' }
        $exclude = if ($env:PROXYMATEUR_AGY_EXCLUDE) { $env:PROXYMATEUR_AGY_EXCLUDE } else { 'imagen|embed|tts|audio|veo|live|omni|-exp|tiered|\*|\.x(-|$)' }
        $models = @($ids | Where-Object { $_ -and ($_ -match $include) -and ($_ -notmatch $exclude) } | Sort-Object -Unique)
        if ($isArgonOnly -and ($models.Count -eq 0)) {
            $models = @('gemini-4-argon', 'gemini-4-argon-high', 'gemini-4-argon-medium', 'gemini-4-argon-low')
        }
    } catch {
        $models = $null
    }

    if ($models -and $models.Count -gt 0) {
        if ($printModels) { $models; exit 0 }
        Get-ChildItem Env: | Where-Object { $_.Name -like 'AGY_LLM_GATEWAY*' } |
            ForEach-Object { Remove-Item -LiteralPath ("Env:" + $_.Name) -ErrorAction SilentlyContinue }
        
        $env:AGY_LLM_GATEWAY_URL    = $url
        $env:AGY_LLM_GATEWAY_MODELS = ($models -join ',')
        if ($key) { $env:AGY_LLM_GATEWAY_API_KEY = $key }

        if ($dryRun) { Write-Host "[antigravity] mode=gateway  $url  models=$($models.Count)  args=$($appArgs -join ' ')" -ForegroundColor DarkGray; exit 0 }
        
        if ($appArgs -and $appArgs.Count -gt 0) {
            Start-Process -FilePath $exePath -ArgumentList $appArgs -WindowStyle Normal
        } else {
            Start-Process -FilePath $exePath -WindowStyle Normal
        }
        exit 0
    }
}

# ----------------- Fallback to Native (Zero delay, No warning) -----------------
Get-ChildItem Env: | Where-Object { $_.Name -like 'AGY_LLM_GATEWAY*' } |
    ForEach-Object { Remove-Item -LiteralPath ("Env:" + $_.Name) -ErrorAction SilentlyContinue }

if ($printModels) { [Console]::Error.WriteLine('Native mode: models come from Google account.'); exit 0 }
if ($dryRun) { Write-Host "[antigravity] mode=native  real=$exePath  args=$($appArgs -join ' ')" -ForegroundColor DarkGray; exit 0 }

if ($appArgs -and $appArgs.Count -gt 0) {
    Start-Process -FilePath $exePath -ArgumentList $appArgs -WindowStyle Normal
} else {
    Start-Process -FilePath $exePath -WindowStyle Normal
}
exit 0
