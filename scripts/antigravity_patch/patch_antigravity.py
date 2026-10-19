#!/usr/bin/env python3
"""
Antigravity 2.0 3-Layer Automated Patcher (version-independent).

Resolves the "No models available" issue in language_server.exe by applying:
  - Layer 1: Go backend panic bypass (defaults.go MODEL_PLACEHOLDER_M50), located by byte signature.
  - Layer 2: Frontend proto3 model parser patch (main.js, minified name varies: Hj, Qj, ...).
  - Layer 3: Popover category filter patch (main.js, minified name varies: tAb, LXb, ...).

Nothing is located by a fixed offset. The embedded ZIP entry for main.js is found by
scanning ZIP local headers, JS targets are found by regex, and every replacement is
padded with a comment to the exact original byte length so the compressed stream can be
re-padded to its original size and written in place.
"""

import argparse
import hashlib
import io
import os
import re
import shutil
import struct
import sys
import zipfile
import zlib

DEFAULT_LS_PATH = os.path.expandvars(
    r"%LOCALAPPDATA%\Programs\antigravity\resources\bin\language_server.exe"
)

# ---------------------------------------------------------------------------
# Layer 1 (OPT-IN via --layer1): (name, regex when unpatched, regex when patched, offset of
# the 2-byte `jne` inside the match). Each regex must match exactly once.
#
# Needed on 2.22.x, where GetDefaultConversationalCascadeConfig panicked on
# "unknown model key MODEL_PLACEHOLDER_M50". In 2.23.0 utils.resolveCheckpointModel falls
# back silently, so the panic branch is unreachable for that error (static analysis;
# the unpatched 2.23.0 language server starts fine) and Layer 1 is not applied by default.
#
# Pattern (x86-64): call; call; test rbx,rbx; jne <panic stub>; cmp [rip+x],0; jne +10;
# mov rcx,[rsp+0xa0]; jmp +0x18. 0xa0 selects GetDefaultConversationalCascadeConfig
# (0x98 is its TrainEval twin, which is deliberately left alone).
# ---------------------------------------------------------------------------
_L1_TAIL = rb"\x83\x3d....\x00\x75\x0a\x48\x8b\x8c\x24\xa0\x00\x00\x00\xeb\x18"
LAYER1_SIGNATURES = [
    (
        "GetDefaultConversationalCascadeConfig panic branch",
        re.compile(rb"\xe8....\xe8....\x48\x85\xdb\x75[\x20-\x60]" + _L1_TAIL, re.DOTALL),
        re.compile(rb"\xe8....\xe8....\x48\x85\xdb\x90\x90" + _L1_TAIL, re.DOTALL),
        13,
    )
]

# ---------------------------------------------------------------------------
# Layer 2 / 3 patterns and replacement templates
# ---------------------------------------------------------------------------
L2_RE = re.compile(
    r"var (?P<name>\w+)=a=>a\.modelOrAlias\?\{label:a\.label,"
    r"value:a\.modelOrAlias\.choice\.case===\"model\".*?:null(?=,)"
)
L2_DONE = 'value:(c?.case==="model"?c.value:m.model)||I.Model.UNSPECIFIED'

L3_RE = re.compile(
    r"const (?P<name>\w+)=a=>\(0,A\.useMemo\)\(\(\)=>\{var b=a\.find\("
    r"c=>c\.name\.toLowerCase\(\)===\"recommended\"\);.*?\},\[a\]\);"
)
L3_DONE = 'return{groupName:b?.name||"Recommended",options:o}'


def l2_core(name: str) -> tuple:
    """Returns (head, tail) so that head + pad + tail is the full replacement."""
    head = (
        f"var {name}=a=>{{let m=a.modelOrAlias,c=m?.choice;"
        "return m?{label:a.label,"
        'value:(c?.case==="model"?c.value:m.model)||I.Model.UNSPECIFIED,'
        'modelAlias:c?.case==="alias"?c.value:m.alias,'
        "disabled:a.disabled,"
        "supportedMimeTypes:new Map(Object.entries(a.supportedMimeTypes||{})),"
        "quotaInfo:a.quotaInfo,"
        "tagTitle:a.tagTitle,"
        "tagDescription:a.tagDescription,"
        "supportsThoughtCirculation:a.supportsThoughtCirculation,"
        "modelUrl:a.modelUrl}:null"
    )
    return head, "}"


def l3_core(name: str) -> tuple:
    head = (
        f"const {name}=a=>(0,A.useMemo)(()=>{{"
        'var b=(a||[]).find(c=>c?.name?.toLowerCase()==="recommended")||(a||[])[0];'
        "var o=b?.groups?.flatMap(g=>g.options||[])||[];"
        'return{groupName:b?.name||"Recommended",options:o}'
        "},[a])"
    )
    return head, ";"


def pad_to(head: str, tail: str, length: int) -> str:
    """Pads between head and tail with a JS block comment (or spaces) to exact length."""
    pad = length - len(head) - len(tail)
    if pad < 0:
        raise ValueError(f"Replacement is {-pad} bytes longer than the original region")
    if pad == 0:
        filler = ""
    elif pad < 4:
        filler = " " * pad
    else:
        filler = "/" + "*" * (pad - 2) + "/"
    out = head + filler + tail
    assert len(out) == length
    return out


