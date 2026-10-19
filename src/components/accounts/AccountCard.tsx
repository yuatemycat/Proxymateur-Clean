import { useMemo, useState } from 'react';
import { ArrowRightLeft, RefreshCw, Trash2, Download, Info, Lock, Ban, Diamond, Gem, Circle, Fingerprint, Sparkles, Tag, X, Check, Clock, Bot, Repeat2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Account, ModelQuota, getAccountTier } from '../../types/account';
import { cn } from '../../utils/cn';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../stores/useConfigStore';
import { QuotaMeter } from './QuotaMeter';
import { IconAction, ActionMenu } from './IconAction';
import { Pill, TierBadge } from './StatusPill';
import { MODEL_CONFIG, sortModels, getModelProtectionKey, getModelIcon, findQuotaModel } from '../../config/modelConfig';
import { getValidationBlockedStatusLabel } from './accountValidationStatus';
import { getLiveLimitForModel } from '../../utils/liveLimit';
import { getModelQuotaDisplay } from '../../utils/quotaDisplay';
import { maskEmail, getAccountDisplayName } from '../../utils/format';

interface AccountCardProps {
    account: Account;
    selected: boolean;
    onSelect: () => void;
    isCurrent: boolean;
    isRefreshing: boolean;
    isSwitching?: boolean;
    onSwitch: (targetIde?: string) => void;
    onRefresh: () => void;
    onViewDevice: () => void;
    onViewDetails: () => void;
    onExport: () => void;
    onDelete: () => void;
    onToggleProxy?: () => void;
    onWarmup?: () => void;
    onUpdateLabel?: (label: string) => void;
    onViewError: () => void;
    quotaWindow?: '5h' | 'weekly';
    maskEmails?: boolean;
}



