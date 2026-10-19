//! CLI and Model Context Protocol (MCP) Module
//!
//! Provides command-line interface tools and a native stdio MCP server for Proxymateur.
//! Allows AI agents (e.g. Claude Code, Hermes, Cursor, OpenCode) and terminal users to:
//! - List accounts with quota summaries (Opus 5.5 labeled accounts pinned to bottom)
//! - Read detailed quotas (models, percentages, countdowns, reset times)
//! - Switch accounts across Antigravity IDE, Native/Classic, and agy CLI
//! - Inspect the currently active account

use crate::models::{Account, QuotaData};
use crate::modules;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::io::{self, BufRead, Write};
use tracing::{error, info, warn};

static OPUS_55_REGEX: once_cell::sync::Lazy<regex::Regex> = once_cell::sync::Lazy::new(|| {
    regex::Regex::new(r"(?i)(?:opus[^\d\n]*5[._-]?5|5[._-]?5[^\d\n]*opus)").unwrap()
});

/// Check whether an account name/label contains "Opus 5.5" (any variation)
pub fn has_opus55_label(name: Option<&str>) -> bool {
    name.map(|n| OPUS_55_REGEX.is_match(n)).unwrap_or(false)
}

/// Attach to parent console on Windows so stdout/stderr output appears in cmd/powershell
#[cfg(target_os = "windows")]
pub fn attach_console() {
    unsafe {
        #[link(name = "kernel32")]
        extern "system" {
            fn AttachConsole(dw_process_id: u32) -> i32;
            fn GetStdHandle(n_std_handle: u32) -> *mut std::ffi::c_void;
            fn SetStdHandle(n_std_handle: u32, h_handle: *mut std::ffi::c_void) -> i32;
            fn CreateFileW(
                lp_file_name: *const u16,
                dw_desired_access: u32,
                dw_share_mode: u32,
                lp_security_attributes: *mut std::ffi::c_void,
                dw_creation_disposition: u32,
                dw_flags_and_attributes: u32,
                h_template_file: *mut std::ffi::c_void,
            ) -> *mut std::ffi::c_void;
        }

        const ATTACH_PARENT_PROCESS: u32 = 0xFFFFFFFF;
        const STD_OUTPUT_HANDLE: u32 = 0xFFFFFFF5;
        const STD_ERROR_HANDLE: u32 = 0xFFFFFFF4;
        const GENERIC_WRITE: u32 = 0x40000000;
        const FILE_SHARE_WRITE: u32 = 2;
        const OPEN_EXISTING: u32 = 3;

        let cur_out = GetStdHandle(STD_OUTPUT_HANDLE);
        let is_invalid = cur_out.is_null() || cur_out == (-1isize as *mut std::ffi::c_void);

        if is_invalid && AttachConsole(ATTACH_PARENT_PROCESS) != 0 {
            use std::os::windows::ffi::OsStrExt;
            let conout: Vec<u16> = std::ffi::OsStr::new("CONOUT$")
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            let h_out = CreateFileW(
                conout.as_ptr(),
                GENERIC_WRITE,
                FILE_SHARE_WRITE,
                std::ptr::null_mut(),
                OPEN_EXISTING,
                0,
                std::ptr::null_mut(),
            );
            if !h_out.is_null() && h_out != (-1isize as *mut std::ffi::c_void) {
                SetStdHandle(STD_OUTPUT_HANDLE, h_out);
                SetStdHandle(STD_ERROR_HANDLE, h_out);
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn attach_console() {}

/// Check if the application was invoked in CLI or MCP mode
pub fn is_cli_mode(args: &[String]) -> bool {
    if args.len() <= 1 {
        return false;
    }

    let first = args[1].trim();

    // Not CLI mode: GUI login minimized or headless daemon
    if first == "--headless" || first == "--minimized" {
        return false;
    }

    matches!(
        first.to_ascii_lowercase().as_str(),
        "accounts"
            | "account"
            | "list"
            | "ls"
            | "quota"
            | "quotas"
            | "switch"
            | "current"
            | "whoami"
            | "proxy"
            | "mcp"
            | "--mcp"
            | "help"
            | "--help"
            | "-h"
            | "version"
            | "--version"
            | "-v"
    ) || (args.len() > 1 && !first.starts_with("--headless") && !first.starts_with("--minimized"))
}

/// Initialize CLI logger: all logs go strictly to stderr so stdout remains clean
pub fn init_cli_logger(is_mcp: bool) {
    let default_level = if is_mcp { "error" } else { "warn" };
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(default_level));

    let _ = tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_writer(io::stderr)
        .with_target(false)
        .with_ansi(true)
        .try_init();
}

/// Simplified quota summary preserving Gemini vs 3P/Claude independence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuotaSummaryInfo {
    pub gemini_pct: Option<i32>,
    pub claude_pct: Option<i32>,
    pub reset_5h: Option<String>,
}

pub fn extract_quota_summary(quota: Option<&QuotaData>) -> QuotaSummaryInfo {
    let Some(quota) = quota else {
        return QuotaSummaryInfo {
            gemini_pct: None,
            claude_pct: None,
            reset_5h: None,
        };
    };

    let mut gemini_pct: Option<i32> = None;
    let mut claude_pct: Option<i32> = None;
    let mut reset_5h: Option<String> = None;

    if let Some(ref groups) = quota.quota_groups {
        for g in groups {
            let lower = g.display_name.to_lowercase();
            if lower.contains("gemini") {
                for b in &g.buckets {
                    if b.window == "5h" || b.bucket_id.contains("5h") {
                        gemini_pct = Some((b.remaining_fraction * 100.0).round() as i32);
                        if reset_5h.is_none() && !b.reset_time.is_empty() {
                            reset_5h = Some(b.reset_time.clone());
                        }
                    }
                }
            } else if lower.contains("claude") || lower.contains("gpt") || lower.contains("3p") {
                for b in &g.buckets {
                    if b.window == "5h" || b.bucket_id.contains("5h") {
                        claude_pct = Some((b.remaining_fraction * 100.0).round() as i32);
                    } else if claude_pct.is_none()
                        && (b.window == "weekly" || b.bucket_id.contains("weekly"))
                    {
                        claude_pct = Some((b.remaining_fraction * 100.0).round() as i32);
                    }
                }
            }
        }
    }

    // Model fallback if groups were missing
    for m in &quota.models {
        let m_lower = m.name.to_lowercase();
        if gemini_pct.is_none()
            && (m_lower.contains("gemini-2.5-pro") || m_lower.contains("gemini-3-pro"))
        {
            gemini_pct = Some(m.percentage);
            if reset_5h.is_none() && !m.reset_time.is_empty() {
                reset_5h = Some(m.reset_time.clone());
            }
        }
        if claude_pct.is_none() && m_lower.contains("claude") {
            claude_pct = Some(m.percentage);
        }
    }

    QuotaSummaryInfo {
        gemini_pct,
        claude_pct,
        reset_5h,
    }
}

/// Structure for JSON serialization in CLI and MCP
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountCliItem {
    pub id: String,
    pub email: String,
    pub name: Option<String>,
    pub priority: u8,
    pub is_current: bool,
    pub disabled: bool,
    pub proxy_disabled: bool,
    pub proxy_disabled_reason: Option<String>,
    pub has_opus55: bool,
    pub subscription_tier: Option<String>,
    pub gemini_quota_pct: Option<i32>,
    pub claude_quota_pct: Option<i32>,
    pub reset_5h: Option<String>,
    pub last_used: i64,
}

/// Sort accounts so Opus 5.5 labeled accounts are strictly at the bottom
pub fn sort_accounts_cli(accounts: &mut [AccountCliItem]) {
    accounts.sort_by(|a, b| {
        // Rule: Opus 5.5 always at bottom
        let a_opus = a.has_opus55;
        let b_opus = b.has_opus55;
        if a_opus != b_opus {
            return a_opus.cmp(&b_opus);
        }

        // Current account first
        if a.is_current != b.is_current {
            return b.is_current.cmp(&a.is_current);
        }

        // Active accounts before disabled
        if a.disabled != b.disabled {
            return a.disabled.cmp(&b.disabled);
        }

        // Quota descending (Gemini quota primary)
        let a_gemini = a.gemini_quota_pct.unwrap_or(0);
        let b_gemini = b.gemini_quota_pct.unwrap_or(0);
        if a_gemini != b_gemini {
            return b_gemini.cmp(&a_gemini);
        }

        // Last used descending
        b.last_used.cmp(&a.last_used)
    });
}

/// Get processed accounts list
pub async fn get_accounts_cli(refresh: bool) -> Result<Vec<AccountCliItem>, String> {
    let mut raw_accounts = modules::account::list_accounts()?;
    let current_id = modules::account::get_current_account_id().ok().flatten();

    if refresh {
        for acc in &mut raw_accounts {
            if let Ok(quota) = modules::account::fetch_quota_with_retry(acc).await {
                acc.quota = Some(quota.clone());
                let _ = modules::account::update_account_quota(&acc.id, quota);
            }
        }
    }

    let mut items: Vec<AccountCliItem> = raw_accounts
        .into_iter()
        .map(|acc| {
            let is_current = current_id.as_deref() == Some(&acc.id);
            let has_opus = has_opus55_label(acc.name.as_deref());
            let summary = extract_quota_summary(acc.quota.as_ref());
            let tier = acc.quota.as_ref().and_then(|q| q.subscription_tier.clone());

            AccountCliItem {
                id: acc.id,
                email: acc.email,
                name: acc.name,
                priority: acc.priority,
                is_current,
                disabled: acc.disabled,
                proxy_disabled: acc.proxy_disabled,
                proxy_disabled_reason: acc.proxy_disabled_reason,
                has_opus55: has_opus,
                subscription_tier: tier,
                gemini_quota_pct: summary.gemini_pct,
                claude_quota_pct: summary.claude_pct,
                reset_5h: summary.reset_5h,
                last_used: acc.last_used,
            }
        })
        .collect();

    sort_accounts_cli(&mut items);
    Ok(items)
}

/// Switch account via HTTP API if GUI is running, or directly via CliIntegration
pub async fn switch_account_cli(
    account_query: &str,
    target_ide: Option<&str>,
) -> Result<Account, String> {
    let accounts = modules::account::list_accounts()?;
    if accounts.is_empty() {
        return Err("No accounts found in Proxymateur".to_string());
    }

    let query_lower = account_query.to_lowercase();
    let target_account = accounts
        .iter()
        .find(|a| a.id == account_query)
        .or_else(|| {
            accounts
                .iter()
                .find(|a| a.email.eq_ignore_ascii_case(account_query))
        })
        .or_else(|| {
            accounts
                .iter()
                .find(|a| a.email.to_lowercase().contains(&query_lower))
        })
        .or_else(|| {
            accounts.iter().find(|a| {
                a.name
                    .as_deref()
                    .map(|n| n.eq_ignore_ascii_case(account_query))
                    .unwrap_or(false)
            })
        })
        .or_else(|| {
            accounts.iter().find(|a| {
                a.name
                    .as_deref()
                    .map(|n| n.to_lowercase().contains(&query_lower))
                    .unwrap_or(false)
            })
        })
        .cloned();

    let account = match target_account {
        Some(acc) => acc,
        None => {
            return Err(format!(
                "No account matched '{}'. Run 'proxymateuraccounts' to list accounts.",
                account_query
            ))
        }
    };

    // Attempt HTTP switch if GUI app is running
    let app_config = modules::config::load_app_config().unwrap_or_default();
    let port = app_config.proxy.port;
    let mut switched_via_api = false;

    if let Ok(client) = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(1200))
        .build()
    {
        let url = format!("http://127.0.0.1:{}/api/accounts/switch", port);
        let mut req = client.post(&url).json(&json!({
            "accountId": account.id,
            "targetIde": target_ide,
        }));

        let api_key = &app_config.proxy.api_key;
        let admin_pwd = app_config.proxy.admin_password.as_deref().unwrap_or("");
        let token = if !admin_pwd.is_empty() {
            admin_pwd
        } else {
            api_key
        };
        if !token.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", token));
        }

        if let Ok(resp) = req.send().await {
            if resp.status().is_success() {
                switched_via_api = true;
                info!(
                    "Switched account via running Proxymateur API on port {}",
                    port
                );
            }
        }
    }

    if !switched_via_api {
        modules::account::switch_account(
            &account.id,
            target_ide,
            &modules::integration::CliIntegration,
        )
        .await?;
        info!("Switched account directly via local CLI integration");
    }

    Ok(account)
}

