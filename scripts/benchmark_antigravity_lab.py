#!/usr/bin/env python3
"""
Comprehensive Benchmark & Forensic Verification Suite for Antigravity Lab (54 Flags).

Validates the 54 reverse-engineered flags across 7 paired functional clusters:
1. Layer 1 (Binary ABI & PE Forensics): Verifies exact raw file offsets of all 54 flags
   inside agy.exe, plus the 12 native 104B/144B slash command structs (@ 0xbe58cf8) and
   the 11 patched 56B GenericCommand structs in the .proxcv section (code VA 0x14e574000,
   data table VA 0x14e574400..0x14e574630).
2. Layer 2 (CLI Gateway & Settings Sync): Benchmarks bidirectional snake_case <-> kebab-case
   key translation throughput, validates all 54 flags against the Sync-CliExperimentFlags
   regex in scripts/agy_gateway.ps1, and verifies live persistence parity between
   ~/.gemini/antigravity-cli/settings.json and ~/.proxymateur/gui_config.json.
3. Layer 3 (Empirical Transcript Telemetry & Workflow Comparison): Parses all local
   conversation transcripts (matching transcript_full.jsonl by step_index with graceful
   fallback to transcript.jsonl) to measure real tool invocations, subagent model
   inheritance & TypeNames across both batch and single-subagent calls, and turn-windowed
   head-to-head metrics comparing Antigravity Lab workflows (/swarm, /owl, /battle,
   /benchmark, /compact, /generative_ui) against native CLI commands (/boost,
   /teamwork-preview, /teamwork, /plan, /goal, /learn, /btw).
"""

import json
import os
import re
import struct
import time
from collections import defaultdict
from pathlib import Path

