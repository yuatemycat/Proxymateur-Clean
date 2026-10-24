//! OpenAI-Compatible Upstream Gateway
//!
//! Direct-routes Gemini native requests (streamGenerateContent & generateContent)
//! to OpenAI-compatible upstream providers (NVIDIA NIM, DeepSeek API, Ollama, etc.),
//! handling bidirectional protocol transpilation (tools, multimodal, reasoning tokens).

use std::collections::HashMap;
use std::sync::{OnceLock, RwLock};
use std::time::Duration;

use axum::{
    body::Body,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use bytes::Bytes;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// Individual route entry from GUI
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct OpenAiRouteConfig {
    pub model_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub upstream_model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timeout_secs: Option<u64>,
}

fn default_timeout_secs() -> u64 {
    120
}

/// OpenAI Upstream Configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct OpenAiUpstreamConfig {
    pub enabled: bool,
    /// Upstream base URL (e.g. "https://integrate.api.nvidia.com/v1" or "https://api.deepseek.com/v1")
    #[serde(alias = "default_base_url")]
    pub base_url: String,
    /// API key (falls back to NVIDIA_API_KEY / OPENAI_API_KEY environment variables if empty)
    #[serde(alias = "default_api_key")]
    pub api_key: String,
    /// Default request timeout
    #[serde(default = "default_timeout_secs")]
    pub default_timeout_secs: u64,
    /// Optional prefix for auto-detecting OpenAI upstream routes
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_route_prefix: Option<String>,
    /// Configured routes from GUI
    #[serde(default)]
    pub routes: Vec<OpenAiRouteConfig>,
    /// Exposed models to advertise to agy CLI / UI dropdown
    #[serde(default)]
    pub exposed_models: Vec<String>,
    /// Client model name -> Upstream model ID mapping (supports trailing `*` wildcard)
    #[serde(default)]
    pub model_mapping: HashMap<String, String>,
}

impl Default for OpenAiUpstreamConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            base_url: String::new(),
            api_key: String::new(),
            default_timeout_secs: 120,
            auto_route_prefix: None,
            routes: Vec::new(),
            exposed_models: Vec::new(),
            model_mapping: HashMap::new(),
        }
    }
}

static GLOBAL_OPENAI_CONFIG: OnceLock<RwLock<OpenAiUpstreamConfig>> = OnceLock::new();

/// Retrieve current OpenAI upstream configuration
pub fn get_config() -> OpenAiUpstreamConfig {
    GLOBAL_OPENAI_CONFIG
        .get()
        .and_then(|lock| lock.read().ok())
        .map(|cfg| cfg.clone())
        .unwrap_or_default()
}

/// Update global OpenAI upstream configuration
pub fn update_config(mut config: OpenAiUpstreamConfig) {
    if config.exposed_models.is_empty() {
        for route in &config.routes {
            let m_id = route.model_id.trim().to_string();
            if !m_id.is_empty() && !config.exposed_models.contains(&m_id) {
                config.exposed_models.push(m_id);
            }
        }
    }
    for route in &config.routes {
        let m_id = route.model_id.trim().to_string();
        if !m_id.is_empty() {
            if let Some(up) = &route.upstream_model {
                config.model_mapping.insert(m_id, up.clone());
            }
        }
    }
    tracing::info!(
        "[OpenAI-Upstream] Config updated: enabled={}, base_url={}, routes={}, exposed_models={:?}, mappings={}",
        config.enabled,
        config.base_url,
        config.routes.len(),
        config.exposed_models,
        config.model_mapping.len()
    );
    if let Some(lock) = GLOBAL_OPENAI_CONFIG.get() {
        if let Ok(mut cfg) = lock.write() {
            *cfg = config;
        }
    } else {
        let _ = GLOBAL_OPENAI_CONFIG.set(RwLock::new(config));
    }
}

/// List exposed model IDs to advertise in the models endpoint (only when enabled
/// and only for models explicitly chosen in `exposed_models`, matching Vertex).
pub fn exposed_model_ids() -> Vec<String> {
    exposed_model_ids_for(&get_config())
}

pub fn exposed_model_ids_for(config: &OpenAiUpstreamConfig) -> Vec<String> {
    if !config.enabled {
        return Vec::new();
    }
    let mut models = Vec::new();
    for m in &config.exposed_models {
        let trimmed = m.trim().to_string();
        if !trimmed.is_empty() && !models.contains(&trimmed) {
            models.push(trimmed);
        }
    }

    // Syndicate reasoning effort variants (-low, -medium, -high) for DeepSeek & reasoning models
    // so agy.exe Bubbletea TUI collapses them into a single row with the ←/→ Effort slider
    let mut effort_variants = Vec::new();
    for m in &models {
        let lower = m.to_lowercase();
        if (lower.contains("deepseek")
            || lower.contains("reason")
            || lower.contains("nemotron")
            || lower.contains("step")
            || lower.contains("kimi")
            || lower.contains("o1")
            || lower.contains("o3")
            || lower.contains("o4")
            || lower.contains("gpt-5")
            || lower.contains("qwq"))
            && !lower.ends_with("-low")
            && !lower.ends_with("-medium")
            && !lower.ends_with("-high")
            && !lower.ends_with("-effort")
        {
            effort_variants.push(format!("{}-low", m));
            effort_variants.push(format!("{}-medium", m));
            effort_variants.push(format!("{}-high", m));
        }
    }
    for ev in effort_variants {
        if !models.contains(&ev) {
            models.push(ev);
        }
    }

    models
}

/// Resolved OpenAI route
#[derive(Debug, Clone, PartialEq)]
pub struct OpenAiRoute {
    pub upstream_model: String,
    pub base_url: String,
    pub api_key: String,
    /// OpenAI `reasoning_effort` to forward (low/medium/high), only for models
    /// that document the parameter (o1/o3/o4/gpt-5/gpt-oss). `None` leaves it off.
    pub reasoning_effort: Option<String>,
}

/// Whether an upstream model name documents the OpenAI `reasoning_effort` parameter.
/// DeepSeek is excluded because effort is expressed there via the chat/reasoner split,
/// and arbitrary providers may reject an unknown field.
fn supports_reasoning_effort(upstream_model: &str) -> bool {
    let m = upstream_model.to_lowercase();
    let stem = m.rsplit('/').next().unwrap_or(&m);
    stem.starts_with("o1")
        || stem.starts_with("o3")
        || stem.starts_with("o4")
        || stem.starts_with("gpt-5")
        || stem.starts_with("gpt-oss")
}

