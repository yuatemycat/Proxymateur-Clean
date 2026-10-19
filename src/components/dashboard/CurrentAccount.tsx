import { ArrowRight, Clock, Lock, Tag } from 'lucide-react';
import { Account, getAccountTier, ModelQuota } from '../../types/account';
import { formatTimeRemaining, getAccountDisplayName, maskEmail } from '../../utils/format';
import { findQuotaModel, getModelProtectionKey, getModelDisplayName, findImageQuotaModel } from '../../config/modelConfig';
import { getModelConstrainedQuota, DashboardQuotaView } from '../../utils/quotaDisplay';
import { useTranslation } from 'react-i18next';
import { Chip, LedgerRow, SectionRule, SegmentBar } from '../common/ledger';

interface CurrentAccountProps {
    account: Account | null;
    quotaView?: DashboardQuotaView;
    onSwitch?: () => void;
}

function CurrentAccount({ account, quotaView = 'weighted', onSwitch }: CurrentAccountProps) {
    const { t } = useTranslation();

    const switchLink = onSwitch ? (
        <button
            type="button"
            onClick={onSwitch}
            className="group inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] hover:underline underline-offset-4"
        >
            {t('dashboard.switch_account')}
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
    ) : undefined;

    if (!account) {
        return (
            <section>
                <SectionRule index="02" label={t('dashboard.current_account')} right={switchLink} />
                <div className="py-6 text-sm font-bold uppercase tracking-wider text-base-content/50 border-b border-base-content/20">
                    {t('dashboard.no_active_account')}
                </div>
            </section>
        );
    }

    const geminiProModel = findQuotaModel(account.quota?.models, 'gemini-pro');
    const geminiFlashModel = findQuotaModel(account.quota?.models, 'gemini-flash');

    const geminiImageModel = findImageQuotaModel(account.quota?.models);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const imageProtectionKey = getModelProtectionKey(geminiImageModel?.name || '');
    const liveImageLimit = imageProtectionKey
        ? account.live_limited_models?.[imageProtectionKey]
        : undefined;
    const isImageLiveLimited = Boolean(liveImageLimit && liveImageLimit.until > nowSeconds);

    const claudeModel = findQuotaModel(account.quota?.models, 'claude');

    // 辅助渲染单条模型配额（支持综合加权、5H、周配额及双向木桶约束标记）
    const renderModelItem = (
        model: ModelQuota,
        displayName: string,
        isLocked: boolean,
        extraIcon?: React.ReactNode
    ) => {
        const q = getModelConstrainedQuota(model.name, model, account.quota?.quota_groups, quotaView);

        // 重置时间详情 tooltip
        const resetTooltip = [
            q.fiveHourResetTime ? `5H: ${new Date(q.fiveHourResetTime).toLocaleTimeString()}` : null,
            q.weeklyResetTime ? `Weekly: ${new Date(q.weeklyResetTime).toLocaleDateString()}` : null,
        ].filter(Boolean).join(' | ');

        // 状态徽标
        let statusBadge: React.ReactNode = null;
        if (q.isWeeklyExhausted) {
            statusBadge = (
                <span title={t('dashboard.zero_weekly_warning', { count: 1, defaultValue: '{{count}} active account(s) circuit-broken due to zero weekly quota (rated 0%)' })}>
                    <Chip tone="bad">{t('dashboard.mini_tag_exhausted', 'Zero')}</Chip>
                </span>
            );
        } else if (quotaView === '5h' && q.isWeeklyConstrained && q.raw5h !== null && q.rawWeekly !== null) {
            statusBadge = (
                <span
                    title={t('dashboard.constrained_by_weekly_desc', {
                        raw5h: q.raw5h,
                        rawWeekly: q.rawWeekly,
                        effective: q.effectivePercentage,
                        defaultValue: `5h rolling is {{raw5h}}%, but constrained by weekly budget {{rawWeekly}}%`,
                    })}
                >
                    <Chip tone="warn">
                        {t('dashboard.mini_tag_constrained', 'Capped')}: {q.rawWeekly}%
                    </Chip>
                </span>
            );
        } else if (quotaView === 'weekly' && q.is5hCooling) {
            statusBadge = (
                <span
                    title={t('dashboard.cooling_5h_desc', {
                        rawWeekly: q.rawWeekly,
                        defaultValue: `Weekly budget has {{rawWeekly}}%, but current 5h window is exhausted and cooling down`,
                    })}
                >
                    <Chip tone="ink">
                        <Clock className="w-3 h-3" />
                        {t('dashboard.mini_tag_cooling', 'Cooling')}
                    </Chip>
                </span>
            );
        }

        const pct = q.effectivePercentage;
        const tone = pct >= 50 ? 'lime' : pct >= 20 ? 'warn' : 'bad';
        const textColor = pct >= 50
            ? 'text-base-content'
            : pct >= 20
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400';

        return (
            <LedgerRow key={model.name} className="flex-wrap sm:flex-nowrap">
                <div className="w-full sm:w-44 shrink-0 min-w-0 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
                    {extraIcon}
                    {isLocked && <Lock className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />}
                    <span className="truncate" title={displayName}>{displayName}</span>
                </div>
                <div className="flex-1 min-w-[120px]">
                    <SegmentBar percent={pct} tone={tone} />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {statusBadge}
                    <span
                        className="font-mono text-[11px] text-base-content/60 tabular-nums"
                        title={resetTooltip || `${t('accounts.reset_time')}: ${model.reset_time}`}
                    >
                        {q.resetTime ? `R ${formatTimeRemaining(q.resetTime)}` : t('common.unknown')}
                    </span>
                    <span className={`w-16 text-right text-2xl leading-none font-black tabular-nums [font-stretch:75%] ${textColor}`}>
                        {pct}%
                    </span>
                </div>
            </LedgerRow>
        );
    };

    const tier = getAccountTier(account);

    return (
        <section>
            <SectionRule index="02" label={t('dashboard.current_account')} right={switchLink} />

            {/* now strip: identity */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-3 border-b-2 border-base-content">
                <span className="inline-block w-2.5 h-2.5 bg-lime-signal border border-base-content shrink-0" aria-hidden />
                <span
                    className="text-xl font-black tracking-tight truncate min-w-0 max-w-full"
                    title={account.custom_label ? `${account.custom_label} (${maskEmail(account.email)})` : maskEmail(account.email)}
                >
                    {getAccountDisplayName(account)}
                </span>
                {tier === 'ultra' ? (
                    <Chip tone="lime">ULTRA</Chip>
                ) : tier === 'pro' ? (
                    <Chip tone="ink">PRO</Chip>
                ) : (
                    <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.14em] border-2 border-base-content">
                        FREE
                    </span>
                )}
                {account.custom_label && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.14em] border-2 border-base-content/50 text-base-content/70">
                        <Tag className="w-3 h-3" />
                        {account.custom_label}
                    </span>
                )}
            </div>

            <div>
                {/* Gemini Pro 配额 */}
                {geminiProModel && renderModelItem(
                    geminiProModel,
                    getModelDisplayName(geminiProModel),
                    Boolean(account.protected_models?.includes('gemini-3-pro-high') || account.protected_models?.includes('gemini-3.1-pro-high'))
                )}

                {/* Gemini 3 Pro Image 配额 */}
                {geminiImageModel && renderModelItem(
                    geminiImageModel,
                    getModelDisplayName(geminiImageModel),
                    Boolean(imageProtectionKey && account.protected_models?.includes(imageProtectionKey)),
                    isImageLiveLimited ? <Clock className="w-3 h-3 text-amber-500 shrink-0" /> : undefined
                )}

                {/* Gemini Flash 配额 */}
                {geminiFlashModel && renderModelItem(
                    geminiFlashModel,
                    getModelDisplayName(geminiFlashModel),
                    Boolean(account.protected_models?.includes('gemini-3-flash'))
                )}

                {/* Claude 配额 */}
                {claudeModel && renderModelItem(
                    claudeModel,
                    getModelDisplayName(claudeModel, t('common.claude_series', 'Claude Series')),
                    Boolean(account.protected_models?.includes('claude'))
                )}
            </div>
        </section>
    );
}

export default CurrentAccount;