# 7 Feature Groups with their 54 paired flags (27 functional pairs)
GROUPS = {
    "group_1_multi_agent_swarm": {
        "title": "Group 1: Multi-Agent & Swarm Orchestration",
        "flags": [
            ("jetski_autonomous_mode", "jetski-autonomous-mode"),
            ("disable_teamwork_forced_flash_model", "disable-teamwork-forced-flash-model"),
            ("enable_subagent_hub", "enable-subagent-hub"),
            ("enable_swarm_monitor", "enable-swarm-monitor"),
            ("enable_fork_with_subagents", "enable-fork-with-subagents"),
            ("send_subagent_initial_prompt_as_message", "send-subagent-initial-prompt-as-message"),
            ("enable_swarm_narrator", "enable-swarm-narrator"),
            ("enable_image_generator_subagent", "enable-image-generator-subagent"),
        ]
    },
    "group_2_deep_exploration_arena": {
        "title": "Group 2: Deep Exploration & Adversarial Arena (Slash Commands)",
        "flags": [
            ("enable_owl_slash_command", "enable-owl-slash-command"),
            ("enable_compact_slash_command", "enable-compact-slash-command"),
            ("enable_battle_mode", "enable-battle-mode"),
            ("enable_battle_mode_custom_agents", "enable-battle-mode-custom-agents"),
            ("enable_programmatic_tools", "enable-programmatic-tools"),
            ("jetski_generative_ui", "jetski-generative-ui"),
            ("enable_deepagent", "enable-deepagent"),
            ("enable_review", "enable-review"),
        ]
    },
    "group_3_customizations_plugins": {
        "title": "Group 3: Customizations 2.0 & Plugin Ecosystem",
        "flags": [
            ("enable_plugins", "enable-plugins"),
            ("enable_hook_status", "enable-hook-status"),
            ("enable_customization_kind_agent", "enable-customization-kind-agent"),
            ("enable_customization_kind_skill", "enable-customization-kind-skill"),
            ("enable_customization_kind_rule", "enable-customization-kind-rule"),
            ("enable_customization_kind_mcp", "enable-customization-kind-mcp"),
            ("enable_customization_kind_hooks", "enable-customization-kind-hooks"),
            ("deprecate_workflows", "deprecate-workflows"),
        ]
    },
    "group_4_sidecars_runtime": {
        "title": "Group 4: Sidecar Micro-Frontend & UI Runtime",
        "flags": [
            ("enable_sidecars", "enable-sidecars"),
            ("enable_ui_sidecars", "enable-ui-sidecars"),
            ("enable_sidecar_sdk", "enable-sidecar-sdk"),
            ("jetski_sidecar_declared_permissions", "jetski-sidecar-declared-permissions"),
            ("sidecar_gateway", "sidecar-gateway"),
            ("sidecar_iframe_prewarm", "sidecar-iframe-prewarm"),
        ]
    },
    "group_5_deepmind_safety_guardrails": {
        "title": "Group 5: DeepMind AGI Control & Security Guardrails",
        "flags": [
            ("enable_command_assessor", "enable-command-assessor"),
            ("enable_command_antivirus", "enable-command-antivirus"),
            ("allow_experimental_monitors", "allow-experimental-monitors"),
            ("enable_citc_workspace_hygiene_rule", "enable-citc-workspace-hygiene-rule"),
            ("disable_stained_loas2_creds", "disable-stained-loas2-creds"),
            ("enable_browser_subagent_v2", "enable-browser-subagent-v2"),
        ]
    },
    "group_6_terminal_resilience": {
        "title": "Group 6: Terminal Engine & Execution Resilience",
        "flags": [
            ("enable_persistent_terminals", "enable-persistent-terminals"),
            ("enable_pty", "enable-pty"),
            ("enable_ripgrep_path_search", "enable-ripgrep-path-search"),
            ("enable_wait_tool", "enable-wait-tool"),
            ("scheduled_tasks_v2", "scheduled-tasks-v2"),
            ("enable_model_capacity_exhausted_retries", "enable-model-capacity-exhausted-retries"),
            ("enable_mcp_non_blocking_turn_load", "enable-mcp-non-blocking-turn-load"),
            ("enable_remote_agent_fastpush_pin", "enable-remote-agent-fastpush-pin"),
        ]
    },
    "group_7_cortex_planning_trajectory": {
        "title": "Group 7: Cortex State, Direct Planning & Trajectory Engine",
        "flags": [
            ("cortex_snapshot_recording", "cortex-snapshot-recording"),
            ("cortex_snapshot_revert", "cortex-snapshot-revert"),
            ("enable_conversation_search_v2", "enable-conversation-search-v2"),
            ("show_model_selection_change", "show-model-selection-change"),
            ("use_component_rewrite", "use-component-rewrite"),
            ("use_core_direct", "use-core-direct"),
            ("use_slash_plan", "use-slash-plan"),
            ("enable_voice_activity_events", "enable-voice-activity-events"),
            ("cascade_enable_notebook_edit_tool", "cascade-enable-notebook-edit-tool"),
            ("cascade_use_sed_edit_tool", "cascade-use-sed-edit-tool"),
        ]
    }
}

CLI_REGEX = re.compile(
    r"^--(enable|disable|jetski|cascade|cortex|sidecar|use|scheduled|show|deprecate|allow|send)-[a-z0-9-]+(=(true|false))?$"
)

TARGET_RICH_TOOLS = {
    "invoke_subagent",
    "manage_subagents",
    "define_subagent",
    "send_message",
    "schedule",
    "generate_image",
    "call_mcp_tool",
    "ask_permission",
    "ask_question",
}

# Strict boundary: slash command must be followed by whitespace, end-of-string, or punctuation (never '-')
CMD_REGEX = re.compile(
    r"(?:^|[\s\"'`(])(/(?:swarm|owl|battle|benchmark|compact|generative_ui|teamwork-previews|teamwork-preview|teamwork|boost|plan|goal|grill-me|deepagent|review-agent|btw|queue|plugin|hooks|diff|effort|learn))(?=$|[\s\"'`),.!?;:])",
    re.IGNORECASE,
)
USER_REQ_REGEX = re.compile(r"<USER_REQUEST>(.*?)</USER_REQUEST>", re.DOTALL)
SLASH_META_REGEX = re.compile(r"(/(?:[a-z0-9_-]+))\s+is a \[(Slash Command|Skill)\]", re.IGNORECASE)

NATIVE_CMD_TABLE_RAW = 0xBE58CF8
NATIVE_CMD_STRIDE = 0x68
NATIVE_CMD_COUNT = 12
PROXCV_CMD_COUNT = 11
PROXCV_ENTRY_SIZE = 56
PROXCV_DATA_OFFSET = 0x400


