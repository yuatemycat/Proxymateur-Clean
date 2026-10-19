import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import ModalDialog from '../common/ModalDialog';
import { useTranslation } from 'react-i18next';
import { request as invoke } from '../../utils/request';
import { Trash2, Search, X, Copy, CheckCircle, ChevronLeft, ChevronRight, ChevronDown, RefreshCw, User, Clock, Settings, HardDrive, Check, FileWarning } from 'lucide-react';
import { PageHeader, Chip, SectionRule, Ticker } from '../common/ledger';

import { AppConfig, ExperimentalConfig } from '../../types/config';
import { formatCompactNumber } from '../../utils/format';
import { useAccountStore } from '../../stores/useAccountStore';
import { isTauri } from '../../utils/env';
import { copyToClipboard } from '../../utils/clipboard';
import { VirtualizedPayloadViewer } from './VirtualizedPayloadViewer';
import { extractConcisePayload } from './concisePayload';
import { LogDetailHeader, LogSummaryStrip, LogToolbar, LogOverview, type DetailTab } from './LogDetail';


interface ProxyRequestLog {
    id: string;
    timestamp: number;
    method: string;
    url: string;
    status: number;
    duration: number;
    model?: string;
    mapped_model?: string;
    error?: string;
    request_body?: string;
    upstream_request_body?: string;
    response_body?: string;
    request_headers?: string;
    upstream_request_headers?: string;
    response_headers?: string;
    input_tokens?: number;
    output_tokens?: number;
    cached_tokens?: number;
    account_email?: string;
    protocol?: string;  // "openai" | "anthropic" | "gemini"
}

interface ProxyStats {
    total_requests: number;
    success_count: number;
    error_count: number;
}

interface ProxyMonitorProps {
    className?: string;
}

// Log Table Component
interface LogTableProps {
    logs: ProxyRequestLog[];
    loading: boolean;
    onLogClick: (log: ProxyRequestLog) => void;
    t: any;
}

interface ColumnWidths {
    status: number;
    method: number;
    model: number;
    protocol: number;
    account: number;
    path: number;
    usage: number;
    duration: number;
    time: number;
}

const DEFAULT_COL_WIDTHS: ColumnWidths = {
    status: 65,
    method: 65,
    model: 240,
    protocol: 80,
    account: 150,
    path: 180,
    usage: 125,
    duration: 85,
    time: 85,
};

