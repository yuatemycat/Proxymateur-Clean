with open(r"C:\Users\X\AppData\Local\agy\bin\agy.exe", "rb") as f:
    data = f.read()

import re
# Find go package paths like google3/... or github.com/...
matches = set(re.findall(rb"(?:google3|github\.com)[a-zA-Z0-9_\-\.\/\\]*auth[a-zA-Z0-9_\-\.\/\\]*", data, re.IGNORECASE))
for m in sorted(matches)[:40]:
    print(m.decode("utf-8", errors="ignore"))
