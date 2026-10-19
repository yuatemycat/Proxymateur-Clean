with open(r"C:\Users\X\AppData\Local\agy\bin\agy.exe", "rb") as f:
    data = f.read()

import re

# Look for string literals containing ".gemini" or "antigravity" in data
matches = set(re.findall(rb"[a-zA-Z0-9_\-\.\/\\]*\.gemini[a-zA-Z0-9_\-\.\/\\]*", data))
for m in sorted(matches):
    print(m.decode("utf-8", errors="ignore"))
