//! Vertex AI 上游：把命中映射的模型的 Gemini 原生请求直连到用户自己的 GCP 项目，
//! 使用 gcloud 的 Application Default Credentials 鉴权，不经过 Antigravity 账号池。

use std::collections::{HashMap, HashSet};
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::{OnceLock, RwLock};
use std::time::{Duration, Instant};

use axum::{
    body::Body,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use bytes::Bytes;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::proxy::monitor::UpstreamRequestBodyHolder;
use crate::proxy::thinking_store::SENTINEL_SIGNATURE;
use crate::proxy::upstream::client::UpstreamClient;

const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
/// 访问令牌在到期前这么久就提前刷新
const TOKEN_REFRESH_MARGIN: Duration = Duration::from_secs(120);
/// Vertex generateContent 接受的请求字段；其余（如 Antigravity 的 sessionId）会被上游以未知字段拒绝
const ALLOWED_REQUEST_FIELDS: [&str; 12] = [
    "contents",
    "systemInstruction",
    "system_instruction",
    "tools",
    "toolConfig",
    "tool_config",
    "generationConfig",
    "generation_config",
    "safetySettings",
    "safety_settings",
    "cachedContent",
    "labels",
];
/// 默认模式下走 Vertex 的模型
pub const DEFAULT_MODEL: &str = "gemini-3.8-flash";
/// 客户端对默认模型使用的档位别名后缀
const DEFAULT_MODEL_VARIANTS: [&str; 4] = ["-high", "-medium", "-low", "-tiered"];

/// Vertex AI 上游配置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct VertexConfig {
    pub enabled: bool,
    /// GCP 项目 ID（不是显示名称）
    pub project_id: String,
    /// 区域，`global` 走全局端点
    pub location: String,
    /// ADC 凭证文件路径；留空使用 gcloud 默认位置
    pub credentials_path: Option<String>,
    /// 哪些模型走 Vertex：只有默认模型，还是用户自选
    pub model_mode: ModelSelection,
    /// 客户端模型名 -> Vertex 模型 ID（键支持结尾 `*` 通配）；仅自选模式生效
    pub model_mapping: HashMap<String, String>,
    /// 以自身 ID 对客户端展示并直连 Vertex 的模型（在设置页从云端列表中勾选）；仅自选模式生效
    pub exposed_models: Vec<String>,
    /// 命中 Vertex 路由的模型先用哪一边
    pub preference: UpstreamPreference,
}

/// 哪些模型走 Vertex
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ModelSelection {
    /// 只有 `DEFAULT_MODEL` 及其档位别名
    #[default]
    Default,
    /// 设置页里勾选的模型与自定义映射
    Picker,
}

/// 命中 Vertex 路由的模型先用哪一边；先用的一边不可用时回退到另一边
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum UpstreamPreference {
    #[default]
    VertexFirst,
    AccountsFirst,
}

impl Default for VertexConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            project_id: String::new(),
            location: "global".to_string(),
            credentials_path: None,
            model_mode: ModelSelection::default(),
            model_mapping: HashMap::new(),
            exposed_models: Vec::new(),
            preference: UpstreamPreference::default(),
        }
    }
}

impl VertexConfig {
    fn is_active(&self) -> bool {
        self.enabled && !self.project_id.trim().is_empty()
    }
}

/// 启用 Vertex 时要追加到客户端模型列表里的模型 ID
pub fn exposed_model_ids() -> Vec<String> {
    let config = get_config();
    if !config.is_active() {
        return Vec::new();
    }
    if config.model_mode == ModelSelection::Default {
        return vec![DEFAULT_MODEL.to_string()];
    }
    config
        .exposed_models
        .iter()
        .map(|model| model.trim().to_string())
        .filter(|model| !model.is_empty())
        .collect()
}

static GLOBAL_VERTEX_CONFIG: OnceLock<RwLock<VertexConfig>> = OnceLock::new();

/// 获取当前 Vertex 上游配置
pub fn get_config() -> VertexConfig {
    GLOBAL_VERTEX_CONFIG
        .get()
        .and_then(|lock| lock.read().ok())
        .map(|cfg| cfg.clone())
        .unwrap_or_default()
}

/// 更新全局 Vertex 上游配置
pub fn update_config(config: VertexConfig) {
    tracing::info!(
        "[Vertex] Config updated: enabled={}, project={}, location={}, model_mode={:?}, mapped_models={}",
        config.enabled,
        config.project_id,
        config.location,
        config.model_mode,
        config.model_mapping.len()
    );
    if let Some(lock) = GLOBAL_VERTEX_CONFIG.get() {
        if let Ok(mut cfg) = lock.write() {
            *cfg = config;
        }
    } else {
        let _ = GLOBAL_VERTEX_CONFIG.set(RwLock::new(config));
    }
}

/// 一次请求命中的 Vertex 路由
#[derive(Debug, Clone, PartialEq)]
pub struct VertexRoute {
    pub model: String,
    /// 由客户端模型名的档位后缀（-high / -medium / -low）推导出的思考档位
    pub thinking_level: Option<&'static str>,
    /// true：先走 Vertex、失败回退账号池；false：先走账号池、不可用时才走 Vertex
    pub vertex_first: bool,
    pub project_id: String,
    pub location: String,
    pub credentials_path: Option<String>,
    /// 是否允许在 Vertex 失败时回退到本地账号池（若为 Vertex 独占/账号池未支持模型，则禁止回退，避免降级伪装）
    pub allow_account_fallback: bool,
}

/// 判断客户端请求的模型是否能在本地账号池中被原生正常处理。
/// Google 账号池 (Cloud Code) 仅支持 Gemini 3.x 系列、经典 2.5/1.5 别名和 Claude 系列。
/// 4.x 前沿模型或实验代号 (Argon / Carbon 等) 在普通账号池中不存在，不能回退。
/// 3.7 及以下的 Flash（gemini-3.1-flash … gemini-3.7-flash 及其档位别名）账号池同样无法服务。
pub fn is_account_pool_supported_model(requested: &str) -> bool {
    let lower = requested.to_lowercase();
    if lower.contains("argon")
        || lower.contains("carbon")
        || lower.contains("gemini-4")
        || lower.starts_with("4-")
        || lower.starts_with("4.")
        || is_legacy_flash(&lower)
    {
        return false;
    }
    true
}

