import { Account } from '../types/account';
import { parseFlexibleDate } from './format';

export type AccountSortOption =
    | 'default'
    | 'reset_5h_weekly_priority' // 🌟 Shortest 5H Reset (Weekly-Prioritized)
    | 'reset_5h_asc'             // ⏱️ Shortest to 5H reset (strict time)
    | 'reset_5h_desc'            // ⏱️ Longest to 5H reset
    | 'reset_weekly_asc'         // 📅 Shortest to Weekly reset
    | 'reset_weekly_desc'        // 📅 Longest to Weekly reset
    | 'quota_desc'               // 🔋 Highest Quota %
    | 'quota_asc'                // 🪫 Lowest Quota %
    | 'last_used_desc'           // 🕒 Most recently used
    | 'last_used_asc'            // 🕒 Longest idle
    | 'priority_desc'            // ⭐ Highest priority
    | 'email_asc'                // 🔤 Email / Label A-Z
    | 'email_desc';              // 🔤 Email / Label Z-A

/**
 * Extracts the earliest future 5H reset time in milliseconds remaining.
 * Returns null if no active future 5H reset countdown exists (e.g. idle or already reset).
 */
export function getAccount5hRemainingMs(account: Account): number | null {
    if (!account.quota) return null;
    const now = Date.now();
    let minDiff: number | null = null;

    // 1. Check 5h buckets in quota_groups
    const groups = account.quota.quota_groups || [];
    for (const group of groups) {
        for (const bucket of group.buckets || []) {
            const is5h = /5h|hour/i.test(`${bucket.window || ''} ${bucket.bucket_id || ''}`);
            if (is5h && bucket.reset_time) {
                const target = parseFlexibleDate(bucket.reset_time);
                if (target) {
                    const diff = target.getTime() - now;
                    // A 5H rolling window reset shouldn't exceed 24 hours in the future
                    if (diff > 0 && diff <= 24 * 3600 * 1000) {
                        if (minDiff === null || diff < minDiff) {
                            minDiff = diff;
                        }
                    }
                }
            }
        }
    }

    // 2. Check models (Gemini / Claude models)
    const models = account.quota.models || [];
    for (const model of models) {
        if (model.reset_time) {
            const target = parseFlexibleDate(model.reset_time);
            if (target) {
                const diff = target.getTime() - now;
                // Only consider 5h resets (diff <= 24h)
                if (diff > 0 && diff <= 24 * 3600 * 1000) {
                    if (minDiff === null || diff < minDiff) {
                        minDiff = diff;
                    }
                }
            }
        }
    }

    return minDiff;
}

/**
 * Extracts Gemini-specific quota percentage (0 - 100) for an account.
 * Decoupled from Claude / 3P models so Claude exhaustion does not zero out Gemini.
 */
export function getAccountGeminiQuota(account: Account, quotaWindow: '5h' | 'weekly' = '5h'): number {
    if (account.disabled || account.quota?.is_forbidden || account.validation_blocked) return -1;
    if (!account.quota) return 0;

    let gWeekly: number | null = null;
    let g5h: number | null = null;

    const groups = account.quota.quota_groups || [];
    for (const group of groups) {
        const name = (group.display_name || '').toLowerCase();
        const isGemini = name.includes('gemini') || (!name.includes('claude') && !name.includes('gpt'));
        if (isGemini) {
            for (const bucket of group.buckets || []) {
                const isW = /week|7d/i.test(`${bucket.window || ''} ${bucket.bucket_id || ''}`);
                const is5 = /5h|hour/i.test(`${bucket.window || ''} ${bucket.bucket_id || ''}`);
                const frac = typeof bucket.remaining_fraction === 'number'
                    ? Math.round(bucket.remaining_fraction * 100)
                    : null;

                if (frac !== null) {
                    if (isW && (gWeekly === null || frac < gWeekly)) gWeekly = frac;
                    if (is5 && (g5h === null || frac < g5h)) g5h = frac;
                }
            }
        }
    }

    const models = account.quota.models || [];
    const pro = models.find(m => m.name.toLowerCase().includes('pro'))?.percentage;
    const flash = models.find(m => m.name.toLowerCase().includes('flash'))?.percentage;
    const geminiPcts = [pro, flash].filter((p): p is number => typeof p === 'number');

    if (g5h === null) {
        g5h = geminiPcts.length > 0 ? Math.min(...geminiPcts) : (models[0]?.percentage ?? 100);
    }
    if (gWeekly === null) {
        gWeekly = g5h;
    }

    const weekly = Math.max(0, Math.min(100, gWeekly ?? 100));
    if (quotaWindow === 'weekly') {
        return weekly;
    }

    let fiveH = Math.max(0, Math.min(100, g5h ?? 100));
    if (weekly <= 0) {
        fiveH = 0;
    }
    return fiveH;
}