function AccountCard({ account, selected, onSelect, isCurrent: propIsCurrent, isRefreshing, isSwitching = false, onSwitch, onRefresh, onViewDetails, onExport, onDelete, onToggleProxy, onViewDevice, onWarmup, onUpdateLabel, onViewError, quotaWindow, maskEmails = true }: AccountCardProps) {
    const { t } = useTranslation();
    const { config, showAllQuotas } = useConfigStore();
    const isDisabled = Boolean(account.disabled);
    const validationBlockedLabel = getValidationBlockedStatusLabel(account.validation_blocked_reason, t);

    // 自定义标签编辑状态
    const [isEditingLabel, setIsEditingLabel] = useState(false);
    const [labelInput, setLabelInput] = useState(account.custom_label || '');

    // Use the prop directly from parent component
    const isCurrent = propIsCurrent;

    const handleSaveLabel = () => {
        if (onUpdateLabel) {
            onUpdateLabel(labelInput.trim());
        }
        setIsEditingLabel(false);
    };

    const handleCancelLabel = () => {
        setLabelInput(account.custom_label || '');
        setIsEditingLabel(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveLabel();
        } else if (e.key === 'Escape') {
            handleCancelLabel();
        }
    };

    const displayModels = useMemo(() => {
        // Get all models from account (source of truth)
        const accountModels = account.quota?.models?.map(m => {
            // 注意：DEFAULT_MODELS 现在应该包含 shortLabel，我们需要确保它被正确映射
            // 但 DEFAULT_MODELS 是从 MODEL_CONFIG 生成的，我们需要确保它包含 shortLabel
            // 这里为了安全，直接从 MODEL_CONFIG 获取
            const fullConfig = MODEL_CONFIG[m.name.toLowerCase()];
            return {
                id: m.name,
                label: m.display_name || fullConfig?.shortLabel || fullConfig?.label || m.name,
                protectedKey: getModelProtectionKey(m.name) ?? fullConfig?.protectedKey ?? m.name,
                Icon: getModelIcon(m.name) || Bot,
                data: m
            };
        }) || [];

        let models: typeof accountModels;

        if (showAllQuotas) {
            models = accountModels;
        } else {
            // Show only the latest accessible Gemini model and Claude model
            const geminiModel = findQuotaModel(account.quota?.models, 'gemini-flash') || findQuotaModel(account.quota?.models, 'gemini-pro');
            const claudeModel = findQuotaModel(account.quota?.models, 'claude');
            const targetModels = [geminiModel, claudeModel].filter((m): m is ModelQuota => Boolean(m));

            if (targetModels.length > 0) {
                models = targetModels.map(tm => {
                    const found = accountModels.find(am => am.data.name.toLowerCase() === tm.name.toLowerCase());
                    if (found) return found;
                    const cfg = MODEL_CONFIG[tm.name.toLowerCase()];
                    return {
                        id: tm.name,
                        label: tm.display_name || cfg?.shortLabel || cfg?.label || tm.name,
                        protectedKey: getModelProtectionKey(tm.name) ?? cfg?.protectedKey ?? tm.name,
                        Icon: getModelIcon(tm.name) || Bot,
                        data: tm,
                    };
                });
            } else {
                models = accountModels.slice(0, 2);
            }
        }

        // 应用排序并过滤过期模型
        return sortModels(models).filter(m => m.id !== 'claude-sonnet-4-6-thinking' && m.id !== 'claude-sonnet-4-5-thinking' && m.id !== 'claude-opus-4-5-thinking');
    }, [config, account, showAllQuotas]);

    // 解析周配额项 (当处于 weekly 视图时)
    const weeklyItems = useMemo(() => {
        if (quotaWindow !== 'weekly') return [];
        return (account.quota?.quota_groups || []).flatMap(group => {
            return (group.buckets || [])
                .filter(b => b.window.toLowerCase().includes('week') || b.bucket_id.toLowerCase().includes('week'))
                .map(b => {
                    const shortGroupName = (group.display_name || '')
                        .replace(/ models?$/i, '')
                        .replace(/Claude and GPT/i, 'Claude/GPT');
                    const weeklySuffix = t('accounts.quota_window_weekly_short', 'Semanal');
                    return {
                        id: `${group.display_name}-${b.bucket_id}`,
                        label: b.display_name ? `${shortGroupName} (${b.display_name})` : `${shortGroupName} (${weeklySuffix})`,
                        percentage: Math.round((b.remaining_fraction || 0) * 100),
                        resetTime: b.reset_time,
                        cycleTokens: b.cycle_tokens,
                        Icon: shortGroupName.toLowerCase().includes('claude') ? Sparkles : Bot,
                    };
                });
        });
    }, [quotaWindow, account.quota?.quota_groups]);

    const isModelProtected = (key?: string) => {
        if (!config?.quota_protection?.enabled) return false;
        if (!key) return false;
        return account.protected_models?.includes(key);
    };

    const tier = getAccountTier(account);

    return (
        <div className={cn(
            "relative flex flex-col border border-l-2 rounded-lg bg-base-100 transition-colors",
            isCurrent
                ? "border-base-content/15 border-l-lime-signal"
                : "border-base-content/10 border-l-transparent hover:border-base-content/20",
            (isRefreshing || isDisabled) && "opacity-70"
        )}>

            {/* Header: Checkbox + Email + Last used */}
            <div className="flex-none flex items-start gap-3 p-3 pb-2 border-b border-base-content/10">
                <input
                    type="checkbox"
                    className="mt-1 checkbox checkbox-xs rounded-[4px] border border-base-content/30 [--chkbg:var(--color-base-content)] [--chkfg:var(--color-base-100)]"
                    checked={selected}
                    onChange={() => onSelect()}
                    onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                        <h3
                            className="font-medium text-sm truncate cursor-pointer hover:underline decoration-1 underline-offset-4"
                            title={account.custom_label ? `${account.custom_label} (${maskEmails ? maskEmail(account.email) : account.email})` : (maskEmails ? maskEmail(account.email) : account.email)}
                            onClick={(e) => {
                                if (onUpdateLabel) {
                                    e.stopPropagation();
                                    setIsEditingLabel(true);
                                }
                            }}
                        >
                            {getAccountDisplayName(account, maskEmails)}
                        </h3>
                        <span className="text-[10px] text-base-content/50 font-mono tabular-nums shrink-0 whitespace-nowrap">
                            {new Date(account.last_used * 1000).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {isCurrent && <Pill tone="lime" dot>{t('accounts.current')}</Pill>}
                        {isDisabled && (
                            <Pill tone="bad"><Ban className="w-2.5 h-2.5" />{t('accounts.disabled')}</Pill>
                        )}
                        {account.proxy_disabled && (
                            <span title={account.proxy_disabled_reason || t('accounts.proxy_disabled_tooltip')}>
                                <Pill tone="warn" dot>{t('accounts.proxy_disabled')}</Pill>
                            </span>
                        )}
                        {account.quota?.is_forbidden && (
                            <Pill tone="bad"><Lock className="w-2.5 h-2.5" />{t('accounts.forbidden')}</Pill>
                        )}
                        {account.validation_blocked && (
                            <Pill tone="warn" dot>{validationBlockedLabel}</Pill>
                        )}
                        {/* 订阅类型徽章 */}
                        {tier === 'ultra' ? (
                            <TierBadge tier="ultra" icon={<Gem className="w-2.5 h-2.5" />}>ULTRA</TierBadge>
                        ) : tier === 'pro' ? (
                            <TierBadge tier="pro" icon={<Diamond className="w-2.5 h-2.5" />}>PRO</TierBadge>
                        ) : (
                            <TierBadge tier="free" icon={<Circle className="w-2.5 h-2.5" />}>FREE</TierBadge>
                        )}
                        <span className="text-[10px] font-mono text-base-content/60" title={t('accounts.priority_hint')}>
                            {t('accounts.priority')} {account.priority ?? 50}
                        </span>
                        {account.custom_label && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-base-content/20 text-[10px] font-medium">
                                <Tag className="w-2.5 h-2.5" />
                                {account.custom_label}
                            </span>
                        )}
                    </div>
                </div>
            </div>


            {/* 配额展示 */}
            <div className="flex-1 px-3 py-3 overflow-y-auto scrollbar-none">
                {isDisabled || account.quota?.is_forbidden || account.validation_blocked ? (
                    <div className={cn(
                        "flex flex-wrap items-center gap-x-3 gap-y-1 py-2 pl-3 border-l-2",
                        account.validation_blocked ? "border-amber-500/70 text-amber-700 dark:text-amber-400" : "border-red-500/70 text-red-700 dark:text-red-400"
                    )}>
                        {account.validation_blocked ? <Clock className="w-4 h-4" /> : (isDisabled ? <Ban className="w-4 h-4" /> : <Lock className="w-4 h-4" />)}
                        <span className="text-xs font-medium">
                            {account.validation_blocked ? validationBlockedLabel : (isDisabled ? t('accounts.status.disabled') : t('accounts.forbidden_msg'))}
                        </span>
                        <button
                            onClick={(e) => { e.stopPropagation(); onViewError(); }}
                            className="text-[11px] font-medium text-base-content/70 underline underline-offset-4 decoration-1 hover:text-base-content"
                        >
                            {t('accounts.view_error')}
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2 content-start">
                        {quotaWindow === 'weekly' && weeklyItems.length > 0 ? (
                            weeklyItems.map((item) => (
                                <QuotaMeter
                                    key={item.id}
                                    label={item.label}
                                    percentage={item.percentage}
                                    resetTime={item.resetTime}
                                    weeklyTokens={item.cycleTokens ?? null}
                                    Icon={item.Icon}
                                />
                            ))
                        ) : (
                            displayModels.map((model) => (
                                <QuotaMeter
                                    key={model.id}
                                    label={model.label}
                                    modelId={model.data.name}
                                    {...getModelQuotaDisplay(model.id, model.data, account.quota?.quota_groups)}
                                    isProtected={isModelProtected(model.protectedKey)}
                                    liveLimit={getLiveLimitForModel(account, model.id, model.protectedKey)}
                                    Icon={model.Icon}
                                />
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Footer: Actions Only */}
            <div className="flex-none flex items-center p-2 border-t border-base-content/10">
                {/* 标签编辑弹出框 */}
                {isEditingLabel && (
                    <div className="absolute inset-0 bg-base-100/95 z-10 flex items-center justify-center p-4">
                        <div className="flex items-center gap-2 w-full max-w-xs">
                            <input
                                type="text"
                                className="input input-sm flex-1 rounded-md border border-base-content/20 bg-base-100"
                                placeholder={t('accounts.custom_label_placeholder', 'Enter custom label')}
                                value={labelInput}
                                onChange={(e) => setLabelInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                autoFocus
                                maxLength={50}
                            />
                            <IconAction title={t('common.save', 'Save')} onClick={handleSaveLabel}>
                                <Check className="w-4 h-4" />
                            </IconAction>
                            <IconAction title={t('common.cancel', 'Cancel')} onClick={handleCancelLabel}>
                                <X className="w-4 h-4" />
                            </IconAction>
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-0.5 w-full">
                    <IconAction
                        title={isDisabled ? t('accounts.disabled_tooltip') : (isSwitching ? t('common.loading') : t('accounts.switch_to_agy', '切换到 Antigravity CLI (agy)'))}
                        onClick={(e) => { e.stopPropagation(); onSwitch('agy'); }}
                        disabled={isSwitching || isDisabled}
                        busy={isSwitching}
                    >
                        <ArrowRightLeft className={cn('w-3.5 h-3.5', isSwitching && 'animate-spin')} />
                    </IconAction>
                    <IconAction
                        title={isDisabled ? t('accounts.disabled_tooltip') : t('common.refresh')}
                        onClick={(e) => { e.stopPropagation(); onRefresh(); }}
                        disabled={isRefreshing || isDisabled}
                        busy={isRefreshing}
                    >
                        <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
                    </IconAction>
                    {onToggleProxy && (
                        <IconAction
                            title={account.proxy_disabled ? t('accounts.enable_proxy') : t('accounts.disable_proxy')}
                            onClick={(e) => { e.stopPropagation(); onToggleProxy(); }}
                            tone={account.proxy_disabled ? 'warn' : 'default'}
                        >
                            {account.proxy_disabled ? (
                                <ToggleRight className="w-3.5 h-3.5" />
                            ) : (
                                <ToggleLeft className="w-3.5 h-3.5" />
                            )}
                        </IconAction>
                    )}
                    <div className="flex-1" />
                    <ActionMenu
                        title={t('common.more', 'More')}
                        items={[
                            {
                                key: 'switch-ide',
                                label: t('accounts.switch_to_ide', '切换到 Antigravity IDE'),
                                title: isDisabled ? t('accounts.disabled_tooltip') : undefined,
                                icon: <Repeat2 className="w-3.5 h-3.5" />,
                                onClick: () => onSwitch('ide'),
                                disabled: isSwitching || isDisabled,
                            },
                            {
                                key: 'switch-classic',
                                label: t('accounts.switch_to_classic', '切换到 Antigravity (经典版)'),
                                title: isDisabled ? t('accounts.disabled_tooltip') : undefined,
                                icon: <Repeat2 className="w-3.5 h-3.5" />,
                                onClick: () => onSwitch('classic'),
                                disabled: isSwitching || isDisabled,
                            },
                            {
                                key: 'switch-gemini',
                                label: t('accounts.switch_to_gemini', '切换到 Gemini 桌面版'),
                                title: isDisabled ? t('accounts.disabled_tooltip') : undefined,
                                icon: <Bot className="w-3.5 h-3.5" />,
                                onClick: () => onSwitch('gemini'),
                                disabled: isSwitching || isDisabled,
                            },
                            {
                                key: 'details',
                                label: t('common.details'),
                                icon: <Info className="w-3.5 h-3.5" />,
                                onClick: onViewDetails,
                                separatorBefore: true,
                            },
                            {
                                key: 'fingerprint',
                                label: t('accounts.device_fingerprint'),
                                icon: <Fingerprint className="w-3.5 h-3.5" />,
                                onClick: onViewDevice,
                            },
                            onUpdateLabel && {
                                key: 'label',
                                label: t('accounts.edit_label', 'Edit Label'),
                                icon: <Tag className="w-3.5 h-3.5" />,
                                onClick: () => setIsEditingLabel(true),
                            },
                            onWarmup && {
                                key: 'warmup',
                                label: t('accounts.warmup_this', '预热该账号'),
                                title: isDisabled ? t('accounts.disabled_tooltip') : undefined,
                                icon: <Sparkles className={cn('w-3.5 h-3.5', isRefreshing && 'animate-pulse')} />,
                                onClick: onWarmup,
                                disabled: isRefreshing || isDisabled,
                            },
                            {
                                key: 'export',
                                label: t('common.export'),
                                icon: <Download className="w-3.5 h-3.5" />,
                                onClick: onExport,
                            },
                            {
                                key: 'delete',
                                label: t('common.delete'),
                                icon: <Trash2 className="w-3.5 h-3.5" />,
                                onClick: onDelete,
                                tone: 'danger',
                                separatorBefore: true,
                            },
                        ]}
                    />
                </div>
            </div>
        </div>
    );
}

export default AccountCard;
