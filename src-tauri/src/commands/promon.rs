use rusqlite::{params, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager};
use tracing::{error, info};

#[derive(Debug, Serialize, Deserialize)]
pub struct PromonExecutionResult {
    pub success: bool,
    pub role: String,
    pub output: String,
    pub execution_time_ms: u64,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgySessionItem {
    pub conversation_id: String,
    pub title: String,
    pub preview: String,
    pub step_count: u32,
    pub last_modified_time: String,
    pub workspace: String,
    pub agent_name: Option<String>,
    pub nesting_depth: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClaudeSessionItem {
    pub session_id: String,
    pub cwd: String,
    pub project: String,
    pub model: String,
    pub entrypoint: String,
    pub first_prompt: String,
    pub last_prompt: String,
    pub user_turns_count: u32,
    pub total_steps: u32,
    pub total_cost: f64,
    pub total_duration_ms: u64,
    pub last_timestamp: String,
}

/// Execute the local RTX A5500 fine-tuned model via E:\JB\promon_dual_role.py
#[tauri::command]
pub async fn execute_promon_model(
    role: String,
    query: String,
    code: Option<String>,
) -> Result<PromonExecutionResult, String> {
    let start = std::time::Instant::now();
    info!("Executing PROMON model role: {}", role);

    tokio::task::spawn_blocking(move || {
        let script_path = PathBuf::from(r"E:\JB\promon_dual_role.py");
        if !script_path.exists() {
            return Err(format!("PROMON script not found at {:?}", script_path));
        }

        let mut cmd = Command::new("python");
        cmd.arg(&script_path);
        cmd.arg("--role").arg(&role);

        // Enforce offline execution to prevent HuggingFace timeout/hangs
        cmd.env("HF_HUB_OFFLINE", "1");
        cmd.env("TRANSFORMERS_OFFLINE", "1");
        cmd.env("PYTHONIOENCODING", "utf-8");

        let mut temp_file_path: Option<PathBuf> = None;

        if role == "auditor" {
            if let Some(code_snippet) = code {
                let temp_dir = std::env::temp_dir();
                let file_path = temp_dir.join(format!("promon_audit_{}.tmp", uuid::Uuid::new_v4()));
                if let Err(e) = std::fs::write(&file_path, &code_snippet) {
                    return Err(format!("Failed to write temp audit file: {}", e));
                }
                cmd.arg("--file").arg(&file_path);
                temp_file_path = Some(file_path);
            } else if !query.is_empty() {
                cmd.arg("--code").arg(&query);
            }
        } else {
            // Phraser mode
            cmd.arg("--query").arg(&query);
        }

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let output = cmd
            .output()
            .map_err(|e| format!("Failed to spawn Python process: {}", e))?;

        if let Some(p) = temp_file_path {
            let _ = std::fs::remove_file(p);
        }

        let duration = start.elapsed().as_millis() as u64;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if !output.status.success() {
            error!("PROMON model execution failed: {}", stderr);
            return Ok(PromonExecutionResult {
                success: false,
                role,
                output: stdout,
                execution_time_ms: duration,
                error: Some(stderr),
            });
        }

        Ok(PromonExecutionResult {
            success: true,
            role,
            output: stdout.trim().to_string(),
            execution_time_ms: duration,
            error: None,
        })
    })
    .await
    .map_err(|e| format!("Task execution panicked: {}", e))?
}

/// Helper to lazily get or create the floating Promon HUD secondary window on demand
pub fn get_or_create_promon_hud(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    if let Some(window) = app.get_webview_window("promon-hud") {
        Ok(window)
    } else {
        #[allow(unused_mut)]
        let mut builder = tauri::WebviewWindowBuilder::new(
            app,
            "promon-hud",
            tauri::WebviewUrl::App("/hud".into()),
        )
        .title("Promon HUD")
        .inner_size(780.0, 340.0)
        .decorations(false)
        .always_on_top(true)
        .center()
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .visible(false);

        #[cfg(any(not(target_os = "macos"), feature = "macos-private-api"))]
        {
            builder = builder.transparent(true);
        }

        builder
            .build()
            .map_err(|e| format!("Failed to create Promon HUD window: {}", e))
    }
}

/// Show or hide the floating Promon HUD secondary window
#[tauri::command]
pub async fn toggle_promon_hud(app: AppHandle, show: bool) -> Result<(), String> {
    if show {
        let window = get_or_create_promon_hud(&app)?;
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.center();
        let _ = window.set_focus();
        Ok(())
    } else {
        if let Some(window) = app.get_webview_window("promon-hud") {
            let _ = window.hide();
        }
        Ok(())
    }
}

/// Query real Antigravity sessions from ~/.gemini/antigravity-cli/conversation_summaries.db
/// (Backing E:\02_Projects\agy-chats)
#[tauri::command]
pub async fn get_agy_sessions(
    limit: Option<usize>,
    search: Option<String>,
    all: Option<bool>,
) -> Result<Vec<AgySessionItem>, String> {
    tokio::task::spawn_blocking(move || {
        let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\X".to_string());
        let db_path = PathBuf::from(user_profile)
            .join(".gemini")
            .join("antigravity-cli")
            .join("conversation_summaries.db");

        if !db_path.exists() {
            return Ok(Vec::new());
        }

        let conn = Connection::open_with_flags(&db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| format!("Failed to open conversation_summaries.db: {}", e))?;

        let max_items = limit.unwrap_or(50) as i64;
        let show_all = all.unwrap_or(false);
        let search_pattern = search.map(|s| format!("%{}%", s));

        let mut stmt = conn
            .prepare(
                "SELECT conversation_id, title, preview, step_count, last_modified_time, workspace_uris, agent_name, nesting_depth \
                 FROM conversation_summaries \
                 WHERE (?1 IS TRUE OR nesting_depth = 0) \
                   AND (?2 IS NULL OR title LIKE ?2 OR preview LIKE ?2 OR workspace_uris LIKE ?2) \
                 ORDER BY last_modified_time DESC \
                 LIMIT ?3",
            )
            .map_err(|e| format!("Prepare query failed: {}", e))?;

        let rows = stmt
            .query_map(params![show_all, search_pattern, max_items], |row| {
                let raw_uris: Option<String> = row.get(5)?;
                let mut workspace = String::new();
                if let Some(uris) = raw_uris {
                    if let Ok(parsed) = serde_json::from_str::<Vec<String>>(&uris) {
                        if let Some(first) = parsed.first() {
                            workspace = first
                                .replace("file:///", "")
                                .replace("file://", "")
                                .replace('/', "\\");
                        }
                    } else {
                        workspace = uris;
                    }
                }

                Ok(AgySessionItem {
                    conversation_id: row.get(0)?,
                    title: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                    preview: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                    step_count: row.get::<_, Option<u32>>(3)?.unwrap_or(0),
                    last_modified_time: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                    workspace,
                    agent_name: row.get(6)?,
                    nesting_depth: row.get::<_, Option<i32>>(7)?.unwrap_or(0),
                })
            })
            .map_err(|e| format!("Query failed: {}", e))?;

        let mut sessions = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                sessions.push(item);
            }
        }

        Ok(sessions)
    })
    .await
    .map_err(|e| format!("Task execution panicked: {}", e))?
}

