import glob, json
for p in sorted(glob.glob(r'C:\Users\X\.proxymateur\accounts\*.json')):
    with open(p, 'r', encoding='utf-8') as f:
        d = json.load(f)
    tok = d.get('token', {})
    print(f"{d.get('email'):30} id={d.get('id')} proxy_disabled={str(d.get('proxy_disabled')):5} project_id={tok.get('project_id')}")
