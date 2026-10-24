<#
.SYNOPSIS
    `agy` launcher: routes through Proxymateur when available, falls back to native instantly.

.DESCRIPTION
    Decides on every launch whether to use Proxymateur or native Google login:

      - If Proxymateur is running and enabled (and toggle is OFF):
          Fetches /v1/models (timeout 1.5s), sets AGY_LLM_GATEWAY_* for the child process only,
          and starts agy in gateway mode without touching your native account quota.
      - If Proxymateur is stopped, disabled (503), unreachable, or toggle is ON:
          Immediately strips any leftover AGY_LLM_GATEWAY_* variables and launches real `agy`
          natively with zero delay and no blocking warnings.

    Works with Windows PowerShell 5.1 and PowerShell 7+.
#>

$ErrorActionPreference = 'SilentlyContinue'

$launcherFlags = @('--gateway-print-models', '--gateway-dry-run', '-px', '--px', '-native', '--native')
$printModels = $args -contains '--gateway-print-models'
$dryRun      = $args -contains '--gateway-dry-run'
$proxyMode   = ($args -contains '-px') -or ($args -contains '--px')
$nativeMode  = ($args -contains '-native') -or ($args -contains '--native')

function Strip-FileBom {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    try {
        $bytes = [System.IO.File]::ReadAllBytes($Path)
        if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
            $clean = [byte[]]::new($bytes.Length - 3)
            [System.Buffer]::BlockCopy($bytes, 3, $clean, 0, $clean.Length)
            [System.IO.File]::WriteAllBytes($Path, $clean)
        }
    } catch {}
}

