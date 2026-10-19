//! One-shot, idempotent migration of per-identity OS state from the legacy
//! "Antigravity Tools" identity to the Proxymateur identity.
//!
//! Tauri derives three on-disk locations from `tauri.conf.json`'s `identifier`
//! (WebView2 profile, window-state file, single-instance names) and the autostart
//! registry value from `productName`. Changing either orphans the old state, so this
//! runs in `run()` BEFORE the Tauri builder / WebView exist.
//!
//! The user data directory (`~/.antigravity_tools` -> `~/.proxymateur`) is migrated separately
//! by [`migrate_legacy_data_dir`], which must run before the logger / any `get_data_dir()`.
//! Nothing is deleted unless it was successfully moved; a copy fallback keeps the source.

use std::path::PathBuf;

/// Current default data directory name, relative to the user's home directory.
pub const DATA_DIR: &str = ".proxymateur";
/// Legacy default data directory name (pre-rename).
pub const LEGACY_DATA_DIR: &str = ".antigravity_tools";
/// Current data-dir pointer file name (relative to home).
pub const POINTER_FILE: &str = ".proxymateur_location";
/// Legacy data-dir pointer file name (relative to home); still read as a fallback.
pub const LEGACY_POINTER_FILE: &str = ".antigravity_tools_location";

/// Result of resolving the default data directory under a given home directory.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DefaultDataDir {
    pub path: PathBuf,
    /// True when the legacy directory is returned because it exists and the new one does not
    /// (migration did not run or failed): the app keeps working on the legacy data.
    pub is_legacy: bool,
}

fn dir_has_entries(path: &std::path::Path) -> bool {
    std::fs::read_dir(path)
        .map(|mut d| d.next().is_some())
        .unwrap_or(false)
}

/// Resolves the default data directory without creating or modifying anything.
///
/// 1. `<home>/.proxymateur` if it exists (an EMPTY one is ignored while a non-empty legacy
///    directory exists, so a stray empty folder can never shadow real data);
/// 2. else `<home>/.antigravity_tools` if it is a directory (never start empty);
/// 3. else `<home>/.proxymateur`.
pub fn resolve_default_data_dir(home: &std::path::Path) -> DefaultDataDir {
    let new = home.join(DATA_DIR);
    let legacy = home.join(LEGACY_DATA_DIR);
    if new.exists() {
        let shadows_real_data =
            new.is_dir() && !dir_has_entries(&new) && legacy.is_dir() && dir_has_entries(&legacy);
        if !shadows_real_data {
            return DefaultDataDir {
                path: new,
                is_legacy: false,
            };
        }
    }
    if legacy.is_dir() {
        return DefaultDataDir {
            path: legacy,
            is_legacy: true,
        };
    }
    DefaultDataDir {
        path: new,
        is_legacy: false,
    }
}

/// Outcome of [`migrate_legacy_data_dir`] (also used by the tests).
#[cfg(windows)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DataDirMigration {
    /// `ABV_DATA_DIR` is set: the data dir is explicit, nothing to migrate.
    SkippedEnvOverride,
    /// No legacy directory (pointer file may still have been moved).
    NothingToDo,
    /// Legacy directory renamed to the new name.
    Migrated,
    /// Both directories exist and the new one is populated: left untouched, new one wins.
    BothExist,
    /// Rename failed (files locked, ...): nothing was copied or deleted; the app falls back to
    /// the legacy directory via [`resolve_default_data_dir`].
    RenameFailed,
}

/// Moves `~/.antigravity_tools` to `~/.proxymateur` (and the legacy pointer file likewise).
///
/// Must run before the tracing logger is initialised and before anything calls
/// `get_data_dir()`, hence `eprintln!` only. Idempotent; never copies live databases and never
/// deletes anything: on failure the app keeps using the legacy directory.
#[cfg(not(windows))]
pub fn migrate_legacy_data_dir() {}

#[cfg(windows)]
pub fn migrate_legacy_data_dir() {
    let env_override = std::env::var("ABV_DATA_DIR")
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false);
    let Some(home) = dirs::home_dir() else {
        return;
    };
    migrate_legacy_data_dir_in(&home, env_override);
}

