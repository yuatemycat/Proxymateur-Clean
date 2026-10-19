use std::sync::OnceLock;
use tracing::{info, warn};

#[cfg(target_os = "windows")]
pub mod ffi {
    use std::ffi::c_void;

    pub type HWND = *mut c_void;
    pub type HANDLE = *mut c_void;
    pub type BOOL = i32;
    pub type DWORD = u32;

    pub const SW_SHOW: i32 = 5;
    pub const SW_RESTORE: i32 = 9;
    pub const ASFW_ANY: u32 = 0xFFFFFFFF;
    pub const SMTO_ABORTIFHUNG: u32 = 0x0002;
    pub const SMTO_BLOCK: u32 = 0x0001;
    pub const WM_COPYDATA: u32 = 0x004A;

    pub const PROCESS_TERMINATE: u32 = 0x0001;
    pub const SYNCHRONIZE: u32 = 0x00100000;
    pub const ERROR_ALREADY_EXISTS: u32 = 183;

    pub const AF_INET: u32 = 2;
    pub const AF_INET6: u32 = 23;
    pub const TCP_TABLE_OWNER_PID_ALL: u32 = 5;
    pub const MIB_TCP_STATE_LISTEN: u32 = 2;

    #[repr(C)]
    pub struct COPYDATASTRUCT {
        pub dw_data: usize,
        pub cb_data: u32,
        pub lp_data: *const c_void,
    }

    #[repr(C)]
    pub struct MIB_TCPROW_OWNER_PID {
        pub dw_state: u32,
        pub dw_local_addr: u32,
        pub dw_local_port: u32,
        pub dw_remote_addr: u32,
        pub dw_remote_port: u32,
        pub dw_owning_pid: u32,
    }

    #[repr(C)]
    pub struct MIB_TCP6ROW_OWNER_PID {
        pub uc_local_addr: [u8; 16],
        pub dw_local_scope_id: u32,
        pub dw_local_port: u32,
        pub uc_remote_addr: [u8; 16],
        pub dw_remote_scope_id: u32,
        pub dw_remote_port: u32,
        pub dw_state: u32,
        pub dw_owning_pid: u32,
    }

    #[link(name = "User32")]
    extern "system" {
        pub fn FindWindowW(lp_class_name: *const u16, lp_window_name: *const u16) -> HWND;
        pub fn ShowWindow(h_wnd: HWND, n_cmd_show: i32) -> BOOL;
        pub fn IsIconic(h_wnd: HWND) -> BOOL;
        pub fn IsWindowVisible(h_wnd: HWND) -> BOOL;
        pub fn BringWindowToTop(h_wnd: HWND) -> BOOL;
        pub fn SetForegroundWindow(h_wnd: HWND) -> BOOL;
        pub fn AllowSetForegroundWindow(dw_process_id: u32) -> BOOL;
        pub fn GetWindowThreadProcessId(h_wnd: HWND, lpdw_process_id: *mut DWORD) -> DWORD;
        pub fn EnumWindows(
            lp_enum_func: unsafe extern "system" fn(HWND, isize) -> BOOL,
            l_param: isize,
        ) -> BOOL;
        pub fn SendMessageTimeoutW(
            h_wnd: HWND,
            msg: u32,
            w_param: usize,
            l_param: isize,
            fu_flags: u32,
            u_timeout: u32,
            lpdw_result: *mut usize,
        ) -> isize;
    }

    #[link(name = "Kernel32")]
    extern "system" {
        pub fn CreateMutexW(
            lp_mutex_attributes: *const c_void,
            b_initial_owner: BOOL,
            lp_name: *const u16,
        ) -> HANDLE;
        pub fn OpenProcess(
            dw_desired_access: DWORD,
            b_inherit_handle: BOOL,
            dw_process_id: DWORD,
        ) -> HANDLE;
        pub fn TerminateProcess(h_process: HANDLE, u_exit_code: u32) -> BOOL;
        pub fn WaitForSingleObject(h_handle: HANDLE, dw_milliseconds: DWORD) -> DWORD;
        pub fn CloseHandle(h_object: HANDLE) -> BOOL;
        pub fn GetLastError() -> DWORD;
    }