/// Resume an Antigravity conversation in a terminal (matching E:\02_Projects\agy-chats)
#[tauri::command]
pub async fn resume_agy_session(
    conversation_id: String,
    workspace: Option<String>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let target_dir = workspace.unwrap_or_else(|| r"C:\Users\X".to_string());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NEW_CONSOLE: u32 = 0x00000010;

            let mut cmd = Command::new("powershell.exe");
            cmd.arg("-NoExit");

            let script = format!(
                "Set-Location -Path '{}'; agy --conversation {}",
                target_dir, conversation_id
            );
            cmd.arg("-Command").arg(&script);
            cmd.creation_flags(CREATE_NEW_CONSOLE);

            cmd.spawn()
                .map_err(|e| format!("Failed to spawn Antigravity CLI process: {}", e))?;

            Ok(format!(
                "Antigravity session {} resumed in {}",
                conversation_id, target_dir
            ))
        }

        #[cfg(not(target_os = "windows"))]
        {
            Err("Terminal launching is only configured for Windows".to_string())
        }
    })
    .await
    .map_err(|e| format!("Launch task panicked: {}", e))?
}

/// Query real Claude Code sessions from ~/.claude/claude_chats_cache.db
/// (Backing E:\02_Projects\claude-chats)
#[tauri::command]
pub async fn get_claude_sessions(
    limit: Option<usize>,
    search: Option<String>,
    all: Option<bool>,
) -> Result<Vec<ClaudeSessionItem>, String> {
    tokio::task::spawn_blocking(move || {
        let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\X".to_string());
        let db_path = PathBuf::from(user_profile)
            .join(".claude")
            .join("claude_chats_cache.db");

        if !db_path.exists() {
            return Ok(Vec::new());
        }

        let conn = Connection::open_with_flags(&db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| format!("Failed to open claude_chats_cache.db: {}", e))?;

        let max_items = limit.unwrap_or(50) as i64;
        let show_all = all.unwrap_or(false);
        let search_pattern = search.map(|s| format!("%{}%", s));

        let mut stmt = conn
            .prepare(
                "SELECT session_id, cwd, project, model, entrypoint, first_prompt, last_prompt, \
                        user_turns_count, total_steps, total_cost, total_duration_ms, last_timestamp \
                 FROM sessions \
                 WHERE (?1 IS TRUE OR entrypoint = 'cli') \
                   AND (?2 IS NULL OR first_prompt LIKE ?2 OR last_prompt LIKE ?2 OR cwd LIKE ?2 OR project LIKE ?2) \
                 ORDER BY last_timestamp DESC \
                 LIMIT ?3",
            )
            .map_err(|e| format!("Prepare query failed: {}", e))?;

        let rows = stmt
            .query_map(params![show_all, search_pattern, max_items], |row| {
                Ok(ClaudeSessionItem {
                    session_id: row.get(0)?,
                    cwd: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                    project: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                    model: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                    entrypoint: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                    first_prompt: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
                    last_prompt: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
                    user_turns_count: row.get::<_, Option<u32>>(7)?.unwrap_or(0),
                    total_steps: row.get::<_, Option<u32>>(8)?.unwrap_or(0),
                    total_cost: row.get::<_, Option<f64>>(9)?.unwrap_or(0.0),
                    total_duration_ms: row.get::<_, Option<u64>>(10)?.unwrap_or(0),
                    last_timestamp: row.get::<_, Option<String>>(11)?.unwrap_or_default(),
                })
            })
            .map_err(|e| format!("Query failed: {}", e))?;

        let mut sessions = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                sessions.push(item);
            }
        }

        Ok(sessions)
    })
    .await
    .map_err(|e| format!("Task execution panicked: {}", e))?
}