#[cfg(windows)]
fn migrate_legacy_data_dir_in(home: &Path, env_override: bool) -> DataDirMigration {
    if env_override {
        return DataDirMigration::SkippedEnvOverride;
    }
    let legacy = home.join(LEGACY_DATA_DIR);
    let new = home.join(DATA_DIR);
    let mut outcome = DataDirMigration::NothingToDo;

    if legacy.is_dir() {
        // An empty destination counts as absent (remove_dir only succeeds on an empty dir).
        if new.is_dir() && !dir_has_entries(&new) {
            let _ = fs::remove_dir(&new);
        }
        if new.exists() {
            eprintln!(
                "[data-dir-migration] both {legacy:?} and {new:?} exist; leaving both untouched, using {new:?}"
            );
            outcome = DataDirMigration::BothExist;
        } else {
            match rename_retry(&legacy, &new) {
                Ok(()) => {
                    eprintln!("[data-dir-migration] renamed {legacy:?} -> {new:?}");
                    outcome = DataDirMigration::Migrated;
                }
                Err(e) => {
                    eprintln!(
                        "[data-dir-migration] cannot rename {legacy:?} -> {new:?}: {e}; continuing on the legacy directory (no data copied or deleted)"
                    );
                    return DataDirMigration::RenameFailed;
                }
            }
        }
    }

    let legacy_pointer = home.join(LEGACY_POINTER_FILE);
    let new_pointer = home.join(POINTER_FILE);
    if legacy_pointer.is_file() && !new_pointer.exists() {
        match rename_retry(&legacy_pointer, &new_pointer) {
            Ok(()) => eprintln!(
                "[data-dir-migration] renamed pointer {legacy_pointer:?} -> {new_pointer:?}"
            ),
            Err(e) => eprintln!(
                "[data-dir-migration] cannot rename pointer {legacy_pointer:?}: {e}; the legacy pointer is still honoured"
            ),
        }
    }
    outcome
}

#[cfg(windows)]
use std::{fs, io, path::Path, thread, time::Duration};

#[cfg(windows)]
use tracing::{info, warn};

pub const LEGACY_IDENTIFIER: &str = "com.lbjlaq.antigravity-tools";
/// Must equal `identifier` in tauri.conf.json.
pub const IDENTIFIER: &str = "com.proxymateur.app";
pub const LEGACY_PRODUCT_NAME: &str = "Antigravity Tools";
/// Must equal `productName` in tauri.conf.json (autostart Run value name).
pub const PRODUCT_NAME: &str = "Proxymateur";

#[cfg(not(windows))]
pub fn migrate_legacy_identity() {}

#[cfg(windows)]
pub fn migrate_legacy_identity() {
    let started = std::time::Instant::now();
    // %LOCALAPPDATA% holds EBWebView; %APPDATA% holds .window-state.json (same bases Tauri uses).
    for (label, base) in [
        ("local", dirs::data_local_dir()),
        ("roaming", dirs::data_dir()),
    ] {
        if let Some(base) = base {
            migrate_dir(label, &base.join(LEGACY_IDENTIFIER), &base.join(IDENTIFIER));
        }
    }
    migrate_autostart();
    info!("[identity-migration] done in {:?}", started.elapsed());
}

#[cfg(windows)]
fn migrate_dir(label: &str, old: &Path, new: &Path) {
    if !old.is_dir() {
        return; // nothing to do, or already moved
    }
    sweep_tmp(new); // drop *.migrating leftovers from an interrupted copy
    if new.is_dir()
        && fs::read_dir(new)
            .map(|mut d| d.next().is_none())
            .unwrap_or(false)
    {
        let _ = fs::remove_dir(new); // an empty destination counts as absent
    }

    if !new.exists() {
        match rename_retry(old, new) {
            Ok(()) => {
                info!("[identity-migration] {label}: renamed {old:?} -> {new:?}");
                return;
            }
            Err(e) => warn!(
                "[identity-migration] {label}: rename failed ({e}); falling back to per-entry move/copy"
            ),
        }
        if let Err(e) = fs::create_dir_all(new) {
            warn!("[identity-migration] {label}: cannot create {new:?}: {e}");
            return;
        }
    } else if !new.is_dir() {
        warn!("[identity-migration] {label}: {new:?} exists and is not a directory; skipping");
        return;
    }

    // Non-clobbering per-entry merge: existing destinations are never overwritten.
    let Ok(entries) = fs::read_dir(old) else {
        return;
    };
    for entry in entries.flatten() {
        let src = entry.path();
        let dst = new.join(entry.file_name());
        if dst.exists() {
            info!("[identity-migration] {label}: keeping existing {dst:?}; source retained");
            continue;
        }
        if rename_retry(&src, &dst).is_ok() {
            info!("[identity-migration] {label}: moved {src:?}");
            continue;
        }
        // Copy to a temp name first so a crash cannot leave a half-copied profile that looks valid.
        let tmp = new.join(format!("{}.migrating", entry.file_name().to_string_lossy()));
        let _ = remove_any(&tmp);
        match copy_any(&src, &tmp).and_then(|_| fs::rename(&tmp, &dst)) {
            Ok(()) => info!("[identity-migration] {label}: copied {src:?} (source retained)"),
            Err(e) => {
                let _ = remove_any(&tmp);
                warn!(
                    "[identity-migration] {label}: copy of {src:?} failed: {e}; the new profile starts fresh"
                );
            }
        }
    }
    let _ = fs::remove_dir(old); // succeeds only when empty; never recursive
}

