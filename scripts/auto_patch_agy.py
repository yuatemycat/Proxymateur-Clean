import glob
import hashlib
import struct
import capstone
import os
import re
import shutil
import subprocess
import sys
import time

AGY_DIR = os.path.join(os.environ.get("LOCALAPPDATA", r"C:\Users\X\AppData\Local"), "agy", "bin")
AGY_PATH = os.path.join(AGY_DIR, "agy.exe")
LOG_PATH = os.path.join(AGY_DIR, "auto_patch_agy.log")
LOCK_PATH = os.path.join(AGY_DIR, "agy.exe.patch.lock")

MARKER = b"PROX_CMD_V1"
CAVE_SECTION = b".proxcv"
KEEP_RUNNING_ARCHIVES = 2


def log(msg):
    line = f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}"
    print(line)
    try:
        if os.path.exists(LOG_PATH) and os.path.getsize(LOG_PATH) > 256 * 1024:
            os.replace(LOG_PATH, LOG_PATH + ".1")
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def pe_section_names(head):
    """Section names from a PE header buffer (needs only the first few KB of the file)."""
    if len(head) < 0x40 or head[:2] != b"MZ":
        return []
    e_lfanew = struct.unpack_from("<I", head, 0x3C)[0]
    if e_lfanew + 24 > len(head) or head[e_lfanew:e_lfanew + 4] != b"PE\0\0":
        return []
    num_sections = struct.unpack_from("<H", head, e_lfanew + 6)[0]
    opt_hdr_size = struct.unpack_from("<H", head, e_lfanew + 20)[0]
    tbl = e_lfanew + 24 + opt_hdr_size
    if tbl + num_sections * 40 > len(head):
        return []
    return [head[tbl + i * 40: tbl + i * 40 + 8].rstrip(b"\0") for i in range(num_sections)]


def is_agy_patched(data):
    """A valid patch has BOTH the marker and the dedicated cave section.

    The legacy in-place patch carried only the marker (and overflowed .rdata on v1.4.0+),
    so the marker alone must not be trusted.
    """
    return MARKER in data and CAVE_SECTION in pe_section_names(bytes(data[:4096]))


def is_patched_file(path):
    """Cheap check (header only) for the hot path taken on every agy launch."""
    with open(path, "rb") as f:
        return CAVE_SECTION in pe_section_names(f.read(4096))


def smoke_test(path, timeout=30):
    """Start the binary with --version; a corrupted image panics in runtime init (rc != 0)."""
    try:
        r = subprocess.run([path, "--version"], capture_output=True, timeout=timeout,
                           stdin=subprocess.DEVNULL)
    except (OSError, subprocess.SubprocessError) as e:
        log(f"[-] smoke test could not run {os.path.basename(path)}: {e}")
        return None
    out = (r.stdout + r.stderr).decode("latin-1", errors="ignore")
    ok = r.returncode == 0 and "panic" not in out and re.search(r"\d+\.\d+\.\d+", out) is not None
    if not ok:
        log(f"[-] smoke test FAILED for {os.path.basename(path)} (rc={r.returncode}): {out.strip()[:160]!r}")
        return None
    return re.search(r"\d+\.\d+\.\d+", out).group(0)


def find_pristine_backup(size):
    """A backup of the same size that is unpatched and starts cleanly (legacy patches kept the size)."""
    for cand in sorted(glob.glob(os.path.join(AGY_DIR, "agy.exe.bak*_pristine")),
                       key=os.path.getmtime, reverse=True):
        try:
            if os.path.getsize(cand) != size:
                continue
            with open(cand, "rb") as f:
                blob = f.read()
        except OSError:
            continue
        if MARKER in blob:
            continue
        if smoke_test(cand):
            return cand
    return None


def save_pristine_backup(exe_path, version, digest):
    dest = os.path.join(AGY_DIR, f"agy.exe.bak_v{version.replace('.', '')}_pristine")
    if os.path.exists(dest):
        with open(dest, "rb") as f:
            if hashlib.sha256(f.read()).hexdigest() == digest:
                return dest
        dest = os.path.join(AGY_DIR, f"agy.exe.bak_v{version.replace('.', '')}_{digest[:8]}_pristine")
        if os.path.exists(dest):
            return dest
    shutil.copy2(exe_path, dest)
    log(f"[*] saved pristine backup: {os.path.basename(dest)}")
    return dest


