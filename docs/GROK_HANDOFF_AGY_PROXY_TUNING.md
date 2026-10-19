# Grok Handoff: Antigravity Manager & AGY Proxy Performance & Architecture Tuning

## 1. System Overview & Component Locations

Antigravity Proxy consists of two primary layers:
1. **Core Reverse Proxy Engine (Rust/Tauri)**:
   - Source: `D:\02_Projects\Antigravity-Manager`
   - Compiled Binary: `C:\Users\Renzu\AppData\Local\Proxymateur\proxymateur.exe`
   - Active Port: `http://127.0.0.1:8045/v1` (started via `proxymateur.exe --headless` with `AUTH_MODE=off`)
   - Autostart Script: `C:\Users\Renzu\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\antigravity-proxy.vbs`
   - Log File: `C:\Users\Renzu\.proxymateur\logs\headless_service.log`
   - Database / Accounts: `C:\Users\Renzu\.proxymateur\data\`

2. **Python Client Interfaces**:
   - TUI CLI: `C:\Users\Renzu\AppData\Local\Programs\Python\Python312\Scripts\agy-proxy.py`
   - Web UI: `C:\Users\Renzu\AppData\Local\Programs\Python\Python312\Scripts\agy-web-server.py` (`http://127.0.0.1:8090`)
   - Grok Skills Root: `C:\Users\Renzu\.grok\skills\` (contains 226 NTFS junctions to all Hermes & AGY skills)

---

## 2. Key Architecture Details

### Account Pool & Rotation
- **Total Accounts**: 14 configured, 9 active in rotation pool, 5 excluded/disabled.
- **Primary IDE Account**: `mountainhuaguo@gmail.com` (stays at 100% quota, protected from batch traffic).
- **Selection Algorithm**: P2C (Power of Two Choices) in `src-tauri/src/proxy/token_manager.rs`.
- **Sticky Sessions**: Conversations are pinned to an account by session ID until quota exhaustion.
  - Failover is automatic: when an account hits 0–5% quota (e.g., `kdmhg9@gmail.com`), the proxy hot-swaps to the next available account (`jiangmengxianiv@gmail.com`).
  - Hot reload endpoint: `POST http://127.0.0.1:8045/accounts/{id}/toggle-proxy` updates in-memory pool with zero downtime.

### ThinkingStore & Protocol Translation
- **File**: `src-tauri/src/proxy/server.rs` & `src-tauri/src/proxy/token_manager.rs`
- Translates OpenAI Chat Completions requests to Google Gemini / Anthropic upstream formats.
- Streams `reasoning_content` (thinking tokens) separately from `content`.
- Maintains a persistent `ThinkingStore` across turns so multi-turn agentic conversations retain chain-of-thought reasoning state.

---

## 3. Discovered Performance Bottlenecks & Tuning Objectives

### Bottleneck A: Throughput Degrades to 9–14 tokens/s on Long Sessions
- **Observation**: After running for 3+ hours (600+ messages), generation speed drops from 100+ t/s down to 9–14 t/s.
- **Root Cause**:
  1. `ThinkingStore` was replaying **306 historical reasoning blocks** on every turn.
  2. The prompt payload expanded to **466,000 tokens**.
  3. Pre-filling 466K tokens adds 5–8s Time-to-First-Token (TTFT) latency, which drags the overall token rate calculation down.
  4. Cold KV-cache re-ingest occurred when the proxy failed over between accounts.
- **Tuning Tasks**:
  - Implement a **Thinking Retention / Compaction policy** in `ThinkingStore`:
    - Keep only the last $N$ thinking blocks (e.g., last 5–10 turns) instead of an unbounded accumulation.
    - Prune thinking blocks for turns where tool results have already been committed.
  - Add client-side `/compact` advice or automatic threshold warnings when context exceeds 200K tokens.

### Bottleneck B: Account Warmup on Failover
- When a sticky session rotates from an exhausted account to a new account, the new account lacks prefix cache on Google's TPU cluster.
- **Tuning Tasks**:
  - Check whether prefix caching headers or session continuity hints can reduce failover TTFT.
  - Optimize the prompt prefix layout (system prompt + tools first, static) to maximize Google L3 prefix cache hits (`Cache-Opt:L3-Prefix`).

### Bottleneck C: Model Filtering & Canonical Mapping
- Model roster must strictly expose:
  1. `gemini-3.8-flash-high` [Default]
  2. `claude-opus-5-5-high` [Maximum Reasoning]
  3. `gemma-4-26b-gpu` [Local LiteRT GPU]
  4. `claude-sonnet-4-6` [Fast Coding]
  5. `claude-opus-4-6-thinking` [Deep Reasoning]
  6. `gpt-oss-120b-medium` [Open Weights]
- Explicit rule: No Gemini 5.5 (Claude Opus 5.5 High exists, but Gemini is 3.8).

---

## 4. Useful Commands for Verification
```powershell
# Check proxy status & pool counts
& "C:\Users\Renzu\AppData\Local\Proxymateur\proxymateur.exe" proxy status | Out-String

# Check accounts & live quota percentages from Google
& "C:\Users\Renzu\AppData\Local\Proxymateur\proxymateur.exe" accounts --refresh | Out-String

# Inspect recent proxy logs
Get-Content -Path "C:\Users\Renzu\.proxymateur\logs\headless_service.log" -Tail 50

# Test proxy stream
curl.exe -N -X POST http://127.0.0.1:8045/v1/chat/completions -H "Content-Type: application/json" -d "{\"model\":\"gemini-3.8-flash-high\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}],\"stream\":true}"
```
