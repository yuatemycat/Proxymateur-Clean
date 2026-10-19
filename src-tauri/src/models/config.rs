use crate::modules::cloudflared::CloudflaredConfig;
use crate::proxy::ProxyConfig;
use serde::{Deserialize, Serialize};

/// Application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub language: String,
    pub theme: String,
    pub auto_refresh: bool,
    pub refresh_interval: i32, // minutes
    pub auto_sync: bool,
    pub sync_interval: i32, // minutes
    pub default_export_path: Option<String>,
    #[serde(default)]
    pub proxy: ProxyConfig,
    pub antigravity_executable: Option<String>, // [NEW] Manually specified Antigravity executable path
    pub antigravity_ide_executable: Option<String>, // [NEW] Manually specified Antigravity IDE executable path
    pub antigravity_cli_executable: Option<String>, // [NEW] Manually specified Antigravity CLI (agy) path
    pub gemini_desktop_executable: Option<String>, // [NEW] Manually specified Google Gemini Desktop path
    pub antigravity_args: Option<Vec<String>>,     // [NEW] Antigravity startup arguments
    #[serde(default)]
    pub auto_launch: bool,    // Launch on startup
    /// Login-item launches stay in the tray. Missing values stay on so existing
    /// autostart entries, which already pass `--minimized`, keep that behavior.
    #[serde(default = "default_quiet_autostart")]
    pub quiet_autostart: bool,
    #[serde(default)]
    pub scheduled_warmup: ScheduledWarmupConfig, // [NEW] Scheduled warmup configuration
    #[serde(default)]
    pub quota_protection: QuotaProtectionConfig, // [NEW] Quota protection configuration
    #[serde(default)]
    pub pinned_quota_models: PinnedQuotaModelsConfig, // [NEW] Pinned quota models list
    #[serde(default)]
    pub circuit_breaker: CircuitBreakerConfig, // [NEW] Circuit breaker configuration
    #[serde(default)]
    pub low_quota_alert: LowQuotaAlertConfig, // [NEW] Low quota alert configuration
    #[serde(default)]
    pub hidden_menu_items: Vec<String>, // Hidden menu item path list
    #[serde(default)]
    pub cloudflared: CloudflaredConfig, // [NEW] Cloudflared configuration
    #[serde(default)]
    pub lightweight_mode: bool, // [NEW] Lightweight mode: destroy webview on minimize/close to tray
    #[serde(default)]
    pub suggestion_delete_thinking_store: Option<bool>, // [NEW] 建议删除历史思考块缓存开关
    #[serde(default)]
    pub thinking_cleanup_dismissed: Option<bool>, // [NEW] 用户是否已确认/忽略该建议
    #[serde(default)]
    pub dismissed_thinking_cleanup_version: Option<String>, // [NEW] 用户已确认或忽略建议的目标版本号
    #[serde(default)]
    pub multi_instance_mode: bool, // [NEW] 多开模式：切换 2.0 GUI 时启动新窗口而不关闭旧窗口
    #[serde(default)]
    pub antigravity_lab: AntigravityLabConfig,
    #[serde(default)]
    pub oauth: OAuthConfig,
}

fn default_quiet_autostart() -> bool {
    true
}

/// Custom OAuth client entry (BYO OAuth)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CustomOAuthClient {
    pub key: String,
    pub label: String,
    pub client_id: String,
    pub client_secret: String,
}

/// OAuth configuration supporting built-in and custom BYO credentials
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OAuthConfig {
    /// Whether to enable the built-in official Google OAuth client
    #[serde(default = "default_enable_builtin_oauth")]
    pub enable_builtin: bool,
    /// List of custom BYO OAuth clients
    #[serde(default)]
    pub custom_clients: Vec<CustomOAuthClient>,
    /// Optional active default OAuth client key
    #[serde(default)]
    pub active_client_key: Option<String>,
}

fn default_enable_builtin_oauth() -> bool {
    true
}

impl Default for OAuthConfig {
    fn default() -> Self {
        Self {
            enable_builtin: true,
            custom_clients: Vec::new(),
            active_client_key: None,
        }
    }
}

/// Scheduled warmup configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledWarmupConfig {
    /// Whether smart warmup is enabled
    pub enabled: bool,

    /// List of models to warmup
    #[serde(default = "default_warmup_models")]
    pub monitored_models: Vec<String>,

    /// Whether 5-hour rolling window auto-warmup is enabled
    #[serde(default = "default_enable_5h_warmup")]
    pub enable_5h_warmup: bool,
}

fn default_enable_5h_warmup() -> bool {
    true
}

fn default_warmup_models() -> Vec<String> {
    vec![
        "gemini-3-flash".to_string(),
        "claude".to_string(),
        "gemini-3-pro-high".to_string(),
        "gemini-3.1-flash-image".to_string(),
    ]
}

impl ScheduledWarmupConfig {
    pub fn new() -> Self {
        Self {
            enabled: false,
            monitored_models: default_warmup_models(),
            enable_5h_warmup: true,
        }
    }
}