/// Resolve client model to an OpenAI upstream route if matched
pub fn resolve_route(config: &OpenAiUpstreamConfig, client_model: &str) -> Option<OpenAiRoute> {
    if !config.enabled {
        return None;
    }

    let raw_requested = client_model
        .trim()
        .trim_start_matches("models/")
        .to_lowercase();

    // Extract effort suffix if present (-high, -medium, -low, -effort)
    let (base_requested, effort_tier) = if let Some(stripped) = raw_requested.strip_suffix("-high")
    {
        (stripped, Some("high"))
    } else if let Some(stripped) = raw_requested.strip_suffix("-medium") {
        (stripped, Some("medium"))
    } else if let Some(stripped) = raw_requested.strip_suffix("-low") {
        (stripped, Some("low"))
    } else if let Some(stripped) = raw_requested.strip_suffix("-effort") {
        (stripped, Some("high"))
    } else {
        (raw_requested.as_str(), None)
    };

    let requested = base_requested;

    // 0. Check explicit routes configured via GUI (try raw first, then base)
    let route_match = config.routes.iter().find(|r| {
        let id = r
            .model_id
            .trim()
            .trim_start_matches("models/")
            .to_lowercase();
        id == raw_requested
            || id == requested
            || (id.ends_with('*') && requested.starts_with(id.trim_end_matches('*')))
    });

    let (mut upstream_model, route_base_url, route_api_key) = if let Some(r) = route_match {
        let up = r
            .upstream_model
            .as_deref()
            .unwrap_or(&r.model_id)
            .trim()
            .to_string();
        (up, r.base_url.clone(), r.api_key.clone())
    } else {
        // 1. Match in model_mapping (raw then base)
        let mapped = config
            .model_mapping
            .iter()
            .find(|(key, _)| {
                let k = key.trim().to_lowercase();
                k == raw_requested || k == requested
            })
            .map(|(_, val)| val.clone());

        // 2. Match in exposed_models (raw then base)
        let exposed = config
            .exposed_models
            .iter()
            .find(|m| {
                let lower = m.trim().to_lowercase();
                lower == raw_requested || lower == requested
            })
            .map(|m| m.trim().to_string());

        // 3. Wildcard prefix match in model_mapping
        let wildcard = config
            .model_mapping
            .iter()
            .filter_map(|(key, val)| {
                let prefix = key.trim().strip_suffix('*')?.to_lowercase();
                if requested.starts_with(&prefix) {
                    Some((prefix.len(), val.clone()))
                } else {
                    None
                }
            })
            .max_by_key(|(len, _)| *len)
            .map(|(_, val)| val);

        // 4. Auto-detect models with explicit deepseek or openai/ prefix
        let auto_detect = if requested.starts_with("deepseek") || requested.starts_with("openai/") {
            Some(client_model.trim().trim_start_matches("models/").to_string())
        } else {
            None
        };

        let up = mapped.or(exposed).or(wildcard).or(auto_detect)?;
        (up, None, None)
    };

    // If effort_tier is high, and model is deepseek-chat or has a known reasoner sibling, route to reasoner
    if effort_tier == Some("high") {
        if upstream_model == "deepseek-chat" {
            upstream_model = "deepseek-reasoner".to_string();
        }
    } else if effort_tier == Some("low") || effort_tier == Some("medium") {
        if upstream_model == "deepseek-reasoner" {
            upstream_model = "deepseek-chat".to_string();
        }
    }

    // Strip any trailing effort suffix from upstream model
    for suffix in ["-high", "-medium", "-low", "-effort"] {
        if upstream_model.ends_with(suffix) {
            upstream_model = upstream_model.strip_suffix(suffix).unwrap().to_string();
            break;
        }
    }

    if upstream_model.starts_with("openai/") {
        upstream_model = upstream_model.strip_prefix("openai/").unwrap().to_string();
    }

    // Resolve API key: per-route -> global -> environment variable
    let mut api_key = route_api_key
        .unwrap_or_else(|| config.api_key.clone())
        .trim()
        .to_string();
    if api_key.is_empty() {
        if let Ok(env_key) = std::env::var("OPENAI_API_KEY") {
            api_key = env_key.trim().to_string();
        }
    }

    // Resolve Base URL: per-route -> global
    let base_url = route_base_url
        .unwrap_or_else(|| config.base_url.clone())
        .trim()
        .trim_end_matches('/')
        .to_string();
    if base_url.is_empty() {
        return None;
    }

    // Forward the client's effort tier as `reasoning_effort` only for models that
    // document it; DeepSeek already consumed the tier via the chat/reasoner swap above.
    let reasoning_effort = effort_tier
        .filter(|_| supports_reasoning_effort(&upstream_model))
        .map(|tier| tier.to_string());

    Some(OpenAiRoute {
        upstream_model,
        base_url,
        api_key,
        reasoning_effort,
    })
}

/// Map an OpenAI `finish_reason` to a Gemini `finishReason`.
/// Gemini defines STOP / MAX_TOKENS / SAFETY / RECITATION / OTHER — there is no
/// tool-call variant, so tool calls finish as STOP (the functionCall parts carry the intent).
fn map_finish_reason(openai_reason: Option<&str>) -> &'static str {
    match openai_reason {
        Some("length") => "MAX_TOKENS",
        Some("content_filter") => "SAFETY",
        _ => "STOP",
    }
}