const LogTable: React.FC<LogTableProps> = ({
    logs,
    loading,
    onLogClick,
    t
}) => {
    const [colWidths, setColWidths] = useState<ColumnWidths>(() => {
        try {
            const saved = localStorage.getItem('proxy_log_col_widths');
            if (saved) {
                return { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) };
            }
        } catch {}
        return DEFAULT_COL_WIDTHS;
    });

    // 类似 Excel 的鼠标拖拽调整表头列宽机制
    const handleResizeStart = (colKey: keyof ColumnWidths, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startWidth = colWidths[colKey];

        const originalCursor = document.body.style.cursor;
        const originalUserSelect = document.body.style.userSelect;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMouseMove = (moveEvent: MouseEvent) => {
            const diff = moveEvent.clientX - startX;
            const newWidth = Math.max(45, startWidth + diff);
            setColWidths((prev) => ({
                ...prev,
                [colKey]: newWidth,
            }));
        };

        const onMouseUp = (upEvent: MouseEvent) => {
            document.body.style.cursor = originalCursor;
            document.body.style.userSelect = originalUserSelect;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);

            const finalDiff = upEvent.clientX - startX;
            const finalWidth = Math.max(45, startWidth + finalDiff);
            setColWidths((prev) => {
                const next = { ...prev, [colKey]: finalWidth };
                try {
                    localStorage.setItem('proxy_log_col_widths', JSON.stringify(next));
                } catch {}
                return next;
            });
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    // Persist widths as they change (debounced), not only on mouse-up, so a resize is never lost.
    useEffect(() => {
        const id = window.setTimeout(() => {
            try {
                localStorage.setItem('proxy_log_col_widths', JSON.stringify(colWidths));
            } catch {}
        }, 250);
        return () => window.clearTimeout(id);
    }, [colWidths]);

    const resetColumnWidth = (colKey: keyof ColumnWidths) => {
        setColWidths((prev) => ({ ...prev, [colKey]: DEFAULT_COL_WIDTHS[colKey] }));
    };

    const totalTableWidth = useMemo(() => {
        return Object.values(colWidths).reduce((a, b) => a + b, 0);
    }, [colWidths]);

    const columns: { key: keyof ColumnWidths; label: string; right?: boolean }[] = [
        { key: 'status', label: t('monitor.table.status') },
        { key: 'method', label: t('monitor.table.method') },
        { key: 'model', label: t('monitor.table.model_route', 'Model (requested › routed)') },
        { key: 'protocol', label: t('monitor.table.protocol') },
        { key: 'account', label: t('monitor.table.account') },
        { key: 'path', label: t('monitor.table.path') },
        { key: 'usage', label: t('monitor.table.usage'), right: true },
        { key: 'duration', label: t('monitor.table.duration'), right: true },
        { key: 'time', label: t('monitor.table.time'), right: true },
    ];

    return (
        <div
            className="flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-base-100 relative scrollbar-thin border-2 border-base-content"
        >
            <table
                className="table table-sm border-separate border-spacing-0"
                style={{ minWidth: `${totalTableWidth}px`, width: `${totalTableWidth}px`, tableLayout: 'fixed' }}
            >
                <thead className="bg-base-200 text-base-content sticky top-0 z-10">
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                style={{ width: `${colWidths[col.key]}px`, minWidth: `${colWidths[col.key]}px`, maxWidth: `${colWidths[col.key]}px` }}
                                className={`py-2 px-3 relative group select-none bg-base-200 border-b-4 border-base-content text-[11px] font-black uppercase tracking-[0.14em] ${col.right ? 'text-right whitespace-nowrap' : 'text-left'}`}
                            >
                                <div className="truncate">{col.label}</div>
                                <div
                                    onMouseDown={(e) => handleResizeStart(col.key, e)}
                                    onDoubleClick={() => resetColumnWidth(col.key)}
                                    className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize z-20 before:absolute before:right-1 before:top-2 before:bottom-2 before:w-px before:bg-base-content/20 hover:before:w-0.5 hover:before:bg-lime-signal active:before:bg-lime-signal"
                                    title="Drag to resize · double-click to reset"
                                />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="font-mono text-base-content text-xs">
                    {logs.map((log) => (
                        <tr
                            key={log.id}
                            className={`cursor-pointer transition-colors hover:bg-base-200 [&>td]:border-b [&>td]:border-base-content/15 [&>td:first-child]:border-l-4 ${
                                log.status >= 400
                                    ? '[&>td:first-child]:border-red-600'
                                    : '[&>td:first-child]:border-transparent hover:[&>td:first-child]:border-lime-signal'
                            }`}
                            onClick={() => onLogClick(log)}
                        >
                            <td style={{ width: `${colWidths.status}px`, maxWidth: `${colWidths.status}px` }} className="py-2 px-3 truncate">
                                <Chip tone={log.status >= 200 && log.status < 400 ? 'lime' : 'bad'}>
                                    <span className="tabular-nums">{log.status}</span>
                                </Chip>
                            </td>
                            <td className="font-black uppercase tracking-wide text-base-content py-2 px-3 truncate" style={{ width: `${colWidths.method}px`, maxWidth: `${colWidths.method}px` }}>{log.method}</td>
                            <td
                                className="text-base-content font-medium py-2 px-3 align-middle"
                                style={{ width: `${colWidths.model}px`, maxWidth: `${colWidths.model}px` }}
                                title={log.mapped_model && log.model !== log.mapped_model ? `${log.model} › ${log.mapped_model}` : (log.model || '')}
                            >
                                {log.mapped_model && log.model !== log.mapped_model ? (
                                    // requested › routed: wraps onto a second line when the column is narrow, never cut off
                                    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 break-all leading-snug">
                                        <span>{log.model || '-'}</span>
                                        <span className="text-base-content/40 select-none">›</span>
                                        <span className="text-emerald-600 dark:text-emerald-400">{log.mapped_model}</span>
                                    </div>
                                ) : (
                                    <div className="break-all leading-snug">{log.model || '-'}</div>
                                )}
                            </td>
                            <td style={{ width: `${colWidths.protocol}px`, maxWidth: `${colWidths.protocol}px` }} className="py-2 px-3 truncate">
                                {log.protocol && (
                                    <span className="inline-block border border-base-content/60 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider leading-none text-base-content">
                                        {log.protocol === 'openai' ? 'OpenAI' :
                                            log.protocol === 'anthropic' ? 'Claude' :
                                                log.protocol === 'gemini' ? 'Gemini' : log.protocol}
                                    </span>
                                )}
                            </td>
                            <td className="text-base-content/70 font-sans truncate text-xs py-2 px-3" style={{ width: `${colWidths.account}px`, maxWidth: `${colWidths.account}px` }} title={log.account_email || ''}>
                                {log.account_email ? log.account_email.replace(/(.{3}).*(@.*)/, '$1***$2') : '-'}
                            </td>
                            <td className="text-base-content/80 truncate text-xs py-2 px-3" style={{ width: `${colWidths.path}px`, maxWidth: `${colWidths.path}px` }} title={log.url || ''}>{log.url}</td>
                            <td className="text-right text-xs py-2 px-3 whitespace-nowrap truncate tabular-nums" style={{ width: `${colWidths.usage}px`, maxWidth: `${colWidths.usage}px` }}>
                                {log.input_tokens != null && (() => {
                                    const totalIn = (log.cached_tokens && log.cached_tokens > log.input_tokens)
                                        ? log.input_tokens + log.cached_tokens
                                        : log.input_tokens;
                                    const hitRate = (log.cached_tokens && totalIn > 0)
                                        ? Math.min(100, Math.max(0, (log.cached_tokens / totalIn) * 100))
                                        : 0;
                                    const hitRateText = totalIn > 0 && log.cached_tokens
                                        ? (hitRate >= 100 ? '100%' : (hitRate % 1 === 0 ? `${hitRate.toFixed(0)}%` : `${hitRate.toFixed(1)}%`))
                                        : '';
                                    return (
                                        <div>
                                            <div className="text-base-content">{t('monitor.input')}: <span className="font-bold">{formatCompactNumber(totalIn)}</span></div>
                                            {log.cached_tokens ? (
                                                <div
                                                    className="text-base-content/60 font-semibold text-[11px] leading-tight"
                                                    title={`${t('token_stats.cached', 'Cache')}: ${log.cached_tokens.toLocaleString()}${hitRateText ? ` (${hitRateText})` : ''}`}
                                                >
                                                    ({t('monitor.cached', 'Cache')}: {formatCompactNumber(log.cached_tokens)}{hitRateText ? ` ${hitRateText}` : ''})
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })()}
                                {log.output_tokens != null && <div className="text-base-content">{t('monitor.output')}: <span className="font-bold">{formatCompactNumber(log.output_tokens)}</span></div>}
                            </td>
                            <td className="text-right text-base-content text-xs font-bold tabular-nums py-2 px-3 truncate" style={{ width: `${colWidths.duration}px`, maxWidth: `${colWidths.duration}px` }}>{log.duration}ms</td>
                            <td className="text-right text-base-content/60 text-xs tabular-nums py-2 px-3 truncate" style={{ width: `${colWidths.time}px`, maxWidth: `${colWidths.time}px` }}>
                                {new Date(log.timestamp).toLocaleTimeString()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Loading indicator */}
            {loading && (
                <div className="flex items-center justify-center p-4 bg-base-100">
                    <div className="loading loading-spinner loading-md text-base-content"></div>
                    <span className="ml-3 text-xs font-black uppercase tracking-[0.2em] text-base-content/60">{t('common.loading')}</span>
                </div>
            )}

            {/* Empty state */}
            {!loading && logs.length === 0 && (
                <div className="flex items-center justify-center p-8 text-base-content/50 text-xs font-black uppercase tracking-[0.2em]">
                    {t('monitor.table.empty') || 'No requests recorded'}
                </div>
            )}
        </div>
    );
};



interface StageTimingInfo {
    cleanSec?: number;
    normSec?: number;
    thinkingSec?: number;
    ttftSec?: number;
    streamSec?: number;
    totalSec?: number;
    isOldRecordWithoutStages?: boolean;
}

const parseTimingFromHeadersAndBody = (
    headersJson?: string,
    responseBody?: string,
    durationMs?: number
): StageTimingInfo | null => {
    let cleanSec: number | undefined;
    let normSec: number | undefined;
    let thinkingSec: number | undefined;
    let ttftSec: number | undefined;
    let streamSec: number | undefined;
    let totalSec: number | undefined;

    // 1. Check if responseBody has _timing object
    if (responseBody) {
        try {
            const bodyObj = JSON.parse(responseBody);
            if (bodyObj && typeof bodyObj === 'object' && bodyObj._timing) {
                const t = bodyObj._timing;
                if (typeof t.clean_s === 'number') cleanSec = t.clean_s;
                else if (typeof t.clean_ms === 'number') cleanSec = t.clean_ms / 1000;

                if (typeof t.norm_s === 'number') normSec = t.norm_s;
                else if (typeof t.norm_ms === 'number') normSec = t.norm_ms / 1000;

                if (typeof t.thinking_s === 'number') thinkingSec = t.thinking_s;
                else if (typeof t.thinking_ms === 'number') thinkingSec = t.thinking_ms / 1000;

                if (typeof t.ttft_s === 'number') ttftSec = t.ttft_s;
                else if (typeof t.ttft_ms === 'number') ttftSec = t.ttft_ms / 1000;

                if (typeof t.stream_s === 'number') streamSec = t.stream_s;
                else if (typeof t.stream_ms === 'number') streamSec = t.stream_ms / 1000;

                if (typeof t.total_s === 'number') totalSec = t.total_s;
                else if (typeof t.total_ms === 'number') totalSec = t.total_ms / 1000;
            }
        } catch {}
    }

    // 2. Parse from headersJson if any are still missing
    if (headersJson) {
        try {
            const headersObj = JSON.parse(headersJson);
            if (headersObj && typeof headersObj === 'object') {
                const getVal = (key: string): number | undefined => {
                    const matchKey = Object.keys(headersObj).find(
                        (k) => k.toLowerCase() === key.toLowerCase()
                    );
                    if (!matchKey) return undefined;
                    const v = headersObj[matchKey];
                    if (typeof v === 'number') return v;
                    if (typeof v === 'string') {
                        const parsed = parseFloat(v);
                        return isNaN(parsed) ? undefined : parsed;
                    }
                    if (Array.isArray(v) && v.length > 0) {
                        const parsed = parseFloat(String(v[0]));
                        return isNaN(parsed) ? undefined : parsed;
                    }
                    return undefined;
                };

                if (cleanSec === undefined) {
                    const ms = getVal('x-timing-clean-ms');
                    if (ms !== undefined) cleanSec = ms / 1000;
                }
                if (normSec === undefined) {
                    const ms = getVal('x-timing-norm-ms');
                    if (ms !== undefined) normSec = ms / 1000;
                }
                if (thinkingSec === undefined) {
                    const ms = getVal('x-timing-thinking-ms');
                    if (ms !== undefined) thinkingSec = ms / 1000;
                }
                if (ttftSec === undefined) {
                    const ms = getVal('x-timing-ttft-ms');
                    if (ms !== undefined) ttftSec = ms / 1000;
                }
                if (streamSec === undefined) {
                    const ms = getVal('x-timing-stream-ms');
                    if (ms !== undefined) streamSec = ms / 1000;
                }
                if (totalSec === undefined) {
                    const ms = getVal('x-timing-total-ms');
                    if (ms !== undefined) totalSec = ms / 1000;
                }
            }
        } catch {}
    }

    // 3. Fallback for totalSec if durationMs exists
    if (totalSec === undefined && durationMs !== undefined && durationMs > 0) {
        totalSec = durationMs / 1000;
    }

    // If we have neither totalSec nor any stages, return null
    if (totalSec === undefined && cleanSec === undefined && ttftSec === undefined) {
        return null;
    }

    const isOldRecordWithoutStages =
        cleanSec === undefined &&
        normSec === undefined &&
        thinkingSec === undefined &&
        ttftSec === undefined;

    return {
        cleanSec,
        normSec,
        thinkingSec,
        ttftSec,
        streamSec,
        totalSec,
        isOldRecordWithoutStages,
    };
};

const formatSeconds = (sec?: number): string => {
    if (sec === undefined || sec === null || isNaN(sec)) return '-';
    if (sec < 0.001) {
        return `${sec.toFixed(4)}s`;
    }
    if (sec < 1) {
        return `${sec.toFixed(3)}s`;
    }
    return `${sec.toFixed(2)}s`;
};

interface TimingDiagnosticsCardProps {
    timing: StageTimingInfo;
    onCopyText: (text: string) => void;
}

const TimingDiagnosticsCard: React.FC<TimingDiagnosticsCardProps> = ({ timing, onCopyText }) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    const totalSec = timing.totalSec || 0;

    const stages = useMemo(() => [
        {
            key: 'clean',
            label: t('monitor.timing.clean', 'Initial Session Clean'),
            desc: t('monitor.timing.clean_desc', 'Cache control stripping / message deduplication / purification'),
            sec: timing.cleanSec,
            color: 'bg-indigo-500',
            textColor: 'text-indigo-600 dark:text-indigo-400',
        },
        {
            key: 'norm',
            label: t('monitor.timing.norm', 'Normalization & Transit'),
            desc: t('monitor.timing.norm_desc', 'Model routing / account scheduling / Gemini format conversion'),
            sec: timing.normSec,
            color: 'bg-purple-500',
            textColor: 'text-purple-600 dark:text-purple-400',
        },
        {
            key: 'thinking',
            label: t('monitor.timing.thinking', 'Thinking & Signature Fill'),
            desc: t('monitor.timing.thinking_desc', 'ThinkingStore hydration / sentinel signature injection'),
            sec: timing.thinkingSec,
            color: 'bg-amber-500',
            textColor: 'text-amber-600 dark:text-amber-400',
        },
        {
            key: 'ttft',
            label: t('monitor.timing.ttft', 'Time To First Token (TTFT)'),
            desc: t('monitor.timing.ttft_desc', 'Gateway dispatch to first thinking/tool/content SSE chunk'),
            sec: timing.ttftSec,
            color: 'bg-emerald-500',
            textColor: 'text-emerald-600 dark:text-emerald-400',
        },
        {
            key: 'stream',
            label: t('monitor.timing.stream', 'Stream Transfer Duration'),
            desc: t('monitor.timing.stream_desc', 'First chunk arrival to stream completion'),
            sec: timing.streamSec,
            color: 'bg-sky-500',
            textColor: 'text-sky-600 dark:text-sky-400',
        },
    ], [timing, t]);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        const lines: string[] = [];
        if (timing.cleanSec !== undefined) lines.push(`Session Clean: ${formatSeconds(timing.cleanSec)}`);
        if (timing.normSec !== undefined) lines.push(`Normalize: ${formatSeconds(timing.normSec)}`);
        if (timing.thinkingSec !== undefined) lines.push(`ThinkingStore: ${formatSeconds(timing.thinkingSec)}`);
        if (timing.ttftSec !== undefined) lines.push(`Time To First Token (TTFT): ${formatSeconds(timing.ttftSec)}`);
        if (timing.streamSec !== undefined) lines.push(`Stream: ${formatSeconds(timing.streamSec)}`);
        lines.push(`Total: ${formatSeconds(timing.totalSec)}`);

        onCopyText(lines.join('\n'));
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    if (timing.isOldRecordWithoutStages) {
        return (
            <div className="mb-3 rounded-none overflow-hidden border-2 border-base-content bg-base-200">
                <div className="px-3 py-2 bg-gray-200/60 dark:bg-base-200 border-b border-gray-200 dark:border-base-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock size={13} className="text-gray-500 dark:text-gray-400 shrink-0" />
                        <span className="text-xs font-bold tracking-wider text-gray-700 dark:text-gray-200 shrink-0 whitespace-nowrap">
                            {t('monitor.timing.title', 'Stage Timing Diagnostics')}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                            {t('monitor.timing.total', 'Total Duration')}: {formatSeconds(timing.totalSec)}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mb-3 rounded-none overflow-hidden border-2 border-base-content bg-base-100">
            {/* Card Header */}
            <div
                className={`px-3 py-2 bg-emerald-500/10 dark:bg-emerald-950/30 flex items-center justify-between gap-2 select-none cursor-pointer hover:bg-emerald-500/15 transition-colors ${
                    isExpanded ? 'border-b border-emerald-500/20' : ''
                }`}
                onClick={() => setIsExpanded((prev) => !prev)}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <Clock size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-xs font-bold tracking-wider text-emerald-950 dark:text-emerald-100 shrink-0 whitespace-nowrap">
                        {t('monitor.timing.title', 'Stage Timing Diagnostics')}
                    </span>
                    {!isExpanded && totalSec > 0 && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                            {t('monitor.timing.total', 'Total Duration')}: {formatSeconds(timing.totalSec)}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="btn btn-ghost btn-xs h-6 px-2 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/15 text-[11px] font-semibold gap-1"
                        title={isCopied ? t('common.copied', 'Copied to clipboard') : t('common.copy', 'Copy')}
                    >
                        {isCopied ? <CheckCircle size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        <span>{isCopied ? t('common.copied', 'Copied to clipboard') : t('common.copy', 'Copy')}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsExpanded((prev) => !prev)}
                        className="btn btn-ghost btn-xs p-1 h-6 min-h-0 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/15"
                        title={isExpanded ? 'Collapse timing diagnostics' : 'Expand timing diagnostics'}
                    >
                        <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                    </button>
                </div>
            </div>

            {/* Expandable Body */}
            {isExpanded && (
                <div className="p-3 space-y-2.5 font-mono text-xs">
                    {/* Multi-stage Stacked Progress Bar */}
                    {totalSec > 0 && (
                        <div className="space-y-1">
                            <div className="h-2 w-full bg-base-200 rounded-none flex overflow-hidden">
                                {stages.map((st) => {
                                    if (st.sec === undefined || st.sec <= 0) return null;
                                    const pct = Math.min(100, Math.max(0.5, (st.sec / totalSec) * 100));
                                    return (
                                        <div
                                            key={st.key}
                                            style={{ width: `${pct}%` }}
                                            className={`${st.color} h-full transition-all duration-300 relative group`}
                                            title={`${st.label}: ${formatSeconds(st.sec)} (${((st.sec / totalSec) * 100).toFixed(1)}%)`}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Stage Metrics Grid */}
                    <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                        {stages.map((st) => {
                            const hasVal = st.sec !== undefined;
                            const pct = hasVal && totalSec > 0 ? ((st.sec! / totalSec) * 100).toFixed(1) : undefined;
                            return (
                                <div
                                    key={st.key}
                                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-none bg-base-100 border border-base-content/30 hover:border-base-content transition-colors"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className={`w-2.5 h-2.5 ${st.color} shrink-0`} />
                                        <div className="min-w-0">
                                            <span className="font-bold text-gray-900 dark:text-white truncate block text-xs">
                                                {st.label}
                                            </span>
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate block">
                                                {st.desc}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-baseline gap-2 shrink-0 text-right font-mono">
                                        <span className={`text-xs font-black ${hasVal ? st.textColor : 'text-gray-400'}`}>
                                            {formatSeconds(st.sec)}
                                        </span>
                                        {pct !== undefined && (
                                            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 w-11 text-right">
                                                {pct}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Total Duration Row */}
                        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-none bg-lime-signal text-[#0A0A0A] border-2 border-base-content font-bold">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2.5 h-2.5 bg-[#0A0A0A] shrink-0" />
                                <span className="text-[#0A0A0A] text-xs font-bold">
                                    {t('monitor.timing.total', 'Total Duration')}
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2 shrink-0 text-right font-mono">
                                <span className="text-sm font-black text-[#0A0A0A]">
                                    {formatSeconds(timing.totalSec)}
                                </span>
                                <span className="text-[11px] text-[#0A0A0A]/70 w-11 text-right font-bold">
                                    100%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};



export const ProxyMonitor: React.FC<ProxyMonitorProps> = ({ className }) => {
    const { t } = useTranslation();
    const [logs, setLogs] = useState<ProxyRequestLog[]>([]);
    const [stats, setStats] = useState<ProxyStats>({ total_requests: 0, success_count: 0, error_count: 0 });
    const [filter, setFilter] = useState('');
    const [accountFilter, setAccountFilter] = useState('');
    // [FIX] 使用 ref 存储最新的筛选条件，避免 setInterval 闭包问题
    const filterRef = useRef(filter);
    const accountFilterRef = useRef(accountFilter);
    const currentPageRef = useRef(1);
    const globalFilterInputRef = useRef<HTMLInputElement>(null);
    const [selectedLog, setSelectedLog] = useState<ProxyRequestLog | null>(null);
    const [isLoggingEnabled, setIsLoggingEnabled] = useState(false);
    const [captureHealthLogs, setCaptureHealthLogs] = useState(false);
    const [internalErrorLogPath, setInternalErrorLogPath] = useState('');
    const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
    const [payloadViewMode, setPayloadViewMode] = useState<'concise' | 'full'>('concise');
    const [showMetadata, setShowMetadata] = useState(true);
    const [copiedCard, setCopiedCard] = useState<string | null>(null);
    // Request detail modal: active tab, and which payload tabs have been opened (kept mounted once visited
    // so each viewer keeps its search / wrap / scroll state while switching tabs).
    const [detailTab, setDetailTab] = useState<DetailTab>('overview');
    const [visitedTabs, setVisitedTabs] = useState<DetailTab[]>(['overview']);
    const openDetailTab = (tab: DetailTab) => {
        setDetailTab(tab);
        setVisitedTabs((prev) => (prev.includes(tab) ? prev : [...prev, tab]));
    };
    useEffect(() => {
        setDetailTab('overview');
        setVisitedTabs(['overview']);
    }, [selectedLog?.id]);

    // 日志存储与维护配置状态
    const [showLogSettings, setShowLogSettings] = useState(false);
    const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isClearCacheModalOpen, setIsClearCacheModalOpen] = useState(false);
    const [cacheClearedSuccess, setCacheClearedSuccess] = useState(false);
    const [dbDiskSizeBytes, setDbDiskSizeBytes] = useState<number | null>(null);
    const [errorLogDiskSizeBytes, setErrorLogDiskSizeBytes] = useState<number | null>(null);

    const fetchDbDiskSize = useCallback(async () => {
        try {
            const bytes = await invoke<number>('get_proxy_db_disk_size');
            setDbDiskSizeBytes(bytes);
        } catch (e) {
            console.error('Failed to get proxy db disk size', e);
        }
    }, []);

    const fetchErrorLogDiskSize = useCallback(async () => {
        try {
            const bytes = await invoke<number>('get_internal_error_log_disk_size');
            setErrorLogDiskSizeBytes(bytes);
        } catch (e) {
            console.error('Failed to get internal error log disk size', e);
        }
    }, []);

    useEffect(() => {
        if (showLogSettings) {
            fetchDbDiskSize();
            fetchErrorLogDiskSize();
        }
    }, [showLogSettings, fetchDbDiskSize, fetchErrorLogDiskSize]);

    useEffect(() => {
        invoke<string>('get_internal_error_log_path')
            .then((path) => setInternalErrorLogPath(path))
            .catch((e) => console.error('Failed to get internal error log path', e));
    }, []);

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    };

    // 全局快捷键 Ctrl+F：当焦点在报文卡片之外时，聚焦主界面的全局过滤搜索框
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
                const activeEl = document.activeElement;
                if (activeEl && activeEl.closest('.payload-viewer-card')) {
                    return;
                }
                e.preventDefault();
                globalFilterInputRef.current?.focus();
                globalFilterInputRef.current?.select();
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    const conciseRequestBody = useMemo(() => {
        return selectedLog?.request_body
            ? extractConcisePayload(selectedLog.request_body, 'request', selectedLog)
            : '';
    }, [selectedLog?.request_body, selectedLog?.id]);

    const conciseUpstreamBody = useMemo(() => {
        return selectedLog?.upstream_request_body
            ? extractConcisePayload(selectedLog.upstream_request_body, 'upstream', selectedLog)
            : '';
    }, [selectedLog?.upstream_request_body, selectedLog?.id]);

    const conciseResponseBody = useMemo(() => {
        return selectedLog?.response_body
            ? extractConcisePayload(selectedLog.response_body, 'response', selectedLog)
            : '';
    }, [selectedLog?.response_body, selectedLog?.id, selectedLog?.input_tokens, selectedLog?.output_tokens, selectedLog?.cached_tokens]);

    const timingInfo = useMemo(() => {
        return parseTimingFromHeadersAndBody(
            selectedLog?.response_headers,
            selectedLog?.response_body,
            selectedLog?.duration
        );
    }, [selectedLog?.response_headers, selectedLog?.response_body, selectedLog?.duration]);

    const timingNode = timingInfo ? (
        <div className="p-2.5">
            <TimingDiagnosticsCard
                key={selectedLog?.id}
                timing={timingInfo}
                onCopyText={async (text) => {
                    const success = await copyToClipboard(text);
                    if (success) {
                        setCopiedCard('timing');
                        setTimeout(() => setCopiedCard(null), 2000);
                    }
                }}
            />
        </div>
    ) : undefined;

    const { accounts, fetchAccounts } = useAccountStore();

    // Pagination state
    const PAGE_SIZE_OPTIONS = [50, 100, 200, 500];
    const [pageSize, setPageSize] = useState(100);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const uniqueAccounts = useMemo(() => {
        const emailSet = new Set<string>();
        logs.forEach(log => {
            if (log.account_email) {
                emailSet.add(log.account_email);
            }
        });
        accounts.forEach(acc => {
            emailSet.add(acc.email);
        });
        return Array.from(emailSet).sort();
    }, [logs, accounts]);

    const loadData = async (page = 1, searchFilter = filter, accountEmailFilter = accountFilter) => {
        if (loading) return;
        setLoading(true);

        try {
            // Add timeout control (10 seconds)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), 10000)
            );

            const config = await Promise.race([
                invoke<AppConfig>('load_config'),
                timeoutPromise
            ]) as AppConfig;

            if (config && config.proxy) {
                setAppConfig(config);
                setIsLoggingEnabled(config.proxy.enable_logging);
                const healthLogsEnabled = !!config.proxy.capture_health_logs;
                setCaptureHealthLogs(healthLogsEnabled);
                await invoke('set_proxy_monitor_enabled', { enabled: config.proxy.enable_logging });
                await invoke('set_proxy_capture_health_logs', { enabled: healthLogsEnabled });
            }

            const errorsOnly = searchFilter === '__ERROR__';
            const baseFilter = errorsOnly ? '' : searchFilter;
            const actualFilter = accountEmailFilter
                ? (baseFilter ? `${baseFilter} ${accountEmailFilter}` : accountEmailFilter)
                : baseFilter;

            // Get count with filter
            const count = await Promise.race([
                invoke<number>('get_proxy_logs_count_filtered', {
                    filter: actualFilter,
                    errorsOnly: errorsOnly
                }),
                timeoutPromise
            ]) as number;
            setTotalCount(count);

            // Use filtered paginated query
            const offset = (page - 1) * pageSize;
            const history = await Promise.race([
                invoke<ProxyRequestLog[]>('get_proxy_logs_filtered', {
                    filter: actualFilter,
                    errorsOnly: errorsOnly,
                    limit: pageSize,
                    offset: offset
                }),
                timeoutPromise
            ]) as ProxyRequestLog[];

            if (Array.isArray(history)) {
                setLogs(history);
                // Clear pending logs to avoid duplicates (database data is authoritative)
                pendingLogsRef.current = [];
            }

            const currentStats = await Promise.race([
                invoke<ProxyStats>('get_proxy_stats'),
                timeoutPromise
            ]) as ProxyStats;

            if (currentStats) setStats(currentStats);
        } catch (e: any) {
            console.error("Failed to load proxy data", e);
            if (e.message === 'Request timeout') {
                // Show timeout error to user
                console.error('Loading monitor data timeout, please try again later');
            }
        } finally {
            setLoading(false);
        }
    };

    const totalPages = Math.ceil(totalCount / pageSize);
    const pageStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const pageEnd = totalCount === 0 ? 0 : Math.min(currentPage * pageSize, totalCount);

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            setCurrentPage(page);
            currentPageRef.current = page; // [FIX] 同步 ref
            loadData(page, filter, accountFilter);
        }
    };

    const toggleLogging = async () => {
        const newState = !isLoggingEnabled;
        try {
            const config = await invoke<AppConfig>('load_config');
            if (config && config.proxy) {
                config.proxy.enable_logging = newState;
                await invoke('save_config', { config });
                await invoke('set_proxy_monitor_enabled', { enabled: newState });
                setIsLoggingEnabled(newState);
            }
        } catch (e) {
            console.error("Failed to toggle logging", e);
        }
    };

    const toggleCaptureHealthLogs = async () => {
        const newState = !captureHealthLogs;
        try {
            const config = await invoke<AppConfig>('load_config');
            if (config && config.proxy) {
                config.proxy.capture_health_logs = newState;
                await invoke('save_config', { config });
                await invoke('set_proxy_capture_health_logs', { enabled: newState });
                setCaptureHealthLogs(newState);
                loadData(1, filter, accountFilter);
            }
        } catch (e) {
            console.error("Failed to toggle capture health logs", e);
        }
    };

    const pendingLogsRef = useRef<ProxyRequestLog[]>([]);
    const listenerSetupRef = useRef(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        loadData();
        fetchAccounts();

        let unlistenFn: (() => void) | null = null;
        let updateTimeout: number | null = null;

        const setupListener = async () => {
            if (!isTauri()) return;
            // Prevent duplicate listener registration (React 18 StrictMode)
            if (listenerSetupRef.current) {
                console.debug('[ProxyMonitor] Listener already set up, skipping...');
                return;
            }
            listenerSetupRef.current = true;

            console.debug('[ProxyMonitor] Setting up event listener for proxy://request');
            unlistenFn = await listen<ProxyRequestLog>('proxy://request', (event) => {
                if (!isMountedRef.current) return;

                const newLog = event.payload;

                // 移除 body 以减少内存占用
                const logSummary = {
                    ...newLog,
                    request_body: undefined,
                    upstream_request_body: undefined,
                    response_body: undefined
                };

                // Check if this log already exists (deduplicate at event level)
                const alreadyExists = pendingLogsRef.current.some(log => log.id === newLog.id);
                if (alreadyExists) {
                    console.debug('[ProxyMonitor] Duplicate event ignored:', newLog.id);
                    return;
                }

                pendingLogsRef.current.push(logSummary);

                // 防抖:每 500ms 批量更新一次
                if (updateTimeout) clearTimeout(updateTimeout);
                updateTimeout = window.setTimeout(async () => {
                    if (!isMountedRef.current) return;

                    const currentPending = pendingLogsRef.current;
                    if (currentPending.length > 0) {
                        setLogs(prev => {
                            // Deduplicate by id
                            const existingIds = new Set(prev.map(log => log.id));
                            const uniqueNewLogs = currentPending.filter(log => !existingIds.has(log.id));
                            // Merge and sort by timestamp descending (newest first)
                            const merged = [...uniqueNewLogs, ...prev];
                            merged.sort((a, b) => b.timestamp - a.timestamp);
                            return merged.slice(0, 100);
                        });

                        // Fetch stats and total count from backend instead of local calculation
                        try {
                            const [currentStats, count] = await Promise.all([
                                invoke<ProxyStats>('get_proxy_stats'),
                                invoke<number>('get_proxy_logs_count_filtered', { filter: '', errorsOnly: false })
                            ]);
                            if (isMountedRef.current) {
                                if (currentStats) setStats(currentStats);
                                setTotalCount(count);
                            }
                        } catch (e) {
                            console.error('Failed to fetch stats:', e);
                        }

                        pendingLogsRef.current = [];
                    }
                }, 500);
            });
        };
        setupListener();

        // Web 模式補強：如果不是 Tauri 環境，則啟用定時輪詢
        let pollInterval: number | null = null;
        if (!isTauri()) {
            console.debug('[ProxyMonitor] Web mode detected, starting auto-poll (10s)');
            pollInterval = window.setInterval(() => {
                if (isMountedRef.current && !loading) {
                    // [FIX] 使用 ref.current 获取最新的筛选条件
                    loadData(currentPageRef.current, filterRef.current, accountFilterRef.current);
                }
            }, 10000);
        }

        return () => {
            isMountedRef.current = false;
            listenerSetupRef.current = false;
            if (unlistenFn) unlistenFn();
            if (updateTimeout) clearTimeout(updateTimeout);
            if (pollInterval) clearInterval(pollInterval);
        };
    }, []);

    useEffect(() => {
        setCopiedCard(null);
    }, [selectedLog?.id]);

    // Reload when pageSize changes
    useEffect(() => {
        setCurrentPage(1);
        loadData(1, filter, accountFilter);
    }, [pageSize]);

    // Reload when filter changes (search based on all logs)
    useEffect(() => {
        setCurrentPage(1);
        loadData(1, filter, accountFilter);
        // [FIX] 同步 ref 值，供 setInterval 使用
        filterRef.current = filter;
        accountFilterRef.current = accountFilter;
        currentPageRef.current = 1;
    }, [filter, accountFilter]);

    // Logs are already filtered and sorted by backend
    // Apply account filter and noise filter on frontend (与后端 should_skip_request_log 语义保持一致)
    const filteredLogs = useMemo(() => {
        let result = logs;
        if (!captureHealthLogs) {
            result = result.filter(log => {
                const isGetSuccess = log.method?.toUpperCase() === 'GET'
                    && typeof log.status === 'number'
                    && log.status >= 200 && log.status < 300;
                return !isGetSuccess;
            });
        }
        if (accountFilter) {
            result = result.filter(log => log.account_email === accountFilter);
        }
        return result;
    }, [logs, accountFilter, captureHealthLogs]);

    const quickFilters = [
        { label: t('monitor.filters.all'), value: '' },
        { label: 'claude', value: 'claude' },
        { label: 'flash', value: 'flash' },
        { label: 'pro', value: 'pro' },
        { label: 'agent', value: 'agent' },
        { label: t('monitor.filters.error'), value: '__ERROR__' },
        { label: t('monitor.filters.chat'), value: 'completions' },
        { label: t('monitor.filters.gemini'), value: 'gemini' },
        { label: t('monitor.filters.images'), value: 'images' }
    ];

    const clearLogs = () => {
        setIsClearConfirmOpen(true);
    };

    const executeClearLogs = async () => {
        setIsClearConfirmOpen(false);
        try {
            await invoke('clear_proxy_logs');
            setLogs([]);
            setStats({ total_requests: 0, success_count: 0, error_count: 0 });
            setTotalCount(0);
            fetchDbDiskSize();
        } catch (e) {
            console.error("Failed to clear logs", e);
        }
    };

    const updateLogRetentionField = (field: 'max_body_age_hours' | 'max_storage_gb' | 'max_rows', value: number) => {
        if (!appConfig) return;
        const currentRetention = appConfig.proxy?.log_retention || { max_body_age_hours: 24, max_storage_gb: 1.0, max_rows: 100000 };
        const safeVal = field === 'max_storage_gb'
            ? Math.max(0.1, isNaN(value) ? 1.0 : value)
            : Math.max(1, isNaN(value) ? 1 : value);
        const updated = {
            ...currentRetention,
            [field]: safeVal,
        };
        const currentExp: ExperimentalConfig = appConfig.proxy?.experimental || {
            enable_usage_scaling: true,
        };
        const updatedConfig: AppConfig = {
            ...appConfig,
            proxy: {
                ...appConfig.proxy,
                log_retention: updated,
                experimental: {
                    ...currentExp,
                }
            }
        };
        setAppConfig(updatedConfig);
    };

    const updateInternalErrorLogRetention = (value: number) => {
        if (!appConfig) return;
        const safeVal = Math.max(1, isNaN(value) ? 500 : value);
        const updatedConfig: AppConfig = {
            ...appConfig,
            proxy: {
                ...appConfig.proxy,
                internal_error_log_retention: {
                    max_storage_mb: safeVal,
                },
            }
        };
        setAppConfig(updatedConfig);
    };

    const updateExperimentalField = (field: 'payload_storage_mode' | 'thinking_retention_days', value: any) => {
        if (!appConfig) return;
        const currentExp: ExperimentalConfig = appConfig.proxy?.experimental || {
            enable_usage_scaling: true,
        };
        const updatedExp: ExperimentalConfig = {
            ...currentExp,
            [field]: field === 'thinking_retention_days' ? Math.max(1, parseInt(value) || 15) : value,
        };
        const updatedConfig: AppConfig = {
            ...appConfig,
            proxy: {
                ...appConfig.proxy,
                experimental: updatedExp
            }
        };
        setAppConfig(updatedConfig);
    };

    const handleSaveLogSettings = async () => {
        if (!appConfig) return;
        setIsSavingConfig(true);
        try {
            await invoke('save_config', { config: appConfig });
            setSaveSuccess(true);
            fetchDbDiskSize();
            fetchErrorLogDiskSize();
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (e) {
            console.error('Failed to save log settings', e);
        } finally {
            setIsSavingConfig(false);
        }
    };

    const handleClearCache = async () => {
        setIsClearCacheModalOpen(false);
        try {
            await invoke('clear_log_cache');
            setCacheClearedSuccess(true);
            setTimeout(() => setCacheClearedSuccess(false), 2500);
        } catch (e) {
            console.error('Failed to clear log cache', e);
        }
    };

    const successRate = stats.total_requests > 0
        ? `${((stats.success_count / stats.total_requests) * 100).toFixed(1)}%`
        : '--';
    const sqBtn = 'btn btn-sm btn-square rounded-none border-2 border-base-content bg-base-100 text-base-content shadow-none hover:bg-base-content hover:text-base-100 hover:border-base-content';
    const sqInput = 'rounded-none bg-base-100 border-2 border-base-content text-base-content text-xs focus:outline-none focus:border-lime-signal';
    const settingsInput = 'input input-xs rounded-none bg-base-100 border-2 border-base-content text-base-content w-full font-mono text-xs focus:outline-none focus:border-lime-signal';

    return (
        <div className={`flex flex-col min-h-0 ${className || 'flex-1'}`}>
            <PageHeader
                kicker={t('nav.hub_observability', { defaultValue: 'Observability' })}
                title={t('nav.call_records', { defaultValue: 'Traffic Logs' })}
                status={
                    <>
                        <Chip tone={isLoggingEnabled ? 'lime' : 'ink'}>
                            <span className={`inline-block w-1.5 h-1.5 ${isLoggingEnabled ? 'bg-[#0A0A0A] animate-pulse' : 'bg-base-100/60'}`} />
                            {isLoggingEnabled ? t('monitor.logging_status.active') : t('monitor.logging_status.paused')}
                        </Chip>
                        <Chip tone="ink">{formatCompactNumber(stats.total_requests)} {t('monitor.stats.total')}</Chip>
                        <Chip tone="lime">{formatCompactNumber(stats.success_count)} {t('monitor.stats.ok')}</Chip>
                        <Chip tone={stats.error_count > 0 ? 'bad' : 'ink'}>{formatCompactNumber(stats.error_count)} {t('monitor.stats.err')}</Chip>
                    </>
                }
                actions={
                    <>
                        <button
                            onClick={toggleLogging}
                            className={`btn btn-sm gap-2 px-3 rounded-none border-2 border-base-content shadow-none text-[11px] font-black uppercase tracking-[0.14em] ${isLoggingEnabled
                                ? 'bg-lime-signal text-[#0A0A0A] hover:bg-lime-signal'
                                : 'bg-base-100 text-base-content hover:bg-base-content hover:text-base-100'
                                }`}
                        >
                            <span className={`inline-block w-2.5 h-2.5 ${isLoggingEnabled ? 'bg-[#0A0A0A]' : 'bg-base-content/40'}`} />
                            {isLoggingEnabled ? t('monitor.logging_status.active') : t('monitor.logging_status.paused')}
                        </button>
                        <button onClick={() => loadData(currentPage, filter)} className={sqBtn} title={t('common.refresh')} aria-label={t('common.refresh')}>
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={() => setShowLogSettings(!showLogSettings)}
                            className={`${sqBtn} ${showLogSettings ? '!bg-base-content !text-base-100' : ''}`}
                            title={t('common.settings', { defaultValue: 'Settings' })}
                            aria-label={t('common.settings', { defaultValue: 'Settings' })}
                        >
                            <Settings size={16} />
                        </button>
                        <button onClick={clearLogs} className={`${sqBtn} hover:!bg-red-600 hover:!border-red-600 hover:!text-white`} title={t('monitor.actions.clear_all_requests', { defaultValue: 'Clear All Historical Requests' })} aria-label={t('monitor.actions.clear_all_requests', { defaultValue: 'Clear All Historical Requests' })}>
                            <Trash2 size={16} />
                        </button>
                    </>
                }
            />

            <Ticker
                items={[
                    { label: t('monitor.stats.total'), value: formatCompactNumber(stats.total_requests) },
                    { label: t('monitor.stats.ok'), value: formatCompactNumber(stats.success_count), tone: 'good' },
                    { label: t('monitor.stats.err'), value: formatCompactNumber(stats.error_count), tone: stats.error_count > 0 ? 'bad' : 'default' },
                    { label: t('monitor.stats.success_rate', { defaultValue: 'Success rate' }), value: successRate },
                ]}
            />

            {/* 日志存储与维护展开配置面板 */}
            {showLogSettings && appConfig && (
                <>
                    <SectionRule
                        label={t('monitor.settings.title', { defaultValue: 'Log Retention & Maintenance Settings' })}
                        right={
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleSaveLogSettings}
                                    disabled={isSavingConfig}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 border-2 border-base-content text-[11px] font-black uppercase tracking-[0.14em] transition-colors disabled:opacity-60 ${
                                        saveSuccess
                                            ? 'bg-lime-signal text-[#0A0A0A]'
                                            : 'bg-base-content text-base-100 hover:bg-lime-signal hover:text-[#0A0A0A]'
                                    }`}
                                    title="Save all log and thinking-block settings"
                                >
                                    <Check size={13} />
                                    <span>{saveSuccess ? t('common.saved', { defaultValue: 'Saved successfully' }) : (isSavingConfig ? t('common.saving', { defaultValue: 'Saving...' }) : t('common.save', { defaultValue: 'Save' }))}</span>
                                </button>
                                <button
                                    onClick={() => setShowLogSettings(false)}
                                    className="btn btn-xs btn-square rounded-none border-2 border-base-content bg-base-100 text-base-content shadow-none hover:bg-base-content hover:text-base-100"
                                    aria-label={t('common.close', { defaultValue: 'Close' })}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        }
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 border-y-2 border-base-content md:divide-x-2 divide-base-content text-xs">
                        {/* 1. 请求日志 */}
                        <div className="p-4 space-y-3">
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5">
                                <Clock size={13} />
                                {t('monitor.settings.retention_title', { defaultValue: 'Request Logs (Sliding Window)' })}
                            </span>
                            <div className="space-y-2.5">
                                {/* 空间上限 */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-bold text-base-content">
                                            {t('proxy.config.log_retention_storage_gb', { defaultValue: 'Request log limit (GB)' })}
                                        </label>
                                        <span className="text-[10px] text-base-content/60">
                                            {t('proxy.config.log_retention_current_usage', { defaultValue: 'Current database disk usage' })}: <strong className="font-mono tabular-nums text-base-content">{dbDiskSizeBytes !== null ? formatBytes(dbDiskSizeBytes) : '...'}</strong>
                                        </span>
                                    </div>
                                    <input
                                        type="number"
                                        min={0.1}
                                        max={100}
                                        step={0.1}
                                        value={appConfig.proxy.log_retention?.max_storage_gb ?? 1.0}
                                        onChange={(e) => updateLogRetentionField('max_storage_gb', parseFloat(e.target.value))}
                                        className={settingsInput}
                                    />
                                    <p className="text-[10px] text-base-content/60 mt-0.5 leading-tight">
                                        {t('proxy.config.log_retention_storage_gb_desc', { defaultValue: 'Default 1GB; when full, evict the oldest 30% and keep appending' })}
                                    </p>
                                </div>

                                {/* 最大保留条数与报文模式并排 */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                    <div>
                                        <label className="block text-xs font-bold text-base-content mb-1">
                                            {t('proxy.config.log_retention_rows', { defaultValue: 'Maximum log rows' })}
                                        </label>
                                        <input
                                            type="number"
                                            min={100}
                                            step={1000}
                                            value={appConfig.proxy.log_retention?.max_rows ?? 100000}
                                            onChange={(e) => updateLogRetentionField('max_rows', Number(e.target.value))}
                                            className={settingsInput}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-base-content mb-1">
                                            {t('proxy.config.experimental.payload_storage_mode_label', { defaultValue: 'Monitor payload storage' })}
                                        </label>
                                        <select
                                            className="select select-xs rounded-none bg-base-100 border-2 border-base-content text-base-content w-full text-xs focus:outline-none focus:border-lime-signal"
                                            value={appConfig.proxy.experimental?.payload_storage_mode || 'simple'}
                                            onChange={(e) => updateExperimentalField('payload_storage_mode', e.target.value)}
                                        >
                                            <option value="simple">{t('proxy.config.experimental.payload_mode_simple', { defaultValue: 'Simple (default)' })}</option>
                                            <option value="full">{t('proxy.config.experimental.payload_mode_full', { defaultValue: 'Full original' })}</option>
                                        </select>
                                    </div>
                                </div>
                                <p className="text-[10px] text-base-content/60 leading-tight">
                                    {t('proxy.config.experimental.payload_storage_mode_desc', { defaultValue: 'Default is simple storage to keep the SQLite log small.' })}
                                </p>
                            </div>
                        </div>

                        {/* 2. 内部报错日志 */}
                        <div className="p-4 space-y-3 border-t-2 md:border-t-0 border-base-content">
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5">
                                <FileWarning size={13} />
                                {t('monitor.settings.internal_error_title', { defaultValue: 'Internal Error Logs (Sliding Window)' })}
                            </span>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-bold text-base-content">
                                        {t('proxy.config.internal_error_log_storage_mb', { defaultValue: 'Internal error log limit (MB)' })}
                                    </label>
                                    <span className="text-[10px] text-base-content/60">
                                        {t('proxy.config.internal_error_log_current_usage', { defaultValue: 'Current usage' })}: <strong className="font-mono tabular-nums text-base-content">{errorLogDiskSizeBytes !== null ? formatBytes(errorLogDiskSizeBytes) : '...'}</strong>
                                    </span>
                                </div>
                                <input
                                    type="number"
                                    min={1}
                                    max={10240}
                                    step={50}
                                    value={appConfig.proxy.internal_error_log_retention?.max_storage_mb ?? 500}
                                    onChange={(e) => updateInternalErrorLogRetention(Number(e.target.value))}
                                    className={settingsInput}
                                />
                                <p className="text-[10px] text-base-content/60 mt-0.5 leading-tight">
                                    {t('proxy.config.internal_error_log_storage_mb_desc', { defaultValue: 'Default 500MB; failures only. When full, evict the oldest 30% and keep appending. Account data is not affected.' })}
                                </p>
                            </div>
                        </div>

                        {/* 3. 维护与清理操作 */}
                        <div className="p-4 md:col-span-2 border-t-2 border-base-content flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 mb-1">
                                    <HardDrive size={13} />
                                    {t('monitor.settings.maintenance_title', { defaultValue: 'Log Maintenance & Space Cleanup' })}
                                </span>
                                <p className="text-xs text-base-content/60 leading-relaxed">
                                    {t('settings.advanced.logs_desc', { defaultValue: 'Clear log cache files. Does not affect account data.' })}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsClearCacheModalOpen(true)}
                                    className="btn btn-xs rounded-none border-2 border-base-content bg-base-100 text-base-content shadow-none gap-1.5 text-[11px] font-black uppercase tracking-wider hover:bg-amber-400 hover:text-[#0A0A0A] hover:border-base-content"
                                >
                                    <Trash2 size={12} />
                                    {t('settings.advanced.clear_logs', { defaultValue: 'Clear Logs Cache' })}
                                </button>
                                <button
                                    type="button"
                                    onClick={clearLogs}
                                    className="btn btn-xs rounded-none border-2 border-red-600 bg-base-100 text-red-600 shadow-none gap-1.5 text-[11px] font-black uppercase tracking-wider hover:bg-red-600 hover:text-white hover:border-red-600"
                                >
                                    <Trash2 size={12} />
                                    {t('monitor.actions.clear_all_requests', { defaultValue: 'Clear All Historical Requests' })}
                                </button>
                                {cacheClearedSuccess && (
                                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-lime-signal">
                                        ✓ {t('settings.advanced.logs_cleared', { defaultValue: 'Logs cache cleared' })}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}

            <SectionRule
                label={t('monitor.filters.quick_filters').replace(/:\s*$/, '')}
                right={
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2 text-base-content/50" size={14} />
                            <input
                                ref={globalFilterInputRef}
                                type="text"
                                placeholder={t('monitor.filters.placeholder')}
                                className={`input input-sm pl-8 w-56 lg:w-72 ${sqInput}`}
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <User className="absolute left-2.5 top-2 text-base-content/50 z-10" size={14} />
                            <select
                                className={`select select-sm pl-8 min-w-[140px] max-w-[220px] ${sqInput}`}
                                value={accountFilter}
                                onChange={(e) => setAccountFilter(e.target.value)}
                                title={t('monitor.filters.by_account')}
                            >
                                <option value="">{t('monitor.filters.all_accounts')}</option>
                                {uniqueAccounts.map(email => (
                                    <option key={email} value={email} title={email}>
                                        {email}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                }
            />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
                <div className="flex flex-wrap border-2 border-base-content divide-x-2 divide-base-content">
                    {quickFilters.map(q => (
                        <button
                            key={q.label}
                            onClick={() => setFilter(q.value)}
                            className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] transition-colors ${
                                filter === q.value
                                    ? 'bg-base-content text-base-100'
                                    : 'bg-base-100 text-base-content hover:bg-base-200'
                            }`}
                        >
                            {q.label}
                        </button>
                    ))}
                    <button
                        onClick={toggleCaptureHealthLogs}
                        className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] transition-colors flex items-center gap-1.5 ${
                            captureHealthLogs
                                ? 'bg-lime-signal text-[#0A0A0A]'
                                : 'bg-base-100 text-base-content hover:bg-base-200'
                        }`}
                        title={t('monitor.filters.capture_health_tip', { defaultValue: 'Disabled by default: skips all successful GET requests (incl. /v1/models polling and /health probes) and does not persist them; failed requests are always recorded; enable to record & save everything' })}
                    >
                        <span className={`inline-block w-1.5 h-1.5 ${captureHealthLogs ? 'bg-[#0A0A0A] animate-pulse' : 'bg-base-content/40'}`} />
                        {t('monitor.filters.capture_health', { defaultValue: 'Capture Health' })}
                    </button>
                </div>
                {(filter || accountFilter) && (
                    <button
                        onClick={() => { setFilter(''); setAccountFilter(''); }}
                        className="text-[11px] font-black uppercase tracking-[0.14em] underline underline-offset-4 decoration-2 hover:bg-lime-signal hover:text-[#0A0A0A] px-1"
                    >
                        {t('monitor.filters.reset')}
                    </button>
                )}
                {internalErrorLogPath && (
                    <span
                        className="ml-auto min-w-0 max-w-full truncate text-[11px] leading-5 text-base-content/50 select-text"
                        title={t('monitor.filters.internal_error_log', { path: internalErrorLogPath, defaultValue: `Internal errors at {{path}}, sliding window` })}
                    >
                        {t('monitor.filters.internal_error_log', { path: internalErrorLogPath, defaultValue: `Internal errors at {{path}}, sliding window` })}
                    </span>
                )}
            </div>

            <LogTable
                logs={filteredLogs}
                loading={loading}
                onLogClick={async (log: ProxyRequestLog) => {
                    setLoadingDetail(true);
                    try {
                        const detail = await invoke<ProxyRequestLog>('get_proxy_log_detail', { logId: log.id, log_id: log.id });
                        setSelectedLog(detail || log);
                    } catch (e) {
                        console.error('Failed to load log detail', e);
                        setSelectedLog(log);
                    } finally {
                        setLoadingDetail(false);
                    }
                }}
                t={t}
            />

            {/* Pagination Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-base-200 border-2 border-t-0 border-base-content text-[11px] font-black uppercase tracking-[0.14em]">
                <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="text-base-content/60">{t('common.per_page')}</span>
                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="select select-xs rounded-none bg-base-100 border-2 border-base-content text-base-content font-mono tabular-nums w-16 focus:outline-none focus:border-lime-signal"
                    >
                        {PAGE_SIZE_OPTIONS.map(size => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage <= 1 || loading}
                        className="btn btn-xs btn-square rounded-none border-2 border-base-content bg-base-100 text-base-content shadow-none hover:bg-base-content hover:text-base-100"
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <span className="text-base-content min-w-[80px] text-center font-mono tabular-nums">
                        {currentPage} / {totalPages || 1}
                    </span>
                    <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage >= totalPages || loading}
                        className="btn btn-xs btn-square rounded-none border-2 border-base-content bg-base-100 text-base-content shadow-none hover:bg-base-content hover:text-base-100"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>

                <div className="text-base-content/60 font-mono tabular-nums">
                    {t('common.pagination_info', { start: pageStart, end: pageEnd, total: totalCount })}
                </div>
            </div>

            {selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4" onClick={() => setSelectedLog(null)}>
                    <div className="bg-base-100 rounded-md shadow-2xl w-full max-w-[1280px] h-[92vh] max-h-[92vh] flex flex-col overflow-hidden border border-base-content/15" onClick={e => e.stopPropagation()}>
                        <LogDetailHeader
                            log={selectedLog}
                            loading={loadingDetail}
                            copied={copiedCard === 'path'}
                            onCopy={async () => {
                                const success = await copyToClipboard(selectedLog.url);
                                if (success) {
                                    setCopiedCard('path');
                                    setTimeout(() => setCopiedCard(null), 2000);
                                }
                            }}
                            onClose={() => setSelectedLog(null)}
                        />

                        <div className="flex-1 min-h-0 flex flex-col gap-3 px-4 sm:px-5 pb-4 overflow-hidden">
                            {/* Summary strip (collapsible via Hide metadata) */}
                            {showMetadata && <LogSummaryStrip log={selectedLog} />}

                            {/* Tabs + payload view controls */}
                            <LogToolbar
                                active={detailTab}
                                onTab={openDetailTab}
                                viewMode={payloadViewMode}
                                onViewMode={setPayloadViewMode}
                                showMetadata={showMetadata}
                                onToggleMetadata={() => setShowMetadata((prev) => !prev)}
                                conciseLabel={t('monitor.details.concise_mode', 'Concise Mode')}
                                fullLabel={t('monitor.details.full_mode', 'Full Mode')}
                                conciseHint={t('monitor.details.concise_desc', 'Keeps the outbound payload hierarchy, with id, model, thinking config, system prompt, conversation, and tools first. Bulky inline data is omitted.')}
                                fullHint="Shows the original, untrimmed payload"
                            />

                            <div className="flex-1 min-h-0 relative">
                                {detailTab === 'overview' && (
                                    <div className="h-full overflow-y-auto pr-1">
                                        <LogOverview log={selectedLog} demon={appConfig?.proxy?.demon ?? null} />
                                    </div>
                                )}

                                {visitedTabs.includes('request') && (
                                    <div className={`h-full ${detailTab === 'request' ? '' : 'hidden'}`}>
                                        <VirtualizedPayloadViewer
                                            cardId="req"
                                            title={t('monitor.details.request_payload', 'Request Payload')}
                                            badge="REQUEST"
                                            badgeStyle="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800/60"
                                            rawPayload={selectedLog.request_body}
                                            concisePayload={conciseRequestBody}
                                            headersJson={selectedLog.request_headers}
                                            viewMode={payloadViewMode}
                                            emptyPlaceholder={t('monitor.details.payload_empty', 'No data')}
                                            onCopy={async (text) => {
                                                const success = await copyToClipboard(text);
                                                if (success) {
                                                    setCopiedCard('req');
                                                    setTimeout(() => setCopiedCard(null), 2000);
                                                }
                                            }}
                                            isCopied={copiedCard === 'req'}
                                        />
                                    </div>
                                )}
                                {visitedTabs.includes('forwarded') && (
                                    <div className={`h-full ${detailTab === 'forwarded' ? '' : 'hidden'}`}>
                                        <VirtualizedPayloadViewer
                                            cardId="upstream"
                                            title={t('monitor.details.upstream_request_payload', 'Forwarded Request Payload')}
                                            badge="FORWARDED"
                                            badgeStyle="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800/60"
                                            rawPayload={selectedLog.upstream_request_body}
                                            concisePayload={conciseUpstreamBody}
                                            headersJson={selectedLog.upstream_request_headers}
                                            viewMode={payloadViewMode}
                                            emptyPlaceholder={t('monitor.details.no_upstream_payload', 'No forwarded payload (direct forwarding or unrecorded)')}
                                            onCopy={async (text) => {
                                                const success = await copyToClipboard(text);
                                                if (success) {
                                                    setCopiedCard('upstream');
                                                    setTimeout(() => setCopiedCard(null), 2000);
                                                }
                                            }}
                                            isCopied={copiedCard === 'upstream'}
                                        />
                                    </div>
                                )}
                                {visitedTabs.includes('response') && (
                                    <div className={`h-full ${detailTab === 'response' ? '' : 'hidden'}`}>
                                        <VirtualizedPayloadViewer
                                            cardId="resp"
                                            title={t('monitor.details.response_payload', 'Response Payload')}
                                            badge="RESPONSE"
                                            badgeStyle="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                                            rawPayload={selectedLog.response_body}
                                            concisePayload={conciseResponseBody}
                                            headersJson={selectedLog.response_headers}
                                            viewMode={payloadViewMode}
                                            emptyPlaceholder={t('monitor.details.payload_empty', 'No data')}
                                            duration={selectedLog.duration}
                                            timingNode={timingNode}
                                            onCopy={async (text) => {
                                                const success = await copyToClipboard(text);
                                                if (success) {
                                                    setCopiedCard('resp');
                                                    setTimeout(() => setCopiedCard(null), 2000);
                                                }
                                            }}
                                            isCopied={copiedCard === 'resp'}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ModalDialog
                isOpen={isClearConfirmOpen}
                title={t('monitor.dialog.clear_title')}
                message={t('monitor.dialog.clear_msg')}
                type="confirm"
                confirmText={t('common.delete')}
                isDestructive={true}
                onConfirm={executeClearLogs}
                onCancel={() => setIsClearConfirmOpen(false)}
            />

            <ModalDialog
                isOpen={isClearCacheModalOpen}
                title={t('settings.advanced.clear_logs_title', { defaultValue: 'Clear Logs Confirmation' })}
                message={t('settings.advanced.clear_logs_msg', { defaultValue: 'Are you sure you want to clear all log cache files?' })}
                type="confirm"
                confirmText={t('common.clear', { defaultValue: 'Clear' })}
                cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                isDestructive={true}
                onConfirm={handleClearCache}
                onCancel={() => setIsClearCacheModalOpen(false)}
            />
        </div>
    );
};
