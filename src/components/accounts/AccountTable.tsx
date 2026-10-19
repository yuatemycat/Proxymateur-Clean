/**
 * Account ledger table.
 * One dense row per account: identity, status chips, tier, per-model segmented quota meters,
 * last-used stamp and an icon-button action cluster. Rows can be drag-reordered.
 */
import { useMemo, useState, useRef, useEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    GripVertical,
    ArrowRightLeft,
    RefreshCw,
    Trash2,
    Download,
    Fingerprint,
    Info,
    Lock,
    Ban,
    Diamond,
    Gem,
    Circle,
    Sparkles,
    Tag,
    X,
    Check,
    Clock,
    Calendar,
    BatteryCharging,
    BatteryLow,
    Bot,
    Repeat2,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Mail,
    Copy,
    ToggleLeft,
    ToggleRight,
} from 'lucide-react';
import { type Account, type ModelQuota, getAccountTier } from '../../types/account';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';

import { useConfigStore } from '../../stores/useConfigStore';
import { QuotaMeter } from './QuotaMeter';
import { IconAction, ActionMenu } from './IconAction';
import { Pill, TierBadge } from './StatusPill';
import Mascot from '../common/Mascot';
import { getModelQuotaDisplay } from '../../utils/quotaDisplay';
import { MODEL_CONFIG, sortModels, resolveQuotaModels, ensurePinnedImageSelector, findQuotaModel, getCompactModelLabel, getModelIcon } from '../../config/modelConfig';
import { categorizeModel, getModelProtectionKey } from '../../utils/modelCategory';
import { maskEmail, getAccountDisplayName } from '../../utils/format';
import { getValidationBlockedStatusLabel } from './accountValidationStatus';
import { getLiveLimitForModel } from '../../utils/liveLimit';
import { AccountSortOption } from '../../utils/accountSort';

// ============================================================================
// 类型定义
// ============================================================================

interface AccountTableProps {
    accounts: Account[];
    selectedIds: Set<string>;
    refreshingIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onToggleAll: () => void;
    currentAccountId: string | null;
    switchingAccountId: string | null;
    onSwitch: (accountId: string, targetIde?: string) => void;
    onRefresh: (accountId: string) => void;
    onViewDevice: (accountId: string) => void;
    onViewDetails: (accountId: string) => void;
    onExport: (accountId: string) => void;
    onDelete: (accountId: string) => void;
    onToggleProxy: (accountId: string) => void;
    onWarmup?: (accountId: string) => void;
    onUpdateLabel?: (accountId: string, label: string) => void;
    /** 拖拽排序回调，当用户完成拖拽时触发 */
    onReorder?: (accountIds: string[]) => void;
    onViewError: (accountId: string) => void;
    quotaWindow?: '5h' | 'weekly';
    maskEmails?: boolean;
    sortOption?: AccountSortOption;
    onSortChange?: (option: AccountSortOption) => void;
}

interface SortableRowProps {
    account: Account;
    selected: boolean;
    isRefreshing: boolean;
    isCurrent: boolean;
    isSwitching: boolean;
    isDragging?: boolean;
    onSelect: () => void;
    onSwitch: (targetIde?: string) => void;
    onRefresh: () => void;
    onViewDevice: () => void;
    onViewDetails: () => void;
    onExport: () => void;
    onDelete: () => void;
    onToggleProxy: () => void;
    onWarmup?: () => void;
    onUpdateLabel?: (label: string) => void;
    onViewError: () => void;
    quotaWindow?: '5h' | 'weekly';
    isDragDisabled?: boolean;
    maskEmails?: boolean;
}