/// `gemini-3.<minor>-flash` with minor < 8, bare or with a tier suffix.
/// Flash-Lite and image variants are not included.
fn is_legacy_flash(lower: &str) -> bool {
    let Some(rest) = lower.strip_prefix("gemini-3.") else {
        return false;
    };
    let digits_end = rest
        .find(|c: char| !c.is_ascii_digit())
        .unwrap_or(rest.len());
    let Ok(minor) = rest[..digits_end].parse::<u32>() else {
        return false;
    };
    let Some(suffix) = rest[digits_end..].strip_prefix("-flash") else {
        return false;
    };
    minor < 8 && ["", "-high", "-medium", "-low", "-tiered"].contains(&suffix)
}

/// 默认模式：客户端模型名是默认模型本体或其档位别名
fn is_default_model(requested: &str) -> bool {
    requested
        .strip_prefix(DEFAULT_MODEL)
        .is_some_and(|variant| variant.is_empty() || DEFAULT_MODEL_VARIANTS.contains(&variant))
}

/// 自选模式：精确映射 > 勾选展示的模型（按自身 ID 直连）> 通配映射（前缀最长者优先）
fn picked_model<'a>(config: &'a VertexConfig, requested: &str) -> Option<&'a str> {
    let exact = config
        .model_mapping
        .iter()
        .find(|(key, _)| key.trim().to_lowercase() == requested)
        .map(|(_, value)| value.as_str());
    let exposed = || {
        config
            .exposed_models
            .iter()
            .find(|model| model.trim().to_lowercase() == requested)
            .map(String::as_str)
    };
    let wildcard = || {
        config
            .model_mapping
            .iter()
            .filter_map(|(key, value)| {
                let prefix = key.trim().strip_suffix('*')?.to_lowercase();
                requested
                    .starts_with(&prefix)
                    .then_some((prefix.len(), value.as_str()))
            })
            .max_by_key(|(len, _)| *len)
            .map(|(_, value)| value)
    };
    exact.or_else(exposed).or_else(wildcard)
}

/// 判断客户端请求的模型是否应走 Vertex；未启用、未配置项目或未命中所选模型时返回 None
pub fn resolve_route(config: &VertexConfig, client_model: &str) -> Option<VertexRoute> {
    if !config.is_active() {
        return None;
    }
    let requested = client_model
        .trim()
        .trim_start_matches("models/")
        .to_lowercase();

    let (model, is_default) = match config.model_mode {
        ModelSelection::Default => (is_default_model(&requested).then_some(DEFAULT_MODEL)?, true),
        ModelSelection::Picker => (picked_model(config, &requested)?.trim(), false),
    };
    if model.is_empty() {
        return None;
    }

    let allow_account_fallback = is_default || is_account_pool_supported_model(&requested);

    let thinking_level = [("-high", "high"), ("-medium", "medium"), ("-low", "low")]
        .into_iter()
        .find_map(|(suffix, level)| requested.ends_with(suffix).then_some(level));
    let location = config.location.trim();

    Some(VertexRoute {
        model: model.to_string(),
        thinking_level,
        vertex_first: config.preference == UpstreamPreference::VertexFirst,
        project_id: config.project_id.trim().to_string(),
        location: if location.is_empty() {
            "global"
        } else {
            location
        }
        .to_string(),
        credentials_path: config
            .credentials_path
            .as_deref()
            .map(str::trim)
            .filter(|path| !path.is_empty())
            .map(str::to_string),
        allow_account_fallback,
    })
}

fn endpoint_url(route: &VertexRoute, method: &str) -> String {
    let host = if route.location == "global" {
        "aiplatform.googleapis.com".to_string()
    } else {
        format!("{}-aiplatform.googleapis.com", route.location)
    };
    let query = if method == "streamGenerateContent" {
        "?alt=sse"
    } else {
        ""
    };
    format!(
        "https://{}/v1/projects/{}/locations/{}/publishers/google/models/{}:{}{}",
        host, route.project_id, route.location, route.model, method, query
    )
}

// ============================================================================
// ADC 凭证与访问令牌
// ============================================================================

#[derive(Deserialize)]
struct AdcFile {
    #[serde(rename = "type")]
    kind: String,
    client_id: Option<String>,
    client_secret: Option<String>,
    refresh_token: Option<String>,
    quota_project_id: Option<String>,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: u64,
}

struct CachedToken {
    access_token: String,
    quota_project: Option<String>,
    expires_at: Instant,
    source: PathBuf,
}

static VERTEX_CLIENT: OnceLock<RwLock<Option<rquest::Client>>> = OnceLock::new();

fn vertex_client_cell() -> &'static RwLock<Option<rquest::Client>> {
    VERTEX_CLIENT.get_or_init(|| RwLock::new(None))
}

/// Dedicated, clean HTTP/1.1 client for Vertex AI Google Cloud REST endpoints.
/// Does NOT use Chrome 123 TLS/JA3 impersonation or HTTP/2 flow control limits,
/// enabling robust transmission of large (>64 KB) context payloads.
fn build_vertex_client() -> rquest::Client {
    let mut builder = rquest::Client::builder()
        .http1_only()
        .connect_timeout(Duration::from_secs(20))
        .pool_max_idle_per_host(20)
        .pool_idle_timeout(Duration::from_secs(90))
        .tcp_keepalive(Duration::from_secs(15))
        .timeout(Duration::from_secs(600));

    if let Ok(config) = crate::modules::config::load_app_config() {
        let proxy_config = config.proxy.upstream_proxy;
        if proxy_config.enabled && !proxy_config.url.is_empty() {
            let url = crate::proxy::config::normalize_proxy_url(&proxy_config.url);
            if let Ok(proxy) = rquest::Proxy::all(&url) {
                builder = builder.proxy(proxy);
                tracing::info!("[Vertex] Enabled upstream proxy: {}", url);
            }
        }
    }

    builder.build().unwrap_or_else(|e| {
        tracing::error!(
            "[Vertex] Failed to build dedicated Vertex HTTP/1.1 client: {}, using fallback",
            e
        );
        rquest::Client::new()
    })
}

