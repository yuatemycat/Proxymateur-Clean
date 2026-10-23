<#
.SYNOPSIS
    `Google Gemini Desktop` GUI launcher: routes through Proxymateur when available, falls back to native instantly.

.DESCRIPTION
    Decides on every launch whether Google Gemini Desktop should route through Proxymateur or native Google account:

      - If Proxymateur is running and enabled (and toggle is OFF):
          Fetches /v1/models (timeout 1.5s), sets gateway proxy environment for the Gemini process,
          and starts Google Gemini in gateway mode without touching your native account quota.
      - If Proxymateur is stopped, disabled, unreachable, or toggle is ON:
          Immediately launches real `Gemini.exe` natively with zero delay and no blocking warnings.

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

function Resolve-RealGemini {
    if ($env:GEMINI_REAL_PATH -and (Test-Path -LiteralPath $env:GEMINI_REAL_PATH)) { return $env:GEMINI_REAL_PATH }

    # Check config
    $cfgPath = Join-Path (Resolve-DataDir) 'gui_config.json'
    if (Test-Path -LiteralPath $cfgPath) {
        try {
            $cfg = Get-Content -LiteralPath $cfgPath -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json
            if ($cfg.gemini_desktop_executable -and (Test-Path -LiteralPath $cfg.gemini_desktop_executable)) {
                return $cfg.gemini_desktop_executable
            }
        } catch {}
    }

    # Standard locations
    if ($env:LOCALAPPDATA) {
        $candidates = @(
            (Join-Path $env:LOCALAPPDATA 'Google\Gemini\Gemini.exe'),
            (Join-Path $env:LOCALAPPDATA 'Google\Gemini\GeminiAppLauncher.exe')
        )
        foreach ($c in $candidates) {
            if (Test-Path -LiteralPath $c) { return $c }
        }

        # Check versioned app-* subfolder
        $appDirs = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA 'Google\Gemini') -Directory -Filter 'app-*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending
        foreach ($dir in $appDirs) {
            $c = Join-Path $dir.FullName 'Gemini.exe'
            if (Test-Path -LiteralPath $c) { return $c }
        }
    }

    if ($env:ProgramFiles) {
        $c = Join-Path $env:ProgramFiles 'Google\Gemini\Gemini.exe'
        if (Test-Path -LiteralPath $c) { return $c }
    }

    $found = Get-Command Gemini.exe -All -CommandType Application -ErrorAction SilentlyContinue |
        Where-Object { $_.Source -match 'Google[\\/]Gemini' } |
        Select-Object -First 1
    if ($found) { return $found.Source }

    return $null
}

$exePath = Resolve-RealGemini
if (-not $exePath) {
    [Console]::Error.WriteLine('Real Gemini.exe not found. Set GEMINI_REAL_PATH.')
    exit 3
}

$proxyCfg = Read-ProxyConfig
$modeOverride = $env:PROXYMATEUR_AGY_MODE
$useNative = ($modeOverride -eq 'native') -or ($proxyCfg -and ($proxyCfg.allow_standard_gemini_models -eq $true))

if (-not $useNative -and $proxyCfg -and $proxyCfg.preferred_account_id) {
    $accFile = Join-Path (Resolve-DataDir) "accounts\$($proxyCfg.preferred_account_id).json"
    if (Test-Path -LiteralPath $accFile) {
        try {
            $accJson = Get-Content -LiteralPath $accFile -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json
            if ($accJson.proxy_disabled -eq $true) {
                $useNative = $true
            }
        } catch {}
    }
}

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
        
        # Configure child process proxy environment
        $env:HTTP_PROXY  = $url
        $env:HTTPS_PROXY = $url
        $env:ALL_PROXY   = $url
        $env:AGY_LLM_GATEWAY_URL    = $url
        $env:AGY_LLM_GATEWAY_MODELS = ($models -join ',')
        if ($key) { $env:AGY_LLM_GATEWAY_API_KEY = $key }

        $flashModel = $models | Where-Object { $_ -match 'flash' -and $_ -match 'high' } | Select-Object -First 1
        if (-not $flashModel) { $flashModel = $models | Where-Object { $_ -match 'flash' } | Select-Object -First 1 }
        if (-not $flashModel) { $flashModel = $models[0] }

        $flashLiteModel = $models | Where-Object { $_ -match 'flash-lite' -or $_ -match 'flash_lite' } | Select-Object -First 1
        if (-not $flashLiteModel) { $flashLiteModel = $flashModel }

        $proModel = $models | Where-Object { ($_ -match 'pro' -or $_ -match 'argon' -or $_ -match 'opus' -or $_ -match 'sonnet') -and $_ -match 'high' } | Select-Object -First 1
        if (-not $proModel) { $proModel = $models | Where-Object { $_ -match 'pro' -or $_ -match 'argon' -or $_ -match 'opus' -or $_ -match 'sonnet' } | Select-Object -First 1 }
        if (-not $proModel) { $proModel = $models[0] }

        $env:AGY_LLM_GATEWAY_TIER_FLASH      = $flashModel
        $env:AGY_LLM_GATEWAY_TIER_FLASH_LITE = $flashLiteModel
        $env:AGY_LLM_GATEWAY_TIER_PRO        = $proModel

        if ($dryRun) { Write-Host "[gemini] mode=gateway  $url  models=$($models.Count)  args=$($appArgs -join ' ')" -ForegroundColor DarkGray; exit 0 }
        
        $workDir = Split-Path -Parent $exePath
        if ($appArgs -and $appArgs.Count -gt 0) {
            Start-Process -FilePath $exePath -ArgumentList $appArgs -WorkingDirectory $workDir -WindowStyle Normal
        } else {
            Start-Process -FilePath $exePath -WorkingDirectory $workDir -WindowStyle Normal
        }
        exit 0
    }
}

# ----------------- Fallback to Native (Zero delay, No warning) -----------------
Get-ChildItem Env: | Where-Object { $_.Name -like 'AGY_LLM_GATEWAY*' } |
    ForEach-Object { Remove-Item -LiteralPath ("Env:" + $_.Name) -ErrorAction SilentlyContinue }

if ($proxyCfg -and $proxyCfg.upstream_proxy -and $proxyCfg.upstream_proxy.enabled -and $proxyCfg.upstream_proxy.url) {
    $env:HTTP_PROXY  = $proxyCfg.upstream_proxy.url
    $env:HTTPS_PROXY = $proxyCfg.upstream_proxy.url
    $env:ALL_PROXY   = $proxyCfg.upstream_proxy.url
} else {
    Remove-Item Env:HTTP_PROXY -ErrorAction SilentlyContinue
    Remove-Item Env:HTTPS_PROXY -ErrorAction SilentlyContinue
    Remove-Item Env:ALL_PROXY -ErrorAction SilentlyContinue
}

if ($printModels) { [Console]::Error.WriteLine('Native mode: models come from Google account.'); exit 0 }
if ($dryRun) { Write-Host "[gemini] mode=native  real=$exePath  args=$($appArgs -join ' ')" -ForegroundColor DarkGray; exit 0 }

$workDir = Split-Path -Parent $exePath
if ($appArgs -and $appArgs.Count -gt 0) {
    Start-Process -FilePath $exePath -ArgumentList $appArgs -WorkingDirectory $workDir -WindowStyle Normal
} else {
    Start-Process -FilePath $exePath -WorkingDirectory $workDir -WindowStyle Normal
}
exit 0
