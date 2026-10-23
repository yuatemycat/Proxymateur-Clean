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

### How the 54 Flags Are Invoked (3-Layer Execution Pipeline)

Every flag in the 54-flag matrix is wired through a deterministic 3-layer invocation pipeline verified by `scripts/benchmark_antigravity_lab.py`:

1. **Layer 1: Binary ABI & PE Command Cave (`agy.exe` & `language_server.exe`)**
   - **Experiment Descriptor Table (`54/54` Verified Offsets)**: All 54 flags exist as compiled string descriptors inside `agy.exe` (`204,027,392` bytes, `ImageBase = 0x140000000`) spanning raw file offsets `0x39599b3` (`enable-pty`) through `0xa5b5895` (`use-core-direct`), bound to `ExperimentKey` and `ListExperimentsResponse_Flag` protobuf evaluators.
   - **Native Slash Command Spec Table (`12/12` Verified Built-in Entries)**: Native CLI slash commands are compiled into 104-byte (`0x68`) descriptors at raw `0xbe58cf8..0xbe59170` linked to 144-byte (`0x90`) spec structs at `0xbe5c530..0xbe5cb60` (`goal`, `compact`, `schedule`, `browser`, `browser-vision`, `plan`, `grill-me`, `teamwork`, `learn`, `boost`, `deepagent`, `review-agent`).
   - **Patched `.proxcv` Section (`11/11` Verified `GenericCommand` Structs, `PROX_CMD_V1` @ `0xc292fda`)**: `scripts/auto_patch_agy.py` injects a 4 KB `.proxcv` PE section (code hook at `VA 0x14e574000` / raw `0xc292600`; data table at `VA 0x14e574400..0x14e574630` / raw `0xc292a00..0xc292c30`) containing 11 56-byte (`0x38`) `commands.GenericCommand` structs (`battle`, `owl`, `swarm`, `benchmark`, `generative_ui`, `compact`, `teamwork-preview`, `teamwork`, `teamwork-previews`, `team`, `flash`) directly into `commands.NewRegistry` (`0x14314fbc0`), bypassing server-side `MultiagentControls.GetBoostCommandDisabled` (`0x140ca8600`) gating.

2. **Layer 2: CLI Gateway Interception & Dual-Store Persistence**
   - **CLI Flag Interception (`Sync-CliExperimentFlags`)**: Passing any `--<kebab-flag>=true` argument to `agy` triggers `Sync-CliExperimentFlags` in `scripts/agy_gateway.ps1`, matching `^--(enable|disable|jetski|cascade|cortex|sidecar|use|scheduled|show|deprecate|allow|send)-[a-z0-9-]+(=(true|false))?$` (`54/54` pass rate), stripping UTF-8 BOMs, writing the key to `~/.gemini/antigravity-cli/settings.json` (`"experiments"`), and stripping the consumed flag before launching `agy.exe`.
   - **Bidirectional GUI-to-CLI Sync**: Toggling any pair in **Settings -> Advanced -> Antigravity Lab** (`toggle_antigravity_experiment`) atomically updates `snake_case` keys in `~/.proxymateur/gui_config.json` (`"antigravity_lab"`) and `kebab-case` keys in `~/.gemini/antigravity-cli/settings.json` (`"experiments"`).

3. **Layer 3: Runtime Tool Dispatch & Subsystem Activation Across the 7 Clusters**

