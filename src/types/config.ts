export interface UpstreamProxyConfig {
    enabled: boolean;
    url: string;
}

export interface ProxyConfig {
    enabled: boolean;
    allow_lan_access?: boolean;
    auth_mode?: 'off' | 'strict' | 'all_except_health' | 'auto';
    port: number;
    api_key: string;
    admin_password?: string;
    auto_start: boolean;
    custom_mapping?: Record<string, string>;
    disabled_custom_mappings?: string[];
    request_timeout: number;
    enable_logging: boolean;
    capture_health_logs?: boolean;
    log_retention?: LogRetentionConfig;
    internal_error_log_retention?: InternalErrorLogRetentionConfig;
    debug_logging?: DebugLoggingConfig;
    upstream_proxy: UpstreamProxyConfig;
    scheduling?: StickySessionConfig;
    experimental?: ExperimentalConfig;
    user_agent_override?: string;
    saved_user_agent?: string;
    thinking_budget?: ThinkingBudgetConfig;
    global_system_prompt?: GlobalSystemPromptConfig;
    demon?: DemonConfig;
    allow_standard_gemini_models?: boolean;
    image_thinking_mode?: 'enabled' | 'disabled'; // [NEW] 图像思维模式开关
    only_raw_quota_models?: boolean; // [NEW] 是否只暴露真实配额模型
    proxy_pool?: ProxyPoolConfig;
    multimodal?: MultimodalConfig;
    vertex?: VertexConfig;
    gateway_routing_mode?: 'all' | 'argon_only';
    openai?: OpenAiUpstreamConfig;
}

export interface OpenAiRoute {
    model_id: string;
    upstream_model?: string;
    base_url?: string;
    api_key?: string;
    timeout_secs?: number;
}

export interface OpenAiUpstreamConfig {
    enabled: boolean;
    default_base_url: string;
    default_api_key: string;
    default_timeout_secs: number;
    routes: OpenAiRoute[];
    auto_route_prefix?: string;
}

/** Vertex AI 直连上游：命中映射的模型走用户自己的 GCP 项目 */
export interface VertexConfig {
    enabled: boolean;
    project_id: string;
    location: string;
    credentials_path?: string | null;
    /** 哪些模型走 Vertex：default 只有 Gemini 3.8 Flash，picker 为下面两项自选 */
    model_mode?: 'default' | 'picker';
    /** 客户端模型名 -> Vertex 模型 ID（键支持结尾 * 通配）；仅 picker 模式生效 */
    model_mapping: Record<string, string>;
    /** 以自身 ID 展示给客户端并直连 Vertex 的模型（从云端列表勾选）；仅 picker 模式生效 */
    exposed_models?: string[];
    /** 命中 Vertex 路由的模型先用哪一边；另一边作为回退 */
    preference?: 'vertex_first' | 'accounts_first';
}

export interface MultimodalConfig {
    enable_sliding_window?: boolean;
    strategy?: 'count' | 'memory';
    max_fresh_images?: number;
    strip_remote_urls?: boolean;
    max_total_image_mb?: number;
}

export interface LogRetentionConfig {
    max_body_age_hours: number;
    max_storage_gb: number;
    max_disk_mb?: number;
    max_rows: number;
    max_age_days?: number;
}

export interface InternalErrorLogRetentionConfig {
    max_storage_mb: number;
}


// ============================================================================
// Thinking Budget 配置 (控制 AI 深度思考时的 Token 预算)
// ============================================================================

/** 思考预算控制权归属 */
export type ThinkingControlSource = 'gateway' | 'client';

/** Thinking Budget 处理模式 */
export type ThinkingBudgetMode = 'default' | 'custom' | 'auto' | 'passthrough' | 'adaptive';

/** Thinking Effort 等级 (仅 adaptive 模式) */
export type ThinkingEffort = 'low' | 'medium' | 'high';

/** Thinking Budget 配置 */
export interface ThinkingBudgetConfig {
    /** 控制权大选择：网关权威控制 (gateway) vs 客户端直接控制 (client) */
    control_source?: ThinkingControlSource;

    // --- Gemini Flash 系列配置 ---
    flash_mode?: ThinkingBudgetMode;
    flash_low?: number;       // 默认 1000
    flash_medium?: number;    // 默认 4000
    flash_high?: number;      // 默认 -1，走官方模型结构体
    flash_tiered?: number;    // 默认 -1