/// Proxy status information for CLI and MCP
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyStatusCli {
    pub running: bool,
    pub port: u16,
    pub base_url: String,
    pub api_key: String,
    pub total_accounts: usize,
    pub active_accounts: usize,
    pub disabled_accounts: usize,
}

/// Retrieve current proxy status and pool statistics
pub async fn get_proxy_status_cli() -> Result<ProxyStatusCli, String> {
    let app_config = modules::config::load_app_config().unwrap_or_default();
    let port = app_config.proxy.port;
    let base_url = format!("http://127.0.0.1:{}/v1", port);

    let accounts = modules::account::list_accounts().unwrap_or_default();
    let total_accounts = accounts.len();
    let disabled_accounts = accounts
        .iter()
        .filter(|a| a.disabled || a.proxy_disabled)
        .count();
    let active_accounts = total_accounts.saturating_sub(disabled_accounts);

    let mut running = false;
    if let Ok(client) = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(800))
        .build()
    {
        let health_url = format!("http://127.0.0.1:{}/health", port);
        if let Ok(resp) = client.get(&health_url).send().await {
            if resp.status().is_success() {
                running = true;
            }
        }
    }

    Ok(ProxyStatusCli {
        running,
        port,
        base_url,
        api_key: app_config.proxy.api_key.clone(),
        total_accounts,
        active_accounts,
        disabled_accounts,
    })
}

