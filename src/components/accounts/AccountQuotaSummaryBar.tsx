import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Zap,
    Calendar,
    CalendarDays,
    Sparkles,
    Info,
    ChevronDown,
    X,
    Layers,
    Cpu,
    Bot,
} from 'lucide-react';
import { Account } from '../../types/account';
import { QuotaWindow } from '../../pages/Accounts';
import { cn } from '../../utils/cn';

interface AccountQuotaSummaryBarProps {
    accounts: Account[];
    totalAccountsCount?: number;
    quotaWindow: QuotaWindow;
    onSelectWindow?: (window: QuotaWindow) => void;
}

interface FleetQuotaStats {
    totalAccounts: number;
    activeAccounts: number;
    readyAccounts: number;
    exhaustedAccounts: number;
    disabledAccounts: number;
    sum5h: number;
    sumWeekly: number;
    sumMonthly: number;
    equiv5h: string;
    equivWeekly: string;
    equivMonthly: string;
    gemini5hSum: number;
    claude5hSum: number;
    geminiWeeklySum: number;
    claudeWeeklySum: number;
}

export default function AccountQuotaSummaryBar({
    accounts,
    totalAccountsCount,
    quotaWindow,
    onSelectWindow,
}: AccountQuotaSummaryBarProps) {
    const { t } = useTranslation();
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const detailsRef = useRef<HTMLDivElement>(null);

    // Close details popover on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) {
                setIsDetailsOpen(false);
            }
        }
        if (isDetailsOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDetailsOpen]);

    // Close on Escape key
    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape' && isDetailsOpen) {
                setIsDetailsOpen(false);
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isDetailsOpen]);

    // Compute fleet-wide quota statistics
    const stats: FleetQuotaStats = useMemo(() => {
        let activeAccounts = 0;
        let readyAccounts = 0;
        let exhaustedAccounts = 0;
        let disabledAccounts = 0;

        let sum5h = 0;
        let sumWeekly = 0;

        let gemini5hSum = 0;
        let claude5hSum = 0;
        let geminiWeeklySum = 0;
        let claudeWeeklySum = 0;

        for (const account of accounts) {
            const isDisabled = account.disabled || account.quota?.is_forbidden || account.validation_blocked;
            if (isDisabled) {
                disabledAccounts++;
                continue;
            }
            activeAccounts++;

            // Extract per-pool statistics (Gemini vs Claude)
            let gWeekly: number | null = null;
            let cWeekly: number | null = null;
            let g5h: number | null = null;
            let c5h: number | null = null;

            for (const group of account.quota?.quota_groups || []) {
                const name = (group.display_name || '').toLowerCase();
                const isClaude = name.includes('claude') || name.includes('gpt');
                for (const bucket of group.buckets || []) {
                    const isW = /week|7d/i.test(`${bucket.window || ''} ${bucket.bucket_id || ''}`);
                    const is5 = /5h|hour/i.test(`${bucket.window || ''} ${bucket.bucket_id || ''}`);
                    const frac = typeof bucket.remaining_fraction === 'number'
                        ? Math.round(bucket.remaining_fraction * 100)
                        : null;

                    if (frac !== null) {
                        if (isClaude) {
                            if (isW && (cWeekly === null || frac < cWeekly)) cWeekly = frac;
                            if (is5 && (c5h === null || frac < c5h)) c5h = frac;
                        } else {
                            if (isW && (gWeekly === null || frac < gWeekly)) gWeekly = frac;
                            if (is5 && (g5h === null || frac < g5h)) g5h = frac;
                        }
                    }
                }
            }

            // Model fallbacks if quota_groups is not populated
            const models = account.quota?.models || [];
            const claudeModel = models.find(m => m.name.toLowerCase().includes('claude'));
            const proModel = models.find(m => m.name.toLowerCase().includes('pro'));
            const flashModel = models.find(m => m.name.toLowerCase().includes('flash'));

            if (cWeekly === null && claudeModel?.percentage !== undefined) {
                cWeekly = claudeModel.percentage;
            }
            if (c5h === null && claudeModel?.percentage !== undefined) {
                c5h = claudeModel.percentage;
            }

            const geminiPcts = [proModel?.percentage, flashModel?.percentage].filter((p): p is number => typeof p === 'number');
            if (g5h === null) {
                g5h = geminiPcts.length > 0 ? Math.min(...geminiPcts) : (models[0]?.percentage ?? 100);
            }
            if (gWeekly === null) {
                gWeekly = g5h;
            }

            // Gemini Quotas (Pure Gemini capacity)
            const accountGeminiWeekly = Math.max(0, Math.min(100, gWeekly ?? 100));
            let accountGemini5h = Math.max(0, Math.min(100, g5h ?? 100));
            if (accountGeminiWeekly <= 0) {
                accountGemini5h = 0;
            }

            // Claude Quotas (for pool breakdown popup)
            const accountClaudeWeekly = Math.max(0, Math.min(100, cWeekly ?? 100));
            let accountClaude5h = Math.max(0, Math.min(100, c5h ?? 100));
            if (accountClaudeWeekly <= 0) {
                accountClaude5h = 0;
            }

            // Summary pills strictly represent Gemini capacity ("Shows only Gemini")
            sumWeekly += accountGeminiWeekly;
            sum5h += accountGemini5h;

            if (accountGeminiWeekly > 0 && accountGemini5h > 0) {
                readyAccounts++;
            } else {
                exhaustedAccounts++;
            }

            geminiWeeklySum += accountGeminiWeekly;
            gemini5hSum += accountGemini5h;
            claudeWeeklySum += accountClaudeWeekly;
            claude5hSum += accountClaude5h;
        }

        // Monthly capacity is 4 full weekly renewal cycles
        const sumMonthly = Math.round(sumWeekly * 4);

        return {
            totalAccounts: accounts.length,
            activeAccounts,
            readyAccounts,
            exhaustedAccounts,
            disabledAccounts,
            sum5h,
            sumWeekly,
            sumMonthly,
            equiv5h: (sum5h / 100).toFixed(1),
            equivWeekly: (sumWeekly / 100).toFixed(1),
            equivMonthly: (sumMonthly / 100).toFixed(1),
            gemini5hSum,
            claude5hSum,
            geminiWeeklySum,
            claudeWeeklySum,
        };
    }, [accounts]);

    const isFiltered = totalAccountsCount !== undefined && totalAccountsCount > accounts.length;

    return (
        <div className="relative flex-none">
            <div className="flex flex-wrap items-stretch border-y border-base-content/10 divide-x divide-base-content/10 bg-base-100">
                {/* Gemini fleet label */}
                <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-base-content/60 shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">
                        {t('accounts.summary.fleet_capacity', 'Gemini Quota')}
                    </span>
                </div>

                {/* 1. Weekly quota readout */}
                <button
                    type="button"
                    onClick={() => onSelectWindow?.('weekly')}
                    className={cn(
                        "flex items-baseline gap-2 px-3 py-2 text-left transition-colors shrink-0",
                        quotaWindow === 'weekly' ? "bg-base-content/10 text-base-content" : "hover:bg-base-content/5"
                    )}
                    title={t('accounts.summary.tooltip_weekly', {
                        count: stats.activeAccounts,
                        equiv: stats.equivWeekly,
                    })}
                >
                    <Calendar className="w-3.5 h-3.5 self-center" />
                    <span className="text-xs font-medium opacity-70">
                        {t('accounts.summary.quota_weekly')}
                    </span>
                    <span className="text-xl leading-none font-semibold tabular-nums">
                        {stats.sumWeekly}%
                    </span>
                    <span className="text-[10px] font-mono opacity-70">
                        {t('accounts.summary.acc_equivalent', { equiv: stats.equivWeekly })}
                    </span>
                </button>

                {/* 2. Monthly quota readout (derived, read-only) */}
                <div
                    className="flex items-baseline gap-2 px-3 py-2 shrink-0"
                    title={t('accounts.summary.tooltip_monthly', {
                        count: stats.activeAccounts,
                        equiv: stats.equivMonthly,
                    })}
                >
                    <CalendarDays className="w-3.5 h-3.5 self-center" />
                    <span className="text-xs font-medium text-base-content/60">
                        {t('accounts.summary.quota_monthly')}
                    </span>
                    <span className="text-xl leading-none font-semibold tabular-nums">
                        ~{stats.sumMonthly}%
                    </span>
                    <span className="text-[10px] font-mono text-base-content/60">
                        {t('accounts.summary.acc_equivalent_monthly', { equiv: stats.equivMonthly })}
                    </span>
                </div>

                {/* 3. 5H current quota readout */}
                <button
                    type="button"
                    onClick={() => onSelectWindow?.('5h')}
                    className={cn(
                        "flex items-baseline gap-2 px-3 py-2 text-left transition-colors shrink-0",
                        quotaWindow === '5h' ? "bg-base-content/10 text-base-content" : "hover:bg-base-content/5"
                    )}
                    title={t('accounts.summary.tooltip_5h', {
                        count: stats.activeAccounts,
                        equiv: stats.equiv5h,
                    })}
                >
                    <Zap className="w-3.5 h-3.5 self-center" />
                    <span className="text-xs font-medium opacity-70">
                        {t('accounts.summary.quota_5h')}
                    </span>
                    <span className="text-xl leading-none font-semibold tabular-nums">
                        {stats.sum5h}%
                    </span>
                    <span className="text-[10px] font-mono opacity-70">
                        {t('accounts.summary.acc_equivalent', { equiv: stats.equiv5h })}
                    </span>
                </button>

                {/* Readiness */}
                <div
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium shrink-0"
                    title={
                        stats.exhaustedAccounts > 0
                            ? `${stats.readyAccounts} ready accounts, ${stats.exhaustedAccounts} recovering/exhausted`
                            : `${stats.readyAccounts} all active accounts ready`
                    }
                >
                    <span className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        stats.readyAccounts > 0 ? "bg-emerald-500" : "bg-amber-500"
                    )} />
                    <span className="font-mono tabular-nums">
                        {stats.readyAccounts} / {stats.activeAccounts}
                    </span>
                    <span className="text-base-content/60">
                        {t('accounts.summary.ready')}
                    </span>
                    {stats.exhaustedAccounts > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                            ({stats.exhaustedAccounts} {t('accounts.summary.waiting')})
                        </span>
                    )}
                </div>

                {/* Filtered notice */}
                {isFiltered && (
                    <div className="hidden xl:flex items-center px-3 py-2 text-[11px] font-mono text-base-content/60">
                        {t('accounts.summary.filtered_notice', {
                            visible: accounts.length,
                            total: totalAccountsCount,
                        })}
                    </div>
                )}

                <div className="flex-1 border-l-0" />

                {/* Breakdown details toggle */}
                <button
                    type="button"
                    onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                    className={cn(
                        "px-3 py-2 flex items-center gap-1 text-xs transition-colors hover:bg-base-content/5 shrink-0",
                        isDetailsOpen && "bg-base-content/10 text-base-content"
                    )}
                    title={t('accounts.summary.toggle_details')}
                >
                    <Info className="w-3.5 h-3.5" />
                    <ChevronDown className={cn(
                        "w-3 h-3 transition-transform duration-200",
                        isDetailsOpen && "transform rotate-180"
                    )} />
                </button>
            </div>

            {/* Dropdown popover: detailed fleet and pool breakdown */}
            {isDetailsOpen && (
                <div
                    ref={detailsRef}
                    className="absolute right-0 top-full mt-1 z-40 w-80 sm:w-96 bg-base-100 rounded-lg border border-base-content/10 shadow-lg shadow-black/10 text-xs"
                >
                    <div className="flex items-center justify-between px-3 py-2 border-b border-base-content/10">
                        <div className="flex items-center gap-1.5 font-medium text-sm">
                            <Layers className="w-4 h-4" />
                            <span>{t('accounts.summary.breakdown_title')}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsDetailsOpen(false)}
                            className="p-1 rounded text-base-content/60 hover:bg-base-content/10 hover:text-base-content"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Pool summary */}
                    <div className="grid grid-cols-2 divide-x divide-base-content/10 border-b border-base-content/10">
                        <div className="p-3">
                            <div className="flex items-center gap-1 text-xs font-medium mb-1.5">
                                <Cpu className="w-3.5 h-3.5" />
                                <span>Gemini Models</span>
                            </div>
                            <div className="space-y-1 font-mono tabular-nums">
                                <div className="flex justify-between">
                                    <span className="text-base-content/60">Weekly:</span>
                                    <span className="font-semibold">{stats.geminiWeeklySum}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-base-content/60">5H Rolling:</span>
                                    <span className="font-semibold">{stats.gemini5hSum}%</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-3">
                            <div className="flex items-center gap-1 text-xs font-medium mb-1.5">
                                <Bot className="w-3.5 h-3.5" />
                                <span>Claude & 3P</span>
                            </div>
                            <div className="space-y-1 font-mono tabular-nums">
                                <div className="flex justify-between">
                                    <span className="text-base-content/60">Weekly:</span>
                                    <span className="font-semibold">{stats.claudeWeeklySum}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-base-content/60">5H Rolling:</span>
                                    <span className="font-semibold">{stats.claude5hSum}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Account pool status */}
                    <div className="px-3 divide-y divide-base-content/10 border-b border-base-content/10">
                        <div className="flex justify-between py-1.5">
                            <span className="text-base-content/60">Active Accounts:</span>
                            <span className="font-mono font-semibold">{stats.activeAccounts} of {stats.totalAccounts}</span>
                        </div>
                        <div className="flex justify-between py-1.5">
                            <span className="text-base-content/60">Ready to Request:</span>
                            <span className="font-mono font-semibold text-emerald-600 dark:text-lime-signal">{stats.readyAccounts}</span>
                        </div>
                        {stats.exhaustedAccounts > 0 && (
                            <div className="flex justify-between py-1.5">
                                <span className="text-base-content/60">Waiting for Reset:</span>
                                <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{stats.exhaustedAccounts}</span>
                            </div>
                        )}
                        {stats.disabledAccounts > 0 && (
                            <div className="flex justify-between py-1.5">
                                <span className="text-base-content/60">Disabled / Blocked:</span>
                                <span className="font-mono font-semibold text-red-600 dark:text-red-400">{stats.disabledAccounts}</span>
                            </div>
                        )}
                    </div>

                    {/* Explanation note */}
                    <div className="m-3 pl-3 border-l-2 border-base-content/20 text-[11px] text-base-content/70 leading-relaxed">
                        <p className="font-medium">Calculation notes</p>
                        <ul className="list-disc list-inside mt-1 space-y-0.5 text-[10.5px]">
                            <li><strong>Gemini Focus:</strong> Summary readouts track pure Gemini capacity, unconstrained by 3P/Claude limits.</li>
                            <li><strong>Current Quotas:</strong> Sum of actual remaining percentages across active accounts.</li>
                            <li><strong>Account Equivalent:</strong> 100% available quota = 1.0 Account Equivalent.</li>
                            <li><strong>Monthly Capacity:</strong> Estimated as 4 weekly rolling cycles per month.</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