interface AccountRowContentProps {
    account: Account;
    isCurrent: boolean;
    isRefreshing: boolean;
    isSwitching: boolean;
    isDisabled: boolean;
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

// ============================================================================
// 辅助函数
// ============================================================================

function isModelProtected(protectedModels: string[] | undefined, modelName: string): boolean {
    if (!protectedModels || protectedModels.length === 0) return false;
    const lowerName = modelName.toLowerCase();

    if (lowerName === 'gemini-pro') {
        return protectedModels.some((model) =>
            categorizeModel(model) === 'gemini-pro' && getModelProtectionKey(model) === 'gemini-3-pro-high',
        );
    }
    if (lowerName === 'gemini-flash') {
        return protectedModels.some((model) =>
            categorizeModel(model) === 'gemini-flash' && getModelProtectionKey(model) === 'gemini-3-flash',
        );
    }
    if (lowerName === 'claude-sonnet') {
        return protectedModels.some((model) =>
            categorizeModel(model) === 'claude' && getModelProtectionKey(model) === 'claude',
        );
    }

    const protectionKey = getModelProtectionKey(lowerName);
    return protectionKey ? protectedModels.includes(protectionKey) : false;
}

const CHECKBOX_CLASS =
    'checkbox checkbox-xs rounded-[4px] border border-base-content/30 [--chkbg:var(--color-base-content)] [--chkfg:var(--color-base-100)]';

const TH_CLASS =
    'px-2 py-2.5 text-left rtl:text-right text-xs font-medium text-base-content/55 whitespace-nowrap';

const SORT_BTN_CLASS =
    'inline-flex items-center gap-1 rounded px-1 -mx-1 font-medium hover:text-base-content transition-colors';

/** Fixed column widths (px). The account column takes the remaining space. */
const COL_WIDTHS = {
    grip: 32,
    select: 40,
    status: 116,
    tier: 92,
    quota: 400,
    lastUsed: 108,
    actions: 144,
} as const;
const TABLE_MIN_WIDTH = 1120;

// ============================================================================
// 子组件
// ============================================================================

/**
 * 可拖拽的表格行组件
 * 使用 @dnd-kit/sortable 实现拖拽功能
 */
function SortableAccountRow({
    account,
    selected,
    isRefreshing,
    isCurrent,
    isSwitching,
    isDragging,
    onSelect,
    onSwitch,
    onRefresh,
    onViewDevice,
    onViewDetails,
    onExport,
    onDelete,
    onToggleProxy,
    onWarmup,
    onUpdateLabel,
    onViewError,
    quotaWindow,
    isDragDisabled = false,
    maskEmails = true,
}: SortableRowProps) {
    const { t } = useTranslation();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging: isSortableDragging,
    } = useSortable({ id: account.id, disabled: isDragDisabled });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isSortableDragging ? 0.5 : 1,
        zIndex: isSortableDragging ? 1000 : 'auto',
    };

    return (
        <tr
            ref={setNodeRef}
            style={style as React.CSSProperties}
            className={cn(
                'group transition-colors border-b border-base-content/10',
                isDragging && 'bg-base-200',
                !isDragging && 'hover:bg-base-content/[0.03]',
            )}
        >
            {/* 拖拽手柄 (carries the lime live-row edge) */}
            <td
                className={cn(
                    'pl-1 pr-0 py-3 align-middle border-l-2 transition-colors',
                    isCurrent ? 'border-lime-signal' : 'border-transparent',
                )}
            >
                <div
                    {...(!isDragDisabled ? attributes : {})}
                    {...(!isDragDisabled ? listeners : {})}
                    className={cn(
                        'flex items-center justify-center w-6 h-6 transition-colors',
                        isDragDisabled
                            ? 'text-base-content/15 cursor-not-allowed'
                            : 'cursor-grab active:cursor-grabbing text-base-content/30 hover:text-base-content',
                    )}
                    title={isDragDisabled ? t('accounts.drag_disabled_during_sort', '已激活列排序，拖拽排序已暂停') : t('accounts.drag_to_reorder')}
                >
                    <GripVertical className="w-4 h-4" />
                </div>
            </td>
            {/* 复选框 */}
            <td className="px-2 py-3 align-middle">
                <input
                    type="checkbox"
                    className={CHECKBOX_CLASS}
                    checked={selected}
                    onChange={onSelect}
                    disabled={isRefreshing}
                />
            </td>
            <AccountRowContent
                account={account}
                isCurrent={isCurrent}
                isRefreshing={isRefreshing}
                isSwitching={isSwitching}
                isDisabled={Boolean(account.disabled)}
                onSwitch={onSwitch}
                onRefresh={onRefresh}
                onViewDevice={onViewDevice}
                onViewDetails={onViewDetails}
                onExport={onExport}
                onDelete={onDelete}
                onToggleProxy={onToggleProxy}
                onWarmup={onWarmup}
                onUpdateLabel={onUpdateLabel}
                onViewError={onViewError}
                quotaWindow={quotaWindow}
                maskEmails={maskEmails}
            />
        </tr>
    );
}

/**
 * 账号行内容组件
 * 渲染邮箱、状态、订阅、配额、最后使用时间和操作按钮等列
 */
