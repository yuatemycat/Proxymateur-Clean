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

/// OpenAI Upstream Configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct OpenAiUpstreamConfig {
    pub enabled: bool,
    /// Upstream base URL (e.g. "https://integrate.api.nvidia.com/v1" or "https://api.deepseek.com/v1")
    pub base_url: String,
    /// API key (falls back to NVIDIA_API_KEY / OPENAI_API_KEY environment variables if empty)
    pub api_key: String,
    /// Exposed models to advertise to agy CLI / UI dropdown
    pub exposed_models: Vec<String>,
    /// Client model name -> Upstream model ID mapping (supports trailing `*` wildcard)
    pub model_mapping: HashMap<String, String>,
}

impl Default for OpenAiUpstreamConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            base_url: "https://integrate.api.nvidia.com/v1".to_string(),
            api_key: String::new(),
            exposed_models: vec![
                "deepseek-ai/deepseek-v4.1-flash".to_string(),
                "deepseek-chat".to_string(),
                "deepseek-reasoner".to_string(),
            ],
            model_mapping: {
                let mut map = HashMap::new();
                map.insert("deepseek-flash".to_string(), "deepseek-ai/deepseek-v4.1-flash".to_string());
                map.insert("deepseek-v4.1-flash".to_string(), "deepseek-ai/deepseek-v4.1-flash".to_string());
                map
            },
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
pub fn update_config(config: OpenAiUpstreamConfig) {
    tracing::info!(
        "[OpenAI-Upstream] Config updated: enabled={}, base_url={}, exposed_models={:?}, mappings={}",
        config.enabled,
        config.base_url,
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

/// List exposed model IDs to advertise in the models endpoint
pub fn exposed_model_ids() -> Vec<String> {
    let config = get_config();
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
    for (alias, _) in &config.model_mapping {
        let trimmed = alias.trim().to_string();
        if !trimmed.is_empty() && !models.contains(&trimmed) {
            models.push(trimmed);
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
}

/// Resolve client model to an OpenAI upstream route if matched
pub fn resolve_route(config: &OpenAiUpstreamConfig, client_model: &str) -> Option<OpenAiRoute> {
    if !config.enabled {
        return None;
    }

    let requested = client_model
        .trim()
        .trim_start_matches("models/")
        .to_lowercase();

    // 1. Exact match in model_mapping
    let mapped = config
        .model_mapping
        .iter()
        .find(|(key, _)| key.trim().to_lowercase() == requested)
        .map(|(_, val)| val.clone());

    // 2. Exact match in exposed_models
    let exposed = config
        .exposed_models
        .iter()
        .find(|m| m.trim().to_lowercase() == requested)
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

    // 4. Auto-detect deepseek or openai model names
    let auto_detect = if requested.starts_with("deepseek") || requested.starts_with("openai/") {
        Some(client_model.trim().trim_start_matches("models/").to_string())
    } else {
        None
    };

    let upstream_model = mapped
        .or(exposed)
        .or(wildcard)
        .or(auto_detect)?;

    // Resolve API key
    let mut api_key = config.api_key.trim().to_string();
    if api_key.is_empty() {
        if let Ok(env_key) = std::env::var("NVIDIA_API_KEY") {
            api_key = env_key.trim().to_string();
        } else if let Ok(env_key) = std::env::var("OPENAI_API_KEY") {
            api_key = env_key.trim().to_string();
        }
    }

    let mut base_url = config.base_url.trim().trim_end_matches('/').to_string();
    if base_url.is_empty() {
        base_url = "https://integrate.api.nvidia.com/v1".to_string();
    }

    Some(OpenAiRoute {
        upstream_model,
        base_url,
        api_key,
    })
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
) -> Result<Value, String> {
    let req = gemini_body.get("request").unwrap_or(gemini_body);
    let mut messages: Vec<Value> = Vec::new();

    // 1. Process systemInstruction
    if let Some(sys_inst) = req.get("systemInstruction").or_else(|| req.get("system_instruction")) {
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
                        if let Some(func_resp) = part.get("functionResponse").or_else(|| part.get("function_response")) {
                            has_func_resp = true;
                            let name = func_resp.get("name").and_then(Value::as_str).unwrap_or("unknown");
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
                            } else if let Some(inline) = part.get("inlineData").or_else(|| part.get("inline_data")) {
                                let mime = inline.get("mimeType").or_else(|| inline.get("mime_type")).and_then(Value::as_str).unwrap_or("image/jpeg");
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

                        if user_content_items.len() == 1 && user_content_items[0]["type"] == "text" {
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
                        if let Some(text) = part.get("text").and_then(Value::as_str) {
                            text_parts.push(text);
                        } else if let Some(call) = part.get("functionCall").or_else(|| part.get("function_call")) {
                            let name = call.get("name").and_then(Value::as_str).unwrap_or("unknown");
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
                    let desc = decl.get("description").and_then(Value::as_str).unwrap_or_default();
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
    if let Some(gc) = req.get("generationConfig").or_else(|| req.get("generation_config")) {
        if let Some(temp) = gc.get("temperature").and_then(Value::as_f64) {
            openai_payload["temperature"] = json!(temp);
        }
        if let Some(max_tokens) = gc.get("maxOutputTokens").or_else(|| gc.get("max_output_tokens")).and_then(Value::as_u64) {
            openai_payload["max_tokens"] = json!(max_tokens);
        }
        if let Some(top_p) = gc.get("topP").or_else(|| gc.get("top_p")).and_then(Value::as_f64) {
            openai_payload["top_p"] = json!(top_p);
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
        tracing::error!("[OpenAI-Upstream] Failed to build HTTP client: {}, using fallback", e);
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
                                // Flush any accumulated tool calls
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
                                                },
                                                "finishReason": "TOOL_CALL"
                                            }]
                                        });
                                        yield Ok::<Bytes, String>(Bytes::from(format!("data: {}\n\n", serde_json::to_string(&gemini_chunk).unwrap_or_default())));
                                    }
                                }

                                // Emit final STOP chunk
                                let finish_chunk = json!({
                                    "candidates": [{
                                        "finishReason": "STOP"
                                    }]
                                });
                                yield Ok::<Bytes, String>(Bytes::from(format!("data: {}\n\n", serde_json::to_string(&finish_chunk).unwrap_or_default())));
                                break;
                            }

                            if let Ok(val) = serde_json::from_str::<Value>(data_str) {
                                if let Some(choice) = val.get("choices").and_then(|c| c.get(0)) {
                                    let default_delta = json!({});
                                    let delta = choice.get("delta").unwrap_or(&default_delta);

                                    // 1. Thinking / reasoning content
                                    if let Some(reasoning) = delta.get("reasoning_content").and_then(Value::as_str) {
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
                    break;
                }
            }
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

    let openai_body = build_openai_request(client_body, &route.upstream_model, is_stream)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Transpiler error: {}", e)))?;

    let body_bytes = serde_json::to_vec(&openai_body)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Serialization error: {}", e)))?;

    let mut request_builder = client.post(&url)
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
        (StatusCode::BAD_GATEWAY, format!("Upstream connection failed: {}", e))
    })?;

    let status = response.status();
    if !status.is_success() {
        let err_text = response.text().await.unwrap_or_default();
        tracing::error!("[OpenAI-Upstream] Upstream returned HTTP {}: {}", status.as_u16(), err_text);
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
        if let Some(choice) = resp_json.get("choices").and_then(|c| c.get(0)) {
            if let Some(msg) = choice.get("message") {
                if let Some(reasoning) = msg.get("reasoning_content").and_then(Value::as_str) {
                    if !reasoning.is_empty() {
                        parts.push(json!({
                            "text": reasoning,
                            "thought": true
                        }));
                    }
                }
                if let Some(content) = msg.get("content").and_then(Value::as_str) {
                    if !content.is_empty() {
                        parts.push(json!({
                            "text": content
                        }));
                    }
                }
                if let Some(tool_calls) = msg.get("tool_calls").and_then(Value::as_array) {
                    for tc in tool_calls {
                        if let Some(func) = tc.get("function") {
                            let name = func.get("name").and_then(Value::as_str).unwrap_or_default();
                            let args_str = func.get("arguments").and_then(Value::as_str).unwrap_or("{}");
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

        let gemini_resp = json!({
            "candidates": [{
                "content": {
                    "parts": parts,
                    "role": "model"
                },
                "finishReason": "STOP"
            }]
        });

        let body_out = serde_json::to_vec(&gemini_resp).unwrap_or_default();
        Ok((
            StatusCode::OK,
            [
                ("Content-Type", "application/json"),
                ("X-Account-Email", "openai-upstream"),
                ("X-Mapped-Model", &format!("openai/{}", route.upstream_model)),
            ],
            body_out,
        ).into_response())
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
            exposed_models: vec!["deepseek-ai/deepseek-v4.1-flash".to_string()],
            model_mapping: {
                let mut m = HashMap::new();
                m.insert("deepseek-flash".to_string(), "deepseek-ai/deepseek-v4.1-flash".to_string());
                m
            },
        };

        // 1. Alias mapping
        let route = resolve_route(&config, "models/deepseek-flash").expect("should resolve alias");
        assert_eq!(route.upstream_model, "deepseek-ai/deepseek-v4.1-flash");
        assert_eq!(route.api_key, "test-key");

        // 2. Exact exposed model
        let route2 = resolve_route(&config, "deepseek-ai/deepseek-v4.1-flash").expect("should resolve exposed");
        assert_eq!(route2.upstream_model, "deepseek-ai/deepseek-v4.1-flash");

        // 3. Auto-detected DeepSeek model
        let route3 = resolve_route(&config, "deepseek-custom-70b").expect("should auto-detect deepseek prefix");
        assert_eq!(route3.upstream_model, "deepseek-custom-70b");

        // 4. Unmatched model should return None
        assert!(resolve_route(&config, "gemini-2.5-flash").is_none());

        // 5. Disabled config should return None
        let mut disabled_config = config.clone();
        disabled_config.enabled = false;
        assert!(resolve_route(&disabled_config, "deepseek-flash").is_none());
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

        let req = build_openai_request(&gemini_payload, "deepseek-ai/deepseek-v4.1-flash", true)
            .expect("should build openai request");

        assert_eq!(req["model"], "deepseek-ai/deepseek-v4.1-flash");
        assert_eq!(req["stream"], true);
        assert_eq!(req["temperature"], 0.2);
        assert_eq!(req["max_tokens"], 2048);

        let messages = req["messages"].as_array().expect("messages must be array");
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0]["role"], "system");
        assert_eq!(messages[0]["content"], "You are a diagnostic systems specialist.");

        assert_eq!(messages[1]["role"], "user");
        let user_content = messages[1]["content"].as_array().expect("multimodal user content is array");
        assert_eq!(user_content.len(), 2);
        assert_eq!(user_content[0]["type"], "text");
        assert_eq!(user_content[1]["type"], "image_url");
        assert!(user_content[1]["image_url"]["url"].as_str().unwrap().starts_with("data:image/png;base64,"));
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

        let req = build_openai_request(&gemini_payload, "deepseek-ai/deepseek-v4.1-flash", false)
            .expect("should build openai request");

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

        let req = build_openai_request(&gemini_payload, "deepseek-ai/deepseek-v4.1-flash", true)
            .expect("should build openai request");

        let messages = req["messages"].as_array().expect("messages must be array");
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0]["role"], "assistant");
        let tool_calls = messages[0]["tool_calls"].as_array().unwrap();
        assert_eq!(tool_calls[0]["function"]["name"], "run_command");

        assert_eq!(messages[1]["role"], "tool");
        assert_eq!(messages[1]["tool_call_id"], "call_run_command");
        assert!(messages[1]["content"].as_str().unwrap().contains("On branch main"));
    }

    #[tokio::test]
    async fn test_live_dispatch_roundtrip() {
        let api_key = std::env::var("NVIDIA_API_KEY")
            .unwrap_or_else(|_| "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".to_string());

        let route = OpenAiRoute {
            upstream_model: "deepseek-ai/deepseek-v4.1-flash".to_string(),
            base_url: "https://integrate.api.nvidia.com/v1".to_string(),
            api_key,
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
        assert!(resp.is_ok(), "generateContent should succeed: {:?}", resp.err());

        // 2. Test streamGenerateContent
        let stream_resp = handle_generate(&route, "streamGenerateContent", &gemini_body).await;
        assert!(stream_resp.is_ok(), "streamGenerateContent should succeed: {:?}", stream_resp.err());
    }
}
