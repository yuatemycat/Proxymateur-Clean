import sqlite3, datetime

conn = sqlite3.connect(r'C:\Users\X\.proxymateur\proxy_logs.db')
c = conn.cursor()
c.execute("""
    SELECT id, timestamp, session_id, account_email, duration, status, error, response_headers
    FROM request_logs
    WHERE account_email NOT LIKE 'vertex:%'
    ORDER BY timestamp DESC LIMIT 25
""")
for r in c.fetchall():
    ts = datetime.datetime.fromtimestamp(r[1]/1000.0 if r[1] > 1e11 else r[1]).strftime('%Y-%m-%d %H:%M:%S')
    print(f"{r[0][:8]} | {ts} | sid={str(r[2]):21s} | acc={str(r[3]):25s} | dur={r[4]:6d}ms | st={r[5]} | err={r[6]}")
