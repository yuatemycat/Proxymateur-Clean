# Proxymateur-Clean

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC_BY--NC--SA_4.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/yuatemycat/Proxymateur-Clean?color=blue)](https://github.com/yuatemycat/Proxymateur-Clean/releases)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-orange.svg)](https://v2.tauri.app/)
[![Rust 2021](https://img.shields.io/badge/Rust-2021-red.svg)](https://www.rust-lang.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)](https://www.typescriptlang.org/)

Sovereign account studio, multi-protocol AI gateway, and experiment-flag settings for Google Antigravity. Built with Rust 2021 (Axum HTTP engine, SQLite `rusqlite`), Tauri v2, and React 19.

Proxymateur-Clean operates strictly with client-side Bring-Your-Own (BYO) OAuth 2.0 credentials and zero third-party telemetry. It implements **strict quota decoupling** (guaranteeing that 3P/Claude exhaustion never throttles or zeroes out Gemini pool calculations), automated token self-healing, native stdio Model Context Protocol (MCP) server support, and a settings page with toggles for 54 Antigravity experiment flags (grouped into 7 clusters in the UI).

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
|      └── Prompt Sanitization & Inbound Safety Shim (Server-side)  |
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
- Navigate to **Agent Proxy → API Proxy** to configure ports, upstream routing, circuit breaker backoffs, and public tunnels.
- Navigate to **Observability → Traffic Logs** to inspect real-time request/response payloads, latency, and token attribution.
- Navigate to **Observability → Token Stats** to view aggregated token usage metrics, caching statistics, and per-model consumption charts.
- Navigate to **Settings → Advanced → Antigravity Lab** to configure the 54 experiment toggles.
- Navigate to **Settings → OpenAI Models** to configure external upstream providers (NVIDIA NIM, DeepSeek, Groq, OpenRouter, Ollama) and effort-tier routing.
- Navigate to **Settings → Account** to configure proactive low-quota alerts and automated circuit breaker backoffs.

### Workflow B: CLI & Autonomous Multi-Agent Workflows

Proxymateur-Clean provides an intelligent wrapper script for the Antigravity CLI (`agy`) that runs natively by default and routes through the local gateway when `--px` is passed:

```bash
# 1. Native CLI execution (zero overhead, direct Google connection)
agy "Audit this repository for race conditions"

# 2. Proxy Mode via Proxymateur gateway (automatic account rotation on 429)
agy -px "Run full end-to-end regression tests"

# 3. /swarm (registered description: "Autonomous Multi-Agent Swarm Hub. Coordinates parallel specialist subagents.")
agy -px "/swarm Implement unit tests for the authentication middleware"

# 4. /owl (registered description: "Deep codebase investigation, iterative autonomous synthesis.")
agy -px "/owl Refactor database connection pooling"

# 5. /battle (registered description: "Colosseum Battle Mode. Competing subagents in an adversarial arena.")
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
- `get_proxy_status`: Inspect whether the proxy engine is running, listening port, active account, and total available accounts.
- `list_proxy_accounts`: List all accounts participating in proxy rotation along with their enabled/disabled status.
- `toggle_proxy_account`: Enable or disable an account in the proxy rotation pool by email address.

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

## Antigravity Lab: 54 Experiment Toggles

This section contains only two kinds of statements:

- **[binary]** Read from `agy.exe` (204,027,392 bytes) by static analysis. Function names come from the Go symbol table. "Read by" means code in that function loads the toggle's name string; it does **not** say what the toggle does.
- **[observed]** Counts taken from the author's own local conversation transcripts. They show what happened, not why, and they are not a controlled comparison.

No toggle has been confirmed by switching it on and off and comparing behavior. The 7 clusters are the grouping used in the Lab settings UI (**Settings → Advanced → Antigravity Lab**), not something defined by the engine.

### Toggles and the `agy.exe` code that reads them [binary]

Of the 54 toggles, 53 appear as strings in `agy.exe`, 42 of those are loaded by named code, 11 are present with no direct code reference found (a scan for RIP-relative loads and pointers; indirect references are not ruled out), and 1 (`enable-voice-activity-events`) is not an experiment key.

| Cluster | Toggle | Read by (`agy.exe` function) |
| :--- | :--- | :--- |
| 1 | `jetski-autonomous-mode` | string present in `agy.exe`; no direct code reference found |
| 1 | `disable-teamwork-forced-flash-model` | `cortex/handlers/handlers.(*InvokeSubagentHandler).Handle`; `cortex/core/tools/tools.(*InvokeSubagentTool).launch` |
| 1 | `enable-subagent-hub` | `cortex/cortex.(*CascadeManager).gatedSubagentHub` |
| 1 | `enable-swarm-monitor` | `cortex/core/components/config/config.buildDefaultAgent` |
| 1 | `enable-fork-with-subagents` | `cortex/cortex.(*CascadeManager).allowForkWithSubagents` |
| 1 | `send-subagent-initial-prompt-as-message` | `cortex/config/config.getToolConfigOverrides` |
| 1 | `enable-swarm-narrator` | `cortex/core/components/config/config.buildDefaultAgent` |
| 1 | `enable-image-generator-subagent` | `cortex/config/config.ImageGeneratorSubagentEnabled` |
| 2 | `enable-owl-slash-command` | `cortex/customizations/builtin/agents/agents.init.func8`; `admin_controls/admincontrols.(*Manager).overrideMultiagentControls`; `cortex/customizations/builtin/agents/agents.init.func9`; `cortex/core/components/config/config.buildDefaultAgent` |
| 2 | `enable-compact-slash-command` | `cortex/slashcommands/slashcommands.init.func2`; `cortex/core/prehooks/prehooks.NewContextSummaryHook` |
| 2 | `enable-battle-mode` | `cortex/cortex.(*CascadeManager).ValidateBattleMode` |
| 2 | `enable-battle-mode-custom-agents` | `cortex/cortex.(*CascadeManager).ValidateBattleMode` |
| 2 | `enable-programmatic-tools` | `cortex/core/tools/tools.NewRunWorkflowTool` |
| 2 | `jetski-generative-ui` | `cortex/core/components/config/config.buildDefaultAgent` |
| 2 | `enable-deepagent` | `cortex/core/components/config/config.deepAgent` |
| 2 | `enable-review` | `cortex/core/components/config/config.reviewAgent` |
| 3 | `enable-plugins` | `language_server/migrations/migrations.(*adoptBWGInstallsMigration).Enabled`; `language_server/language_server.(*Server).ImportProjectFromUrl`; `cortex/core/components/config/config.buildDefaultAgent`; `language_server/language_server.(*Server).checkAndUpgradeBuildWithGooglePlugins`; +1 more |
| 3 | `enable-hook-status` | `cortex/config/config.augmentConversationalConfigWithExperiment` |
| 3 | `enable-customization-kind-agent` | string present in `agy.exe`; no direct code reference found |
| 3 | `enable-customization-kind-skill` | string present in `agy.exe`; no direct code reference found |
| 3 | `enable-customization-kind-rule` | string present in `agy.exe`; no direct code reference found |
| 3 | `enable-customization-kind-mcp` | string present in `agy.exe`; no direct code reference found |
| 3 | `enable-customization-kind-hooks` | string present in `agy.exe`; no direct code reference found |
| 3 | `deprecate-workflows` | `cortex/core/components/config/config.buildDefaultAgent` |
| 4 | `enable-sidecars` | string present in `agy.exe`; no direct code reference found |
| 4 | `enable-ui-sidecars` | `cortex/core/components/config/config.buildDefaultAgent` |
| 4 | `enable-sidecar-sdk` | `cortex/sidecars/sidecars.(*SidecarManager).Start` |
| 4 | `jetski-sidecar-declared-permissions` | `cortex/sidecars/sidecars.(*SidecarManager).SetProjectID`; `cortex/sidecars/sidecars.(*SidecarManager).RunScheduledTask`; `cortex/cortex.(*CascadeManager).getCascadeConfigForAgentExecutor`; `cortex/sidecars/sidecars.(*SidecarManager).runSidecarLoop`; +9 more |
| 4 | `sidecar-gateway` | `cortex/sidecars/sidecars.(*SidecarManager).runSingleInvocation` |
| 4 | `sidecar-iframe-prewarm` | string present in `agy.exe`; no direct code reference found |
| 5 | `enable-command-assessor` | `cortex/config/config.CommandAssessorEnabled` |
| 5 | `enable-command-antivirus` | `cortex/config/config.augmentConversationalConfigWithExperiment` |
| 5 | `allow-experimental-monitors` | `cortex/config/config.augmentConversationalConfigWithExperiment` |
| 5 | `enable-citc-workspace-hygiene-rule` | string present in `agy.exe`; no direct code reference found |
| 5 | `disable-stained-loas2-creds` | `cortex/sidecars/sidecars.(*SidecarManager).prepareInvocationEnv`; `cortex/config/config.getToolConfigOverrides` |
| 5 | `enable-browser-subagent-v2` | `cortex/config/config.BrowserSubagentWebviewEnabled`; `cortex/config/config.getToolConfigOverrides`; `cortex/core/components/config/config.buildDefaultAgent` |
| 6 | `enable-persistent-terminals` | `cortex/config/config.getToolConfigOverrides` |
| 6 | `enable-pty` | `cortex/config/config.getToolConfigOverrides` |
| 6 | `enable-ripgrep-path-search` | `language_server/language_server.(*Server).SearchFiles` |
| 6 | `enable-wait-tool` | `cortex/config/config.getToolConfigOverrides`; `cortex/core/components/config/config.buildDefaultAgent` |
| 6 | `scheduled-tasks-v2` | string present in `agy.exe`; no direct code reference found |
| 6 | `enable-model-capacity-exhausted-retries` | `language_server/modelapiccpa/modelapiccpa.(*Client).Generate` |
| 6 | `enable-mcp-non-blocking-turn-load` | `cortex/config/config.getToolConfigOverrides` |
| 6 | `enable-remote-agent-fastpush-pin` | `language_server/language_server.CreateLanguageServerAndServe.func3` |
| 7 | `cortex-snapshot-recording` | `cortex/config/config.augmentConversationalConfigWithExperiment` |
| 7 | `cortex-snapshot-revert` | `cortex/config/config.augmentConversationalConfigWithExperiment`; `cortex/cortex.(*CascadeManager).snapshotRevertEnabled` |
| 7 | `enable-conversation-search-v2` | `language_server/language_server.(*Server).maybeInitConversationSearch`; `language_server/language_server.(*Server).SearchConversations`; `language_server/language_server.(*Server).tryPostAuthInit.func4.1` |
| 7 | `show-model-selection-change` | `cortex/config/config.augmentConversationalConfigWithExperiment` |
| 7 | `use-component-rewrite` | `cortex/core/components/config/config.buildDefaultAgent`; `cortex/core/tools/tools.NewRunWorkflowTool` |
| 7 | `use-core-direct` | string present in `agy.exe`; no direct code reference found |
| 7 | `use-slash-plan` | `cortex/config/config.augmentConversationalConfigWithExperiment` |
| 7 | `enable-voice-activity-events` | not present as an experiment key; the snake_case form only matches a Google Cloud Speech protobuf field |
| 7 | `cascade-enable-notebook-edit-tool` | `cortex/core/components/config/config.buildDefaultAgent`; `cortex/config/config.getToolConfigOverrides` |
| 7 | `cascade-use-sed-edit-tool` | `cortex/config/config.getToolConfigOverrides` |

### Slash commands in `agy.exe` [binary]

Native commands: 12 entries in a 104-byte-stride table at raw offset `0xbe58cf8`. Descriptions are the literal strings stored in the binary.

| Command | Description |
| :--- | :--- |
| `/goal` | Run until the specified goal is completely finished. |
| `/compact` | Compact the conversation now (summarize history to free up the context window). |
| `/schedule` | Run an instruction on a recurring schedule or as a one-time timer. |
| `/browser` | Invoke a browser agent for web tasks. |
| `/browser-vision` | [Teamfood] Invoke a browser with computer-use tools only with experimental model. |
| `/plan` | Plan carefully before executing a task. |
| `/grill-me` | Interview me to align on a plan. |
| `/teamwork` | Invoke a team of agents to autonomously tackle large projects. |
| `/learn` | Reflect on recent successes or corrections to capture reusable skills or rules. |
| `/boost` | Invoke the Boost multi-agent orchestrator for complex tasks. |
| `/deepagent` | Experimental. Invoke the deep agent to plan, build, verify complex coding tasks. |
| `/review-agent` | Experimental. Invoke the review agent to audit code changes, surface bugs, and verify correctness. |

Injected commands: 11 entries written by `scripts/auto_patch_agy.py` into a `.proxcv` PE section (marker `PROX_CMD_V1` at raw `0xc292fda`; data table at raw `0xc292a00`). Descriptions are the strings stored in that section.

| Command | Description |
| :--- | :--- |
| `/battle` | Colosseum Battle Mode. Competing subagents in an adversarial arena. |
| `/owl` | Deep codebase investigation, iterative autonomous synthesis. |
| `/swarm` | Autonomous Multi-Agent Swarm Hub. Coordinates parallel specialist subagents. |
| `/benchmark` | Programmatic Tool Synthesis & Performance Benchmarking. |
| `/generative_ui` | Render dynamic interactive UI widgets, charts, and visualizations. |
| `/compact` | Compact and prune active conversation context history. |
| `/teamwork-preview` | Multi-agent teamwork subagent orchestrator and parallel preview execution. |
| `/teamwork` | Multi-agent teamwork subagent orchestrator (canonical alias). |
| `/teamwork-previews` | Multi-agent teamwork subagent orchestrator (plural alias). |
| `/team` | Multi-agent teamwork subagent orchestrator (shorthand alias). |
| `/flash` | Quick prompt execution with Gemini Flash model. |

This repository ships skill definitions for the injected commands under `skills/`. In the current `agy.exe` build, `commands.NewRegistry` is at `0x1431929e0` and `commands.(*GenericCommand).Execute` is a 32-byte stub at `0x14318af60`. Code addresses depend on the build and will differ in other versions; the table offsets above were read from the build analysed here.

### Code paths examined in detail [binary]

- **`disable-teamwork-forced-flash-model`**: read in `InvokeSubagentTool.launch` (`0x1422aad20`) and `InvokeSubagentHandler.Handle`. In `launch`, the name is looked up in a string-keyed map; on the path where the lookup does not yield a true value, the code stores the integer `3` at offset `0x4c` of a struct before it calls `findAgentByName` and `launchSubagent`. The same function compares a string against `teamwork_preview` shortly before the lookup. What `3` means, and the full set of conditions, were not determined.
- **`enable-deepagent` / `enable-review`**: `config.deepAgent` (`0x142236d60`) and `config.reviewAgent` (`0x1422371e0`) each load their toggle name plus an `*-arm` string and an `*_effort` string, and call `candidateAgentArm` and `candidateAgentControl`.
- **`enable-owl-slash-command`**: loaded in `agents.init.func8` and `agents.init.func9` (closures in package `cortex/customizations/builtin/agents`), `config.buildDefaultAgent`, and `admincontrols.(*Manager).overrideMultiagentControls` (`0x14185cd60`, called from `OverrideCascadeConfig`). The last function assigns the keys `enable-teamwork-subagent` and `enable-owl-slash-command` into a string-keyed map; the values it assigns were not determined.
- **`GetBoostCommandDisabled`**: two generated protobuf getters exist, at `0x140cab360` (`FetchAdminControlsResponse_FeatureControls_MultiagentControls`) and `0x1410f4fe0` (`AdminControls_FeatureControls_MultiagentControls`). No direct `call` instruction to either was found in `.text` (indirect calls are not ruled out). Whether or how `/boost` uses them was not determined.
- **`enable_voice_activity_events`**: the name appears only inside Google Cloud Speech-to-Text protobuf definitions (`StreamingRecognitionConfig`). The kebab-case name `enable-voice-activity-events` does not appear anywhere in `agy.exe`.

### Observed in the author's transcripts [observed]

474 conversation transcripts (179,969 lines) were scanned. `invoke_subagent` was called 88 times, spawning 160 subagents (`inherit` 137, `flash` 23). These are counts of what was logged; they do not show that any toggle caused them.

| Tool call | Count |
| :--- | ---: |
| `run_command` | 40,678 |
| `view_file` | 19,224 |
| `manage_task` | 8,533 |
| `write_to_file` | 4,181 |
| `replace_file_content` | 3,378 |
| `read_file` | 2,234 |
| `call_mcp_tool` | 1,542 |
| `write_file` | 906 |
| `manage_subagents` | 865 |
| `edit_file` | 563 |
| `schedule` | 273 |
| `search_web` | 185 |
| `send_message` | 169 |
| `invoke_subagent` | 88 |
| `grep_search` | 43 |
| `read_url_content` | 22 |
| `ask_question` | 21 |
| `list_dir` | 10 |
| `define_subagent` | 10 |
| `tail_task_log` | 4 |
| `find_by_name` | 3 |
| `list_resources` | 1 |
| `generate_image` | 1 |

Per slash command, over the turn window the benchmark script attributes to each invocation (see `scripts/benchmark_antigravity_lab.py`):

| Command | Invocations | Sessions | Avg steps | Avg tool calls | `invoke_subagent` calls (spawned) | `manage_subagents` | `define_subagent` | `ask_question` invocations | Subagent models |
| :--- | ---: | ---: | ---: | ---: | :--- | ---: | ---: | :--- | :--- |
| `/swarm` | 90 | 43 | 409.4 | 194.0 | 65 (129) | 824 | 8 | 1/90 | flash 17, inherit 112 |
| `/owl` | 32 | 27 | 394.8 | 188.6 | 8 (9) | 12 | 2 | 0/32 | inherit 9 |
| `/learn` | 31 | 26 | 447.1 | 203.5 | 1 (2) | 7 | 0 | 2/31 | inherit 2 |
| `/compact` | 31 | 19 | 379.7 | 167.8 | 0 (0) | 2 | 0 | 0/31 | - |
| `/benchmark` | 11 | 10 | 399.6 | 193.9 | 3 (3) | 162 | 1 | 0/11 | inherit 3 |
| `/goal` | 9 | 7 | 393.7 | 173.9 | 6 (6) | 0 | 2 | 1/9 | inherit 6 |
| `/boost` | 9 | 7 | 45.4 | 17.6 | 10 (10) | 0 | 0 | 0/9 | inherit 10 |
| `/battle` | 8 | 7 | 146.9 | 68.1 | 2 (4) | 7 | 2 | 0/8 | inherit 4 |
| `/plan` | 6 | 6 | 566.2 | 256.0 | 0 (0) | 0 | 0 | 0/6 | - |
| `/teamwork-preview` | 5 | 5 | 218.0 | 98.0 | 2 (2) | 0 | 0 | 1/5 | inherit 2 |
| `/generative_ui` | 3 | 3 | 41.7 | 16.7 | 0 (0) | 0 | 0 | 0/3 | - |
| `/queue` | 3 | 2 | 182.0 | 84.7 | 1 (1) | 0 | 0 | 0/3 | inherit 1 |
| `/btw` | 3 | 1 | 115.3 | 54.3 | 0 (0) | 0 | 0 | 0/3 | - |
| `/teamwork` | 1 | 1 | 2195.0 | 1061.0 | 0 (0) | 0 | 0 | 0/1 | - |

### Reproducing the numbers

```bash
python scripts/benchmark_antigravity_lab.py
```

The script needs a local `agy.exe` and local Antigravity transcripts, so only the author can recompute the **[observed]** figures. The **[binary]** facts can be re-derived by anyone with the same `agy.exe` build. The full output is stored in [`docs/telemetry/antigravity_lab_benchmark_results.json`](docs/telemetry/antigravity_lab_benchmark_results.json).

### Transcript samples

[`docs/telemetry/transcript_samples.jsonl`](docs/telemetry/transcript_samples.jsonl) ([View on GitHub](https://github.com/yuatemycat/Proxymateur-Clean/blob/main/docs/telemetry/transcript_samples.jsonl)) holds 28 records copied from `~/.gemini/antigravity-cli/brain/<conversation-id>/.system_generated/logs/transcript_full.jsonl`. Each has a `conversation_id` and `step_index`, so the author can find the original step locally. They show that these tool calls were made with these arguments. They are samples, not a complete or controlled dataset, and they do not show what any toggle does.

---

## OpenAI Upstream Transpiler & Multi-Provider Model Management

Proxymateur-Clean includes a native bidirectional OpenAI transpiler (**Settings → OpenAI Models**) that bridges Gemini AST client calls to any standard OpenAI-compatible inference provider, including **NVIDIA NIM, DeepSeek, Groq, OpenRouter, Local Ollama, and vLLM**.

### 1. Unified Effort-Tier Routing

Modern reasoning models support tunable thinking or reasoning effort. Proxymateur-Clean provides automated effort tiering:

- **Reasoning Effort Injection**: When routing to models like `o1`, `o3`, `o4`, `gpt-5`, or `gpt-oss`, appending `-low`, `-medium`, or `-high` automatically maps to the native OpenAI `reasoning_effort` API parameter (`"reasoning_effort": "low" | "medium" | "high"`).
- **Dual-Model Dispatch (e.g. DeepSeek)**: Effort suffixes automatically differentiate between conversational and reasoning variants (e.g., `-low` dispatches to `deepseek-chat`, while `-high` routes to `deepseek-reasoner`).

### 2. Wildcard Prefix Routing & Presets

Route client requests seamlessly to third-party endpoints without reconfiguring development tools:

* **Auto Route Prefix (`auto_route_prefix`)**: By default, requests with the prefix `openai/*` (or custom prefix) bypass Google pools and dispatch to the default OpenAI upstream URL.
* **Built-in Provider Presets**:
  - **NVIDIA NIM**: `deepseek-ai/deepseek-v4.1-flash`, `meta/llama-3.3-70b-instruct` (`https://integrate.api.nvidia.com/v1`)
  - **Groq LPU**: `qwen-2.5-coder-32b` (`https://api.groq.com/openai/v1`)
  - **OpenRouter**: `openrouter/claude-3.5-sonnet` (`https://openrouter.ai/api/v1`)
  - **Local Ollama**: `ollama/deepseek-r1` (`http://127.0.0.1:11434/v1`)
* **Live Latency Probing**: Built-in 1-click test probe in the GUI validates endpoint reachability and measures exact HTTP roundtrip latency in milliseconds.

---

## Resilience, Tunnels & Enterprise Routing

### 1. Gateway Routing Policy (`gateway_routing_mode`)

Fine-tune how accounts participate in proxy routing:
* `all`: All configured and active accounts rotate dynamically across incoming requests.
* `argon_only`: Applies the proxy only to Gemini 4 Argon (Vertex) traffic; all other models go directly to native accounts.

### 2. Vertex AI Direct Routing

Enterprise workspaces can route requests directly to private Google Cloud Platform (GCP) quotas rather than personal accounts:
* **Authentication**: Standard GCP Application Default Credentials (ADC) or explicit service account credentials JSON.
* **Routing Modes**:
  - `default`: Routes Gemini 3.8 Flash calls directly to Vertex AI.
  - `picker`: Granular model-by-model mapping with wildcard support (e.g., `gemini-2.5-* -> gemini-2.5-pro`).
* **Preference Fallback**: Configurable preference (`vertex_first` vs `accounts_first`) ensures seamless failover if cloud quotas are momentarily throttled.

### 3. Cloudflared Zero-Trust Tunnel

Expose your local proxy gateway securely to remote environments, mobile workers, or Cloudflare Workers:
* **Quick Tunnel (`quick`)**: 1-click zero-configuration TryCloudflare tunnel.
* **Authenticated Tunnel (`auth`)**: Connect using your persistent Cloudflare Tunnel token.
* **HTTP/2 Support**: Toggleable HTTP/2 transport optimization for high-concurrency multi-agent swarms.

### 4. Multi-Proxy Pool & Failover Engine

Configure egress proxy pools for external outbound traffic with automated health checks:
* **Selection Strategies**: `round_robin`, `random`, `priority`, `least_connections`, and `weighted_round_robin`.
* **Automated Failover**: Unhealthy proxies are temporarily quarantined upon consecutive health-check failures.

### 5. Proactive Quota Alerts & Circuit Breaker

Protect account health and avoid workflow interruptions during unattended builds:
* **Low Quota Alerts**: System notifications fire when rolling 5-hour quota drops below user-defined percentage thresholds (e.g. 15%).
* **Circuit Breaker Backoff**: Automatically pauses traffic or locks out accounts reaching 0% quota with stepped backoff intervals to prevent repetitive 429 throttling.

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
  ├── components/         Settings, Accounts, Dashboard, Proxy, and Antigravity Lab
  ├── pages/              Desktop pages (Accounts, Dashboard, ApiProxy, Monitor, TokenStats, Readme, Settings)
  ├── stores/             Zustand 5 client-side state stores
  └── types/              TypeScript interfaces (config.ts, accounts.ts, models.ts)
src-tauri/                Tauri v2 desktop backend & Axum HTTP engine
  ├── src/commands/       Tauri IPC command handlers (proxy, accounts, experiments)
  ├── src/models/         Rust serde models (config.rs, accounts.rs)
  └── src/proxy/          Axum proxy engine, protocol adapters, OpenAI transpiler, token manager
scripts/                  DevOps shims (agy_gateway.ps1, antigravity_gateway.ps1, auto_patch_agy.py)
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