| Cluster | Binary Offset Range (`agy.exe`) | Runtime Invocation Mechanism & Activated Tool Schemas | Empirical Transcript Count (`479` Convs) |
| :--- | :--- | :--- | :--- |
| **Group 1: Multi-Agent & Swarm** | `0x3a22b73` – `0x3b0983f` | Unlocks `invoke_subagent` batch/single dispatches, `manage_subagents` (`list`/`kill`), `send_message`, `generate_image`, and parent Pro/Opus model inheritance (`Model: "inherit"`). | `82` `invoke_subagent` calls -> `154` spawned subagents (`131` `inherit`, `23` `flash`); `865` `manage_subagents`; `161` `send_message`; `1` `generate_image` |
| **Group 2: Slash Commands & Arena** | `0x39a9c5b` – `0x3ad50c3`<br>+ `.proxcv` `0x14e574400` | Injects `/swarm`, `/owl`, `/battle`, `/benchmark`, `/compact`, `/generative_ui` via the `.proxcv` `GenericCommand` registry + `~/.gemini/config/skills/<name>/SKILL.md`. `/deepagent` and `/review-agent` are native built-in commands (see Layer 1) that the paired flags unlock; they are not injected. | Deduplicated turns: `/swarm` (`90`), `/compact` (`31`), `/owl` (`29`), `/benchmark` (`11`), `/battle` (`8`), `/generative_ui` (`3`) |
| **Group 3: Customizations 2.0 & Plugins** | `0x39be85d` – `0xa5b53e0` | Unlocks `define_subagent` dynamic agent personas (`ReadmeEngineer`, `ClaudeAgentSpecialist`, `DeepInvestigator`, `DeepCoder`, `gladiator_canvas_a`, `gladiator_webgl_b`, `milestone_worker`, `path_sanitizer_*`), `call_mcp_tool` plugin MCP servers (`code-review-graph`, `pyghidra`, `ghidra-mcp`, `agy-context-guard`, `memory`), and lifecycle hooks. | `1,539` `call_mcp_tool` calls; `10` `define_subagent` calls (`14` custom subagent spawns); `42` loaded skills |
| **Group 4: Sidecar Runtime & UI** | `0x39d4fd1` – `0xa5b582a` | Prewarms iframe micro-frontends and routes sidecar RPC/IPC traffic (`sidecar-gateway`) for generative HTML5/Canvas/WebGL artifacts. | `3` `/generative_ui` widget sessions (`1,686` session steps, `745` session tool calls) |
| **Group 5: DeepMind AGI Safety** | `0x3a6d7c5` – `0x422aac4` | Routes shell commands through Policy Guardian (`enable-command-assessor` / `enable-command-antivirus`), `ask_permission` elevation gates, and CDP browser subagent v2 / URL extraction (`read_url_content`). | `40,202` audited `run_command` executions; `22` `read_url_content` fetches; `181` `search_web` queries |
| **Group 6: Terminal & Resilience** | `0x39599b3` – `0xa5b578f` | Persistent ConPTY sessions (`enable-pty`), non-blocking background tasks (`manage_task`), reactive timers/cron (`schedule` with `TimerCondition`), and automatic 429 capacity retries. | `8,515` `manage_task` calls; `270` `schedule` timers; `1,539` non-blocking MCP turns |
| **Group 7: Cortex State & Planning** | `0x39bfa3f` – `0xa5b5895` | Captures Cortex filesystem snapshots before destructive edits, enables AST component rewrites (`use-component-rewrite`), and dispatches `/plan` (`use-slash-plan`). | `21,349` file reads (`view_file`/`read_file`); `4,979` file writes; `3,919` file edits; `6` `/plan` sessions |

### Head-to-Head Benchmark: Antigravity Lab Workflows vs. Native Slash Commands

Forensic analysis of `agy.exe` (`0xbe58cf8` native command table vs. `0xc292a00` `.proxcv` data table) combined with turn-windowed empirical telemetry across **479 real conversation transcripts** (`178,294` JSONL lines, `81,986` tool calls) highlights the architectural differences between Antigravity Lab workflows and Google's native built-in commands:

1. **Multi-Agent Swarm (`/swarm`) vs. Native `/teamwork` & `/teamwork-preview`**
   - **Model Tier Lock vs. Full Pro/Opus Inheritance**: Native `/teamwork` (`0xbe58fd0`) defaults to forcing spawned subagents onto `flash` unless `disable-teamwork-forced-flash-model` (`0x3aeda74` in `agy.exe`) is enabled as the engine flag governing forced flash model behavior. With Group 1 active, **85.1% (`131/154`)** of all spawned subagents inherit the parent Pro/Opus reasoning model (`"Model": "inherit"`), while **14.9% (`23/154`)** run on `"Model": "flash"` only when explicitly requested for high-concurrency mechanical refactoring.
   - **Hands-Free Autonomy vs. Interactive Question Blocking (`ask_question`)**: Native `/teamwork-preview` is hardcoded to interview the user via `ask_question` modals before spawning workers (**40.0%** invocation interruption rate, as seen in session `2ab783ff` steps 3 and 11). Powered by `jetski-autonomous-mode` (`0x3a59f1c`), `/swarm` achieved a **1.1% (`1/90`)** per-invocation (`2.3%` per-session) `ask_question` interruption rate, spawning `129` subagents across `65` `invoke_subagent` calls with `824` `manage_subagents` lifecycle checks and `8` custom `define_subagent` personas.

