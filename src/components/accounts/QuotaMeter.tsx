import { AlertTriangle, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { getQuotaColor, formatTimeRemaining, parseFlexibleDate } from '../../utils/format';
import type { LiveLimitStatus } from '../../types/account';
import { formatCompactDuration, getLiveLimitState } from '../../utils/liveLimit';
import { SegmentBar } from '../common/ledger';

interface QuotaMeterProps {
    label: string;
    title?: string;
    /** Model id clients send to the proxy; shown in the tooltip next to the display name */
    modelId?: string;
    percentage: number;
    resetTime?: string;
    isProtected?: boolean;
    liveLimit?: LiveLimitStatus;
    isWeeklyConstrained?: boolean;
    weeklyResetTime?: string;
    /** `percentage` comes from the group's 5h window (so the weekly window is the other one) */
    hasFiveHourWindow?: boolean;
    /** Tightest weekly window of the model's quota group, drawn as a hairline under the 5h meter */
    weeklyQuota?: { percentage: number; resetTime?: string };
    weeklyTokens?: number | null;
    className?: string;
    Icon?: React.ComponentType<{ size?: number; className?: string }>;
}

/**
 * Ledger quota meter: label | segmented bar | percent | reset countdown, all on one mono line.
 * Same data contract and tooltips as QuotaItem, restyled for the control-room ledger.
 */
export function QuotaMeter({ label, title, modelId, percentage, resetTime, isProtected, liveLimit, isWeeklyConstrained, weeklyResetTime, hasFiveHourWindow, weeklyQuota, weeklyTokens, className, Icon }: QuotaMeterProps) {
    const { t } = useTranslation();
    const liveState = getLiveLimitState(liveLimit);
    const showLiveIssue = liveState.shouldShow || isWeeklyConstrained;
    const isUnavailable = liveState.isActive || isWeeklyConstrained;
    const liveStatus = isWeeklyConstrained ? t('accounts.quota_window_weekly_short', 'Weekly') : liveLimit?.status || 'ERR';

    const describeWindow = (windowLabel: string | null, windowPercentage: number, windowResetTime?: string) => {
        const resetAt = windowResetTime ? parseFlexibleDate(windowResetTime) : null;
        const line = resetAt && resetAt.getTime() > Date.now()
            ? t('accounts.quota_tooltip_window', '{{percentage}}% left, resets in {{remaining}} ({{at}})', {
                percentage: windowPercentage,
                remaining: formatTimeRemaining(windowResetTime!),
                at: resetAt.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            })
            : t('accounts.quota_tooltip_window_no_reset', '{{percentage}}% left', { percentage: windowPercentage });
        return windowLabel ? `${windowLabel}: ${line}` : line;
    };
    // The weekly hairline only adds information when the meter itself shows the 5h window.
    const weeklyBar = hasFiveHourWindow && !isWeeklyConstrained ? weeklyQuota : undefined;
    const fullName = title || label;
    const detailTitle = [
        modelId && modelId.toLowerCase() !== fullName.toLowerCase() ? `${fullName} (${modelId})` : fullName,
        describeWindow(weeklyBar ? '5h' : null, percentage, resetTime),
        weeklyBar ? describeWindow(t('accounts.quota_window_weekly_short', 'Weekly'), weeklyBar.percentage, weeklyBar.resetTime) : null,
        isProtected ? t('accounts.quota_protected') : null,
    ].filter(Boolean).join('\n');
    const liveLimitTitle = isWeeklyConstrained
        ? `${label}: ${t('accounts.weekly_exhausted_tooltip', 'Weekly quota exhausted (0%); waiting for weekly reset')} (${weeklyResetTime ? formatTimeRemaining(weeklyResetTime) || weeklyResetTime : ''})`
        : liveLimit
        ? [
            liveState.isActive
                ? `Live image endpoint is temporarily unavailable for ${formatCompactDuration(liveState.secondsRemaining)}.`
                : `Image endpoint returned ${liveStatus} ${formatCompactDuration(liveState.secondsAgo)} ago.`,
            `Reason: ${liveLimit.reason}.`,
            `Quota snapshot can still show ${percentage}%.`,
            liveLimit.message ? `Message: ${liveLimit.message}` : null,
        ].filter(Boolean).join(' ')
        : label;

    const level = getQuotaColor(percentage);
    const barTone = showLiveIssue ? (isUnavailable ? 'bad' : 'warn') : level === 'success' ? 'lime' : level === 'warning' ? 'warn' : 'bad';
    const weeklyBarColour = (p: number) => {
        const c = getQuotaColor(p);
        return c === 'success' ? 'bg-lime-500' : c === 'warning' ? 'bg-amber-500' : 'bg-red-600';
    };
    const pctColour = showLiveIssue
        ? (isUnavailable ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')
        : level === 'success'
            ? 'text-emerald-700 dark:text-lime-signal'
            : level === 'warning'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400';

    const resetLabel = resetTime ? formatTimeRemaining(resetTime).replace(' ', '') : null;

    return (
        <div className={cn('min-w-0', className)} title={showLiveIssue ? liveLimitTitle : detailTitle}>
            <div className="flex items-center gap-1.5 text-[10px] leading-none">
                <span
                    className={cn(
                        'w-[60px] shrink-0 flex items-center gap-1 font-medium',
                        showLiveIssue ? (isUnavailable ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400') : 'text-base-content/70',
                    )}
                >
                    {showLiveIssue
                        ? <AlertTriangle size={11} className="shrink-0" />
                        : Icon && <Icon size={11} className="shrink-0 opacity-60" />}
                    <span className="truncate min-w-0">{label}</span>
                </span>

                <div className="flex-1 min-w-[28px]">
                    <SegmentBar percent={percentage} tone={barTone} />
                </div>

                <span className={cn('shrink-0 min-w-[32px] flex items-center justify-end gap-0.5 font-mono text-xs font-semibold tabular-nums', pctColour)}>
                    {isProtected && (
                        <span title={t('accounts.quota_protected')}><Lock className="w-2.5 h-2.5 text-amber-500" /></span>
                    )}
                    {showLiveIssue && (
                        <span className="px-1 py-[1px] text-[9px] rounded-sm border border-current">{liveStatus}</span>
                    )}
                    {percentage}%
                </span>

                <span className="w-[40px] shrink-0 text-right font-mono text-base-content/50 whitespace-nowrap">
                    {resetLabel ?? <span className="text-base-content/30">N/A</span>}
                </span>
            </div>
            {weeklyBar && (
                <div className="mt-[3px] h-[2px] rounded-full bg-base-content/10 ml-[66px]">
                    <div className={cn('h-full', weeklyBarColour(weeklyBar.percentage))} style={{ width: `${weeklyBar.percentage}%` }} />
                </div>
            )}
            {weeklyTokens !== undefined && (
                <div
                    className="mt-0.5 pl-[66px] text-[10px] font-mono text-base-content/50 truncate"
                    title={t('accounts.weekly_tokens_tooltip', 'Tokens recorded by this instance in this quota cycle (input + output)')}
                >
                    {t('accounts.weekly_tokens', 'Cycle tokens')}: {weeklyTokens !== null && resetTime && Date.parse(resetTime) > Date.now()
                        ? weeklyTokens.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 }) : 'N/A'}
                </div>
            )}
        </div>
    );
}