pub fn get_vertex_client() -> rquest::Client {
    let cell = vertex_client_cell();
    {
        if let Ok(guard) = cell.read() {
            if let Some(ref client) = *guard {
                return client.clone();
            }
        }
    }
    let mut guard = cell
        .write()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(ref client) = *guard {
        return client.clone();
    }
    let client = build_vertex_client();
    *guard = Some(client.clone());
    client
}

pub fn invalidate_vertex_client() {
    let mut guard = vertex_client_cell()
        .write()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let had_client = guard.is_some();
    *guard = None;
    if had_client {
        tracing::info!("[Vertex] Discarded dedicated Vertex client; will rebuild on next request");
    }
}

static TOKEN_CACHE: OnceLock<tokio::sync::Mutex<Option<CachedToken>>> = OnceLock::new();

fn token_cache() -> &'static tokio::sync::Mutex<Option<CachedToken>> {
    TOKEN_CACHE.get_or_init(|| tokio::sync::Mutex::new(None))
}

/// gcloud `auth application-default login` 写入凭证的默认位置
fn default_adc_path() -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("GOOGLE_APPLICATION_CREDENTIALS") {
        return Some(PathBuf::from(path));
    }
    let config_dir = if cfg!(windows) {
        PathBuf::from(std::env::var_os("APPDATA")?)
    } else {
        dirs::home_dir()?.join(".config")
    };
    Some(
        config_dir
            .join("gcloud")
            .join("application_default_credentials.json"),
    )
}

fn parse_adc(raw: &str, path: &Path) -> Result<AdcFile, String> {
    let adc: AdcFile = serde_json::from_str(raw).map_err(|e| {
        format!(
            "Vertex credentials file {} is not valid JSON: {}",
            path.display(),
            e
        )
    })?;
    if adc.kind != "authorized_user" {
        return Err(format!(
            "Vertex credentials file {} has type \"{}\"; only \"authorized_user\" (from `gcloud auth application-default login`) is supported",
            path.display(),
            adc.kind
        ));
    }
    if adc.client_id.is_none() || adc.client_secret.is_none() || adc.refresh_token.is_none() {
        return Err(format!(
            "Vertex credentials file {} is missing client_id, client_secret or refresh_token",
            path.display()
        ));
    }
    Ok(adc)
}

/// 返回 (访问令牌, 配额项目)；令牌按凭证文件缓存，临近过期或 `force_refresh` 时刷新
async fn access_token(
    client: &rquest::Client,
    credentials_path: Option<&str>,
    force_refresh: bool,
) -> Result<(String, Option<String>), String> {
    let path = match credentials_path {
        Some(path) => PathBuf::from(path),
        None => default_adc_path().ok_or_else(|| {
            "Cannot locate the gcloud credentials directory for Vertex AI".to_string()
        })?,
    };

    let mut cache = token_cache().lock().await;
    if !force_refresh {
        if let Some(cached) = cache.as_ref() {
            if cached.source == path && cached.expires_at > Instant::now() + TOKEN_REFRESH_MARGIN {
                return Ok((cached.access_token.clone(), cached.quota_project.clone()));
            }
        }
    }

    let raw = std::fs::read_to_string(&path).map_err(|e| {
        format!(
            "Vertex credentials not found at {} ({}). Run `gcloud auth application-default login` first.",
            path.display(),
            e
        )
    })?;
    let adc = parse_adc(&raw, &path)?;
    let params = [
        ("client_id", adc.client_id.as_deref().unwrap_or_default()),
        (
            "client_secret",
            adc.client_secret.as_deref().unwrap_or_default(),
        ),
        (
            "refresh_token",
            adc.refresh_token.as_deref().unwrap_or_default(),
        ),
        ("grant_type", "refresh_token"),
    ];
    let response = client
        .post(TOKEN_URL)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Vertex token refresh request failed: {}", e))?;
    let status = response.status();
    if !status.is_success() {
        let detail = response.text().await.unwrap_or_default();
        return Err(format!(
            "Vertex token refresh was rejected (HTTP {}): {}. Re-run `gcloud auth application-default login`.",
            status.as_u16(),
            detail.trim()
        ));
    }
    let token: TokenResponse = response
        .json()
        .await
        .map_err(|e| format!("Vertex token refresh returned an unexpected body: {}", e))?;

    *cache = Some(CachedToken {
        access_token: token.access_token.clone(),
        quota_project: adc.quota_project_id.clone(),
        expires_at: Instant::now() + Duration::from_secs(token.expires_in),
        source: path,
    });
    Ok((token.access_token, adc.quota_project_id))
}

// ============================================================================
// 请求整形
// ============================================================================

fn is_function_response_only(parts: &[Value]) -> bool {
    !parts.is_empty()
        && parts.iter().all(|part| {
            part.get("functionResponse").is_some() || part.get("function_response").is_some()
        })
}

fn has_function_call(part: &Value) -> bool {
    part.get("functionCall").is_some() || part.get("function_call").is_some()
}

fn part_signature(part: &Value) -> Option<&Value> {
    part.get("thoughtSignature")
        .or_else(|| part.get("thought_signature"))
}

/// Vertex 拒收过的历史思考签名（仅存哈希）。这类签名由别的后端签发（如 Antigravity 账号），
/// 记住之后，同一对话的后续请求直接换成跳过验签哨兵，不必每次都先失败一轮再重试。
static REJECTED_SIGNATURES: OnceLock<std::sync::Mutex<HashSet<u64>>> = OnceLock::new();
const MAX_REJECTED_SIGNATURES: usize = 200_000;

fn rejected_signatures() -> &'static std::sync::Mutex<HashSet<u64>> {
    REJECTED_SIGNATURES.get_or_init(|| std::sync::Mutex::new(HashSet::new()))
}

fn signature_hash(signature: &str) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    signature.hash(&mut hasher);
    hasher.finish()
}

fn is_rejected_signature(signature: &str) -> bool {
    rejected_signatures()
        .lock()
        .map(|set| set.contains(&signature_hash(signature)))
        .unwrap_or(false)
}

