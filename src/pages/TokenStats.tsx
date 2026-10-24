import React, { useEffect, useState, useRef, useCallback } from 'react';
import { request as invoke } from '../utils/request';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Clock, Calendar, CalendarDays, RefreshCw } from 'lucide-react';
import { PageHeader, SectionRule, Ticker, SegmentBar, LedgerRow } from '../components/common/ledger';

interface TokenStatsAggregated {
    period: string;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cached_tokens: number;
    total_tokens: number;
    request_count: number;
    uncached_input_tokens?: number;
}

interface AccountTokenStats {
    account_email: string;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cached_tokens: number;
    total_tokens: number;
    request_count: number;
}

interface ModelTokenStats {
    model: string;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cached_tokens: number;
    total_tokens: number;
    request_count: number;
}

interface ModelTrendPoint {
    period: string;
    model_data: Record<string, number>;
}

interface AccountTrendPoint {
    period: string;
    account_data: Record<string, number>;
}

interface TokenStatsSummary {
    total_input_tokens: number;
    total_output_tokens: number;
    total_cached_tokens: number;
    total_tokens: number;
    total_requests: number;
    unique_accounts: number;
}

type TimeRange = 'hourly' | 'daily' | 'weekly';
type ViewMode = 'model' | 'account';

// Ledger palette: lime is the primary series, ink and greys carry the rest.
const SERIES_LIGHT = [
    '#84CC16', '#0A0A0A', '#71717A', '#4D7C0F', '#A1A1AA',
    '#27272A', '#BEF264', '#52525B', '#D4D4D8', '#3F3F46'
];
const SERIES_DARK = [
    '#C6FF3D', '#EDEDE8', '#8A8A85', '#84CC16', '#52525B',
    '#C4C4BE', '#ECFCCB', '#6B6B66', '#3F3F46', '#A1A1AA'
];

const readIsDark = (): boolean => {
    if (typeof document === 'undefined') return false;
    const root = document.documentElement;
    return root.classList.contains('dark') || root.getAttribute('data-theme') === 'dark';
};

const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
};

const shortenModelName = (model: string): string => {
    return model
        .replace('gemini-', 'g-')
        .replace('claude-', 'c-')
        .replace('-preview', '')
        .replace('-latest', '');
};