/**
 * Extracts the remaining weekly quota percentage (0 - 100) for the account.
 * Prioritizes Gemini weekly budget so 3P Claude limits do not mask Gemini capacity.
 */
export function getAccountWeeklyQuota(account: Account): number {
    return getAccountGeminiQuota(account, 'weekly');
}

/**
 * Extracts the earliest future Weekly reset time in milliseconds remaining.
 * Returns null if no weekly reset countdown is pending.
 */
export function getAccountWeeklyRemainingMs(account: Account): number | null {
    if (!account.quota) return null;
    const now = Date.now();
    let minDiff: number | null = null;

    // 1. Quota groups weekly buckets
    const groups = account.quota.quota_groups || [];
    for (const group of groups) {
        for (const bucket of group.buckets || []) {
            const isWeekly = /week|7d/i.test(`${bucket.window || ''} ${bucket.bucket_id || ''}`);
            if (isWeekly && bucket.reset_time) {
                const target = parseFlexibleDate(bucket.reset_time);
                if (target) {
                    const diff = target.getTime() - now;
                    if (diff > 0) {
                        if (minDiff === null || diff < minDiff) {
                            minDiff = diff;
                        }
                    }
                }
            }
        }
    }

    // 2. Models with long (>24h) reset times (e.g. Claude weekly)
    const models = account.quota.models || [];
    for (const model of models) {
        if (model.reset_time) {
            const target = parseFlexibleDate(model.reset_time);
            if (target) {
                const diff = target.getTime() - now;
                if (diff > 24 * 3600 * 1000) {
                    if (minDiff === null || diff < minDiff) {
                        minDiff = diff;
                    }
                }
            }
        }
    }

    return minDiff;
}

/**
 * Calculates effective quota percentage (0-100) taking into account 5H and Weekly windows.
 * Disabled or forbidden accounts return -1.
 */
export function getAccountEffectiveQuota(account: Account, quotaWindow: '5h' | 'weekly' = '5h'): number {
    return getAccountGeminiQuota(account, quotaWindow);
}

/**
 * Detects whether an account has an Opus 5.5 inclusive label.
 * Matches patterns like "Opus5.5", "Opus 5.5", "opus-5.5", "opus 5_5", "opus55",
 * "Claude Opus 5.5", "Claude 5.5 Opus", etc., case-insensitively.
 */
export function hasOpus55Label(account: Account): boolean {
    if (!account) return false;
    const label = account.custom_label?.trim() || account.name?.trim() || '';
    if (label) {
        return /(?:opus[^\d\n]*5[._-]?5|5[._-]?5[^\d\n]*opus)/i.test(label);
    }
    return /(?:opus[^\d\n]*5[._-]?5|5[._-]?5[^\d\n]*opus)/i.test(account.email || '');
}

/**
 * 🌟 Shortest 5H Reset with Weekly Quota Priority:
 * Prioritizes accounts that have available Weekly quota to spend (> 0%).
 * Ranks accounts with higher weekly balance higher if 5H reset times are comparable.
 * Places accounts with exhausted weekly quota (0%) at the bottom.
 */