/// 上游报签名无效时无法得知是哪一个，把这次请求携带的签名全部记为拒收
fn remember_rejected_signatures(client_body: &Value) {
    let inner = client_body
        .get("request")
        .filter(|request| request.is_object())
        .unwrap_or(client_body);
    let Some(contents) = inner.get("contents").and_then(Value::as_array) else {
        return;
    };
    let Ok(mut set) = rejected_signatures().lock() else {
        return;
    };
    if set.len() > MAX_REJECTED_SIGNATURES {
        set.clear();
    }
    for part in contents
        .iter()
        .filter_map(|content| content.get("parts").and_then(Value::as_array))
        .flatten()
    {
        if let Some(signature) = part_signature(part).and_then(Value::as_str) {
            if signature != SENTINEL_SIGNATURE {
                set.insert(signature_hash(signature));
            }
        }
    }
}

fn normalize_contents(contents: &mut [Value], is_rejected: &dyn Fn(&str) -> bool) {
    for content in contents.iter_mut() {
        let Some(obj) = content.as_object_mut() else {
            continue;
        };
        let role = obj
            .get("role")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let tool_result_only = obj
            .get("parts")
            .and_then(Value::as_array)
            .is_some_and(|parts| is_function_response_only(parts));

        // Antigravity 客户端把工具结果放在 model 轮；Gemini API 的规范位置是 user 轮
        if tool_result_only {
            obj.insert("role".to_string(), json!("user"));
            continue;
        }
        if role == "assistant" {
            obj.insert("role".to_string(), json!("model"));
        } else if role != "model" {
            continue;
        }
        let Some(parts) = obj.get_mut("parts").and_then(Value::as_array_mut) else {
            continue;
        };

        // 带拒收签名的部件：思考块整块丢弃，其余去掉签名，工具调用换成官方跳过验签哨兵
        let carries_rejected = |part: &Value| {
            part_signature(part)
                .and_then(Value::as_str)
                .is_some_and(|signature| is_rejected(signature))
        };
        parts.retain(|part| {
            !(crate::proxy::thinking_store::is_thought_part(part) && carries_rejected(part))
        });
        for part in parts.iter_mut() {
            if !carries_rejected(part) {
                continue;
            }
            let is_call = has_function_call(part);
            if let Some(part_obj) = part.as_object_mut() {
                part_obj.remove("thoughtSignature");
                part_obj.remove("thought_signature");
                if is_call {
                    part_obj.insert("thoughtSignature".to_string(), json!(SENTINEL_SIGNATURE));
                }
            }
        }
        // Gemini 3 要求每一步的首个工具调用带签名；客户端没带时补哨兵，避免 400
        if let Some(first_call) = parts.iter_mut().find(|part| has_function_call(part)) {
            if part_signature(first_call).is_none() {
                if let Some(part_obj) = first_call.as_object_mut() {
                    part_obj.insert("thoughtSignature".to_string(), json!(SENTINEL_SIGNATURE));
                }
            }
        }
    }
}

fn apply_thinking_level(request: &mut serde_json::Map<String, Value>, level: &str) {
    let config_key = if request.contains_key("generation_config") {
        "generation_config"
    } else {
        "generationConfig"
    };
    let generation_config = request
        .entry(config_key.to_string())
        .or_insert_with(|| json!({}));
    let Some(generation_config) = generation_config.as_object_mut() else {
        return;
    };
    let thinking_key = if generation_config.contains_key("thinking_config") {
        "thinking_config"
    } else {
        "thinkingConfig"
    };
    let thinking_config = generation_config
        .entry(thinking_key.to_string())
        .or_insert_with(|| json!({}));
    let Some(thinking_config) = thinking_config.as_object_mut() else {
        return;
    };

    // 客户端自己指定了档位或正数预算时，以客户端为准
    if thinking_config.contains_key("thinkingLevel")
        || thinking_config.contains_key("thinking_level")
    {
        return;
    }
    let explicit_budget = ["thinkingBudget", "thinking_budget"]
        .iter()
        .filter_map(|key| thinking_config.get(*key).and_then(Value::as_i64))
        .any(|budget| budget > 0);
    if explicit_budget {
        return;
    }
    // 档位与预算不能同时出现
    thinking_config.remove("thinkingBudget");
    thinking_config.remove("thinking_budget");
    thinking_config.insert("thinkingLevel".to_string(), json!(level));
}

/// 把客户端的 Gemini 原生请求整理成 Vertex generateContent 请求体
fn build_request_body(
    client_body: &Value,
    thinking_level: Option<&str>,
    is_rejected: &dyn Fn(&str) -> bool,
) -> Value {
    // 兼容已带 v1internal 信封（{"request": {...}}）的客户端
    let inner = client_body
        .get("request")
        .filter(|request| request.is_object())
        .unwrap_or(client_body);

    let mut request = serde_json::Map::new();
    if let Some(source) = inner.as_object() {
        for (key, value) in source {
            if ALLOWED_REQUEST_FIELDS.contains(&key.as_str()) {
                request.insert(key.clone(), value.clone());
            }
        }
    }
    if let Some(contents) = request.get_mut("contents").and_then(Value::as_array_mut) {
        normalize_contents(contents, is_rejected);
    }
    if let Some(level) = thinking_level {
        apply_thinking_level(&mut request, level);
    }
    Value::Object(request)
}

// ============================================================================
// 请求处理
// ============================================================================

/// Vertex 请求失败。`can_fall_back` 为 true 表示问题出在 Vertex 这一侧（凭证、配额、网络、5xx），
/// 调用方可以改走另一条上游；请求本身不被接受（400）时换上游没有意义。
pub struct VertexFailure {
    pub response: Response,
    pub can_fall_back: bool,
    pub reason: String,
}

fn failure(status: StatusCode, route: &VertexRoute, message: String) -> VertexFailure {
    tracing::error!("[Vertex] {}", message);
    let grpc_status = match status {
        StatusCode::BAD_GATEWAY | StatusCode::SERVICE_UNAVAILABLE => "UNAVAILABLE",
        _ => "INTERNAL",
    };
    let body = json!({
        "error": { "code": status.as_u16(), "message": message, "status": grpc_status }
    });
    VertexFailure {
        response: (status, route_headers(route), Json(body)).into_response(),
        can_fall_back: route.allow_account_fallback,
        reason: message,
    }
}

