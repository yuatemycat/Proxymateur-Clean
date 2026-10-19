with open(r"C:\Users\X\AppData\Local\agy\bin\agy.exe", "rb") as f:
    data = f.read()

import re

# Look for strings surrounding CLITokenFilePath or token file names
target_str = b"CLITokenFilePath"
idx = 0
while True:
    pos = data.find(target_str, idx)
    if pos == -1:
        break
    start = max(0, pos - 200)
    end = min(len(data), pos + 300)
    print(f"Match at {pos}:")
    chunk = data[start:end]
    # filter readable ASCII
    cleaned = re.sub(rb"[^\x20-\x7e\n\t]", rb".", chunk)
    print(cleaned.decode("ascii"))
    print("-" * 50)
    idx = pos + len(target_str)
