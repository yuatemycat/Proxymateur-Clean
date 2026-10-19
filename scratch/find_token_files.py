with open(r"C:\Users\X\AppData\Local\agy\bin\agy.exe", "rb") as f:
    data = f.read()

import re

# In Go binary, function names are in pclntab.
# Let's search for "oauth_creds.json" or "antigravity" or "token" near auth functions:
for token_name in [b"token", b"creds", b"credentials", b"auth"]:
    for m in re.finditer(rb"[a-zA-Z0-9_\-\.\/\\]{0,50}" + token_name + rb"[a-zA-Z0-9_\-\.\/\\]{0,50}\.(?:json|tok|token|dat|txt)", data, re.IGNORECASE):
        print("Found file ref:", m.group(0).decode("utf-8", errors="ignore"))