/// Renames with a short retry: WebView2 child processes can hold files ~1s after an exit.
#[cfg(windows)]
fn rename_retry(from: &Path, to: &Path) -> io::Result<()> {
    let mut last = None;
    for _ in 0..6 {
        match fs::rename(from, to) {
            Ok(()) => return Ok(()),
            // 5 = access denied, 32 = sharing violation, 33 = lock violation
            Err(e) if matches!(e.raw_os_error(), Some(5) | Some(32) | Some(33)) => {
                last = Some(e);
                thread::sleep(Duration::from_millis(250));
            }
            Err(e) => return Err(e),
        }
    }
    Err(last.unwrap_or_else(|| io::Error::other("rename retries exhausted")))
}

#[cfg(windows)]
fn copy_any(src: &Path, dst: &Path) -> io::Result<()> {
    if fs::metadata(src)?.is_dir() {
        fs::create_dir_all(dst)?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            copy_any(&entry.path(), &dst.join(entry.file_name()))?;
        }
        Ok(())
    } else {
        fs::copy(src, dst).map(|_| ())
    }
}

#[cfg(windows)]
fn remove_any(path: &Path) -> io::Result<()> {
    match fs::metadata(path) {
        Ok(m) if m.is_dir() => fs::remove_dir_all(path),
        Ok(_) => fs::remove_file(path),
        Err(_) => Ok(()),
    }
}