# ---------------------------------------------------------------------------
# Embedded ZIP handling
# ---------------------------------------------------------------------------
class ZipEntry:
    def __init__(self, local_off, data_start, csize, usize, crc, central_crc_off):
        self.local_off = local_off
        self.crc_off = local_off + 14
        self.data_start = data_start
        self.csize = csize
        self.usize = usize
        self.crc = crc
        self.central_crc_off = central_crc_off


def find_main_js(data) -> ZipEntry:
    locals_ = []
    for m in re.finditer(rb"PK\x03\x04", data):
        off = m.start()
        if off + 30 > len(data):
            continue
        flag, comp = struct.unpack_from("<HH", data, off + 6)
        crc, csize, usize, nlen, elen = struct.unpack_from("<IIIHH", data, off + 14)
        if data[off + 30 : off + 30 + nlen] == b"main.js" and comp == 8 and not flag & 8:
            locals_.append((off, crc, csize, usize, nlen, elen))
    if len(locals_) != 1:
        raise RuntimeError(f"Expected exactly one embedded main.js, found {len(locals_)}")
    off, crc, csize, usize, nlen, elen = locals_[0]

    centrals = []
    for m in re.finditer(rb"PK\x01\x02", data):
        o = m.start()
        if o + 46 > len(data):
            continue
        n2 = struct.unpack_from("<H", data, o + 28)[0]
        if data[o + 46 : o + 46 + n2] == b"main.js":
            c_crc, c_csize, c_usize = struct.unpack_from("<III", data, o + 16)
            if (c_crc, c_csize, c_usize) == (crc, csize, usize):
                centrals.append(o + 16)
    if len(centrals) != 1:
        raise RuntimeError(f"Expected one central directory entry, found {len(centrals)}")
    return ZipEntry(off, off + 30 + nlen + elen, csize, usize, crc, centrals[0])


