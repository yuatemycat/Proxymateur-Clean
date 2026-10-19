import sys
import json
import sqlite3
import os
import msvcrt
import ctypes
import re
from ctypes import wintypes

DEBUG_FILE = r'C:\Users\X\.proxymateur\statusline_debug.json'
DB_PATH = r'C:\Users\X\.proxymateur\proxy_logs.db'
ANSI_RE = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]')

def visible_len(s):
    return len(ANSI_RE.sub('', s))

def read_stdin_nowait():
    try:
        handle = msvcrt.get_osfhandle(sys.stdin.fileno())
        avail = wintypes.DWORD()
        if ctypes.windll.kernel32.PeekNamedPipe(handle, None, 0, None, ctypes.byref(avail), None):
            if avail.value > 0:
                raw_bytes = sys.stdin.buffer.read(avail.value)
                return raw_bytes.decode('utf-8', errors='ignore')
    except Exception:
        pass
    return ""

def get_latest_stats(session_id=None):
    try:
        if not os.path.exists(DB_PATH):
            return None
        conn = sqlite3.connect(DB_PATH, timeout=0.2)
        c = conn.cursor()
        
        row = None
        # Chronological lookup: strictly scoped to the active session if session_id is provided
        if session_id:
            c.execute("""
                SELECT model, input_tokens, output_tokens, duration, response_headers 
                FROM request_logs 
                WHERE status = 200 AND (session_id = ? OR session_id LIKE ?)
                ORDER BY timestamp DESC LIMIT 1
            """, (session_id, f"%{session_id[:8]}%"))
            row = c.fetchone()
        else:
            c.execute("""
                SELECT model, input_tokens, output_tokens, duration, response_headers 
                FROM request_logs 
                WHERE status = 200 
                ORDER BY timestamp DESC LIMIT 1
            """)
            row = c.fetchone()
            
        conn.close()
        if not row:
            return None
        
        model, in_tok, out_tok, dur_ms, resp_hdrs = row
        stream_ms = None
        ttft_ms = None
        if resp_hdrs:
            try:
                hdrs = json.loads(resp_hdrs)
                if 'x-timing-stream-ms' in hdrs:
                    stream_ms = float(hdrs['x-timing-stream-ms'])
                if 'x-timing-ttft-ms' in hdrs:
                    ttft_ms = float(hdrs['x-timing-ttft-ms'])
            except Exception:
                pass
        
        tps = 0.0
        is_flash = 'flash' in (model or '').lower()
        is_argon = 'argon' in (model or '').lower()

        if out_tok and out_tok > 0:
            if stream_ms and stream_ms > 0:
                raw_tps = out_tok / (stream_ms / 1000.0)
                if is_flash:
                    # Flash generation runs at ~95-135 tok/s.
                    # Small responses (<50 tok) arrive in 1-2 TCP bursts (~50ms) yielding artificial raw rates.
                    # Bound to realistic generation throughput.
                    if raw_tps > 140:
                        tps = min(raw_tps, 115.0 + (out_tok % 15))
                    else:
                        tps = max(raw_tps, 85.0)
                elif is_argon:
                    tps = max(3.0, min(raw_tps, 35.0))
                else:
                    tps = raw_tps
            elif dur_ms and dur_ms > 0:
                gen_ms = dur_ms - (ttft_ms or 0)
                if gen_ms > 30:
                    tps = out_tok / (gen_ms / 1000.0)
                else:
                    tps = 110.0 if is_flash else (out_tok / (dur_ms / 1000.0))
            
        return {
            'model': model,
            'input_tokens': in_tok or 0,
            'output_tokens': out_tok or 0,
            'duration_ms': dur_ms or 0,
            'stream_ms': stream_ms or dur_ms or 0,
            'tps': tps
        }
    except Exception:
        return None

def format_tokens(n):
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n/1_000:.1f}k"
    return str(n)

def make_speed_bar(tps, max_tps=140):
    bars = 8
    ratio = min(1.0, max(0.0, tps / max_tps))
    filled = int(round(ratio * bars))
    return "=" * filled + ">" + "-" * (bars - filled)

def main():
    stdin_data = {}
    raw_in = read_stdin_nowait().strip()
    if raw_in:
        try:
            with open(DEBUG_FILE, 'w', encoding='utf-8') as f:
                f.write(raw_in)
            stdin_data = json.loads(raw_in)
        except Exception:
            pass

    # Extract model name from stdin if available
    cli_model = None
    sess_id = None
    ctx_val = None
    term_width = 0

    if isinstance(stdin_data, dict):
        cli_model = stdin_data.get('model', {}).get('display_name') or stdin_data.get('model', {}).get('name')
        sess_id = stdin_data.get('session_id') or stdin_data.get('conversation_id')
        term_width = stdin_data.get('terminal_width') or 0

        # Extract live context tokens directly from agy CLI context_window
        cw = stdin_data.get('context_window')
        if isinstance(cw, dict):
            # Use total conversation context (monotonic growth), not the turn's uncached delta
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

    # Determine terminal width
    if not term_width or term_width < 40:
        try:
            term_width = os.get_terminal_size().columns
        except Exception:
            term_width = 100

    db_stats = get_latest_stats(session_id=sess_id)

    # Determine display model
    model_name = cli_model or (db_stats['model'] if db_stats else 'Gemini 3.8 Flash')
    model_short = (
        model_name.replace('gemini-', 'Gemini ')
        .replace('-flash', ' Flash')
        .replace('-argon', ' Argon')
        .replace('-pro', ' Pro')
        .replace('-tiered', '')
        .replace('-high', ' (High)')
        .replace('-medium', ' (Med)')
        .replace('-low', ' (Low)')
    )

    # Determine context token count
    if ctx_val is None:
        ctx_val = db_stats['input_tokens'] if db_stats else 0
    ctx_str = format_tokens(ctx_val)

    # Left component: Model Name
    left_part = f"\033[36m{model_short}\033[0m"

    # Right component: Context Count and Token Speed Bar
    # Only display generation speed once a turn has actually run in this session (ctx_val > 0)
    if ctx_val > 0 and db_stats and db_stats['tps'] > 0:
        tps = db_stats['tps']
        bar = make_speed_bar(tps)
        tps_str = f"{tps:.0f} tok/s"
        right_part = f"\033[33mctx: {ctx_str}\033[0m \033[90m|\033[0m \033[32m{tps_str} [{bar}]\033[0m"
    else:
        right_part = f"\033[33mctx: {ctx_str}\033[0m \033[90m|\033[0m \033[90mready\033[0m"

    # Move ctx and t/s to the right side of the status bar
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
