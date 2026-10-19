import { Account, QuotaGroup } from '../types/account';
import { findQuotaModel } from '../config/modelConfig';
import { getAccountDisplayName } from './format';
import { LowQuotaAlertConfig } from '../types/config';
import { useLowQuotaAlertStore } from '../stores/useLowQuotaAlertStore';
import { isTauri } from './env';

/** Extract 5h or Weekly bucket percentage from quota_groups */
export function getBucketPercentage(
    quotaGroups: QuotaGroup[] | undefined,
    category: 'gemini' | 'claude',
    targetWindow: '5h' | 'weekly'
): number | null {
    if (!quotaGroups || quotaGroups.length === 0) return null;

    for (const group of quotaGroups) {
        const name = (group.display_name || '').toLowerCase();
        const isTarget = category === 'claude'
            ? (name.includes('claude') || name.includes('gpt'))
            : (name.includes('gemini') || !name.includes('claude'));

        if (isTarget) {
            const bucket = group.buckets?.find(b => {
                const win = (b.window || '').toLowerCase();
                const id = (b.bucket_id || '').toLowerCase();
                if (targetWindow === 'weekly') {
                    return win.includes('week') || id.includes('week');
                } else {
                    return win.includes('5h') || id.includes('5h') || win.includes('hour') || id.includes('hour');
                }
            });

            if (bucket && typeof bucket.remaining_fraction === 'number') {
                return Math.round(bucket.remaining_fraction * 100);
            }
        }
    }
    return null;
}

/** Calculate effective quota considering dual 5h / weekly buckets */
export function calculateEffectiveQuota(
    fiveHourFromModel: number | null,
    weeklyFromGroup: number | null,
    fiveHourFromGroup: number | null
): number {
    const fiveHour = fiveHourFromGroup !== null ? fiveHourFromGroup : fiveHourFromModel;
    const weekly = weeklyFromGroup;

    if (fiveHour !== null && weekly !== null) {
        return Math.min(fiveHour, weekly);
    }
    if (weekly !== null) {
        return weekly;
    }
    if (fiveHour !== null) {
        return fiveHour;
    }
    return 0;
}

export interface AccountQuotaEvaluation {
    accountId: string;
    account: Account;
    effectivePro: number;
    effectiveFlash: number;
    geminiScore: number;
    effectiveClaude: number;
    claudeScore: number;
    minPercentage: number;
    candidateScore: number;
    bottleneckModel: 'gemini' | 'claude' | 'general';
}

/** Calculate quotas and bottleneck evaluation for an account */
export function evaluateAccountQuota(account: Account): AccountQuotaEvaluation | null {
    if (account.disabled || account.quota?.is_forbidden || !account.quota?.models) {
        return null;
    }

    const pro5hModel = findQuotaModel(account.quota.models, 'gemini-pro')?.percentage ?? null;
    const flash5hModel = findQuotaModel(account.quota.models, 'gemini-flash')?.percentage ?? null;
    const geminiWeekly = getBucketPercentage(account.quota.quota_groups, 'gemini', 'weekly');
    const gemini5h = getBucketPercentage(account.quota.quota_groups, 'gemini', '5h');

    const effectivePro = calculateEffectiveQuota(pro5hModel, geminiWeekly, gemini5h);
    const effectiveFlash = calculateEffectiveQuota(flash5hModel, geminiWeekly, gemini5h);
    let geminiScore = Math.round(effectivePro * 0.7 + effectiveFlash * 0.3);
    if (geminiWeekly !== null && geminiWeekly <= 5) {
        geminiScore = 0;
    }

    const claude5hModel = findQuotaModel(account.quota.models, 'claude')?.percentage ?? null;
    const claudeWeekly = getBucketPercentage(account.quota.quota_groups, 'claude', 'weekly');
    const claude5h = getBucketPercentage(account.quota.quota_groups, 'claude', '5h');

    const effectiveClaude = calculateEffectiveQuota(claude5hModel, claudeWeekly, claude5h);
    let claudeScore = effectiveClaude;
    if (claudeWeekly !== null && claudeWeekly <= 5) {
        claudeScore = 0;
    }

    // Determine bottleneck
    const hasClaude = claude5hModel !== null || claudeWeekly !== null;
    let minPercentage = effectivePro;
    let bottleneckModel: 'gemini' | 'claude' | 'general' = 'gemini';

    if (hasClaude) {
        if (effectiveClaude < effectivePro) {
            minPercentage = effectiveClaude;
            bottleneckModel = 'claude';
        } else {
            minPercentage = effectivePro;
            bottleneckModel = 'gemini';
        }
    }

    const candidateScore = Math.max(geminiScore, claudeScore);

    return {
        accountId: account.id,
        account,
        effectivePro,
        effectiveFlash,
        geminiScore,
        effectiveClaude,
        claudeScore,
        minPercentage,
        candidateScore,
        bottleneckModel,
    };
}

/** Find the highest-quota candidate among eligible accounts to switch to */
export function findBestSwitchCandidate(
    excludeAccountId: string,
    accounts: Account[]
): { account: Account; score: number } | null {
    const candidates = accounts
        .filter(a => a.id !== excludeAccountId && !a.disabled && !a.quota?.is_forbidden)
        .map(a => {
            const evaluation = evaluateAccountQuota(a);
            return {
                account: a,
                score: evaluation?.candidateScore ?? 0,
            };
        })
        .filter(c => c.score > 0)
        .sort((a, b) => b.score - a.score);

    return candidates.length > 0 ? candidates[0] : null;
}