def exact_deflate(payload: bytes, target: int) -> bytes:
    """Raw deflate of payload, padded with stored blocks to exactly `target` bytes."""
    for level in (9, 8, 7, 6, 5):
        c = zlib.compressobj(level=level, method=zlib.DEFLATED, wbits=-15)
        base = c.compress(payload) + c.flush()
        needed = target - len(base)
        print(f"[*] level {level}: base size {len(base)}, spare {needed}")
        if needed < 0:
            continue
        for k in range(0, needed + 200):
            b1 = payload[:k]
            c2 = zlib.compressobj(level=level, method=zlib.DEFLATED, wbits=-15)
            b2 = c2.compress(payload[k:]) + c2.flush()
            block1 = bytes([0]) + struct.pack("<HH", k, (~k) & 0xFFFF) + b1 if k > 0 else b""
            diff = target - len(block1) - len(b2)
            if diff >= 0 and diff % 5 == 0:
                empties = (bytes([0]) + struct.pack("<HH", 0, 0xFFFF)) * (diff // 5)
                stream = empties + block1 + b2
                assert len(stream) == target
                assert zlib.decompress(stream, wbits=-15) == payload
                print(f"[+] exact stream: level={level} k={k} empty_blocks={diff // 5}")
                return stream
    raise RuntimeError("Could not build a deflate stream of the exact original size")


# ---------------------------------------------------------------------------
# Inspection (shared with verify_patch.py)
# ---------------------------------------------------------------------------
def inspect_binary(data) -> dict:
    """Reports the state of each layer without modifying anything."""
    state = {"layer1": [], "layer2": None, "layer3": None, "entry": None, "main_js": None}
    for name, rx_unpatched, rx_patched, off in LAYER1_SIGNATURES:
        status, pos = "missing", None
        for label, rx in (("unpatched", rx_unpatched), ("patched", rx_patched)):
            hits = [m.start() for m in rx.finditer(data)]
            if len(hits) == 1:
                status, pos = label, hits[0] + off
                break
            if len(hits) > 1:
                status = "ambiguous"
        state["layer1"].append((name, status, pos))

    entry = find_main_js(data)
    state["entry"] = entry
    js = zlib.decompress(bytes(data[entry.data_start : entry.data_start + entry.csize]), wbits=-15)
    state["main_js"] = js
    text = js.decode("utf-8")
    for key, rx, done in (("layer2", L2_RE, L2_DONE), ("layer3", L3_RE, L3_DONE)):
        m = rx.search(text)
        if m:
            state[key] = ("unpatched", m.group("name"), m.start(), m.end() - m.start())
        elif done in text:
            state[key] = ("patched", None, None, None)
        else:
            state[key] = ("missing", None, None, None)
    return state


def patch_binary(ls_path: str, out_path: str = None, dry_run: bool = False, layer1: bool = False):
    print("=" * 60)
    print("Antigravity 2.0 3-Layer Patcher")
    print(f"Target binary: {ls_path}")
    print("=" * 60)

    if not os.path.exists(ls_path):
        print(f"[-] Error: Executable not found at {ls_path}")
        sys.exit(1)

    with open(ls_path, "rb") as f:
        exe = bytearray(f.read())
    orig_len = len(exe)
    digest = hashlib.sha256(exe).hexdigest()[:12]
    print(f"[*] Binary size: {orig_len:,} bytes, sha256: {digest}...")

    st = inspect_binary(exe)
    entry = st["entry"]
    print(f"[*] main.js: {entry.usize:,} bytes ({entry.csize:,} compressed) at 0x{entry.data_start:X}")

    # Layer 1
    print("\n--- Layer 1: Go Backend Panic Bypass ---")
    if not layer1:
        print("[*] Skipped (opt-in with --layer1; not needed on 2.23.0+).")
    else:
        for name, status, pos in st["layer1"]:
            print(f"[*] {name}: {status}" + (f" at 0x{pos:X}" if pos is not None else ""))
            if status == "unpatched":
                before = bytes(exe[pos : pos + 2])
                exe[pos : pos + 2] = b"\x90\x90"
                print(f"[+] {before.hex()} -> 9090")
            elif status != "patched":
                print(f"[-] Layer 1 NOT applied ({status}); aborting to avoid a partial patch.")
                sys.exit(2)

    # Layers 2 & 3
    print("\n--- Layers 2 & 3: React Frontend Assets ---")
    text = st["main_js"].decode("utf-8")
    assert text.isascii(), "main.js is not ASCII; character offsets would not equal byte offsets"
    changed = False
    for key, rx, core, label in (
        ("layer2", L2_RE, l2_core, "Hj-equivalent proto3 model parser"),
        ("layer3", L3_RE, l3_core, "tAb-equivalent category filter"),
    ):
        status, name, pos, length = st[key]
        print(f"[*] {key} ({label}): {status}" + (f" as '{name}'" if name else ""))
        if status == "unpatched":
            head, tail = core(name)
            repl = pad_to(head, tail, length)
            text = text[:pos] + repl + text[pos + length :]
            changed = True
        elif status == "missing":
            print(f"[-] {key} target not found and not already patched; aborting.")
            sys.exit(2)

    if changed:
        patched_js = text.encode("utf-8")
        assert len(patched_js) == entry.usize, "main.js length changed"
        stream = exact_deflate(patched_js, entry.csize)
        new_crc = zlib.crc32(patched_js) & 0xFFFFFFFF
        struct.pack_into("<I", exe, entry.crc_off, new_crc)
        struct.pack_into("<I", exe, entry.central_crc_off, new_crc)
        exe[entry.data_start : entry.data_start + entry.csize] = stream
        print(f"[+] Wrote patched main.js, CRC32 {new_crc:#010x}")

    assert len(exe) == orig_len, "Executable size changed"

    # Re-inspect the in-memory result before writing anything
    st2 = inspect_binary(exe)
    ok = (
        st2["layer2"][0] == "patched"
        and st2["layer3"][0] == "patched"
        and (not layer1 or all(s == "patched" for _, s, _ in st2["layer1"]))
    )
    v_entry = st2["entry"]
    zf_crc = zlib.crc32(st2["main_js"]) & 0xFFFFFFFF
    ok = ok and zf_crc == v_entry.crc
    print(f"[{'+' if ok else '-'}] In-memory verification: {'PASSED' if ok else 'FAILED'}")
    if not ok:
        sys.exit(3)
    if dry_run:
        print("[*] --dry-run: nothing written.")
        return

    target = out_path or ls_path
    if out_path is None:
        bak = f"{ls_path}.bak-{digest}"
        if not os.path.exists(bak):
            print(f"[+] Creating pristine backup at {bak}")
            shutil.copy2(ls_path, bak)

    new_path = target + ".new"
    with open(new_path, "wb") as f:
        f.write(exe)
    if out_path is not None:
        shutil.move(new_path, target)
        print(f"[+] Wrote {target}")
    else:
        old_running = ls_path + ".running_old"
        if os.path.exists(old_running):
            try:
                os.remove(old_running)
            except OSError:
                pass
        try:
            shutil.move(new_path, ls_path)
            print(f"[+] Wrote {ls_path}")
        except OSError:
            print("[*] Binary is locked by a running process; using atomic rename...")
            os.rename(ls_path, old_running)
            os.rename(new_path, ls_path)
            print(f"[+] Replaced {ls_path} via atomic rename (restart Antigravity to load it).")

    print("\n" + "=" * 60)
    print("PATCHED AND VERIFIED. Restart Antigravity to apply.")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Patch Antigravity 2.0 language_server.exe")
    parser.add_argument("--path", default=DEFAULT_LS_PATH, help="Path to language_server.exe")
    parser.add_argument("--out", help="Write the patched binary here instead of in place")
    parser.add_argument("--dry-run", action="store_true", help="Patch in memory and verify only")
    parser.add_argument("--layer1", action="store_true", help="Also NOP the Go panic branch (2.22.x only)")
    args = parser.parse_args()
    patch_binary(args.path, args.out, args.dry_run, args.layer1)