    // --- Gemini Pro 系列配置（官方仅 Low 与 High 两档） ---
    pro_mode?: ThinkingBudgetMode;
    pro_low?: number;         // 默认 1001
    pro_high?: number;        // 默认 10001

    // --- Claude 系列配置 ---
    claude_mode?: ThinkingBudgetMode;
    claude_budget?: number;    // 统一思考预算 (默认 16000, 填 -1 自适应)
    claude_low?: number;       // 默认 1024
    claude_medium?: number;    // 默认 4096
    claude_high?: number;      // 默认 16000

    // --- 旧版兼容字段 ---
    mode?: ThinkingBudgetMode;
    custom_value?: number;
    effort?: ThinkingEffort;
    custom_low?: number;
    custom_medium?: number;
    custom_high?: number;
    custom_tiered?: number;
}

// ============================================================================
// 全局系统提示词配置
// ============================================================================

/** 全局系统提示词配置 */
export interface GlobalSystemPromptConfig {
    /** 是否启用 */
    enabled: boolean;
    /** 提示词内容 */
    content: string;
}

/** DEMON 模式配置 (Autonomous Diagnostics & Safety Shim) */
export interface DemonConfig {
    /** 是否启用 DEMON 模式 */
    enabled: boolean;
    /** 是否自动净化高危敏感词元 */
    decontaminate?: boolean;
    /** 是否自动注入自主工程身份与高权限免确认提示词 */
    autonomous_persona?: boolean;
    /** 自定义附加规则 */
    custom_rules?: string;
}


export interface DebugLoggingConfig {
    enabled: boolean;
    output_dir?: string;
}

export type SchedulingMode = 'CacheFirst' | 'Balance' | 'PerformanceFirst';

export interface StickySessionConfig {
    mode: SchedulingMode;
    max_wait_seconds: number;
}

export interface ScheduledWarmupConfig {
    enabled: boolean;
    monitored_models: string[];
    enable_5h_warmup?: boolean;
}

export interface QuotaProtectionConfig {
    enabled: boolean;
    threshold_percentage: number; // 1-99
    monitored_models: string[];
}

export interface PinnedQuotaModelsConfig {
    models: string[];
}

export interface ExperimentalConfig {
    enable_usage_scaling: boolean;
    payload_storage_mode?: 'simple' | 'full';
    log_retention_days?: number;
    thinking_store_enabled?: boolean;
    thinking_retention_days?: number;
    thinking_max_memory_turns?: number;
    enable_cowork_auto_compact?: boolean;
    cowork_compact_threshold?: number;
    enable_agy_auto_compact?: boolean;
    agy_compact_threshold?: number;
}

export interface CircuitBreakerConfig {
    enabled: boolean;
    backoff_steps: number[];
    lock_on_zero_quota?: boolean;
}

export interface LowQuotaAlertConfig {
    enabled: boolean;
    threshold_percentage: number;
    notify_system: boolean;
}

export interface AntigravityLabConfig {
    enable_owl_slash_command: boolean;
    jetski_autonomous_mode: boolean;
    disable_teamwork_forced_flash_model: boolean;
    jetski_generative_ui: boolean;
    enable_battle_mode: boolean;
    enable_subagent_hub: boolean;
    enable_programmatic_tools: boolean;
    enable_battle_mode_custom_agents: boolean;
    enable_persistent_terminals: boolean;
    enable_browser_subagent_v2: boolean;
    enable_command_antivirus: boolean;
    enable_fork_with_subagents: boolean;
    enable_swarm_narrator: boolean;
    enable_voice_activity_events: boolean;
    disable_stained_loas2_creds: boolean;
    enable_deepagent: boolean;
    enable_review: boolean;
    enable_image_generator_subagent: boolean;
    enable_sidecars: boolean;
    enable_ui_sidecars: boolean;
    enable_sidecar_sdk: boolean;
    sidecar_gateway: boolean;
    sidecar_iframe_prewarm: boolean;
    enable_swarm_monitor: boolean;
    enable_ripgrep_path_search: boolean;
    enable_pty: boolean;
    enable_wait_tool: boolean;
    cortex_snapshot_recording: boolean;
    cortex_snapshot_revert: boolean;
    enable_remote_agent_fastpush_pin: boolean;
    enable_conversation_search_v2: boolean;
    cascade_enable_notebook_edit_tool: boolean;
    cascade_use_sed_edit_tool: boolean;
    enable_model_capacity_exhausted_retries: boolean;
    enable_mcp_non_blocking_turn_load: boolean;
}