interface AlertHistoryRecord {
    lastRecordedPercentage: number;
    lastNotifiedPercentage?: number;
    lastNotifiedAt?: number;
}

// In-memory debounce/history tracker per account
const alertHistory = new Map<string, AlertHistoryRecord>();

/** Request browser / webview notification permission if not yet granted */
export async function requestNotificationPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return false;
    }
    if (Notification.permission === 'granted') {
        return true;
    }
    if (Notification.permission !== 'denied') {
        const result = await Notification.requestPermission();
        return result === 'granted';
    }
    return false;
}

/** Dispatch native OS desktop notification */
export async function sendOsNotification(title: string, body: string) {
    if (isTauri()) {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('send_system_notification', { title, body });
            return;
        } catch (e) {
            console.warn('[LowQuotaMonitor] Native system notification failed, falling back to Web API:', e);
        }
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
        return;
    }

    const fire = () => {
        try {
            const notif = new Notification(title, {
                body,
                icon: '/logo.png',
            });
            notif.onclick = async () => {
                window.focus();
                if (isTauri()) {
                    try {
                        const { getCurrentWindow } = await import('@tauri-apps/api/window');
                        const win = getCurrentWindow();
                        await win.show();
                        await win.unminimize();
                        await win.setFocus();
                    } catch (e) {
                        console.warn('[LowQuotaMonitor] Failed to focus Tauri window:', e);
                    }
                }
            };
        } catch (e) {
            console.warn('[LowQuotaMonitor] Failed to fire system notification:', e);
        }
    };

    if (Notification.permission === 'granted') {
        fire();
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                fire();
            }
        });
    }
}

/**
 * Main evaluation loop:
 * Inspects all enabled accounts for low quota, prevents notification spam,
 * and alerts the user when an account gradually runs low.
 */
export function checkLowQuotaAccounts(
    accounts: Account[],
    currentAccountId: string | undefined,
    config: LowQuotaAlertConfig | undefined,
    maskEmails: boolean = true
) {
    if (!config || !config.enabled) {
        useLowQuotaAlertStore.getState().clearAlert();
        return;
    }

    const threshold = config.threshold_percentage ?? 20;

    for (const account of accounts) {
        const evaluation = evaluateAccountQuota(account);
        if (!evaluation) continue;

        const { minPercentage, bottleneckModel } = evaluation;
        const history = alertHistory.get(account.id) || { lastRecordedPercentage: minPercentage };

        // 1. If quota has recovered above threshold, reset notification state
        if (minPercentage > threshold) {
            if (history.lastNotifiedPercentage !== undefined) {
                history.lastNotifiedPercentage = undefined;
                alertHistory.set(account.id, history);
            }
            continue;
        }

        // 2. Check if we should notify for this account
        let shouldNotify = false;
        const isCurrent = account.id === currentAccountId;

        if (history.lastNotifiedPercentage === undefined) {
            // First time dropping <= threshold.
            // Notify immediately if this is the current active account, OR if we saw it drop,
            // OR if it's currently usable (> 0%) but low (approaching depletion).
            if (isCurrent || minPercentage > 0 || history.lastRecordedPercentage > threshold) {
                shouldNotify = true;
            }
        } else {
            // Previously notified: only notify again if:
            // a) Quota dropped further by at least 5% (e.g. 19% -> 14%)
            // b) Quota is critically depleted (<= 5%) and previous notification was > 5%
            // c) Cooldown of 30 minutes has elapsed and quota remains <= threshold
            const drop = history.lastNotifiedPercentage - minPercentage;
            const timeSince = Date.now() - (history.lastNotifiedAt || 0);

            if (drop >= 5) {
                shouldNotify = true;
            } else if (minPercentage <= 5 && history.lastNotifiedPercentage > 5) {
                shouldNotify = true;
            } else if (timeSince >= 30 * 60 * 1000) {
                shouldNotify = true;
            }
        }

        // Update history
        history.lastRecordedPercentage = minPercentage;
        alertHistory.set(account.id, history);

        if (shouldNotify) {
            history.lastNotifiedPercentage = minPercentage;
            history.lastNotifiedAt = Date.now();
            alertHistory.set(account.id, history);

            // Find best candidate to switch to
            const best = findBestSwitchCandidate(account.id, accounts);
            const candidate = best && best.score > minPercentage + 5 ? best : null;

            const accountName = getAccountDisplayName(account, maskEmails);
            const candidateName = candidate ? getAccountDisplayName(candidate.account, maskEmails) : null;

            // Update in-app alert store
            useLowQuotaAlertStore.getState().setAlert({
                accountId: account.id,
                accountEmail: account.email,
                accountLabel: account.custom_label,
                quotaPercentage: minPercentage,
                lowModelType: bottleneckModel,
                bestCandidate: candidate ? {
                    id: candidate.account.id,
                    email: candidate.account.email,
                    label: candidate.account.custom_label,
                    quotaPercentage: candidate.score,
                } : null,
                timestamp: Date.now(),
            });

            // Trigger OS Desktop Notification if enabled
            if (config.notify_system) {
                const title = `Antigravity Quota Alert`;
                let body: string;
                if (candidate && candidateName) {
                    body = `${accountName} quota is down to ${minPercentage}%. Recommended: switch to ${candidateName} (${candidate.score}% available).`;
                } else {
                    body = `${accountName} quota is down to ${minPercentage}%. All accounts are running low.`;
                }
                sendOsNotification(title, body);
            }

            // Only trigger for one account per check pass to avoid notification cascades
            break;
        }
    }
}
