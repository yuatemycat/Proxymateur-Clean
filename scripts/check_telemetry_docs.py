#!/usr/bin/env python3
"""Sanity checks for the Antigravity Lab docs and telemetry files.

Checks that:
  * the transcript samples and the benchmark results have the expected shape,
  * the samples carry no flag/cluster labels (those were name-based, not observed),
  * the numbers quoted in docs/ANTIGRAVITY_LAB.md match the stored results,
  * no private paths, project names or tokens leaked into the public docs.

Run from anywhere: python scripts/check_telemetry_docs.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SAMPLES = ROOT / "docs" / "telemetry" / "transcript_samples.jsonl"
RESULTS = ROOT / "docs" / "telemetry" / "antigravity_lab_benchmark_results.json"
PUBLIC_TEXT = [ROOT / "README.md", ROOT / "docs" / "ANTIGRAVITY_LAB.md", SAMPLES, RESULTS]

problems = []

def check(cond, msg):
    if not cond:
        problems.append(msg)

for p in PUBLIC_TEXT:
    check(p.exists(), f"missing file: {p.relative_to(ROOT)}")
if problems:
    print("\n".join(problems))
    sys.exit(1)

# ---- samples ---------------------------------------------------------------
lines = [l for l in SAMPLES.read_text(encoding="utf-8").splitlines() if l.strip()]
check(len(lines) == 28, f"expected 28 sample records, found {len(lines)}")
for i, line in enumerate(lines, 1):
    obj = json.loads(line)
    for k in ("conversation_id", "step_index", "type"):
        check(k in obj, f"sample {i}: missing '{k}'")
    for k in ("flags_demonstrated", "group"):
        check(k not in obj, f"sample {i}: has name-based label '{k}'")

# ---- results ---------------------------------------------------------------
res = json.loads(RESULTS.read_text(encoding="utf-8"))
for k in ("binary_forensics", "flag_matrix_and_sync", "transcript_telemetry"):
    check(k in res, f"results: missing '{k}'")
bf, tt = res["binary_forensics"], res["transcript_telemetry"]
check(bf.get("flags_found_as_strings") == 53, f"results: flags_found_as_strings is {bf.get('flags_found_as_strings')}, expected 53")
check(bf.get("flags_not_found") == ["enable-voice-activity-events"], f"results: unexpected flags_not_found {bf.get('flags_not_found')}")
check("verified_flags_in_binary" not in bf, "results: old key 'verified_flags_in_binary' is back")

# ---- doc numbers match the stored results ----------------------------------
doc = (ROOT / "docs" / "ANTIGRAVITY_LAB.md").read_text(encoding="utf-8")
check(f"{tt['conversations_scanned']} conversation transcripts ({tt['lines_scanned']:,} lines)" in doc,
      "docs/ANTIGRAVITY_LAB.md: transcript counts differ from the stored results")
check(f"`invoke_subagent` was called {tt['total_invoke_subagent_calls']} times" in doc,
      "docs/ANTIGRAVITY_LAB.md: invoke_subagent count differs from the stored results")

# ---- leaks -------------------------------------------------------------------
text = "\n".join(p.read_text(encoding="utf-8") for p in PUBLIC_TEXT)
patterns = {
    "user path": r"[A-Za-z]:[/\\]+Users[/\\]+[A-Za-z0-9_.-]+",
    "workspace path": r"[A-Za-z]:[/\\]+(?:02_Projects|03_Devops)[/\\]+[A-Za-z0-9_.-]+",
    "private project term": r"\b(?:Intra-farm|Optimumu|promon|Superghidra|ReverseTools|Wherearugon|tcp_newspaper_sniper|LogicOpenMailboxNewspaper|open_newspaper_mailbox|optimumu_guard|start_optimumu|Oracle-Intra)\b",
    "token": r"(?:gh[opsu]_[A-Za-z0-9_]{15,}|sk-[A-Za-z0-9_-]{20,}|AIzaSy[A-Za-z0-9_-]{30,})",
}
for name, rx in patterns.items():
    found = re.findall(rx, text, re.IGNORECASE)
    check(not found, f"leak ({name}): {sorted(set(found))[:5]}")

if problems:
    print("FAILED:")
    print("\n".join(f"  - {p}" for p in problems))
    sys.exit(1)
print("OK: samples, results and docs are consistent and contain no detected leaks.")
