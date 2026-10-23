# Proxymateur-Clean

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC_BY--NC--SA_4.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/yuatemycat/Proxymateur-Clean?color=blue)](https://github.com/yuatemycat/Proxymateur-Clean/releases)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-orange.svg)](https://v2.tauri.app/)
[![Rust 2021](https://img.shields.io/badge/Rust-2021-red.svg)](https://www.rust-lang.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)](https://www.typescriptlang.org/)

Sovereign account studio, multi-protocol AI gateway, and reversed internal capability suite for Google Antigravity. Built with Rust 2021 (Axum HTTP engine, SQLite `rusqlite`), Tauri v2, and React 19.

Proxymateur-Clean operates strictly with client-side Bring-Your-Own (BYO) OAuth 2.0 credentials and zero third-party telemetry. It implements **strict quota decoupling** (guaranteeing that 3P/Claude exhaustion never throttles or zeroes out Gemini pool calculations), automated token self-healing, native stdio Model Context Protocol (MCP) server support, and unlocked control over 54 internal Antigravity engine flags paired into 7 functional clusters.

Forked from [lbjlaq/Antigravity-Manager](https://github.com/lbjlaq/Antigravity-Manager) (CC BY-NC-SA 4.0). Substantially modified, refactored, and maintained by [yuatemycat](https://github.com/yuatemycat).

---

## Choose Your Operating Mode First

Proxymateur-Clean provides four distinct operating modes. Pick the entry point that matches your environment before running commands:

| What You Want to Do | Entry Point / Command | Background Proxy Required? | Credential & State Storage |
| :--- | :--- | :---: | :--- |
| **Quota Studio & Account Management** | Desktop GUI (`proxymateur`) | **No** (pure client-side studio) | Local SQLite (`rusqlite` in `~/.proxymateur`) |
| **Autonomous Multi-Agent CLI Workflows** | Antigravity CLI via Gateway (`agy -px` or native `agy`) | **Optional** (native direct or port 8045) | Local `~/.gemini/antigravity-cli/settings.json` |
| **Connect Cursor, Claude Code, or IDEs** | MCP Server (`proxymateur mcp`) | **No** (stdio JSON-RPC) | Live session read-only query / hot-swap |
| **Multi-Protocol Gateway (OpenAI / Claude)** | Headless Server (`proxymateur --headless --port 8045`) | **Yes** (Axum HTTP proxy engine) | In-memory token pool + silent failover |

---

## Architecture & Pipeline Invariants

Proxymateur-Clean enforces a **pipeline-first** architecture: inbound requests are converted to normalized Gemini-compatible AST representations, passed through uniform context and thinking budget governors, and dispatched across isolated upstream pools:

```
+-------------------------------------------------------------------+
| 1. INBOUND SURFACES & PROTOCOL ADAPTERS                           |
|    [Desktop GUI]  [Antigravity CLI (agy)]  [Claude Code / Cursor] |
|          │                  │                        │            |
|    Tauri v2 IPC       CLI Shim (-px)          Stdio MCP Server    |
|          │                  │                        │            |
|          ▼                  ▼                        ▼            |
|    [HTTP Proxy Engine (Axum 127.0.0.1:8045)]                      |
|      ├── OpenAI Format (/v1/chat/completions, /v1/models)         |
|      ├── Anthropic Format (/v1/messages)                          |
|      └── Gemini Direct Protocol (/v1beta/models/*)                |
+-------------------------------------------------------------------+
                              │
                Payload Normalization & Routing
                              ▼
+-------------------------------------------------------------------+
| 2. INBOUND PIPELINE STAGE (Uniform Gemini Normalization)          |
|      ├── Thinking Block Auto-Heal & Budget Governor (low/med/high)|
|      ├── Strict Quota Decoupling (Gemini vs. Claude Pools)        |
|      ├── Prefix Topology Stability & Context Token Estimation     |
|      └── Prompt Sanitization & DEMON Security Shim                |
+-------------------------------------------------------------------+
                              │
              Dispatch & Multi-Account Selection
                              ▼
+-------------------------------------------------------------------+
| 3. LOCAL STATE & MULTI-UPSTREAM ROUTING                           |
|    [Local SQLite Storage (~/.proxymateur/data.db)]                |
|      ├── DPAPI / Keychain Token Encryption                        |
|      └── CLI Settings (~/.gemini/antigravity-cli/settings.json)   |
|                                                                   |
|    [Upstream Dispatch Engine]                                     |
|      ├── Google Antigravity Pool (Rolling 5h + 7d Weekly Pools)   |
|      ├── Vertex AI Direct Routing (GCP Private Credentials)       |
|      └── OpenAI Upstream Transpiler (DeepSeek, Nemotron)          |
+-------------------------------------------------------------------+
```

### Core Invariants

1. **Strict Quota Decoupling**: Antigravity maintains independent quota pools: `Gemini Models` and `Claude / 3P`. Claude quota exhaustion must **never** degrade, throttle, or zero out Gemini quota calculations, summaries, or sorting ranks. Accounts with exhausted Claude weekly limits remain marked healthy and ready for Gemini tasks.
2. **Pipeline-First Normalization**: Protocol adapters function purely as parameter normalizers. The pipeline stage uniformly handles converted Gemini payloads: thinking block backfilling, thinking budget filtering, context alignment, prefix stability, and prompt sanitization.
3. **Headless Parity**: Complete feature parity across the Desktop GUI, Headless Server (`--headless`), and Stdio MCP runtime (`mcp`).

---

## 5-Minute End-to-End Quickstart

### Workflow A: Desktop GUI & Sovereign Quota Studio

Launch the desktop interface to monitor real-time quotas, configure Bring-Your-Own (BYO) OAuth 2.0 credentials, and manage experimental feature toggles:

```bash
# Launch Proxymateur Desktop
proxymateur
```

- Navigate to **Accounts** to view rolling 5-hour countdowns and 7-day weekly quotas.
- Navigate to **Settings → Antigravity Lab** to configure the 54 experimental flags.

### Workflow B: CLI & Autonomous Multi-Agent Workflows

Proxymateur-Clean provides an intelligent wrapper script for the Antigravity CLI (`agy`) that runs natively by default and routes through the local gateway when `--px` is passed:

```bash
# 1. Native CLI execution (zero overhead, direct Google connection)
agy "Audit this repository for race conditions"

# 2. Proxy Mode via Proxymateur gateway (automatic account rotation on 429)
agy -px "Run full end-to-end regression tests"

# 3. Autonomous Swarm Pipeline (hands-free multi-agent execution)
agy -px "/swarm Implement unit tests for the authentication middleware"

# 4. Deep Architectural Synthesis (Challenger + Synthesizer)
agy -px "/owl Refactor database connection pooling with zero regressions"

# 5. Colosseum Battle Arena (Adversarial agent duel)
agy -px "/battle Benchmark SIMD vs GPU vector search implementations"
```

### Workflow C: AI Agent Fleet Control via Stdio MCP Server

Proxymateur-Clean ships with an integrated stdio Model Context Protocol (MCP) server. External AI agents (Cursor, Claude Code, Windsurf, Antigravity) can inspect fleet quotas and hot-swap active accounts mid-session.

Add the server to your agent's configuration:

#### Cursor (`.cursor/mcp.json`) & Antigravity (`~/.gemini/config/mcp_config.json`)

```json
{
  "mcpServers": {
    "proxymateur": {
      "command": "proxymateur",
      "args": ["mcp"]
    }
  }
}
```

#### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "proxymateur": {
      "command": "proxymateur",
      "args": ["mcp"]
    }
  }
}
```

#### Supported MCP Tools

- `list_accounts`: Query all configured accounts, active tiers (`PRO`, `ULTRA`), and independent Gemini/Claude quota metrics.
- `read_quotas`: Inspect granular model capacity, remaining token fractions, 5h rolling countdowns, and 7d reset times.
- `get_current_account`: Query the active session identity.
- `switch_account`: Hot-swaps the active Antigravity account mid-conversation without interrupting workflow execution.
- `agy_run_task` & `agy_get_transcript`: Execute and inspect background CLI sessions programmatically.

### Workflow D: Headless Server Deployment

Run Proxymateur as a headless proxy daemon on local workstations, containers, or remote developer servers:

```bash
# Start on default port 8045
proxymateur --headless

# Custom port and custom data directory
proxymateur --headless --port 9000 --data-dir ~/.proxymateur-headless

# Graceful shutdown of a running background instance
curl -X POST http://127.0.0.1:8045/system/shutdown
```

---

## The 54 Reversed Internal Flags (7 Paired Clusters)

Proxymateur-Clean exposes 54 reverse-engineered engine flags discovered in `language_server.exe` and `agy.exe`. Flags are paired into 7 cohesive functional clusters:

| Group | Paired Feature Flags | Operational Impact |
| :--- | :--- | :--- |
| **Group 1: Multi-Agent & Swarm** | `jetski_autonomous_mode`<br>+ `disable_teamwork_forced_flash_model` | Unlocks non-interactive continuous execution while ensuring subagents inherit Pro/Ultra reasoning models instead of being locked to Flash. |
| | `enable_subagent_hub`<br>+ `enable_swarm_monitor` | Centralizes subagent lifecycle management and live telemetry monitoring across concurrent agent threads. |
| | `enable_fork_with_subagents`<br>+ `send_subagent_initial_prompt_as_message` | Branches active conversations and subagent trees into isolated worktrees, delivering initial prompts as reactive messages. |
| | `enable_swarm_narrator`<br>+ `enable_image_generator_subagent` | Transcribes real-time swarm deliberations while embedding native Google Imagen image generation tools. |
| **Group 2: Slash Commands & Arena** | `enable_owl_slash_command`<br>+ `enable_compact_slash_command` | Activates `/owl` architectural synthesis alongside `/compact` reactive trajectory pruning. |
| | `enable_battle_mode`<br>+ `enable_battle_mode_custom_agents` | Colosseum arena duel pitting competing subagents (including custom agent personas) against each other. |
| | `enable_programmatic_tools`<br>+ `jetski_generative_ui` | Compiles dynamic tools on the fly (`/benchmark`) and renders interactive widgets inside artifacts. |
| | `enable_deepagent`<br>+ `enable_review` | Unlocks Google's internal multi-pass reasoning loop alongside automated code review auditing. |
| **Group 3: Customizations 2.0 & Plugins** | `enable_plugins`<br>+ `enable_hook_status` | Enables full plugin lifecycle management (`agy plugin`) and real-time hook execution indicators. |
| | `enable_customization_kind_agent`<br>+ `enable_customization_kind_skill` | Granular discovery and execution of custom agents (`agents/`) and skills (`skills/`). |
| | `enable_customization_kind_rule`<br>+ `enable_customization_kind_mcp` | Granular loading of contextual user rules and isolated plugin MCP servers. |
| | `enable_customization_kind_hooks`<br>+ `deprecate_workflows` | Activates tool event hooks while transitioning legacy `.workflow` files to modern skills and subagents. |
| **Group 4: Sidecar Runtime & UI** | `enable_sidecars`<br>+ `enable_ui_sidecars` | Hosts embedded background services and prewarmed visual iframe widgets. |
| | `enable_sidecar_sdk`<br>+ `jetski_sidecar_declared_permissions` | Exposes the sidecar developer SDK while strictly enforcing manifest permission boundaries. |
| | `sidecar_gateway`<br>+ `sidecar_iframe_prewarm` | Routes sidecar IPC/RPC traffic through the local gateway with zero-latency prewarmed contexts. |
| **Group 5: DeepMind AGI Safety** | `enable_command_assessor`<br>+ `enable_command_antivirus` | Replaces heuristic regex with DeepMind's Policy Guardian to audit commands before execution. |
| | `allow_experimental_monitors`<br>+ `enable_citc_workspace_hygiene_rule` | Activates DeepMind safety monitors (`sir_flash_lite`) and Client-in-the-Cloud workspace rules. |
| | `disable_stained_loas2_creds`<br>+ `enable_browser_subagent_v2` | Bypasses corporate LOAS2 credential checks while unlocking Chrome DevTools Protocol (CDP) browser automation. |
| **Group 6: Terminal & Resilience** | `enable_persistent_terminals`<br>+ `enable_pty` | ConPTY pseudo-terminals preserving environment variables, background processes, and daemons across turns. |
| | `enable_ripgrep_path_search`<br>+ `enable_wait_tool` | Integrated ripgrep engine for instant file lookups alongside asynchronous non-blocking wait tools. |
| | `scheduled_tasks_v2`<br>+ `enable_model_capacity_exhausted_retries` | Cron-based task scheduling engine with automated retry for transient upstream model capacity errors. |
| | `enable_mcp_non_blocking_turn_load`<br>+ `enable_remote_agent_fastpush_pin` | Loads MCP schemas asynchronously without blocking conversational turns while syncing remote push-pins. |
| **Group 7: Cortex State & Planning** | `cortex_snapshot_recording`<br>+ `cortex_snapshot_revert` | Continuously captures workspace filesystem snapshots with 1-click trajectory state rollback. |
| | `enable_conversation_search_v2`<br>+ `show_model_selection_change` | Semantic trajectory vector indexing across past sessions with clear model switch notifications. |
| | `use_component_rewrite`<br>+ `use_core_direct` | AST prompt component normalization with low-latency direct core transport routing. |
| | `use_slash_plan`<br>+ `enable_voice_activity_events` | Native `/plan` interactive planning mode and voice activity streaming (`agy mic-serve`). |
| | `cascade_enable_notebook_edit_tool`<br>+ `cascade_use_sed_edit_tool` | Cell-level Jupyter notebook inspection alongside line-oriented regex stream editing tools. |

### Automated Benchmark Verification

A headless telemetry harness (`scripts/benchmark_antigravity_lab.py`) runs systematic validation across all 54 reversed flags:
*   **Flag Parity Gate**: Verified 100% (54/54) flag parity against CLI gateway parsing regexes and persistent settings dictionary mappings.
*   **Lookup & Key Translation**: Reached 17,962,444 key translation ops/sec under zero-allocation caching.
*   **Transcript Telemetry Scan**: Scanned 476 real conversation logs across 180,971 transcript lines at 459,552 lines/sec with zero regressions.

### Verified Real Transcript Proof of Usage

```jsonl
// Subagent Lifecycle & Coordination (Group 1)
{"step_index": 71, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "invoke_subagent", "arguments": {"Model": "flash", "Role": "Tier 1 Architect", "Prompt": "Refactor into Progressive Disclosure Architecture..."}}]}
{"step_index": 493, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "manage_subagents", "arguments": {"Action": "list"}}]}
{"step_index": 124, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "send_message", "arguments": {"Recipient": "subagent-worker-1", "Message": "Issue #13 serialization completed."}}]}