const TokenStats: React.FC = () => {
    const { t } = useTranslation();
    const [timeRange, setTimeRange] = useState<TimeRange>('daily');
    const [viewMode, setViewMode] = useState<ViewMode>('model');
    const [chartData, setChartData] = useState<TokenStatsAggregated[]>([]);
    const [accountData, setAccountData] = useState<AccountTokenStats[]>([]);
    const [modelData, setModelData] = useState<ModelTokenStats[]>([]);
    const [modelTrendData, setModelTrendData] = useState<any[]>([]);
    const [accountTrendData, setAccountTrendData] = useState<any[]>([]);
    const [allModels, setAllModels] = useState<string[]>([]);
    const [allAccounts, setAllAccounts] = useState<string[]>([]);
    const [summary, setSummary] = useState<TokenStatsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDark, setIsDark] = useState<boolean>(readIsDark);

    useEffect(() => {
        const root = document.documentElement;
        const observer = new MutationObserver(() => setIsDark(readIsDark()));
        observer.observe(root, { attributes: true, attributeFilter: ['class', 'data-theme'] });
        return () => observer.disconnect();
    }, []);

    const series = isDark ? SERIES_DARK : SERIES_LIGHT;
    const ink = isDark ? '#EDEDE8' : '#0A0A0A';
    const lime = isDark ? '#C6FF3D' : '#84CC16';
    const muted = isDark ? '#A1A1AA' : '#52525B';
    const greyBar = isDark ? '#6B6B66' : '#A1A1AA';
    const surface = isDark ? '#0A0A0A' : '#FAFAF7';

    const fetchData = async () => {
        setLoading(true);
        try {
            let hours = 24;
            let data: TokenStatsAggregated[] = [];
            let modelTrend: ModelTrendPoint[] = [];
            let accountTrend: AccountTrendPoint[] = [];

            switch (timeRange) {
                case 'hourly':
                    hours = 24;
                    data = await invoke<TokenStatsAggregated[]>('get_token_stats_hourly', { hours: 24 });
                    modelTrend = await invoke<ModelTrendPoint[]>('get_token_stats_model_trend_hourly', { hours: 24 });
                    accountTrend = await invoke<AccountTrendPoint[]>('get_token_stats_account_trend_hourly', { hours: 24 });
                    break;
                case 'daily':
                    hours = 168;
                    data = await invoke<TokenStatsAggregated[]>('get_token_stats_daily', { days: 7 });
                    modelTrend = await invoke<ModelTrendPoint[]>('get_token_stats_model_trend_daily', { days: 7 });
                    accountTrend = await invoke<AccountTrendPoint[]>('get_token_stats_account_trend_daily', { days: 7 });
                    break;
                case 'weekly':
                    hours = 720;
                    data = await invoke<TokenStatsAggregated[]>('get_token_stats_weekly', { weeks: 4 });
                    modelTrend = await invoke<ModelTrendPoint[]>('get_token_stats_model_trend_daily', { days: 30 });
                    accountTrend = await invoke<AccountTrendPoint[]>('get_token_stats_account_trend_daily', { days: 30 });
                    break;
            }

            setChartData(data.map(point => ({
                ...point,
                total_cached_tokens: point.total_cached_tokens || 0,
                uncached_input_tokens: Math.max((point.total_input_tokens || 0) - (point.total_cached_tokens || 0), 0)
            })));

            const models = new Set<string>();
            modelTrend.forEach(point => {
                Object.keys(point.model_data).forEach(m => models.add(m));
            });
            const modelList = Array.from(models);
            setAllModels(modelList);

            const transformedTrend = modelTrend.map(point => {
                const row: Record<string, any> = { period: point.period };
                modelList.forEach(model => {
                    row[model] = point.model_data[model] || 0;
                });
                return row;
            });
            setModelTrendData(transformedTrend);

            // Process Account Trend Data
            const accountsSet = new Set<string>();
            accountTrend.forEach(point => {
                Object.keys(point.account_data).forEach(acc => accountsSet.add(acc));
            });
            const accountList = Array.from(accountsSet);
            setAllAccounts(accountList);

            const transformedAccountTrend = accountTrend.map(point => {
                const row: Record<string, any> = { period: point.period };
                accountList.forEach(acc => {
                    row[acc] = point.account_data[acc] || 0;
                });
                return row;
            });
            setAccountTrendData(transformedAccountTrend);

            const [accounts, models_stats, summaryData] = await Promise.all([
                invoke<AccountTokenStats[]>('get_token_stats_by_account', { hours }),
                invoke<ModelTokenStats[]>('get_token_stats_by_model', { hours }),
                invoke<TokenStatsSummary>('get_token_stats_summary', { hours })
            ]);

            setAccountData(accounts);
            setModelData(models_stats);
            setSummary(summaryData);
        } catch (error) {
            console.error('Failed to fetch token stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [timeRange]);

    const pieData = accountData.slice(0, 8).map((account, index) => ({
        name: account.account_email.split('@')[0] + '...',
        value: account.total_tokens,
        fullEmail: account.account_email,
        color: series[index % series.length]
    }));

    const trendChartContainerRef = useRef<HTMLDivElement>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | undefined>(undefined);

    // Ref and state for pie chart tooltip position
    const pieChartContainerRef = useRef<HTMLDivElement>(null);
    const [pieTooltipPosition, setPieTooltipPosition] = useState<{ x: number; y: number } | undefined>(undefined);

    // Handle mouse move to calculate tooltip position
    const handleTrendChartMouseMove = useCallback((e: any) => {
        if (!trendChartContainerRef.current || !e?.activeCoordinate) return;

        const containerRect = trendChartContainerRef.current.getBoundingClientRect();
        const tooltipWidth = 200; // Approximate tooltip width
        const rightEdgeThreshold = containerRect.width - tooltipWidth - 20; // 20px buffer

        const mouseXInContainer = e.activeCoordinate.x;

        if (mouseXInContainer > rightEdgeThreshold) {
            setTooltipPosition({
                x: e.activeCoordinate.x - tooltipWidth - 15,
                y: e.activeCoordinate.y
            });
        } else {
            setTooltipPosition(undefined); // Use default positioning
        }
    }, []);

    // Handle mouse move for pie chart to calculate tooltip position
    const handlePieChartMouseMove = useCallback((e: any) => {
        if (!pieChartContainerRef.current) return;

        const containerRect = pieChartContainerRef.current.getBoundingClientRect();
        const tooltipWidth = 180; // Approximate tooltip width for pie chart

        // Get mouse position relative to container
        if (e?.activeCoordinate) {
            const mouseXInContainer = e.activeCoordinate.x;
            const rightEdgeThreshold = containerRect.width - tooltipWidth - 20;

            if (mouseXInContainer > rightEdgeThreshold) {
                setPieTooltipPosition({
                    x: e.activeCoordinate.x - tooltipWidth - 15,
                    y: e.activeCoordinate.y
                });
            } else {
                setPieTooltipPosition(undefined);
            }
        }
    }, []);

    // Custom Tooltip for Trend Chart
    const CustomTrendTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;

        // Sort payload by value descending
        const sortedPayload = [...payload].sort((a: any, b: any) => b.value - a.value);

        return (
            <div className="bg-base-100 text-base-content p-2.5 border-2 border-base-content text-xs z-[100] min-w-[180px] pointer-events-none">
                <p className="font-semibold text-base-content mb-1.5 border-b border-base-content/30 pb-1.5">
                    {label}
                </p>
                <div className="max-h-[180px] overflow-y-auto space-y-1 pr-1.5 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                    {sortedPayload.map((entry: any, index: number) => {
                        const name = entry.name;
                        const displayName = viewMode === 'model' ? shortenModelName(name) : name.split('@')[0];
                        return (
                            <div key={index} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className="w-2 h-2 flex-shrink-0" style={{ backgroundColor: entry.color }} />
                                    <span className="text-base-content/60 truncate max-w-[120px]" title={name}>
                                        {displayName}
                                    </span>
                                </div>
                                <span className="font-mono font-medium text-base-content">
                                    {formatNumber(entry.value)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const UsageTrendTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        const row = payload[0]?.payload || {};
        const items = [
            { label: t('token_stats.total', 'Total'), value: row.total_tokens || 0, color: muted },
            { label: t('token_stats.input', 'Input'), value: row.total_input_tokens || 0, color: ink },
            { label: t('token_stats.cached_token', 'Cached token'), value: row.total_cached_tokens || 0, color: greyBar },
            { label: t('token_stats.output', 'Output'), value: row.total_output_tokens || 0, color: lime },
        ];
        return (
            <div className="bg-base-100 text-base-content p-2.5 border-2 border-base-content text-xs z-[100] pointer-events-none min-w-[170px]">
                {label && <p className="font-semibold text-base-content mb-2">{label}</p>}
                <div className="space-y-1">
                    {items.map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2" style={{ backgroundColor: item.color }} />
                                <span className="text-base-content/60">
                                    {item.label}:
                                </span>
                            </div>
                            <span className="font-mono font-medium text-base-content">
                                {formatNumber(item.value)}
                            </span>
                        </div>
                    ))}
                    <div className="flex items-center justify-between gap-4 pt-1 border-t border-base-content/30">
                        <span className="text-base-content/60">
                            {t('token_stats.requests', 'Requests')}:
                        </span>
                        <span className="font-mono font-medium text-base-content">
                            {(row.request_count || 0).toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    // Custom Tooltip for Pie Chart
    const CustomPieTooltip = ({ active, payload }: any) => {
        if (!active || !payload || !payload.length) return null;
        const entry = payload[0];
        return (
            <div className="bg-base-100 text-base-content p-2.5 border-2 border-base-content text-xs z-[100] pointer-events-none">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2" style={{ backgroundColor: entry.payload.color || entry.color }} />
                    <span className="text-base-content/60">
                        {entry.payload.fullEmail || entry.name}:
                    </span>
                    <span className="font-mono font-medium text-base-content">
                        {formatNumber(entry.value)}
                    </span>
                </div>
            </div>
        );
    };

    const joinedBtn = (active: boolean) =>
        `inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] border-2 border-base-content -ml-0.5 first:ml-0 transition-colors ${active
            ? 'bg-base-content text-base-100'
            : 'bg-base-100 text-base-content hover:bg-base-content/10'
        }`;

    const axisTick = { fontSize: 11, fill: muted, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' };
    const formatPeriodTick = (val: string) => {
        if (timeRange === 'hourly') return val.split(' ')[1] || val;
        if (timeRange === 'daily') return val.split('-').slice(1).join('/');
        return val;
    };
    const emptyState = (
        <div className="h-full flex items-center justify-center text-xs font-black uppercase tracking-[0.2em] text-base-content/50">
            {loading ? t('common.loading', 'Loading...') : t('token_stats.no_data', 'No data available')}
        </div>
    );

    const sharePct = (value: number): number => {
        const total = summary?.total_tokens || 0;
        return total > 0 ? (value / total) * 100 : 0;
    };

    const numCell = 'w-20 shrink-0 text-right font-mono tabular-nums';
    const headCell = 'text-[11px] font-black uppercase tracking-[0.16em] text-base-content/60';

    return (
        <div className="h-full w-full overflow-y-auto text-base-content">
            <div className="p-5 max-w-7xl mx-auto">
                <PageHeader
                    kicker="Observability"
                    title={t('nav.token_stats', 'Token Stats')}
                    actions={
                        <>
                            <div className="inline-flex">
                                <button onClick={() => setTimeRange('hourly')} className={joinedBtn(timeRange === 'hourly')}>
                                    <Clock className="w-3.5 h-3.5" />
                                    {t('token_stats.hourly', 'Hour')}
                                </button>
                                <button onClick={() => setTimeRange('daily')} className={joinedBtn(timeRange === 'daily')}>
                                    <Calendar className="w-3.5 h-3.5" />
                                    {t('token_stats.daily', 'Day')}
                                </button>
                                <button onClick={() => setTimeRange('weekly')} className={joinedBtn(timeRange === 'weekly')}>
                                    <CalendarDays className="w-3.5 h-3.5" />
                                    {t('token_stats.weekly', 'Week')}
                                </button>
                            </div>
                            <button
                                onClick={fetchData}
                                disabled={loading}
                                className="inline-flex items-center justify-center p-2 border-2 border-base-content bg-lime-signal text-[#0A0A0A] hover:brightness-95 transition disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </>
                    }
                />

                {summary && (
                    <div className="mt-6">
                        <Ticker
                            items={[
                                { label: t('token_stats.total_tokens', 'Total Tokens'), value: formatNumber(summary.total_tokens) },
                                { label: t('token_stats.input_tokens', 'Input Tokens'), value: formatNumber(summary.total_input_tokens) },
                                { label: t('token_stats.output_tokens', 'Output Tokens'), value: formatNumber(summary.total_output_tokens) },
                                { label: t('token_stats.cached_token', 'Cached token'), value: formatNumber(summary.total_cached_tokens), tone: 'good' },
                            ]}
                        />
                        <div className="border-b-2 border-base-content">
                            <LedgerRow className="px-4">
                                <span className={`flex-1 ${headCell}`}>{t('token_stats.accounts_used', 'Active Accounts')}</span>
                                <span className="text-2xl font-black font-mono tabular-nums">{summary.unique_accounts}</span>
                            </LedgerRow>
                            <LedgerRow className="px-4 border-b-0">
                                <span className={`flex-1 ${headCell}`}>{t('token_stats.models_used', 'Models Used')}</span>
                                <span className="text-2xl font-black font-mono tabular-nums">{modelData.length}</span>
                            </LedgerRow>
                        </div>
                    </div>
                )}

                <SectionRule
                    index="01"
                    label={viewMode === 'model'
                        ? t('token_stats.model_trend', 'Model Usage Trend')
                        : t('token_stats.account_trend', 'Account Usage Trend')
                    }
                    right={
                        <div className="inline-flex">
                            <button onClick={() => setViewMode('model')} className={joinedBtn(viewMode === 'model')}>
                                {t('token_stats.by_model', 'By Model')}
                            </button>
                            <button onClick={() => setViewMode('account')} className={joinedBtn(viewMode === 'account')}>
                                {t('token_stats.by_account_view', 'By Account')}
                            </button>
                        </div>
                    }
                />
                <div className="h-72 w-full text-base-content" ref={trendChartContainerRef}>
                    {modelTrendData.length > 0 && allModels.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={viewMode === 'model' ? modelTrendData : accountTrendData}
                                onMouseMove={handleTrendChartMouseMove}
                                onMouseLeave={() => setTooltipPosition(undefined)}
                            >
                                <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} />
                                <XAxis
                                    dataKey="period"
                                    tick={axisTick}
                                    tickFormatter={formatPeriodTick}
                                    axisLine={{ stroke: ink, strokeWidth: 2 }}
                                    tickLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    tick={axisTick}
                                    tickFormatter={(val) => formatNumber(val)}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    content={<CustomTrendTooltip />}
                                    cursor={{ stroke: ink, strokeWidth: 1, strokeDasharray: '4 4', fill: 'transparent' }}
                                    allowEscapeViewBox={{ x: true, y: true }}
                                    position={tooltipPosition}
                                    wrapperStyle={{ zIndex: 100 }}
                                />
                                <Legend
                                    iconType="square"
                                    iconSize={9}
                                    formatter={(value) => viewMode === 'model' ? shortenModelName(value) : value.split('@')[0]}
                                    wrapperStyle={{
                                        fontSize: '11px',
                                        paddingTop: '10px',
                                        maxHeight: '60px',
                                        overflowY: 'auto',
                                        zIndex: 0
                                    }}
                                />
                                {(viewMode === 'model' ? allModels : allAccounts).map((item, index) => (
                                    <Area
                                        key={item}
                                        type="linear"
                                        dataKey={item}
                                        stackId="1"
                                        stroke={surface}
                                        strokeWidth={1}
                                        fill={series[index % series.length]}
                                        fillOpacity={0.9}
                                    />
                                ))}
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : emptyState}
                </div>

                <SectionRule index="02" label={t('token_stats.usage_trend', 'Token Usage Trend')} />
                <div className="h-72 w-full text-base-content">
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} />
                                <XAxis
                                    dataKey="period"
                                    tick={axisTick}
                                    tickFormatter={formatPeriodTick}
                                    axisLine={{ stroke: ink, strokeWidth: 2 }}
                                    tickLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    tick={axisTick}
                                    tickFormatter={(val) => formatNumber(val)}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    content={<UsageTrendTooltip />}
                                    cursor={{ fill: ink, fillOpacity: 0.06 }}
                                    allowEscapeViewBox={{ x: true, y: true }}
                                    wrapperStyle={{ zIndex: 100 }}
                                />
                                <Bar dataKey="total_cached_tokens" name={t('token_stats.cached_token', 'Cached token')} stackId="input" fill={greyBar} radius={0} maxBarSize={50} />
                                <Bar dataKey="uncached_input_tokens" name={t('token_stats.input', 'Input')} stackId="input" fill={ink} radius={0} maxBarSize={50} />
                                <Bar dataKey="total_output_tokens" name={t('token_stats.output', 'Output')} fill={lime} radius={0} maxBarSize={50} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : emptyState}
                </div>

                <SectionRule index="03" label={t('token_stats.by_account', 'By Account')} />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-8 gap-y-4 items-center">
                    <div className="h-52 text-base-content" ref={pieChartContainerRef}>
                        {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart
                                    onMouseMove={handlePieChartMouseMove}
                                    onMouseLeave={() => setPieTooltipPosition(undefined)}
                                >
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={44}
                                        outerRadius={80}
                                        paddingAngle={0}
                                        stroke={surface}
                                        strokeWidth={2}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        content={<CustomPieTooltip />}
                                        allowEscapeViewBox={{ x: true, y: true }}
                                        position={pieTooltipPosition}
                                        wrapperStyle={{ zIndex: 100 }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : emptyState}
                    </div>
                    <div className="lg:col-span-2 border-t-2 border-base-content max-h-52 overflow-y-auto">
                        {accountData.slice(0, 5).map((account, index) => {
                            const pct = sharePct(account.total_tokens);
                            return (
                                <LedgerRow key={account.account_email}>
                                    <span className="w-3 h-3 shrink-0" style={{ backgroundColor: series[index % series.length] }} />
                                    <span className="flex-1 min-w-0 truncate text-sm font-bold" title={account.account_email}>
                                        {account.account_email.split('@')[0]}
                                    </span>
                                    <div className="w-32 shrink-0 hidden sm:block">
                                        <SegmentBar percent={pct} tone={index === 0 ? 'lime' : 'ink'} />
                                    </div>
                                    <span className="w-14 shrink-0 text-right font-mono tabular-nums text-xs text-base-content/60">
                                        {pct.toFixed(1)}%
                                    </span>
                                    <span className="w-16 shrink-0 text-right font-mono tabular-nums font-black">
                                        {formatNumber(account.total_tokens)}
                                    </span>
                                </LedgerRow>
                            );
                        })}
                    </div>
                </div>

                {modelData.length > 0 && viewMode === 'model' && (
                    <>
                        <SectionRule index="04" label={t('token_stats.model_details', 'Model Breakdown')} />
                        <div className="overflow-x-auto">
                            <div className="min-w-[760px] border-t-2 border-base-content">
                                <LedgerRow className="border-b-2 border-base-content">
                                    <span className={`flex-1 min-w-0 ${headCell}`}>{t('token_stats.model', 'Model')}</span>
                                    <span className={`${numCell} ${headCell}`}>{t('token_stats.requests', 'Requests')}</span>
                                    <span className={`${numCell} ${headCell}`}>{t('token_stats.input', 'Input')}</span>
                                    <span className={`${numCell} ${headCell}`}>{t('token_stats.output', 'Output')}</span>
                                    <span className={`${numCell} ${headCell}`}>{t('token_stats.cached_token', 'Cached token')}</span>
                                    <span className={`${numCell} ${headCell}`}>{t('token_stats.total', 'Total')}</span>
                                    <span className={`w-44 shrink-0 text-right ${headCell}`}>{t('token_stats.percentage', 'Share')}</span>
                                </LedgerRow>
                                {modelData.map((model, index) => {
                                    const pct = sharePct(model.total_tokens);
                                    return (
                                        <LedgerRow key={model.model} className="hover:bg-base-content/5">
                                            <div className="flex-1 min-w-0 flex items-center gap-2">
                                                <span className="w-3 h-3 shrink-0" style={{ backgroundColor: series[index % series.length] }} />
                                                <span className="truncate text-sm font-bold" title={model.model}>{model.model}</span>
                                            </div>
                                            <span className={`${numCell} text-sm`}>{model.request_count.toLocaleString()}</span>
                                            <span className={`${numCell} text-sm`}>{formatNumber(model.total_input_tokens)}</span>
                                            <span className={`${numCell} text-sm`}>{formatNumber(model.total_output_tokens)}</span>
                                            <span className={`${numCell} text-sm text-base-content/60`}>{formatNumber(model.total_cached_tokens)}</span>
                                            <span className={`${numCell} text-sm font-black`}>{formatNumber(model.total_tokens)}</span>
                                            <div className="w-44 shrink-0 flex items-center justify-end gap-2">
                                                <div className="w-24">
                                                    <SegmentBar percent={pct} tone={index === 0 ? 'lime' : 'ink'} />
                                                </div>
                                                <span className="w-12 text-right font-mono tabular-nums text-xs text-base-content/70">
                                                    {pct.toFixed(1)}%
                                                </span>
                                            </div>
                                        </LedgerRow>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {accountData.length > 0 && viewMode === 'account' && (
                    <>
                        <SectionRule index="04" label={t('token_stats.account_details', 'Account Breakdown')} />
                        <div className="overflow-x-auto">
                            <div className="min-w-[760px] border-t-2 border-base-content">
                                <LedgerRow className="border-b-2 border-base-content">
                                    <span className={`flex-1 min-w-0 ${headCell}`}>{t('token_stats.account', 'Account')}</span>
                                    <span className={`${numCell} ${headCell}`}>{t('token_stats.requests', 'Requests')}</span>
                                    <span className={`${numCell} ${headCell}`}>{t('token_stats.input', 'Input')}</span>
                                    <span className={`${numCell} ${headCell}`}>{t('token_stats.output', 'Output')}</span>
                                    <span className={`${numCell} ${headCell}`}>{t('token_stats.cached_token', 'Cached token')}</span>
                                    <span className={`${numCell} ${headCell}`}>{t('token_stats.total', 'Total')}</span>
                                    <span className={`w-44 shrink-0 text-right ${headCell}`}>{t('token_stats.percentage', 'Share')}</span>
                                </LedgerRow>
                                {accountData.map((account, index) => {
                                    const pct = sharePct(account.total_tokens);
                                    return (
                                        <LedgerRow key={account.account_email} className="hover:bg-base-content/5">
                                            <span className="flex-1 min-w-0 truncate text-sm font-bold" title={account.account_email}>
                                                {account.account_email}
                                            </span>
                                            <span className={`${numCell} text-sm`}>{account.request_count.toLocaleString()}</span>
                                            <span className={`${numCell} text-sm`}>{formatNumber(account.total_input_tokens)}</span>
                                            <span className={`${numCell} text-sm`}>{formatNumber(account.total_output_tokens)}</span>
                                            <span className={`${numCell} text-sm text-base-content/60`}>{formatNumber(account.total_cached_tokens)}</span>
                                            <span className={`${numCell} text-sm font-black`}>{formatNumber(account.total_tokens)}</span>
                                            <div className="w-44 shrink-0 flex items-center justify-end gap-2">
                                                <div className="w-24">
                                                    <SegmentBar percent={pct} tone={index === 0 ? 'lime' : 'ink'} />
                                                </div>
                                                <span className="w-12 text-right font-mono tabular-nums text-xs text-base-content/70">
                                                    {pct.toFixed(1)}%
                                                </span>
                                            </div>
                                        </LedgerRow>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TokenStats;