2. **Deep Architectural Synthesis (`/owl`) vs. Native `/boost`**
   - **Binary Entitlement Gating**: Native `/boost` (`0xbe590a0`, icon `'bolt'`) is gated by `MultiagentControls.GetBoostCommandDisabled` (`0x140ca8600` / `0x1410ec360`) and fails when server-side experiment entitlements are absent. `/owl` (`enable-owl-slash-command` @ `0x3a7b7e6`, `.proxcv` slot @ `0x14e574438` / raw `0xc292a38`) executes without depending on the server-side /boost entitlement check (`MultiagentControls.GetBoostCommandDisabled`), while model inference requests route normally through the proxy or model endpoints.
   - **1-Hop Parallel Fan-Out vs. 2-Hop Coordinator Overhead**: In real transcripts (`589f5a7c` and `d66a5214`), invoking native `/boost` spawns an intermediate `DeepCoderCoordinator` subagent whose `SYSTEM_SDK` prompt forbids it from reading or editing files (`"You are a pipeline coordinator... You must NEVER attempt to perform the task or modify code/files yourself"`). This intermediate coordinator consumes `24,066–37,972` input tokens purely to forward `<original_task>` to `DeepCoderWorkerL0` (`Parent -> DeepCoderCoordinator -> DeepCoderWorkerL0`). Furthermore, in session `589f5a7c` step 7, when `DeepCoderWorkerL0` encountered a transient `HTTP 429 RESOURCE_EXHAUSTED`, the native `/boost` coordinator aborted immediately. By contrast, `/owl` dispatches parallel `TypeName: "research"` (`DeepInvestigator`) and `TypeName: "self"` / `"DeepCoder"` workers in a 1-hop flat fan-out (`Parent -> N parallel workers`) while querying `code-review-graph` and `pyghidra` MCP servers directly (`29` turn invocations across `25` sessions, `8` spawned subagents inside `/owl` turn windows, `12` `manage_subagents` calls, `2` `define_subagent` personas, `0` user interruptions).

3. **Adversarial Arena (`/battle`) & Programmatic Profiling (`/benchmark`) vs. Native `/plan`, `/goal`, `/learn`, & `/grill-me`**
   - Native `/plan` (`0xbe58f00`, static inline `<PLAN>` prompt `3,735` bytes) and `/grill-me` (`0xbe58f68`, static inline `<GRILL_ME>` prompt `491` bytes) are single-agent prompt wrappers (`0` subagents spawned across all `6` `/plan` sessions). Native `/learn` (`0xbe59038`, `31` invocations across `26` sessions) reflects on session corrections to extract reusable memory/skills.
   - `/battle` (`enable-battle-mode` @ `0x3ad50c3` + `enable-battle-mode-custom-agents`, `.proxcv` slot @ `0x14e574400`) dynamically defines competing agent personas via `define_subagent` (`2` custom gladiator personas `gladiator_canvas_a` vs. `gladiator_webgl_b` in `2ab783ff` steps 41 & 43, plus `Gladiator-Alpha` vs. `Gladiator-Beta` in `cfde9b8d`), isolates their implementations, and runs head-to-head benchmarks before declaring a winner.
   - `/benchmark` (`enable-programmatic-tools` @ `0x3a88e31`, `.proxcv` slot @ `0x14e5744a8`) synthesizes standalone benchmark scripts and stress harnesses on the fly (`11` turn invocations across `10` sessions, `193.9` tool calls/invocation, `3` spawned `milestone_worker` subagents, `162` `manage_subagents` checks).