export interface AppConfig {
    language: string;
    theme: string;
    auto_refresh: boolean;
    refresh_interval: number;
    auto_sync: boolean;
    sync_interval: number;
    default_export_path?: string;
    antigravity_executable?: string; // [NEW] 手动指定的反重力程序路径
    antigravity_ide_executable?: string; // [NEW] 手动指定的 Antigravity IDE 程序路径
    antigravity_cli_executable?: string; // [NEW] 手动指定的 Antigravity CLI (agy) 路径
    gemini_desktop_executable?: string; // [NEW] 手动指定的 Google Gemini 桌面版路径
    antigravity_args?: string[]; // [NEW] Antigravity 启动参数
    antigravity_lab?: AntigravityLabConfig; // [NEW] Antigravity 实验性特性开关
    multi_instance_mode?: boolean; // [NEW] 多开模式：切换 2.0 GUI 时启动新窗口而不关闭旧窗口
    auto_launch?: boolean; // 开机自动启动
    quiet_autostart?: boolean; // 开机自启时留在托盘。缺省视为开启
    auto_check_update?: boolean; // 自动检查更新
    update_check_interval?: number; // 更新检查间隔（小时）
    update_channel?: 'stable' | 'beta'; // 更新通道：正式版 vs 预览版
    accounts_page_size?: number; // 账号列表每页显示数量,默认 0 表示自动计算
    hidden_menu_items?: string[]; // 隐藏的菜单项路径列表
    scheduled_warmup: ScheduledWarmupConfig;
    quota_protection: QuotaProtectionConfig; // [NEW] 配额保护配置
    pinned_quota_models: PinnedQuotaModelsConfig; // [NEW] 配额关注列表
    circuit_breaker: CircuitBreakerConfig; // [NEW] 熔断器配置
    low_quota_alert?: LowQuotaAlertConfig; // [NEW] 低配额切号提醒配置
    proxy: ProxyConfig;
    cloudflared: CloudflaredConfig; // [NEW] Cloudflared 配置
    lightweight_mode?: boolean; // [NEW] 轻量模式：关闭到托盘时释放 WebView
    suggestion_delete_thinking_store?: boolean; // [NEW] 建议删除历史思考块缓存开关
    thinking_cleanup_dismissed?: boolean; // [NEW] 用户是否已确认/忽略该建议
    dismissed_thinking_cleanup_version?: string; // [NEW] 用户已确认或忽略建议的目标版本号
    oauth?: OAuthConfig; // [NEW] OAuth 凭据配置 (内置与自定义 BYO)
}

// ============================================================================
// OAuth 配置类型定义
// ============================================================================

export interface CustomOAuthClient {
    key: string;
    label: string;
    client_id: string;
    client_secret: string;
}

export interface OAuthConfig {
    enable_builtin: boolean;
    custom_clients: CustomOAuthClient[];
    active_client_key?: string;
}

// ============================================================================
// Cloudflared (CF隧道) 类型定义
// ============================================================================

export type TunnelMode = 'quick' | 'auth';

export interface CloudflaredConfig {
    enabled: boolean;
    mode: TunnelMode;
    port: number;
    token?: string;
    use_http2: boolean;
}

export interface CloudflaredStatus {
    installed: boolean;
    version?: string;
    running: boolean;
    url?: string;
    error?: string;
}

// ============================================================================
// 代理池类型定义
// ============================================================================

export interface ProxyAuth {
    username: string;
    password?: string;
}

export interface ProxyEntry {
    id: string;
    name: string;
    url: string;
    auth?: ProxyAuth;
    enabled: boolean;
    priority: number;
    tags: string[];
    max_accounts?: number;
    health_check_url?: string;
    last_check_time?: number;
    is_healthy: boolean;
    latency?: number; // [NEW] 延迟 (毫秒)
}

// export type ProxyPoolMode = 'global' | 'per_account' | 'hybrid'; // [REMOVED]

export type ProxySelectionStrategy = 'round_robin' | 'random' | 'priority' | 'least_connections' | 'weighted_round_robin';

export interface ProxyPoolConfig {
    enabled: boolean;
    // mode: ProxyPoolMode; // [REMOVED]
    proxies: ProxyEntry[];
    health_check_interval: number;
    auto_failover: boolean;
    strategy: ProxySelectionStrategy;
    account_bindings?: Record<string, string>;
}
