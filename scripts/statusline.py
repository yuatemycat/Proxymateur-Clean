import sys
import json
import os
import re
import time
import shutil
from datetime import datetime, timezone

HOME_DIR = os.path.expanduser('~')
CACHE_FILE = os.path.join(HOME_DIR, '.gemini', 'antigravity-cli', 'statusline_cache.json')
ANSI_RE = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]')

def visible_len(s):
    return len(ANSI_RE.sub('', s))

def read_stdin_nowait(timeout_ms=40):
    """Cross-platform non-blocking STDIN reader."""
    buf = bytearray()
    start = time.time()

    if sys.platform == 'win32':
        import msvcrt
        import ctypes
        from ctypes import wintypes
        try:
            handle = msvcrt.get_osfhandle(sys.stdin.fileno())
            avail = wintypes.DWORD()
            while True:
                if ctypes.windll.kernel32.PeekNamedPipe(handle, None, 0, None, ctypes.byref(avail), None):
                    if avail.value > 0:
                        chunk = sys.stdin.buffer.read(avail.value)
                        buf.extend(chunk)
                        continue
                if buf or (time.time() - start) * 1000.0 >= timeout_ms:
                    break
                time.sleep(0.003)
        except Exception:
            pass
    else:
        import select
        try:
            while (time.time() - start) * 1000.0 < timeout_ms:
                r, _, _ = select.select([sys.stdin], [], [], 0.01)
                if r:
                    chunk = sys.stdin.read(4096)
                    if not chunk:
                        break
                    buf.extend(chunk.encode('utf-8'))
                elif buf:
                    break
        except Exception:
            pass

    return buf.decode('utf-8', errors='ignore') if buf else ""

def load_cache():
    try:
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception:
        pass
    return {}

def save_cache(cache):
    try:
        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache, f)
    except Exception:
        pass

def resolve_transcript_path(sess_id, passed_path=None):
    candidates = []
    if passed_path:
        candidates.append(passed_path)
    if sess_id:
        candidates.append(os.path.join(HOME_DIR, '.gemini', 'antigravity-cli', 'brain', sess_id, '.system_generated', 'logs', 'transcript.jsonl'))
        candidates.append(os.path.join(HOME_DIR, '.gemini', 'antigravity', 'brain', sess_id, '.system_generated', 'logs', 'transcript.jsonl'))
    
    for c in candidates:
        if c and os.path.exists(c):
            return c
    return None