// Programmatic Tool Synthesis & Benchmarking (Group 2)
{"step_index": 0, "type": "USER_INPUT", "content": "/benchmark Test the flags in Antigravity Lab..."}
{"step_index": 1, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "write_file", "arguments": {"Path": "scripts/benchmark_antigravity_lab.py", "Content": "#!/usr/bin/env python3\nimport time..."}}]}
{"step_index": 2, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "run_command", "arguments": {"CommandLine": "python scripts/benchmark_antigravity_lab.py", "WaitMsBeforeAsync": 10000}}]}

// Customizations 2.0 Dynamic Subagent Persona (Group 3)
{"step_index": 105, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "define_subagent", "arguments": {"Name": "ReadmeEngineer", "Description": "Specialist agent for technical documentation", "EnableMCPTools": true, "EnableWriteTools": true}}]}

// Scheduled Tasks v2 with Reactive TimerCondition (Group 6)
{"step_index": 242, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "schedule", "arguments": {"DurationSeconds": 30, "Prompt": "Check if release build has completed", "TimerCondition": "00fad603.../task-233", "ExactTiming": false}}]}
```

---

## Dynamic Slash Command Architecture

In `agy.exe`, slash commands are dynamically loaded from `~/.gemini/config/skills/<name>/SKILL.md` or native binary dispatch:

```
/owl <task>          Deep architectural synthesis (DeepInvestigator + DeepCoder)
/battle <task>       Colosseum arena duel: 2 rival subagents debate & benchmark
/swarm <task>        Hands-free autonomous multi-agent swarm building
/benchmark <task>    Programmatic tool synthesis & performance profiling
/generative_ui       Interactive UI widgets rendered directly inside artifacts
/compact             Prune and compact trajectory context window cleanly
/btw <query>         Ask a side question without interrupting the active task
/copy btw            Copy the latest /btw side answer directly to the clipboard
/effort <level>      Set reasoning effort dynamically (low, medium, high)
/diff                View uncommitted changes with live search (/) and hunk folding (Ctrl+O)
/plugin <subcmd>     Discover, install, validate, and manage plugin extensions
/hooks               Manage hook configurations for tool lifecycle events
/remote-control      Manage WebRTC mesh daemon to follow and control sessions remotely
```

---

## Bring-Your-Own (BYO) OAuth 2.0 Setup

Proxymateur-Clean requires you to supply your own Google Cloud OAuth 2.0 credentials to eliminate centralized quotas and guarantee privacy.

### 1. Create Google Cloud Credentials

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `Antigravity-Workspace`).
3. Navigate to **APIs & Services → OAuth consent screen**:
   - Choose **External** (or **Internal** if using Google Workspace).
   - Under **Scopes**, add:
     - `openid`
     - `https://www.googleapis.com/auth/cloud-platform`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
     - `https://www.googleapis.com/auth/cclog`
     - `https://www.googleapis.com/auth/experimentsandconfigs`
   - Under **Test users**, add your Google email address.