function AccountRowContent({
    account,
    isCurrent,
    isRefreshing,
    isSwitching,
    isDisabled,
    onSwitch,
    onRefresh,
    onViewDevice,
    onViewDetails,
    onExport,
    onDelete,
    onToggleProxy,
    onWarmup,
    onUpdateLabel,
    onViewError,
    quotaWindow,
    maskEmails = true,
}: AccountRowContentProps) {
    const { t } = useTranslation();
    const { config, showAllQuotas } = useConfigStore();
    const validationBlockedLabel = getValidationBlockedStatusLabel(account.validation_blocked_reason, t);

    // 自定义标签编辑状态
    const [isEditingLabel, setIsEditingLabel] = useState(false);
    const [labelInput, setLabelInput] = useState(account.custom_label || '');

    // 邮箱复制状态
    const [copiedEmail, setCopiedEmail] = useState(false);

    const handleCopyEmail = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (account.email) {
            navigator.clipboard.writeText(account.email);
            setCopiedEmail(true);
            setTimeout(() => setCopiedEmail(false), 1500);
        }
    };

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

    // 解析周配额项 (当处于 weekly 视图时)
    const weeklyItems = useMemo(() => {
        if (quotaWindow !== 'weekly') return [];
        return (account.quota?.quota_groups || []).flatMap(group => {
            const weeklyBuckets = (group.buckets || [])
                .filter(b => b.window.toLowerCase().includes('week') || b.bucket_id.toLowerCase().includes('week'));
            return weeklyBuckets
                .map(b => {
                    const shortGroupName = (group.display_name || '')
                        .replace(/ models?$/i, '')
                        .replace(/Claude and GPT/i, 'Claude/GPT');
                    const fullLabel = b.display_name ? `${shortGroupName} (${b.display_name})` : `${shortGroupName} (weekly)`;
                    return {
                        id: `${group.display_name}-${b.bucket_id}`,
                        // 列头已标明周配额：单桶时只显示分组名，完整名称放进 tooltip
                        label: weeklyBuckets.length > 1 ? fullLabel : shortGroupName,
                        title: fullLabel,
                        percentage: Math.round((b.remaining_fraction || 0) * 100),
                        resetTime: b.reset_time,
                        cycleTokens: b.cycle_tokens,
                        Icon: shortGroupName.toLowerCase().includes('claude') ? Sparkles : Bot,
                    };
                });
        });
    }, [quotaWindow, account.quota?.quota_groups]);

    // 获取要显示的模型列表
    const pinnedModels = ensurePinnedImageSelector(
        config?.pinned_quota_models?.models || Object.keys(MODEL_CONFIG),
    );

    // 根据 show_all 状态决定显示哪些模型
    const uniqueLabels = new Set<string>();
    const displayModels = sortModels(
        (showAllQuotas
            ? (account.quota?.models || []).map(m => {
                const config = MODEL_CONFIG[m.name.toLowerCase()];
                const label = (config?.shortLabel || config?.label) || getCompactModelLabel(m.name, m.display_name);
                return {
                    id: m.name.toLowerCase(),
                    label: label,
                    protectedKey: config?.protectedKey || m.name.toLowerCase(),
                    data: m
                };
            })
            : resolveQuotaModels(account.quota?.models, pinnedModels).map(sel => {
                const selectorConfig = MODEL_CONFIG[sel.selectorId.toLowerCase()];
                const resolvedConfig = sel.model ? MODEL_CONFIG[sel.model.name.toLowerCase()] : undefined;
                if (!selectorConfig && !sel.model) return null;
                const label = (resolvedConfig?.shortLabel || resolvedConfig?.label)
                    || (sel.model ? getCompactModelLabel(sel.model.name, sel.model.display_name) : undefined)
                    || (selectorConfig?.shortLabel || selectorConfig?.label)
                    || getCompactModelLabel(sel.selectorId);
                return {
                    id: sel.model?.name.toLowerCase() ?? sel.selectorId.toLowerCase(),
                    label,
                    protectedKey: getModelProtectionKey(sel.model?.name ?? sel.selectorId) ?? resolvedConfig?.protectedKey ?? selectorConfig?.protectedKey ?? sel.selectorId,
                    data: sel.model,
                };
            }).filter((item): item is { id: string; label: string; protectedKey: string; data: ModelQuota | undefined } => item !== null)
    ).filter(m => {
            // 过滤特定的 Claude/Gemini 思考变体 (在列表页隐藏)
            const isHiddenThinking = m.id.includes('thinking');

            if (isHiddenThinking) return false;

            // 基于标签去重 (例如 G3.1 Pro 只显示一次)
            // 优先显示有配额数据的 ID
            const labelKey = `${m.label}-${m.protectedKey}`;
            if (uniqueLabels.has(labelKey)) {
                return false;
            }
            if (m.data) {
                uniqueLabels.add(labelKey);
                return true;
            }
            return true;
        })
    ).filter((m, index, self) => {
        // 第二次过滤：确保即使没有数据的重复 Label 也只保留一个
        const labelKey = `${m.label}-${m.protectedKey}`;
        return self.findIndex(t => `${t.label}-${t.protectedKey}` === labelKey) === index;
    });

    // 聚合展示最新可访问模型：2 个最新模型 (Gemini 3.8 Flash + Claude 5.5/4.6)
    const hasLabel = Boolean(account.custom_label);
    const geminiFlashModel = findQuotaModel(account.quota?.models, 'gemini-flash') || findQuotaModel(account.quota?.models, 'gemini-pro');
    const claudeModel = findQuotaModel(account.quota?.models, 'claude');

    const geminiFlashId = geminiFlashModel?.name?.toLowerCase() || 'gemini-3.8-flash';
    const geminiFlashConfig = MODEL_CONFIG[geminiFlashId] || MODEL_CONFIG['gemini-3.8-flash'];
    const geminiFlashLabel = geminiFlashConfig?.shortLabel || 'G3.8 Flash';
    const geminiFlashTitle = geminiFlashModel?.display_name || geminiFlashConfig?.label || geminiFlashLabel;
    const geminiFlashDisplay = getModelQuotaDisplay(geminiFlashId, geminiFlashModel, account.quota?.quota_groups);
    const geminiFlashProtectedKey = getModelProtectionKey(geminiFlashId) || 'gemini-flash';
    const isGeminiFlashProtected = Boolean(config?.quota_protection?.enabled && isModelProtected(account.protected_models, geminiFlashProtectedKey));
    const geminiFlashLiveLimit = getLiveLimitForModel(account, geminiFlashId, geminiFlashProtectedKey);

    const claudeId = claudeModel?.name?.toLowerCase() || 'claude-sonnet-5-5-high';
    const claudeConfig = MODEL_CONFIG[claudeId] || MODEL_CONFIG['claude-sonnet-5-5'];
    const claudeLabel = claudeConfig?.shortLabel || 'Claude 5.5';
    const claudeTitle = claudeModel?.display_name || claudeConfig?.label || claudeLabel;
    const claudeDisplay = getModelQuotaDisplay(claudeId, claudeModel, account.quota?.quota_groups);
    const claudeProtectedKey = getModelProtectionKey(claudeId) || 'claude';
    const isClaudeProtected = Boolean(config?.quota_protection?.enabled && isModelProtected(account.protected_models, claudeProtectedKey));
    const claudeLiveLimit = getLiveLimitForModel(account, claudeId, claudeProtectedKey);

    const tier = getAccountTier(account);
    const showHealthy = !isCurrent && !isDisabled && !account.proxy_disabled && !account.quota?.is_forbidden && !account.validation_blocked;

    const meterCount = (quotaWindow === 'weekly' && weeklyItems.length > 0)
        ? weeklyItems.length
        : (!showAllQuotas ? 2 : displayModels.length);

    return (
        <>
            {/* 账号列 */}
            <td className="px-2 py-3 align-middle min-w-0 overflow-hidden">
                {isEditingLabel ? (
                    <div className="flex items-center gap-1">
                        <input
                            type="text"
                            className="input input-xs rounded-md border border-base-content/20 bg-base-100 w-36 min-w-0 text-xs"
                            placeholder={t('accounts.custom_label_placeholder', 'Label')}
                            value={labelInput}
                            onChange={(e) => setLabelInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            maxLength={50}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <IconAction title={t('common.save', 'Save')} onClick={(e) => { e.stopPropagation(); handleSaveLabel(); }}>
                            <Check className="w-3 h-3" />
                        </IconAction>
                        <IconAction title={t('common.cancel', 'Cancel')} onClick={(e) => { e.stopPropagation(); handleCancelLabel(); }}>
                            <X className="w-3 h-3" />
                        </IconAction>
                    </div>
                ) : (
                    <div
                        className={cn(
                            'flex items-center gap-1.5 font-medium text-sm cursor-pointer hover:underline decoration-1 underline-offset-4 min-w-0',
                        )}
                        title={account.custom_label ? `${account.custom_label} (${maskEmails ? maskEmail(account.email) : account.email})` : (maskEmails ? maskEmail(account.email) : account.email)}
                        onClick={(e) => {
                            if (onUpdateLabel) {
                                e.stopPropagation();
                                setIsEditingLabel(true);
                            }
                        }}
                    >
                        {hasLabel && <Tag className="w-3 h-3 shrink-0 text-base-content/60" />}
                        <span className="truncate">{getAccountDisplayName(account, maskEmails)}</span>
                    </div>
                )}
                {hasLabel && !isEditingLabel && (
                    <button
                        type="button"
                        onClick={handleCopyEmail}
                        className="mt-0.5 max-w-full flex items-center gap-1 text-[10px] font-mono text-base-content/50 hover:text-base-content transition-colors"
                        title={account.email ? `${account.email} (${t('accounts.click_to_copy', 'Click to copy')})` : ''}
                    >
                        <Mail className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{maskEmails ? maskEmail(account.email) : account.email}</span>
                        {copiedEmail ? (
                            <span className="flex items-center gap-0.5 shrink-0 text-emerald-600 dark:text-lime-signal font-sans font-medium">
                                <Check className="w-2.5 h-2.5" />
                                {t('common.copied', 'Copied')}
                            </span>
                        ) : (
                            <Copy className="w-2.5 h-2.5 shrink-0 opacity-0 group-hover:opacity-60" />
                        )}
                    </button>
                )}
            </td>

            {/* 状态列 */}
            <td className="px-2 py-3 align-middle">
                <div className="flex flex-col items-start gap-1">
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
                    {showHealthy && <Pill tone="ink" dot>{t('accounts.summary.ready', 'Ready')}</Pill>}
                </div>
            </td>

            {/* 订阅列 */}
            <td className="px-2 py-3 align-middle">
                <div className="flex flex-col items-start gap-1">
                    {tier === 'ultra' ? (
                        <TierBadge tier="ultra" icon={<Gem className="w-2.5 h-2.5" />}>{t('accounts.ultra')}</TierBadge>
                    ) : tier === 'pro' ? (
                        <TierBadge tier="pro" icon={<Diamond className="w-2.5 h-2.5" />}>{t('accounts.pro')}</TierBadge>
                    ) : (
                        <TierBadge tier="free" icon={<Circle className="w-2.5 h-2.5" />}>{t('accounts.free')}</TierBadge>
                    )}
                    <span className="text-[10px] font-mono text-base-content/50 whitespace-nowrap" title={t('accounts.priority_hint')}>
                        {t('accounts.priority')} {account.priority ?? 50}
                    </span>
                </div>
            </td>

            {/* 模型配额列 */}
            <td className="px-2 py-3 align-middle min-w-0 overflow-hidden">
                {isDisabled || account.quota?.is_forbidden || account.validation_blocked ? (
                    <div className={cn(
                        'flex flex-wrap items-center gap-x-3 gap-y-1 py-1 pl-3 border-l-2',
                        account.validation_blocked ? 'border-amber-500/70 text-amber-700 dark:text-amber-400' : 'border-red-500/70 text-red-700 dark:text-red-400',
                    )}>
                        {account.validation_blocked ? <Clock className="w-3.5 h-3.5 shrink-0" /> : (account.quota?.is_forbidden ? <Lock className="w-3.5 h-3.5 shrink-0" /> : <Ban className="w-3.5 h-3.5 shrink-0" />)}
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
                    <div className={cn(
                        'grid gap-x-4 gap-y-2 min-w-0',
                        meterCount > 1 ? 'grid-cols-2' : 'grid-cols-1',
                    )}>
                        {quotaWindow === 'weekly' && weeklyItems.length > 0 ? (
                            weeklyItems.map((item) => (
                                <QuotaMeter
                                    key={item.id}
                                    label={item.label}
                                    title={item.title}
                                    percentage={item.percentage}
                                    resetTime={item.resetTime}
                                    weeklyTokens={item.cycleTokens ?? null}
                                    Icon={item.Icon}
                                />
                            ))
                        ) : !showAllQuotas ? (
                            <>
                                <QuotaMeter
                                    label={geminiFlashLabel}
                                    title={geminiFlashTitle}
                                    modelId={geminiFlashModel?.name}
                                    {...geminiFlashDisplay}
                                    isProtected={isGeminiFlashProtected}
                                    liveLimit={geminiFlashLiveLimit}
                                    Icon={geminiFlashConfig?.Icon || Bot}
                                />
                                <QuotaMeter
                                    label={claudeLabel}
                                    title={claudeTitle}
                                    modelId={claudeModel?.name}
                                    {...claudeDisplay}
                                    isProtected={isClaudeProtected}
                                    liveLimit={claudeLiveLimit}
                                    Icon={claudeConfig?.Icon || Bot}
                                />
                            </>
                        ) : (
                            displayModels.map((model) => {
                                const modelData = model.data;
                                const display = getModelQuotaDisplay(model.id, modelData, account.quota?.quota_groups);

                                return (
                                    <QuotaMeter
                                        key={model.id}
                                        label={model.label}
                                        title={modelData?.display_name || model.label}
                                        modelId={modelData?.name}
                                        {...display}
                                        isProtected={Boolean(config?.quota_protection?.enabled && isModelProtected(account.protected_models, model.protectedKey))}
                                        liveLimit={getLiveLimitForModel(account, model.id, model.protectedKey)}
                                        Icon={getModelIcon(model.id) || Bot}
                                    />
                                );
                            })
                        )}
                    </div>
                )}
            </td>

            {/* 最后使用时间列 */}
            <td className="pl-2 pr-4 py-3 align-middle">
                <div className="flex flex-col tabular-nums whitespace-nowrap">
                    <span className="text-xs text-base-content/80">
                        {new Date(account.last_used * 1000).toLocaleDateString()}
                    </span>
                    <span className="text-[11px] text-base-content/45 leading-tight">
                        {new Date(account.last_used * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </td>

            {/* 操作列: three inline actions + overflow menu */}
            <td className="px-2 py-3 align-middle">
                <div className="flex items-center justify-end gap-0.5 whitespace-nowrap">
                    <IconAction
                        title={isDisabled ? t('accounts.disabled_tooltip') : (isSwitching ? t('common.loading') : t('accounts.switch_to_agy', '切换到 Antigravity CLI (agy)'))}
                        onClick={(e) => { e.stopPropagation(); onSwitch('agy'); }}
                        disabled={isSwitching || isDisabled}
                        busy={isSwitching}
                    >
                        <ArrowRightLeft className={cn('w-3.5 h-3.5', isSwitching && 'animate-spin')} />
                    </IconAction>
                    <IconAction
                        title={isDisabled ? t('accounts.disabled_tooltip') : (isRefreshing ? t('common.refreshing') : t('common.refresh'))}
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
            </td>
        </>
    );
}

// ============================================================================
// 主组件
// ============================================================================

const QUOTA_SORT_BADGES: Partial<Record<AccountSortOption, { Icon: typeof Clock; text: string; tone: 'lime' | 'ink' | 'warn' | 'bad' }>> = {
    reset_5h_weekly_priority: { Icon: Sparkles, text: '5H★', tone: 'warn' },
    reset_5h_asc: { Icon: Clock, text: '5H ↑', tone: 'lime' },
    reset_5h_desc: { Icon: Clock, text: '5H ↓', tone: 'ink' },
    reset_weekly_asc: { Icon: Calendar, text: 'Wk ↑', tone: 'lime' },
    reset_weekly_desc: { Icon: Calendar, text: 'Wk ↓', tone: 'ink' },
    quota_desc: { Icon: BatteryCharging, text: '% ↓', tone: 'lime' },
    quota_asc: { Icon: BatteryLow, text: '% ↑', tone: 'bad' },
};

const QUOTA_SORT_GROUPS: Array<Array<{ id: AccountSortOption; labelKey: string; defaultLabel: string; Icon: typeof Clock; badge?: string }>> = [
    [
        { id: 'reset_5h_weekly_priority', labelKey: 'accounts.sort.reset_5h_weekly_priority', defaultLabel: '5H Reset (Weekly-Prioritized)', Icon: Sparkles, badge: 'Best' },
        { id: 'reset_5h_asc', labelKey: 'accounts.sort.reset_5h_asc', defaultLabel: '5H Reset: Shortest first', Icon: Clock },
        { id: 'reset_weekly_asc', labelKey: 'accounts.sort.reset_weekly_asc', defaultLabel: 'Weekly Reset: Shortest first', Icon: Calendar },
    ],
    [
        { id: 'quota_desc', labelKey: 'accounts.sort.quota_desc', defaultLabel: 'Quota: Highest first', Icon: BatteryCharging },
        { id: 'quota_asc', labelKey: 'accounts.sort.quota_asc', defaultLabel: 'Quota: Lowest first', Icon: BatteryLow },
    ],
    [
        { id: 'default', labelKey: 'accounts.sort.default', defaultLabel: 'Default Order (Drag & Drop)', Icon: ArrowUpDown },
    ],
];

/**
 * 账号表格组件
 * 支持拖拽排序、多选、批量操作等功能
 */
function AccountTable({
    accounts,
    selectedIds,
    refreshingIds,
    onToggleSelect,
    onToggleAll,
    currentAccountId,
    switchingAccountId,
    onSwitch,
    onRefresh,
    onViewDevice,
    onViewDetails,
    onExport,
    onDelete,
    onToggleProxy,
    onReorder,
    onWarmup,
    onUpdateLabel,
    onViewError,
    quotaWindow,
    maskEmails = true,
    sortOption = 'default',
    onSortChange,
}: AccountTableProps) {
    const { t } = useTranslation();

    const [activeId, setActiveId] = useState<string | null>(null);
    const [isQuotaPopoverOpen, setIsQuotaPopoverOpen] = useState(false);
    const quotaPopoverRef = useRef<HTMLTableHeaderCellElement>(null);

    // Close quota popover on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (quotaPopoverRef.current && !quotaPopoverRef.current.contains(event.target as Node)) {
                setIsQuotaPopoverOpen(false);
            }
        }
        if (isQuotaPopoverOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isQuotaPopoverOpen]);

    const isSortingActive = sortOption !== 'default';

    const handleEmailSortToggle = () => {
        if (!onSortChange) return;
        if (sortOption === 'email_asc') {
            onSortChange('email_desc');
        } else if (sortOption === 'email_desc') {
            onSortChange('default');
        } else {
            onSortChange('email_asc');
        }
    };

    const handleLastUsedSortToggle = () => {
        if (!onSortChange) return;
        if (sortOption === 'last_used_desc') {
            onSortChange('last_used_asc');
        } else if (sortOption === 'last_used_asc') {
            onSortChange('default');
        } else {
            onSortChange('last_used_desc');
        }
    };

    const isQuotaSortActive = [
        'reset_5h_weekly_priority',
        'reset_5h_asc',
        'reset_5h_desc',
        'reset_weekly_asc',
        'reset_weekly_desc',
        'quota_desc',
        'quota_asc',
    ].includes(sortOption);

    const getQuotaSortBadge = () => {
        const badge = QUOTA_SORT_BADGES[sortOption];
        if (!badge) {
            return <ArrowUpDown className="w-3 h-3 text-base-content/40 group-hover:text-base-content" />;
        }
        const { Icon, text, tone } = badge;
        return (
            <Pill tone={tone}>
                <Icon className="w-3 h-3" />
                <span>{text}</span>
            </Pill>
        );
    };

    // 配置拖拽传感器
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 }, // 需要移动 8px 才触发拖拽
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const accountIds = useMemo(() => accounts.map(a => a.id), [accounts]);
    const activeAccount = useMemo(() => accounts.find(a => a.id === activeId), [accounts, activeId]);

    const handleDragStart = (event: DragStartEvent) => {
        if (isSortingActive) return;
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (isSortingActive) return;

        if (over && active.id !== over.id) {
            const oldIndex = accountIds.indexOf(active.id as string);
            const newIndex = accountIds.indexOf(over.id as string);

            if (oldIndex !== -1 && newIndex !== -1 && onReorder) {
                onReorder(arrayMove(accountIds, oldIndex, newIndex));
            }
        }
    };

    if (accounts.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-base-content/20 p-12 text-center">
                <Mascot size={48} className="text-base-content/40" face="var(--color-base-100)" />
                <p className="text-base-content/70 font-medium">{t('accounts.empty.title')}</p>
                <p className="text-sm text-base-content/50">{t('accounts.empty.desc')}</p>
            </div>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="overflow-x-auto">
                <table className="w-full table-fixed" style={{ minWidth: TABLE_MIN_WIDTH }}>
                    <colgroup>
                        <col style={{ width: COL_WIDTHS.grip }} />
                        <col style={{ width: COL_WIDTHS.select }} />
                        <col />
                        <col style={{ width: COL_WIDTHS.status }} />
                        <col style={{ width: COL_WIDTHS.tier }} />
                        <col style={{ width: COL_WIDTHS.quota }} />
                        <col style={{ width: COL_WIDTHS.lastUsed }} />
                        <col style={{ width: COL_WIDTHS.actions }} />
                    </colgroup>
                    <thead>
                        <tr className="border-b border-base-content/10 bg-base-100">
                            <th className="pl-2 py-2.5 text-left">
                                <span className="sr-only">{t('accounts.drag_to_reorder')}</span>
                            </th>
                            <th className="px-2 py-2.5 text-left">
                                <input
                                    type="checkbox"
                                    className={CHECKBOX_CLASS}
                                    checked={accounts.length > 0 && selectedIds.size === accounts.length}
                                    onChange={onToggleAll}
                                />
                            </th>
                            <th className={TH_CLASS}>
                                <button
                                    type="button"
                                    onClick={handleEmailSortToggle}
                                    className={cn(
                                        SORT_BTN_CLASS,
                                        (sortOption === 'email_asc' || sortOption === 'email_desc') && 'text-base-content',
                                    )}
                                    title={t('accounts.sort.email_asc', 'Click to sort by email / name')}
                                >
                                    <span>{t('accounts.table.email')}</span>
                                    {sortOption === 'email_asc' ? (
                                        <ArrowUp className="w-3.5 h-3.5" />
                                    ) : sortOption === 'email_desc' ? (
                                        <ArrowDown className="w-3.5 h-3.5" />
                                    ) : (
                                        <ArrowUpDown className="w-3 h-3 opacity-50 hover:opacity-100" />
                                    )}
                                </button>
                            </th>
                            <th className={TH_CLASS}>
                                {t('accounts.table.status', 'Status')}
                            </th>
                            <th className={TH_CLASS}>
                                {t('accounts.table.tier', 'Tier')}
                            </th>
                            <th className={cn(TH_CLASS, 'relative')} ref={quotaPopoverRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsQuotaPopoverOpen(!isQuotaPopoverOpen)}
                                    className={cn(
                                        SORT_BTN_CLASS,
                                        'group',
                                        isQuotaSortActive && 'text-base-content',
                                    )}
                                    title={t('accounts.sort.title', 'Click to select quota & reset sort')}
                                >
                                    <span>{quotaWindow === 'weekly' ? t('accounts.table.weekly_quota', '周配额') : t('accounts.table.quota')}</span>
                                    {getQuotaSortBadge()}
                                </button>

                                {isQuotaPopoverOpen && (
                                    <div className="absolute left-2 top-full mt-1 w-72 bg-base-100 rounded-lg border border-base-content/10 shadow-lg shadow-black/10 py-1 z-50 normal-case font-normal tracking-normal">
                                        <div className="px-3 py-1.5 text-[11px] font-medium text-base-content/60 border-b border-base-content/10 flex items-center justify-between">
                                            <span>{t('accounts.sort.title', 'Sort by Quota & Reset')}</span>
                                            {isQuotaSortActive && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onSortChange?.('default');
                                                        setIsQuotaPopoverOpen(false);
                                                    }}
                                                    className="text-base-content/70 underline underline-offset-4 text-[11px] hover:text-base-content"
                                                >
                                                    {t('common.reset', 'Reset')}
                                                </button>
                                            )}
                                        </div>

                                        <div className="divide-y divide-base-content/10">
                                            {QUOTA_SORT_GROUPS.map((group, gi) => (
                                                <div key={gi} className="py-1">
                                                    {group.map(({ id, labelKey, defaultLabel, Icon, badge }) => (
                                                        <button
                                                            key={id}
                                                            type="button"
                                                            onClick={() => {
                                                                onSortChange?.(id);
                                                                setIsQuotaPopoverOpen(false);
                                                            }}
                                                            className={cn(
                                                                'w-full px-3 py-1.5 text-xs text-left flex items-center justify-between transition-colors',
                                                                sortOption === id
                                                                    ? 'bg-base-content/10 text-base-content font-medium'
                                                                    : 'text-base-content/80 hover:bg-base-content/5',
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Icon className="w-3.5 h-3.5" />
                                                                <span>{t(labelKey, defaultLabel)}</span>
                                                                {badge && (
                                                                    <Pill tone="lime">{badge}</Pill>
                                                                )}
                                                            </div>
                                                            {sortOption === id && <Check className="w-3.5 h-3.5" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </th>
                            <th className={cn(TH_CLASS, 'pr-4')}>
                                <button
                                    type="button"
                                    onClick={handleLastUsedSortToggle}
                                    className={cn(
                                        SORT_BTN_CLASS,
                                        (sortOption === 'last_used_desc' || sortOption === 'last_used_asc') && 'text-base-content',
                                    )}
                                    title={t('accounts.table.sort_by_last_used', 'Click to sort by last used time')}
                                >
                                    <span>{t('accounts.table.last_used')}</span>
                                    {sortOption === 'last_used_desc' ? (
                                        <ArrowDown className="w-3.5 h-3.5" />
                                    ) : sortOption === 'last_used_asc' ? (
                                        <ArrowUp className="w-3.5 h-3.5" />
                                    ) : (
                                        <ArrowUpDown className="w-3 h-3 opacity-50 hover:opacity-100" />
                                    )}
                                </button>
                            </th>
                            <th className={cn(TH_CLASS, 'text-right')}>{t('accounts.table.actions')}</th>
                        </tr>
                    </thead>
                    <SortableContext items={accountIds} strategy={verticalListSortingStrategy}>
                        <tbody>
                            {accounts.map((account) => (
                                <SortableAccountRow
                                    key={account.id}
                                    account={account}
                                    selected={selectedIds.has(account.id)}
                                    isRefreshing={refreshingIds.has(account.id)}
                                    isCurrent={account.id === currentAccountId}
                                    isSwitching={account.id === switchingAccountId}
                                    isDragging={account.id === activeId}
                                    onSelect={() => onToggleSelect(account.id)}
                                    onSwitch={(targetIde?: string) => onSwitch(account.id, targetIde)}
                                    onRefresh={() => onRefresh(account.id)}
                                    onViewDevice={() => onViewDevice(account.id)}
                                    onViewDetails={() => onViewDetails(account.id)}
                                    onExport={() => onExport(account.id)}
                                    onDelete={() => onDelete(account.id)}
                                    onToggleProxy={() => onToggleProxy(account.id)}
                                    onWarmup={onWarmup ? () => onWarmup(account.id) : undefined}
                                    onUpdateLabel={onUpdateLabel ? (label: string) => onUpdateLabel(account.id, label) : undefined}
                                    onViewError={() => onViewError(account.id)}
                                    quotaWindow={quotaWindow}
                                    isDragDisabled={isSortingActive}
                                    maskEmails={maskEmails}
                                />
                            ))}
                        </tbody>
                    </SortableContext>
                </table>
            </div>

            {/* 拖拽悬浮预览层 */}
            <DragOverlay>
                {
                    activeAccount ? (
                        <table className="w-full table-fixed bg-base-100 rounded-lg border border-base-content/15 shadow-lg shadow-black/10" style={{ minWidth: TABLE_MIN_WIDTH }}>
                            <colgroup>
                                <col style={{ width: COL_WIDTHS.grip }} />
                                <col style={{ width: COL_WIDTHS.select }} />
                                <col />
                                <col style={{ width: COL_WIDTHS.status }} />
                                <col style={{ width: COL_WIDTHS.tier }} />
                                <col style={{ width: COL_WIDTHS.quota }} />
                                <col style={{ width: COL_WIDTHS.lastUsed }} />
                                <col style={{ width: COL_WIDTHS.actions }} />
                            </colgroup>
                            <tbody>
                                <tr className="bg-base-200">
                                    <td className="pl-1 py-1 border-l-2 border-transparent">
                                        <div className="flex items-center justify-center w-6 h-6 text-base-content">
                                            <GripVertical className="w-4 h-4" />
                                        </div>
                                    </td>
                                    <td className="px-2 py-1">
                                        <input
                                            type="checkbox"
                                            className={CHECKBOX_CLASS}
                                            checked={selectedIds.has(activeAccount.id)}
                                            readOnly
                                        />
                                    </td>
                                    <AccountRowContent
                                        account={activeAccount}
                                        isCurrent={activeAccount.id === currentAccountId}
                                        isRefreshing={refreshingIds.has(activeAccount.id)}
                                        isSwitching={activeAccount.id === switchingAccountId}
                                        onSwitch={() => { }}
                                        onRefresh={() => { }}
                                        onViewDevice={() => { }}
                                        onViewDetails={() => { }}
                                        onExport={() => { }}
                                        onDelete={() => { }}
                                        onToggleProxy={() => { }}
                                        isDisabled={Boolean(activeAccount.disabled)}
                                        onViewError={() => { }}
                                        quotaWindow={quotaWindow}
                                        maskEmails={maskEmails}
                                    />
                                </tr>
                            </tbody>
                        </table>
                    ) : null
                }
            </DragOverlay>
        </DndContext>
    );
}

export default AccountTable;
