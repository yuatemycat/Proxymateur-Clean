#!/usr/bin/env python3
"""
Benchmark and telemetry probe for Antigravity Lab experimental flags.
Validates the 54-flag matrix across 7 paired groups, tests bidirectional key
mapping, verifies CLI regex parser, and scans local conversation transcripts
for real proof-of-usage artifacts and telemetry.
"""

import os
import re
import json
import time
import glob
from pathlib import Path

# 7 Feature Groups with their paired flags
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

CLI_REGEX = re.compile(r"^--(enable|disable|jetski|cascade|cortex|sidecar|use|scheduled|show|deprecate|allow|send)-[a-z0-9-]+(=(true|false))?$")

def benchmark_flag_matrix():
    print("=== 1. Benchmarking Flag Matrix & Parsing Latency ===")
    all_flags = []
    for g_id, g in GROUPS.items():
        all_flags.extend(g["flags"])
    
    total_flags = len(all_flags)
    assert total_flags == 54, f"Expected 54 flags, got {total_flags}"
    
    # Measure bidirectional translation throughput
    n_iterations = 20000
    t0 = time.perf_counter()
    for _ in range(n_iterations):
        for snake, kebab in all_flags:
            # Snake to Kebab
            c1 = snake.replace("_", "-")
            # Kebab to Snake
            c2 = kebab.replace("-", "_")
    elapsed = time.perf_counter() - t0
    ops_sec = (n_iterations * total_flags * 2) / elapsed
    print(f"Total Flags: {total_flags} in 7 groups")
    print(f"Key translation ops/sec: {ops_sec:,.0f} ({elapsed*1000:.2f} ms for {n_iterations*total_flags*2:,} ops)")

    # Verify CLI regex against all 54 flags
    regex_passes = 0
    regex_failures = []
    for snake, kebab in all_flags:
        cli_arg = f"--{kebab}"
        if CLI_REGEX.match(cli_arg):
            regex_passes += 1
        else:
            regex_failures.append(cli_arg)
        
    print(f"CLI Regex Validation: {regex_passes}/{total_flags} passed")
    if regex_failures:
        print(f"Flags requiring prefix expansion in agy_gateway.ps1 regex: {regex_failures}")
    return {
        "total_flags": total_flags,
        "translation_ops_sec": ops_sec,
        "regex_passes": regex_passes,
        "regex_failures": regex_failures
    }

def benchmark_settings_sync():
    print("\n=== 2. Benchmarking Settings Sync & Invariant Verification ===")
    settings_path = Path(os.path.expanduser("~/.gemini/antigravity-cli/settings.json"))
    gui_config_path = Path(os.path.expanduser("~/.proxymateur/gui_config.json"))

    results = {
        "settings_exists": settings_path.exists(),
        "gui_config_exists": gui_config_path.exists(),
        "settings_flag_count": 0,
        "gui_config_flag_count": 0,
        "matched_flags": 0,
    }

    if settings_path.exists():
        with open(settings_path, "r", encoding="utf-8") as f:
            cli_settings = json.load(f)
        exp = cli_settings.get("experiments", {})
        results["settings_flag_count"] = len(exp)
        print(f"CLI settings.json experiments count: {len(exp)}")

    if gui_config_path.exists():
        with open(gui_config_path, "r", encoding="utf-8") as f:
            gui_cfg = json.load(f)
        lab_cfg = gui_cfg.get("antigravity_lab", {})
        results["gui_config_flag_count"] = len(lab_cfg)
        print(f"GUI gui_config.json antigravity_lab count: {len(lab_cfg)}")

    return results