| Workflow Command | Origin & Binary Location | Deduplicated Invocations | Unique Sessions | Avg Steps / Invocation | Avg Tool Calls / Invocation | `invoke_subagent` Calls (Spawned Workers) | `manage_subagents` Supervision Calls | `define_subagent` Personas | Interactive Block Rate (`ask_question`) | Topology & Model Inheritance |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`/swarm`** | **Antigravity Lab** (`.proxcv` `0x14e574470`) | **90** | **43** | 409.4 | 194.0 | **65 (129)** | **824** | **8** | **1.1%** (`1/90`) | 1-hop parallel batch (`112 inherit` Pro/Opus + `17 flash`) |
| **`/learn`** | **Native CLI** (`0xbe59038` / `0xbe5c920`) | **31** | **26** | 447.1 | 203.5 | 1 (2) | 7 | 0 | **6.5%** (`2/31`) | Post-task reflection & skill extraction (`2 research`) |
| **`/compact`** | **Lab + Native** (`0x3aad9c8` / `0xbe58d60`) | **31** | **19** | 379.7 | 167.8 | 0 (0) | 2 | 0 | **0.0%** (`0/31`) | Reactive trajectory pruning + pinned state preservation |
| **`/owl`** | **Antigravity Lab** (`0x3a7b7e6` / `0x14e574438`) | **29** | **25** | 429.1 | 205.1 | **7 (8)** | **12** | **2** | **0.0%** (`0/29`) | 1-hop `DeepInvestigator` + `DeepCoder` fan-out (`100% inherit`) |
| **`/benchmark`** | **Antigravity Lab** (`0x3a88e31` / `0x14e5744a8`) | **11** | **10** | 399.6 | 193.9 | **3 (3)** | **162** | **1** | **0.0%** (`0/11`) | Programmatic tool synthesis + empirical harness execution |
| **`/goal`** | **Native CLI** (`0xbe58cf8` / `0xbe5c530`) | **9** | **7** | 393.7 | 173.9 | 6 (6) | 0 | 2 | **11.1%** (`1/9`) | Continuous loop until completion criteria met |
| **`/battle`** | **Antigravity Lab** (`0x3ad50c3` / `0x14e574400`) | **8** | **7** | 146.9 | 68.1 | **2 (4)** | **7** | **2** | **0.0%** (`0/8`) | 2-gladiator adversarial duel (`gladiator_canvas_a` vs `webgl_b`) |
| **`/plan`** | **Native CLI** (`0xbe58f00` / `0x39bfa3f`) | **6** | **6** | 566.2 | 256.0 | 0 (0) | 0 | 0 | **0.0%** (`0/6`) | Single-agent static `<PLAN>` prompt (`3,735` bytes) |
| **`/boost`** | **Native CLI** (`0xbe590a0` / `0x140ca8600`) | **6** | **5** | 57.0 | 23.8 | 5 (5) | 0 | 0 | **0.0%** (`0/6`) | 2-hop `DeepCoderCoordinator -> DeepCoderWorkerL0` (+38K token hop) |
| **`/teamwork-preview`** | **Lab Bridge -> Native** (`0x14e574550` / `0xbe58fd0`) | **5** | **5** | 215.4 | 97.2 | 2 (2) | 0 | 0 | **40.0%** (`2/5`) | Pre-execution `ask_question` interview + team spawn |
| **`/generative_ui`** | **Antigravity Lab** (`0x3a3433c` / `0x14e5744e0`) | **3** | **3** | 41.7 | 16.7 | 0 (0) | 0 | 0 | **0.0%** (`0/3`) | Interactive HTML5/Canvas/WebGL sidecar artifact rendering |
| **`/btw`** | **Native CLI** (Aside overlay) | **3** | **1** | 115.3 | 54.3 | 0 (0) | 0 | 0 | **0.0%** (`0/3`) | Ephemeral side-query overlay (extended by Lab `/con btw`) |
| **`/teamwork`** | **Native CLI** (`0xbe58fd0` / `0xbe5c890`) | **1** | **1** | 2,195.0 | 1,061.0 | 0 (0) | 0 | 0 | **0.0%** (`0/1`) | Native teamwork mode (`disable-teamwork-forced-flash-model`) |

