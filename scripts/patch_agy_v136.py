import os
import sys
import time
import struct
import shutil
import capstone

AGY_DIR = r"C:\Users\X\AppData\Local\agy\bin"
AGY_PATH = os.path.join(AGY_DIR, "agy.exe")
PRISTINE_BAK = os.path.join(AGY_DIR, "agy.exe.bak_v136_pristine")

print("[1] Checking / creating pristine backup of agy v1.3.6...")
if not os.path.exists(PRISTINE_BAK):
    shutil.copy2(AGY_PATH, PRISTINE_BAK)
    print(f"    Saved pristine backup to: {PRISTINE_BAK}")
else:
    print(f"    Pristine backup already exists: {PRISTINE_BAK}")

# Load pristine binary to patch
with open(PRISTINE_BAK, "rb") as f:
    data = bytearray(f.read())

print(f"    Loaded binary size: {len(data)} bytes")

# Target VAs & RAW offsets for agy v1.3.6 (197,239,960 bytes)
CODE_VA = 0x14363cee0
CODE_RAW = 0x363c4e0

DATA_VA = 0x149eae980
DATA_RAW = 0x9ead180

CALL_SITE_RAW = 0x2f16dd4
CALL_SITE_VA = 0x142f177d4

ORIGINAL_CALL_VA = 0x142f19240
REGISTER_CMD_VA = 0x142f17880
HANDLER_VA = 0x149c64f08
MORESTACK_VA = 0x140095b00

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

NUM_COMMANDS = len(COMMANDS) # 11
ENTRY_SIZE = 56 # 0x38 bytes per GenericCommand: name(16), desc(16), subcommands(24)

TABLE_VA = DATA_VA
TABLE_RAW = DATA_RAW

META_VA  = DATA_VA + (NUM_COMMANDS * ENTRY_SIZE)
META_RAW = DATA_RAW + (NUM_COMMANDS * ENTRY_SIZE)

STR_VA   = (META_VA + (NUM_COMMANDS * 8) + 15) & ~15
STR_RAW  = (META_RAW + (NUM_COMMANDS * 8) + 15) & ~15

print(f"[2] Building strings pool and metadata for {NUM_COMMANDS} commands...")
str_pool = bytearray()
meta_table = bytearray()

for name, desc in COMMANDS:
    name_bytes = name.encode('utf-8')
    desc_bytes = desc.encode('utf-8')
    
    name_off = len(str_pool)
    str_pool.extend(name_bytes)
    str_pool.append(0)
    
    desc_off = len(str_pool)
    str_pool.extend(desc_bytes)
    str_pool.append(0)
    
    meta_table.extend(struct.pack('<HHHH', name_off, len(name_bytes), desc_off, len(desc_bytes)))

def rip_disp32(target_va, curr_va_after):
    return struct.pack('<i', target_va - curr_va_after)

print("[3] Assembling ASLR-safe 64-bit shellcode...")
code = bytearray()

# cmp rsp, [r14+0x10]
code.extend(b'\x49\x3b\x66\x10')
# jbe morestack
jbe_pos = len(code)
code.extend(b'\x0f\x86\x00\x00\x00\x00')
# push rbp; mov rbp, rsp; sub rsp, 0x40; mov [rsp+0x30], rax
code.extend(b'\x55\x48\x89\xe5\x48\x83\xec\x40\x48\x89\x44\x24\x30')

# call ORIGINAL_CALL_VA
call_off = len(code)
curr_va = CODE_VA + call_off + 5
code.extend(b'\xe8' + rip_disp32(ORIGINAL_CALL_VA, curr_va))

# lea rdx, [rip + TABLE_DISP]
lea_off = len(code)
curr_va = CODE_VA + lea_off + 7
code.extend(b'\x48\x8d\x15' + rip_disp32(TABLE_VA, curr_va))

# cmp qword ptr [rdx], 0
code.extend(b'\x48\x83\x3a\x00')

# jne do_loop
jne_pos = len(code)
code.extend(b'\x75\x00')

# lea rbx, [rip + STR_DISP]
lea_str_off = len(code)
curr_va = CODE_VA + lea_str_off + 7
code.extend(b'\x48\x8d\x1d' + rip_disp32(STR_VA, curr_va))

# lea rsi, [rip + META_DISP]
lea_meta_off = len(code)
curr_va = CODE_VA + lea_meta_off + 7
code.extend(b'\x48\x8d\x35' + rip_disp32(META_VA, curr_va))

# mov ecx, NUM_COMMANDS
code.extend(b'\xb9' + struct.pack('<I', NUM_COMMANDS))

init_loop_start = len(code)
# movzx eax, word ptr [rsi]
code.extend(b'\x0f\xb7\x06')
# add rax, rbx
code.extend(b'\x48\x01\xd8')
# mov [rdx], rax
code.extend(b'\x48\x89\x02')
# movzx eax, word ptr [rsi+2]
code.extend(b'\x0f\xb7\x46\x02')
# mov [rdx+8], rax
code.extend(b'\x48\x89\x42\x08')
# movzx eax, word ptr [rsi+4]
code.extend(b'\x0f\xb7\x46\x04')
# add rax, rbx
code.extend(b'\x48\x01\xd8')
# mov [rdx+16], rax
code.extend(b'\x48\x89\x42\x10')
# movzx eax, word ptr [rsi+6]
code.extend(b'\x0f\xb7\x46\x06')
# mov [rdx+24], rax
code.extend(b'\x48\x89\x42\x18')
# Zero out subcommands slice (bytes 32..56):
code.extend(b'\x31\xc0')
code.extend(b'\x48\x89\x42\x20')
code.extend(b'\x48\x89\x42\x28')
code.extend(b'\x48\x89\x42\x30')
# add rsi, 8
code.extend(b'\x48\x83\xc6\x08')
# add rdx, 56 (0x38)
code.extend(b'\x48\x83\xc2\x38')
# dec ecx
code.extend(b'\xff\xc9')
# jnz init_loop_start
init_loop_disp = init_loop_start - (len(code) + 2)
code.extend(b'\x75' + struct.pack('<b', init_loop_disp))