def _parse_pe_sections(data: bytes):
    if len(data) < 0x100 or data[:2] != b"MZ":
        return 0, []
    e_lfanew = struct.unpack_from("<I", data, 0x3C)[0]
    if e_lfanew + 24 > len(data) or data[e_lfanew:e_lfanew + 4] != b"PE\0\0":
        return 0, []
    num_sections = struct.unpack_from("<H", data, e_lfanew + 6)[0]
    opt_hdr_size = struct.unpack_from("<H", data, e_lfanew + 20)[0]
    opt_hdr_offset = e_lfanew + 24
    image_base = struct.unpack_from("<Q", data, opt_hdr_offset + 24)[0]
    sec_tbl_offset = opt_hdr_offset + opt_hdr_size

    sections = []
    for i in range(num_sections):
        sec = data[sec_tbl_offset + i * 40 : sec_tbl_offset + (i + 1) * 40]
        name = sec[:8].rstrip(b"\x00").decode("latin-1", errors="ignore")
        vsize, vaddr, raw_size, raw_ptr = struct.unpack_from("<IIII", sec, 8)
        sections.append({
            "name": name,
            "va": image_base + vaddr,
            "vsize": vsize,
            "raw_ptr": raw_ptr,
            "raw_size": raw_size,
        })
    return image_base, sections