/// Resume a Claude Code session in a terminal (matching E:\02_Projects\claude-chats)
#[tauri::command]
pub async fn resume_claude_session(session_id: String, cwd: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let target_dir = if cwd.is_empty() {
            r"E:\Claude".to_string()
        } else {
            cwd
        };

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NEW_CONSOLE: u32 = 0x00000010;

            let mut cmd = Command::new("powershell.exe");
            cmd.arg("-NoExit");

            let script = format!(
                "Set-Location -Path '{}'; claude --resume {} --setting-sources project",
                target_dir, session_id
            );
            cmd.arg("-Command").arg(&script);
            cmd.creation_flags(CREATE_NEW_CONSOLE);

            cmd.spawn()
                .map_err(|e| format!("Failed to spawn Claude Code process: {}", e))?;

            Ok(format!(
                "Claude Code session {} resumed in {}",
                session_id, target_dir
            ))
        }

        #[cfg(not(target_os = "windows"))]
        {
            Err("Terminal launching is only configured for Windows".to_string())
        }
    })
    .await
    .map_err(|e| format!("Launch task panicked: {}", e))?
}

/// Unhide all SDK sessions using E:\02_Projects\claude-chats\claude_chats.py -u
#[tauri::command]
pub async fn unhide_claude_sessions() -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let script_path = PathBuf::from(r"E:\02_Projects\claude-chats\claude_chats.py");
        if !script_path.exists() {
            return Err(format!("claude_chats.py not found at {:?}", script_path));
        }

        let mut cmd = Command::new("python");
        cmd.arg(&script_path);
        cmd.arg("-u");

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let output = cmd
            .output()
            .map_err(|e| format!("Failed to spawn python process: {}", e))?;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(stderr);
        }

        Ok(stdout.trim().to_string())
    })
    .await
    .map_err(|e| format!("Task execution panicked: {}", e))?
}