/// Toggle account proxy disabled status and notify running proxy server
pub async fn toggle_proxy_cli(
    account_query: &str,
    enable: bool,
    reason: Option<&str>,
) -> Result<Account, String> {
    let accounts = modules::account::list_accounts()?;
    if accounts.is_empty() {
        return Err("No accounts found in Proxymateur".to_string());
    }

    let query_lower = account_query.to_lowercase();
    let target_account = accounts
        .iter()
        .find(|a| a.id == account_query)
        .or_else(|| {
            accounts
                .iter()
                .find(|a| a.email.eq_ignore_ascii_case(account_query))
        })
        .or_else(|| {
            accounts
                .iter()
                .find(|a| a.email.to_lowercase().contains(&query_lower))
        })
        .or_else(|| {
            accounts.iter().find(|a| {
                a.name
                    .as_deref()
                    .map(|n| n.eq_ignore_ascii_case(account_query))
                    .unwrap_or(false)
            })
        })
        .or_else(|| {
            accounts.iter().find(|a| {
                a.name
                    .as_deref()
                    .map(|n| n.to_lowercase().contains(&query_lower))
                    .unwrap_or(false)
            })
        })
        .cloned();

    let account = match target_account {
        Some(acc) => acc,
        None => {
            return Err(format!(
                "No account matched '{}'. Run 'proxymateuraccounts' to list accounts.",
                account_query
            ))
        }
    };

    // 1. Update on disk (account file + index)
    modules::account::toggle_proxy_status(&account.id, enable, reason)?;

    // 2. If proxy is running, notify HTTP endpoint to reload in-memory pool
    let app_config = modules::config::load_app_config().unwrap_or_default();
    let port = app_config.proxy.port;

    if let Ok(client) = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(1500))
        .build()
    {
        let url = format!(
            "http://127.0.0.1:{}/accounts/{}/toggle-proxy",
            port, account.id
        );
        let mut req = client.post(&url).json(&json!({
            "enable": enable,
            "reason": reason,
        }));

        let api_key = &app_config.proxy.api_key;
        let admin_pwd = app_config.proxy.admin_password.as_deref().unwrap_or("");
        let token = if !admin_pwd.is_empty() {
            admin_pwd
        } else {
            api_key
        };
        if !token.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", token));
        }

        let _ = req.send().await;
    }

    // Return updated account
    modules::account::load_account(&account.id)
}