/// Convert an OpenAI `usage` object into a Gemini `usageMetadata` object.
/// Returns `Value::Null` when no usable counts are present.
fn openai_usage_to_gemini(usage: &Value) -> Value {
    let prompt = usage
        .get("prompt_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let completion = usage
        .get("completion_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let total = usage
        .get("total_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(prompt + completion);
    if prompt == 0 && completion == 0 && total == 0 {
        return Value::Null;
    }

    // DeepSeek / OpenAI report reasoning tokens inside completion_tokens_details.
    let reasoning = usage
        .get("completion_tokens_details")
        .and_then(|d| d.get("reasoning_tokens"))
        .and_then(Value::as_u64)
        .unwrap_or(0);

    let mut meta = json!({
        "promptTokenCount": prompt,
        "candidatesTokenCount": completion,
        "totalTokenCount": total,
    });
    if reasoning > 0 {
        meta["thoughtsTokenCount"] = json!(reasoning);
    }
    meta
}

/// Recursively clean Gemini uppercase schema types to standard lowercase JSON schema
fn clean_schema(val: &mut Value) {
    if let Value::Object(map) = val {
        if let Some(t) = map.get_mut("type") {
            if let Some(s) = t.as_str() {
                *t = Value::String(s.to_lowercase());
            }
        }
        for (_, v) in map.iter_mut() {
            clean_schema(v);
        }
    } else if let Value::Array(arr) = val {
        for v in arr {
            clean_schema(v);
        }
    }
}

/// Translate Gemini request payload to OpenAI chat completions format
pub fn build_openai_request(
    gemini_body: &Value,
    upstream_model: &str,
    stream: bool,
    reasoning_effort: Option<&str>,
) -> Result<Value, String> {
    let req = gemini_body.get("request").unwrap_or(gemini_body);
    let mut messages: Vec<Value> = Vec::new();

    // 1. Process systemInstruction
    if let Some(sys_inst) = req
        .get("systemInstruction")
        .or_else(|| req.get("system_instruction"))
    {
        let mut sys_parts = Vec::new();
        if let Some(parts) = sys_inst.get("parts").and_then(Value::as_array) {
            for part in parts {
                if let Some(text) = part.get("text").and_then(Value::as_str) {
                    sys_parts.push(text);
                }
            }
        }
        if !sys_parts.is_empty() {
            messages.push(json!({
                "role": "system",
                "content": sys_parts.join("\n\n")
            }));
        }
    }

    // 2. Process contents
    if let Some(contents) = req.get("contents").and_then(Value::as_array) {
        for item in contents {
            let role = item.get("role").and_then(Value::as_str).unwrap_or("user");
            let parts = item.get("parts").and_then(Value::as_array);

            if let Some(parts) = parts {
                if role == "user" {
                    // Check if parts are functionResponse
                    let mut has_func_resp = false;
                    for part in parts {
                        if let Some(func_resp) = part
                            .get("functionResponse")
                            .or_else(|| part.get("function_response"))
                        {
                            has_func_resp = true;
                            let name = func_resp
                                .get("name")
                                .and_then(Value::as_str)
                                .unwrap_or("unknown");
                            let default_resp = json!({});
                            let resp_val = func_resp.get("response").unwrap_or(&default_resp);
                            let content_str = if let Some(s) = resp_val.as_str() {
                                s.to_string()
                            } else {
                                serde_json::to_string(resp_val).unwrap_or_default()
                            };

                            messages.push(json!({
                                "role": "tool",
                                "tool_call_id": format!("call_{}", name),
                                "content": content_str
                            }));
                        }
                    }

                    if !has_func_resp {
                        // User prompt parts (text + multimodal inlineData)
                        let mut user_content_items = Vec::new();
                        for part in parts {
                            if let Some(text) = part.get("text").and_then(Value::as_str) {
                                user_content_items.push(json!({
                                    "type": "text",
                                    "text": text
                                }));
                            } else if let Some(inline) =
                                part.get("inlineData").or_else(|| part.get("inline_data"))
                            {
                                let mime = inline
                                    .get("mimeType")
                                    .or_else(|| inline.get("mime_type"))
                                    .and_then(Value::as_str)
                                    .unwrap_or("image/jpeg");
                                let b64 = inline.get("data").and_then(Value::as_str).unwrap_or("");
                                if !b64.is_empty() {
                                    user_content_items.push(json!({
                                        "type": "image_url",
                                        "image_url": {
                                            "url": format!("data:{};base64,{}", mime, b64)
                                        }
                                    }));
                                }
                            }
                        }

                        if user_content_items.len() == 1 && user_content_items[0]["type"] == "text"
                        {
                            messages.push(json!({
                                "role": "user",
                                "content": user_content_items[0]["text"]
                            }));
                        } else if !user_content_items.is_empty() {
                            messages.push(json!({
                                "role": "user",
                                "content": user_content_items
                            }));
                        }
                    }
                } else if role == "model" || role == "assistant" {
                    let mut text_parts = Vec::new();
                    let mut tool_calls = Vec::new();

                    for part in parts {
                        // Skip Gemini `thought: true` parts when replaying assistant history:
                        // OpenAI / DeepSeek / NIM upstreams forbid feeding prior reasoning_content
                        // back into assistant.content on subsequent turns.
                        if part.get("thought").and_then(Value::as_bool) == Some(true) {
                            continue;
                        }
                        if let Some(text) = part.get("text").and_then(Value::as_str) {
                            text_parts.push(text);
                        } else if let Some(call) = part
                            .get("functionCall")
                            .or_else(|| part.get("function_call"))
                        {
                            let name = call
                                .get("name")
                                .and_then(Value::as_str)
                                .unwrap_or("unknown");
                            let default_args = json!({});
                            let args = call.get("args").unwrap_or(&default_args);
                            let args_str = serde_json::to_string(args).unwrap_or_default();
                            tool_calls.push(json!({
                                "id": format!("call_{}", name),
                                "type": "function",
                                "function": {
                                    "name": name,
                                    "arguments": args_str
                                }
                            }));
                        }
                    }

                    let content_val = if text_parts.is_empty() {
                        Value::Null
                    } else {
                        Value::String(text_parts.join(""))
                    };

                    let mut msg = json!({
                        "role": "assistant",
                        "content": content_val
                    });

                    if !tool_calls.is_empty() {
                        msg["tool_calls"] = Value::Array(tool_calls);
                    }
                    messages.push(msg);
                }
            }
        }
    }

    let mut openai_payload = json!({
        "model": upstream_model,
        "messages": messages,
        "stream": stream
    });

    // Request token accounting back on the final streaming chunk (OpenAI spec).
    if stream {
        openai_payload["stream_options"] = json!({ "include_usage": true });
    }

    // Forward reasoning effort for models that document the parameter.
    let body_effort = req
        .get("generationConfig")
        .or_else(|| req.get("generation_config"))
        .and_then(|gc| {
            gc.get("thinkingConfig")
                .or_else(|| gc.get("thinking_config"))
        })
        .and_then(|tc| {
            tc.get("thinkingLevel")
                .or_else(|| tc.get("thinking_level"))
                .or_else(|| tc.get("effort"))
        })
        .and_then(Value::as_str)
        .and_then(|lvl| match lvl.trim().to_ascii_lowercase().as_str() {
            "low" | "minimal" | "thinking_level_low" | "thinking_level_minimal" => Some("low"),
            "medium" | "thinking_level_medium" => Some("medium"),
            "high" | "thinking_level_high" => Some("high"),
            _ => None,
        });
    if let Some(effort) = reasoning_effort
        .or_else(|| body_effort.filter(|_| supports_reasoning_effort(upstream_model)))
    {
        openai_payload["reasoning_effort"] = json!(effort);
    }

    // 3. Process tools declarations
    if let Some(tools_arr) = req.get("tools").and_then(Value::as_array) {
        let mut openai_tools = Vec::new();
        for tool_entry in tools_arr {
            let decls = tool_entry
                .get("functionDeclarations")
                .or_else(|| tool_entry.get("function_declarations"))
                .and_then(Value::as_array);

            if let Some(decls) = decls {
                for decl in decls {
                    let name = decl.get("name").and_then(Value::as_str).unwrap_or_default();
                    let desc = decl
                        .get("description")
                        .and_then(Value::as_str)
                        .unwrap_or_default();
                    let mut params = decl.get("parameters").cloned().unwrap_or(json!({
                        "type": "object",
                        "properties": {}
                    }));
                    clean_schema(&mut params);

                    openai_tools.push(json!({
                        "type": "function",
                        "function": {
                            "name": name,
                            "description": desc,
                            "parameters": params
                        }
                    }));
                }
            }
        }

        if !openai_tools.is_empty() {
            openai_payload["tools"] = Value::Array(openai_tools);
            openai_payload["tool_choice"] = json!("auto");
        }
    }

    // 4. Generation parameters
    if let Some(gc) = req
        .get("generationConfig")
        .or_else(|| req.get("generation_config"))
    {
        if let Some(temp) = gc.get("temperature").and_then(Value::as_f64) {
            openai_payload["temperature"] = json!(temp);
        }
        if let Some(max_tokens) = gc
            .get("maxOutputTokens")
            .or_else(|| gc.get("max_output_tokens"))
            .and_then(Value::as_u64)
        {
            openai_payload["max_tokens"] = json!(max_tokens);
        }
        if let Some(top_p) = gc
            .get("topP")
            .or_else(|| gc.get("top_p"))
            .and_then(Value::as_f64)
        {
            openai_payload["top_p"] = json!(top_p);
        }
        if let Some(freq) = gc
            .get("frequencyPenalty")
            .or_else(|| gc.get("frequency_penalty"))
            .and_then(Value::as_f64)
        {
            openai_payload["frequency_penalty"] = json!(freq);
        }
        if let Some(pres) = gc
            .get("presencePenalty")
            .or_else(|| gc.get("presence_penalty"))
            .and_then(Value::as_f64)
        {
            openai_payload["presence_penalty"] = json!(pres);
        }
        if let Some(seed) = gc.get("seed").and_then(Value::as_i64) {
            openai_payload["seed"] = json!(seed);
        }
        if let Some(n) = gc
            .get("candidateCount")
            .or_else(|| gc.get("candidate_count"))
            .and_then(Value::as_u64)
            .filter(|n| *n > 1)
        {
            openai_payload["n"] = json!(n);
        }
        // stopSequences -> stop (OpenAI accepts a string or an array of up to 4)
        if let Some(stops) = gc
            .get("stopSequences")
            .or_else(|| gc.get("stop_sequences"))
            .and_then(Value::as_array)
        {
            let stop: Vec<Value> = stops
                .iter()
                .filter(|s| s.as_str().map(|s| !s.is_empty()).unwrap_or(false))
                .take(4)
                .cloned()
                .collect();
            if !stop.is_empty() {
                openai_payload["stop"] = Value::Array(stop);
            }
        }
    }

    Ok(openai_payload)
}

static OPENAI_CLIENT: OnceLock<RwLock<Option<rquest::Client>>> = OnceLock::new();

fn openai_client() -> rquest::Client {
    let cell = OPENAI_CLIENT.get_or_init(|| RwLock::new(None));
    if let Ok(guard) = cell.read() {
        if let Some(ref client) = *guard {
            return client.clone();
        }
    }

    let mut guard = cell.write().unwrap_or_else(|p| p.into_inner());
    if let Some(ref client) = *guard {
        return client.clone();
    }

    let mut builder = rquest::Client::builder()
        .connect_timeout(Duration::from_secs(25))
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
                tracing::info!("[OpenAI-Upstream] Enabled upstream proxy: {}", url);
            }
        }
    }

    let client = builder.build().unwrap_or_else(|e| {
        tracing::error!(
            "[OpenAI-Upstream] Failed to build HTTP client: {}, using fallback",
            e
        );
        rquest::Client::new()
    });
    *guard = Some(client.clone());
    client
}