/// Launch a new Claude Code interactive CLI in a target workspace
#[tauri::command]
pub async fn launch_claude_cli(
    workspace: Option<String>,
    prompt: Option<String>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let target_dir = workspace.unwrap_or_else(|| r"E:\Claude".to_string());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NEW_CONSOLE: u32 = 0x00000010;

            let mut cmd = Command::new("powershell.exe");
            cmd.arg("-NoExit");

            let prompt_arg = if let Some(p) = prompt {
                format!("; claude \"{}\"", p.replace("\"", "\\\""))
            } else {
                "; claude".to_string()
            };

            let script = format!("Set-Location -Path '{}'{}", target_dir, prompt_arg);
            cmd.arg("-Command").arg(&script);
            cmd.creation_flags(CREATE_NEW_CONSOLE);

            cmd.spawn()
                .map_err(|e| format!("Failed to spawn PowerShell Claude process: {}", e))?;

            Ok(format!("Claude Code session launched in {}", target_dir))
        }

        #[cfg(not(target_os = "windows"))]
        {
            Err("Terminal launching is only configured for Windows".to_string())
        }
    })
    .await
    .map_err(|e| format!("Launch task panicked: {}", e))?
}

/// Initialize native Windows global hotkey (Win + Shift + P) to toggle Promon HUD
#[cfg(target_os = "windows")]
pub fn init_global_promon_hud_hotkey(app_handle: AppHandle) {
    std::thread::spawn(move || {
        use std::ptr::null_mut;

        #[derive(Clone, Copy)]
        #[repr(C)]
        struct POINT {
            x: i32,
            y: i32,
        }

        #[derive(Clone, Copy)]
        #[repr(C)]
        struct MSG {
            hwnd: *mut std::ffi::c_void,
            message: u32,
            w_param: usize,
            l_param: isize,
            time: u32,
            pt: POINT,
        }

        #[link(name = "user32")]
        extern "system" {
            fn RegisterHotKey(
                h_wnd: *mut std::ffi::c_void,
                id: i32,
                fs_modifiers: u32,
                vk: u32,
            ) -> i32;
            fn GetMessageW(
                lp_msg: *mut MSG,
                h_wnd: *mut std::ffi::c_void,
                w_msg_filter_min: u32,
                w_msg_filter_max: u32,
            ) -> i32;
        }

        const MOD_CONTROL: u32 = 0x0002;
        const MOD_SHIFT: u32 = 0x0004;
        const MOD_WIN: u32 = 0x0008;
        const MOD_NOREPEAT: u32 = 0x4000;
        const VK_P: u32 = 0x50;
        const WM_HOTKEY: u32 = 0x0312;
        const HOTKEY_ID: i32 = 0x5052; // 'PR'

        let mut reg = unsafe {
            RegisterHotKey(
                null_mut(),
                HOTKEY_ID,
                MOD_WIN | MOD_SHIFT | MOD_NOREPEAT,
                VK_P,
            )
        };

        if reg == 0 {
            reg = unsafe {
                RegisterHotKey(
                    null_mut(),
                    HOTKEY_ID,
                    MOD_CONTROL | MOD_SHIFT | MOD_NOREPEAT,
                    VK_P,
                )
            };
        }

        if reg != 0 {
            info!("Global PROMON HUD hotkey successfully registered (Win+Shift+P / Ctrl+Shift+P)");
        } else {
            tracing::warn!("Could not register global hotkey for PROMON HUD");
            return;
        }

        let mut msg: MSG = unsafe { std::mem::zeroed() };
        while unsafe { GetMessageW(&mut msg, null_mut(), 0, 0) } > 0 {
            if msg.message == WM_HOTKEY && msg.w_param == HOTKEY_ID as usize {
                if let Ok(window) = get_or_create_promon_hud(&app_handle) {
                    if let Ok(visible) = window.is_visible() {
                        if visible {
                            let _ = window.hide();
                        } else {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.center();
                            let _ = window.set_focus();
                        }
                    }
                }
            }
        }
    });
}

#[cfg(not(target_os = "windows"))]
pub fn init_global_promon_hud_hotkey(_app_handle: AppHandle) {}
