#!/usr/bin/env python3
"""
Antigravity CLI (agy) SQLite Conversation Auto-Repair Utility
Scans and repairs conversations stuck with Error 2:
'failed to unmarshal tool call arguments: unexpected end of JSON input'
"""

import argparse
import glob
import json
import os
import shutil
import sqlite3
import sys

DEFAULT_CONV_DIR = os.path.expandvars(
    r"%USERPROFILE%\.gemini\antigravity-cli\conversations"
)


def repair_json_string(s: str) -> str:
    """Attempt to balance unclosed quotes, brackets, and braces in a truncated JSON string."""
    if not s or not s.strip():
        return "{}"

    s = s.strip()

    # Try parsing directly
    try:
        json.loads(s)
        return s
    except Exception:
        pass

    # Basic repair heuristic: balance quotes and braces
    in_string = False
    escape = False
    stack = []

    for char in s:
        if escape:
            escape = False
            continue
        if char == "\\":
            escape = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if not in_string:
            if char in ("{", "["):
                stack.append(char)
            elif char == "}":
                if stack and stack[-1] == "{":
                    stack.pop()
            elif char == "]":
                if stack and stack[-1] == "[":
                    stack.pop()

    repaired = s
    if in_string:
        repaired += '"'

    while stack:
        open_char = stack.pop()
        if open_char == "{":
            repaired += "}"
        elif open_char == "[":
            repaired += "]"

    # Test if valid JSON now
    try:
        json.loads(repaired)
        return repaired
    except Exception:
        # Fallback minimal valid JSON object
        return "{}"


def inspect_and_repair_db(db_path: str, dry_run: bool = False) -> int:
    conv_id = os.path.splitext(os.path.basename(db_path))[0]
    conn = None
    repairs = 0

    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()

        # Check existing tables
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cur.fetchall()]

        # 1. Check messages table if arguments / tool_calls are stored there
        if "messages" in tables:
            cur.execute("PRAGMA table_info(messages)")
            cols = [c[1] for c in cur.fetchall()]
            for text_col in [c for c in cols if "arg" in c or "tool" in c or "content" in c]:
                cur.execute(f"SELECT rowid, {text_col} FROM messages WHERE {text_col} IS NOT NULL")
                for rowid, val in cur.fetchall():
                    if isinstance(val, str) and (val.startswith("{") or val.startswith("[")):
                        try:
                            json.loads(val)
                        except Exception:
                            fixed = repair_json_string(val)
                            if fixed != val:
                                repairs += 1
                                if not dry_run:
                                    cur.execute(
                                        f"UPDATE messages SET {text_col} = ? WHERE rowid = ?",
                                        (fixed, rowid),
                                    )

        # 2. Check tool_calls table
        if "tool_calls" in tables:
            cur.execute("PRAGMA table_info(tool_calls)")
            cols = [c[1] for c in cur.fetchall()]
            for text_col in [c for c in cols if "arg" in c or "payload" in c]:
                cur.execute(f"SELECT rowid, {text_col} FROM tool_calls WHERE {text_col} IS NOT NULL")
                for rowid, val in cur.fetchall():
                    if isinstance(val, str) and (val.startswith("{") or val.startswith("[")):
                        try:
                            json.loads(val)
                        except Exception:
                            fixed = repair_json_string(val)
                            if fixed != val:
                                repairs += 1
                                if not dry_run:
                                    cur.execute(
                                        f"UPDATE tool_calls SET {text_col} = ? WHERE rowid = ?",
                                        (fixed, rowid),
                                    )

        if repairs > 0 and not dry_run:
            bak_path = db_path + ".bak"
            if not os.path.exists(bak_path):
                shutil.copy2(db_path, bak_path)
            conn.commit()
            print(f"[+] Successfully repaired {repairs} truncated JSON field(s) in {conv_id}.db")
        elif repairs > 0 and dry_run:
            print(f"[*] Found {repairs} broken JSON field(s) in {conv_id}.db (DRY RUN)")

    except Exception as e:
        print(f"[-] Error processing {conv_id}.db: {e}")
    finally:
        if conn:
            conn.close()

    return repairs


def main():
    parser = argparse.ArgumentParser(description="Repair broken agy SQLite conversation databases")
    parser.add_argument("--conversation", help="Specific conversation ID (UUID) to repair")
    parser.add_argument("--all", action="store_true", help="Scan and repair all conversations in the directory")
    parser.add_argument("--dir", default=DEFAULT_CONV_DIR, help="Path to conversations directory")
    parser.add_argument("--dry-run", action="store_true", help="Scan without making changes")
    args = parser.parse_args()

    if not os.path.exists(args.dir):
        print(f"[-] Directory not found: {args.dir}")
        sys.exit(1)

    targets = []
    if args.conversation:
        target_file = os.path.join(args.dir, f"{args.conversation}.db")
        if os.path.exists(target_file):
            targets.append(target_file)
        else:
            print(f"[-] Database not found for conversation: {target_file}")
            sys.exit(1)
    elif args.all:
        targets = glob.glob(os.path.join(args.dir, "*.db"))
        # Exclude .bak files
        targets = [t for t in targets if not t.endswith(".bak") and not t.endswith(".testbak")]
    else:
        print("[-] Please specify either --conversation <UUID> or --all")
        sys.exit(1)

    print(f"[*] Scanning {len(targets)} conversation database(s)...")
    total_repaired = 0
    for db in targets:
        total_repaired += inspect_and_repair_db(db, dry_run=args.dry_run)

    print(f"\n[*] Total repaired items across all databases: {total_repaired}")


if __name__ == "__main__":
    main()