fn route_headers(route: &VertexRoute) -> [(&'static str, String); 2] {
    [
        ("X-Account-Email", format!("vertex:{}", route.project_id)),
        ("X-Mapped-Model", format!("vertex/{}", route.model)),
    ]
}

/// 处理命中 Vertex 路由的 generateContent / streamGenerateContent 请求
pub async fn handle_generate(
    _upstream: &UpstreamClient,
    route: &VertexRoute,
    method: &str,
    client_body: &Value,
    upstream_recorder: Option<&UpstreamRequestBodyHolder>,
) -> Result<Response, VertexFailure> {
    let client = get_vertex_client();
    let url = endpoint_url(route, method);
    let is_stream = method == "streamGenerateContent";
    tracing::info!("[Vertex] Routing request to {}", url);

    let mut retried_signatures = false;
    let mut force_token_refresh = false;
    // 最多三次：原始请求、令牌失效后重取令牌、历史签名被拒后换哨兵、瞬时网络连接重试
    for attempt in 0..3 {
        let (token, quota_project) = match access_token(
            &client,
            route.credentials_path.as_deref(),
            force_token_refresh,
        )
        .await
        {
            Ok(token) => token,
            Err(message) => return Err(failure(StatusCode::SERVICE_UNAVAILABLE, route, message)),
        };

        let body = build_request_body(client_body, route.thinking_level, &is_rejected_signature);
        if let Some(recorder) = upstream_recorder {
            recorder.set_value(&body);
        }
        let body_bytes = match serde_json::to_vec(&body) {
            Ok(bytes) => bytes,
            Err(e) => {
                return Err(failure(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    route,
                    format!("Failed to encode Vertex request: {}", e),
                ))
            }
        };

        let response = client
            .post(&url)
            .header(rquest::header::AUTHORIZATION, format!("Bearer {}", token))
            .header(rquest::header::CONTENT_TYPE, "application/json")
            .header(
                "x-goog-user-project",
                quota_project.as_deref().unwrap_or(&route.project_id),
            )
            .body(body_bytes)
            .send()
            .await;
        let response = match response {
            Ok(response) => response,
            Err(e) => {
                if attempt + 1 < 3 {
                    let backoff = Duration::from_millis(1000 * (attempt as u64 + 1));
                    tracing::warn!(
                        "[Vertex] Network send error on attempt {} for {}: {}, retrying in {:?}...",
                        attempt + 1,
                        url,
                        e,
                        backoff
                    );
                    tokio::time::sleep(backoff).await;
                    continue;
                }
                return Err(failure(
                    StatusCode::BAD_GATEWAY,
                    route,
                    format!("Vertex request failed: {}", e),
                ));
            }
        };

        let status = response.status();
        if status.is_success() {
            return Ok(if is_stream {
                stream_response(response, route)
            } else {
                let bytes = response.bytes().await.unwrap_or_default();
                (
                    StatusCode::OK,
                    route_headers(route),
                    [("Content-Type", "application/json")],
                    bytes,
                )
                    .into_response()
            });
        }

        let error_text = response.text().await.unwrap_or_default();
        if status == StatusCode::UNAUTHORIZED && !force_token_refresh {
            tracing::warn!("[Vertex] Access token rejected, refreshing and retrying");
            force_token_refresh = true;
            continue;
        }
        let is_signature_error = crate::proxy::pipeline::UpstreamClassification::classify(
            status.as_u16(),
            &error_text,
            None,
        )
        .is_thought_signature_error();
        if is_signature_error && !retried_signatures {
            tracing::warn!(
                "[Vertex] History thought signatures rejected, retrying with validator-skip signatures"
            );
            remember_rejected_signatures(client_body);
            retried_signatures = true;
            continue;
        }

        if (status == StatusCode::SERVICE_UNAVAILABLE || status == StatusCode::TOO_MANY_REQUESTS)
            && attempt + 1 < 3
        {
            let backoff = Duration::from_millis(1500 * (attempt as u64 + 1));
            tracing::warn!(
                "[Vertex] Upstream returned HTTP {} on attempt {}, retrying in {:?}...",
                status.as_u16(),
                attempt + 1,
                backoff
            );
            tokio::time::sleep(backoff).await;
            continue;
        }

        tracing::error!(
            "[Vertex] Upstream error {}: {}",
            status.as_u16(),
            error_text
        );
        return Err(VertexFailure {
            reason: format!("Vertex returned HTTP {}", status.as_u16()),
            can_fall_back: status != StatusCode::BAD_REQUEST && route.allow_account_fallback,
            response: (
                StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY),
                route_headers(route),
                [("Content-Type", "application/json")],
                error_text,
            )
                .into_response(),
        });
    }

    Err(failure(
        StatusCode::BAD_GATEWAY,
        route,
        "Vertex request did not succeed after retries".to_string(),
    ))
}

/// 列出当前项目可用的 Gemini 发布模型 ID（供设置页勾选要展示给客户端的模型）
pub async fn list_models(
    client: &rquest::Client,
    config: &VertexConfig,
) -> Result<Vec<String>, String> {
    let project = config.project_id.trim();
    if project.is_empty() {
        return Err("Set the Vertex project ID first".to_string());
    }
    let credentials_path = config
        .credentials_path
        .as_deref()
        .map(str::trim)
        .filter(|path| !path.is_empty());
    let (token, quota_project) = access_token(client, credentials_path, false).await?;

    let mut models = std::collections::BTreeSet::new();
    let mut page_token: Option<String> = None;
    // 分页上限只是防止上游异常时无限翻页
    for _ in 0..20 {
        let mut request = client
            .get("https://aiplatform.googleapis.com/v1beta1/publishers/google/models")
            .query(&[("pageSize", "300")])
            .header(rquest::header::AUTHORIZATION, format!("Bearer {}", token))
            .header(
                "x-goog-user-project",
                quota_project.as_deref().unwrap_or(project),
            );
        if let Some(token) = page_token.as_deref() {
            request = request.query(&[("pageToken", token)]);
        }
        let response = request
            .send()
            .await
            .map_err(|e| format!("Vertex model list request failed: {}", e))?;
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(format!(
                "Vertex model list returned HTTP {}: {}",
                status.as_u16(),
                text.trim()
            ));
        }
        let page: Value = serde_json::from_str(&text)
            .map_err(|e| format!("Vertex model list returned an unexpected body: {}", e))?;
        models.extend(parse_model_ids(&page));
        page_token = page
            .get("nextPageToken")
            .and_then(Value::as_str)
            .filter(|token| !token.is_empty())
            .map(str::to_string);
        if page_token.is_none() {
            break;
        }
    }
    Ok(models.into_iter().collect())
}