impl Default for ScheduledWarmupConfig {
    fn default() -> Self {
        Self::new()
    }
}

/// Quota protection configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuotaProtectionConfig {
    /// Whether quota protection is enabled
    pub enabled: bool,

    /// Reserved quota percentage (1-99)
    pub threshold_percentage: u32,

    /// List of monitored models (e.g. gemini-3-flash, gemini-3-pro-high, gemini-3.1-pro-high, claude-sonnet-4-6)
    #[serde(default = "default_monitored_models")]
    pub monitored_models: Vec<String>,
}

fn default_monitored_models() -> Vec<String> {
    vec![
        "claude".to_string(),
        "gemini-3-pro-high".to_string(),
        "gemini-3-flash".to_string(),
        "gemini-3.1-flash-image".to_string(),
    ]
}

impl QuotaProtectionConfig {
    pub fn new() -> Self {
        Self {
            enabled: false,
            threshold_percentage: 10, // Default 10% reserve
            monitored_models: default_monitored_models(),
        }
    }
}

impl Default for QuotaProtectionConfig {
    fn default() -> Self {
        Self::new()
    }
}

/// Pinned quota models configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PinnedQuotaModelsConfig {
    /// List of pinned models (displayed outside the account list)
    #[serde(default = "default_pinned_models")]
    pub models: Vec<String>,
}

fn default_pinned_models() -> Vec<String> {
    vec![
        "gemini-3-pro-high".to_string(),
        "gemini-3-flash".to_string(),
        "gemini-3.1-flash-image".to_string(),
        "claude-sonnet-5-5-high".to_string(),
    ]
}

impl PinnedQuotaModelsConfig {
    pub fn new() -> Self {
        Self {
            models: default_pinned_models(),
        }
    }
}

impl Default for PinnedQuotaModelsConfig {
    fn default() -> Self {
        Self::new()
    }
}

/// Circuit breaker configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitBreakerConfig {
    /// Whether circuit breaker is enabled
    pub enabled: bool,

    /// Unified backoff steps (seconds)
    /// Default: [60, 300, 1800, 7200]
    #[serde(default = "default_backoff_steps")]
    pub backoff_steps: Vec<u64>,

    /// Optional 5h zero-quota lock; exhausted weekly quota always blocks scheduling.
    #[serde(default = "default_lock_on_zero_quota")]
    pub lock_on_zero_quota: bool,
}

fn default_backoff_steps() -> Vec<u64> {
    vec![60, 300, 1800, 7200]
}

fn default_lock_on_zero_quota() -> bool {
    false
}

impl CircuitBreakerConfig {
    pub fn new() -> Self {
        Self {
            enabled: true,
            backoff_steps: default_backoff_steps(),
            lock_on_zero_quota: false,
        }
    }
}

impl Default for CircuitBreakerConfig {
    fn default() -> Self {
        Self::new()
    }
}

/// Low quota alert configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LowQuotaAlertConfig {
    /// Whether low quota alert is enabled
    pub enabled: bool,
    /// Alert threshold percentage (e.g. 20)
    #[serde(default = "default_low_quota_threshold")]
    pub threshold_percentage: u32,
    /// Whether to trigger system desktop notification
    #[serde(default = "default_low_quota_notify_system")]
    pub notify_system: bool,
}

fn default_low_quota_threshold() -> u32 {
    20
}

fn default_low_quota_notify_system() -> bool {
    true
}

impl LowQuotaAlertConfig {
    pub fn new() -> Self {
        Self {
            enabled: true,
            threshold_percentage: 20,
            notify_system: true,
        }
    }
}

impl Default for LowQuotaAlertConfig {
    fn default() -> Self {
        Self::new()
    }
}

/// Antigravity Lab configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AntigravityLabConfig {
    #[serde(default)]
    pub enable_owl_slash_command: bool,
    #[serde(default)]
    pub jetski_autonomous_mode: bool,
    #[serde(default)]
    pub disable_teamwork_forced_flash_model: bool,
    #[serde(default)]
    pub jetski_generative_ui: bool,
    #[serde(default)]
    pub enable_battle_mode: bool,
    #[serde(default)]
    pub enable_subagent_hub: bool,
    #[serde(default)]
    pub enable_programmatic_tools: bool,
    #[serde(default)]
    pub enable_battle_mode_custom_agents: bool,
    #[serde(default)]
    pub enable_persistent_terminals: bool,
    #[serde(default)]
    pub enable_browser_subagent_v2: bool,
    #[serde(default)]
    pub enable_command_antivirus: bool,
    #[serde(default)]
    pub enable_fork_with_subagents: bool,
    #[serde(default)]
    pub enable_swarm_narrator: bool,
    #[serde(default)]
    pub enable_voice_activity_events: bool,
    #[serde(default)]
    pub disable_stained_loas2_creds: bool,
    #[serde(default)]
    pub enable_deepagent: bool,
    #[serde(default)]
    pub enable_review: bool,
    #[serde(default)]
    pub enable_image_generator_subagent: bool,
    #[serde(default)]
    pub enable_sidecars: bool,
    #[serde(default)]
    pub enable_ui_sidecars: bool,
    #[serde(default)]
    pub enable_sidecar_sdk: bool,
    #[serde(default)]
    pub sidecar_gateway: bool,
    #[serde(default)]
    pub sidecar_iframe_prewarm: bool,
    #[serde(default)]
    pub enable_swarm_monitor: bool,
    #[serde(default)]
    pub enable_ripgrep_path_search: bool,
    #[serde(default)]
    pub enable_pty: bool,
    #[serde(default)]
    pub enable_wait_tool: bool,
    #[serde(default)]
    pub cortex_snapshot_recording: bool,
    #[serde(default)]
    pub cortex_snapshot_revert: bool,
    #[serde(default)]
    pub enable_remote_agent_fastpush_pin: bool,
    #[serde(default)]
    pub enable_conversation_search_v2: bool,
    #[serde(default)]
    pub cascade_enable_notebook_edit_tool: bool,
    #[serde(default)]
    pub cascade_use_sed_edit_tool: bool,
    #[serde(default)]
    pub enable_model_capacity_exhausted_retries: bool,
    #[serde(default)]
    pub enable_mcp_non_blocking_turn_load: bool,
}