/// Accumulator for OpenAI streaming tool calls
#[derive(Default)]
struct ToolCallAccumulator {
    id: String,
    name: String,
    arguments: String,
}

/// Stream response converter from OpenAI SSE to Gemini SSE
fn stream_response(response: rquest::Response, route: &OpenAiRoute) -> Response {
    let mut upstream_stream = response.bytes_stream();
    let model = route.upstream_model.clone();

    let stream = async_stream::stream! {
        let mut buffer = String::new();
        let mut tool_accumulators: HashMap<usize, ToolCallAccumulator> = HashMap::new();
        let mut last_finish_reason: Option<String> = None;
        let mut usage_meta: Value = Value::Null;
        let mut emitted_final = false;

        while let Some(chunk) = upstream_stream.next().await {
            match chunk {
                Ok(bytes) => {
                    let chunk_str = match std::str::from_utf8(&bytes) {
                        Ok(s) => s,
                        Err(_) => continue,
                    };
                    buffer.push_str(chunk_str);

                    while let Some(line_end) = buffer.find('\n') {
                        let line = buffer[..line_end].trim().to_string();
                        buffer = buffer[line_end + 1..].to_string();

                        if line.is_empty() {
                            continue;
                        }

                        if let Some(stripped) = line.strip_prefix("data: ") {
                            let data_str = stripped.trim();
                            if data_str == "[DONE]" {
                                // Flush accumulated tool calls, then the final chunk.
                                for (_, acc) in tool_accumulators.drain() {
                                    if !acc.name.is_empty() {
                                        let parsed_args: Value = serde_json::from_str(&acc.arguments).unwrap_or(json!({}));
                                        let gemini_chunk = json!({
                                            "candidates": [{
                                                "content": {
                                                    "parts": [{
                                                        "functionCall": {
                                                            "name": acc.name,
                                                            "args": parsed_args
                                                        }
                                                    }],
                                                    "role": "model"
                                                }
                                            }]
                                        });
                                        yield Ok::<Bytes, String>(Bytes::from(format!("data: {}\n\n", serde_json::to_string(&gemini_chunk).unwrap_or_default())));
                                    }
                                }

                                let mut finish_chunk = json!({
                                    "candidates": [{
                                        "finishReason": map_finish_reason(last_finish_reason.as_deref())
                                    }]
                                });
                                if !usage_meta.is_null() {
                                    finish_chunk["usageMetadata"] = usage_meta.clone();
                                }
                                yield Ok::<Bytes, String>(Bytes::from(format!("data: {}\n\n", serde_json::to_string(&finish_chunk).unwrap_or_default())));
                                emitted_final = true;
                                break;
                            }

                            if let Ok(val) = serde_json::from_str::<Value>(data_str) {
                                // Usage arrives on a trailing chunk (stream_options.include_usage).
                                if let Some(usage) = val.get("usage").filter(|u| !u.is_null()) {
                                    let converted = openai_usage_to_gemini(usage);
                                    if !converted.is_null() {
                                        usage_meta = converted;
                                    }
                                }
                                if let Some(choice) = val.get("choices").and_then(|c| c.get(0)) {
                                    if let Some(fr) = choice.get("finish_reason").and_then(Value::as_str) {
                                        last_finish_reason = Some(fr.to_string());
                                    }
                                    let default_delta = json!({});
                                    let delta = choice.get("delta").unwrap_or(&default_delta);

                                    // 1. Thinking / reasoning content (`reasoning_content` or `reasoning`)
                                    if let Some(reasoning) = delta
                                        .get("reasoning_content")
                                        .or_else(|| delta.get("reasoning"))
                                        .and_then(Value::as_str)
                                    {
                                        if !reasoning.is_empty() {
                                            let gemini_chunk = json!({
                                                "candidates": [{
                                                    "content": {
                                                        "parts": [{
                                                            "text": reasoning,
                                                            "thought": true
                                                        }],
                                                        "role": "model"
                                                    }
                                                }]
                                            });
                                            yield Ok::<Bytes, String>(Bytes::from(format!("data: {}\n\n", serde_json::to_string(&gemini_chunk).unwrap_or_default())));
                                        }
                                    }

                                    // 2. Standard text content
                                    if let Some(content) = delta.get("content").and_then(Value::as_str) {
                                        if !content.is_empty() {
                                            let gemini_chunk = json!({
                                                "candidates": [{
                                                    "content": {
                                                        "parts": [{
                                                            "text": content
                                                        }],
                                                        "role": "model"
                                                    }
                                                }]
                                            });
                                            yield Ok::<Bytes, String>(Bytes::from(format!("data: {}\n\n", serde_json::to_string(&gemini_chunk).unwrap_or_default())));
                                        }
                                    }

                                    // 3. Tool calls delta accumulation
                                    if let Some(tool_calls) = delta.get("tool_calls").and_then(Value::as_array) {
                                        for tc in tool_calls {
                                            let index = tc.get("index").and_then(Value::as_u64).unwrap_or(0) as usize;
                                            let acc = tool_accumulators.entry(index).or_default();

                                            if let Some(id) = tc.get("id").and_then(Value::as_str) {
                                                acc.id = id.to_string();
                                            }
                                            if let Some(func) = tc.get("function") {
                                                if let Some(name) = func.get("name").and_then(Value::as_str) {
                                                    acc.name.push_str(name);
                                                }
                                                if let Some(args_chunk) = func.get("arguments").and_then(Value::as_str) {
                                                    acc.arguments.push_str(args_chunk);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("[OpenAI-Upstream] Stream error for model {}: {}", model, e);
                    let err = json!({
                        "error": {
                            "code": 503,
                            "message": format!("OpenAI upstream stream error: {}", e),
                            "status": "UNAVAILABLE"
                        }
                    });
                    yield Ok::<Bytes, String>(Bytes::from(format!("data: {}\n\n", err)));
                    emitted_final = true;
                    break;
                }
            }
        }

        // Some OpenAI-compatible servers close the stream without a `[DONE]` sentinel.
        // Flush pending tool calls and a final chunk so the client sees a clean end.
        if !emitted_final {
            for (_, acc) in tool_accumulators.drain() {
                if !acc.name.is_empty() {
                    let parsed_args: Value = serde_json::from_str(&acc.arguments).unwrap_or(json!({}));
                    let gemini_chunk = json!({
                        "candidates": [{
                            "content": {
                                "parts": [{
                                    "functionCall": { "name": acc.name, "args": parsed_args }
                                }],
                                "role": "model"
                            }
                        }]
                    });
                    yield Ok::<Bytes, String>(Bytes::from(format!("data: {}\n\n", serde_json::to_string(&gemini_chunk).unwrap_or_default())));
                }
            }
            let mut finish_chunk = json!({
                "candidates": [{
                    "finishReason": map_finish_reason(last_finish_reason.as_deref())
                }]
            });
            if !usage_meta.is_null() {
                finish_chunk["usageMetadata"] = usage_meta.clone();
            }
            yield Ok::<Bytes, String>(Bytes::from(format!("data: {}\n\n", serde_json::to_string(&finish_chunk).unwrap_or_default())));
        }
    };

    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "text/event-stream")
        .header("Cache-Control", "no-cache")
        .header("Connection", "keep-alive")
        .header("X-Accel-Buffering", "no")
        .header("X-Account-Email", "openai-upstream")
        .header("X-Mapped-Model", format!("openai/{}", route.upstream_model))
        .body(Body::from_stream(stream))
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

/// Handle incoming Gemini request routed to OpenAI upstream
pub async fn handle_generate(
    route: &OpenAiRoute,
    method: &str,
    client_body: &Value,
) -> Result<Response, (StatusCode, String)> {
    let client = openai_client();
    let url = format!("{}/chat/completions", route.base_url);
    let is_stream = method == "streamGenerateContent";

    tracing::info!(
        "[OpenAI-Upstream] Routing request to {} (model: {}, stream: {})",
        url,
        route.upstream_model,
        is_stream
    );

    let openai_body = build_openai_request(
        client_body,
        &route.upstream_model,
        is_stream,
        route.reasoning_effort.as_deref(),
    )
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Transpiler error: {}", e)))?;

    let body_bytes = serde_json::to_vec(&openai_body).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Serialization error: {}", e),
        )
    })?;

    let mut request_builder = client
        .post(&url)
        .header(rquest::header::CONTENT_TYPE, "application/json")
        .body(body_bytes);

    if !route.api_key.is_empty() {
        request_builder = request_builder.header(
            rquest::header::AUTHORIZATION,
            format!("Bearer {}", route.api_key),
        );
    }

    let response = request_builder.send().await.map_err(|e| {
        tracing::error!("[OpenAI-Upstream] Network error: {}", e);
        (
            StatusCode::BAD_GATEWAY,
            format!("Upstream connection failed: {}", e),
        )
    })?;

    let status = response.status();
    if !status.is_success() {
        let err_text = response.text().await.unwrap_or_default();
        tracing::error!(
            "[OpenAI-Upstream] Upstream returned HTTP {}: {}",
            status.as_u16(),
            err_text
        );
        return Err((
            StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY),
            err_text,
        ));
    }

    if is_stream {
        Ok(stream_response(response, route))
    } else {
        let resp_bytes = response.bytes().await.unwrap_or_default();
        let resp_json: Value = serde_json::from_slice(&resp_bytes).unwrap_or(json!({}));

        // Convert non-streaming OpenAI response to Gemini JSON format
        let mut parts = Vec::new();
        let mut finish_reason: Option<String> = None;
        if let Some(choice) = resp_json.get("choices").and_then(|c| c.get(0)) {
            finish_reason = choice
                .get("finish_reason")
                .and_then(Value::as_str)
                .map(str::to_string);
            if let Some(msg) = choice.get("message") {
                let mut had_separate_reasoning = false;
                if let Some(reasoning) = msg
                    .get("reasoning_content")
                    .or_else(|| msg.get("reasoning"))
                    .and_then(Value::as_str)
                {
                    if !reasoning.is_empty() {
                        had_separate_reasoning = true;
                        parts.push(json!({
                            "text": reasoning,
                            "thought": true
                        }));
                    }
                }
                if let Some(content) = msg.get("content").and_then(Value::as_str) {
                    if !content.is_empty() {
                        // Extract inline `<think>...</think>` blocks for providers that embed
                        // chain-of-thought inside `content` instead of `reasoning_content`.
                        let trimmed = content.trim_start();
                        if !had_separate_reasoning && trimmed.starts_with("<think>") {
                            if let Some(end_idx) = trimmed.find("</think>") {
                                let thought_text = trimmed["<think>".len()..end_idx].trim();
                                let rest_text = trimmed[end_idx + "</think>".len()..].trim_start();
                                if !thought_text.is_empty() {
                                    parts.push(json!({
                                        "text": thought_text,
                                        "thought": true
                                    }));
                                }
                                if !rest_text.is_empty() {
                                    parts.push(json!({
                                        "text": rest_text
                                    }));
                                }
                            } else {
                                parts.push(json!({
                                    "text": content
                                }));
                            }
                        } else {
                            parts.push(json!({
                                "text": content
                            }));
                        }
                    }
                }
                if let Some(tool_calls) = msg.get("tool_calls").and_then(Value::as_array) {
                    for tc in tool_calls {
                        if let Some(func) = tc.get("function") {
                            let name = func.get("name").and_then(Value::as_str).unwrap_or_default();
                            let args_str = func
                                .get("arguments")
                                .and_then(Value::as_str)
                                .unwrap_or("{}");
                            let args: Value = serde_json::from_str(args_str).unwrap_or(json!({}));
                            parts.push(json!({
                                "functionCall": {
                                    "name": name,
                                    "args": args
                                }
                            }));
                        }
                    }
                }
            }
        }

        let mut gemini_resp = json!({
            "candidates": [{
                "content": {
                    "parts": parts,
                    "role": "model"
                },
                "finishReason": map_finish_reason(finish_reason.as_deref())
            }]
        });
        if let Some(usage) = resp_json.get("usage").filter(|u| !u.is_null()) {
            let converted = openai_usage_to_gemini(usage);
            if !converted.is_null() {
                gemini_resp["usageMetadata"] = converted;
            }
        }

        let body_out = serde_json::to_vec(&gemini_resp).unwrap_or_default();
        Ok((
            StatusCode::OK,
            [
                ("Content-Type", "application/json"),
                ("X-Account-Email", "openai-upstream"),
                (
                    "X-Mapped-Model",
                    &format!("openai/{}", route.upstream_model),
                ),
            ],
            body_out,
        )
            .into_response())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_route_exact_and_auto() {
        let config = OpenAiUpstreamConfig {
            enabled: true,
            base_url: "https://integrate.api.nvidia.com/v1".to_string(),
            api_key: "test-key".to_string(),
            default_timeout_secs: 120,
            auto_route_prefix: Some("openai/".to_string()),
            routes: vec![],
            exposed_models: vec!["deepseek-ai/deepseek-v4.1-flash".to_string()],
            model_mapping: {
                let mut m = HashMap::new();
                m.insert(
                    "deepseek-flash".to_string(),
                    "deepseek-ai/deepseek-v4.1-flash".to_string(),
                );
                m
            },
        };

        // 1. Alias mapping
        let route = resolve_route(&config, "models/deepseek-flash").expect("should resolve alias");
        assert_eq!(route.upstream_model, "deepseek-ai/deepseek-v4.1-flash");
        assert_eq!(route.api_key, "test-key");

        // 2. Exact exposed model
        let route2 = resolve_route(&config, "deepseek-ai/deepseek-v4.1-flash")
            .expect("should resolve exposed");
        assert_eq!(route2.upstream_model, "deepseek-ai/deepseek-v4.1-flash");

        // 3. Auto-detected DeepSeek model
        let route3 = resolve_route(&config, "deepseek-custom-70b")
            .expect("should auto-detect deepseek prefix");
        assert_eq!(route3.upstream_model, "deepseek-custom-70b");

        // 4. Unmatched model should return None
        assert!(resolve_route(&config, "gemini-2.5-flash").is_none());

        // 5. Disabled config should return None
        let mut disabled_config = config.clone();
        disabled_config.enabled = false;
        assert!(resolve_route(&disabled_config, "deepseek-flash").is_none());

        // 6. Explicit GUI Route
        let mut gui_route_config = config.clone();
        gui_route_config.routes.push(OpenAiRouteConfig {
            model_id: "qwen-coder".to_string(),
            upstream_model: Some("qwen-2.5-coder-32b".to_string()),
            base_url: Some("https://api.groq.com/openai/v1".to_string()),
            api_key: Some("gsk-test".to_string()),
            timeout_secs: Some(60),
        });
        let route_gui =
            resolve_route(&gui_route_config, "qwen-coder").expect("should resolve GUI route");
        assert_eq!(route_gui.upstream_model, "qwen-2.5-coder-32b");
        assert_eq!(route_gui.base_url, "https://api.groq.com/openai/v1");
        assert_eq!(route_gui.api_key, "gsk-test");
    }

    #[test]
    fn test_build_openai_request_multimodal_and_system() {
        let gemini_payload = json!({
            "systemInstruction": {
                "parts": [{"text": "You are a diagnostic systems specialist."}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": "Analyze this waveform snapshot:"},
                        {
                            "inlineData": {
                                "mimeType": "image/png",
                                "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 2048
            }
        });

        let req = build_openai_request(
            &gemini_payload,
            "deepseek-ai/deepseek-v4.1-flash",
            true,
            None,
        )
        .expect("should build openai request");

        assert_eq!(req["model"], "deepseek-ai/deepseek-v4.1-flash");
        assert_eq!(req["stream"], true);
        assert_eq!(req["stream_options"]["include_usage"], true);
        assert_eq!(req["temperature"], 0.2);
        assert_eq!(req["max_tokens"], 2048);

        let messages = req["messages"].as_array().expect("messages must be array");
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0]["role"], "system");
        assert_eq!(
            messages[0]["content"],
            "You are a diagnostic systems specialist."
        );

        assert_eq!(messages[1]["role"], "user");
        let user_content = messages[1]["content"]
            .as_array()
            .expect("multimodal user content is array");
        assert_eq!(user_content.len(), 2);
        assert_eq!(user_content[0]["type"], "text");
        assert_eq!(user_content[1]["type"], "image_url");
        assert!(user_content[1]["image_url"]["url"]
            .as_str()
            .unwrap()
            .starts_with("data:image/png;base64,"));
    }

    #[test]
    fn test_build_openai_request_tools_schema_cleaning() {
        let gemini_payload = json!({
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": "Execute terminal diagnosis"}]
                }
            ],
            "tools": [
                {
                    "functionDeclarations": [
                        {
                            "name": "run_command",
                            "description": "Execute powershell command",
                            "parameters": {
                                "type": "OBJECT",
                                "properties": {
                                    "command": {
                                        "type": "STRING",
                                        "description": "Command string"
                                    },
                                    "timeout": {
                                        "type": "INTEGER"
                                    }
                                },
                                "required": ["command"]
                            }
                        }
                    ]
                }
            ]
        });

        let req = build_openai_request(
            &gemini_payload,
            "deepseek-ai/deepseek-v4.1-flash",
            false,
            None,
        )
        .expect("should build openai request");

        // Non-streaming requests must not ask for streaming usage options.
        assert!(req.get("stream_options").is_none());

        let tools = req["tools"].as_array().expect("tools array present");
        assert_eq!(tools.len(), 1);
        assert_eq!(tools[0]["type"], "function");
        assert_eq!(tools[0]["function"]["name"], "run_command");

        let params = &tools[0]["function"]["parameters"];
        assert_eq!(params["type"], "object");
        assert_eq!(params["properties"]["command"]["type"], "string");
        assert_eq!(params["properties"]["timeout"]["type"], "integer");
    }

    #[test]
    fn test_build_openai_request_function_response_mapping() {
        let gemini_payload = json!({
            "contents": [
                {
                    "role": "model",
                    "parts": [
                        {
                            "functionCall": {
                                "name": "run_command",
                                "args": {"command": "git status"}
                            }
                        }
                    ]
                },
                {
                    "role": "user",
                    "parts": [
                        {
                            "functionResponse": {
                                "name": "run_command",
                                "response": {"output": "On branch main"}
                            }
                        }
                    ]
                }
            ]
        });

        let req = build_openai_request(
            &gemini_payload,
            "deepseek-ai/deepseek-v4.1-flash",
            true,
            None,
        )
        .expect("should build openai request");

        let messages = req["messages"].as_array().expect("messages must be array");
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0]["role"], "assistant");
        let tool_calls = messages[0]["tool_calls"].as_array().unwrap();
        assert_eq!(tool_calls[0]["function"]["name"], "run_command");

        assert_eq!(messages[1]["role"], "tool");
        assert_eq!(messages[1]["tool_call_id"], "call_run_command");
        assert!(messages[1]["content"]
            .as_str()
            .unwrap()
            .contains("On branch main"));
    }

    #[test]
    fn test_generation_params_and_stop_sequences() {
        let gemini_payload = json!({
            "contents": [{ "role": "user", "parts": [{"text": "hi"}] }],
            "generationConfig": {
                "temperature": 0.7,
                "topP": 0.95,
                "frequencyPenalty": 0.5,
                "presencePenalty": 0.3,
                "seed": 42,
                "candidateCount": 3,
                "stopSequences": ["END", "", "STOP", "A", "B", "C"]
            }
        });
        let req = build_openai_request(&gemini_payload, "some-model", false, None)
            .expect("should build request");
        assert_eq!(req["top_p"], 0.95);
        assert_eq!(req["frequency_penalty"], 0.5);
        assert_eq!(req["presence_penalty"], 0.3);
        assert_eq!(req["seed"], 42);
        assert_eq!(req["n"], 3);
        // Empty entries dropped, capped at 4.
        let stop = req["stop"].as_array().expect("stop array");
        assert_eq!(stop.len(), 4);
        assert_eq!(stop[0], "END");
        assert!(!stop.iter().any(|s| s == ""));
    }

    #[test]
    fn test_reasoning_effort_only_for_supported_models() {
        assert!(supports_reasoning_effort("o3-mini"));
        assert!(supports_reasoning_effort("gpt-5"));
        assert!(supports_reasoning_effort("openai/gpt-oss-120b"));
        assert!(!supports_reasoning_effort("deepseek-reasoner"));
        assert!(!supports_reasoning_effort("meta/llama-3.3-70b-instruct"));

        let config = OpenAiUpstreamConfig {
            enabled: true,
            base_url: "https://api.openai.com/v1".to_string(),
            api_key: "test-key".to_string(),
            routes: vec![
                OpenAiRouteConfig {
                    model_id: "gpt5".to_string(),
                    upstream_model: Some("gpt-5".to_string()),
                    ..Default::default()
                },
                OpenAiRouteConfig {
                    model_id: "llama".to_string(),
                    upstream_model: Some("meta/llama-3.3-70b-instruct".to_string()),
                    ..Default::default()
                },
            ],
            ..OpenAiUpstreamConfig::default()
        };
        assert_eq!(
            resolve_route(&config, "gpt5-high")
                .unwrap()
                .reasoning_effort,
            Some("high".to_string())
        );
        // Supported model without an effort suffix stays off.
        assert_eq!(
            resolve_route(&config, "gpt5").unwrap().reasoning_effort,
            None
        );
        // Unsupported model never forwards the field, even with a suffix.
        assert_eq!(
            resolve_route(&config, "llama-high")
                .unwrap()
                .reasoning_effort,
            None
        );
    }

    #[test]
    fn test_finish_reason_mapping() {
        assert_eq!(map_finish_reason(Some("stop")), "STOP");
        assert_eq!(map_finish_reason(Some("tool_calls")), "STOP");
        assert_eq!(map_finish_reason(Some("length")), "MAX_TOKENS");
        assert_eq!(map_finish_reason(Some("content_filter")), "SAFETY");
        assert_eq!(map_finish_reason(None), "STOP");
    }

    #[test]
    fn test_usage_conversion() {
        let usage = json!({
            "prompt_tokens": 100,
            "completion_tokens": 50,
            "total_tokens": 150,
            "completion_tokens_details": { "reasoning_tokens": 20 }
        });
        let meta = openai_usage_to_gemini(&usage);
        assert_eq!(meta["promptTokenCount"], 100);
        assert_eq!(meta["candidatesTokenCount"], 50);
        assert_eq!(meta["totalTokenCount"], 150);
        assert_eq!(meta["thoughtsTokenCount"], 20);

        // total_tokens derived when absent, thoughts omitted when zero.
        let partial = json!({ "prompt_tokens": 10, "completion_tokens": 5 });
        let meta2 = openai_usage_to_gemini(&partial);
        assert_eq!(meta2["totalTokenCount"], 15);
        assert!(meta2.get("thoughtsTokenCount").is_none());

        // All-zero usage yields Null (nothing to report).
        assert!(openai_usage_to_gemini(&json!({})).is_null());
    }

    #[test]
    fn test_thought_parts_stripped_from_assistant_history_and_body_effort() {
        let gemini_payload = json!({
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": "What is 6 * 7?"}]
                },
                {
                    "role": "model",
                    "parts": [
                        {"text": "Let me multiply 6 by 7.", "thought": true},
                        {"text": "42"}
                    ]
                },
                {
                    "role": "user",
                    "parts": [{"text": "Add 8 to that."}]
                }
            ],
            "generationConfig": {
                "thinkingConfig": {
                    "thinkingLevel": "HIGH"
                }
            }
        });

        let req = build_openai_request(&gemini_payload, "o3-mini", false, None)
            .expect("should build request");
        let messages = req["messages"].as_array().expect("messages array");
        assert_eq!(messages.len(), 3);
        assert_eq!(messages[1]["role"], "assistant");
        assert_eq!(messages[1]["content"], "42");
        assert_eq!(req["reasoning_effort"], "high");

        // Unsupported model must not get reasoning_effort from body thinkingConfig
        let req_deepseek = build_openai_request(&gemini_payload, "deepseek-reasoner", false, None)
            .expect("should build request");
        assert!(req_deepseek.get("reasoning_effort").is_none());
    }

    #[test]
    fn test_default_disabled_and_only_chosen_models_exposed() {
        let default_cfg = OpenAiUpstreamConfig::default();
        assert!(!default_cfg.enabled);
        assert!(default_cfg.routes.is_empty());
        assert!(default_cfg.exposed_models.is_empty());
        assert!(exposed_model_ids_for(&default_cfg).is_empty());

        let mut active_cfg = OpenAiUpstreamConfig {
            enabled: true,
            base_url: "https://integrate.api.nvidia.com/v1".to_string(),
            routes: vec![
                OpenAiRouteConfig {
                    model_id: "deepseek-v4.1-flash".to_string(),
                    upstream_model: Some("deepseek-ai/deepseek-v4.1-flash".to_string()),
                    ..Default::default()
                },
                OpenAiRouteConfig {
                    model_id: "muse-glimmer-30b".to_string(),
                    upstream_model: Some("meta/muse-glimmer-30b".to_string()),
                    ..Default::default()
                },
            ],
            exposed_models: Vec::new(),
            ..Default::default()
        };
        // With routes configured but none chosen in exposed_models, nothing is advertised on /model
        assert!(exposed_model_ids_for(&active_cfg).is_empty());
        // Direct routing still resolves configured routes when explicitly requested
        assert!(resolve_route(&active_cfg, "muse-glimmer-30b").is_some());

        // Choosing a model in exposed_models exposes only that model (and effort variants if reasoning)
        active_cfg.exposed_models = vec!["muse-glimmer-30b".to_string()];
        assert_eq!(
            exposed_model_ids_for(&active_cfg),
            vec!["muse-glimmer-30b".to_string()]
        );
    }

    /// Live network test: `cargo test ... -- --ignored` with NVIDIA_API_KEY set.
    #[tokio::test]
    #[ignore = "requires NVIDIA_API_KEY and network access"]
    async fn test_live_dispatch_roundtrip() {
        let api_key = std::env::var("NVIDIA_API_KEY")
            .expect("NVIDIA_API_KEY must be set to run the live dispatch test");

        let route = OpenAiRoute {
            upstream_model: "deepseek-ai/deepseek-v4.1-flash".to_string(),
            base_url: "https://integrate.api.nvidia.com/v1".to_string(),
            api_key,
            reasoning_effort: None,
        };

        let gemini_body = json!({
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": "Reply with 'PING_OK' only."}]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 64
            }
        });

        // 1. Test non-streaming generateContent
        let resp = handle_generate(&route, "generateContent", &gemini_body).await;
        assert!(
            resp.is_ok(),
            "generateContent should succeed: {:?}",
            resp.err()
        );

        // 2. Test streamGenerateContent
        let stream_resp = handle_generate(&route, "streamGenerateContent", &gemini_body).await;
        assert!(
            stream_resp.is_ok(),
            "streamGenerateContent should succeed: {:?}",
            stream_resp.err()
        );
    }
}
