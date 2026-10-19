# Proxymateur-Clean 🚀

> **Clean Account & Quota Studio for Antigravity (Non-Proxy, Community Edition)**
>
> An open-source, privacy-first desktop workspace designed for managing Google Antigravity accounts, monitoring real-time quotas, inspecting usage telemetry, and managing sessions — with zero 3rd-party proxy services, zero tracking, and pure client-side Bring-Your-Own (BYO) credentials.
>
> Forked from [lbjlaq/Antigravity-Manager](https://github.com/lbjlaq/Antigravity-Manager) (CC BY-NC-SA 4.0). Substantially modified, refactored, and maintained by [Yuatemycat](https://github.com/yuatemycat).

<div align="center">
  <img src="public/icon.png" width="96" height="96" alt="Proxymateur-Clean Logo">
  <h3>Proxymateur-Clean</h3>
  <p>Clean, sovereign account studio & quota inspector for Google Antigravity</p>

  <p>
    <img src="https://img.shields.io/badge/Edition-Community--Clean-green?style=flat-square" alt="Edition">
    <img src="https://img.shields.io/badge/Tauri-v2-orange?style=flat-square" alt="Tauri">
    <img src="https://img.shields.io/badge/Backend-Rust-red?style=flat-square" alt="Rust">
    <img src="https://img.shields.io/badge/Frontend-React-61DAFB?style=flat-square" alt="React">
    <img src="https://img.shields.io/badge/License-CC--BY--NC--SA--4.0-lightgrey?style=flat-square" alt="License">
  </p>

  <p>
    <a href="#-key-features">Key Features</a> • 
    <a href="#-bring-your-own-byo-oauth-20-setup">BYO OAuth Guide</a> • 
    <a href="#-local-antigravity-db-import">Local DB Import</a> • 
    <a href="#-installation--build">Installation</a> • 
    <a href="#-support--donations">Support & Donations</a> • 
    <a href="#-disclaimer">Disclaimer</a>
  </p>
</div>

---

## 🌟 Overview

**Proxymateur-Clean** is a community-driven, non-proxy fork engineered specifically for developers who demand complete sovereignty over their Google credentials, quota monitoring, and local AI agent workflows.

Unlike commercial relays or bloated proxies, **Proxymateur-Clean**:
- 🛡️ **Zero Hardcoded OAuth Secrets**: You supply your own Google Cloud OAuth 2.0 Client credentials (BYO OAuth).
- 🚫 **No Background Proxy Services**: Does not hijack local ports or automatically spin up background proxy listeners on startup.
- 🔒 **100% Local Data**: All tokens and session databases remain strictly on your local disk (`rusqlite`), protected by local OS-level encryption.
- 📊 **Decoupled Quota Analytics**: Clear visualization of independent quota pools (Gemini 2.5 Pro, Flash, Thinking, and 3P Claude limits) without cross-contamination.

---

## 💡 Key Features

### 1. 🎛️ Account Matrix & Health Dashboard
- **Real-time Quota Monitoring**: Monitor current weekly and daily rate limits for Gemini 2.5 Pro, Gemini Flash, and Claude pools.
- **Smart Quota Decoupling**: Prevents 3P/Claude exhaustion from artificially downgrading Gemini quota rankings or health states.
- **Auto-Refresh Engine**: Safely maintains fresh Google access tokens using your configured OAuth credentials with exponential backoff and jitter.
- **Permission & Status Audit**: Instantly detect `403 Forbidden`, scope revocation, or expired credentials with actionable UI badges.

### 2. 🔐 Sovereign Authentication & Bring-Your-Own OAuth (BYO)
- Native Google OAuth 2.0 flow using your own Google Cloud Console client ID and secret.
- Dynamic multi-client registry: switch between multiple personal or organizational OAuth clients on the fly.
- Manual code exchange fallback: authorize in any external browser and paste authorization tokens directly.

### 3. 📂 Local Antigravity Database Integration
- Auto-detects local installations of Antigravity CLI (`agy`) and Antigravity IDE.
- One-click import and synchronization of existing tokens and local session databases.
- View and inspect historical conversation transcripts and telemetry without sending data over the network.

### 4. ⚡ Bundled Antigravity Slash Commands & Skills
Includes the bundled productivity and agent orchestration skills in the `skills/` directory:
- `/owl`: Deep codebase investigation, iterative autonomous synthesis, and multi-agent architecture analysis.
- `/swarm`: Autonomous multi-agent swarm pipeline to coordinate specialist subagents in parallel.
- `/battle`: Colosseum Battle Mode pitting rival subagents against each other to debate trade-offs and benchmark solutions.
- `/compact` & `/compaction`: Prune and summarize conversation trajectories to save context tokens while preserving critical project state and variables.
- `/benchmark`: Programmatic tool synthesis and headless performance profiling.
- `/generative_ui`: Dynamic rendering of rich interactive HTML widgets and data visualizations.

### 5. 🎚️ Auto Compaction Slider & Token Governor
- **Interactive Threshold Slider**: Adjust the auto-compaction trigger limit from 50k to 500k tokens directly in **Settings → Antigravity Lab**.
- **Self-Healing Trajectory**: Automatically writes `model_auto_compact_token_limit` to `~/.gemini/antigravity-cli/settings.json`, folding history when long turns or large command outputs push against the ceiling to eliminate latency spikes.
- **1-Click GUI Installation**: Install all bundled skills and sync the token governor with a single click inside the app. Alternatively, run the scripts:

```bash
# Windows (PowerShell)
.\skills\install_skills.ps1

# macOS / Linux
bash skills/install_skills.sh
```

---

## 🔑 Bring-Your-Own (BYO) OAuth 2.0 Setup

To ensure total privacy and prevent centralized quota throttling, Proxymateur-Clean requires you to supply your own Google Cloud OAuth 2.0 credentials.

### Step 1: Create Google Cloud OAuth Credentials
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `My-Antigravity-Workspace`).
3. Navigate to **APIs & Services** > **OAuth consent screen**:
   - Choose **External** (or **Internal** if using Google Workspace).
   - Fill in the required app information (App name, support email).
   - Under **Scopes**, ensure the following scopes are enabled:
     - `openid`
     - `https://www.googleapis.com/auth/cloud-platform`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
     - `https://www.googleapis.com/auth/cclog`
     - `https://www.googleapis.com/auth/experimentsandconfigs`
   - Under **Test users**, add your Google email address.