### Automated Benchmark Verification (`scripts/benchmark_antigravity_lab.py`)

Run the forensic benchmark suite to reproduce all binary offset checks, PE command table unpacks, CLI gateway regex validations, and turn-windowed transcript telemetry metrics:

```bash
python scripts/benchmark_antigravity_lab.py
```

*   **Layer 1 (Binary ABI Gate)**: Scans `agy.exe` (`204,027,392` bytes, `ImageBase = 0x140000000`) in `2.47s`, confirming **54/54 (100.0%)** reversed flags at their exact PE offsets, **12/12** native 104B slash command descriptors at `0xbe58cf8`, **11/11** patched 56B `GenericCommand` structs in `.proxcv` (`VA 0x14e574400..0x14e574630`, raw `0xc292a00..0xc292c30`), and the `PROX_CMD_V1` marker at `0xc292fda`.
*   **Layer 2 (CLI Gateway & Sync Gate)**: Validates **54/54 (100.0%)** `--<kebab-flag>=true` arguments against `Sync-CliExperimentFlags` in `scripts/agy_gateway.ps1` and benchmarks `snake_case <-> kebab-case` key translation at **8,516,951 ops/sec**.
*   **Layer 3 (Transcript Telemetry Gate)**: Parses **479** real conversation logs (`178,294` lines) and matches untruncated `tool_calls[].args` from `transcript_full.jsonl` by `step_index` in `4.58s` (**38,914 lines/sec**), verifying **82** `invoke_subagent` calls (**154** spawned subagents across `13` distinct `TypeName` personas: `self` [`130`], `research` [`6`], `DeepCoder` [`4`], `milestone_worker` [`3`], `ReadmeEngineer` [`2`], `DeepCoderWorkerL0` [`2`], `ClaudeAgentSpecialist` [`1`], `DeepInvestigator` [`1`], `DeepCoderImprovementWorker` [`1`], `gladiator_canvas_a` [`1`], `gladiator_webgl_b` [`1`], `path_sanitizer_core` [`1`], `path_sanitizer_tests` [`1`]), **865** `manage_subagents` calls, **1,539** `call_mcp_tool` invocations, and **270** `schedule` timers.

### Empirical Production Telemetry & Real Tool-Call Evidence