#[cfg(windows)]
fn sweep_tmp(dir: &Path) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if entry.file_name().to_string_lossy().ends_with(".migrating") {
                let _ = remove_any(&entry.path());
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Autostart (HKCU Run value is named after productName). Uses reg.exe so no new
// crate dependency is needed.
// ---------------------------------------------------------------------------
#[cfg(windows)]
const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
#[cfg(windows)]
const APPROVED_KEY: &str =
    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";

#[cfg(windows)]
fn reg(args: &[&str]) -> Option<String> {
    use std::os::windows::process::CommandExt;
    let out = std::process::Command::new("reg")
        .args(args)
        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
        .output()
        .ok()?;
    if out.status.success() {
        Some(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        None
    }
}

/// Parses `reg query <key> /v <name>` output into `(type, data)`.
#[cfg(windows)]
fn parse_reg_value(stdout: &str, name: &str) -> Option<(String, String)> {
    stdout.lines().find_map(|line| {
        let rest = line.trim().strip_prefix(name)?.trim_start();
        let (ty, data) = rest.split_once(char::is_whitespace)?;
        ty.starts_with("REG_")
            .then(|| (ty.to_string(), data.trim().to_string()))
    })
}

/// Same rule as auto-launch: an entry is disabled when the last 8 bytes of its
/// StartupApproved value (>= 8 bytes) are not all zero.
#[cfg(windows)]
fn approved_hex_is_disabled(hex: &str) -> bool {
    let bytes: Vec<u8> = (0..hex.len() / 2)
        .filter_map(|i| u8::from_str_radix(hex.get(i * 2..i * 2 + 2)?, 16).ok())
        .collect();
    bytes.len() >= 8 && bytes[bytes.len() - 8..].iter().any(|b| *b != 0)
}

#[cfg(windows)]
fn migrate_autostart() {
    let Some(out) = reg(&["query", RUN_KEY, "/v", LEGACY_PRODUCT_NAME]) else {
        return; // legacy autostart absent: nothing to migrate
    };
    let Some((_, command)) = parse_reg_value(&out, LEGACY_PRODUCT_NAME) else {
        return;
    };
    let approved = reg(&["query", APPROVED_KEY, "/v", LEGACY_PRODUCT_NAME])
        .and_then(|o| parse_reg_value(&o, LEGACY_PRODUCT_NAME))
        .map(|(_, hex)| hex);
    let disabled = approved
        .as_deref()
        .map(approved_hex_is_disabled)
        .unwrap_or(false);
    let new_exists = reg(&["query", RUN_KEY, "/v", PRODUCT_NAME]).is_some();

    let mut safe_to_delete_legacy = true;
    if disabled {
        info!("[identity-migration] legacy autostart was disabled in Task Manager; not re-registering");
    } else if !new_exists {
        let ok = reg(&[
            "add",
            RUN_KEY,
            "/v",
            PRODUCT_NAME,
            "/t",
            "REG_SZ",
            "/d",
            &command,
            "/f",
        ])
        .is_some();
        if ok {
            if let Some(hex) = approved.as_deref() {
                let _ = reg(&[
                    "add",
                    APPROVED_KEY,
                    "/v",
                    PRODUCT_NAME,
                    "/t",
                    "REG_BINARY",
                    "/d",
                    hex,
                    "/f",
                ]);
            }
            info!("[identity-migration] autostart re-registered as '{PRODUCT_NAME}'");
        } else {
            warn!("[identity-migration] could not write the new autostart value; keeping the legacy one");
            safe_to_delete_legacy = false;
        }
    }
    if safe_to_delete_legacy {
        let _ = reg(&["delete", RUN_KEY, "/v", LEGACY_PRODUCT_NAME, "/f"]);
        let _ = reg(&["delete", APPROVED_KEY, "/v", LEGACY_PRODUCT_NAME, "/f"]);
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::fs;

    fn write(p: &Path, s: &str) {
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, s).unwrap();
    }

    #[test]
    fn renames_whole_dir_when_new_is_absent() {
        let t = tempfile::tempdir().unwrap();
        let (old, new) = (t.path().join("old"), t.path().join("new"));
        write(&old.join("EBWebView/Default/a.txt"), "x");
        migrate_dir("t", &old, &new);
        assert!(!old.exists());
        assert_eq!(
            fs::read_to_string(new.join("EBWebView/Default/a.txt")).unwrap(),
            "x"
        );
    }

    #[test]
    fn empty_new_dir_counts_as_absent() {
        let t = tempfile::tempdir().unwrap();
        let (old, new) = (t.path().join("old"), t.path().join("new"));
        write(&old.join("f.txt"), "1");
        fs::create_dir_all(&new).unwrap();
        migrate_dir("t", &old, &new);
        assert_eq!(fs::read_to_string(new.join("f.txt")).unwrap(), "1");
    }

    #[test]
    fn existing_destination_is_never_overwritten() {
        let t = tempfile::tempdir().unwrap();
        let (old, new) = (t.path().join("old"), t.path().join("new"));
        write(&old.join("keep.txt"), "old");
        write(&old.join("move.txt"), "moved");
        write(&new.join("keep.txt"), "new");
        migrate_dir("t", &old, &new);
        assert_eq!(fs::read_to_string(new.join("keep.txt")).unwrap(), "new");
        assert_eq!(fs::read_to_string(new.join("move.txt")).unwrap(), "moved");
        assert_eq!(fs::read_to_string(old.join("keep.txt")).unwrap(), "old"); // source retained
    }

    #[test]
    fn rerun_is_a_no_op() {
        let t = tempfile::tempdir().unwrap();
        let (old, new) = (t.path().join("old"), t.path().join("new"));
        write(&old.join("f.txt"), "1");
        migrate_dir("t", &old, &new);
        migrate_dir("t", &old, &new);
        assert_eq!(fs::read_to_string(new.join("f.txt")).unwrap(), "1");
    }

    #[test]
    fn leftover_migrating_temp_is_swept() {
        let t = tempfile::tempdir().unwrap();
        let (old, new) = (t.path().join("old"), t.path().join("new"));
        write(&old.join("f.txt"), "1");
        write(&new.join("EBWebView.migrating/partial"), "junk");
        migrate_dir("t", &old, &new);
        assert!(!new.join("EBWebView.migrating").exists());
        assert_eq!(fs::read_to_string(new.join("f.txt")).unwrap(), "1");
    }

    #[test]
    fn parses_reg_query_output() {
        let out = "\r\nHKEY_CURRENT_USER\\Software\\X\r\n    Antigravity Tools    REG_SZ    \"E:\\a b\\x.exe\" --minimized\r\n";
        let (ty, data) = parse_reg_value(out, "Antigravity Tools").unwrap();
        assert_eq!(ty, "REG_SZ");
        assert_eq!(data, "\"E:\\a b\\x.exe\" --minimized");
    }

    #[test]
    fn startup_approved_flags() {
        assert!(!approved_hex_is_disabled("020000000000000000000000"));
        assert!(approved_hex_is_disabled("03000000a1b2c3d4e5f60718"));
    }
}

#[cfg(test)]
mod data_dir_resolution_tests {
    use super::*;
    use std::fs;

    fn home() -> tempfile::TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn neither_exists_resolves_to_new_dir() {
        let h = home();
        let r = resolve_default_data_dir(h.path());
        assert_eq!(r.path, h.path().join(DATA_DIR));
        assert!(!r.is_legacy);
    }

    #[test]
    fn new_dir_wins_when_present() {
        let h = home();
        fs::create_dir_all(h.path().join(DATA_DIR)).unwrap();
        fs::write(h.path().join(DATA_DIR).join("accounts.json"), "{}").unwrap();
        fs::create_dir_all(h.path().join(LEGACY_DATA_DIR)).unwrap();
        fs::write(h.path().join(LEGACY_DATA_DIR).join("accounts.json"), "{}").unwrap();
        let r = resolve_default_data_dir(h.path());
        assert_eq!(r.path, h.path().join(DATA_DIR));
        assert!(!r.is_legacy);
    }

    #[test]
    fn legacy_only_falls_back_to_legacy_dir() {
        let h = home();
        fs::create_dir_all(h.path().join(LEGACY_DATA_DIR)).unwrap();
        let r = resolve_default_data_dir(h.path());
        assert_eq!(r.path, h.path().join(LEGACY_DATA_DIR));
        assert!(r.is_legacy);
    }

    #[test]
    fn empty_new_dir_never_shadows_populated_legacy_dir() {
        let h = home();
        fs::create_dir_all(h.path().join(DATA_DIR)).unwrap();
        fs::create_dir_all(h.path().join(LEGACY_DATA_DIR)).unwrap();
        fs::write(h.path().join(LEGACY_DATA_DIR).join("accounts.json"), "{}").unwrap();
        let r = resolve_default_data_dir(h.path());
        assert_eq!(r.path, h.path().join(LEGACY_DATA_DIR));
        assert!(r.is_legacy);
    }

    #[test]
    fn empty_new_dir_with_empty_legacy_dir_uses_new() {
        let h = home();
        fs::create_dir_all(h.path().join(DATA_DIR)).unwrap();
        fs::create_dir_all(h.path().join(LEGACY_DATA_DIR)).unwrap();
        let r = resolve_default_data_dir(h.path());
        assert_eq!(r.path, h.path().join(DATA_DIR));
        assert!(!r.is_legacy);
    }
}

#[cfg(all(test, windows))]
mod data_dir_migration_tests {
    use super::*;

    fn write(p: &Path, s: &str) {
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, s).unwrap();
    }

    #[test]
    fn renames_legacy_dir_and_pointer() {
        let h = tempfile::tempdir().unwrap();
        let home = h.path();
        write(
            &home.join(LEGACY_DATA_DIR).join("accounts.json"),
            "{\"a\":1}",
        );
        write(
            &home.join(LEGACY_DATA_DIR).join("accounts").join("x.json"),
            "x",
        );
        write(&home.join(LEGACY_POINTER_FILE), "D:\\custom");

        assert_eq!(
            migrate_legacy_data_dir_in(home, false),
            DataDirMigration::Migrated
        );
        assert!(!home.join(LEGACY_DATA_DIR).exists());
        assert_eq!(
            fs::read_to_string(home.join(DATA_DIR).join("accounts.json")).unwrap(),
            "{\"a\":1}"
        );
        assert_eq!(
            fs::read_to_string(home.join(DATA_DIR).join("accounts").join("x.json")).unwrap(),
            "x"
        );
        assert!(!home.join(LEGACY_POINTER_FILE).exists());
        assert_eq!(
            fs::read_to_string(home.join(POINTER_FILE)).unwrap(),
            "D:\\custom"
        );
        let r = resolve_default_data_dir(home);
        assert_eq!(r.path, home.join(DATA_DIR));
        assert!(!r.is_legacy);
    }

    #[test]
    fn is_idempotent() {
        let h = tempfile::tempdir().unwrap();
        let home = h.path();
        write(&home.join(LEGACY_DATA_DIR).join("f.txt"), "1");
        assert_eq!(
            migrate_legacy_data_dir_in(home, false),
            DataDirMigration::Migrated
        );
        assert_eq!(
            migrate_legacy_data_dir_in(home, false),
            DataDirMigration::NothingToDo
        );
        assert_eq!(
            fs::read_to_string(home.join(DATA_DIR).join("f.txt")).unwrap(),
            "1"
        );
    }

    #[test]
    fn env_override_skips_everything() {
        let h = tempfile::tempdir().unwrap();
        let home = h.path();
        write(&home.join(LEGACY_DATA_DIR).join("f.txt"), "1");
        write(&home.join(LEGACY_POINTER_FILE), "D:\\custom");
        assert_eq!(
            migrate_legacy_data_dir_in(home, true),
            DataDirMigration::SkippedEnvOverride
        );
        assert!(home.join(LEGACY_DATA_DIR).join("f.txt").exists());
        assert!(home.join(LEGACY_POINTER_FILE).exists());
        assert!(!home.join(DATA_DIR).exists());
    }

    #[test]
    fn populated_new_dir_is_never_overwritten() {
        let h = tempfile::tempdir().unwrap();
        let home = h.path();
        write(&home.join(LEGACY_DATA_DIR).join("f.txt"), "old");
        write(&home.join(DATA_DIR).join("f.txt"), "new");
        assert_eq!(
            migrate_legacy_data_dir_in(home, false),
            DataDirMigration::BothExist
        );
        assert_eq!(
            fs::read_to_string(home.join(LEGACY_DATA_DIR).join("f.txt")).unwrap(),
            "old"
        );
        assert_eq!(
            fs::read_to_string(home.join(DATA_DIR).join("f.txt")).unwrap(),
            "new"
        );
    }

    #[test]
    fn empty_new_dir_counts_as_absent() {
        let h = tempfile::tempdir().unwrap();
        let home = h.path();
        write(&home.join(LEGACY_DATA_DIR).join("f.txt"), "1");
        fs::create_dir_all(home.join(DATA_DIR)).unwrap();
        assert_eq!(
            migrate_legacy_data_dir_in(home, false),
            DataDirMigration::Migrated
        );
        assert_eq!(
            fs::read_to_string(home.join(DATA_DIR).join("f.txt")).unwrap(),
            "1"
        );
    }

    #[test]
    fn pointer_is_moved_even_without_legacy_dir_and_never_overwritten() {
        let h = tempfile::tempdir().unwrap();
        let home = h.path();
        write(&home.join(LEGACY_POINTER_FILE), "D:\\custom");
        assert_eq!(
            migrate_legacy_data_dir_in(home, false),
            DataDirMigration::NothingToDo
        );
        assert!(!home.join(LEGACY_POINTER_FILE).exists());
        assert_eq!(
            fs::read_to_string(home.join(POINTER_FILE)).unwrap(),
            "D:\\custom"
        );

        // An existing new pointer wins; the legacy one is left in place.
        write(&home.join(LEGACY_POINTER_FILE), "E:\\other");
        migrate_legacy_data_dir_in(home, false);
        assert_eq!(
            fs::read_to_string(home.join(POINTER_FILE)).unwrap(),
            "D:\\custom"
        );
        assert!(home.join(LEGACY_POINTER_FILE).exists());
    }

    #[test]
    fn nothing_present_is_a_no_op() {
        let h = tempfile::tempdir().unwrap();
        assert_eq!(
            migrate_legacy_data_dir_in(h.path(), false),
            DataDirMigration::NothingToDo
        );
        assert!(!h.path().join(DATA_DIR).exists());
    }
}