4. Navigate to **APIs & Services → Credentials**:
   - Click **Create Credentials → OAuth client ID**.
   - Select Application type: **Desktop app** (or **Web application** with Authorized Redirect URI `http://localhost:8080/oauth-callback` and `http://127.0.0.1:8080/oauth-callback`).
   - Copy your **Client ID** and **Client Secret**.

### 2. Configure Credentials in Proxymateur-Clean

#### Method A: Via GUI Settings
Open Proxymateur-Clean and navigate to **Settings → OAuth Configuration**. Click **Add Client**, paste your Client ID and Client Secret, and set a custom label.

#### Method B: Via Environment Variables
Define credentials globally via environment variables:

```bash
# Linux / macOS
export ANTIGRAVITY_OAUTH_CLIENTS="personal|CLIENT_ID.apps.googleusercontent.com|CLIENT_SECRET|Personal Account"
export ANTIGRAVITY_OAUTH_CLIENT_KEY="personal"

# Windows (PowerShell)
[System.Environment]::SetEnvironmentVariable('ANTIGRAVITY_OAUTH_CLIENTS', 'personal|CLIENT_ID.apps.googleusercontent.com|CLIENT_SECRET|Personal Account', 'User')
```

---

## Benchmark & Throughput Metrics

All benchmarks are measured on physical hardware (Intel Core i9-12950HX, 64 GB DDR5, Windows 11 24H2) across local SQLite and proxy pipelines:

| Workload / Benchmark | Engine / Layer | Measured Overhead / Latency | Measured Throughput / Result |
| :--- | :--- | :---: | :---: |
| **Inbound Pipeline Normalization** | Axum + Rust Pipeline | **< 0.45 ms** | > 25,000 req/s |
| **Local Account Database Queries** | SQLite (`rusqlite`) | **< 0.02 ms** | > 65,000 req/s |
| **Stdio MCP Tool Roundtrip** | Native JSON-RPC Stdio | **< 1.15 ms** | Instant fleet dispatch |
| **Thinking Budget Filter Overhead** | Rust Regex & AST Gate | **< 0.08 ms** | Zero-copy stream backfill |
| **Trajectory Context Compaction** | Antigravity Lab Governor | **1.20 s** | 40% to 75% context recovery |
| **Statusline Telemetry Parsing** | Python 3 Named Pipe | **< 0.85 ms** | Real-time tok/s & context % |

---

## Installation & Build

### Prerequisites

- Node.js 20+ and npm
- Rust 1.77+ and Cargo (`stable`)
- Visual Studio C++ Build Tools (Windows) or `build-essential` (Linux)

### Build from Source

```bash
# 1. Clone the repository
git clone https://github.com/yuatemycat/Proxymateur-Clean.git
cd Proxymateur-Clean

# 2. Install frontend dependencies
npm install

# 3. Launch in desktop development mode
npm run tauri dev
```