function Write-Utf8NoBom {
    param([string]$Path, [string]$Content)
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Sync-CliExperimentFlags {
    param([string[]]$PassedArgs)

    $homeDir = [Environment]::GetFolderPath('UserProfile')
    $settingsPath = Join-Path $homeDir '.gemini\antigravity-cli\settings.json'
    if (-not (Test-Path -LiteralPath $settingsPath)) { return $PassedArgs }

    Strip-FileBom $settingsPath

    $expFlags = @($PassedArgs | Where-Object { $_ -match '^--(enable|disable|jetski|cascade|cortex|sidecar|use|scheduled|show|deprecate|allow|send)-[a-z0-9-]+(=(true|false))?$' })
    if ($expFlags.Count -eq 0) { return $PassedArgs }

    try {
        $raw = Get-Content -LiteralPath $settingsPath -Raw -ErrorAction Stop
        $json = $raw | ConvertFrom-Json
        if (-not $json.experiments) {
            $json | Add-Member -MemberType NoteProperty -Name 'experiments' -Value ([PSCustomObject]@{}) -Force
        }

        foreach ($flag in $expFlags) {
            $key = $flag.TrimStart('-')
            $val = $true
            if ($key -match '=') {
                $parts = $key -split '=', 2
                $key = $parts[0]
                $val = ($parts[1] -eq 'true')
            } elseif ($key -like 'disable-*') {
                $val = $false
            }
            $json.experiments | Add-Member -MemberType NoteProperty -Name $key -Value $val -Force
        }

        $formatted = $json | ConvertTo-Json -Depth 10
        Write-Utf8NoBom $settingsPath $formatted
    } catch {
        # Continue silently if settings.json is locked or error occurs
    }

    return @($PassedArgs | Where-Object { $expFlags -notcontains $_ })
}

$rawAgyArgs  = @($args | Where-Object { $launcherFlags -notcontains $_ })
$agyArgs     = @(if ($rawAgyArgs.Count -gt 0) { Sync-CliExperimentFlags -PassedArgs $rawAgyArgs })

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

function Resolve-RealAgy {
    if ($env:AGY_REAL_PATH -and (Test-Path -LiteralPath $env:AGY_REAL_PATH)) { return $env:AGY_REAL_PATH }
    $self = $PSScriptRoot.TrimEnd('\', '/')
    $found = Get-Command agy -All -CommandType Application -ErrorAction SilentlyContinue |
        Where-Object { (Split-Path -Parent $_.Source).TrimEnd('\', '/') -ne $self } |
        Select-Object -First 1
    if ($found) { return $found.Source }
    if ($env:LOCALAPPDATA) {
        $fallback = Join-Path $env:LOCALAPPDATA 'agy\bin\agy.exe'
        if (Test-Path -LiteralPath $fallback) { return $fallback }
    }
    return $null
}

$agyPath = Resolve-RealAgy
if (-not $agyPath) {
    [Console]::Error.WriteLine('real agy.exe not found on PATH. Set AGY_REAL_PATH.')
    exit 3
}

function Ensure-AntigravitySkills {
    $homeDir = [Environment]::GetFolderPath('UserProfile')
    $globalSkills = Join-Path $homeDir '.gemini\config\skills'
    if (-not (Test-Path -LiteralPath $globalSkills)) { return }

    # 1. Global Plugin registration & skills junction
    $pluginDir = Join-Path $homeDir '.gemini\config\plugins\antigravity-lab'
    $pluginManifest = Join-Path $pluginDir 'plugin.json'
    $pluginSkills = Join-Path $pluginDir 'skills'

    if (-not (Test-Path -LiteralPath $pluginDir)) {
        New-Item -ItemType Directory -Path $pluginDir -Force | Out-Null
    }
    if (-not (Test-Path -LiteralPath $pluginManifest)) {
        Write-Utf8NoBom $pluginManifest '{"name": "antigravity-lab", "description": "Antigravity Lab Skills & Slash Commands"}'
    }
    if (-not (Test-Path -LiteralPath $pluginSkills)) {
        cmd.exe /c mklink /J "$pluginSkills" "$globalSkills" | Out-Null
    }

    # 2. Home and Current Working Directory .agents/skills junctions
    $homeAgents = Join-Path $homeDir '.agents'
    $homeAgentsSkills = Join-Path $homeAgents 'skills'
    if (-not (Test-Path -LiteralPath $homeAgents)) {
        New-Item -ItemType Directory -Path $homeAgents -Force | Out-Null
    }
    if (-not (Test-Path -LiteralPath $homeAgentsSkills)) {
        cmd.exe /c mklink /J "$homeAgentsSkills" "$globalSkills" | Out-Null
    }

    $cwd = (Get-Location).Path
    if ($cwd -and ($cwd -ne $homeDir) -and (Test-Path -LiteralPath $cwd)) {
        $cwdAgents = Join-Path $cwd '.agents'
        $cwdSkills = Join-Path $cwdAgents 'skills'
        if (-not (Test-Path -LiteralPath $cwdAgents)) {
            New-Item -ItemType Directory -Path $cwdAgents -Force -ErrorAction SilentlyContinue | Out-Null
        }
        if ((Test-Path -LiteralPath $cwdAgents) -and (-not (Test-Path -LiteralPath $cwdSkills))) {
            cmd.exe /c mklink /J "$cwdSkills" "$globalSkills" 2>$null | Out-Null
        }
    }

    # 3. Allow all experiment flags per default in ~/.gemini/antigravity-cli/settings.json
    $settingsPath = Join-Path $homeDir '.gemini\antigravity-cli\settings.json'
    if (Test-Path -LiteralPath $settingsPath) {
        Strip-FileBom $settingsPath
        try {
            $raw = Get-Content -LiteralPath $settingsPath -Raw -ErrorAction Stop
            $json = $raw | ConvertFrom-Json
            if (-not $json.experiments) {
                $json | Add-Member -MemberType NoteProperty -Name 'experiments' -Value ([PSCustomObject]@{}) -Force
            }

            $defaultFlags = @(
                'enable-owl-slash-command',
                'jetski-autonomous-mode',
                'disable-teamwork-forced-flash-model',
                'jetski-generative-ui',
                'enable-battle-mode',
                'enable-subagent-hub',
                'enable-programmatic-tools',
                'enable-battle-mode-custom-agents',
                'enable-persistent-terminals',
                'enable-browser-subagent-v2',
                'enable-command-antivirus',
                'enable-fork-with-subagents',
                'enable-swarm-narrator',
                'enable-voice-activity-events',
                'disable-stained-loas2-creds',
                'enable-deepagent',
                'enable-review',
                'enable-image-generator-subagent',
                'enable-sidecars',
                'enable-ui-sidecars',
                'enable-sidecar-sdk',
                'sidecar-gateway',
                'sidecar-iframe-prewarm',
                'enable-swarm-monitor',
                'enable-ripgrep-path-search',
                'enable-pty',
                'enable-wait-tool',
                'cortex-snapshot-recording',
                'cortex-snapshot-revert',
                'enable-remote-agent-fastpush-pin',
                'enable-conversation-search-v2',
                'cascade-enable-notebook-edit-tool',
                'cascade-use-sed-edit-tool',
                'enable-model-capacity-exhausted-retries',
                'enable-mcp-non-blocking-turn-load',
                'enable-compact-slash-command'
            )

            $modified = $false
            foreach ($flag in $defaultFlags) {
                if ($null -eq $json.experiments.$flag) {
                    $json.experiments | Add-Member -MemberType NoteProperty -Name $flag -Value $true -Force
                    $modified = $true
                }
            }

            if (-not $json.statusLine -or -not $json.statusLine.command) {
                $statusLineObj = [PSCustomObject]@{
                    type = 'command'
                    command = 'python E:\03_Devops\AntigravityManager\bin\statusline.py'
                    enabled = $true
                }
                $json | Add-Member -MemberType NoteProperty -Name 'statusLine' -Value $statusLineObj -Force
                $modified = $true
            }

            if ($modified) {
                $formatted = $json | ConvertTo-Json -Depth 10
                Write-Utf8NoBom $settingsPath $formatted
            }
        } catch {
            # Continue silently on lock or parse error
        }
    }

    # 4. Self-healing slash command injection (via dynamic reference points)
    try {
        $patcher = 'E:\03_Devops\AntigravityManager\bin\auto_patch_agy.py'
        if (Test-Path -LiteralPath $patcher) {
            python $patcher 2>$null | Out-Null
        }
    } catch {}
}

Ensure-AntigravitySkills

$proxyCfg = Read-ProxyConfig
$modeOverride = $env:PROXYMATEUR_AGY_MODE
if ($nativeMode -or ($modeOverride -eq 'native')) {
    $useNative = $true
} elseif ($proxyMode -or ($modeOverride -eq 'gateway')) {
    $useNative = $false
} else {
    # Default: agy without -px must run natively without proxy
    $useNative = $true
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
        $isArgonOnly = ($proxyCfg -and ($proxyCfg.gateway_routing_mode -eq 'argon_only')) -or ($modeOverride -eq 'argon_only')
        $openaiModelIds = if (-not $isArgonOnly -and $proxyCfg.openai -and $proxyCfg.openai.enabled) {
            $validRoutes = if ($proxyCfg.openai.routes) { @($proxyCfg.openai.routes | ForEach-Object { "$($_.model_id)".Trim() }) } else { @() }
            $rawList = if ($null -ne $proxyCfg.openai.exposed_models) {
                @($proxyCfg.openai.exposed_models | Where-Object { $validRoutes -contains "$_".Trim() })
            } elseif ($proxyCfg.openai.routes) {
                $validRoutes
            } else { @() }
            @($rawList | ForEach-Object { "$_".Trim() } | Where-Object { $_ })
        } else { @() }
        $include = if ($isArgonOnly) { '^gemini-4-argon' } elseif ($env:PROXYMATEUR_AGY_INCLUDE) { $env:PROXYMATEUR_AGY_INCLUDE } else { '^(gemini|claude|gpt)-' }
        # Do NOT dismiss Claude 5.5, Argon, or GPT-OSS: allow them through
        $exclude = if ($env:PROXYMATEUR_AGY_EXCLUDE) { $env:PROXYMATEUR_AGY_EXCLUDE } else { 'image|imagen|embed|tts|audio|veo|live|omni|-exp|tiered|carbon|claude-(?:opus|sonnet)-4-[0-5](?:-|$)|gpt-(?:4|3)|\*|\.x(-|$)' }
        $models = @($ids | Where-Object {
            if (-not $_) { return $false }
            if ($openaiModelIds -contains $_) { return $true }
            (($_ -match $include) -and ($_ -notmatch $exclude))
        } | Sort-Object -Unique)
        
        # Always ensure Gemini 4 Argon family is included
        foreach ($m in 'gemini-4-argon', 'gemini-4-argon-high', 'gemini-4-argon-medium', 'gemini-4-argon-low') {
            if ($models -notcontains $m) { $models += $m }
        }

        # Claude models are ONLY included if legitimately returned by the proxy for qualified accounts.
        # Prune bare slugs and alias duplicates to prevent duplicate title-case vs lowercase entries in agy.exe
        if ($models -contains 'claude-opus-5-5-high') {
            $models = @($models | Where-Object { $_ -ne 'claude-opus-5-5' })
        }
        if ($models -contains 'claude-sonnet-5-5-high') {
            $models = @($models | Where-Object { $_ -ne 'claude-sonnet-5-5' })
        }
        if ($models -contains 'claude-opus-4-6-thinking') {
            $models = @($models | Where-Object { $_ -ne 'claude-opus-4-6' })
        }
        if ($models -contains 'claude-sonnet-4-6') {
            $models = @($models | Where-Object { $_ -ne 'claude-sonnet-4-6-thinking' })
        }
        $models = @($models | Sort-Object -Unique)
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

        $env:HTTP_PROXY  = $url
        $env:HTTPS_PROXY = $url
        $env:ALL_PROXY   = $url

        if ($dryRun) { Write-Host "[agy] mode=gateway  $url  models=$($models.Count)  args=$($agyArgs -join ' ')" -ForegroundColor DarkGray; exit 0 }
        & $agyPath @agyArgs
        $code = $LASTEXITCODE
        exit $code
    } else {
        Write-Host "[agy] Warning: Proxymateur is not running or unreachable at $url. Falling back to native mode." -ForegroundColor Yellow
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
if ($dryRun) { Write-Host "[agy] mode=native  real=$agyPath  args=$($agyArgs -join ' ')" -ForegroundColor DarkGray; exit 0 }

& $agyPath @agyArgs
exit $LASTEXITCODE
