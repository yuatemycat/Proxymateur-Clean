with open(r"C:\Users\X\AppData\Local\agy\bin\agy.exe", "rb") as f:
    data = f.read()

import re
matches = set(re.findall(rb"google3\/[a-zA-Z0-9_\-\.\/\\]*auth[a-zA-Z0-9_\-\.\/\\]*", data))
for m in sorted(matches):
    print(m.decode("utf-8", errors="ignore"))