# Backpatch jne to do_loop
do_loop_start = len(code)
code[jne_pos+1] = do_loop_start - (jne_pos + 2)

# do_loop:
# lea rdx, [rip + TABLE_DISP]
lea_tbl2_off = len(code)
curr_va = CODE_VA + lea_tbl2_off + 7
code.extend(b'\x48\x8d\x15' + rip_disp32(TABLE_VA, curr_va))

# mov [rsp+0x20], rdx
code.extend(b'\x48\x89\x54\x24\x20')
# mov qword ptr [rsp+0x28], NUM_COMMANDS
code.extend(b'\x48\xc7\x44\x24\x28' + struct.pack('<I', NUM_COMMANDS))

reg_loop_start = len(code)
# mov rax, [rsp+0x30]
code.extend(b'\x48\x8b\x44\x24\x30')
# lea rbx, [rip + HANDLER_DISP]
lea_hnd_off = len(code)
curr_va = CODE_VA + lea_hnd_off + 7
code.extend(b'\x48\x8d\x1d' + rip_disp32(HANDLER_VA, curr_va))
# mov rcx, [rsp+0x20]
code.extend(b'\x48\x8b\x4c\x24\x20')
# call REGISTER_CMD_VA
call_reg_off = len(code)
curr_va = CODE_VA + call_reg_off + 5
code.extend(b'\xe8' + rip_disp32(REGISTER_CMD_VA, curr_va))
# add qword ptr [rsp+0x20], 56 (0x38)
code.extend(b'\x48\x83\x44\x24\x20\x38')
# dec qword ptr [rsp+0x28]
code.extend(b'\x48\xff\x4c\x24\x28')
# jnz reg_loop
reg_loop_disp = reg_loop_start - (len(code) + 2)
code.extend(b'\x75' + struct.pack('<b', reg_loop_disp))

# mov rax, [rsp+0x30]
code.extend(b'\x48\x8b\x44\x24\x30')
# leave; ret
code.extend(b'\xc9\xc3')

# morestack:
morestack_start = len(code)
morestack_disp = morestack_start - (jbe_pos + 6)
code[jbe_pos+2:jbe_pos+6] = struct.pack('<i', morestack_disp)

# mov [rsp+8], rax
code.extend(b'\x48\x89\x44\x24\x08')
# call MORESTACK_VA
call_ms_off = len(code)
curr_va = CODE_VA + call_ms_off + 5
code.extend(b'\xe8' + rip_disp32(MORESTACK_VA, curr_va))
# mov rax, [rsp+8]
code.extend(b'\x48\x8b\x44\x24\x08')
# jmp CODE_VA
jmp_off = len(code)
curr_va = CODE_VA + jmp_off + 5
code.extend(b'\xe9' + rip_disp32(CODE_VA, curr_va))

# Pad with int3 up to 280 bytes
code.extend(b'\xcc' * (280 - len(code)))

print(f"[4] Shellcode length: {len(code)} bytes (fits in 298-byte cave).")

# Disassemble verification
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
print("Disassembly verification:")
for i in md.disasm(bytes(code[:210]), CODE_VA):
    print(f"  0x{i.address:x}: {i.mnemonic:10s} {i.op_str}")

# [5] Apply patches to buffer
print("[5] Applying patches to binary buffer...")

# Zero out target data cave
data[DATA_RAW:DATA_RAW+2048] = b'\x00' * 2048

# Write metadata and strings
data[META_RAW:META_RAW+len(meta_table)] = meta_table
data[STR_RAW:STR_RAW+len(str_pool)] = str_pool

# Write shellcode into code cave
data[CODE_RAW:CODE_RAW+len(code)] = code

# Patch call site at 0x2f16dd4
call_disp = CODE_VA - (CALL_SITE_VA + 5)
call_bytes = b'\xe8' + struct.pack('<i', call_disp)
data[CALL_SITE_RAW:CALL_SITE_RAW+5] = call_bytes
print(f"Call site at raw 0x{CALL_SITE_RAW:x} (VA 0x{CALL_SITE_VA:x}) -> disp32 = 0x{call_disp:x} ({call_bytes.hex()})")

# [6] Install patched binary safely via atomic NTFS rename
tmp_path = AGY_PATH + ".new"
with open(tmp_path, "wb") as f:
    f.write(data)
print(f"[6] Wrote patched binary to {tmp_path}")

ts = int(time.time())
archived_running = os.path.join(AGY_DIR, f"agy.exe.running_{ts}")

try:
    os.rename(AGY_PATH, archived_running)
    print(f"[7] Archived running binary to {archived_running}")
except Exception as e:
    print(f"[!] Direct rename notice: {e}")

shutil.move(tmp_path, AGY_PATH)
print(f"[+] Successfully installed updated agy.exe with {NUM_COMMANDS} registered slash commands!")
