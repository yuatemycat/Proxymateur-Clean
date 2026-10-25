[← Back to the README](../README.md)

# Antigravity Lab: 54 Experiment Toggles

This page holds the detailed evidence behind the Antigravity Lab settings. It contains only two kinds of statements:

- **[binary]** Read from `agy.exe` (204,027,392 bytes) by static analysis. Function names come from the Go symbol table. "Read by" means code in that function loads the toggle's name string; it does **not** say what the toggle does.
- **[observed]** Counts taken from the author's own local conversation transcripts. They show what happened, not why, and they are not a controlled comparison.

No toggle has been confirmed by switching it on and off and comparing behavior. The 7 clusters are the grouping used in the Lab settings UI (**Settings → Advanced → Antigravity Lab** in the app), not something defined by the engine.

### Toggles and the `agy.exe` code that reads them [binary]

Of the 54 toggles, 53 appear as strings in `agy.exe`, 42 of those are loaded by named code, 11 are present with no direct code reference found (a scan for RIP-relative loads and pointers; indirect references are not ruled out), and 1 (`enable-voice-activity-events`) is not an experiment key.

| Cluster | Toggle | Read by (`agy.exe` function) |
| :--- | :--- | :--- |
| 1 | `jetski-autonomous-mode` | `cortex/config.augmentConversationalConfigWithExperiment` (entry [9] in `supportedExperiments` slice `0x14c0d01f0`) |
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