export function compare5hResetWithWeeklyPriority(a: Account, b: Account): number {
    const aDisabled = a.disabled || a.quota?.is_forbidden;
    const bDisabled = b.disabled || b.quota?.is_forbidden;
    if (aDisabled !== bDisabled) return aDisabled ? 1 : -1;

    // Accounts with Opus 5.5 inclusive labels sort to the bottom regardless of quotas
    const aOpus = hasOpus55Label(a);
    const bOpus = hasOpus55Label(b);
    if (aOpus !== bOpus) return aOpus ? 1 : -1;

    const aWeekly = getAccountWeeklyQuota(a);
    const bWeekly = getAccountWeeklyQuota(b);
    const aHasWeekly = aWeekly > 0;
    const bHasWeekly = bWeekly > 0;

    // Tier 1: Accounts with Weekly Quota to spend come before Weekly 0%
    if (aHasWeekly !== bHasWeekly) {
        return aHasWeekly ? -1 : 1;
    }

    // Tier 2: Both have weekly quota to spend (> 0%)
    if (aHasWeekly && bHasWeekly) {
        const a5h = getAccount5hRemainingMs(a);
        const b5h = getAccount5hRemainingMs(b);

        const aHas5h = a5h !== null;
        const bHas5h = b5h !== null;

        // Active cooldown accounts come first (Option A)
        if (aHas5h && bHas5h) {
            // If 5h reset times are within 45 minutes of each other and weekly difference is >= 15%,
            // give higher priority to the account with significantly more weekly quota to spend!
            const diffMinutes = Math.abs((a5h - b5h) / (60 * 1000));
            if (diffMinutes <= 45 && Math.abs(aWeekly - bWeekly) >= 15) {
                return bWeekly - aWeekly;
            }

            // Otherwise sort by shorter 5H recovery time
            if (a5h !== b5h) return a5h - b5h;

            // Tie-break: higher weekly quota
            return bWeekly - aWeekly;
        }

        if (aHas5h !== bHas5h) {
            return aHas5h ? -1 : 1;
        }

        // Neither has active 5h cooldown (both are ready/idle): sort by highest weekly quota
        if (aWeekly !== bWeekly) return bWeekly - aWeekly;

        // Fallback: effective quota
        return getAccountEffectiveQuota(b, '5h') - getAccountEffectiveQuota(a, '5h');
    }

    // Tier 3: Both have Weekly 0% (exhausted):
    // Rank by who recovers weekly quota earliest!
    const aWeeklyReset = getAccountWeeklyRemainingMs(a) ?? Number.MAX_SAFE_INTEGER;
    const bWeeklyReset = getAccountWeeklyRemainingMs(b) ?? Number.MAX_SAFE_INTEGER;
    if (aWeeklyReset !== bWeeklyReset) {
        return aWeeklyReset - bWeeklyReset;
    }

    // Fallback: last used
    return (b.last_used || 0) - (a.last_used || 0);
}

/**
 * Main pure sorting function for accounts.
 */
