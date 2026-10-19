# Proxymateur CLI & Model Context Protocol (MCP) Guide

Proxymateur includes a native Command Line Interface (CLI) and an asynchronous Model Context Protocol (MCP) stdio server built directly into the core binary (`proxymateur` / `proxymateur.exe`, formerly `antigravity-tools`).

This enables automated workflows, shell scripts, and external AI coding assistants (such as **Hermes Agent**, **Claude Desktop**, **Cursor**, **Windsurf**, **Cline**, and **Antigravity CLI**) to programmatically inspect quota pools and seamlessly switch active accounts without manual GUI interaction.

---

## 1. Command Line Interface (CLI)

The CLI works cross-platform and can be called from PowerShell, Command Prompt, Bash, or Zsh.

### Binary Locations
- **Windows**: `C:\Users\<User>\AppData\Local\Proxymateur\proxymateur.exe` (or the deploy location `E:\01_Apps\Installed\Proxymateur\proxymateur.exe`)
- **macOS**: `/Applications/Proxymateur.app/Contents/MacOS/proxymateur`
- **Linux**: `/usr/bin/proxymateur` (or AppImage)

### Available Commands

#### `proxymateur accounts [--json]`
Lists all configured accounts, including account ID, email, label name, quota percentages, and active status (`*`).

```bash
# Formatted table
proxymateur accounts

# Structured JSON output
proxymateur accounts --json
```

**Table Output Example:**
```text
ACT ACCOUNT ID                           EMAIL                          LABEL              GEMINI %   CLAUDE %   TIER        
-----------------------------------------------------------------------------------------------------------------------------
 *  37999049-6c0b-42f1-96ba-1d2002242029 thunjaya@gmail.com             Thun               100%       100%       PRO
    40d21f36-a111-4d39-ae0d-dc80476b3517 3sach.teukkork@gmail.com       Mengsean Cheang    100%       100%       PRO
    54c3a09e-2dc8-4a8c-a432-f2f8064a1cdb jiangmengxianii@gmail.com      Xian Jian          100%       100%       PRO
```

---

#### `proxymateur quota [<id|email>] [--all] [--json]`
Fetches and inspects quota groups (Gemini 5h & weekly, Claude/GPT 5h & weekly) and detailed model-by-model quota percentages and reset timestamps.

- If `<id|email>` is omitted, quotas for the **currently active account** are displayed.
- `--all`: Fetch quotas across all configured accounts sequentially.
- `--json`: Output raw structured JSON.

```bash
# Check quota for active account
proxymateur quota

# Check quota for a specific email
proxymateur quota myemail@gmail.com

# Check all accounts with JSON formatting
proxymateur quota --all --json
```

**Output Example:**
```text
Account: thunjaya@gmail.com (37999049-6c0b-42f1-96ba-1d2002242029)
Label:   Thun
Tier:    PRO

--- Quota Groups ---
[Gemini Models]
  - weekly      48.6% remaining (Reset: 2026-10-07T02:23:46Z)
  - 5h         100.0% remaining (Reset: 2026-10-05T13:47:33Z)
[Claude and GPT models]
  - weekly     100.0% remaining (Reset: 2026-10-12T08:47:33Z)
  - 5h         100.0% remaining (Reset: 2026-10-05T13:47:33Z)

--- Models Quota ---
  - gemini-3.7-flash-high         49%  (Reset: 2026-10-07T02:23:46Z)
  - claude-sonnet-4-6            100%  (Reset: 2026-10-05T13:47:33Z)
  - claude-opus-4-6-thinking     100%  (Reset: 2026-10-05T13:47:33Z)
```

---

#### `proxymateur current [--json]`
Prints the active account ID, email, label name, and target IDE binding.

```bash
proxymateur current
```

---

#### `proxymateur switch <id|email|label>`
Switches the active Antigravity account immediately.
You can specify the target using:
1. Account ID (UUID)
2. Email address
3. Friendly label / name