def benchmark_binary_forensics():
    print("=== 1. Layer 1: Binary ABI & PE Offset Verification (agy.exe) ===")
    agy_path = Path(os.path.expanduser("~/AppData/Local/agy/bin/agy.exe"))
    if not agy_path.exists():
        print(f"agy.exe not found at {agy_path}")
        return {"binary_exists": False}

    t0 = time.perf_counter()
    data = agy_path.read_bytes()
    image_base, sections = _parse_pe_sections(data)

    def va_to_raw(va: int):
        for s in sections:
            if s["va"] <= va < s["va"] + s["vsize"]:
                return s["raw_ptr"] + (va - s["va"])
        return None

    def read_go_str(va: int, length: int) -> str:
        if not va or length <= 0 or length > 8192:
            return ""
        r = va_to_raw(va)
        if r is None or r + length > len(data):
            return ""
        return data[r : r + length].decode("utf-8", errors="replace")

    flag_offsets = {}
    found_count = 0
    flags_not_found = []

    for g_id, g in GROUPS.items():
        for snake, kebab in g["flags"]:
            # Only the exact kebab-case experiment key counts. The snake_case form is
            # recorded for information but is NOT a match: e.g. enable_voice_activity_events
            # appears in Google Cloud Speech protobuf definitions, not as an agy experiment key.
            off_kebab = data.find(kebab.encode("utf-8"))
            off_snake = data.find(snake.encode("utf-8"))
            if off_kebab != -1:
                found_count += 1
            else:
                flags_not_found.append(kebab)
            flag_offsets[snake] = {
                "kebab": kebab,
                "group": g_id,
                "agy_offset": f"0x{off_kebab:x}" if off_kebab != -1 else None,
                "matched_form": "kebab" if off_kebab != -1 else None,
                "raw_kebab": f"0x{off_kebab:x}" if off_kebab != -1 else None,
                "raw_snake": f"0x{off_snake:x}" if off_snake != -1 else None,
            }

    # Verify the 12 native 104-byte slash command descriptors at 0xbe58cf8
    native_commands = []
    if NATIVE_CMD_TABLE_RAW + NATIVE_CMD_COUNT * NATIVE_CMD_STRIDE <= len(data):
        for i in range(NATIVE_CMD_COUNT):
            off = NATIVE_CMD_TABLE_RAW + i * NATIVE_CMD_STRIDE
            s_ptr, s_len, d_ptr, d_len = struct.unpack_from("<QQQQ", data, off)
            name = read_go_str(s_ptr, s_len)
            desc = read_go_str(d_ptr, d_len)
            if name:
                native_commands.append({
                    "index": i,
                    "raw_offset": f"0x{off:x}",
                    "name": name,
                    "description": desc,
                })

    # Verify the 11 patched 56-byte GenericCommand structs in .proxcv
    proxcv_sec = next((s for s in sections if s["name"] == ".proxcv"), None)
    proxcv_commands = []
    if proxcv_sec is not None:
        data_raw = proxcv_sec["raw_ptr"] + PROXCV_DATA_OFFSET
        data_va = proxcv_sec["va"] + PROXCV_DATA_OFFSET
        meta_raw = data_raw + PROXCV_CMD_COUNT * PROXCV_ENTRY_SIZE
        str_raw = (meta_raw + PROXCV_CMD_COUNT * 8 + 15) & ~15
        if str_raw < len(data):
            for i in range(PROXCV_CMD_COUNT):
                noff, nlen, doff, dlen = struct.unpack_from("<HHHH", data, meta_raw + i * 8)
                name = data[str_raw + noff : str_raw + noff + nlen].decode("utf-8", errors="replace")
                desc = data[str_raw + doff : str_raw + doff + dlen].decode("utf-8", errors="replace")
                proxcv_commands.append({
                    "index": i,
                    "slot_va": f"0x{data_va + i * PROXCV_ENTRY_SIZE:x}",
                    "slot_raw": f"0x{data_raw + i * PROXCV_ENTRY_SIZE:x}",
                    "name": name,
                    "description": desc,
                })

    proxcv_off = data.find(b"PROX_CMD_V1")
    elapsed = time.perf_counter() - t0
    print(f"Scanned agy.exe ({len(data):,} bytes, ImageBase=0x{image_base:x}) in {elapsed:.2f}s")
    print(f"Flag names found as exact strings in the binary: {found_count}/54 (not found: {', '.join(flags_not_found) or 'none'})")
    print("(String presence only; it does not show what a flag does.)")
    print(f"Native slash command entries read (@ 0x{NATIVE_CMD_TABLE_RAW:x}): {len(native_commands)}/{NATIVE_CMD_COUNT}")
    print(f"Injected .proxcv GenericCommand entries read (@ 0x14e574400): {len(proxcv_commands)}/{PROXCV_CMD_COUNT}")
    print(f"Patched .proxcv Command Cave Marker (PROX_CMD_V1): {'0x' + format(proxcv_off, 'x') if proxcv_off != -1 else 'NOT FOUND'}")

    return {
        "binary_exists": True,
        "binary_size_bytes": len(data),
        "image_base": f"0x{image_base:x}",
        "flags_found_as_strings": found_count,
        "flags_not_found": flags_not_found,
        "native_commands_read": len(native_commands),
        "native_commands": native_commands,
        "proxcv_commands_read": len(proxcv_commands),
        "proxcv_code_va": f"0x{proxcv_sec['va']:x}" if proxcv_sec else None,
        "proxcv_code_raw": f"0x{proxcv_sec['raw_ptr']:x}" if proxcv_sec else None,
        "proxcv_data_va": f"0x{proxcv_sec['va'] + PROXCV_DATA_OFFSET:x}" if proxcv_sec else None,
        "proxcv_data_raw": f"0x{proxcv_sec['raw_ptr'] + PROXCV_DATA_OFFSET:x}" if proxcv_sec else None,
        "proxcv_commands": proxcv_commands,
        "proxcv_marker_offset": f"0x{proxcv_off:x}" if proxcv_off != -1 else None,
        "scan_seconds": round(elapsed, 4),
        "flag_offsets": flag_offsets,
    }