def prune_running_archives():
    archives = sorted(glob.glob(os.path.join(AGY_DIR, "agy.exe.running_*")),
                      key=os.path.getmtime, reverse=True)
    for old in archives[KEEP_RUNNING_ARCHIVES:]:
        try:
            os.remove(old)
        except OSError:
            pass  # still mapped by a live process; next run retries


def acquire_lock():
    for _ in range(2):
        try:
            os.close(os.open(LOCK_PATH, os.O_CREAT | os.O_EXCL | os.O_WRONLY))
            return True
        except FileExistsError:
            try:
                if time.time() - os.path.getmtime(LOCK_PATH) > 180:
                    os.remove(LOCK_PATH)  # stale lock from a crashed run
                    continue
            except OSError:
                pass
            return False
    return False


def ensure_agy_patched(exe_path=AGY_PATH):
    """Idempotent, self-healing entry point. Never leaves exe_path in a worse state than it found it."""
    if not os.path.exists(exe_path):
        log(f"[-] {exe_path} not found")
        return False

    if is_patched_file(exe_path):
        return True

    if not acquire_lock():
        log("[*] another patch run is in progress; skipping")
        return True
    tmp_path = exe_path + ".new"
    try:
        with open(exe_path, "rb") as f:
            data = bytearray(f.read())

        if MARKER in data:
            # Legacy patch (marker, no cave section): known to corrupt .rdata on v1.4.0+. Heal it.
            log("[!] legacy/corrupt patch detected; restoring pristine binary before re-patching")
            backup = find_pristine_backup(len(data))
            if backup is None:
                log("[-] no matching pristine backup found; cannot heal. Reinstall agy or restore a backup.")
                return False
            with open(backup, "rb") as f:
                data = bytearray(f.read())
            log(f"[*] using pristine backup {os.path.basename(backup)}")
        else:
            version = smoke_test(exe_path)
            if version is None:
                log("[-] current agy.exe does not start and carries no patch marker; refusing to touch it")
                return False
            save_pristine_backup(exe_path, version, hashlib.sha256(data).hexdigest())

        log("[*] agy.exe needs patching. Running dynamic reference point patcher...")
        try:
            patched = _build_patched_image(data)
        except Exception as e:  # unknown layout in a newer agy build: leave the binary alone
            log(f"[-] patcher could not locate reference points ({type(e).__name__}: {e}); agy left unpatched")
            return False

        with open(tmp_path, "wb") as f:
            f.write(patched)
        if smoke_test(tmp_path) is None:
            log("[-] patched image failed its startup smoke test; keeping the current agy.exe")
            return False

        archived_running = os.path.join(AGY_DIR, f"agy.exe.running_{int(time.time())}")
        try:
            os.rename(exe_path, archived_running)
        except OSError as e:
            log(f"[-] could not move the current agy.exe aside ({e}); aborting swap")
            return False
        try:
            shutil.move(tmp_path, exe_path)
        except OSError as e:
            os.rename(archived_running, exe_path)  # roll back
            log(f"[-] swap failed, rolled back ({e})")
            return False
        prune_running_archives()
        log("[+] agy.exe patched and verified")
        return True
    finally:
        for p in (tmp_path, LOCK_PATH):
            try:
                os.remove(p)
            except OSError:
                pass


