import sqlite3, json

conn = sqlite3.connect(r'C:\Users\X\.proxymateur\proxy_logs.db')
c = conn.cursor()
c.execute("SELECT id, request_body FROM request_logs WHERE id LIKE '60a4b367%' OR id LIKE '0eb64de3%'")
for r in c.fetchall():
    b = json.loads(r[1])
    print("===", r[0][:8], "===")
    print(b['systemInstruction']['parts'][0]['text'][-800:])
    print("--- U0 ---")
    print(b['contents'][0]['parts'][0]['text'][:400])
