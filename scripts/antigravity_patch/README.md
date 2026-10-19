# Antigravity 2.0 (v2.22.0) Patch & Diagnostic Tool Suite

This directory contains automated tools to diagnose, patch, and verify Antigravity 2.0 when the prompt model selector displays **`No models available`**, as well as repair corrupted streaming tool calls in SQLite conversation databases.

---

## 1. Problem Overview & Three-Layer Root Cause

When Antigravity 2.0 connects through local or custom enterprise gateways, the UI displays `Model` $\to$ **`No models available`**. This is caused by three compounding layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Layer 1: Go Backend Panic (defaults.go:372)                            │
│ Binary: language_server.exe                                            │
│ Root Cause: Hardcoded checkpoint model MODEL_PLACEHOLDER_M50 was       │
│             deprecated/removed. Defaults initialization crashes.       │
│ Fix: NOP out conditional panic jump at file offset 0x1863af8           │
│      (75 3b -> 90 90).                                                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Layer 2: Frontend Proto3 Model Parser (main.js -> Hj)                  │
│ Asset: Embedded ZIP in language_server.exe .data section               │
│ Root Cause: Hj accesses a.modelOrAlias.choice.case and                 │
│             Object.entries(a.supportedMimeTypes). Connect-RPC/REST     │
│             returns proto3 JSON {"modelOrAlias": {"model": "..."}}     │
│             without .choice. Throws TypeError on all 14 models.        │
│ Fix: Patch Hj at offset 1630027 (exact 454 bytes) to safely handle     │
│      REST models and default supportedMimeTypes to {}.                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Layer 3: Dropdown Popover Filter Mismatch (main.js -> tAb)             │
│ Asset: Embedded ZIP in language_server.exe .data section               │
│ Root Cause: tAb strictly filters for c.name.toLowerCase() ===          │
│             "recommended". Enterprise accounts receive category        │
│             "Enterprise Gateway Models". Filter returns empty options  │
│             array, causing FAb to render "No models available".        │
│ Fix: Patch tAb at offset 5375717 (exact 215 bytes) to defensively     │
│      fallback to (a || [])[0] and collect options via flatMap.         │
└────────────────────────────────────────────────────────────────────────┘
```

> [!CAUTION]
> **Never unpack or repack `app.asar`!**
> Repacking `app.asar` with `npx asar pack` strips native module configurations (`node-pty`, `better-sqlite3`), causing a blank black window. `app.asar` must remain pristine. All web assets are loaded dynamically from `language_server.exe`'s embedded ZIP archive.

---

## 2. Tools Included

| Script | Purpose |
| :--- | :--- |
| [`patch_antigravity.py`](file:///E:/02_Projects/Antigravity-Manager/scripts/antigravity_patch/patch_antigravity.py) | Automated 3-layer patcher for `language_server.exe` with backup, exact Deflate stream alignment, CRC32 header maintenance, and safe Windows atomic rename. |
| [`verify_patch.py`](file:///E:/02_Projects/Antigravity-Manager/scripts/antigravity_patch/verify_patch.py) | Verification harness for binary opcodes, embedded ZIP integrity, CRC32, and live HTTPS/CDP inspection. |
| [`repair_conversations.py`](file:///E:/02_Projects/Antigravity-Manager/scripts/antigravity_patch/repair_conversations.py) | Scans and repairs SQLite conversation databases stuck with Error 2 (`failed to unmarshal tool call arguments`). |

---

## 3. Version Notes

The patcher no longer uses fixed offsets, so it survives app updates. It finds the embedded
`main.js` by scanning ZIP local headers, finds the JS targets by regex (the minified names change
per build: `Hj`/`tAb` in 2.22.0, `Qj`/`LXb` in 2.23.0), and pads every replacement with a comment to
the exact original length.

| Version | Layer 1 (Go panic) | Layers 2 + 3 (`main.js`) |
| :--- | :--- | :--- |
| 2.22.x | Required (`75 3b` at `0x1863AF8`) | Required |
| 2.23.0 | Not needed: `utils.resolveCheckpointModel` falls back instead of returning the error, so the panic branch is unreachable for M50 (static analysis; the unpatched 2.23.0 language server starts fine) | Required (bug still present) |

Layer 1 is opt-in with `--layer1`. In 2.23.0 its signature resolves to `0x17E7B8E` (`75 34` -> `90 90`).
An app update replaces `language_server.exe`, so re-run the patcher after each update.

## 4. Usage Guide

### Step 1: Apply the Patch
Restart Antigravity afterwards. A running `language_server.exe` is locked, so the patcher renames it
to `.running_old` and writes the patched file in its place. A pristine backup is kept as
`language_server.exe.bak-<sha256 prefix>`.
```powershell
python scripts/antigravity_patch/patch_antigravity.py            # Layers 2 + 3
python scripts/antigravity_patch/patch_antigravity.py --layer1   # also Layer 1 (2.22.x)
python scripts/antigravity_patch/patch_antigravity.py --dry-run  # patch in memory and verify only
python scripts/antigravity_patch/patch_antigravity.py --out patched.exe   # write elsewhere
```
Optional custom path:
```powershell
python scripts/antigravity_patch/patch_antigravity.py --path "C:\Custom\Path\language_server.exe"
```

### Step 2: Verify the Patch
Run the verification harness:
```powershell
python scripts/antigravity_patch/verify_patch.py
```

### Step 3: Launch Antigravity
Launch Antigravity normally via desktop shortcut or WMI:
```powershell
Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '"C:\Users\X\AppData\Local\Programs\antigravity\Antigravity.exe"' }
```

### Step 4: Repair Stuck Conversations (If Needed)
If a conversation crashes on resume with `unexpected end of JSON input`:
```powershell
python scripts/antigravity_patch/repair_conversations.py
```
