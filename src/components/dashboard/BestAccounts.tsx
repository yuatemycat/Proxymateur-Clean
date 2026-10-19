import { ArrowRight } from 'lucide-react';
import { Account, QuotaGroup } from '../../types/account';
import { LedgerRow, SectionRule, SegmentBar } from '../common/ledger';
import { findQuotaModel } from '../../config/modelConfig';
import { getAccountDisplayName, maskEmail } from '../../utils/format';

interface BestAccountsProps {
    accounts: Account[];
    currentAccountId?: string;
    onSwitch?: (accountId: string) => void;
}

import { useTranslation } from 'react-i18next';

/** 从 quota_groups 中提取 5h 或 Weekly 桶百分比 (0-100) */
function getBucketPercentage(
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

/** 
 * 计算模型综合有效配额
 * 自动识别：双桶 (取 min 短板) / 免费账号仅周桶 (取周) / 仅 5h 桶 (取 5h)
 */
function calculateEffectiveQuota(
    fiveHourFromModel: number | null,
    weeklyFromGroup: number | null,
    fiveHourFromGroup: number | null
): number {
    const fiveHour = fiveHourFromGroup !== null ? fiveHourFromGroup : fiveHourFromModel;
    const weekly = weeklyFromGroup;

    // 情况 1: 双桶都存在 (Pro/Ultra 账号) -> 木桶短板 min(5h, weekly)
    if (fiveHour !== null && weekly !== null) {
        return Math.min(fiveHour, weekly);
    }

    // 情况 2: 仅有周额度 (免费账号 / Free Tier) -> 直接以周额度为准
    if (weekly !== null) {
        return weekly;
    }

    // 情况 3: 仅有 5h 额度 (单桶回退) -> 以 5h 额度为准
    if (fiveHour !== null) {
        return fiveHour;
    }

    return 0;
}

function BestAccounts({ accounts, currentAccountId, onSwitch }: BestAccountsProps) {
    const { t } = useTranslation();
    // 1. 获取按综合有效配额排序的列表 (排除当前账号及已禁用账号)
    const geminiSorted = accounts
        .filter(a => a.id !== currentAccountId && !a.disabled && !a.quota?.is_forbidden)
        .map(a => {
            const pro5hModel = findQuotaModel(a.quota?.models, 'gemini-pro')?.percentage ?? null;
            const flash5hModel = findQuotaModel(a.quota?.models, 'gemini-flash')?.percentage ?? null;
            const weeklyGroup = getBucketPercentage(a.quota?.quota_groups, 'gemini', 'weekly');
            const fiveHourGroup = getBucketPercentage(a.quota?.quota_groups, 'gemini', '5h');

            const effectivePro = calculateEffectiveQuota(pro5hModel, weeklyGroup, fiveHourGroup);
            const effectiveFlash = calculateEffectiveQuota(flash5hModel, weeklyGroup, fiveHourGroup);

            // 综合评分：Pro 权重更高 (70%)，Flash 权重 30%
            let score = Math.round(effectivePro * 0.7 + effectiveFlash * 0.3);

            // 若周额度见底 (<= 5%)，直接淘汰
            if (weeklyGroup !== null && weeklyGroup <= 5) {
                score = 0;
            }

            return {
                ...a,
                quotaVal: score,
            };
        })
        .filter(a => a.quotaVal > 0)
        .sort((a, b) => b.quotaVal - a.quotaVal);

    const claudeSorted = accounts
        .filter(a => a.id !== currentAccountId && !a.disabled && !a.quota?.is_forbidden)
        .map(a => {
            const claude5hModel = findQuotaModel(a.quota?.models, 'claude')?.percentage ?? null;
            const weeklyGroup = getBucketPercentage(a.quota?.quota_groups, 'claude', 'weekly');
            const fiveHourGroup = getBucketPercentage(a.quota?.quota_groups, 'claude', '5h');

            let score = calculateEffectiveQuota(claude5hModel, weeklyGroup, fiveHourGroup);

            // 若周额度见底 (<= 5%)，直接淘汰
            if (weeklyGroup !== null && weeklyGroup <= 5) {
                score = 0;
            }

            return {
                ...a,
                quotaVal: score,
            };
        })
        .filter(a => a.quotaVal > 0)
        .sort((a, b) => b.quotaVal - a.quotaVal);

    let bestGemini = geminiSorted[0];
    let bestClaude = claudeSorted[0];

    // 2. 如果推荐是同一个账号，且有其他选择，尝试寻找最优的"不同账号"组合
    if (bestGemini && bestClaude && bestGemini.id === bestClaude.id) {
        const nextGemini = geminiSorted[1];
        const nextClaude = claudeSorted[1];

        // 方案A: 保持 Gemini 最优，换 Claude 次优
        // 方案B: 换 Gemini 次优，保持 Claude 最优
        // 比较标准：两者配额之和最大化 (或者优先保住 100% 的那个)

        const scoreA = bestGemini.quotaVal + (nextClaude?.quotaVal || 0);
        const scoreB = (nextGemini?.quotaVal || 0) + bestClaude.quotaVal;

        if (nextClaude && (!nextGemini || scoreA >= scoreB)) {
            // 选方案A：换 Claude
            bestClaude = nextClaude;
        } else if (nextGemini) {
            // 选方案B：换 Gemini
            bestGemini = nextGemini;
        }
        // 如果都没有次优解（例如只有一个账号），则保持原样
    }

    // 构造最终用于显示的视图模型 (兼容原有渲染逻辑)
    const bestGeminiRender = bestGemini ? { ...bestGemini, geminiQuota: bestGemini.quotaVal } : undefined;
    const bestClaudeRender = bestClaude ? { ...bestClaude, claudeQuota: bestClaude.quotaVal } : undefined;

    const renderPick = (
        kicker: string,
        acc: Account,
        quota: number
    ) => {
        const full = acc.custom_label ? `${acc.custom_label} (${maskEmail(acc.email)})` : maskEmail(acc.email);
        return (
            <LedgerRow key={`${kicker}-${acc.id}`} className="flex-wrap">
                <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-base-content/60">{kicker}</div>
                    <div className="mt-0.5 text-sm font-bold truncate" title={full}>
                        {getAccountDisplayName(acc)}
                    </div>
                    <div className="mt-1.5">
                        <SegmentBar percent={quota} tone={quota >= 50 ? 'lime' : quota >= 20 ? 'warn' : 'bad'} />
                    </div>
                </div>
                <span className="text-3xl leading-none font-black tabular-nums [font-stretch:75%] shrink-0">{quota}%</span>
                {onSwitch && (
                    <button
                        type="button"
                        className="btn btn-sm btn-ghost rounded-none shrink-0 gap-1.5 text-[11px] font-black uppercase tracking-[0.1em]"
                        title={t('dashboard.switch_best')}
                        onClick={() => onSwitch(acc.id)}
                    >
                        {t('dashboard.switch_best')}
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                )}
            </LedgerRow>
        );
    };

    return (
        <section>
            <SectionRule index="03" label={t('dashboard.best_accounts')} />

            <div>
                {/* Gemini 最佳 */}
                {bestGeminiRender && renderPick(t('dashboard.for_gemini'), bestGeminiRender, bestGeminiRender.geminiQuota)}

                {/* Claude 最佳 */}
                {bestClaudeRender && renderPick(t('dashboard.for_claude'), bestClaudeRender, bestClaudeRender.claudeQuota)}

                {(!bestGeminiRender && !bestClaudeRender) && (
                    <div className="py-6 text-sm font-bold uppercase tracking-wider text-base-content/50 border-b border-base-content/20">
                        {t('accounts.no_data')}
                    </div>
                )}
            </div>
        </section>
    );

}

export default BestAccounts;