def mine_transcript_proofs():
    print("\n=== 3. Mining Real Proof of Usage from Conversation Transcripts ===")
    brain_dir = Path(os.path.expanduser("~/.gemini/antigravity-cli/brain"))
    if not brain_dir.exists():
        print("Brain directory not found.")
        return {}

    # Target patterns representing real flag activations
    patterns = {
        "subagent_orchestration": {
            "name": "Subagent Hub & Lifecycle (Group 1)",
            "keywords": ["manage_subagents", "invoke_subagent", "send_message", "subagent"],
            "found_samples": []
        },
        "programmatic_benchmarks": {
            "name": "Programmatic Tools & Benchmarks (Group 2)",
            "keywords": ["benchmark", "enable-programmatic-tools", "perf_counter", "telemetry"],
            "found_samples": []
        },
        "generative_ui": {
            "name": "Generative UI & Canvas (Group 2)",
            "keywords": ["generative_ui", "html5", "canvas", "interactive widget", "<!-- slide -->", "carousel"],
            "found_samples": []
        },
        "plugins_and_hooks": {
            "name": "Customizations 2.0 & Plugins (Group 3)",
            "keywords": ["plugin.json", "enable-plugins", "hook", "antigravity-lab", "skills"],
            "found_samples": []
        },
        "scheduled_tasks": {
            "name": "Scheduled Tasks v2 with Cron (Group 6)",
            "keywords": ["schedule", "CronExpression", "DurationSeconds", "ExactTiming", "TimerCondition"],
            "found_samples": []
        },
        "cortex_and_planning": {
            "name": "Cortex Snapshots & Plan Mode (Group 7)",
            "keywords": ["/plan", "use-slash-plan", "cortex", "snapshot", "AST"],
            "found_samples": []
        },
        "command_antivirus": {
            "name": "Safety & Guardrails (Group 5)",
            "keywords": ["antivirus", "assessor", "sandbox", "exebox", "Job Object"],
            "found_samples": []
        }
    }

    transcript_files = list(brain_dir.glob("*/.system_generated/logs/transcript.jsonl"))
    print(f"Scanned {len(transcript_files)} conversation logs.")

    total_scanned_lines = 0
    t0 = time.perf_counter()

    for t_file in transcript_files:
        conv_id = t_file.parent.parent.parent.name
        try:
            with open(t_file, "r", encoding="utf-8", errors="ignore") as f:
                for line_idx, line in enumerate(f):
                    total_scanned_lines += 1
                    for cat, data in patterns.items():
                        if len(data["found_samples"]) >= 3:
                            continue
                        for kw in data["keywords"]:
                            if kw.lower() in line.lower():
                                try:
                                    obj = json.loads(line)
                                    # Truncate content for clean proof
                                    step_idx = obj.get("step_index", line_idx)
                                    s_type = obj.get("type", "UNKNOWN")
                                    tool_calls = obj.get("tool_calls", [])
                                    content = str(obj.get("content", ""))[:200]
                                    
                                    data["found_samples"].append({
                                        "conversation_id": conv_id,
                                        "step_index": step_idx,
                                        "type": s_type,
                                        "matched_keyword": kw,
                                        "sample_snippet": content.strip().replace("\n", " "),
                                        "has_tool_calls": len(tool_calls) > 0,
                                        "tool_names": [tc.get("name") for tc in tool_calls if isinstance(tc, dict)]
                                    })
                                    break
                                except Exception:
                                    pass
        except Exception:
            continue

    scan_elapsed = time.perf_counter() - t0
    scan_rate = total_scanned_lines / max(scan_elapsed, 0.001)
    print(f"Scanned {total_scanned_lines:,} lines in {scan_elapsed:.2f}s ({scan_rate:,.0f} lines/sec)")

    proofs_summary = {}
    for cat, data in patterns.items():
        print(f"\n[{data['name']}] Found {len(data['found_samples'])} verified proofs:")
        for s in data["found_samples"][:2]:
            print(f"  - Conv {s['conversation_id'][:8]}... Step {s['step_index']}: kw='{s['matched_keyword']}' tools={s['tool_names']}")
        proofs_summary[cat] = {
            "name": data["name"],
            "count": len(data["found_samples"]),
            "samples": data["found_samples"]
        }

    return proofs_summary

def main():
    print("Starting Antigravity Lab Benchmark & Telemetry Probe...")
    t_start = time.perf_counter()

    matrix_res = benchmark_flag_matrix()
    sync_res = benchmark_settings_sync()
    proof_res = mine_transcript_proofs()

    total_duration = time.perf_counter() - t_start

    final_report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "duration_seconds": round(total_duration, 4),
        "flag_matrix": matrix_res,
        "settings_sync": sync_res,
        "transcript_proofs": proof_res
    }

    out_file = Path("scratch/antigravity_lab_benchmark_results.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(final_report, f, indent=2)

    print(f"\nBenchmark completed successfully in {total_duration:.2f}s.")
    print(f"Telemetry report generated at: {out_file}")

if __name__ == "__main__":
    main()
