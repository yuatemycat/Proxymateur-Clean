import json
import os
import time

def check_account():
    path = r"C:\Users\X\.proxymateur\accounts\70tror00-0000-4000-8000-000000000001.json"
    if not os.path.exists(path):
        print(f"File {path} does not exist!")
        return

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    token = data.get("token", {})
    access_token = token.get("access_token", "")
    refresh_token = token.get("refresh_token", "")
    expiry = token.get("expiry_timestamp", 0)

    print("Email:", data.get("email"))
    print("Name:", data.get("name"))
    print("Disabled:", data.get("disabled"))
    print("Disabled reason:", data.get("disabled_reason"))
    print("Proxy disabled:", data.get("proxy_disabled"))
    print("Proxy disabled reason:", data.get("proxy_disabled_reason"))
    print("OAuth client key:", token.get("oauth_client_key"))
    print("Project ID:", token.get("project_id"))
    print("Is GCP TOS:", token.get("is_gcp_tos"))
    print("Access token length:", len(access_token), "prefix:", access_token[:10] if access_token else "none")
    print("Refresh token length:", len(refresh_token), "prefix:", refresh_token[:10] if refresh_token else "none")
    print("Expiry timestamp:", expiry, "Current time:", int(time.time()), "Expired?:", expiry < time.time() if expiry < 1e11 else (expiry / 1000) < time.time())
    print("Quota:", data.get("quota"))
    print("Device profile present?:", data.get("device_profile") is not None)

if __name__ == "__main__":
    check_account()