```bash
# Switch by email
proxymateur switch myemail@gmail.com

# Switch by label
proxymateur switch "Thun"

# Switch by UUID
proxymateur switch 37999049-6c0b-42f1-96ba-1d2002242029
```

**Switch Behavior**:
- Synchronizes with the running Antigravity Manager GUI if active.
- Updates the local in-memory proxy token pool immediately.
- Writes credentials to the system keyring (Windows Credential Manager / macOS Keychain / Secret Service).
- Updates IDE configuration files (`~/.gemini/antigravity-cli/antigravity-oauth-token`, `~/.gemini/oauth_creds.json`, etc.) and seamlessly triggers language server hot-swap.

---

#### `proxymateur proxy [status|accounts|enable|disable] [--json]`
Manages the local OpenAI-compatible API proxy server and dynamically controls account inclusion in the rotation pool.

##### 1. `proxymateur proxy [status]`
Inspects service running state, listening port, base URL, API key, and account pool counts (Total, Active, Excluded).
```bash
proxymateur proxy status
proxymateur proxy status --json
```

##### 2. `proxymateur proxy accounts`
Lists all accounts with their proxy rotation status (`ACTIVE`, `EXCLUDED`, or `DISABLED`), quotas, and exclusion reasons.
```bash
proxymateur proxy accounts
proxymateur proxy accounts --json
```

##### 3. `proxymateur proxy enable <id|email|label>`
Re-enables an excluded account for API proxy rotation. Hot-reloads running proxy daemon immediately without downtime.
```bash
proxymateur proxy enable "myemail@gmail.com"
```

##### 4. `proxymateur proxy disable <id|email|label> [reason]`
Excludes an account from API proxy rotation (protecting its quotas for personal IDE use). Hot-reloads running proxy immediately.
```bash
proxymateur proxy disable "xianspired@gmail.com" "Reserved for personal IDE usage"
```

---

## 2. Model Context Protocol (MCP) Server

Proxymateur includes a native MCP server operating over `stdio` conforming to JSON-RPC 2.0.

Launch command:
```bash
proxymateur mcp
```

### Agent Configuration Examples

#### Hermes Agent (`~/.hermes/config.yaml` or tool configuration)
```yaml
mcp_servers:
  antigravity:
    command: "C:\\Users\\<User>\\AppData\\Local\\Proxymateur\\proxymateur.exe"
    args: ["mcp"]
```

#### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "proxymateur": {
      "command": "C:\\Users\\<User>\\AppData\\Local\\Proxymateur\\proxymateur.exe",
      "args": ["mcp"]
    }
  }
}
```

#### Cursor / Windsurf / Cline / Roo Code (`mcp.json`)
```json
{
  "mcpServers": {
    "proxymateur": {
      "command": "proxymateur",
      "args": ["mcp"]
    }
  }
}
```

---

### Exposed MCP Tools

The MCP server exposes 7 tools to AI agents:

### 1. `list_accounts`
Returns the complete list of configured accounts.
- **Parameters**:
  - `refresh` *(boolean, optional)*: Fetch fresh quota data from Google API (default: `false`).
- **Return Fields**:
  - `id`: Account UUID.
  - `email`: Account email address.
  - `name`: User-defined label / display name.
  - `priority`: Routing priority weight.
  - `is_current`: `true` if this account is currently active.
  - `disabled`: `true` if account is disabled.
  - `proxy_disabled`: `true` if excluded from proxy pool.
  - `proxy_disabled_reason`: Reason for proxy exclusion if disabled.
  - `has_opus55`: `true` if account has an Opus 5.5 label.
  - `subscription_tier`: `"FREE"`, `"PRO"`, or `"ULTRA"`.
  - `gemini_quota_pct`: Gemini effective remaining quota percentage (0-100).
  - `claude_quota_pct`: Claude/3P remaining quota percentage (0-100).
  - `reset_5h`: ISO-8601 timestamp for the next 5-hour quota reset.
  - `last_used`: Unix timestamp of last usage.

---

### 2. `read_quotas`
Fetches comprehensive live quota details, including quota groups and model breakdown.
- **Parameters**:
  - `account_id` *(string, optional)*: Specific account UUID, email, or label to inspect. Defaults to currently active account.
  - `refresh` *(boolean, optional)*: Fetch fresh quota data from Google API (default: `false`).
- **Return Content**:
  - Detailed Quota Groups:
    - `Gemini Models`: 5-hour and weekly remaining fractions + reset times.
    - `Claude and GPT models`: 5-hour and weekly remaining fractions + reset times.
  - Model list: Individual remaining percentages, reset timestamps, and model capabilities.

---

### 3. `get_current_account`
Retrieves information about the currently active Antigravity account.
- **Parameters**: None.
- **Return Fields**:
  - `id`: Account UUID.
  - `email`: Email address.
  - `name`: Label / display name.
  - `target_ide`: Configured IDE integration (`"ide"`, `"classic"`, `"agy"`, or `"auto"`).
  - `gemini_quota_pct`: Current Gemini quota %.
  - `claude_quota_pct`: Current Claude quota %.
  - `tier`: Subscription tier (`"PRO"`, `"FREE"`).

---

### 4. `switch_account`
Directly switches the active account in the system, proxy pool, and IDE.
- **Parameters**:
  - `account_id` *(string, required)*: Account UUID, email address, or label name.
  - `target` *(string, optional)*: Target environment (`"ide"`, `"classic"`, `"agy"`, or `"auto"`).
- **Return Value**:
  - Success confirmation message containing the new active account's email and ID.

---

### 5. `get_proxy_status`
Retrieves the real-time operational status of the local API proxy service.
- **Parameters**: None.
- **Return Fields**:
  - `running`: `true` if proxy daemon is actively responding on its configured HTTP port.
  - `port`: Local listening port (e.g. `8045`).
  - `base_url`: Base endpoint URL (e.g. `http://127.0.0.1:8045/v1`).
  - `api_key`: Configured proxy API key / Bearer token.
  - `total_accounts`: Total accounts configured in Proxymateur.
  - `active_accounts`: Total accounts currently eligible and rotating in proxy requests.
  - `disabled_accounts`: Total accounts excluded from proxy rotation.

---

### 6. `list_proxy_accounts`
Lists all accounts with their API proxy rotation status, quotas, and exclusion reasons.
- **Parameters**:
  - `refresh` *(boolean, optional)*: Fetch fresh quota data from Google API (default: `false`).
- **Return Value**:
  - Array of account objects with `proxy_disabled`, `proxy_disabled_reason`, quota percentages, and priority.

---

### 7. `toggle_proxy_account`
Dynamically includes or excludes an account from API proxy rotation. Directly updates disk storage and synchronizes the in-memory pool of the running proxy daemon without restarting.
- **Parameters**:
  - `account_id` *(string, required)*: Account UUID, email address, or label name.
  - `enabled` *(boolean, required)*: `true` to include account in proxy rotation; `false` to exclude.
  - `reason` *(string, optional)*: Reason for exclusion (e.g. `"Reserved for personal coding session"`).
- **Return Value**:
  - Confirmation JSON containing updated account state and status message.

---

## 3. Account Sorting Rules (Opus 5.5 Isolation)

Accounts with labels containing `Opus5.5` (such as `Opus 5.5`, `Opus5.5 REAL`, `Claude 5.5 Opus`, `account_opus_5.5`) are automatically partitioned and placed **strictly at the bottom** of the accounts list across all sorting strategies:
- Quota High to Low / Low to High
- Reset Time 5h + Weekly Priority
- Priority Weight
- Account Name / Label
- Last Used

This ensures that accounts reserved for Opus 5.5 tasks are not accidentally selected as default routing candidates or top recommendation picks.