def _build_patched_image(data):
    """Return a patched copy of the (unpatched) agy.exe image held in `data`."""
    data = bytearray(data)

    # 1. Parse PE Headers dynamically
    e_lfanew = struct.unpack_from("<I", data, 0x3C)[0]
    num_sections = struct.unpack_from("<H", data, e_lfanew + 6)[0]
    opt_hdr_size = struct.unpack_from("<H", data, e_lfanew + 20)[0]
    opt_hdr_offset = e_lfanew + 24
    image_base = struct.unpack_from("<Q", data, opt_hdr_offset + 24)[0]
    sec_tbl_offset = opt_hdr_offset + opt_hdr_size

    sections = []
    for i in range(num_sections):
        sec = data[sec_tbl_offset + i*40 : sec_tbl_offset + (i+1)*40]
        name = sec[:8].rstrip(b"\x00").decode("latin-1")
        vsize, vaddr, raw_size, raw_ptr = struct.unpack_from("<IIII", sec, 8)
        va = image_base + vaddr
        sections.append({
            "name": name, "va": va, "vsize": vsize, "raw_ptr": raw_ptr, "raw_size": raw_size
        })

    def va_to_raw(va):
        for s in sections:
            if s["va"] <= va < s["va"] + s["vsize"]:
                return s["raw_ptr"] + (va - s["va"])
        return None

    def raw_to_va(raw):
        for s in sections:
            if s["raw_ptr"] <= raw < s["raw_ptr"] + s["raw_size"]:
                return s["va"] + (raw - s["raw_ptr"])
        return None

    # 2. Dynamic pclntab discovery
    pcln_magics = [b"\xf1\xff\xff\xff\x00\x00", b"\xf0\xff\xff\xff\x00\x00"]
    raw_pcln = None
    for magic in pcln_magics:
        pos = 0
        while True:
            pos = data.find(magic, pos)
            if pos == -1: break
            nfunc = struct.unpack_from("<Q", data, pos + 8)[0]
            if 1000 < nfunc < 500000:
                raw_pcln = pos
                break
            pos += 1
        if raw_pcln: break

    assert raw_pcln is not None, "Failed to locate Go pclntab"
    words = struct.unpack_from("<16Q", data, raw_pcln)
    nfunc = words[1]
    func_names_base = raw_pcln + words[4]
    pcln_offset = words[8]
    func_tab = raw_pcln + pcln_offset

    new_reg_va = None
    morestack_va = None
    for i in range(nfunc):
        entry_off, func_info_off = struct.unpack_from("<II", data, func_tab + i * 8)
        info_ptr = raw_pcln + pcln_offset + func_info_off
        if info_ptr + 8 >= len(data): continue
        n_off = struct.unpack_from("<i", data, info_ptr + 4)[0]
        if 0 <= n_off and func_names_base + n_off < len(data):
            end = data.find(b"\x00", func_names_base + n_off)
            if end != -1:
                fname = data[func_names_base + n_off : end].decode("latin-1", errors="ignore")
                if fname.endswith("commands/commands.NewRegistry"):
                    new_reg_va = 0x140001000 + entry_off
                elif fname == "runtime.morestack":
                    morestack_va = 0x140001000 + entry_off
        if new_reg_va and morestack_va:
            break

    assert new_reg_va is not None, "Failed to locate commands.NewRegistry"
    assert morestack_va is not None, "Failed to locate runtime.morestack"

    # 3. Dynamic call site & RegisterCommand discovery
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
    raw_new_reg = va_to_raw(new_reg_va)
    code_chunk = data[raw_new_reg:raw_new_reg + 0x440]

    calls = []
    for i in md.disasm(code_chunk, new_reg_va):
        if i.mnemonic == 'call':
            dest = int(i.op_str, 16) if i.op_str.startswith('0x') else None
            calls.append((i.address, dest))

    freq = {}
    for addr, dest in calls:
        freq[dest] = freq.get(dest, 0) + 1

    register_cmd_va = max(freq.items(), key=lambda x: x[1])[0]
    
    # In NewRegistry:
    # Look for the last call in the sequential block of RegisterCommand calls
    # Call #37 is the original call right after the 33 sequential RegisterCommand calls
    last_seq_idx = -1
    for idx, (addr, dest) in enumerate(calls):
        if dest == register_cmd_va:
            last_seq_idx = idx
        elif last_seq_idx != -1 and dest != register_cmd_va:
            # Found the call immediately following the sequential register block!
            hook_idx = idx
            break

    call_site_va, original_call_va = calls[hook_idx]
    call_site_raw = va_to_raw(call_site_va)

    # 4. Dynamic GenericCommand itab discovery
    pat_name = bytes.fromhex("48 8b 08 48 8b 58 08 48 89 c8 c3")
    pat_desc = bytes.fromhex("48 8b 48 10 48 8b 58 18 48 89 c8 c3")
    pat_exec = bytes.fromhex("31 c0 c3")

    pos = 0
    name_va = None
    desc_va = None
    exec_va = None
    while True:
        pos = data.find(pat_name, pos)
        if pos == -1: break
        desc_pos = data.find(pat_desc, pos, pos + 64)
        if desc_pos != -1:
            exec_pos = data.find(pat_exec, desc_pos, desc_pos + 64)
            if exec_pos != -1:
                curr_va = raw_to_va(pos)
                if abs(curr_va - new_reg_va) < 0x200000:
                    name_va = curr_va
                    desc_va = raw_to_va(desc_pos)
                    exec_va = raw_to_va(exec_pos)
                    break
        pos += len(pat_name)

    assert desc_va and exec_va and name_va, "Failed to locate GenericCommand methods"
    pat_itab = struct.pack("<QQ", desc_va, exec_va)
    itab_pos = data.find(pat_itab)
    itab_raw = itab_pos - 0x18
    itab_va = raw_to_va(itab_raw)

    # 5. Allocate a dedicated RWX section for the code cave and data cave.
    # Existing executable sections have no slack (the .text raw tail is ~64 bytes and
    # the neighbouring sections are full), so writing past it corrupts .rdata.
    sect_align = struct.unpack_from("<I", data, opt_hdr_offset + 32)[0]
    file_align = struct.unpack_from("<I", data, opt_hdr_offset + 36)[0]
    size_of_headers = struct.unpack_from("<I", data, opt_hdr_offset + 60)[0]

    def align_up(v, a):
        return (v + a - 1) & ~(a - 1)

    new_hdr_off = sec_tbl_offset + num_sections * 40
    assert new_hdr_off + 40 <= size_of_headers and not any(data[new_hdr_off:new_hdr_off + 40]), \
        "No free slot in the PE section table"

    CAVE_RAW_SIZE = 0x1000
    CAVE_DATA_OFF = 0x400
    last_rva_end = max((s["va"] - image_base) + s["vsize"] for s in sections)
    cave_rva = align_up(last_rva_end, sect_align)
    cave_raw_ptr = align_up(len(data), file_align)
    data.extend(b"\x00" * (cave_raw_ptr - len(data)))
    data.extend(b"\x00" * CAVE_RAW_SIZE)

    # IMAGE_SCN_CNT_CODE | CNT_INITIALIZED_DATA | MEM_EXECUTE | MEM_READ | MEM_WRITE
    data[new_hdr_off:new_hdr_off + 40] = struct.pack(
        "<8sIIIIIIHHI", b".proxcv", CAVE_RAW_SIZE, cave_rva, CAVE_RAW_SIZE, cave_raw_ptr,
        0, 0, 0, 0, 0xE0000060)
    struct.pack_into("<H", data, e_lfanew + 6, num_sections + 1)
    struct.pack_into("<I", data, opt_hdr_offset + 56, align_up(cave_rva + CAVE_RAW_SIZE, sect_align))

    code_raw = cave_raw_ptr
    code_va = image_base + cave_rva
    data_raw = cave_raw_ptr + CAVE_DATA_OFF
    data_va = code_va + CAVE_DATA_OFF

    print(f"    -> Resolved Reference Points:")
    print(f"       commands.NewRegistry: 0x{new_reg_va:x}")
    print(f"       Call Site:            0x{call_site_va:x} (raw 0x{call_site_raw:x})")
    print(f"       Original Call:        0x{original_call_va:x}")
    print(f"       RegisterCommand:      0x{register_cmd_va:x}")
    print(f"       GenericCommand itab:  0x{itab_va:x}")
    print(f"       Code Cave:            0x{code_va:x} (raw 0x{code_raw:x})")
    print(f"       Data Cave:            0x{data_va:x} (raw 0x{data_raw:x})")

    COMMANDS = [
        ("battle", "Colosseum Battle Mode. Competing subagents in an adversarial arena."),
        ("owl", "Deep codebase investigation, iterative autonomous synthesis."),
        ("swarm", "Autonomous Multi-Agent Swarm Hub. Coordinates parallel specialist subagents."),
        ("benchmark", "Programmatic Tool Synthesis & Performance Benchmarking."),
        ("generative_ui", "Render dynamic interactive UI widgets, charts, and visualizations."),
        ("compact", "Compact and prune active conversation context history."),
        ("teamwork-preview", "Multi-agent teamwork subagent orchestrator and parallel preview execution."),
        ("teamwork", "Multi-agent teamwork subagent orchestrator (canonical alias)."),
        ("teamwork-previews", "Multi-agent teamwork subagent orchestrator (plural alias)."),
        ("team", "Multi-agent teamwork subagent orchestrator (shorthand alias)."),
        ("flash", "Quick prompt execution with Gemini Flash model."),
    ]

    NUM_COMMANDS = len(COMMANDS)
    ENTRY_SIZE = 56

    TABLE_VA = data_va
    TABLE_RAW = data_raw

    META_VA  = data_va + (NUM_COMMANDS * ENTRY_SIZE)
    META_RAW = data_raw + (NUM_COMMANDS * ENTRY_SIZE)

    STR_VA   = (META_VA + (NUM_COMMANDS * 8) + 15) & ~15
    STR_RAW  = (META_RAW + (NUM_COMMANDS * 8) + 15) & ~15

    str_pool = bytearray()
    meta_table = bytearray()

    for name, desc in COMMANDS:
        nb = name.encode('utf-8')
        db = desc.encode('utf-8')
        noff = len(str_pool)
        str_pool.extend(nb); str_pool.append(0)
        doff = len(str_pool)
        str_pool.extend(db); str_pool.append(0)
        meta_table.extend(struct.pack('<HHHH', noff, len(nb), doff, len(db)))

    # Append MARKER to str_pool so we can detect patched status in 1ms
    str_pool.extend(MARKER)
    str_pool.append(0)

    def rip_disp32(target_va, curr_va_after):
        return struct.pack('<i', target_va - curr_va_after)

    code = bytearray()
    code.extend(b'\x49\x3b\x66\x10')
    jbe_pos = len(code)
    code.extend(b'\x0f\x86\x00\x00\x00\x00')
    code.extend(b'\x55\x48\x89\xe5\x48\x83\xec\x40\x48\x89\x44\x24\x30')

    call_off = len(code)
    curr_va = code_va + call_off + 5
    code.extend(b'\xe8' + rip_disp32(original_call_va, curr_va))

    lea_off = len(code)
    curr_va = code_va + lea_off + 7
    code.extend(b'\x48\x8d\x15' + rip_disp32(TABLE_VA, curr_va))
    code.extend(b'\x48\x83\x3a\x00')

    jne_pos = len(code)
    code.extend(b'\x75\x00')

    lea_str_off = len(code)
    curr_va = code_va + lea_str_off + 7
    code.extend(b'\x48\x8d\x1d' + rip_disp32(STR_VA, curr_va))

    lea_meta_off = len(code)
    curr_va = code_va + lea_meta_off + 7
    code.extend(b'\x48\x8d\x35' + rip_disp32(META_VA, curr_va))
    code.extend(b'\xb9' + struct.pack('<I', NUM_COMMANDS))

    init_loop_start = len(code)
    code.extend(b'\x0f\xb7\x06')                     # movzx eax, word ptr [rsi]
    code.extend(b'\x48\x01\xd8')                     # add rax, rbx
    code.extend(b'\x48\x89\x02')                     # mov [rdx], rax
    code.extend(b'\x0f\xb7\x46\x02')                 # movzx eax, word ptr [rsi+2]
    code.extend(b'\x48\x89\x42\x08')                 # mov [rdx+8], rax
    code.extend(b'\x0f\xb7\x46\x04')                 # movzx eax, word ptr [rsi+4]
    code.extend(b'\x48\x01\xd8')                     # add rax, rbx
    code.extend(b'\x48\x89\x42\x10')                 # mov [rdx+16], rax
    code.extend(b'\x0f\xb7\x46\x06')                 # movzx eax, word ptr [rsi+6]
    code.extend(b'\x48\x89\x42\x18')                 # mov [rdx+24], rax
    code.extend(b'\x31\xc0')                         # xor eax, eax
    code.extend(b'\x48\x89\x42\x20')                 # mov [rdx+32], rax
    code.extend(b'\x48\x89\x42\x28')                 # mov [rdx+40], rax
    code.extend(b'\x48\x89\x42\x30')                 # mov [rdx+48], rax
    code.extend(b'\x48\x83\xc6\x08')                 # add rsi, 8
    code.extend(b'\x48\x83\xc2\x38')                 # add rdx, 56 (0x38)
    code.extend(b'\xff\xc9')                         # dec ecx
    init_loop_disp = init_loop_start - (len(code) + 2)
    code.extend(b'\x75' + struct.pack('<b', init_loop_disp))

    do_loop_start = len(code)
    code[jne_pos+1] = do_loop_start - (jne_pos + 2)

    lea_tbl2_off = len(code)
    curr_va = code_va + lea_tbl2_off + 7
    code.extend(b'\x48\x8d\x15' + rip_disp32(TABLE_VA, curr_va))
    code.extend(b'\x48\x89\x54\x24\x20')
    code.extend(b'\x48\xc7\x44\x24\x28' + struct.pack('<I', NUM_COMMANDS))

    reg_loop_start = len(code)
    code.extend(b'\x48\x8b\x44\x24\x30')
    lea_hnd_off = len(code)
    curr_va = code_va + lea_hnd_off + 7
    code.extend(b'\x48\x8d\x1d' + rip_disp32(itab_va, curr_va))
    code.extend(b'\x48\x8b\x4c\x24\x20')
    call_reg_off = len(code)
    curr_va = code_va + call_reg_off + 5
    code.extend(b'\xe8' + rip_disp32(register_cmd_va, curr_va))
    code.extend(b'\x48\x83\x44\x24\x20\x38')
    code.extend(b'\x48\xff\x4c\x24\x28')
    reg_loop_disp = reg_loop_start - (len(code) + 2)
    code.extend(b'\x75' + struct.pack('<b', reg_loop_disp))

    code.extend(b'\x48\x8b\x44\x24\x30')
    code.extend(b'\xc9\xc3')

    # morestack:
    morestack_start = len(code)
    morestack_disp = morestack_start - (jbe_pos + 6)
    code[jbe_pos+2:jbe_pos+6] = struct.pack('<i', morestack_disp)

    code.extend(b'\x48\x89\x44\x24\x08')
    call_ms_off = len(code)
    curr_va = code_va + call_ms_off + 5
    code.extend(b'\xe8' + rip_disp32(morestack_va, curr_va))
    code.extend(b'\x48\x8b\x44\x24\x08')
    jmp_off = len(code)
    curr_va = code_va + jmp_off + 5
    code.extend(b'\xe9' + rip_disp32(code_va, curr_va))

    # Pad with int3
    code.extend(b'\xcc' * (280 - len(code)))

    # Apply patches
    data[data_raw:data_raw+2048] = b'\x00' * 2048
    data[META_RAW:META_RAW+len(meta_table)] = meta_table
    data[STR_RAW:STR_RAW+len(str_pool)] = str_pool
    data[code_raw:code_raw+len(code)] = code

    call_disp = code_va - (call_site_va + 5)
    call_bytes = b'\xe8' + struct.pack('<i', call_disp)
    data[call_site_raw:call_site_raw+5] = call_bytes

    log(f"[*] built patched image with {NUM_COMMANDS} commands")
    return data


# Backwards-compatible name used by older callers.
dynamic_patch_agy_file = ensure_agy_patched

if __name__ == "__main__":
    sys.exit(0 if ensure_agy_patched() else 1)