def benchmark_flag_matrix_and_sync():
    print("\n=== 2. Layer 2: CLI Gateway Regex & Persistent Settings Sync ===")
    all_flags = []
    for g_id, g in GROUPS.items():
        all_flags.extend(g["flags"])

    total_flags = len(all_flags)
    assert total_flags == 54, f"Expected 54 flags, got {total_flags}"

    n_iterations = 20000
    t0 = time.perf_counter()
    for _ in range(n_iterations):
        for snake, kebab in all_flags:
            _ = snake.replace("_", "-")
            _ = kebab.replace("-", "_")
    elapsed = time.perf_counter() - t0
    ops_sec = (n_iterations * total_flags * 2) / max(elapsed, 1e-9)

    regex_passes = 0
    regex_failures = []
    for snake, kebab in all_flags:
        cli_arg = f"--{kebab}=true"
        if CLI_REGEX.match(cli_arg):
            regex_passes += 1
        else:
            regex_failures.append(cli_arg)

    settings_path = Path(os.path.expanduser("~/.gemini/antigravity-cli/settings.json"))
    gui_config_path = Path(os.path.expanduser("~/.proxymateur/gui_config.json"))

    cli_exp = {}
    gui_lab = {}
    if settings_path.exists():
        cli_exp = json.loads(settings_path.read_text(encoding="utf-8")).get("experiments", {})
    if gui_config_path.exists():
        gui_lab = json.loads(gui_config_path.read_text(encoding="utf-8")).get("antigravity_lab", {})

    active_in_settings = 0
    active_in_gui = 0
    synced_pairs = 0
    for snake, kebab in all_flags:
        in_cli = (kebab in cli_exp and bool(cli_exp[kebab])) or (snake in cli_exp and bool(cli_exp[snake]))
        in_gui = (snake in gui_lab and bool(gui_lab[snake])) or (kebab in gui_lab and bool(gui_lab[kebab]))
        if in_cli:
            active_in_settings += 1
        if in_gui:
            active_in_gui += 1
        if in_cli and in_gui:
            synced_pairs += 1

    print(f"Total Flags: {total_flags} across 7 paired clusters")
    print(f"Key translation throughput: {ops_sec:,.0f} ops/sec ({elapsed*1000:.2f} ms)")
    print(f"CLI Gateway Regex (Sync-CliExperimentFlags): {regex_passes}/{total_flags} passed")
    print(f"settings.json active flags: {active_in_settings}/{total_flags} (total keys: {len(cli_exp)})")
    print(f"gui_config.json active flags: {active_in_gui}/{total_flags} (synced pairs: {synced_pairs}/{total_flags})")

    return {
        "total_flags": total_flags,
        "translation_ops_sec": round(ops_sec),
        "regex_passes": regex_passes,
        "regex_failures": regex_failures,
        "settings_active_flags": active_in_settings,
        "gui_active_flags": active_in_gui,
        "synced_flag_count": synced_pairs,
    }


def _extract_turn_commands(content: str):
    """
    Extract canonical slash commands invoked in a single USER_INPUT turn without
    double-counting when agy.exe echoes '/cmd is a [Slash Command|Skill]' in <ADDITIONAL_METADATA>.
    """
    m_req = USER_REQ_REGEX.search(content)
    req_text = (m_req.group(1) if m_req else content).strip()

    meta_cmds = set()
    for m_meta, _kind in SLASH_META_REGEX.findall(content):
        c = m_meta.lower()
        if c in ("/teamwork-preview", "/teamwork-previews"):
            c = "/teamwork-preview"
        if CMD_REGEX.match(c):
            meta_cmds.add(c)

    req_cmds = set()
    for m in CMD_REGEX.findall(req_text):
        c = m.lower()
        if c in ("/teamwork-preview", "/teamwork-previews"):
            c = "/teamwork-preview"
        req_cmds.add(c)

    if "initiate battle mode:" in req_text.lower():
        req_cmds.add("/battle")

    return req_cmds | meta_cmds


