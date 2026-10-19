import sqlite3
import json

conn = sqlite3.connect(r'C:\Users\X\.proxymateur\proxy_logs.db')
c = conn.cursor()

for req_id in ['e8fd053e-f468-4fef-a3d7-160e9c73591d', 'e89fc9e2-fa5e-4625-8ece-7b9724b5a422']:
    print(f"=== REQUEST {req_id} ===")
    c.execute("SELECT id, model, mapped_model, status, error, upstream_request_body, response_body FROM request_logs WHERE id = ?", (req_id,))
    row = c.fetchone()
    if not row:
        print("Not found")
        continue
    _, model, mapped_model, status, error, upstream_body_raw, resp_body_raw = row
    print(f"Model: {model} -> {mapped_model}, Status: {status}")
    print(f"Error: {error[:200] if error else None}")
    if upstream_body_raw:
        data = json.loads(upstream_body_raw)
        contents = data.get('contents', [])
        print(f"Total contents turns: {len(contents)}")
        for idx, turn in enumerate(contents):
            role = turn.get('role')
            parts = turn.get('parts', [])
            parts_summary = []
            for p in parts:
                if p.get('thought'):
                    parts_summary.append({
                        'type': 'thought',
                        'thoughtSignature': p.get('thoughtSignature'),
                        'len': len(p.get('text', '')),
                        'preview': p.get('text', '')[:40]
                    })
                elif 'text' in p:
                    parts_summary.append({
                        'type': 'text',
                        'len': len(p.get('text', '')),
                        'preview': p.get('text', '')[:40]
                    })
                elif 'functionCall' in p:
                    parts_summary.append({
                        'type': 'call',
                        'name': p['functionCall'].get('name')
                    })
                elif 'functionResponse' in p:
                    parts_summary.append({
                        'type': 'response',
                        'name': p['functionResponse'].get('name')
                    })
                else:
                    parts_summary.append(list(p.keys()))
            print(f"  [{idx}] role={role}: {parts_summary}")
conn.close()