    #[link(name = "Iphlpapi")]
    extern "system" {
        pub fn GetExtendedTcpTable(
            p_tcp_table: *mut c_void,
            pdw_size: *mut u32,
            b_order: i32,
            ul_af: u32,
            table_class: u32,
            reserved: u32,
        ) -> u32;
    }
}

pub fn wide_null(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

// ---------------------------------------------------------------------------
// R1: Headless Daemon Detection & Takeover
// ---------------------------------------------------------------------------

/// 获取正在监听指定 TCP 端口的所有进程 PID (Windows 专属，通过 GetExtendedTcpTable 原生查询)。
#[cfg(target_os = "windows")]
pub fn get_pids_listening_on_port(target_port: u16) -> Vec<u32> {
    use ffi::*;
    let mut pids = Vec::new();
    let target_port_be = target_port.to_be();

    // 1. IPv4 监听表
    unsafe {
        let mut size: u32 = 0;
        let _ = GetExtendedTcpTable(
            std::ptr::null_mut(),
            &mut size,
            0,
            AF_INET,
            TCP_TABLE_OWNER_PID_ALL,
            0,
        );
        if size > 0 {
            let mut buffer: Vec<u8> = vec![0; size as usize];
            if GetExtendedTcpTable(
                buffer.as_mut_ptr() as *mut _,
                &mut size,
                0,
                AF_INET,
                TCP_TABLE_OWNER_PID_ALL,
                0,
            ) == 0
            {
                let num_entries = *(buffer.as_ptr() as *const u32) as usize;
                let table_ptr =
                    buffer.as_ptr().add(std::mem::size_of::<u32>()) as *const MIB_TCPROW_OWNER_PID;
                for i in 0..num_entries {
                    let row = &*table_ptr.add(i);
                    let port = (row.dw_local_port & 0xFFFF) as u16;
                    if port == target_port_be
                        && row.dw_state == MIB_TCP_STATE_LISTEN
                        && row.dw_owning_pid != 0
                        && !pids.contains(&row.dw_owning_pid)
                    {
                        pids.push(row.dw_owning_pid);
                    }
                }
            }
        }
    }

    // 2. IPv6 双栈监听表
    unsafe {
        let mut size: u32 = 0;
        let _ = GetExtendedTcpTable(
            std::ptr::null_mut(),
            &mut size,
            0,
            AF_INET6,
            TCP_TABLE_OWNER_PID_ALL,
            0,
        );
        if size > 0 {
            let mut buffer: Vec<u8> = vec![0; size as usize];
            if GetExtendedTcpTable(
                buffer.as_mut_ptr() as *mut _,
                &mut size,
                0,
                AF_INET6,
                TCP_TABLE_OWNER_PID_ALL,
                0,
            ) == 0
            {
                let num_entries = *(buffer.as_ptr() as *const u32) as usize;
                let table_ptr =
                    buffer.as_ptr().add(std::mem::size_of::<u32>()) as *const MIB_TCP6ROW_OWNER_PID;
                for i in 0..num_entries {
                    let row = &*table_ptr.add(i);
                    let port = (row.dw_local_port & 0xFFFF) as u16;
                    if port == target_port_be
                        && row.dw_state == MIB_TCP_STATE_LISTEN
                        && row.dw_owning_pid != 0
                        && !pids.contains(&row.dw_owning_pid)
                    {
                        pids.push(row.dw_owning_pid);
                    }
                }
            }
        }
    }

    pids
}

#[cfg(not(target_os = "windows"))]
pub fn get_pids_listening_on_port(_target_port: u16) -> Vec<u32> {
    Vec::new()
}

/// 检查给定端口是否在本地可立即绑定（用于确认端口已被内核彻底释放）
pub fn is_port_available(port: u16) -> bool {
    std::net::TcpListener::bind(("127.0.0.1", port)).is_ok()
}

/// Executable-name fragments identifying this application (lowercase).
/// `proxymateur` is the current binary; `antigravity` / `antigravity-tools` are the legacy
/// binary names, kept so an old instance is still recognised during the rename transition.
const MANAGER_EXE_NAME_MARKERS: [&str; 3] = ["proxymateur", "antigravity-tools", "antigravity"];

/// True when a lowercase process name or exe path looks like a Proxymateur / legacy
/// Antigravity Tools instance.
fn matches_manager_exe_marker(lowercase_value: &str) -> bool {
    MANAGER_EXE_NAME_MARKERS
        .iter()
        .any(|marker| lowercase_value.contains(marker))
}

/// 检查给定 PID 是否属于 proxymateur（或旧版 antigravity-tools）实例
fn is_antigravity_process(pid: u32, system: &sysinfo::System) -> bool {
    if let Some(proc) = system.process(sysinfo::Pid::from_u32(pid)) {
        let name = proc.name().to_string_lossy().to_lowercase();
        let exe = proc
            .exe()
            .map(|p| p.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        // Exe-path matching is limited to the specific binary names: the bare
        // "antigravity" marker is only trusted on the process name (legacy behaviour).
        return matches_manager_exe_marker(&name)
            || exe.contains("proxymateur")
            || exe.contains("antigravity-tools");
    }
    false
}

/// 优雅并彻底地接管运行在 `target_port`（默认 8045）上的后台 headless 守护进程。
///
/// 过程：
/// 1. 原生检测正在监听 `target_port` 的 PID，以及所有命令行携带 `--headless` 的 antigravity 进程；
/// 2. 过滤掉当前进程自身；
/// 3. 针对目标 headless 进程先发送本地 HTTP 优雅停机请求（300ms 超时）；
/// 4. 若进程仍未退出，则安全执行 Win32 `TerminateProcess` 终止；
/// 5. 有界轮询等待（最高 2.5 秒），直至内核彻底释放 `target_port` 套接字，杜绝 GUI 启动 Admin Server 时发生冲突或崩溃。
pub fn takeover_headless_daemon_if_running(target_port: u16) {
    let my_pid = std::process::id();
    let mut system = sysinfo::System::new();
    system.refresh_processes(sysinfo::ProcessesToUpdate::All);

    let mut candidate_pids = Vec::new();

    // 1. 获取当前占用 target_port 的 PID
    for pid in get_pids_listening_on_port(target_port) {
        if pid != my_pid && !candidate_pids.contains(&pid) {
            candidate_pids.push(pid);
        }
    }

    // 2. 遍历进程列表，发现携带 --headless 的 antigravity 进程
    for (pid, process) in system.processes() {
        let pid_u32 = pid.as_u32();
        if pid_u32 == my_pid || candidate_pids.contains(&pid_u32) {
            continue;
        }

        let name = process.name().to_string_lossy().to_lowercase();
        let is_agy = matches_manager_exe_marker(&name);
        if !is_agy {
            continue;
        }

        let cmd = process
            .cmd()
            .iter()
            .map(|c| c.to_string_lossy().to_lowercase())
            .collect::<Vec<_>>()
            .join(" ");

        if cmd.contains("--headless") {
            candidate_pids.push(pid_u32);
        }
    }

    if candidate_pids.is_empty() {
        return;
    }

    for pid in candidate_pids {
        // 确认属于本应用进程，避免误杀无关第三方服务
        if !is_antigravity_process(pid, &system) {
            warn!(
                "Port {} is occupied by PID {}, but it does not match proxymateur/antigravity-tools; skipping termination.",
                target_port, pid
            );
            continue;
        }

        info!(
            "Detected background headless instance (PID: {}) on port {}, initiating graceful takeover...",
            pid, target_port
        );

        // 步骤 3.1: 尝试本地 HTTP 优雅关机请求 (通过独立线程异步或带严格超时的客户端)
        let shutdown_url = format!("http://127.0.0.1:{}/system/shutdown", target_port);
        let _ = std::thread::spawn(move || {
            let client = reqwest::blocking::Client::builder()
                .timeout(std::time::Duration::from_millis(300))
                .build();
            if let Ok(c) = client {
                let _ = c.post(shutdown_url).send();
            }
        });

        // 步骤 3.2: 轮询等待进程优雅退出 (最高 500ms)
        let deadline = std::time::Instant::now() + std::time::Duration::from_millis(500);
        let mut exited = false;
        while std::time::Instant::now() < deadline {
            std::thread::sleep(std::time::Duration::from_millis(50));
            system.refresh_processes(sysinfo::ProcessesToUpdate::All);
            if system.process(sysinfo::Pid::from_u32(pid)).is_none() {
                exited = true;
                break;
            }
        }

        // 步骤 3.3: 若未及时退出，调用原生 API 终止
        if !exited {
            #[cfg(target_os = "windows")]
            unsafe {
                use ffi::*;
                let h_proc = OpenProcess(PROCESS_TERMINATE | SYNCHRONIZE, 0, pid);
                if !h_proc.is_null() {
                    let _ = TerminateProcess(h_proc, 0);
                    let _ = WaitForSingleObject(h_proc, 1000);
                    let _ = CloseHandle(h_proc);
                    info!(
                        "Terminated headless daemon PID {} via TerminateProcess",
                        pid
                    );
                }
            }

            #[cfg(not(target_os = "windows"))]
            {
                let _ = std::process::Command::new("kill")
                    .args(["-9", &pid.to_string()])
                    .output();
            }
        } else {
            info!("Headless daemon PID {} exited gracefully.", pid);
        }
    }

    // 步骤 4: 等待端口完全释放（内核关闭 Socket），最高等待 2.5 秒
    let release_deadline = std::time::Instant::now() + std::time::Duration::from_millis(2500);
    while std::time::Instant::now() < release_deadline {
        if is_port_available(target_port) && get_pids_listening_on_port(target_port).is_empty() {
            info!(
                "Port {} is confirmed released and available for GUI Admin Server.",
                target_port
            );
            return;
        }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }

    warn!(
        "Timed out waiting for port {} release after headless takeover; proceeding with bind attempt.",
        target_port
    );
}

// ---------------------------------------------------------------------------
// R3: Single-Instance Communication Resilience
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
static EARLY_GUI_MUTEX: OnceLock<usize> = OnceLock::new();

/// 在 Windows 启动初期进行单实例检测与有界通信。
///
/// 若已有正在运行的 GUI 实例：
/// 1. 允许目标进程将窗口置顶 (`AllowSetForegroundWindow(ASFW_ANY)`);
/// 2. 使用带严格超时 (`SendMessageTimeoutW`, 1500ms) 的消息机制通知已有 GUI 实例还原并聚焦主窗口；
/// 3. 原生唤醒并恢复已有主窗口（`SW_RESTORE`, `SetForegroundWindow`）；
/// 4. 返回 `true`，调用方应以返回码 0 立即退出（总耗时 < 3s，通常 < 100ms），绝不产生僵尸进程或管道死锁；
///
/// 若为首次启动的 GUI 实例：
/// 持有早期单实例互斥锁，返回 `false`，继续正常启动流程。
#[cfg(target_os = "windows")]
pub fn handle_existing_gui_instance_if_running(args: &[String]) -> bool {
    use ffi::*;

    // 早期互斥锁刻意保留旧名：新旧版本 exe 因此互斥，切换期间不会并存（共享 SQLite 与 8045 端口）。
    let early_mutex_name = wide_null("com.lbjlaq.antigravity-tools-early-sim");
    // 必须与 tauri.conf.json 的 identifier 对齐：`{identifier}-sic` / `{identifier}-siw`。
    let si_class_name = wide_null("com.proxymateur.app-sic");
    let si_window_name = wide_null("com.proxymateur.app-siw");
    let main_window_title = wide_null("Proxymateur");
    // 兼容仍在运行的旧版本实例，可被定位并聚焦。
    let legacy_si_class_name = wide_null("com.lbjlaq.antigravity-tools-sic");
    let legacy_si_window_name = wide_null("com.lbjlaq.antigravity-tools-siw");
    let legacy_window_title = wide_null("Antigravity Tools");

    unsafe {
        let h_mutex = CreateMutexW(std::ptr::null(), 1, early_mutex_name.as_ptr());
        let last_error = GetLastError();

        if last_error == ERROR_ALREADY_EXISTS {
            info!("Existing GUI instance detected; communicating and focusing existing window...");

            // 1. 赋予前台切换特权
            AllowSetForegroundWindow(ASFW_ANY);

            // 2. 有界超时发送激活消息至单实例隐藏窗口 (超时 1500ms，杜绝死锁)
            let mut si_hwnd = FindWindowW(si_class_name.as_ptr(), si_window_name.as_ptr());
            if si_hwnd.is_null() {
                si_hwnd = FindWindowW(
                    legacy_si_class_name.as_ptr(),
                    legacy_si_window_name.as_ptr(),
                );
            }
            if !si_hwnd.is_null() {
                let cwd = std::env::current_dir().unwrap_or_default();
                let cwd_str = cwd.to_str().unwrap_or_default();
                let args_str = args.join("|");
                let payload = format!("{cwd_str}|{args_str}\0");
                let bytes = payload.as_bytes();

                let cds = COPYDATASTRUCT {
                    dw_data: 1542, // 与 tauri-plugin-single-instance WMCOPYDATA_SINGLE_INSTANCE_DATA 严格对齐
                    cb_data: bytes.len() as u32,
                    lp_data: bytes.as_ptr() as *const _,
                };

                let mut result: usize = 0;
                let _ = SendMessageTimeoutW(
                    si_hwnd,
                    WM_COPYDATA,
                    0,
                    &cds as *const _ as isize,
                    SMTO_ABORTIFHUNG | SMTO_BLOCK,
                    1500,
                    &mut result,
                );
            }

            // 3. 直接通过 Win32 API 原生确保主窗口解除最小化并置顶聚焦
            let mut main_hwnd = FindWindowW(std::ptr::null(), main_window_title.as_ptr());
            if main_hwnd.is_null() {
                main_hwnd = FindWindowW(std::ptr::null(), legacy_window_title.as_ptr());
            }
            if !main_hwnd.is_null() {
                if IsIconic(main_hwnd) != 0 {
                    ShowWindow(main_hwnd, SW_RESTORE);
                }
                ShowWindow(main_hwnd, SW_SHOW);
                BringWindowToTop(main_hwnd);
                SetForegroundWindow(main_hwnd);
            } else if !si_hwnd.is_null() {
                // 如果主窗口标题被修改，查找与 si_hwnd 同属一个 PID 的顶层窗口并置顶
                let mut target_pid: u32 = 0;
                GetWindowThreadProcessId(si_hwnd, &mut target_pid);
                if target_pid != 0 {
                    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: isize) -> BOOL {
                        let target_pid = lparam as u32;
                        let mut proc_id: u32 = 0;
                        GetWindowThreadProcessId(hwnd, &mut proc_id);
                        if proc_id == target_pid {
                            if IsIconic(hwnd) != 0 {
                                ShowWindow(hwnd, SW_RESTORE);
                            }
                            ShowWindow(hwnd, SW_SHOW);
                            BringWindowToTop(hwnd);
                            SetForegroundWindow(hwnd);
                            return 0; // 找到即停止
                        }
                        1
                    }
                    EnumWindows(enum_proc, target_pid as isize);
                }
            }

            if !h_mutex.is_null() {
                CloseHandle(h_mutex);
            }

            return true;
        }

        // 首个 GUI 进程：持有句柄直到退出
        if !h_mutex.is_null() {
            let _ = EARLY_GUI_MUTEX.set(h_mutex as usize);
        }

        false
    }
}

#[cfg(not(target_os = "windows"))]
pub fn handle_existing_gui_instance_if_running(_args: &[String]) -> bool {
    false
}

// ---------------------------------------------------------------------------
// R2: Deterministic Window Visibility & Foreground Focus
// ---------------------------------------------------------------------------

/// 原生确保给定 WebviewWindow 可见、解除最小化并处于前台焦点
pub fn ensure_webview_window_visible_and_foreground<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
) {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();

    #[cfg(target_os = "windows")]
    if let Ok(hwnd) = window.hwnd() {
        unsafe {
            use ffi::*;
            let h = hwnd.0 as _;
            if IsIconic(h) != 0 {
                ShowWindow(h, SW_RESTORE);
            }
            if IsWindowVisible(h) == 0 {
                ShowWindow(h, SW_SHOW);
            }
            BringWindowToTop(h);
            SetForegroundWindow(h);
        }
    }
}

/// 原生确保给定 Window 可见、解除最小化并处于前台焦点
pub fn ensure_tauri_window_visible_and_foreground(window: &tauri::Window) {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();

    #[cfg(target_os = "windows")]
    if let Ok(hwnd) = window.hwnd() {
        unsafe {
            use ffi::*;
            let h = hwnd.0 as _;
            if IsIconic(h) != 0 {
                ShowWindow(h, SW_RESTORE);
            }
            if IsWindowVisible(h) == 0 {
                ShowWindow(h, SW_SHOW);
            }
            BringWindowToTop(h);
            SetForegroundWindow(h);
        }
    }
}