def benchmark_transcripts_and_workflows():
    print("\n=== 3. Layer 3: Real Transcript Telemetry & Native vs. Lab Workflow Comparison ===")
    brain_dir = Path(os.path.expanduser("~/.gemini/antigravity-cli/brain"))
    if not brain_dir.exists():
        print("Brain directory not found.")
        return {}

    transcript_files = sorted(brain_dir.glob("*/.system_generated/logs/transcript.jsonl"))
    total_lines = 0
    total_tool_calls = defaultdict(int)
    cmd_stats = defaultdict(lambda: {
        "invocations": 0,
        "sessions": set(),
        "window_steps": 0,
        "window_tool_calls": 0,
        "session_steps": 0,
        "session_tool_calls": 0,
        "invoke_subagent_calls": 0,
        "spawned_subagents": 0,
        "manage_subagents_calls": 0,
        "define_subagent_calls": 0,
        "send_message_calls": 0,
        "ask_question_calls": 0,
        "ask_question_invocations": 0,
        "schedule_calls": 0,
        "run_command_calls": 0,
        "subagent_models": defaultdict(int),
        "subagent_typenames": defaultdict(int),
    })

    total_invoke_calls = 0
    total_spawned_subagents = 0
    global_subagent_models = defaultdict(int)
    global_subagent_typenames = defaultdict(int)
    mcp_tool_counts = defaultdict(int)
    authentic_proofs = defaultdict(list)

    t0 = time.perf_counter()

    for tf in transcript_files:
        conv_id = tf.parent.parent.parent.name
        full_tf = tf.parent / "transcript_full.jsonl"
        try:
            short_lines = tf.read_text(encoding="utf-8", errors="ignore").splitlines()
        except Exception:
            continue

        total_lines += len(short_lines)

        # Parse short transcript and identify step_index values needing untruncated args
        parsed_steps = []
        rich_step_indices = set()
        for idx, line in enumerate(short_lines):
            try:
                obj = json.loads(line)
            except Exception:
                continue
            step_idx = obj.get("step_index", idx)
            parsed_steps.append((step_idx, obj))
            if obj.get("type") == "PLANNER_RESPONSE":
                for tc in obj.get("tool_calls", []):
                    if isinstance(tc, dict) and tc.get("name", "") in TARGET_RICH_TOOLS:
                        rich_step_indices.add(step_idx)

        # Resolve untruncated tool_calls from transcript_full.jsonl keyed by step_index
        full_step_map = {}
        if rich_step_indices and full_tf.exists():
            try:
                with open(full_tf, "r", encoding="utf-8", errors="ignore") as ff:
                    for idx, fline in enumerate(ff):
                        try:
                            fobj = json.loads(fline)
                        except Exception:
                            continue
                        f_step = fobj.get("step_index", idx)
                        if f_step in rich_step_indices and fobj.get("type") == "PLANNER_RESPONSE":
                            full_step_map[f_step] = fobj
            except Exception:
                pass

        # Detect native /boost DeepCoderCoordinator pipeline sessions (which receive initial prompt via SYSTEM_MESSAGE)
        is_boost_coord = any(
            "DeepCoderWorkerL0" in l or "You are a pipeline coordinator" in l
            for l in short_lines[:5]
        )
        active_cmds = set()
        if is_boost_coord:
            active_cmds = {"/boost"}
            cmd_stats["/boost"]["invocations"] += 1
            cmd_stats["/boost"]["sessions"].add(conv_id)

        session_cmds = set(active_cmds)
        session_tool_total = 0
        window_had_ask_q = set()

        for step_idx, obj in parsed_steps:
            t_type = obj.get("type", "")
            if t_type == "USER_INPUT":
                content = str(obj.get("content", ""))
                turn_cmds = _extract_turn_commands(content)
                if turn_cmds:
                    active_cmds = turn_cmds
                    window_had_ask_q = set()
                    for cmd in turn_cmds:
                        cmd_stats[cmd]["invocations"] += 1
                        cmd_stats[cmd]["sessions"].add(conv_id)
                        session_cmds.add(cmd)

            for cmd in active_cmds:
                cmd_stats[cmd]["window_steps"] += 1

            if t_type == "PLANNER_RESPONSE":
                rich_obj = full_step_map.get(step_idx, obj)
                for tc in rich_obj.get("tool_calls", []):
                    if not isinstance(tc, dict):
                        continue
                    t_name = tc.get("name", "")
                    if not t_name:
                        continue
                    total_tool_calls[t_name] += 1
                    session_tool_total += 1
                    args = tc.get("args") or tc.get("arguments") or {}
                    if not isinstance(args, dict):
                        args = {}

                    spawned_here = 0
                    models_here = defaultdict(int)
                    types_here = defaultdict(int)

                    if t_name == "invoke_subagent":
                        total_invoke_calls += 1
                        subs = args.get("Subagents", [])
                        if isinstance(subs, list) and subs:
                            for s in subs:
                                if isinstance(s, dict):
                                    total_spawned_subagents += 1
                                    spawned_here += 1
                                    m = str(s.get("Model", "inherit")).strip() or "inherit"
                                    tn = str(s.get("TypeName", "self")).strip() or "self"
                                    global_subagent_models[m] += 1
                                    global_subagent_typenames[tn] += 1
                                    models_here[m] += 1
                                    types_here[tn] += 1
                        else:
                            total_spawned_subagents += 1
                            spawned_here += 1
                            m = str(args.get("Model", "inherit")).strip() or "inherit"
                            tn = str(args.get("TypeName", "self")).strip() or "self"
                            global_subagent_models[m] += 1
                            global_subagent_typenames[tn] += 1
                            models_here[m] += 1
                            types_here[tn] += 1

                        if len(authentic_proofs["invoke_subagent"]) < 5:
                            authentic_proofs["invoke_subagent"].append({
                                "conv_id": conv_id,
                                "step_index": step_idx,
                                "subagent_count": spawned_here,
                                "roles": (
                                    [s.get("Role") for s in subs if isinstance(s, dict)]
                                    if isinstance(subs, list) and subs
                                    else [args.get("Role")]
                                ),
                                "models": dict(models_here),
                                "typenames": dict(types_here),
                            })

                    elif t_name == "call_mcp_tool":
                        srv = str(args.get("ServerName", "unknown"))
                        tool_n = str(args.get("ToolName", "unknown"))
                        mcp_tool_counts[f"{srv}/{tool_n}"] += 1

                    elif t_name == "define_subagent":
                        if len(authentic_proofs["define_subagent"]) < 5:
                            authentic_proofs["define_subagent"].append({
                                "conv_id": conv_id,
                                "step_index": step_idx,
                                "name": args.get("Name") or args.get("name"),
                                "enable_mcp": args.get("EnableMCPTools", args.get("enable_mcp_tools")),
                            })

                    elif t_name == "schedule":
                        if len(authentic_proofs["schedule"]) < 5:
                            authentic_proofs["schedule"].append({
                                "conv_id": conv_id,
                                "step_index": step_idx,
                                "duration": args.get("DurationSeconds"),
                                "condition": args.get("TimerCondition"),
                            })

                    for cmd in active_cmds:
                        cs = cmd_stats[cmd]
                        cs["window_tool_calls"] += 1
                        if t_name == "invoke_subagent":
                            cs["invoke_subagent_calls"] += 1
                            cs["spawned_subagents"] += spawned_here
                            for m, cnt in models_here.items():
                                cs["subagent_models"][m] += cnt
                            for tn, cnt in types_here.items():
                                cs["subagent_typenames"][tn] += cnt
                        elif t_name == "manage_subagents":
                            cs["manage_subagents_calls"] += 1
                        elif t_name == "define_subagent":
                            cs["define_subagent_calls"] += 1
                        elif t_name == "send_message":
                            cs["send_message_calls"] += 1
                        elif t_name == "ask_question":
                            cs["ask_question_calls"] += 1
                            if cmd not in window_had_ask_q:
                                cs["ask_question_invocations"] += 1
                                window_had_ask_q.add(cmd)
                        elif t_name == "schedule":
                            cs["schedule_calls"] += 1
                        elif t_name == "run_command":
                            cs["run_command_calls"] += 1

        for cmd in session_cmds:
            cmd_stats[cmd]["session_steps"] += len(short_lines)
            cmd_stats[cmd]["session_tool_calls"] += session_tool_total

    elapsed = time.perf_counter() - t0
    lines_sec = total_lines / max(elapsed, 1e-9)

    print(f"Scanned {len(transcript_files)} transcripts ({total_lines:,} lines) in {elapsed:.2f}s ({lines_sec:,.0f} lines/sec)")
    print(f"Subagent Spawns: {total_invoke_calls} invoke_subagent calls -> {total_spawned_subagents} spawned subagents")
    print(f"Subagent Model Inheritance: {dict(global_subagent_models)} (sum={sum(global_subagent_models.values())})")
    print(f"Subagent TypeNames: {dict(global_subagent_typenames)} (sum={sum(global_subagent_typenames.values())})")

    workflow_table = {}
    print("\n--- Head-to-Head Workflow Telemetry (Turn-Windowed & Deduplicated) ---")
    header = (
        f"{'Command':18s} | {'Inv':>4s} | {'Sess':>4s} | {'WinSteps':>8s} | {'WinTools':>8s} | "
        f"{'SubCalls':>8s} | {'Spawned':>7s} | {'ManageSub':>9s} | {'DefSub':>6s} | {'AskQ':>4s}"
    )
    print(header)
    print("-" * len(header))
    for cmd in sorted(cmd_stats.keys(), key=lambda k: -cmd_stats[k]["invocations"]):
        c = cmd_stats[cmd]
        n_inv = max(c["invocations"], 1)
        n_sess = max(len(c["sessions"]), 1)
        row = {
            "invocations": c["invocations"],
            "unique_sessions": len(c["sessions"]),
            "window_steps": c["window_steps"],
            "avg_steps_per_invocation": round(c["window_steps"] / n_inv, 1),
            "window_tool_calls": c["window_tool_calls"],
            "avg_tools_per_invocation": round(c["window_tool_calls"] / n_inv, 1),
            "session_steps": c["session_steps"],
            "avg_steps_per_session": round(c["session_steps"] / n_sess, 1),
            "session_tool_calls": c["session_tool_calls"],
            "avg_tools_per_session": round(c["session_tool_calls"] / n_sess, 1),
            "invoke_subagent_calls": c["invoke_subagent_calls"],
            "spawned_subagents": c["spawned_subagents"],
            "manage_subagents_calls": c["manage_subagents_calls"],
            "define_subagent_calls": c["define_subagent_calls"],
            "send_message_calls": c["send_message_calls"],
            "ask_question_calls": c["ask_question_calls"],
            "ask_question_invocations": c["ask_question_invocations"],
            "ask_question_rate_pct": round(100.0 * c["ask_question_invocations"] / n_inv, 1),
            "schedule_calls": c["schedule_calls"],
            "subagent_models": dict(c["subagent_models"]),
            "subagent_typenames": dict(c["subagent_typenames"]),
        }
        workflow_table[cmd] = row
        print(
            f"{cmd:18s} | {row['invocations']:4d} | {row['unique_sessions']:4d} | "
            f"{row['avg_steps_per_invocation']:8.1f} | {row['avg_tools_per_invocation']:8.1f} | "
            f"{row['invoke_subagent_calls']:8d} | {row['spawned_subagents']:7d} | "
            f"{row['manage_subagents_calls']:9d} | {row['define_subagent_calls']:6d} | "
            f"{row['ask_question_calls']:4d}"
        )

    return {
        "conversations_scanned": len(transcript_files),
        "lines_scanned": total_lines,
        "scan_seconds": round(elapsed, 4),
        "scan_lines_per_sec": round(lines_sec),
        "total_invoke_subagent_calls": total_invoke_calls,
        "total_spawned_subagents": total_spawned_subagents,
        "subagent_models": dict(global_subagent_models),
        "subagent_typenames": dict(global_subagent_typenames),
        "tool_call_totals": dict(sorted(total_tool_calls.items(), key=lambda x: -x[1])),
        "top_mcp_tools": dict(sorted(mcp_tool_counts.items(), key=lambda x: -x[1])[:15]),
        "workflow_comparison": workflow_table,
        "authentic_proofs": dict(authentic_proofs),
    }


def main():
    print("Starting Antigravity Lab 54-Flag Forensic Benchmark & Telemetry Suite...")
    t_start = time.perf_counter()

    binary_res = benchmark_binary_forensics()
    matrix_res = benchmark_flag_matrix_and_sync()
    transcript_res = benchmark_transcripts_and_workflows()

    total_duration = time.perf_counter() - t_start

    final_report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "duration_seconds": round(total_duration, 4),
        "binary_forensics": binary_res,
        "flag_matrix_and_sync": matrix_res,
        "transcript_telemetry": transcript_res,
    }

    # Save to both docs/telemetry and scratch
    for out_dir in [Path("docs/telemetry"), Path("scratch")]:
        out_dir.mkdir(parents=True, exist_ok=True)
        out_file = out_dir / "antigravity_lab_benchmark_results.json"
        out_file.write_text(json.dumps(final_report, indent=2), encoding="utf-8")
        print(f"Full telemetry report written to: {out_file}")

    print(f"\nBenchmark completed in {total_duration:.2f}s.")


if __name__ == "__main__":
    main()
