use crate::models::Account;
use crate::modules::{account, config, logger, quota};
use chrono::{DateTime, Utc};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tokio::time::{self, Duration};

// Warmup history: key = "email:bucket_or_model:weekly:cycle_id", value = warmup timestamp
static WARMUP_HISTORY: Lazy<Mutex<HashMap<String, i64>>> =
    Lazy::new(|| Mutex::new(load_warmup_history()));

fn get_warmup_history_path() -> Result<PathBuf, String> {
    let data_dir = account::get_data_dir()?;
    Ok(data_dir.join("warmup_history.json"))
}

fn load_warmup_history() -> HashMap<String, i64> {
    match get_warmup_history_path() {
        Ok(path) if path.exists() => match std::fs::read_to_string(&path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => HashMap::new(),
        },
        _ => HashMap::new(),
    }
}

fn save_warmup_history(history: &HashMap<String, i64>) {
    if let Ok(path) = get_warmup_history_path() {
        if let Ok(content) = serde_json::to_string_pretty(history) {
            let _ = std::fs::write(&path, content);
        }
    }
}

pub fn record_warmup_history(key: &str, timestamp: i64) {
    let mut history = WARMUP_HISTORY.lock().unwrap();
    history.insert(key.to_string(), timestamp);
    save_warmup_history(&history);
}

pub fn check_cooldown(key: &str, cooldown_seconds: i64) -> bool {
    let history = WARMUP_HISTORY.lock().unwrap();
    if let Some(&last_ts) = history.get(key) {
        let now = chrono::Utc::now().timestamp();
        now - last_ts < cooldown_seconds
    } else {
        false
    }
}

/// Helper to parse ISO8601 / RFC3339 string to timestamp
fn parse_reset_time_ts(s: &str) -> Option<i64> {
    if s.is_empty() {
        return None;
    }
    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return Some(dt.timestamp());
    }
    if let Ok(dt) = DateTime::parse_from_str(s, "%Y/%m/%d %H:%M:%S") {
        return Some(dt.timestamp());
    }
    None
}

/// Select a model to ping for a given group, honoring user's monitored_models preference if available
fn pick_model_for_group(
    group_name: &str,
    bucket_id: &str,
    monitored_models: &[String],
) -> Option<String> {
    let is_3p = bucket_id.to_lowercase().contains("3p")
        || group_name.to_lowercase().contains("claude")
        || group_name.to_lowercase().contains("gpt");

    if is_3p {
        if monitored_models.is_empty() {
            return Some("claude-sonnet-4-6".to_string());
        }
        monitored_models
            .iter()
            .find(|m| {
                let l = m.to_lowercase();
                l.contains("claude") || l.contains("gpt")
            })
            .cloned()
    } else {
        if monitored_models.is_empty() {
            return Some("gemini-3-flash".to_string());
        }
        monitored_models
            .iter()
            .find(|m| {
                let l = m.to_lowercase();
                l.contains("gemini")
            })
            .cloned()
    }
}

