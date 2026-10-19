# Proxymateur Development Guidelines

## 1. Quota & Account Model Invariants

- **Strict Quota Decoupling (Gemini vs. 3P/Claude)**:
  - Antigravity accounts maintain independent quota pools: `Gemini Models` and `Claude and GPT models` (3P).
  - Claude weekly quota exhausts quickly (often at 0%), while Gemini quota remains fully available (100%).
  - **NEVER** use `Math.min(...)` across both pools or allow Claude quota exhaustion to zero out, throttle, or degrade Gemini quota calculations, summaries, or sorting rank.
  - The main summary pills and fleet capacity metrics represent **Gemini Quota** by default.
  - Accounts with exhausted Claude weekly quota are still fully capable of servicing Gemini requests and must be marked ready if Gemini quota is available.

- **Sorting & Priority Logic**:
  - When sorting accounts by reset time (e.g. `reset_5h_weekly_priority`), evaluate **Gemini** weekly quota so accounts with large available Gemini budgets receive higher priority.
  - Sorting by highest quota must reflect Gemini effective quota.

## 2. UI & UX Conventions

- **Email & Account Display**:
  - For standard emails (especially `@gmail.com`), display and truncation should emphasize the username prefix before `@` rather than trailing ellipses that obscure identity.
- **Notifications & Banners**:
  - Notifications, toasts, and alert banners must be positioned on the right side and be non-blocking.

## 3. Windows Build & Deployment Workflow

When compiling and delivering changes for Proxymateur on Windows:
1. **Verification**: Run `npx tsc --noEmit` and `npm run build` to ensure 0 frontend compilation or bundling errors.
2. **Binary Build**: Execute `cmd.exe /c "build_exe.bat"`.
3. **Hot Deployment**:
   - Check and gracefully terminate any running `proxymateur.exe` process (`Stop-Process -Name "proxymateur" -Force`). The exe was formerly named `antigravity-tools.exe`.
   - Copy `src-tauri\target\release\proxymateur.exe` to:
     - `E:\03_Devops\AntigravityManager\bin\proxymateur.exe`
     - `E:\01_Apps\Installed\Proxymateur\proxymateur.exe`
   - Restart the executable from `E:\03_Devops\AntigravityManager\bin\proxymateur.exe`.
   - Or use the scripted deploy: `.\scripts\deploy_proxymateur.ps1` (dry run), `-Apply`, later `-Apply -Cleanup`.
4. **⛔ Live Session & Binary Replacement Safety**:
   - **NEVER** run `Stop-Process` or `taskkill` against `agy.exe` — the active CLI agent session runs inside `agy.exe`, and killing it terminates the user's active conversation.
   - To replace a locked/running Windows binary (`agy.exe`, `language_server.exe`, etc.), always use atomic NTFS rename in Python (`os.rename(target, f"{target}.running_{ts}")`) followed by `shutil.move(new_bin, target)`.
   - To apply configuration changes to a running `proxymateur.exe` instance (`127.0.0.1:8045`), use `POST http://127.0.0.1:8045/api/config` with `Authorization: Bearer <api_key>` and body `{"config": <full_gui_config>}` instead of killing the process.

## 4. Windows Startup & Window Lifecycle Invariants

- **Default Window Visibility**:
  - In `src-tauri/tauri.conf.json`, `windows[0].visible` MUST remain `true`.
  - **NEVER** set `visible: false` relying on delayed frontend dynamic imports (`import("@tauri-apps/api/core").then(...)`) to show the window.
  - Quiet startup policies (`--minimized` on login) must hide the window to tray via backend lifecycle hooks (`apply_login_launch_policy`), while normal user launches remain visible and focused immediately.