4. Navigate to **APIs & Services** > **Credentials**:
   - Click **Create Credentials** > **OAuth client ID**.
   - Select Application type: **Desktop app** (or **Web application** with Authorized Redirect URI: `http://localhost:8080/oauth-callback` and `http://127.0.0.1:8080/oauth-callback`).
   - Copy your **Client ID** and **Client Secret**.

### Step 2: Configure in Proxymateur-Clean

You can configure your credentials using either of two convenient methods:

#### Method A: Via GUI Settings (Recommended)
1. Open Proxymateur-Clean and navigate to **Settings** > **OAuth Configuration**.
2. Click **Add Client** and paste your `Client ID` and `Client Secret`.
3. Set a custom label (e.g. `My Work GSuite` or `Personal Gmail`) and save.

#### Method B: Via Environment Variables
You can also supply one or more OAuth clients through environment variables:

```bash
# Single or multiple clients (key|client_id|client_secret|label separated by semicolon)
export ANTIGRAVITY_OAUTH_CLIENTS="my_client|YOUR_CLIENT_ID.apps.googleusercontent.com|YOUR_CLIENT_SECRET|Personal Client"

# Optionally set the default active client key:
export ANTIGRAVITY_OAUTH_CLIENT_KEY="my_client"
```

On Windows (PowerShell):
```powershell
[System.Environment]::SetEnvironmentVariable('ANTIGRAVITY_OAUTH_CLIENTS', 'my_client|YOUR_CLIENT_ID.apps.googleusercontent.com|YOUR_CLIENT_SECRET|Personal Client', 'User')
```

---

## 📥 Local Antigravity DB Import

If you already use Google Antigravity CLI or Antigravity IDE, your credentials and session caches are already stored on your computer. Proxymateur-Clean can import them directly:

### Default Storage Paths
| Operating System | Default Antigravity Location |
|---|---|
| **Windows** | `%APPDATA%\Google\Antigravity` or `%USERPROFILE%\.gemini\antigravity-cli` |
| **macOS** | `~/Library/Application Support/Google/Antigravity` or `~/.gemini/antigravity-cli` |
| **Linux** | `~/.config/google-antigravity` or `~/.gemini/antigravity-cli` |

### How to Import
1. In the **Accounts** tab, click **Import** > **Scan Local Antigravity DB**.
2. Proxymateur-Clean automatically scans the default paths, parses local token records, and presents them for one-click import into the studio.
3. No passwords or private keys ever leave your machine.

---

## 🛠️ Installation & Build

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- Rust 1.77+ and Cargo (`stable`)
- Visual Studio C++ Build Tools (Windows) or `build-essential` (Linux)

### Build from Source

```bash
# 1. Clone the repository
git clone https://github.com/yuatemycat/Proxymateur-Clean.git
cd Proxymateur-Clean

# 2. Install dependencies
npm install

# 3. Compile and launch in desktop debug mode
npm run tauri dev
```

### Production Package
To build a standalone production release binary:
```bash
# Build frontend and Rust binary
npm run build
cd src-tauri && cargo build --release
```
The optimized executable will be located at `src-tauri/target/release/proxymateur.exe` (or `proxymateur` on Linux/macOS).

---

## 💖 Support & Donations

Proxymateur-Clean is an independent, community-funded open-source utility developed without corporate sponsorships, trackers, or commercial API relays. 

If this studio saves you time or empowers your workflow, your support is deeply appreciated!

### Crypto Donation (Fast & Permissionless)
- **USDT (BEP20 / BNB Smart Chain)**:
  ```text
  0xd08d47bde441888166b801616754c667672cd502
  ```

---

## 📄 License & Disclaimer

### Disclaimer
> [!IMPORTANT]
> **Proxymateur-Clean is an independent open-source developer tool and is NOT affiliated with, authorized, maintained, sponsored, or endorsed by Google LLC, Alphabet Inc., or Anthropic PBC.**
> 
> "Google", "Antigravity", "Gemini", and "Google Cloud" are registered trademarks of Google LLC. All brand and product names are trademarks or registered trademarks of their respective holders.

### License & Attribution
This project is licensed under [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/).

- **Original Work**: Forked from [lbjlaq/Antigravity-Manager](https://github.com/lbjlaq/Antigravity-Manager) © 2024–2026 lbjlaq.
- **Modifications & Clean Edition**: Substantially modified, refactored, and maintained by [Yuatemycat](https://github.com/yuatemycat).
- **Non-Commercial & ShareAlike**: You are free to share, study, and adapt this work for non-commercial purposes, provided appropriate credit is given and derivative works are distributed under the same license.

