"""
Synchronizes global ~/.gemini/config/GEMINI.md, ~/.gemini/config/mcp_config.json,
and ~/.gemini/config/rules/context-and-code-delivery-invariants.md.
"""

import json
from pathlib import Path

home = Path.home()
config_dir = home / ".gemini" / "config"
rules_dir = config_dir / "rules"
rules_dir.mkdir(parents=True, exist_ok=True)

# 1. Update global GEMINI.md
gemini_md_path = config_dir / "GEMINI.md"
gemini_md_content = gemini_md_path.read_text(encoding="utf-8") if gemini_md_path.exists() else ""

section_4_header = "## 4. Code Delivery (>10 Lines in Files) & Context Compaction Hygiene"
section_4_body = """## 4. Code Delivery (>10 Lines in Files) & Context Compaction Hygiene
- **Code Delivery Invariant (>10 Lines Must Be in Files)**:
  - Whenever providing, generating, or executing code snippets, scripts, patches, or Colab cells **longer than 10 lines**, **NEVER** dump them only inline in chat or inside inline shell strings (`python -c "..."` or `powershell -Command "..."`).
  - Always write code >10 lines to a concrete file and provide a clickable Markdown file link:
    - **Temporary / One-off code** (diagnostic probes, benchmark scripts, Colab cells, temporary patches): Write to `scratch/` in the active workspace (or `<appDataDir>\\brain\\<conversation-id>\\scratch\\`).
    - **Permanent / Reusable code** (project features, deployment scripts, persistent patches): Write directly to the canonical project directory (`scripts/`, `src/`, etc.).
  - In chat responses, show only a brief 1–3 line usage command and link to the created file.
- **Task Log & Context Window Hygiene (Preventing Unwanted Auto-Compaction)**:
  - **NEVER** call `view_file` or `Read` on entire `.system_generated/tasks/*.log` files without line bounds (`StartLine`/`EndLine`), as repeated full-log reads rapidly burn 100K+ tokens and trigger back-to-back auto-compactions.
  - Prefer the `agy-context-guard` MCP tool (`tail_task_log`) or bounded tail reads (last 30–50 lines) when inspecting background task progress.
  - Use `code-review-graph` MCP tools (`semantic_search_nodes_tool`, `get_review_context_tool`, `query_graph_tool`) first before reading whole source files.
  - Pin critical session variables (live tunnel URLs, benchmark `tok/s`, hardware states) via `pin_session_state` (`agy-context-guard` MCP) or `memory` MCP so they survive `/compact` cycles with zero loss.
"""

if section_4_header not in gemini_md_content:
    updated_gemini_md = gemini_md_content.rstrip() + "\n\n" + section_4_body
    gemini_md_path.write_text(updated_gemini_md, encoding="utf-8")
    print(f"[OK] Updated {gemini_md_path}")
else:
    print(f"[OK] {gemini_md_path} already contains Section 4")

# 2. Write dedicated global rule file in ~/.gemini/config/rules/
rule_file = rules_dir / "context-and-code-delivery-invariants.md"
rule_file.write_text(
    "# Context Compaction, Task Log Hygiene & Code Delivery Invariants\n\n" + section_4_body,
    encoding="utf-8",
)
print(f"[OK] Wrote {rule_file}")

# 3. Update global ~/.gemini/config/mcp_config.json
mcp_config_path = config_dir / "mcp_config.json"
mcp_data = {}
if mcp_config_path.exists():
    try:
        mcp_data = json.loads(mcp_config_path.read_text(encoding="utf-8"))
    except Exception:
        mcp_data = {}

servers = mcp_data.setdefault("mcpServers", {})

# Fix antigravity-manager binary path to proxymateur.exe if present
if "antigravity-manager" in servers:
    servers["antigravity-manager"]["command"] = r"E:\03_Devops\AntigravityManager\bin\proxymateur.exe"

servers["code-review-graph"] = {
    "command": r"E:\03_Devops\Python\Scripts\code-review-graph.exe",
    "args": ["serve"],
}

servers["agy-context-guard"] = {
    "command": r"E:\03_Devops\Python\python.exe",
    "args": [r"E:\03_Devops\AntigravityManager\mcp\agy_context_guard.py"],
}

servers["memory"] = {
    "command": r"E:\03_Devops\NodeJS\node.exe",
    "args": [
        r"E:\03_Devops\NodeJS\node_modules\@modelcontextprotocol\server-memory\dist\index.js"
    ],
    "env": {
        "MEMORY_FILE_PATH": str(home / ".gemini" / "antigravity" / "memory_graph.jsonl")
    },
}

mcp_config_path.write_text(json.dumps(mcp_data, indent=2), encoding="utf-8")
print(f"[OK] Updated {mcp_config_path} with servers: {list(servers.keys())}")