def get_native_stats_from_transcript(session_id, transcript_path=None, max_turns=8):
    t_path = resolve_transcript_path(session_id, transcript_path)
    if not t_path:
        return None
    
    try:
        with open(t_path, 'rb') as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            f.seek(max(0, size - 65536))
            raw = f.read().decode('utf-8', errors='ignore')
        
        lines = raw.splitlines()
        steps = []
        for l in lines:
            l = l.strip()
            if not l:
                continue
            try:
                steps.append(json.loads(l))
            except Exception:
                continue
        
        valid_turns = []
        for i, s in enumerate(steps):
            if s.get('type') == 'PLANNER_RESPONSE' and s.get('output_tokens'):
                out_tok = int(s['output_tokens'])
                p_ts_str = s.get('created_at')
                if not p_ts_str or out_tok <= 0:
                    continue
                try:
                    p_dt = datetime.strptime(p_ts_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                    p_ts = p_dt.timestamp()
                except Exception:
                    continue
                
                if i + 1 < len(steps):
                    n_step = steps[i+1]
                    if n_step.get('type') == 'GENERIC' and n_step.get('created_at'):
                        try:
                            n_dt = datetime.strptime(n_step['created_at'], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                            dur = n_dt.timestamp() - p_ts
                            if 0.3 <= dur <= 60.0:
                                valid_turns.append((out_tok, dur))
                        except Exception:
                            pass
                else:
                    now_utc = datetime.now(timezone.utc).timestamp()
                    dur = now_utc - p_ts
                    if 0.3 <= dur <= 30.0:
                        valid_turns.append((out_tok, dur))
        
        if not valid_turns:
            return None
        
        recent = valid_turns[-max_turns:]
        tot_tokens = sum(t[0] for t in recent)
        tot_dur = sum(t[1] for t in recent)
        
        if tot_dur <= 0:
            return None
        
        avg_tps = tot_tokens / tot_dur
        if 0 < avg_tps <= 1000.0:
            return {'tps': avg_tps}
    except Exception:
        pass
    return None

def format_tokens(n):
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n/1_000:.1f}k"
    return str(n)

def main():
    stdin_data = {}
    raw_in = read_stdin_nowait().strip()
    if raw_in:
        try:
            stdin_data = json.loads(raw_in)
        except Exception:
            pass

    cli_model = None
    sess_id = None
    ctx_val = None
    transcript_p = None
    term_width = 0
    cw = None

    if isinstance(stdin_data, dict):
        cli_model = stdin_data.get('model', {}).get('display_name') or stdin_data.get('model', {}).get('name')
        sess_id = stdin_data.get('session_id') or stdin_data.get('conversation_id')
        term_width = stdin_data.get('terminal_width') or 0
        transcript_p = stdin_data.get('transcript_path')

        cw = stdin_data.get('context_window')
        if isinstance(cw, dict):
            if cw.get('total_input_tokens') is not None:
                ctx_val = int(cw['total_input_tokens'])
            else:
                usage = cw.get('current_usage') or {}
                new_tok = usage.get('input_tokens') or 0
                cached_tok = usage.get('cache_read_input_tokens') or 0
                if (new_tok + cached_tok) > 0:
                    ctx_val = new_tok + cached_tok
        if ctx_val is None and stdin_data.get('input_tokens') is not None:
            ctx_val = int(stdin_data['input_tokens'])

    if not term_width or term_width < 40:
        try:
            term_width = shutil.get_terminal_size().columns
        except Exception:
            term_width = 100

    # Calculate rolling throughput from transcript or cache
    cache = load_cache()
    sess_key = sess_id or 'default'
    cached_sess = cache.get(sess_key, {})

    native_stats = get_native_stats_from_transcript(sess_id, transcript_p)
    if native_stats and native_stats.get('tps'):
        stats = native_stats
        cache[sess_key] = {
            'tps': native_stats['tps'],
            'time': time.time()
        }
        save_cache(cache)
    elif cached_sess.get('tps'):
        stats = {'tps': cached_sess['tps']}
    else:
        stats = None

    model_name = cli_model or 'Gemini 3 Flash'
    model_short = (
        model_name.replace('gemini-', 'Gemini ')
        .replace('-flash', ' Flash')
        .replace('-pro', ' Pro')
        .replace('-tiered', ' (Tiered)')
        .replace('-high', ' (High)')
        .replace('-medium', ' (Med)')
        .replace('-low', ' (Low)')
    )

    ctx_val = ctx_val or 0
    ctx_str = format_tokens(ctx_val)

    cw_size = (cw.get('context_window_size') if isinstance(cw, dict) else None) or 1_048_576
    used_pct = (cw.get('used_percentage') if isinstance(cw, dict) else None)
    if used_pct is None and cw_size > 0:
        used_pct = (ctx_val / cw_size) * 100.0

    if cw_size >= 1_000_000:
        max_str = f"{cw_size / 1_000_000:.0f}M"
    elif cw_size >= 1_000:
        max_str = f"{cw_size // 1_000}k"
    else:
        max_str = str(cw_size)

    if used_pct is not None:
        if used_pct < 0.1 and ctx_val > 0:
            pct_str = f" ({used_pct:.2f}% of {max_str})"
        elif ctx_val == 0:
            pct_str = f" (0% of {max_str})"
        else:
            pct_str = f" ({used_pct:.1f}% of {max_str})"
    else:
        pct_str = ""

    ctx_display = f"ctx: {ctx_str}{pct_str}"

    left_part = f"\033[36m{model_short}\033[0m"

    if ctx_val > 0 and stats and stats.get('tps', 0) > 0:
        tps = stats['tps']
        tps_str = f"{tps:.0f} tok/s"
        right_part = f"\033[33m{ctx_display}\033[0m \033[90m|\033[0m \033[32m{tps_str}\033[0m"
    else:
        right_part = f"\033[33m{ctx_display}\033[0m \033[90m|\033[0m \033[90mready\033[0m"

    left_len = visible_len(left_part)
    right_len = visible_len(right_part)
    pad_spaces = max(2, term_width - left_len - right_len - 2)
    output_line = f"{left_part}{' ' * pad_spaces}{right_part}"

    try:
        sys.stdout.buffer.write(output_line.encode('utf-8') + b'\n')
        sys.stdout.buffer.flush()
    except Exception:
        print(output_line)

if __name__ == '__main__':
    main()
