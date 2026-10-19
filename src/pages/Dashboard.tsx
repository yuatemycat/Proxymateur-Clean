import { save } from '@tauri-apps/plugin-dialog';
import { AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AddAccountDialog from '../components/accounts/AddAccountDialog';
import { showToast } from '../components/common/ToastContainer';
import { Chip, LedgerRow, PageHeader, SectionRule, SegmentBar, Ticker } from '../components/common/ledger';
import BestAccounts from '../components/dashboard/BestAccounts';
import { findImageQuotaModel, findQuotaModel } from '../config/modelConfig';
import CurrentAccount from '../components/dashboard/CurrentAccount';
import { exportAccounts } from '../services/accountService';
import { useAccountStore } from '../stores/useAccountStore';
import { Account } from '../types/account';
import { isTauri } from '../utils/env';
import { request as invoke } from '../utils/request';
import { DashboardQuotaView } from '../utils/quotaDisplay';

function Dashboard() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const {
        accounts,
        currentAccount,
        fetchAccounts,
        fetchCurrentAccount,
        switchAccount,
        addAccount,
        refreshQuota,
        loading
    } = useAccountStore();

    useEffect(() => {
        fetchAccounts();
        fetchCurrentAccount();
    }, []);

    const [onlyAvailable, setOnlyAvailable] = useState<boolean>(() => {
        const saved = localStorage.getItem('dashboard_filter_only_available');
        return saved !== null ? saved === 'true' : true;
    });

    const [quotaView, setQuotaView] = useState<DashboardQuotaView>(() => {
        const saved = localStorage.getItem('dashboard_quota_view');
        return (saved === '5h' || saved === 'weekly' || saved === 'weighted') ? saved : 'weighted';
    });

    useEffect(() => {
        localStorage.setItem('dashboard_filter_only_available', String(onlyAvailable));
    }, [onlyAvailable]);

    useEffect(() => {
        localStorage.setItem('dashboard_quota_view', quotaView);
    }, [quotaView]);

    // 全维度账号健康与配额计算矩阵 (状态由风控定生死，底座池支持仅可用账号与全部正常账号无缝切换)
    const stats = useMemo(() => {
        // 1. 账号生态健康状态分类（风控与启用状态定生死，不以额度定生死）
        // 异常账号：触发 Google 验证码/风控阻断，或配额接口返回 403 Forbidden 封禁
        const abnormalAccounts = accounts.filter(
            a => a.validation_blocked || a.quota?.is_forbidden
        );
        // 禁用账号：非异常，但用户手动停用账号
        const disabledAccounts = accounts.filter(
            a => !a.validation_blocked && !a.quota?.is_forbidden && a.disabled
        );
        // 可用账号：开启且状态正常、风控正常的生产力账号
        const availableAccounts = accounts.filter(
            a => !a.disabled && !a.validation_blocked && !a.quota?.is_forbidden
        );
        // 全部正常状态账号（包含禁用与非禁用，彻底剔除风控异常账号）
        const normalAccounts = accounts.filter(
            a => !a.validation_blocked && !a.quota?.is_forbidden
        );

        // 依据按钮状态选择底座统计池：默认仅看可用账号；关闭则看全部正常状态账号
        const basePool = onlyAvailable
            ? (availableAccounts.length > 0 ? availableAccounts : normalAccounts)
            : normalAccounts;

        // 2. 单账号配额提取辅助函数
        const get5hQuota = (a: Account, modelKey: 'gemini-pro' | 'gemini-image' | 'claude'): number | null => {
            const isClaude = modelKey === 'claude';
            // 优先从 quota_groups 提取原生 5H 滚动配额桶
            if (a.quota?.quota_groups) {
                for (const group of a.quota.quota_groups) {
                    const gname = group.display_name.toLowerCase();
                    const matches = isClaude
                        ? (gname.includes('claude') || gname.includes('gpt') || gname.includes('3p'))
                        : (gname.includes('gemini') || (!gname.includes('claude') && !gname.includes('gpt') && !gname.includes('3p')));
                    if (matches) {
                        const bucket5h = group.buckets?.find(b =>
                            b.window?.toLowerCase().includes('5h') ||
                            b.bucket_id?.toLowerCase().includes('5h') ||
                            b.window?.toLowerCase().includes('hour') ||
                            b.bucket_id?.toLowerCase().includes('hour')
                        );
                        if (bucket5h && typeof bucket5h.remaining_fraction === 'number') {
                            return Math.round(bucket5h.remaining_fraction * 100);
                        }
                    }
                }
            }
            if (modelKey === 'gemini-image') {
                return findImageQuotaModel(a.quota?.models)?.percentage ?? null;
            }
            return findQuotaModel(a.quota?.models, modelKey)?.percentage ?? null;
        };

        const getWeeklyQuota = (a: Account, modelKey: 'gemini-pro' | 'gemini-image' | 'claude'): number | null => {
            const isClaude = modelKey === 'claude';
            if (a.quota?.quota_groups) {
                for (const group of a.quota.quota_groups) {
                    const gname = group.display_name.toLowerCase();
                    const matches = isClaude
                        ? (gname.includes('claude') || gname.includes('gpt') || gname.includes('3p'))
                        : (gname.includes('gemini') || (!gname.includes('claude') && !gname.includes('gpt') && !gname.includes('3p')));
                    if (matches) {
                        const weekly = group.buckets?.find(b =>
                            b.window?.toLowerCase().includes('week') ||
                            b.bucket_id?.toLowerCase().includes('week') ||
                            b.window?.toLowerCase().includes('7d')
                        );
                        if (weekly && typeof weekly.remaining_fraction === 'number') {
                            return Math.round(weekly.remaining_fraction * 100);
                        }
                    }
                }
            }
            return null;
        };

        // 计算目标底座池在指定模型下的综合指标（5H均值、周配额均值、周配额熔断加权，以及受周额度木桶约束后的 5H 均值）
        const computeMetrics = (modelKey: 'gemini-pro' | 'gemini-image' | 'claude') => {
            const pool = basePool;
            if (pool.length === 0) {
                return {
                    avg5h: 0,
                    constrainedAvg5h: 0,
                    avgWeekly: 0,
                    weightedEffective: 0,
                    zeroWeeklyCount: 0,
                    coolingCount: 0,
                    cappedCount: 0,
                };
            }

            let sum5h = 0, count5h = 0;
            let sumConstrained5h = 0, countConstrained5h = 0;
            let sumWeekly = 0, countWeekly = 0;
            let sumWeighted = 0, totalWeight = 0;
            let zeroWeeklyCount = 0;
            let coolingCount = 0;
            let cappedCount = 0;

            for (const a of pool) {
                const q5h = get5hQuota(a, modelKey);
                const qWeekly = getWeeklyQuota(a, modelKey);

                if (q5h !== null && q5h >= 0) {
                    sum5h += q5h;
                    count5h++;
                }

                if (qWeekly !== null && qWeekly >= 0) {
                    sumWeekly += qWeekly;
                    countWeekly++;
                    if (qWeekly <= 0) {
                        zeroWeeklyCount++;
                    }
                }

                // 1. 双向木桶约束计算：5H 受周额度硬顶约束
                let constrained5h = q5h ?? (qWeekly ?? 0);
                if (qWeekly !== null && qWeekly <= 0) {
                    constrained5h = 0; // 周见底熔断
                } else if (qWeekly !== null && q5h !== null && qWeekly < q5h) {
                    constrained5h = qWeekly; // 被周额度硬顶压制
                    cappedCount++;
                }
                sumConstrained5h += constrained5h;
                countConstrained5h++;

                // 2. 双向木桶约束计算：周额度受 5H 瞬时冷却约束统计
                if (qWeekly !== null && qWeekly > 0 && q5h !== null && q5h <= 0) {
                    coolingCount++;
                }

                // 3. 核心短板特殊处理：周配额见底(0%)时，上游必然拒绝，实际可用额度熔断归 0！
                let effectiveVal = q5h ?? 0;
                if (qWeekly !== null && qWeekly <= 0) {
                    effectiveVal = 0;
                } else if (qWeekly !== null && q5h !== null) {
                    effectiveVal = Math.min(q5h, qWeekly);
                } else if (qWeekly !== null) {
                    effectiveVal = qWeekly;
                }

                // 套餐权重加权 (ULTRA 2.0, PRO 1.5, FREE 1.0)
                const tier = (a.quota?.subscription_tier || '').toUpperCase();
                const weight = tier.includes('ULTRA') ? 2.0 : tier.includes('PRO') ? 1.5 : 1.0;
                sumWeighted += effectiveVal * weight;
                totalWeight += weight;
            }

            return {
                avg5h: count5h > 0 ? Math.round(sum5h / count5h) : 0,
                constrainedAvg5h: countConstrained5h > 0 ? Math.round(sumConstrained5h / countConstrained5h) : 0,
                avgWeekly: countWeekly > 0 ? Math.round(sumWeekly / countWeekly) : 0,
                weightedEffective: totalWeight > 0 ? Math.round(sumWeighted / totalWeight) : 0,
                zeroWeeklyCount,
                coolingCount,
                cappedCount,
            };
        };

        const gemini = computeMetrics('gemini-pro');
        const geminiImage = computeMetrics('gemini-image');
        const claude = computeMetrics('claude');

        return {
            total: accounts.length,
            available: availableAccounts.length,
            disabled: disabledAccounts.length,
            abnormal: abnormalAccounts.length,
            normalCount: normalAccounts.length,
            basePoolCount: basePool.length,
            gemini,
            geminiImage,
            claude,
        };
    }, [accounts, onlyAvailable]);

    const isSwitchingRef = useRef(false);

    const handleSwitch = async (accountId: string) => {
        if (loading || isSwitchingRef.current) return;

        isSwitchingRef.current = true;
        console.log('[Dashboard] handleSwitch called for', accountId);
        try {
            await switchAccount(accountId);
            showToast(t('dashboard.toast.switch_success'), 'success');
        } catch (error) {
            console.error('Failed to switch account:', error);
            showToast(`${t('dashboard.toast.switch_error')}: ${error}`, 'error');
        } finally {
            setTimeout(() => {
                isSwitchingRef.current = false;
            }, 1000);
        }
    };

    const handleAddAccount = async (email: string, refreshToken: string) => {
        await addAccount(email, refreshToken);
        await fetchAccounts(); // 刷新列表
    };

    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefreshCurrent = async () => {
        if (!currentAccount) return;

        setIsRefreshing(true);
        try {
            await refreshQuota(currentAccount.id);
            // 刷新成功后重新获取最新数据
            await fetchCurrentAccount();
            showToast(t('dashboard.toast.refresh_success'), 'success');
        } catch (error) {
            console.error('[Dashboard] Refresh failed:', error);
            showToast(`${t('dashboard.toast.refresh_error')}: ${error}`, 'error');
        } finally {
            setIsRefreshing(false);
        }
    };

    const exportAccountsToJson = async (accountsToExport: Account[]) => {
        try {
            if (accountsToExport.length === 0) {
                showToast(t('dashboard.toast.export_no_accounts'), 'warning');
                return;
            }

            // Get export data from API (contains refresh_token)
            const accountIds = accountsToExport.map(acc => acc.id);
            const response = await exportAccounts(accountIds);

            if (!response.accounts || response.accounts.length === 0) {
                showToast(t('dashboard.toast.export_no_accounts'), 'warning');
                return;
            }

            const exportData = response.accounts;
            const content = JSON.stringify(exportData, null, 2);
            const fileName = `antigravity_accounts_${new Date().toISOString().split('T')[0]}.json`;

            if (isTauri()) {
                const path = await save({
                    filters: [{
                        name: 'JSON',
                        extensions: ['json']
                    }],
                    defaultPath: fileName
                });

                if (!path) return;

                await invoke('save_text_file', { path, content });
                showToast(t('dashboard.toast.export_success', { path }), 'success');
            } else {
                // Web 模式：使用浏览器下载
                const blob = new Blob([content], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast(t('dashboard.toast.export_success', { path: fileName }), 'success');
            }
        } catch (error: any) {
            console.error('Export failed:', error);
            showToast(`${t('dashboard.toast.export_error')}: ${error.toString()}`, 'error');
        }
    };

    const handleExport = () => {
        exportAccountsToJson(accounts);
    };

    const getCardQuota = (stat: typeof stats.gemini) => {
        if (quotaView === '5h') {
            return { val: stat.avg5h, label: t('dashboard.view_mode_5h', '5h Rolling') };
        }
        if (quotaView === 'weekly') {
            return { val: stat.avgWeekly, label: t('dashboard.view_mode_weekly', '7d Weekly') };
        }
        return { val: stat.weightedEffective, label: t('dashboard.weighted_available', 'Weighted Available') };
    };

    // 单个配额分组 -> 一行账本
    const renderQuotaRow = (title: string, stat: typeof stats.gemini) => {
        const card = getCardQuota(stat);
        const isTight = card.val < 50;
        const tone = card.val >= 50 ? 'lime' : card.val >= 20 ? 'warn' : 'bad';

        let note: { tone: 'warn' | 'ink'; text: string } | null = null;
        if (stat.zeroWeeklyCount > 0) {
            note = { tone: 'warn', text: t('dashboard.zero_weekly_warning', { count: stat.zeroWeeklyCount }) };
        } else if (quotaView === '5h' && stat.cappedCount > 0) {
            note = { tone: 'warn', text: `${stat.cappedCount} account(s) have their 5H limit capped by the weekly quota` };
        } else if (quotaView === 'weekly' && stat.coolingCount > 0) {
            note = { tone: 'ink', text: `${stat.coolingCount} account(s) currently in 5H cooldown freeze` };
        }

        return (
            <LedgerRow key={title} className="flex-wrap lg:flex-nowrap py-3.5">
                <div className="w-full lg:w-56 shrink-0 min-w-0">
                    <div className="text-xs font-black uppercase tracking-[0.14em] truncate" title={title}>{title}</div>
                    <div className="mt-0.5 text-[11px] text-base-content/60 truncate">{card.label}</div>
                </div>
                <div className="w-28 shrink-0 text-right lg:text-left">
                    <span className="text-5xl leading-none font-black tabular-nums [font-stretch:75%]">{card.val}</span>
                    <span className="text-xl font-black text-base-content/60">%</span>
                </div>
                <div className="flex-1 min-w-[160px] space-y-1.5">
                    <SegmentBar percent={card.val} tone={tone} />
                    <div className="flex flex-wrap items-center justify-between gap-x-4 text-[11px] font-mono tabular-nums">
                        <span>
                            <span className="text-base-content/60">{t('dashboard.rolling_5h', '5h Rolling:')}</span>{' '}
                            <b>{stat.avg5h}%</b>
                        </span>
                        <span>
                            <span className="text-base-content/60">{t('dashboard.weekly_7d', '7d Weekly:')}</span>{' '}
                            <b className={stat.avgWeekly <= 10 ? 'text-amber-600 dark:text-amber-400' : ''}>{stat.avgWeekly}%</b>
                        </span>
                    </div>
                    {note && (
                        <div className="flex items-center gap-2 text-[11px] font-medium min-w-0">
                            <Chip tone={note.tone}>
                                <AlertTriangle className="w-3 h-3" />
                            </Chip>
                            <span className="truncate" title={note.text}>{note.text}</span>
                        </div>
                    )}
                </div>
                <div className="shrink-0">
                    <Chip tone={isTight ? 'warn' : 'ink'}>
                        {isTight ? t('dashboard.quota_tight_short', 'Tight') : t('dashboard.quota_sufficient_short', 'Sufficient')}
                    </Chip>
                </div>
            </LedgerRow>
        );
    };

    const segBtn = (active: boolean) =>
        `px-2.5 py-1 -ml-[2px] first:ml-0 text-[11px] font-black uppercase tracking-[0.1em] border-2 border-base-content transition-colors cursor-pointer select-none ${
            active ? 'bg-base-content text-base-100' : 'bg-base-100 text-base-content hover:bg-base-content/10'
        }`;

    const quotaControls = (
        <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center">
                <button type="button" className={segBtn(quotaView === 'weighted')} onClick={() => setQuotaView('weighted')} title={t('dashboard.view_mode_title_weighted')}>
                    {t('dashboard.view_mode_weighted', 'Weighted')}
                </button>
                <button type="button" className={segBtn(quotaView === '5h')} onClick={() => setQuotaView('5h')} title={t('dashboard.view_mode_title_5h')}>
                    {t('dashboard.view_mode_5h', '5h Rolling')}
                </button>
                <button type="button" className={segBtn(quotaView === 'weekly')} onClick={() => setQuotaView('weekly')} title={t('dashboard.view_mode_title_weekly')}>
                    {t('dashboard.view_mode_weekly', '7d Weekly')}
                </button>
            </div>
            <div className="flex items-center">
                <button type="button" className={segBtn(onlyAvailable)} onClick={() => setOnlyAvailable(true)} title={t('dashboard.btn_title_only_available', 'Current: Active accounts only (click to include disabled)')}>
                    {t('dashboard.btn_only_available', { count: stats.available })}
                </button>
                <button type="button" className={segBtn(!onlyAvailable)} onClick={() => setOnlyAvailable(false)} title={t('dashboard.btn_title_include_disabled', 'Current: All normal accounts including disabled (click for active only)')}>
                    {t('dashboard.btn_include_disabled', { count: stats.normalCount })}
                </button>
            </div>
        </div>
    );

    const linkRow = 'group flex items-center justify-between w-full py-3 border-b border-base-content/20 text-sm font-black uppercase tracking-[0.14em] hover:bg-base-content/5 transition-colors cursor-pointer';

    return (
        <div className="h-full w-full overflow-y-auto">
            <div className="px-6 py-6 max-w-7xl mx-auto">
                {/* 页头：状态 chips + 操作 */}
                <PageHeader
                    kicker={t('dashboard.kicker', 'Control room')}
                    title={t('nav.dashboard', 'Dashboard')}
                    status={
                        <>
                            <Chip tone={stats.total > 0 && stats.available > 0 ? 'lime' : 'warn'}>
                                {stats.available}/{stats.total} {t('dashboard.available_accounts', 'Available Accounts')}
                            </Chip>
                            <Chip tone={stats.abnormal > 0 ? 'bad' : 'ink'}>
                                {stats.abnormal > 0
                                    ? `${stats.abnormal} ${t('dashboard.abnormal_accounts', 'Abnormal Accounts')}`
                                    : t('dashboard.abnormal_accounts_no_risk', '✓ No risk or blocked accounts')}
                            </Chip>
                            {currentAccount && (
                                <Chip tone="ink">{currentAccount.name || currentAccount.email.split('@')[0]}</Chip>
                            )}
                        </>
                    }
                    actions={
                        <>
                            <AddAccountDialog onAdd={handleAddAccount} />
                            <button
                                className={`btn btn-sm rounded-none gap-1.5 ${isRefreshing || !currentAccount ? 'opacity-70 cursor-not-allowed' : ''}`}
                                onClick={handleRefreshCurrent}
                                disabled={isRefreshing || !currentAccount}
                                title={isRefreshing ? t('dashboard.refreshing') : t('dashboard.refresh_quota')}
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">{isRefreshing ? t('dashboard.refreshing') : t('dashboard.refresh_quota')}</span>
                            </button>
                        </>
                    }
                />

                {/* 01 账号生态健康 Ticker */}
                <div className="mt-6">
                    <Ticker
                        items={[
                            {
                                label: t('dashboard.total_accounts', 'Total Accounts'),
                                value: stats.total,
                                hint: t('dashboard.total_accounts_desc', 'All configured accounts'),
                            },
                            {
                                label: t('dashboard.available_accounts', 'Available Accounts'),
                                value: stats.available,
                                hint: t('dashboard.available_accounts_desc', '✓ Active & healthy · In proxy service'),
                                tone: 'good',
                            },
                            {
                                label: t('dashboard.disabled_accounts', 'Disabled Accounts'),
                                value: stats.disabled,
                                hint: t('dashboard.disabled_accounts_desc', 'Manually stopped / Proxy disabled'),
                            },
                            {
                                label: t('dashboard.abnormal_accounts', 'Abnormal Accounts'),
                                value: stats.abnormal,
                                hint: stats.abnormal > 0
                                    ? t('dashboard.abnormal_accounts_has_risk', '⚠ Verification / Blocked risk')
                                    : t('dashboard.abnormal_accounts_no_risk', '✓ No risk or blocked accounts'),
                                tone: stats.abnormal > 0 ? 'bad' : 'default',
                            },
                        ]}
                    />
                </div>

                {/* 01 配额生产力矩阵 */}
                <SectionRule
                    index="01"
                    label={`${onlyAvailable
                        ? t('dashboard.quota_matrix_active', 'Active Accounts Quota Productivity Matrix')
                        : t('dashboard.quota_matrix_all_normal', 'All Normal Accounts Quota Matrix (incl. disabled)')
                    } (${t('dashboard.base_pool_count', { count: stats.basePoolCount })})`}
                    right={quotaControls}
                />
                <div className="border-t border-base-content/20">
                    {renderQuotaRow(t('dashboard.gemini_available_quota', 'Gemini Available Quota'), stats.gemini)}
                    {renderQuotaRow(t('dashboard.gemini_image_quota', 'Gemini Image Quota'), stats.geminiImage)}
                    {renderQuotaRow(t('dashboard.claude_available_quota', 'Claude Available Quota'), stats.claude)}
                </div>

                {/* 02 / 03 当前账号 (2/3) + 最佳账号 (1/3) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-10">
                    <div className="lg:col-span-2 min-w-0">
                        <CurrentAccount
                            account={currentAccount}
                            quotaView={quotaView}
                            onSwitch={() => navigate('/accounts')}
                        />
                    </div>
                    <div className="min-w-0">
                        <BestAccounts
                            accounts={accounts}
                            currentAccountId={currentAccount?.id}
                            onSwitch={handleSwitch}
                        />
                    </div>
                </div>

                {/* 快速链接 */}
                <div className="mt-10 border-t-4 border-base-content">
                    <button type="button" className={linkRow} onClick={() => navigate('/accounts')}>
                        <span>{t('dashboard.view_all_accounts')}</span>
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </button>
                    <button type="button" className={linkRow} onClick={handleExport}>
                        <span>{t('dashboard.export_data')}</span>
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