export function sortAccounts(
    accounts: Account[],
    sortOption: AccountSortOption,
    quotaWindow: '5h' | 'weekly' = '5h'
): Account[] {
    if (sortOption === 'default' || !sortOption) {
        // Even in default order, place accounts with Opus 5.5 inclusive labels at the bottom
        const nonOpus: Account[] = [];
        const opus: Account[] = [];
        for (const account of accounts) {
            if (hasOpus55Label(account)) {
                opus.push(account);
            } else {
                nonOpus.push(account);
            }
        }
        return [...nonOpus, ...opus];
    }

    return [...accounts].sort((a, b) => {
        // Disabled accounts always sort to bottom unless sorting by email or priority
        const aDisabled = a.disabled || a.quota?.is_forbidden;
        const bDisabled = b.disabled || b.quota?.is_forbidden;

        // Unless sorting explicitly by alphabetical email/label,
        // accounts with Opus 5.5 inclusive labels always sort to the bottom
        // (just above disabled accounts) regardless of quotas.
        if (sortOption !== 'email_asc' && sortOption !== 'email_desc') {
            if (aDisabled !== bDisabled) return aDisabled ? 1 : -1;
            const aOpus = hasOpus55Label(a);
            const bOpus = hasOpus55Label(b);
            if (aOpus !== bOpus) return aOpus ? 1 : -1;
        }

        switch (sortOption) {
            case 'reset_5h_weekly_priority':
                return compare5hResetWithWeeklyPriority(a, b);

            case 'reset_5h_asc': {
                if (aDisabled !== bDisabled) return aDisabled ? 1 : -1;
                const aTime = getAccount5hRemainingMs(a);
                const bTime = getAccount5hRemainingMs(b);

                // Option A: Active cooldowns first
                if (aTime !== null && bTime !== null) return aTime - bTime;
                if (aTime !== null) return -1;
                if (bTime !== null) return 1;

                // Fallback: higher quota first
                return getAccountEffectiveQuota(b, '5h') - getAccountEffectiveQuota(a, '5h');
            }

            case 'reset_5h_desc': {
                if (aDisabled !== bDisabled) return aDisabled ? 1 : -1;
                const aTime = getAccount5hRemainingMs(a);
                const bTime = getAccount5hRemainingMs(b);

                if (aTime !== null && bTime !== null) return bTime - aTime;
                if (aTime !== null) return -1;
                if (bTime !== null) return 1;
                return 0;
            }

            case 'reset_weekly_asc': {
                if (aDisabled !== bDisabled) return aDisabled ? 1 : -1;
                const aWeekly = getAccountWeeklyRemainingMs(a);
                const bWeekly = getAccountWeeklyRemainingMs(b);

                // Accounts with active weekly countdown first
                if (aWeekly !== null && bWeekly !== null) return aWeekly - bWeekly;
                if (aWeekly !== null) return -1;
                if (bWeekly !== null) return 1;

                return getAccountWeeklyQuota(b) - getAccountWeeklyQuota(a);
            }

            case 'reset_weekly_desc': {
                if (aDisabled !== bDisabled) return aDisabled ? 1 : -1;
                const aWeekly = getAccountWeeklyRemainingMs(a);
                const bWeekly = getAccountWeeklyRemainingMs(b);

                if (aWeekly !== null && bWeekly !== null) return bWeekly - aWeekly;
                if (aWeekly !== null) return -1;
                if (bWeekly !== null) return 1;
                return 0;
            }

            case 'quota_desc': {
                const aQuota = getAccountEffectiveQuota(a, quotaWindow);
                const bQuota = getAccountEffectiveQuota(b, quotaWindow);
                if (aQuota !== bQuota) return bQuota - aQuota;
                return (b.priority ?? 50) - (a.priority ?? 50);
            }

            case 'quota_asc': {
                const aQuota = getAccountEffectiveQuota(a, quotaWindow);
                const bQuota = getAccountEffectiveQuota(b, quotaWindow);
                // Keep disabled at the very end
                if (aDisabled !== bDisabled) return aDisabled ? 1 : -1;
                if (aQuota !== bQuota) return aQuota - bQuota;
                return (a.priority ?? 50) - (b.priority ?? 50);
            }

            case 'last_used_desc':
                return (b.last_used || 0) - (a.last_used || 0);

            case 'last_used_asc':
                return (a.last_used || 0) - (b.last_used || 0);

            case 'priority_desc': {
                const pA = a.priority ?? 50;
                const pB = b.priority ?? 50;
                if (pA !== pB) return pB - pA;
                return (b.last_used || 0) - (a.last_used || 0);
            }

            case 'email_asc': {
                const nameA = a.custom_label || a.email;
                const nameB = b.custom_label || b.email;
                return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
            }

            case 'email_desc': {
                const nameA = a.custom_label || a.email;
                const nameB = b.custom_label || b.email;
                return nameB.localeCompare(nameA, undefined, { sensitivity: 'base' });
            }

            default:
                return 0;
        }
    });
}
