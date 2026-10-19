import re

def search_patterns():
    target = r"C:\Users\X\AppData\Local\agy\bin\agy.exe"
    with open(target, "rb") as f:
        data = f.read()

    patterns = [
        rb"CredRead",
        rb"CredWrite",
        rb"keyring",
        rb"Keychain",
        rb"oauth",
        rb"token",
        rb"credentials",
        rb"secret-tool",
        rb"antigravity",
    ]

    for p in patterns:
        matches = len(re.findall(p, data, re.IGNORECASE))
        print(f"Pattern {p.decode()}: {matches} matches")

    # Let's find string literals matching .gemini or credential targets
    found_paths = set()
    for m in re.finditer(rb"[a-zA-Z0-9_\-\.\:\/\\]{4,80}(?:oauth|token|credential|gemini|antigravity)[a-zA-Z0-9_\-\.\:\/\\]{0,80}", data, re.IGNORECASE):
        try:
            s = m.group(0).decode("utf-8", errors="ignore")
            if any(k in s.lower() for k in ["gemini", "antigravity", "credential", "keyring"]):
                found_paths.add(s)
        except Exception:
            pass

    print(f"Found {len(found_paths)} potential string matches. First 30:")
    for s in sorted(found_paths)[:30]:
        print("  ", s)

if __name__ == "__main__":
    search_patterns()