### Production Release Build

To compile standalone, highly optimized release binaries:

```bash
# Windows
build_exe.bat

# Linux / macOS
npm run build
cd src-tauri && cargo build --release
```

Compiled binaries are output to `src-tauri/target/release/proxymateur.exe` (or `proxymateur` on POSIX).

---

## Troubleshooting & Common Gotchas

* **Claude weekly quota displays 0% while Gemini models display 100%:**
  This is expected behavior. Antigravity accounts have separate quota pools for Gemini and Claude/3P models. Claude weekly quotas exhaust rapidly during intensive CLI sessions. Because Proxymateur-Clean implements **strict quota decoupling**, accounts with 0% Claude quota remain healthy and fully operational for all Gemini tasks.
* **Port 8045 is already in use on startup:**
  Another background or GUI instance is holding port 8045. Issue a graceful shutdown via `curl -X POST http://127.0.0.1:8045/system/shutdown` or terminate the lingering process via `Stop-Process -Name "proxymateur" -Force`.
* **Updating the binary on Windows does not reflect changes in the running window:**
  Windows keeps running executables mapped in RAM. After compiling or downloading a new release, close Proxymateur completely from your system tray or run `Stop-Process -Name "proxymateur" -Force` before launching the new binary from your desktop shortcut.
* **Slash commands (/owl, /battle, /swarm) are reported as unrecognized:**
  Ensure the skills directory is synchronized. Run `.\skills\install_skills.ps1` (Windows) or `bash skills/install_skills.sh` (Linux/macOS) to install the skill definitions to `~/.gemini/config/skills/`.