/// Print CLI help
fn print_help() {
    println!(
        r#"Proxymateur CLI & MCP Server (v{})

USAGE:
    proxymateur<COMMAND> [OPTIONS]

COMMANDS:
    accounts, list, ls          List all accounts with Gemini/Claude quotas
    quota [ACCOUNT]             Show detailed quota breakdown for current or specified account
    switch <ACCOUNT>            Switch active account (matches ID, email, or label)
    current, whoami             Show currently active account
    proxy [status|accounts|enable|disable]
                                Manage API proxy service and account rotation pool
    mcp, --mcp                  Run stdio Model Context Protocol (MCP) server for AI agents
    help, --help, -h            Show this help message
    version, --version, -v      Show application version

OPTIONS:
    --json                      Output results in structured JSON format
    --refresh                   Fetch fresh quota data from Google API
    --target <ide|classic|agy>  Target IDE/environment when switching accounts (default: auto)

EXAMPLES:
    proxymateuraccounts
    proxymateuraccounts --json
    proxymateurquota --refresh
    proxymateurswitch "my-label" --target ide
    proxymateurproxy status
    proxymateurproxy accounts
    proxymateurproxy disable "xianspired@gmail.com"
    proxymateurproxy enable "xianspired@gmail.com"
    proxymateurmcp
"#,
        env!("CARGO_PKG_VERSION")
    );
}