impl Default for AntigravityLabConfig {
    fn default() -> Self {
        Self {
            enable_owl_slash_command: false,
            jetski_autonomous_mode: false,
            disable_teamwork_forced_flash_model: false,
            jetski_generative_ui: false,
            enable_battle_mode: false,
            enable_subagent_hub: false,
            enable_programmatic_tools: false,
            enable_battle_mode_custom_agents: false,
            enable_persistent_terminals: false,
            enable_browser_subagent_v2: false,
            enable_command_antivirus: false,
            enable_fork_with_subagents: false,
            enable_swarm_narrator: false,
            enable_voice_activity_events: false,
            disable_stained_loas2_creds: false,
            enable_deepagent: false,
            enable_review: false,
            enable_image_generator_subagent: false,
            enable_sidecars: false,
            enable_ui_sidecars: false,
            enable_sidecar_sdk: false,
            sidecar_gateway: false,
            sidecar_iframe_prewarm: false,
            enable_swarm_monitor: false,
            enable_ripgrep_path_search: false,
            enable_pty: false,
            enable_wait_tool: false,
            cortex_snapshot_recording: false,
            cortex_snapshot_revert: false,
            enable_remote_agent_fastpush_pin: false,
            enable_conversation_search_v2: false,
            cascade_enable_notebook_edit_tool: false,
            cascade_use_sed_edit_tool: false,
            enable_model_capacity_exhausted_retries: false,
            enable_mcp_non_blocking_turn_load: false,
        }
    }
}

impl AppConfig {
    pub fn new() -> Self {
        Self {
            language: crate::modules::i18n::default_language(),
            theme: "system".to_string(),
            auto_refresh: true,
            refresh_interval: 15,
            auto_sync: false,
            sync_interval: 5,
            default_export_path: None,
            proxy: ProxyConfig::default(),
            antigravity_executable: None,
            antigravity_ide_executable: None,
            antigravity_cli_executable: None,
            gemini_desktop_executable: None,
            antigravity_args: None,
            auto_launch: false,
            quiet_autostart: true,
            scheduled_warmup: ScheduledWarmupConfig::default(),
            quota_protection: QuotaProtectionConfig::default(),
            pinned_quota_models: PinnedQuotaModelsConfig::default(),
            circuit_breaker: CircuitBreakerConfig::default(),
            low_quota_alert: LowQuotaAlertConfig::default(),
            hidden_menu_items: Vec::new(),
            cloudflared: CloudflaredConfig::default(),
            lightweight_mode: false,
            suggestion_delete_thinking_store: None,
            thinking_cleanup_dismissed: None,
            dismissed_thinking_cleanup_version: None,
            multi_instance_mode: false,
            antigravity_lab: AntigravityLabConfig::default(),
            oauth: OAuthConfig::default(),
        }
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::AppConfig;

    #[test]
    fn saved_language_is_preserved_when_loading_config() {
        let mut config = AppConfig::new();
        for language in ["en", "zh", "zh-TW", "ru"] {
            config.language = language.to_string();
            let saved = serde_json::to_string(&config).unwrap();
            let restored: AppConfig = serde_json::from_str(&saved).unwrap();
            assert_eq!(restored.language, language);
        }
    }

    #[test]
    fn quiet_autostart_defaults_to_true_when_missing() {
        let mut config = AppConfig::new();
        config.quiet_autostart = false;
        let mut value = serde_json::to_value(&config).unwrap();
        value.as_object_mut().unwrap().remove("quiet_autostart");
        let restored: AppConfig = serde_json::from_value(value).unwrap();
        assert!(restored.quiet_autostart);

        let saved = serde_json::to_string(&config).unwrap();
        let restored: AppConfig = serde_json::from_str(&saved).unwrap();
        assert!(!restored.quiet_autostart);
    }
}