- **Agent Sandbox Desktop vs. User Interactive Desktop (`WinSta0\default`)**:
  - Automated agent tools (`run_command`) execute under an isolated desktop station (`exebox-...`) and Windows Job Object.
  - **NEVER** leave desktop GUI binaries running from inside `run_command` expecting the user to see them on their screen. They will be trapped on the virtual desktop, hold single-instance mutexes/sockets against the user, and terminate abruptly when the tool step ends.
  - For verification: deploy binaries to canonical paths (`E:\01_Apps\Installed\Proxymateur` and project root), stop lingering sandbox test processes, and let the user launch directly from their native desktop shortcut.

- **Headless Port 8045 Takeover & Single-Instance Bounds**:
  - Desktop GUI launches must check port 8045 for running `--headless` background instances, issuing graceful `/system/shutdown` and waiting for port release before binding.
  - Secondary launches must complete single-instance handoffs with strict timeout bounds (<= 1.5s) and exit cleanly with code 0 in < 3s, never creating zombie processes.

## 5. Code Delivery (>10 Lines) & Context Compaction Hygiene

- **Code Delivery Invariant (>10 Lines Must Be in Files)**:
  - Whenever providing, generating, or executing code snippets, scripts, patches, or Colab cells **longer than 10 lines**, **NEVER** dump them only inline in chat or inside inline shell strings (`python -c "..."` or `powershell -Command "..."`).
  - Always write code >10 lines to a concrete file and provide a clickable Markdown file link:
    - **Temporary / One-off code** (diagnostic probes, benchmark scripts, temporary patches): Write to `scratch/` in the active workspace (or `<appDataDir>\brain\<conversation-id>\scratch\`).
    - **Permanent / Reusable code** (project features, deployment scripts, persistent patches): Write directly to the canonical project directory (`scripts/`, `src/`, etc.).
  - In chat responses, show only a brief 1–3 line usage command and link to the created file.

- **Task Log & Context Window Hygiene (Preventing Unwanted Auto-Compaction)**:
  - **NEVER** call `view_file` or `Read` on entire `.system_generated/tasks/*.log` files without line bounds (`StartLine`/`EndLine`), as repeated full-log reads rapidly burn 100K+ tokens and trigger back-to-back auto-compactions.
  - Prefer the `agy-context-guard` MCP tool (`tail_task_log`) or bounded tail reads (last 30–50 lines) when inspecting background task progress.
  - Pin critical session variables (live tunnel URLs, benchmark `tok/s`, hardware states) via `pin_session_state` (`agy-context-guard` MCP) or `@modelcontextprotocol/server-memory` so they survive `/compact` cycles with zero loss.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**This project has a knowledge graph. Start with the code-review-graph
MCP tools to narrow scope, then read the source.** The graph is cheaper than scanning files and
gives you structural context (callers, dependents, test coverage) that file search cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes_tool` or `query_graph_tool` instead of Grep
- **Understanding impact**: `get_impact_radius_tool` instead of manually tracing imports
- **Code review**: `detect_changes_tool` + `get_review_context_tool` instead of reading entire files
- **Finding relationships**: `query_graph_tool` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview_tool` + `list_communities_tool`

### Verify in the source

- Narrow scope with the graph, then read the source. Do not change code from graph output alone.
- For any non-trivial change, read the implementation and the relevant tests before concluding.
- Verify the exact source when touching behavior, database logic, migrations, retries, fallbacks,
  recovery, or compatibility code.
- When the graph and the source disagree, the source wins. The graph may be stale or may not
  model that relationship.
- An empty graph result can mean "not indexed" or "not statically visible", not "does not exist".

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes_tool` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context_tool` | Need source snippets for review — token-efficient |
| `get_impact_radius_tool` | Understanding blast radius of a change |
| `get_affected_flows_tool` | Finding which execution paths are impacted |
| `query_graph_tool` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes_tool` | Finding functions/classes by name or keyword |
| `get_architecture_overview_tool` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes_tool` for code review.
3. Use `get_affected_flows_tool` to understand impact.
4. Use `query_graph_tool` pattern="tests_for" to check coverage.
<!-- /code-review-graph MCP tools -->