/// Execute CLI commands
pub async fn run_cli(args: Vec<String>) -> Result<(), String> {
    let subcommand = if args.len() > 1 {
        args[1].to_ascii_lowercase()
    } else {
        "help".to_string()
    };

    let is_json = args.iter().any(|a| a == "--json");
    let is_refresh = args.iter().any(|a| a == "--refresh");

    match subcommand.as_str() {
        "help" | "--help" | "-h" => {
            print_help();
            Ok(())
        }
        "version" | "--version" | "-v" => {
            println!("proxymateurv{}", env!("CARGO_PKG_VERSION"));
            Ok(())
        }
        "accounts" | "account" | "list" | "ls" => {
            let accounts = get_accounts_cli(is_refresh).await?;
            if is_json {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&accounts).map_err(|e| e.to_string())?
                );
            } else {
                println!(
                    "{:<3} {:<36} {:<30} {:<18} {:<10} {:<10} {:<12}",
                    "ACT", "ACCOUNT ID", "EMAIL", "LABEL", "GEMINI %", "CLAUDE %", "TIER"
                );
                println!("{}", "-".repeat(125));
                for a in &accounts {
                    let cur = if a.is_current { " * " } else { "   " };
                    let label = a.name.as_deref().unwrap_or("-");
                    let tier = a.subscription_tier.as_deref().unwrap_or("-");
                    let g_pct = a
                        .gemini_quota_pct
                        .map(|v| format!("{}%", v))
                        .unwrap_or_else(|| "-".to_string());
                    let c_pct = a
                        .claude_quota_pct
                        .map(|v| format!("{}%", v))
                        .unwrap_or_else(|| "-".to_string());

                    let tag = if a.has_opus55 { " [Opus 5.5]" } else { "" };
                    println!(
                        "{:<3} {:<36} {:<30} {:<18} {:<10} {:<10} {}{}",
                        cur, a.id, a.email, label, g_pct, c_pct, tier, tag
                    );
                }
            }
            Ok(())
        }
        "quota" | "quotas" => {
            let target_arg = args.iter().skip(2).find(|a| !a.starts_with("--")).cloned();

            let account = if let Some(query) = target_arg {
                let accounts = modules::account::list_accounts()?;
                let q_lower = query.to_lowercase();
                accounts
                    .into_iter()
                    .find(|a| {
                        a.id == query
                            || a.email.to_lowercase().contains(&q_lower)
                            || a.name
                                .as_deref()
                                .map(|n| n.to_lowercase().contains(&q_lower))
                                .unwrap_or(false)
                    })
                    .ok_or_else(|| format!("Account '{}' not found", query))?
            } else {
                let cur_id = modules::account::get_current_account_id()?
                    .ok_or_else(|| "No current account active".to_string())?;
                modules::account::load_account(&cur_id)?
            };

            let mut account = account;
            if is_refresh {
                if let Ok(quota) = modules::account::fetch_quota_with_retry(&mut account).await {
                    account.quota = Some(quota.clone());
                    let _ = modules::account::update_account_quota(&account.id, quota);
                }
            }

            if is_json {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&account.quota).map_err(|e| e.to_string())?
                );
            } else {
                println!("Account: {} ({})", account.email, account.id);
                if let Some(ref name) = account.name {
                    println!("Label:   {}", name);
                }
                if let Some(ref quota) = account.quota {
                    println!(
                        "Tier:    {}",
                        quota.subscription_tier.as_deref().unwrap_or("Unknown")
                    );
                    let dt = chrono::DateTime::from_timestamp_millis(quota.last_updated)
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_else(|| quota.last_updated.to_string());
                    println!("Updated: {}", dt);

                    if let Some(ref groups) = quota.quota_groups {
                        println!("\n--- Quota Groups ---");
                        for g in groups {
                            println!("[{}]", g.display_name);
                            for b in &g.buckets {
                                println!(
                                    "  - {:<10} {:>5.1}% remaining (Reset: {})",
                                    b.window,
                                    b.remaining_fraction * 100.0,
                                    b.reset_time
                                );
                            }
                        }
                    }

                    if !quota.models.is_empty() {
                        println!("\n--- Models Quota ---");
                        for m in &quota.models {
                            println!(
                                "  - {:<28} {:>3}%  (Reset: {})",
                                m.name, m.percentage, m.reset_time
                            );
                        }
                    }
                } else {
                    println!("No quota data cached. Use --refresh to fetch fresh quotas.");
                }
            }
            Ok(())
        }
        "switch" => {
            let target_arg = args
                .iter()
                .skip(2)
                .find(|a| !a.starts_with("--"))
                .cloned()
                .ok_or_else(|| "Missing account query. Usage: proxymateurswitch <id|email|label> [--target <ide|classic|agy>]".to_string())?;

            let mut target_ide: Option<&str> = None;
            for i in 2..args.len() {
                if args[i] == "--target" && i + 1 < args.len() {
                    target_ide = Some(args[i + 1].as_str());
                }
            }

            let switched = switch_account_cli(&target_arg, target_ide).await?;
            if is_json {
                println!(
                    "{}",
                    json!({
                        "success": true,
                        "account_id": switched.id,
                        "email": switched.email,
                        "name": switched.name,
                        "target_ide": target_ide.unwrap_or("auto")
                    })
                );
            } else {
                println!(
                    "Successfully switched to account: {} ({}) [Target: {}]",
                    switched.email,
                    switched.id,
                    target_ide.unwrap_or("auto")
                );
            }
            Ok(())
        }
        "current" | "whoami" => {
            let index = modules::account::load_account_index()?;
            let current_id = index.current_account_id;
            let target_ide = index.current_target_ide;

            if let Some(id) = current_id {
                let acc = modules::account::load_account(&id)?;
                let summary = extract_quota_summary(acc.quota.as_ref());
                if is_json {
                    println!(
                        "{}",
                        json!({
                            "id": acc.id,
                            "email": acc.email,
                            "name": acc.name,
                            "target_ide": target_ide,
                            "gemini_pct": summary.gemini_pct,
                            "claude_pct": summary.claude_pct,
                            "tier": acc.quota.as_ref().and_then(|q| q.subscription_tier.clone())
                        })
                    );
                } else {
                    println!("Active Account:");
                    println!("  ID:         {}", acc.id);
                    println!("  Email:      {}", acc.email);
                    if let Some(name) = acc.name {
                        println!("  Label:      {}", name);
                    }
                    println!("  Target IDE: {}", target_ide.as_deref().unwrap_or("auto"));
                    if let Some(g) = summary.gemini_pct {
                        println!("  Gemini Quota: {}%", g);
                    }
                    if let Some(c) = summary.claude_pct {
                        println!("  Claude Quota: {}%", c);
                    }
                }
            } else if is_json {
                println!("{}", json!({ "current": null }));
            } else {
                println!("No account is currently active.");
            }
            Ok(())
        }
        "proxy" => {
            let proxy_action = args
                .get(2)
                .map(|s| s.to_ascii_lowercase())
                .unwrap_or_else(|| "status".to_string());

            match proxy_action.as_str() {
                "status" => {
                    let status = get_proxy_status_cli().await?;
                    if is_json {
                        println!(
                            "{}",
                            serde_json::to_string_pretty(&status).map_err(|e| e.to_string())?
                        );
                    } else {
                        println!("Antigravity Proxy Service Status:");
                        println!(
                            "  Service:       {}",
                            if status.running { "RUNNING" } else { "STOPPED" }
                        );
                        println!("  Port:          {}", status.port);
                        println!("  Base URL:      {}", status.base_url);
                        println!("  API Key:       {}", status.api_key);
                        println!("  Pool Total:    {}", status.total_accounts);
                        println!("  Pool Active:   {}", status.active_accounts);
                        println!("  Pool Excluded: {}", status.disabled_accounts);
                    }
                    Ok(())
                }
                "accounts" | "list" | "ls" => {
                    let accounts = get_accounts_cli(is_refresh).await?;
                    if is_json {
                        println!(
                            "{}",
                            serde_json::to_string_pretty(&accounts).map_err(|e| e.to_string())?
                        );
                    } else {
                        println!(
                            "{:<3} {:<36} {:<28} {:<10} {:<10} {:<14} {:<25}",
                            "ACT",
                            "ACCOUNT ID",
                            "EMAIL",
                            "GEMINI %",
                            "CLAUDE %",
                            "PROXY ROTATION",
                            "REASON"
                        );
                        println!("{}", "-".repeat(130));
                        for a in &accounts {
                            let cur = if a.is_current { " * " } else { "   " };
                            let g_pct = a
                                .gemini_quota_pct
                                .map(|v| format!("{}%", v))
                                .unwrap_or_else(|| "-".to_string());
                            let c_pct = a
                                .claude_quota_pct
                                .map(|v| format!("{}%", v))
                                .unwrap_or_else(|| "-".to_string());
                            let (proxy_status, reason) = if a.disabled {
                                ("DISABLED", "Account disabled")
                            } else if a.proxy_disabled {
                                (
                                    "EXCLUDED",
                                    a.proxy_disabled_reason
                                        .as_deref()
                                        .unwrap_or("Excluded by user"),
                                )
                            } else {
                                ("ACTIVE", "-")
                            };

                            println!(
                                "{:<3} {:<36} {:<28} {:<10} {:<10} {:<14} {:<25}",
                                cur, a.id, a.email, g_pct, c_pct, proxy_status, reason
                            );
                        }
                    }
                    Ok(())
                }
                "enable" => {
                    let account_query = args.get(3).ok_or_else(|| {
                        "Missing account query. Usage: proxymateurproxy enable <id|email|label>"
                            .to_string()
                    })?;

                    let acc = toggle_proxy_cli(account_query, true, None).await?;
                    if is_json {
                        println!(
                            "{}",
                            json!({
                                "success": true,
                                "account_id": acc.id,
                                "email": acc.email,
                                "proxy_disabled": false,
                                "message": format!("Account {} enabled for proxy rotation", acc.email)
                            })
                        );
                    } else {
                        println!(
                            "Successfully enabled account '{}' ({}) for proxy rotation.",
                            acc.email, acc.id
                        );
                    }
                    Ok(())
                }
                "disable" => {
                    let account_query = args
                        .get(3)
                        .ok_or_else(|| "Missing account query. Usage: proxymateurproxy disable <id|email|label> [reason]".to_string())?;

                    let reason = if args.len() > 4 {
                        let r = args.iter().skip(4).cloned().collect::<Vec<_>>().join(" ");
                        if r.trim().is_empty() {
                            "Disabled via CLI".to_string()
                        } else {
                            r
                        }
                    } else {
                        "Disabled via CLI".to_string()
                    };

                    let acc = toggle_proxy_cli(account_query, false, Some(&reason)).await?;
                    if is_json {
                        println!(
                            "{}",
                            json!({
                                "success": true,
                                "account_id": acc.id,
                                "email": acc.email,
                                "proxy_disabled": true,
                                "proxy_disabled_reason": acc.proxy_disabled_reason,
                                "message": format!("Account {} excluded from proxy rotation", acc.email)
                            })
                        );
                    } else {
                        println!(
                            "Successfully excluded account '{}' ({}) from proxy rotation. (Reason: {})",
                            acc.email,
                            acc.id,
                            acc.proxy_disabled_reason.as_deref().unwrap_or(&reason)
                        );
                    }
                    Ok(())
                }
                other => {
                    eprintln!("Unknown proxy subcommand: '{}'\n", other);
                    println!("Usage: proxymateurproxy [status | accounts | enable <account> | disable <account> [reason]]");
                    Err(format!("Unknown proxy subcommand: {}", other))
                }
            }
        }
        "mcp" | "--mcp" => run_mcp_server().await,
        other => {
            eprintln!("Unknown command: '{}'\n", other);
            print_help();
            Err(format!("Unknown command: {}", other))
        }
    }
}