/// Start smart warmup scheduler (monitors weekly and 5-hour quota windows)
pub fn start_scheduler(
    app_handle: Option<tauri::AppHandle>,
    proxy_state: crate::commands::proxy::ProxyServiceState,
) {
    tauri::async_runtime::spawn(async move {
        logger::log_info(
            "[Scheduler] Smart Warmup Scheduler started. Monitoring weekly and 5-hour quota windows...",
        );

        // Scan every 5 minutes (300s) to check for accounts reaching reset time or idle 5h windows
        let mut interval = time::interval(Duration::from_secs(300));

        loop {
            interval.tick().await;

            // Load configuration
            let Ok(app_config) = config::load_app_config() else {
                continue;
            };

            // Must be enabled by user in Settings
            if !app_config.scheduled_warmup.enabled {
                continue;
            }

            let Ok(accounts) = account::list_accounts() else {
                continue;
            };

            if accounts.is_empty() {
                continue;
            }

            let now_ts = Utc::now().timestamp();
            let mut tasks_to_run: Vec<(
                String,
                String,
                String,
                String,
                String,
                Vec<String>,
                &'static str,
            )> = Vec::new();
            let mut queued_targets = std::collections::HashSet::new();

            for acc in &accounts {
                if acc.disabled {
                    continue;
                }

                let Ok((token, pid)) = quota::get_valid_token_for_warmup(acc).await else {
                    continue;
                };

                let Ok((fresh_quota, _)) =
                    quota::fetch_quota_with_cache(&token, &acc.email, Some(&pid), Some(&acc.id))
                        .await
                else {
                    continue;
                };

                if fresh_quota.is_forbidden {
                    continue;
                }

                // Check quota_groups for WEEKLY and 5-HOUR buckets
                if let Some(groups) = &fresh_quota.quota_groups {
                    for group in groups {
                        for bucket in &group.buckets {
                            let win_lower = bucket.window.to_lowercase();
                            let bid_lower = bucket.bucket_id.to_lowercase();
                            let is_weekly = win_lower.contains("week")
                                || bid_lower.contains("week")
                                || win_lower.contains("7d")
                                || bid_lower.contains("7d");
                            let is_5h = win_lower.contains("5h")
                                || bid_lower.contains("5h")
                                || win_lower.contains("hour")
                                || bid_lower.contains("hour");

                            if !is_weekly
                                && !(is_5h && app_config.scheduled_warmup.enable_5h_warmup)
                            {
                                continue;
                            }

                            // If fraction is 1.0 (100% full)
                            if bucket.remaining_fraction >= 0.999 {
                                let reset_ts_opt = parse_reset_time_ts(&bucket.reset_time);

                                // 1. Weekly Bucket Check
                                if is_weekly {
                                    let should_warmup = match reset_ts_opt {
                                        Some(reset_ts) => now_ts >= reset_ts - 60,
                                        None => true, // Cold start: weekly timer not yet activated
                                    };

                                    if should_warmup {
                                        let history_key = match reset_ts_opt {
                                            Some(reset_ts) => format!(
                                                "{}:{}:weekly:{}",
                                                acc.email, bucket.bucket_id, reset_ts
                                            ),
                                            None => format!(
                                                "{}:{}:weekly:initial",
                                                acc.email, bucket.bucket_id
                                            ),
                                        };

                                        if !check_cooldown(&history_key, 6 * 86400) {
                                            if let Some(model_to_ping) = pick_model_for_group(
                                                &group.display_name,
                                                &bucket.bucket_id,
                                                &app_config.scheduled_warmup.monitored_models,
                                            ) {
                                                let target_key =
                                                    (acc.id.clone(), model_to_ping.clone());
                                                if !queued_targets.contains(&target_key) {
                                                    queued_targets.insert(target_key);
                                                    tasks_to_run.push((
                                                        acc.id.clone(),
                                                        acc.email.clone(),
                                                        model_to_ping,
                                                        token.clone(),
                                                        pid.clone(),
                                                        vec![
                                                            history_key,
                                                            format!(
                                                                "{}:{}:5h",
                                                                acc.email, bucket.bucket_id
                                                            ),
                                                        ],
                                                        "weekly",
                                                    ));
                                                }
                                            }
                                        }
                                    }
                                }

                                // 2. 5-Hour Rolling Window Check (if enable_5h_warmup is enabled)
                                if is_5h && app_config.scheduled_warmup.enable_5h_warmup {
                                    let should_warmup_5h = match reset_ts_opt {
                                        Some(reset_ts) => now_ts >= reset_ts - 60, // Periodic reset: 5h cycle has expired, back at 100%
                                        None => true, // Cold start / idle: no active 5-hour countdown running
                                    };

                                    if should_warmup_5h {
                                        let generic_5h_key =
                                            format!("{}:{}:5h", acc.email, bucket.bucket_id);
                                        let cycle_key = match reset_ts_opt {
                                            Some(reset_ts) => format!(
                                                "{}:{}:5h:{}",
                                                acc.email, bucket.bucket_id, reset_ts
                                            ),
                                            None => format!(
                                                "{}:{}:5h:idle",
                                                acc.email, bucket.bucket_id
                                            ),
                                        };

                                        if let Some(model_to_ping) = pick_model_for_group(
                                            &group.display_name,
                                            &bucket.bucket_id,
                                            &app_config.scheduled_warmup.monitored_models,
                                        ) {
                                            let manual_key =
                                                format!("{}:{}:100", acc.email, model_to_ping);

                                            if !check_cooldown(&generic_5h_key, 17400)
                                                && !check_cooldown(&cycle_key, 17400)
                                                && !check_cooldown(&manual_key, 14400)
                                            {
                                                let target_key =
                                                    (acc.id.clone(), model_to_ping.clone());
                                                if !queued_targets.contains(&target_key) {
                                                    queued_targets.insert(target_key);
                                                    tasks_to_run.push((
                                                        acc.id.clone(),
                                                        acc.email.clone(),
                                                        model_to_ping,
                                                        token.clone(),
                                                        pid.clone(),
                                                        vec![generic_5h_key, cycle_key, manual_key],
                                                        "5-hour rolling",
                                                    ));
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // Fallback to models if quota_groups is not populated
                    for model in &fresh_quota.models {
                        if model.percentage >= 100 {
                            let is_monitored =
                                if app_config.scheduled_warmup.monitored_models.is_empty() {
                                    true
                                } else {
                                    app_config
                                        .scheduled_warmup
                                        .monitored_models
                                        .iter()
                                        .any(|m| {
                                            model.name.to_lowercase().contains(&m.to_lowercase())
                                        })
                                };
                            if !is_monitored {
                                continue;
                            }

                            let reset_ts_opt = parse_reset_time_ts(&model.reset_time);

                            // Weekly check
                            if let Some(reset_ts) = reset_ts_opt {
                                if now_ts >= reset_ts - 60 {
                                    let history_key =
                                        format!("{}:{}:weekly:{}", acc.email, model.name, reset_ts);
                                    if !check_cooldown(&history_key, 6 * 86400) {
                                        let target_key = (acc.id.clone(), model.name.clone());
                                        if !queued_targets.contains(&target_key) {
                                            queued_targets.insert(target_key);
                                            tasks_to_run.push((
                                                acc.id.clone(),
                                                acc.email.clone(),
                                                model.name.clone(),
                                                token.clone(),
                                                pid.clone(),
                                                vec![
                                                    history_key,
                                                    format!("{}:{}:5h", acc.email, model.name),
                                                ],
                                                "weekly",
                                            ));
                                        }
                                    }
                                }
                            }

                            // 5h check (if enable_5h_warmup)
                            if app_config.scheduled_warmup.enable_5h_warmup {
                                let should_warmup_5h = match reset_ts_opt {
                                    Some(reset_ts) => now_ts >= reset_ts - 60,
                                    None => true, // idle, no timer running
                                };

                                if should_warmup_5h {
                                    let generic_5h_key = format!("{}:{}:5h", acc.email, model.name);
                                    let cycle_key = match reset_ts_opt {
                                        Some(reset_ts) => {
                                            format!("{}:{}:5h:{}", acc.email, model.name, reset_ts)
                                        }
                                        None => format!("{}:{}:5h:idle", acc.email, model.name),
                                    };
                                    let manual_key = format!("{}:{}:100", acc.email, model.name);

                                    if !check_cooldown(&generic_5h_key, 17400)
                                        && !check_cooldown(&cycle_key, 17400)
                                        && !check_cooldown(&manual_key, 14400)
                                    {
                                        let target_key = (acc.id.clone(), model.name.clone());
                                        if !queued_targets.contains(&target_key) {
                                            queued_targets.insert(target_key);
                                            tasks_to_run.push((
                                                acc.id.clone(),
                                                acc.email.clone(),
                                                model.name.clone(),
                                                token.clone(),
                                                pid.clone(),
                                                vec![generic_5h_key, cycle_key, manual_key],
                                                "5-hour rolling",
                                            ));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Execute warmup tasks
            if !tasks_to_run.is_empty() {
                logger::log_info(&format!(
                    "[Scheduler] 🎯 Found {} warmup targets across accounts. Triggering warmup...",
                    tasks_to_run.len()
                ));

                let handle_for_warmup = app_handle.clone();
                let state_for_warmup = proxy_state.clone();

                tokio::spawn(async move {
                    for (acc_id, email, model, token, pid, history_keys, warmup_type) in
                        tasks_to_run
                    {
                        logger::log_info(&format!(
                            "[Warmup] 🚀 Triggering {} warmup for {} @ {}",
                            warmup_type, model, email
                        ));

                        let success = quota::warmup_model_directly(
                            &token,
                            &model,
                            &pid,
                            &email,
                            100,
                            Some(&acc_id),
                        )
                        .await;

                        if success {
                            let now = Utc::now().timestamp();
                            for key in &history_keys {
                                record_warmup_history(key, now);
                            }
                            logger::log_info(&format!(
                                "[Warmup] ✅ Successfully started {} timer for {} @ {}",
                                warmup_type, model, email
                            ));
                        }
                        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                    }

                    // Refresh UI
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                    let _ = crate::commands::refresh_all_quotas_internal(
                        &state_for_warmup,
                        handle_for_warmup,
                    )
                    .await;
                });
            }

            // Regularly clean up history (keep last 30 days)
            {
                let now_ts = Utc::now().timestamp();
                let mut history = WARMUP_HISTORY.lock().unwrap();
                let cutoff = now_ts - 30 * 86400;
                history.retain(|_, &mut ts| ts > cutoff);
            }
        }
    });
}

/// Trigger immediate smart warmup check for a single account (e.g. on manual trigger / recovered event)
pub async fn trigger_warmup_for_account(account: &Account) {
    let Ok((token, pid)) = quota::get_valid_token_for_warmup(account).await else {
        return;
    };

    let Ok((fresh_quota, _)) =
        quota::fetch_quota_with_cache(&token, &account.email, Some(&pid), Some(&account.id)).await
    else {
        return;
    };

    if fresh_quota.is_forbidden {
        return;
    }

    let Ok(app_config) = config::load_app_config() else {
        return;
    };

    if !app_config.scheduled_warmup.enabled {
        return;
    }

    let now_ts = Utc::now().timestamp();
    let mut tasks_to_run: Vec<(
        String,
        String,
        String,
        String,
        String,
        Vec<String>,
        &'static str,
    )> = Vec::new();
    let mut queued_targets = std::collections::HashSet::new();

    if let Some(groups) = &fresh_quota.quota_groups {
        for group in groups {
            for bucket in &group.buckets {
                let win_lower = bucket.window.to_lowercase();
                let bid_lower = bucket.bucket_id.to_lowercase();
                let is_weekly = win_lower.contains("week")
                    || bid_lower.contains("week")
                    || win_lower.contains("7d")
                    || bid_lower.contains("7d");
                let is_5h = win_lower.contains("5h")
                    || bid_lower.contains("5h")
                    || win_lower.contains("hour")
                    || bid_lower.contains("hour");

                if !is_weekly && !(is_5h && app_config.scheduled_warmup.enable_5h_warmup) {
                    continue;
                }

                if bucket.remaining_fraction >= 0.999 {
                    let reset_ts_opt = parse_reset_time_ts(&bucket.reset_time);

                    if is_weekly {
                        let should_warmup = match reset_ts_opt {
                            Some(reset_ts) => now_ts >= reset_ts - 60,
                            None => true,
                        };

                        if should_warmup {
                            let history_key = match reset_ts_opt {
                                Some(reset_ts) => {
                                    format!(
                                        "{}:{}:weekly:{}",
                                        account.email, bucket.bucket_id, reset_ts
                                    )
                                }
                                None => {
                                    format!("{}:{}:weekly:initial", account.email, bucket.bucket_id)
                                }
                            };

                            if !check_cooldown(&history_key, 6 * 86400) {
                                if let Some(model_to_ping) = pick_model_for_group(
                                    &group.display_name,
                                    &bucket.bucket_id,
                                    &app_config.scheduled_warmup.monitored_models,
                                ) {
                                    let target_key = (account.id.clone(), model_to_ping.clone());
                                    if !queued_targets.contains(&target_key) {
                                        queued_targets.insert(target_key);
                                        tasks_to_run.push((
                                            account.id.clone(),
                                            account.email.clone(),
                                            model_to_ping,
                                            token.clone(),
                                            pid.clone(),
                                            vec![
                                                history_key,
                                                format!(
                                                    "{}:{}:5h",
                                                    account.email, bucket.bucket_id
                                                ),
                                            ],
                                            "weekly",
                                        ));
                                    }
                                }
                            }
                        }
                    }

                    if is_5h && app_config.scheduled_warmup.enable_5h_warmup {
                        let should_warmup_5h = match reset_ts_opt {
                            Some(reset_ts) => now_ts >= reset_ts - 60,
                            None => true,
                        };

                        if should_warmup_5h {
                            let generic_5h_key =
                                format!("{}:{}:5h", account.email, bucket.bucket_id);
                            let cycle_key = match reset_ts_opt {
                                Some(reset_ts) => {
                                    format!(
                                        "{}:{}:5h:{}",
                                        account.email, bucket.bucket_id, reset_ts
                                    )
                                }
                                None => format!("{}:{}:5h:idle", account.email, bucket.bucket_id),
                            };

                            if let Some(model_to_ping) = pick_model_for_group(
                                &group.display_name,
                                &bucket.bucket_id,
                                &app_config.scheduled_warmup.monitored_models,
                            ) {
                                let manual_key = format!("{}:{}:100", account.email, model_to_ping);

                                if !check_cooldown(&generic_5h_key, 17400)
                                    && !check_cooldown(&cycle_key, 17400)
                                    && !check_cooldown(&manual_key, 14400)
                                {
                                    let target_key = (account.id.clone(), model_to_ping.clone());
                                    if !queued_targets.contains(&target_key) {
                                        queued_targets.insert(target_key);
                                        tasks_to_run.push((
                                            account.id.clone(),
                                            account.email.clone(),
                                            model_to_ping,
                                            token.clone(),
                                            pid.clone(),
                                            vec![generic_5h_key, cycle_key, manual_key],
                                            "5-hour rolling",
                                        ));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } else {
        // Fallback to models
        for model in &fresh_quota.models {
            if model.percentage >= 100 {
                let is_monitored = if app_config.scheduled_warmup.monitored_models.is_empty() {
                    true
                } else {
                    app_config
                        .scheduled_warmup
                        .monitored_models
                        .iter()
                        .any(|m| model.name.to_lowercase().contains(&m.to_lowercase()))
                };
                if !is_monitored {
                    continue;
                }

                let reset_ts_opt = parse_reset_time_ts(&model.reset_time);

                if let Some(reset_ts) = reset_ts_opt {
                    if now_ts >= reset_ts - 60 {
                        let history_key =
                            format!("{}:{}:weekly:{}", account.email, model.name, reset_ts);
                        if !check_cooldown(&history_key, 6 * 86400) {
                            let target_key = (account.id.clone(), model.name.clone());
                            if !queued_targets.contains(&target_key) {
                                queued_targets.insert(target_key);
                                tasks_to_run.push((
                                    account.id.clone(),
                                    account.email.clone(),
                                    model.name.clone(),
                                    token.clone(),
                                    pid.clone(),
                                    vec![
                                        history_key,
                                        format!("{}:{}:5h", account.email, model.name),
                                    ],
                                    "weekly",
                                ));
                            }
                        }
                    }
                }

                if app_config.scheduled_warmup.enable_5h_warmup {
                    let should_warmup_5h = match reset_ts_opt {
                        Some(reset_ts) => now_ts >= reset_ts - 60,
                        None => true,
                    };

                    if should_warmup_5h {
                        let generic_5h_key = format!("{}:{}:5h", account.email, model.name);
                        let cycle_key = match reset_ts_opt {
                            Some(reset_ts) => {
                                format!("{}:{}:5h:{}", account.email, model.name, reset_ts)
                            }
                            None => format!("{}:{}:5h:idle", account.email, model.name),
                        };
                        let manual_key = format!("{}:{}:100", account.email, model.name);

                        if !check_cooldown(&generic_5h_key, 17400)
                            && !check_cooldown(&cycle_key, 17400)
                            && !check_cooldown(&manual_key, 14400)
                        {
                            let target_key = (account.id.clone(), model.name.clone());
                            if !queued_targets.contains(&target_key) {
                                queued_targets.insert(target_key);
                                tasks_to_run.push((
                                    account.id.clone(),
                                    account.email.clone(),
                                    model.name.clone(),
                                    token.clone(),
                                    pid.clone(),
                                    vec![generic_5h_key, cycle_key, manual_key],
                                    "5-hour rolling",
                                ));
                            }
                        }
                    }
                }
            }
        }
    }

    if !tasks_to_run.is_empty() {
        tokio::spawn(async move {
            for (acc_id, email, model, token, pid, history_keys, warmup_type) in tasks_to_run {
                logger::log_info(&format!(
                    "[Warmup] 🚀 Triggering {} warmup for {} @ {}",
                    warmup_type, model, email
                ));

                let success =
                    quota::warmup_model_directly(&token, &model, &pid, &email, 100, Some(&acc_id))
                        .await;

                if success {
                    let now = Utc::now().timestamp();
                    for key in &history_keys {
                        record_warmup_history(key, now);
                    }
                    logger::log_info(&format!(
                        "[Warmup] ✅ Successfully started {} timer for {} @ {}",
                        warmup_type, model, email
                    ));
                }
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            }
        });
    }
}