* **Terminal Sandbox fails to initialize on Windows:**
  The native Windows terminal sandbox (`exebox`) requires Windows 11 version 24H2 or later. On earlier Windows versions, Proxymateur-Clean gracefully falls back to interactive confirmation prompts before executing shell commands.

---

## Known Limitations

- **Google Workspace (Enterprise) Scopes**: If your OAuth consent screen is configured as Internal within an enterprise Google Workspace tenant, users outside your domain cannot authenticate against that client ID. Use External consent mode with explicit test user allowlists for multi-user personal setups.
- **Opus 5.5 Partitioning**: Accounts containing `Opus5.5` in their display label are partitioned and sorted to the bottom of automatic dispatch queues to prevent unintended quota burn during non-critical tasks.
- **In-Memory Thinking Blocks**: Thinking blocks generated during deep reasoning are cached locally. To clear historical reasoning cache after major model releases, toggle the cache invalidator in **Settings → Experimental**.

---

## Repository Layout

```
src/                      React 19 frontend UI (Tailwind CSS, DaisyUI, Ant Design 5)
  ├── components/         Settings, Accounts, Proxy Monitors, and Antigravity Lab
  ├── stores/             Zustand 5 client-side state stores
  └── types/              TypeScript interfaces (config.ts, accounts.ts, models.ts)
src-tauri/                Tauri v2 desktop backend & Axum HTTP engine
  ├── src/commands/       Tauri IPC command handlers (proxy, accounts, experiments)
  ├── src/models/         Rust serde models (config.rs, accounts.rs)
  └── src/proxy/          Axum proxy engine, protocol adapters, and token manager
scripts/                  DevOps shims (agy_gateway.ps1, statusline.py, deploy scripts)
skills/                   Bundled Antigravity skills (/owl, /battle, /swarm, /benchmark)
docs/                     Architecture whitepapers and workflow documentation
```

---

## 💖 Support & Contributions

Proxymateur-Clean is an independent, community-funded open-source utility developed without corporate sponsorships, trackers, or commercial API relays.

If this studio saves you time or empowers your workflow, your support is deeply appreciated:

**USDT (BEP20 / BNB Smart Chain):**

```
0xd08d47bde441888166b801616754c667672cd502
```

---

## License & Disclaimer

### Disclaimer

> [!IMPORTANT]
> **Proxymateur-Clean is an independent open-source developer tool and is NOT affiliated with, authorized, maintained, sponsored, or endorsed by Google LLC, Alphabet Inc., or Anthropic PBC.**
>
> "Google", "Antigravity", "Gemini", and "Google Cloud" are registered trademarks of Google LLC. "Claude" is a registered trademark of Anthropic PBC. All brand and product names are trademarks or registered trademarks of their respective holders.

### License & Attribution

This project is licensed under [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/).

- **Original Work**: Forked from [lbjlaq/Antigravity-Manager](https://github.com/lbjlaq/Antigravity-Manager) © 2024–2026 lbjlaq.
- **Modifications & Clean Edition**: Substantially modified, refactored, and maintained by [yuatemycat](https://github.com/yuatemycat).
- **Non-Commercial & ShareAlike**: You are free to share, study, and adapt this work for non-commercial purposes, provided appropriate credit is given and derivative works are distributed under the same license.

© 2026 yuatemycat and contributors.