/// Run stdio Model Context Protocol (MCP) server
pub async fn run_mcp_server() -> Result<(), String> {
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

    let stdin = tokio::io::stdin();
    let mut reader = BufReader::new(stdin).lines();
    let mut stdout = tokio::io::stdout();

    while let Ok(Some(line)) = reader.next_line().await {
        let trimmed =
            line.trim_matches(|c: char| c.is_whitespace() || c == '\u{feff}' || c == '\0');
        if trimmed.is_empty() {
            continue;
        }

        let parsed: serde_json::Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(e) => {
                let err_resp = json!({
                    "jsonrpc": "2.0",
                    "id": null,
                    "error": {
                        "code": -32700,
                        "message": format!("Parse error: {}", e)
                    }
                });
                let _ = stdout.write_all(format!("{}\n", err_resp).as_bytes()).await;
                let _ = stdout.flush().await;
                continue;
            }
        };

        let id = parsed.get("id").cloned();
        let method = parsed
            .get("method")
            .and_then(|m| m.as_str())
            .unwrap_or_default();

        match method {
            "initialize" => {
                let resp = json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {
                            "tools": {}
                        },
                        "serverInfo": {
                            "name": "proxymateur",
                            "version": env!("CARGO_PKG_VERSION")
                        }
                    }
                });
                let _ = stdout.write_all(format!("{}\n", resp).as_bytes()).await;
                let _ = stdout.flush().await;
            }
            "notifications/initialized" => {
                // Client acknowledged initialization, no response needed
            }
            "ping" => {
                let resp = json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": {}
                });
                let _ = stdout.write_all(format!("{}\n", resp).as_bytes()).await;
                let _ = stdout.flush().await;
            }
            "tools/list" => {
                let resp = json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": {
                        "tools": [
                            {
                                "name": "list_accounts",
                                "description": "List all configured Antigravity accounts, active status, subscription tiers, and Gemini/Claude quota summaries (Opus 5.5 labeled accounts pinned to bottom).",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "refresh": {
                                            "type": "boolean",
                                            "description": "Whether to fetch fresh quotas from Google API (default: false)"
                                        }
                                    }
                                }
                            },
                            {
                                "name": "read_quotas",
                                "description": "Read detailed quota percentages, reset countdowns, model limits, and quota groups for a specific account or current active account.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "account_id": {
                                            "type": "string",
                                            "description": "Account ID, email address, or label. Defaults to current active account."
                                        },
                                        "refresh": {
                                            "type": "boolean",
                                            "description": "Whether to fetch fresh quotas from Google API (default: false)"
                                        }
                                    }
                                }
                            },
                            {
                                "name": "switch_account",
                                "description": "Switch the active Antigravity account for Antigravity IDE, Native client, or agy CLI. Updates credentials in system keyring/database and hot-swaps language server.",
                                "inputSchema": {
                                    "type": "object",
                                    "required": ["account_id"],
                                    "properties": {
                                        "account_id": {
                                            "type": "string",
                                            "description": "Account ID, email address, or label to switch to."
                                        },
                                        "target": {
                                            "type": "string",
                                            "enum": ["ide", "classic", "agy", "auto"],
                                            "description": "Target environment: 'ide' for Antigravity IDE, 'classic' for Native client, 'agy' for CLI, or 'auto' (default: 'auto')."
                                        }
                                    }
                                }
                            },
                            {
                                "name": "get_current_account",
                                "description": "Get the currently active Antigravity account and its quota information.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {}
                                }
                            },
                            {
                                "name": "get_proxy_status",
                                "description": "Get the Antigravity API proxy service status (running state, port, base URL, API key, and active/disabled account pool counts).",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {}
                                }
                            },
                            {
                                "name": "list_proxy_accounts",
                                "description": "List all accounts with their API proxy rotation status (active vs excluded), reasons for exclusion, and quota percentages.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "refresh": {
                                            "type": "boolean",
                                            "description": "Whether to fetch fresh quotas from Google API (default: false)"
                                        }
                                    }
                                }
                            },
                            {
                                "name": "toggle_proxy_account",
                                "description": "Enable or exclude an account from the Antigravity API proxy rotation pool. Dynamically updates memory of running proxy daemon without restarting.",
                                "inputSchema": {
                                    "type": "object",
                                    "required": ["account_id", "enabled"],
                                    "properties": {
                                        "account_id": {
                                            "type": "string",
                                            "description": "Account ID, email address, or label."
                                        },
                                        "enabled": {
                                            "type": "boolean",
                                            "description": "true to include account in proxy rotation pool, false to exclude/disable."
                                        },
                                        "reason": {
                                            "type": "string",
                                            "description": "Optional reason when excluding/disabling the account (e.g. 'Personal quota reserved')."
                                        }
                                    }
                                }
                            }
                        ]
                    }
                });
                let _ = stdout.write_all(format!("{}\n", resp).as_bytes()).await;
                let _ = stdout.flush().await;
            }
            "tools/call" => {
                let params = parsed.get("params").cloned().unwrap_or(json!({}));
                let name = params
                    .get("name")
                    .and_then(|n| n.as_str())
                    .unwrap_or_default();
                let args = params.get("arguments").cloned().unwrap_or(json!({}));

                let (text_out, is_err) = match name {
                    "list_accounts" => {
                        let refresh = args
                            .get("refresh")
                            .and_then(|r| r.as_bool())
                            .unwrap_or(false);
                        match get_accounts_cli(refresh).await {
                            Ok(accounts) => (
                                serde_json::to_string_pretty(&accounts).unwrap_or_default(),
                                false,
                            ),
                            Err(e) => (format!("Error listing accounts: {}", e), true),
                        }
                    }
                    "read_quotas" => {
                        let refresh = args
                            .get("refresh")
                            .and_then(|r| r.as_bool())
                            .unwrap_or(false);
                        let account_query = args.get("account_id").and_then(|a| a.as_str());

                        let target_acc = if let Some(query) = account_query {
                            match modules::account::list_accounts() {
                                Ok(accounts) => {
                                    let q_lower = query.to_lowercase();
                                    accounts.into_iter().find(|a| {
                                        a.id == query
                                            || a.email.to_lowercase().contains(&q_lower)
                                            || a.name
                                                .as_deref()
                                                .map(|n| n.to_lowercase().contains(&q_lower))
                                                .unwrap_or(false)
                                    })
                                }
                                Err(e) => {
                                    let _ = stdout.write_all(
                                        format!("{}\n", json!({
                                            "jsonrpc": "2.0",
                                            "id": id,
                                            "result": {
                                                "content": [{ "type": "text", "text": format!("Error reading accounts: {}", e) }],
                                                "isError": true
                                            }
                                        })).as_bytes()
                                    ).await;
                                    let _ = stdout.flush().await;
                                    continue;
                                }
                            }
                        } else {
                            match modules::account::get_current_account_id() {
                                Ok(Some(cur_id)) => modules::account::load_account(&cur_id).ok(),
                                _ => None,
                            }
                        };

                        if let Some(mut acc) = target_acc {
                            if refresh {
                                if let Ok(quota) =
                                    modules::account::fetch_quota_with_retry(&mut acc).await
                                {
                                    acc.quota = Some(quota.clone());
                                    let _ = modules::account::update_account_quota(&acc.id, quota);
                                }
                            }
                            (
                                serde_json::to_string_pretty(&json!({
                                    "id": acc.id,
                                    "email": acc.email,
                                    "name": acc.name,
                                    "quota": acc.quota
                                }))
                                .unwrap_or_default(),
                                false,
                            )
                        } else {
                            ("No account found to read quotas for".to_string(), true)
                        }
                    }
                    "switch_account" => {
                        let account_id = args
                            .get("account_id")
                            .and_then(|a| a.as_str())
                            .unwrap_or_default();
                        let target_ide = args.get("target").and_then(|t| t.as_str());

                        match switch_account_cli(account_id, target_ide).await {
                            Ok(acc) => (
                                serde_json::to_string_pretty(&json!({
                                    "success": true,
                                    "switched_to": {
                                        "id": acc.id,
                                        "email": acc.email,
                                        "name": acc.name,
                                        "target": target_ide.unwrap_or("auto")
                                    }
                                }))
                                .unwrap_or_default(),
                                false,
                            ),
                            Err(e) => (format!("Error switching account: {}", e), true),
                        }
                    }
                    "get_current_account" => match modules::account::load_account_index() {
                        Ok(index) => {
                            if let Some(cur_id) = index.current_account_id {
                                match modules::account::load_account(&cur_id) {
                                    Ok(acc) => {
                                        let summary = extract_quota_summary(acc.quota.as_ref());
                                        (
                                                serde_json::to_string_pretty(&json!({
                                                    "id": acc.id,
                                                    "email": acc.email,
                                                    "name": acc.name,
                                                    "target_ide": index.current_target_ide,
                                                    "gemini_quota_pct": summary.gemini_pct,
                                                    "claude_quota_pct": summary.claude_pct,
                                                    "tier": acc.quota.as_ref().and_then(|q| q.subscription_tier.clone())
                                                }))
                                                .unwrap_or_default(),
                                                false,
                                            )
                                    }
                                    Err(e) => {
                                        (format!("Failed to load current account: {}", e), true)
                                    }
                                }
                            } else {
                                (json!({ "current_account": null }).to_string(), false)
                            }
                        }
                        Err(e) => (format!("Failed to load account index: {}", e), true),
                    },
                    "get_proxy_status" => match get_proxy_status_cli().await {
                        Ok(status) => (
                            serde_json::to_string_pretty(&status).unwrap_or_default(),
                            false,
                        ),
                        Err(e) => (format!("Error getting proxy status: {}", e), true),
                    },
                    "list_proxy_accounts" => {
                        let refresh = args
                            .get("refresh")
                            .and_then(|r| r.as_bool())
                            .unwrap_or(false);
                        match get_accounts_cli(refresh).await {
                            Ok(accounts) => (
                                serde_json::to_string_pretty(&accounts).unwrap_or_default(),
                                false,
                            ),
                            Err(e) => (format!("Error listing proxy accounts: {}", e), true),
                        }
                    }
                    "toggle_proxy_account" => {
                        let account_id = args
                            .get("account_id")
                            .and_then(|a| a.as_str())
                            .unwrap_or_default();
                        let enabled = args
                            .get("enabled")
                            .and_then(|e| e.as_bool())
                            .unwrap_or(true);
                        let reason = args.get("reason").and_then(|r| r.as_str());

                        match toggle_proxy_cli(account_id, enabled, reason).await {
                            Ok(acc) => (
                                serde_json::to_string_pretty(&json!({
                                    "success": true,
                                    "account_id": acc.id,
                                    "email": acc.email,
                                    "name": acc.name,
                                    "proxy_disabled": acc.proxy_disabled,
                                    "proxy_disabled_reason": acc.proxy_disabled_reason,
                                    "message": if enabled {
                                        format!("Account {} enabled for proxy rotation", acc.email)
                                    } else {
                                        format!("Account {} excluded from proxy rotation", acc.email)
                                    }
                                }))
                                .unwrap_or_default(),
                                false,
                            ),
                            Err(e) => {
                                (format!("Error toggling proxy status for account: {}", e), true)
                            }
                        }
                    }
                    unknown => (format!("Unknown tool: {}", unknown), true),
                };

                let resp = json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": {
                        "content": [
                            {
                                "type": "text",
                                "text": text_out
                            }
                        ],
                        "isError": is_err
                    }
                });
                let _ = stdout.write_all(format!("{}\n", resp).as_bytes()).await;
                let _ = stdout.flush().await;
            }
            _ => {
                if id.is_some() {
                    let resp = json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "error": {
                            "code": -32601,
                            "message": format!("Method not found: {}", method)
                        }
                    });
                    let _ = stdout.write_all(format!("{}\n", resp).as_bytes()).await;
                    let _ = stdout.flush().await;
                }
            }
        }
    }

    Ok(())
}