Full sanitized telemetry datasets and benchmark outputs are available at:
* **Empirical Telemetry Records**: [`docs/telemetry/verified_transcript_proofs.jsonl`](docs/telemetry/verified_transcript_proofs.jsonl) ([View on GitHub](https://github.com/yuatemycat/Proxymateur-Clean/blob/main/docs/telemetry/verified_transcript_proofs.jsonl))
* **Forensic Benchmark Suite Results**: [`docs/telemetry/antigravity_lab_benchmark_results.json`](docs/telemetry/antigravity_lab_benchmark_results.json) ([View on GitHub](https://github.com/yuatemycat/Proxymateur-Clean/blob/main/docs/telemetry/antigravity_lab_benchmark_results.json))

The following untruncated JSONL records are indexed directly from `~/.gemini/antigravity-cli/brain/<conversation-id>/.system_generated/logs/transcript_full.jsonl`. Rather than controlled A/B ablation tests or cryptographic checks, these 28 records represent local index lookups (`conversation_id` + `step_index`) against historical production sessions, demonstrating empirical evidence of features and tool schemas invoked in actual workflows and contrasting them against native `/boost` and `/teamwork-preview`:

```jsonl
// [Group 1: Multi-Agent & Swarm] Parallel Pro/Opus Inheritance (disable-teamwork-forced-flash-model @ 0x3aeda74 + enable-subagent-hub @ 0x3a22b73)
// Conversation: 00acf6fa-ee44-432d-95f0-ebfad5730aa9 | Step: 486 | Spawns 2 concurrent subagents inheriting parent Pro/Opus model
{"step_index": 486, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "invoke_subagent", "args": {"Subagents": [{"Model": "inherit", "Role": "Native Cloak Engineer", "TypeName": "self", "Prompt": "You are NativeCloakEngineer on the core team. Your mission is to upgrade and compile ~/workspace/app/guard.c..."}, {"Model": "inherit", "Role": "Emulator Orchestrator", "TypeName": "self", "Prompt": "You are EmulatorOrchestrator on the core team. Your mission is to upgrade ~/workspace/app/orchestrator.py..."}], "toolAction": "Invoking swarm agents", "toolSummary": "Spawn Architecture Swarm"}}]}

// [Group 1: Multi-Agent & Swarm] 4-Way Parallel Flash Batch + Hub Lifecycle Management (jetski-autonomous-mode @ 0x3a59f1c + enable-swarm-monitor @ 0x3a36434)
// Conversation: 0088482d-189d-4238-a7a5-aacefde43748 | Step: 71 & Conv: 00acf6fa-ee44-432d-95f0-ebfad5730aa9 | Step: 495
{"step_index": 71, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "invoke_subagent", "args": {"Subagents": [{"Model": "flash", "Role": "Tier 1 & Templates Architect", "TypeName": "self", "Workspace": "inherit"}, {"Model": "flash", "Role": "Tier 2 Domain Extractor", "TypeName": "self", "Workspace": "inherit"}, {"Model": "flash", "Role": "Tier 3 Runbook & Archive Engineer", "TypeName": "self", "Workspace": "inherit"}, {"Model": "flash", "Role": "Workspace & Runtime Hygiene Engineer", "TypeName": "self", "Workspace": "inherit"}], "toolSummary": "Spawn 4 flash subagents concurrently"}}]}
{"step_index": 495, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "manage_subagents", "args": {"Action": "kill", "ConversationIds": ["77718629-f512-4e7e-bef5-c51eb7591434"], "toolSummary": "Kill idle subagent"}}]}

// [Group 1: Image Generator Subagent] Native Imagen Asset Synthesis (enable-image-generator-subagent @ 0x3acc025)
// Conversation: c1b95f92-3ce2-4a59-a0b8-42ec94fba4ba | Step: 534
{"step_index": 534, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "generate_image", "args": {"AspectRatio": "16:9", "ImageName": "spotlight_bar", "Prompt": "UI design mockup of a sleek dark-themed floating spotlight launcher bar (Raycast/Alfred style for Windows)...", "toolSummary": "Generate Spotlight Bar UI mockup"}}]}

// [Group 2: Deep Exploration & Arena] /owl Research Taxonomists + /battle Custom Arena Gladiators (enable-owl-slash-command @ 0x3a7b7e6 + enable-battle-mode-custom-agents @ 0x3ad50c3)
// Conversation: 2bc26c6e-052e-45c0-b587-7baae0bc152c | Step: 39 & Conv: 2ab783ff-52d9-4829-b8fc-029f27df17c5 | Step: 45
{"step_index": 39, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "invoke_subagent", "args": {"Subagents": [{"Model": "inherit", "Role": "Protocol & Reversing Taxonomist", "TypeName": "research"}, {"Model": "inherit", "Role": "Engine Integration Architect", "TypeName": "research"}]}}]}
{"step_index": 45, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "invoke_subagent", "args": {"Subagents": [{"Model": "inherit", "Role": "OffscreenCanvas Dirty-Rect Champion", "TypeName": "gladiator_canvas_a"}, {"Model": "inherit", "Role": "Instanced WebGL Shader Champion", "TypeName": "gladiator_webgl_b"}]}}]}

// [Contrast: Native /boost Coordinator Hop & Native /teamwork-preview Questionnaire Gate]
// Conversation: 589f5a7c-1327-4912-90d5-a17ebe079594 | Step: 2 & 7 (Native /boost consumes 37,972 input tokens to spawn DeepCoderWorkerL0, then aborts on 429)
{"step_index": 2, "type": "PLANNER_RESPONSE", "input_tokens": 37972, "output_tokens": 1106, "tool_calls": [{"name": "invoke_subagent", "args": {"Subagents": [{"Model": "inherit", "Role": "Benchmark README Coder", "TypeName": "DeepCoderWorkerL0"}]}}]}
{"step_index": 7, "type": "SYSTEM_MESSAGE", "content": "The subagent Benchmark README Coder (DeepCoderWorkerL0) with id \"d98f476d-5649-4586-af42-ab6ee62f2542\" encountered an error and has either stopped or failed to start execution: RESOURCE_EXHAUSTED (code 429)"}
// Conversation: 2ab783ff-52d9-4829-b8fc-029f27df17c5 | Step: 3 (Native /teamwork-preview blocks on interactive ask_question modal before starting work)
{"step_index": 3, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "ask_question", "args": {"questions": [{"question": "What type of project or objective would you like the multi-agent team to tackle?"}, {"question": "What is the primary purpose and quality bar for this project?"}], "toolSummary": "Elicit project idea"}}]}

// [Group 3: Customizations 2.0 & Plugins] Dynamic Agent Persona Registration + Non-Blocking MCP Dispatch (enable-customization-kind-agent @ 0xa5b5301 + enable-customization-kind-mcp @ 0xa5b535b)
// Conversation: 26066452-f54f-4c7c-87ef-42c8f67209b2 | Step: 105 & Conv: 0088482d-189d-4238-a7a5-aacefde43748 | Step: 10
{"step_index": 105, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "define_subagent", "args": {"Name": "ReadmeEngineer", "Description": "Specialist agent for technical documentation, README restructuring, and markdown verification in the workspace.", "EnableMCPTools": true, "EnableSubagentTools": false, "EnableWriteTools": true}}]}
{"step_index": 10, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "call_mcp_tool", "args": {"ServerName": "code-review-graph", "ToolName": "build_or_update_graph_tool", "Arguments": {"full_rebuild": false, "postprocess": "minimal", "repo_root": "~/workspace/app"}}}]}

// [Group 4 & Group 5: Sidecar UI Runtime & DeepMind Policy Guardian / Browser Subagent v2] (jetski-generative-ui @ 0x3a3433c + enable-browser-subagent-v2 @ 0x3a96112 + enable-command-assessor @ 0x3a6d7c5)
// Conversation: 30ae7968-2823-4d1f-ba72-f797b9509d7c | Step: 0 & Conv: 6d7dd46e-4f27-4f19-93ec-271f39f3af0e | Step: 63 & Conv: 19f27cba-a2d6-44ba-a461-04b13d968dc7 | Step: 843
{"step_index": 0, "type": "USER_INPUT", "content": "/generative_ui Hi"}
{"step_index": 63, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "read_url_content", "args": {"Url": "https://aistudio.google.com/learn/gemini-4-argon-developer-guide", "toolAction": "Reading developer guide", "toolSummary": "Read Gemini 4 Argon dev guide"}}]}
{"step_index": 843, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "run_command", "args": {"CommandLine": "python -c \"import json; p=r'~\\.gemini\\antigravity-cli\\settings.json'; print(len(json.load(open(p)).get('experiments',{})))\"", "Cwd": "~/workspace/app", "WaitMsBeforeAsync": 5000, "toolSummary": "Verify experiments in settings.json"}}]}

// [Group 6 & Group 7: Scheduled Tasks v2 + Cortex Pre-Restructure Snapshot] (scheduled-tasks-v2 @ 0xa5b578f + cortex-snapshot-recording @ 0x3a88e95 / 0x4224882)
// Conversation: 00fad603-48ba-4eca-bf20-d0df14bc2975 | Step: 242 & Conv: 0088482d-189d-4238-a7a5-aacefde43748 | Step: 69
{"step_index": 242, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "schedule", "args": {"DurationSeconds": 30, "Prompt": "Check if release build has completed", "TimerCondition": "00fad603-48ba-4eca-bf20-d0df14bc2975/task-233", "toolSummary": "Wait for build task"}}]}
{"step_index": 69, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "run_command", "args": {"CommandLine": "Copy-Item -Path \"~/workspace/app/AGENTS.md\" -Destination \".../scratch/AGENTS.original.md\" -Force; git commit --allow-empty -m \"chore(pre-restructure): snapshot working tree state before restructuring\"", "Cwd": "~/workspace/app", "WaitMsBeforeAsync": 5000}}]}
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