/// 从 publishers.models.list 的一页响应里取出 Gemini 模型 ID（去掉资源前缀与 `@版本` 后缀）
fn parse_model_ids(page: &Value) -> Vec<String> {
    page.get("publisherModels")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|model| model.get("name").and_then(Value::as_str))
        .filter_map(|name| name.strip_prefix("publishers/google/models/"))
        .map(|id| id.split('@').next().unwrap_or(id).to_string())
        .filter(|id| id.starts_with("gemini-"))
        .collect()
}

fn stream_response(response: rquest::Response, route: &VertexRoute) -> Response {
    let mut upstream_stream = response.bytes_stream();
    let model = route.model.clone();
    let stream = async_stream::stream! {
        while let Some(chunk) = upstream_stream.next().await {
            match chunk {
                Ok(bytes) => yield Ok::<Bytes, String>(bytes),
                Err(e) => {
                    tracing::error!("[Vertex] Stream interrupted for model {}: {}", model, e);
                    let error = json!({
                        "error": {
                            "code": 503,
                            "message": format!("Vertex stream interrupted: {}", e),
                            "status": "UNAVAILABLE"
                        }
                    });
                    yield Ok::<Bytes, String>(Bytes::from(format!("data: {}\n\n", error)));
                    break;
                }
            }
        }
    };

    let [account, mapped] = route_headers(route);
    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "text/event-stream")
        .header("Cache-Control", "no-cache")
        .header("Connection", "keep-alive")
        .header("X-Accel-Buffering", "no")
        .header(account.0, account.1)
        .header(mapped.0, mapped.1)
        .body(Body::from_stream(stream))
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(mapping: &[(&str, &str)]) -> VertexConfig {
        VertexConfig {
            enabled: true,
            project_id: "aurora-1".to_string(),
            location: "global".to_string(),
            credentials_path: None,
            model_mode: ModelSelection::Picker,
            model_mapping: mapping
                .iter()
                .map(|(key, value)| (key.to_string(), value.to_string()))
                .collect(),
            ..VertexConfig::default()
        }
    }

    #[test]
    fn default_mode_routes_only_the_default_model_and_its_tier_aliases() {
        // A config saved without a mode is in default mode, and its picks and mappings are inactive.
        let mut cfg: VertexConfig = serde_json::from_str(
            r#"{"enabled":true,"project_id":"aurora-1","model_mapping":{"gemini-3.1-pro*":"gemini-3.1-pro-preview"},"exposed_models":["gemini-3.6-flash"]}"#,
        )
        .unwrap();
        assert_eq!(cfg.model_mode, ModelSelection::Default);

        let bare = resolve_route(&cfg, "models/Gemini-3.8-Flash").unwrap();
        assert_eq!(bare.model, DEFAULT_MODEL);
        assert_eq!(bare.thinking_level, None);
        let high = resolve_route(&cfg, "gemini-3.8-flash-high").unwrap();
        assert_eq!(high.model, DEFAULT_MODEL);
        assert_eq!(high.thinking_level, Some("high"));
        assert_eq!(
            resolve_route(&cfg, "gemini-3.8-flash-tiered")
                .unwrap()
                .thinking_level,
            None
        );

        for other in [
            "gemini-3.8-flash-n",
            "gemini-3.8-flash-exp-a",
            "gemini-3.8-flash-lite",
            "gemini-3.8-flash-image",
            "gemini-3.6-flash",
            "gemini-3.1-pro-high",
        ] {
            assert!(
                resolve_route(&cfg, other).is_none(),
                "{other} must stay on the accounts"
            );
        }

        // Picker mode brings the saved picks and mappings back, and the default model is no longer implied.
        cfg.model_mode = ModelSelection::Picker;
        assert!(resolve_route(&cfg, "gemini-3.8-flash").is_none());
        assert_eq!(
            resolve_route(&cfg, "gemini-3.6-flash").unwrap().model,
            "gemini-3.6-flash"
        );
        assert_eq!(
            resolve_route(&cfg, "gemini-3.1-pro-high").unwrap().model,
            "gemini-3.1-pro-preview"
        );
        let parsed: VertexConfig = serde_json::from_str(r#"{"model_mode":"picker"}"#).unwrap();
        assert_eq!(parsed.model_mode, ModelSelection::Picker);
    }

    #[test]
    fn exclusive_models_in_picker_mode_disallow_account_fallback() {
        let mut cfg = config(&[
            ("gemini-4-argon", "gemini-4-argon"),
            ("gemini-3.8-flash", "gemini-3.8-flash"),
        ]);
        let argon = resolve_route(&cfg, "gemini-4-argon").unwrap();
        assert_eq!(argon.model, "gemini-4-argon");
        assert!(!argon.allow_account_fallback);

        let flash = resolve_route(&cfg, "gemini-3.8-flash").unwrap();
        assert!(flash.allow_account_fallback);

        cfg.model_mode = ModelSelection::Default;
        let default_flash = resolve_route(&cfg, "gemini-3.8-flash").unwrap();
        assert!(default_flash.allow_account_fallback);
    }

    #[test]
    fn flash_37_and_below_is_vertex_only() {
        let mut cfg = config(&[]);
        cfg.exposed_models = [
            "gemini-3.7-flash",
            "gemini-3.7-flash-high",
            "gemini-3.6-flash-low",
            "gemini-3.5-flash",
            "gemini-3.1-flash-tiered",
            "gemini-3.8-flash",
            "gemini-3.8-flash-high",
            "gemini-3.1-flash-lite",
            "gemini-3.7-flash-image",
        ]
        .map(String::from)
        .to_vec();

        for model in [
            "gemini-3.7-flash",
            "Gemini-3.7-Flash-High",
            "gemini-3.6-flash-low",
            "gemini-3.5-flash",
            "gemini-3.1-flash-tiered",
        ] {
            assert!(
                !resolve_route(&cfg, model).unwrap().allow_account_fallback,
                "{model} must not fall back to the accounts"
            );
        }
        for model in [
            "gemini-3.8-flash",
            "gemini-3.8-flash-high",
            "gemini-3.1-flash-lite",
            "gemini-3.7-flash-image",
        ] {
            assert!(
                resolve_route(&cfg, model).unwrap().allow_account_fallback,
                "{model} keeps the account fallback"
            );
        }
        assert!(is_account_pool_supported_model("gemini-3-flash"));
        assert!(is_account_pool_supported_model("gemini-3.10-flash"));
    }

    fn none_rejected(_: &str) -> bool {
        false
    }

    #[test]
    fn exposed_models_route_under_their_own_id_between_exact_and_wildcard_mappings() {
        let mut cfg = config(&[
            ("gemini-3.8-flash*", "wildcard-target"),
            ("gemini-3.1-pro-preview", "exact-target"),
        ]);
        cfg.exposed_models = vec![
            "gemini-3.8-flash".to_string(),
            "gemini-3.1-pro-preview".to_string(),
            "gemini-3.5-flash-lite".to_string(),
        ];

        // An exposed model wins over a wildcard that would also match it...
        assert_eq!(
            resolve_route(&cfg, "gemini-3.8-flash").unwrap().model,
            "gemini-3.8-flash"
        );
        // ...but an exact mapping still wins over the exposed id.
        assert_eq!(
            resolve_route(&cfg, "gemini-3.1-pro-preview").unwrap().model,
            "exact-target"
        );
        // Exposed models with no mapping at all are routable.
        assert_eq!(
            resolve_route(&cfg, "Gemini-3.5-Flash-Lite").unwrap().model,
            "gemini-3.5-flash-lite"
        );
        assert_eq!(
            resolve_route(&cfg, "gemini-3.8-flash-high").unwrap().model,
            "wildcard-target"
        );
    }

    #[test]
    fn route_carries_the_configured_upstream_preference() {
        let mut cfg = config(&[("m", "gemini-3.8-flash")]);
        assert!(resolve_route(&cfg, "m").unwrap().vertex_first);
        cfg.preference = UpstreamPreference::AccountsFirst;
        assert!(!resolve_route(&cfg, "m").unwrap().vertex_first);

        let parsed: VertexConfig =
            serde_json::from_str(r#"{"enabled":true,"preference":"accounts_first"}"#).unwrap();
        assert_eq!(parsed.preference, UpstreamPreference::AccountsFirst);
        assert_eq!(parsed.location, "global");
    }

    #[test]
    fn model_list_page_yields_deduplicated_gemini_ids() {
        let page = json!({
            "publisherModels": [
                { "name": "publishers/google/models/gemini-3.8-flash" },
                { "name": "publishers/google/models/gemini-3.8-flash@default" },
                { "name": "publishers/google/models/imagen-4" },
                { "name": "publishers/google/models/gemini-3.1-pro-preview" },
                { "versionId": "no-name" }
            ]
        });
        let ids: std::collections::BTreeSet<_> = parse_model_ids(&page).into_iter().collect();
        assert_eq!(
            ids.into_iter().collect::<Vec<_>>(),
            vec!["gemini-3.1-pro-preview", "gemini-3.8-flash"]
        );
        assert!(parse_model_ids(&json!({})).is_empty());
    }

    #[test]
    fn route_requires_enabled_config_and_a_mapping_hit() {
        let mut cfg = config(&[("gemini-3.8-flash", "gemini-3.8-flash")]);
        assert!(resolve_route(&cfg, "claude-opus-4-6-thinking").is_none());
        assert!(resolve_route(&cfg, "gemini-3.8-flash").is_some());

        cfg.enabled = false;
        assert!(resolve_route(&cfg, "gemini-3.8-flash").is_none());
        cfg.enabled = true;
        cfg.project_id = "  ".to_string();
        assert!(resolve_route(&cfg, "gemini-3.8-flash").is_none());
    }

    #[test]
    fn route_prefers_exact_then_longest_wildcard_and_derives_thinking_level() {
        let cfg = config(&[
            ("gemini-3.8-flash", "exact-target"),
            ("gemini-3.8-flash*", "flash-wildcard"),
            ("gemini-3*", "broad-wildcard"),
        ]);

        let exact = resolve_route(&cfg, "models/Gemini-3.8-Flash").unwrap();
        assert_eq!(exact.model, "exact-target");
        assert_eq!(exact.thinking_level, None);

        let tiered = resolve_route(&cfg, "gemini-3.8-flash-high").unwrap();
        assert_eq!(tiered.model, "flash-wildcard");
        assert_eq!(tiered.thinking_level, Some("high"));

        let broad = resolve_route(&cfg, "gemini-3.1-pro-low").unwrap();
        assert_eq!(broad.model, "broad-wildcard");
        assert_eq!(broad.thinking_level, Some("low"));
    }

    #[test]
    fn endpoint_url_uses_global_or_regional_host() {
        let mut route = resolve_route(&config(&[("m", "gemini-3.8-flash")]), "m").unwrap();
        assert_eq!(
            endpoint_url(&route, "streamGenerateContent"),
            "https://aiplatform.googleapis.com/v1/projects/aurora-1/locations/global/publishers/google/models/gemini-3.8-flash:streamGenerateContent?alt=sse"
        );
        route.location = "us-central1".to_string();
        assert_eq!(
            endpoint_url(&route, "generateContent"),
            "https://us-central1-aiplatform.googleapis.com/v1/projects/aurora-1/locations/us-central1/publishers/google/models/gemini-3.8-flash:generateContent"
        );
    }

    #[test]
    fn request_body_drops_unknown_fields_and_fixes_tool_result_roles() {
        let client_body = json!({
            "sessionId": "abc",
            "requestId": "agent/1",
            "generationConfig": { "maxOutputTokens": 100 },
            "systemInstruction": { "role": "user", "parts": [{ "text": "sys" }] },
            "tools": [{ "functionDeclarations": [] }],
            "contents": [
                { "role": "user", "parts": [{ "text": "hi" }] },
                { "role": "model", "parts": [{ "functionCall": { "name": "f", "args": {} }, "thoughtSignature": "real-sig" }] },
                { "role": "model", "parts": [{ "functionResponse": { "name": "f", "response": {} } }] },
                { "role": "model", "parts": [{ "functionCall": { "name": "g", "args": {} } }] }
            ]
        });
        let body = build_request_body(&client_body, None, &none_rejected);

        assert!(body.get("sessionId").is_none());
        assert!(body.get("requestId").is_none());
        assert_eq!(body["generationConfig"]["maxOutputTokens"], 100);
        assert!(body.get("tools").is_some());
        let contents = body["contents"].as_array().unwrap();
        // Tool results move to the user role; existing signatures are kept as sent.
        assert_eq!(contents[1]["parts"][0]["thoughtSignature"], "real-sig");
        assert_eq!(contents[2]["role"], "user");
        // A tool call the client sent without a signature gets the validator-skip value.
        assert_eq!(
            contents[3]["parts"][0]["thoughtSignature"],
            SENTINEL_SIGNATURE
        );
    }

    #[test]
    fn request_body_unwraps_v1internal_envelope() {
        let client_body = json!({
            "project": "p",
            "model": "m",
            "request": { "contents": [{ "role": "user", "parts": [{ "text": "hi" }] }] }
        });
        let body = build_request_body(&client_body, None, &none_rejected);
        assert_eq!(body["contents"][0]["parts"][0]["text"], "hi");
        assert!(body.get("project").is_none());
        assert!(body.get("request").is_none());
    }

    #[test]
    fn rejected_signatures_are_replaced_while_accepted_ones_are_kept() {
        let client_body = json!({
            "contents": [
                { "role": "model", "parts": [
                    { "thought": true, "text": "thinking", "thoughtSignature": "foreign" },
                    { "text": "answer", "thoughtSignature": "foreign" },
                    { "functionCall": { "name": "f", "args": {} }, "thoughtSignature": "foreign" }
                ] },
                { "role": "model", "parts": [
                    { "thought": true, "text": "later thinking", "thoughtSignature": "vertex-issued" },
                    { "functionCall": { "name": "g", "args": {} }, "thoughtSignature": "vertex-issued" }
                ] }
            ]
        });
        let body = build_request_body(&client_body, None, &|signature| signature == "foreign");

        // Rejected: the thought part is dropped, text loses its signature, the call gets the skip value.
        let rejected = body["contents"][0]["parts"].as_array().unwrap();
        assert_eq!(rejected.len(), 2);
        assert!(rejected[0].get("thoughtSignature").is_none());
        assert_eq!(rejected[1]["thoughtSignature"], SENTINEL_SIGNATURE);
        // Not rejected: untouched, so Vertex keeps its own reasoning context.
        let accepted = body["contents"][1]["parts"].as_array().unwrap();
        assert_eq!(accepted.len(), 2);
        assert_eq!(accepted[1]["thoughtSignature"], "vertex-issued");
    }

    #[test]
    fn rejected_signature_memory_covers_every_signature_in_the_failed_request() {
        let client_body = json!({
            "contents": [
                { "role": "model", "parts": [
                    { "functionCall": { "name": "f", "args": {} }, "thoughtSignature": "memory-test-sig-a" },
                    { "text": "x", "thoughtSignature": SENTINEL_SIGNATURE }
                ] },
                { "role": "model", "parts": [{ "text": "y", "thought_signature": "memory-test-sig-b" }] }
            ]
        });
        assert!(!is_rejected_signature("memory-test-sig-a"));
        remember_rejected_signatures(&client_body);
        assert!(is_rejected_signature("memory-test-sig-a"));
        assert!(is_rejected_signature("memory-test-sig-b"));
        // The skip value itself is never treated as a bad signature.
        assert!(!is_rejected_signature(SENTINEL_SIGNATURE));
        assert!(!is_rejected_signature("memory-test-sig-unseen"));
    }

    #[test]
    fn thinking_level_respects_client_choices() {
        let dynamic = json!({ "contents": [], "generationConfig": { "thinkingConfig": { "includeThoughts": true, "thinkingBudget": -1 } } });
        let body = build_request_body(&dynamic, Some("high"), &none_rejected);
        let thinking = &body["generationConfig"]["thinkingConfig"];
        assert_eq!(thinking["thinkingLevel"], "high");
        assert!(thinking.get("thinkingBudget").is_none());
        assert_eq!(thinking["includeThoughts"], true);

        let explicit_budget = json!({ "contents": [], "generationConfig": { "thinkingConfig": { "thinkingBudget": 2048 } } });
        let body = build_request_body(&explicit_budget, Some("high"), &none_rejected);
        assert_eq!(
            body["generationConfig"]["thinkingConfig"]["thinkingBudget"],
            2048
        );
        assert!(body["generationConfig"]["thinkingConfig"]
            .get("thinkingLevel")
            .is_none());

        let explicit_level = json!({ "contents": [], "generationConfig": { "thinkingConfig": { "thinkingLevel": "low" } } });
        let body = build_request_body(&explicit_level, Some("high"), &none_rejected);
        assert_eq!(
            body["generationConfig"]["thinkingConfig"]["thinkingLevel"],
            "low"
        );

        let missing = json!({ "contents": [] });
        let body = build_request_body(&missing, Some("medium"), &none_rejected);
        assert_eq!(
            body["generationConfig"]["thinkingConfig"]["thinkingLevel"],
            "medium"
        );
    }

    #[test]
    fn adc_file_must_be_a_refreshable_user_credential() {
        let path = Path::new("adc.json");
        let user = r#"{"type":"authorized_user","client_id":"id","client_secret":"secret","refresh_token":"rt","quota_project_id":"aurora-1"}"#;
        let adc = parse_adc(user, path).unwrap();
        assert_eq!(adc.quota_project_id.as_deref(), Some("aurora-1"));

        let service_account = r#"{"type":"service_account","client_email":"x@y"}"#;
        // `.err()` rather than `unwrap_err()`: AdcFile holds secrets and deliberately has no Debug impl.
        assert!(parse_adc(service_account, path)
            .err()
            .unwrap()
            .contains("authorized_user"));
        let incomplete = r#"{"type":"authorized_user","client_id":"id"}"#;
        assert!(parse_adc(incomplete, path)
            .err()
            .unwrap()
            .contains("missing"));
        assert!(parse_adc("not json", path).is_err());
    }
}
