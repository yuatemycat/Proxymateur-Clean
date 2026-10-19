#!/usr/bin/env python3
"""
Antigravity 2.0 (v2.22.0) Patch Verification Harness
Performs static integrity checks on language_server.exe and live dynamic checks via CDP / HTTPS.
"""

import argparse
import json
import os
import struct
import sys
import urllib.request
import zlib

DEFAULT_LS_PATH = os.path.expandvars(
    r"%LOCALAPPDATA%\Programs\antigravity\resources\bin\language_server.exe"
)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import patch_antigravity as pa  # noqa: E402


def verify_static(ls_path: str):
    print("=" * 60)
    print("Static Binary Integrity Verification")
    print(f"Target: {ls_path}")
    print("=" * 60)

    if not os.path.exists(ls_path):
        print(f"[-] Error: File not found at {ls_path}")
        return False

    with open(ls_path, "rb") as f:
        data = f.read()

    try:
        st = pa.inspect_binary(data)
    except Exception as e:
        print(f"[-] Could not read embedded main.js: {e}")
        return False

    ok = True
    for name, status, pos in st["layer1"]:
        where = f" at 0x{pos:X}" if pos is not None else ""
        print(f"[*] Layer 1 (informational, opt-in; {name}): {status}{where}")

    entry = st["entry"]
    crc_ok = (zlib.crc32(st["main_js"]) & 0xFFFFFFFF) == entry.crc
    local = struct.unpack_from("<I", data, entry.crc_off)[0]
    central = struct.unpack_from("<I", data, entry.central_crc_off)[0]
    crc_ok &= local == central == entry.crc
    print(f"[{'+' if crc_ok else '-'}] ZIP CRC32 (local/central/content): {entry.crc:#010x}")
    ok &= crc_ok

    for key, label in (("layer2", "proto3 model parser"), ("layer3", "category filter")):
        status = st[key][0]
        good = status == "patched"
        ok &= good
        print(f"[{'+' if good else '-'}] Layer {key[-1]} ({label}): {status}")

    print("\n[+] ALL STATIC CHECKS PASSED!\n" if ok else "\n[-] STATIC CHECKS FAILED\n")
    return ok


def check_live_cdp():
    print("=" * 60)
    print("Live Antigravity UI / CDP Probe")
    print("=" * 60)

    # Check language_server.log for active CDP port
    log_path = os.path.expandvars(r"%APPDATA%\antigravity\logs\language_server.log")
    if not os.path.exists(log_path):
        print(f"[*] Log file not found at {log_path}; skipping live probe.")
        return

    import re
    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
        log_text = f.read()

    m = re.findall(r"ws://127\.0\.0\.1:(\d+)/devtools/browser", log_text)
    if not m:
        print("[*] No active CDP port discovered in logs.")
        return

    cdp_port = int(m[-1])
    print(f"[*] Discovered Electron CDP port: {cdp_port}")

    try:
        req = urllib.request.urlopen(f"http://127.0.0.1:{cdp_port}/json", timeout=2)
        targets = json.loads(req.read().decode())
        page = next((t for t in targets if t.get("type") == "page"), None)
        if page:
            print(f"[+] Connected to live Antigravity window:")
            print(f"    Title: {page.get('title')}")
            print(f"    URL:   {page.get('url')}")
            print(f"    WS:    {page.get('webSocketDebuggerUrl')}")
            print("[+] Live application is active and connected to language server.")
    except Exception as e:
        print(f"[*] Could not connect to CDP port {cdp_port}: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Verify Antigravity 2.0 patch")
    parser.add_argument("--path", default=DEFAULT_LS_PATH, help="Path to language_server.exe")
    args = parser.parse_args()

    ok = verify_static(args.path)
    if ok:
        check_live_cdp()
    sys.exit(0 if ok else 1)