- **`disable-teamwork-forced-flash-model`**: read in `InvokeSubagentTool.launch` (`0x14232a819`) and `InvokeSubagentHandler.Handle` (`0x14237a2b8`). In both functions, the key is queried via `runtime.mapaccess2_faststr`. On the path where the flag is missing or false (`cmp byte ptr [rdx], 0; je`), execution jumps to `0x14232a87f` which explicitly executes `mov dword ptr [rdx+4Ch], 3`, where `3` is the internal enum forcing the subagent down to Gemini Flash. When set to `true`, the assignment is bypassed, allowing subagents to inherit Pro, Ultra, or Opus models (`inherit: 147`, `flash: 23` in verified session telemetry).
- **`enable-programmatic-tools`**: read in `cortex/core/tools.NewRunWorkflowTool` (`0x142389ed4`). The runtime queries `runtime.mapaccess2_faststr` with `"enable-programmatic-tools"`. If false or missing (`test bl, bl; je 0x142389f99`), tool registration is completely skipped. If true, it loads the `NewRunWorkflowTool` descriptor (`0x14a51e948`) and exposes on-the-fly workflow/script synthesis (`run_workflow`).
- **`enable-battle-mode`**: read in `cortex.(*CascadeManager).ValidateBattleMode` (`0x1424d2718`). The method calls `IsExperimentEnabled` with `"enable-battle-mode"`. If false, validation aborts, preventing unauthorized adversarial subagent orchestration. If true, coordinates two competing subagents in a Colosseum arena.
- **`enable-fork-with-subagents`**: read in `cortex.(*CascadeManager).allowForkWithSubagents` (`0x1424ebddb`). If `CascadeManager` context is nil, returns 0 (`xor eax, eax`). Otherwise calls `IsExperimentEnabled("enable-fork-with-subagents")`. When enabled, `invoke_subagent` calls specifying `Workspace: "branch"` provision isolated git worktrees rather than polluting the parent workspace.
- **`enable-command-assessor`**: read in `cortex/config.CommandAssessorEnabled` (`0x1418594d3`). Evaluates `IsExperimentEnabled("enable-command-assessor")`. If false (`test al, al; jz`), returns 0 immediately. If true, tests `IsExperimentEnabled("disable-command-assessor")` at `0x1418594f8` and returns `!disable_flag`. Activates DeepMind's safety boundary classifier on proposed shell commands.
- **`enable-command-antivirus`**: read in `cortex/config.augmentConversationalConfigWithExperiment` (`0x141857aa5`). Checks `IsExperimentEnabled("enable-command-antivirus")`. If true, invokes `0x141855f80` and sets `mov byte ptr [rax+28h], 1` (marking Antivirus Active = 1). Heuristically scans proposed shell strings before dispatching to `run_command` to intercept destructive operations.
- **`enable-compact-slash-command`**: read in both `cortex/slashcommands.init.func2` (`0x14215e9bf`) and `cortex/core/prehooks.NewContextSummaryHook` (`0x14224d0ab`). When true, registers the `/compact` command and hooks context summary evaluation to prune conversational history when crossing token limits. When false, both registrations branch to bypass offsets (`0x14215ea2a` and `0x14224d172`).
- **`enable-cost-accumulator`**: read in `cortex/config.augmentConversationalConfigWithExperiment` (`0x1423d7644`) and `cortex.(*CascadeManager)` (`0x1424ebcdb`). Checks if cost tracking is active; if true, registers token accumulation hooks (corroborated in `proxy_logs.db` with 147M input tokens and 124M cached tokens tracked). If false, skips accumulator setup (`je 0x1423d7725`).
- **`jetski-autonomous-mode`**: entry [9] in the `cortex.supportedExperiments` table located at `.data` VA `0x14c141a08` (raw offset `0xc140468`), managed by slice header `0x14c0d01f0` (raw `0xc0cebf0`, len 22) in `cortex/config.augmentConversationalConfigWithExperiment`. Injects hands-free autonomous execution flags into conversational config, suppressing interactive pauses.
- **`enable-model-capacity-exhausted-retries`**: read in `language_server/modelapiccpa.(*Client).Generate` (`0x142a7f544`). When Google upstream returns HTTP 429 (`ResourceExhausted`) or 503, the runtime checks this flag. If false, `xor eax, eax` aborts the turn. If true, `jne 0x142a7f55a` branches directly to the capacity backoff retry loop.
- **`enable-deepagent` / `enable-review`**: `config.deepAgent` (`0x142236d60`) and `config.reviewAgent` (`0x1422371e0`) each load their toggle name plus an `*-arm` string and an `*_effort` string, and call `candidateAgentArm` and `candidateAgentControl`.
- **`enable-owl-slash-command`**: loaded in `agents.init.func8` and `agents.init.func9` (closures in package `cortex/customizations/builtin/agents`), `config.buildDefaultAgent`, and `admincontrols.(*Manager).overrideMultiagentControls` (`0x14185cd60`, called from `OverrideCascadeConfig`).
- **`GetBoostCommandDisabled`**: two generated protobuf getters exist, at `0x140cab360` (`FetchAdminControlsResponse_FeatureControls_MultiagentControls`) and `0x1410f4fe0` (`AdminControls_FeatureControls_MultiagentControls`).
- **`enable_voice_activity_events`**: the name appears only inside Google Cloud Speech-to-Text protobuf definitions (`StreamingRecognitionConfig`). The kebab-case name `enable-voice-activity-events` does not appear anywhere in `agy.exe`.

### Observed in the author's transcripts [observed]

Snapshot from the stored results file (`timestamp` 2026-10-23T23:02:49Z). Transcripts keep accumulating, so a fresh run gives somewhat larger numbers.

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

Run it from a scratch directory if you do not want it to overwrite the stored results; it writes to `docs/telemetry/` relative to where it is run. The script needs a local `agy.exe` and local Antigravity transcripts, so only the author can recompute the **[observed]** figures. The **[binary]** facts can be re-derived by anyone with the same `agy.exe` build. The full output is stored in [`docs/telemetry/antigravity_lab_benchmark_results.json`](telemetry/antigravity_lab_benchmark_results.json).

### Transcript samples

[`docs/telemetry/transcript_samples.jsonl`](telemetry/transcript_samples.jsonl) ([View on GitHub](https://github.com/yuatemycat/Proxymateur-Clean/blob/main/docs/telemetry/transcript_samples.jsonl)) holds 28 records copied from `~/.gemini/antigravity-cli/brain/<conversation-id>/.system_generated/logs/transcript_full.jsonl`. Each has a `conversation_id` and `step_index`, so the author can find the original step locally. They show that these tool calls were made with these arguments. They are samples, not a complete or controlled dataset, and they do not show what any toggle does.
