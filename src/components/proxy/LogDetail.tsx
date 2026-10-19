import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, CheckCircle, Eye, EyeOff, FileCode2, Sparkles, X } from 'lucide-react';
import { Chip, SectionRule } from '../common/ledger';
import { formatCompactNumber } from '../../utils/format';
import { analyzeRequestChanges, type ChangeReport, type ChangeRow, type ConvChange, type DemonChange, type Tag } from './requestChanges';
import { digestResponse, type ResponseDigest } from './responseDigest';
import type { DemonConfigLike } from './demonAttribution';
import type { TextSeg } from './payloadDiff';

/**
 * Request detail modal building blocks: header, summary strip, tab toolbar and the plain-language
 * Overview tab (what happened / what the proxy changed / DEMON / response digest).
 */

export interface LogLike {
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
    input_tokens?: number;
    output_tokens?: number;
    cached_tokens?: number;
    account_email?: string;
    protocol?: string;
}

export type DetailTab = 'overview' | 'request' | 'forwarded' | 'response';

/* ------------------------------------------------------------------ helpers */

function totalInputTokens(log: LogLike): number {
    const input = log.input_tokens ?? 0;
    return log.cached_tokens && log.cached_tokens > input ? input + log.cached_tokens : input;
}

function cachePercent(log: LogLike): number | null {
    const total = totalInputTokens(log);
    if (!log.cached_tokens || log.cached_tokens <= 0 || total <= 0) return null;
    return Math.min(100, Math.max(0, (log.cached_tokens / total) * 100));
}

function formatPercent(p: number): string {
    return p >= 100 ? '100%' : p % 1 === 0 ? `${p.toFixed(0)}%` : `${p.toFixed(1)}%`;
}

function formatDuration(ms: number): string {
    if (!Number.isFinite(ms)) return '-';
    if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)} min`;
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
    return `${Math.round(ms)} ms`;
}

function maskEmail(email?: string): string {
    if (!email) return 'an unknown account';
    const at = email.indexOf('@');
    if (at <= 0) return email;
    return `${email[0]}***${email.slice(at)}`;
}

function protocolName(p?: string): string {
    const v = (p ?? '').toLowerCase();
    if (v === 'gemini') return 'Gemini';
    if (v === 'openai') return 'OpenAI';
    if (v === 'anthropic' || v === 'claude') return 'Anthropic';
    return p ? p : 'A';
}

const isFailed = (log: LogLike) => log.status >= 400 || !!log.error;

/* ------------------------------------------------------------------ header */

export const LogDetailHeader: React.FC<{
    log: LogLike;
    loading: boolean;
    copied: boolean;
    onCopy: () => void;
    onClose: () => void;
}> = ({ log, loading, copied, onCopy, onClose }) => (
    <div className="px-4 py-3 border-b border-base-content/10 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
            {loading && <div className="loading loading-spinner loading-sm shrink-0"></div>}
            <span className="shrink-0">
                <Chip tone={log.status >= 200 && log.status < 400 ? 'lime' : 'bad'}>
                    <span className="tabular-nums">{log.status}</span>
                </Chip>
            </span>
            <span className="font-mono font-semibold text-sm shrink-0">{log.method}</span>
            <span className="text-xs text-base-content/60 font-mono truncate min-w-0" title={log.url}>{log.url}</span>
            <button
                type="button"
                onClick={onCopy}
                className="btn btn-ghost btn-xs btn-square shrink-0 text-base-content/50 hover:text-base-content"
                title="Copy path"
                aria-label="Copy path"
            >
                {copied ? <CheckCircle size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
        </div>
        <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-square shrink-0 text-base-content/60"
            aria-label="Close"
        >
            <X size={18} />
        </button>
    </div>
);

/* ------------------------------------------------------------------ summary strip */

const Cell: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
    <div className={`px-4 py-2.5 min-w-0 first:pl-0 ${className}`}>
        <div className="text-[11px] text-base-content/50">{label}</div>
        <div className="mt-0.5 text-xs font-mono truncate">{children}</div>
    </div>
);

export const LogSummaryStrip: React.FC<{ log: LogLike }> = ({ log }) => {
    const totalIn = totalInputTokens(log);
    const pct = cachePercent(log);
    const routed = log.mapped_model && log.mapped_model !== log.model ? log.mapped_model : null;
    const time = new Date(log.timestamp).toLocaleString();
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[auto_auto_auto_auto_minmax(0,1.7fr)_minmax(0,1fr)] lg:divide-x divide-base-content/10 border-b border-base-content/10 shrink-0">
            <Cell label="Time"><span title={time}>{time}</span></Cell>
            <Cell label="Duration"><span title={`${log.duration} ms`}>{formatDuration(log.duration)}</span></Cell>
            <Cell label="Tokens">
                <span title={`Total input tokens: ${totalIn.toLocaleString()}`}>{formatCompactNumber(totalIn)} in</span>
                <span className="text-base-content/35"> / </span>
                <span>{formatCompactNumber(log.output_tokens ?? 0)} out</span>
                {pct !== null && (
                    <>
                        <span className="text-base-content/35"> / </span>
                        <span title={`Cached: ${(log.cached_tokens ?? 0).toLocaleString()}`}>{formatPercent(pct)} cached</span>
                    </>
                )}
            </Cell>
            <Cell label="Protocol">{log.protocol || '-'}</Cell>
            <Cell label="Model">
                <span title={log.model}>{log.model || '-'}</span>
                {routed && (
                    <>
                        <span className="text-base-content/35"> {'›'} </span>
                        <span className="text-emerald-600 dark:text-emerald-400" title={routed}>{routed}</span>
                    </>
                )}
            </Cell>
            <Cell label="Account"><span title={log.account_email || '-'}>{log.account_email || '-'}</span></Cell>
        </div>
    );
};

/* ------------------------------------------------------------------ toolbar (tabs + payload controls) */

const TAB_LABELS: [DetailTab, string][] = [
    ['overview', 'Overview'],
    ['request', 'Request'],
    ['forwarded', 'Forwarded'],
    ['response', 'Response'],
];

export const LogToolbar: React.FC<{
    active: DetailTab;
    onTab: (tab: DetailTab) => void;
    viewMode: 'concise' | 'full';
    onViewMode: (mode: 'concise' | 'full') => void;
    showMetadata: boolean;
    onToggleMetadata: () => void;
    conciseLabel: string;
    fullLabel: string;
    conciseHint: string;
    fullHint: string;
}> = ({ active, onTab, viewMode, onViewMode, showMetadata, onToggleMetadata, conciseLabel, fullLabel, conciseHint, fullHint }) => {
    const modeBtn = (mode: 'concise' | 'full', label: string, hint: string, icon: React.ReactNode) => (
        <button
            type="button"
            title={hint}
            onClick={() => onViewMode(mode)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer select-none ${
                viewMode === mode ? 'bg-base-content/[0.08] text-base-content font-medium' : 'text-base-content/55 hover:text-base-content'
            }`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
    return (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-content/10 pb-2 shrink-0" role="tablist">
            <div className="flex items-center gap-1">
                {TAB_LABELS.map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={active === id}
                        onClick={() => onTab(id)}
                        className={`px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer select-none ${
                            active === id ? 'bg-base-content/[0.08] text-base-content font-medium' : 'text-base-content/55 hover:text-base-content hover:bg-base-content/[0.04]'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div className="flex items-center gap-2">
                {active !== 'overview' && (
                    <div className="inline-flex items-center gap-0.5">
                        {modeBtn('concise', conciseLabel, conciseHint, <Sparkles size={13} />)}
                        {modeBtn('full', fullLabel, fullHint, <FileCode2 size={13} />)}
                    </div>
                )}
                <button
                    type="button"
                    onClick={onToggleMetadata}
                    className="btn btn-xs btn-ghost text-base-content/55 gap-1 text-xs"
                    title={showMetadata ? 'Collapse metadata to enlarge the payload view' : 'Expand metadata'}
                >
                    {showMetadata ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>{showMetadata ? 'Hide metadata' : 'Show metadata'}</span>
                </button>
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ small building blocks */

const Collapsible: React.FC<{ summary: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }> = ({ summary, defaultOpen = false, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-1 text-xs text-base-content/60 hover:text-base-content cursor-pointer select-none"
            >
                {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>{summary}</span>
            </button>
            {open && <div className="mt-1.5">{children}</div>}
        </div>
    );
};

const TagPill: React.FC<{ tag: Tag }> = ({ tag }) => (
    <span
        className="inline-flex items-center gap-1.5 rounded-full bg-base-content/[0.06] px-2 py-0.5 text-[11px] text-base-content/80 whitespace-nowrap"
        title={tag.note}
    >
        <span className={`h-1.5 w-1.5 rounded-full ${tag.source === 'demon' ? 'bg-lime-signal' : 'bg-base-content/40'}`} />
        {tag.source === 'demon' ? `DEMON · ${tag.label}` : tag.label}
    </span>
);

const DEL_CLS = 'bg-red-500/10 text-red-700 dark:text-red-300 line-through decoration-red-500/40';
const ADD_CLS = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';

const SegView: React.FC<{ segments: TextSeg[] }> = ({ segments }) => (
    <div className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed max-h-72 overflow-auto rounded-md bg-base-content/[0.03] px-3 py-2">
        {segments.map((s, i) => {
            if (s.type === 'skip') {
                return (
                    <span key={i} className="mx-1 text-base-content/40 italic select-none">
                        {`… ${(s.skipped ?? 0).toLocaleString()} chars unchanged …`}
                    </span>
                );
            }
            const cls = s.type === 'del' ? DEL_CLS : s.type === 'add' ? ADD_CLS : 'text-base-content/70';
            return <span key={i} className={`${cls} rounded-[3px]`}>{s.text}</span>;
        })}
    </div>
);

const Muted: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <p className={`text-xs text-base-content/50 ${className}`}>{children}</p>
);

const Val: React.FC<{ kind: 'before' | 'after'; children: React.ReactNode }> = ({ kind, children }) => (
    <span className={`font-mono text-xs rounded-[3px] px-1 break-all ${kind === 'before' ? DEL_CLS : ADD_CLS}`}>{children}</span>
);

const Row: React.FC<{ label: React.ReactNode; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex items-start gap-4 py-2 border-b border-base-content/10 last:border-b-0">
        <div className="w-40 shrink-0 text-xs text-base-content/55 pt-0.5">{label}</div>
        <div className="flex-1 min-w-0 space-y-1.5">{children}</div>
    </div>
);

const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-4">
        <div className="text-[13px] font-medium mb-0.5">{title}</div>
        <div>{children}</div>
    </div>
);

const ChangeRows: React.FC<{ rows: ChangeRow[]; limit?: number }> = ({ rows, limit = 12 }) => {
    const [all, setAll] = useState(false);
    const shown = all ? rows : rows.slice(0, limit);
    return (
        <>
            {shown.map((r, i) => (
                <Row key={`${r.label}-${i}`} label={<span className="break-all">{r.label}{r.count && r.count > 1 ? <span className="text-base-content/35"> {'×'}{r.count}</span> : null}</span>}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {r.kind !== 'added' && r.before !== undefined && <Val kind="before">{r.before || '(empty)'}</Val>}
                        {r.kind === 'changed' && <span className="text-base-content/35 text-xs">{'→'}</span>}
                        {r.kind !== 'removed' && r.after !== undefined && <Val kind="after">{r.after || '(empty)'}</Val>}
                        {r.kind === 'added' && r.after === undefined && <span className="text-xs text-base-content/50">added</span>}
                        {r.kind === 'removed' && r.before === undefined && <span className="text-xs text-base-content/50">removed</span>}
                        {r.tag && <TagPill tag={r.tag} />}
                    </div>
                </Row>
            ))}
            {rows.length > limit && (
                <button type="button" className="mt-1 text-xs text-base-content/55 hover:text-base-content cursor-pointer" onClick={() => setAll((v) => !v)}>
                    {all ? 'Show fewer' : `Show ${rows.length - limit} more`}
                </button>
            )}
        </>
    );
};

const ConvRows: React.FC<{ rows: ConvChange[]; hidden: number }> = ({ rows, hidden }) => (
    <>
        {rows.map((c, i) => (
            <Row key={`${c.where}-${i}`} label={c.where}>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-base-content/60">
                        {c.kind === 'changed' && `text rewritten (+${c.addedChars.toLocaleString()} / −${c.removedChars.toLocaleString()} chars)`}
                        {c.kind === 'added' && `new text (${c.afterChars.toLocaleString()} chars)`}
                        {c.kind === 'removed' && `text dropped (${c.beforeChars.toLocaleString()} chars)`}
                    </span>
                    <TagPill tag={c.tag} />
                </div>
                {c.segments ? (
                    <Collapsible summary="Show diff">
                        <SegView segments={c.segments} />
                    </Collapsible>
                ) : (
                    (c.before || c.after) && (
                        <Collapsible summary="Show text">
                            <div className="whitespace-pre-wrap break-words font-mono text-xs max-h-60 overflow-auto rounded-md bg-base-content/[0.03] px-3 py-2">
                                {(c.after ?? c.before ?? '').slice(0, 4000)}
                            </div>
                        </Collapsible>
                    )
                )}
            </Row>
        ))}
        {hidden > 0 && <Muted className="py-2">{`+ ${hidden} more message change${hidden === 1 ? '' : 's'} not listed`}</Muted>}
    </>
);

/* ------------------------------------------------------------------ overview sections */

const Callout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex items-start gap-2.5 rounded-md border border-red-500/25 bg-red-500/[0.04] px-3 py-2.5">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
        <div className="min-w-0 text-sm break-words">{children}</div>
    </div>
);

function describeHappened(log: LogLike, report: ChangeReport, digest: ResponseDigest): string[] {
    const lines: string[] = [];
    const requested = log.model || 'an unspecified model';
    const routed = log.mapped_model && log.mapped_model !== log.model ? log.mapped_model : null;
    const totalIn = totalInputTokens(log);
    const pct = cachePercent(log);
    const tokenBits: string[] = [];
    if (totalIn > 0) tokenBits.push(`${formatCompactNumber(totalIn)} in`);
    if (log.output_tokens) tokenBits.push(`${formatCompactNumber(log.output_tokens)} out`);
    if (pct !== null) tokenBits.push(`${pct >= 100 ? 100 : Math.min(99, Math.round(pct))}% cached`);
    lines.push(
        `${protocolName(log.protocol)} request for ${requested}` +
            (routed ? ` was routed to ${routed}` : ' was served') +
            ` on account ${maskEmail(log.account_email)} and returned HTTP ${log.status} in ${formatDuration(log.duration)}` +
            (tokenBits.length ? ` (${tokenBits.join(', ')}).` : '.'),
    );
    if (report.status === 'ok') {
        if (report.summaryLabels.length === 0) {
            lines.push(report.translated ? 'The proxy only translated the request format before forwarding it.' : 'The proxy forwarded the request as received.');
        } else {
            const labels = report.summaryLabels;
            const head = labels.slice(0, 4).join(', ');
            const rest = labels.length - 4;
            lines.push(`The proxy changed the ${head}${rest > 0 ? ` and ${rest} more` : ''} before forwarding.`);
        }
    }
    const reply: string[] = [];
    if (digest.textChars) reply.push(`${digest.textChars.toLocaleString()} characters of text`);
    if (digest.toolCalls.length) reply.push(`${digest.toolCalls.length} tool call${digest.toolCalls.length === 1 ? '' : 's'}`);
    if (digest.thinkingPresent) reply.push('thinking');
    if (reply.length) lines.push(`The reply contained ${reply.join(', ')}.`);
    return lines;
}

const ChangesSection: React.FC<{ report: ChangeReport }> = ({ report }) => {
    if (report.status !== 'ok') return <Muted>{report.message}</Muted>;
    const idLine = report.identifierCount > 0 && (
        <Muted className="mt-1">{`${report.identifierCount} identifier field${report.identifierCount === 1 ? '' : 's'} rewritten`}</Muted>
    );
    if (report.identical) {
        return (
            <div>
                <p className="text-sm">
                    {report.translated
                        ? 'No changes beyond format translation.'
                        : report.identifierCount > 0
                            ? 'No content changes.'
                            : 'No changes — forwarded as received.'}
                </p>
                {report.conversationNote && <Muted className="mt-1">{report.conversationNote}</Muted>}
                {idLine}
            </div>
        );
    }
    return (
        <div>
            {report.model && (
                <Group title="Model">
                    <ChangeRows rows={[report.model]} />
                </Group>
            )}
            {report.system && (
                <Group title="System prompt">
                    <Row label={`${report.system.beforeChars.toLocaleString()} → ${report.system.afterChars.toLocaleString()} chars`}>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-base-content/60">
                                {`+${report.system.addedChars.toLocaleString()} / −${report.system.removedChars.toLocaleString()} chars`}
                            </span>
                            {report.system.tags.map((t) => <TagPill key={t.label} tag={t} />)}
                        </div>
                        {report.system.segments ? (
                            <SegView segments={report.system.segments} />
                        ) : (
                            <Muted>Word diff skipped because the payload is larger than 3 MB.</Muted>
                        )}
                        {report.system.coarse && <Muted>The edit was too large for a word-level diff, so it is shown as one removed and one added block.</Muted>}
                    </Row>
                </Group>
            )}
            {report.thinking.length > 0 && <Group title="Thinking"><ChangeRows rows={report.thinking} /></Group>}
            {report.tools.length > 0 && <Group title="Tools"><ChangeRows rows={report.tools} /></Group>}
            {report.generation.length > 0 && <Group title="Generation settings"><ChangeRows rows={report.generation} /></Group>}
            {report.safety.length > 0 && <Group title="Safety settings"><ChangeRows rows={report.safety} /></Group>}
            {(report.conversation.length > 0 || report.conversationNote) && (
                <Group title="Conversation">
                    {report.conversationNote && <Muted className="py-1">{report.conversationNote}</Muted>}
                    <ConvRows rows={report.conversation} hidden={report.conversationHidden} />
                </Group>
            )}
            {report.other.length > 0 && <Group title="Other"><ChangeRows rows={report.other} /></Group>}
            {report.textDiffSkipped && <Muted className="mt-1">Word-level text diffs were skipped because a payload is larger than 3 MB.</Muted>}
            {idLine}
        </div>
    );
};

const DemonSection: React.FC<{ report: ChangeReport; demon: DemonConfigLike | null | undefined; protocol?: string }> = ({ report, demon, protocol }) => {
    const chips = demon ? (
        <div className="flex flex-wrap items-center gap-2">
            <Chip tone={demon.enabled ? 'lime' : 'ink'}>{demon.enabled ? 'DEMON on' : 'DEMON off'}</Chip>
            <Chip tone={demon.decontaminate !== false ? 'lime' : 'ink'}>{`Decontaminate ${demon.decontaminate !== false ? 'on' : 'off'}`}</Chip>
            <Chip tone={demon.autonomous_persona !== false ? 'lime' : 'ink'}>{`Autonomous persona ${demon.autonomous_persona !== false ? 'on' : 'off'}`}</Chip>
            <Chip tone={(demon.custom_rules ?? '').trim() ? 'lime' : 'ink'}>{(demon.custom_rules ?? '').trim() ? 'Custom rules set' : 'No custom rules'}</Chip>
        </div>
    ) : (
        <Muted>DEMON settings are not loaded yet.</Muted>
    );
    return (
        <div>
            {chips}
            <Muted className="mt-1.5">Current settings; they may differ from what was active when this request ran.</Muted>
            <div className="mt-3">
                {report.status !== 'ok' ? (
                    <Muted>Nothing to inspect without a recorded request and forwarded payload.</Muted>
                ) : !report.protocolApplies ? (
                    <Muted>{`DEMON only runs on the native Gemini endpoint. This request came in as ${protocolName(protocol)}, so DEMON did not edit it.`}</Muted>
                ) : report.demon.length === 0 ? (
                    <p className="text-sm">No DEMON edits detected in this request.</p>
                ) : (
                    report.demon.map((c, i) => <DemonItem key={`${c.feature}-${i}`} change={c} />)
                )}
            </div>
            <Muted className="mt-3">
                {'A change is credited to DEMON only when the forwarded text carries DEMON’s own marker, or when re-running DEMON’s rules on the original text reproduces it exactly. Anything else stays a proxy rewrite.'}
            </Muted>
        </div>
    );
};

const DemonItem: React.FC<{ change: DemonChange }> = ({ change }) => (
    <div className="py-2.5 border-b border-base-content/10 last:border-b-0">
        <div className="flex flex-wrap items-center gap-2">
            <TagPill tag={change.tag} />
            <span className="text-xs text-base-content/55">{change.where}</span>
        </div>
        {change.tag.note && <Muted className="mt-1">{change.tag.note}</Muted>}
        {change.pairs && change.pairs.length > 0 && (
            <ul className="mt-2 space-y-1">
                {change.pairs.slice(0, 12).map((p, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {p.from && <Val kind="before">{p.from}</Val>}
                        {p.from && p.to && <span className="text-base-content/35 text-xs">{'→'}</span>}
                        {p.to && <Val kind="after">{p.to}</Val>}
                    </li>
                ))}
                {change.pairs.length > 12 && <li><Muted>{`+ ${change.pairs.length - 12} more replacements`}</Muted></li>}
            </ul>
        )}
        {change.feature !== 'decontaminate' && (change.before !== undefined || change.after !== undefined) && (
            <div className="mt-2">
                {change.before !== undefined && <div className="flex items-center gap-2 mb-1"><span className="text-xs text-base-content/50">before</span><Val kind="before">{change.before}</Val></div>}
                {change.after !== undefined && (change.after.length > 160 || change.after.includes('\n') ? (
                    <Collapsible summary="Show injected text">
                        <div className={`whitespace-pre-wrap break-words font-mono text-xs max-h-72 overflow-auto rounded-md px-3 py-2 ${ADD_CLS}`}>{change.after}</div>
                    </Collapsible>
                ) : (
                    <div className="flex items-center gap-2"><span className="text-xs text-base-content/50">after</span><Val kind="after">{change.after}</Val></div>
                ))}
            </div>
        )}
        {change.feature === 'decontaminate' && (change.before || change.after) && (
            <div className="mt-2">
                <Collapsible summary="Show full before and after text">
                    <div className="space-y-2">
                        {change.before && <div className="whitespace-pre-wrap break-words font-mono text-xs max-h-60 overflow-auto rounded-md px-3 py-2 bg-base-content/[0.03]"><div className="text-base-content/50 mb-1">before</div>{change.before}</div>}
                        {change.after && <div className="whitespace-pre-wrap break-words font-mono text-xs max-h-60 overflow-auto rounded-md px-3 py-2 bg-base-content/[0.03]"><div className="text-base-content/50 mb-1">after</div>{change.after}</div>}
                    </div>
                </Collapsible>
            </div>
        )}
    </div>
);

const ResponseSection: React.FC<{ digest: ResponseDigest }> = ({ digest }) => {
    const hasAny =
        !!digest.text || digest.thinkingPresent !== undefined || digest.toolCalls.length > 0 || !!digest.finishReason || digest.usage.length > 0;
    if (!hasAny) return null;
    return (
        <>
            <SectionRule label="Response" />
            <div>
                {digest.text && (
                    <Row label={`Reply${digest.textChars ? ` (${digest.textChars.toLocaleString()} chars)` : ''}`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{digest.text}</p>
                    </Row>
                )}
                {digest.thinkingPresent !== undefined && (
                    <Row label="Thinking">
                        <span className="text-sm">
                            {digest.thinkingPresent ? `Yes${digest.thinkingChars ? ` · ${digest.thinkingChars.toLocaleString()} chars` : ''}` : 'No'}
                        </span>
                    </Row>
                )}
                {digest.toolCalls.length > 0 && (
                    <Row label="Tool calls">
                        {digest.toolCalls.slice(0, 20).map((t, i) => (
                            <div key={i} className="font-mono text-xs break-all">
                                {t.name}<span className="text-base-content/50">({t.args})</span>
                            </div>
                        ))}
                        {digest.toolCalls.length > 20 && <Muted>{`+ ${digest.toolCalls.length - 20} more`}</Muted>}
                    </Row>
                )}
                {digest.finishReason && (
                    <Row label="Finish reason"><span className="font-mono text-xs">{digest.finishReason}</span></Row>
                )}
                {digest.usage.length > 0 && (
                    <Row label="Usage">
                        <span className="font-mono text-xs tabular-nums">
                            {digest.usage.map((u) => `${u.value.toLocaleString()} ${u.label}`).join(' · ')}
                        </span>
                    </Row>
                )}
            </div>
        </>
    );
};

/* ------------------------------------------------------------------ overview tab */

export const LogOverview: React.FC<{ log: LogLike; demon: DemonConfigLike | null | undefined }> = ({ log, demon }) => {
    const demonKey = demon ? `${demon.enabled}|${demon.decontaminate}|${demon.autonomous_persona}|${(demon.custom_rules ?? '').length}` : 'none';
    // Heavy work, memoised per selected log (and the config / payloads it depends on).
    const report = useMemo(
        () =>
            analyzeRequestChanges({
                requestRaw: log.request_body,
                forwardedRaw: log.upstream_request_body,
                requestedModel: log.model,
                routedModel: log.mapped_model,
                protocol: log.protocol,
                demon,
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [log.id, log.request_body, log.upstream_request_body, log.model, log.mapped_model, log.protocol, demonKey],
    );
    const digest = useMemo(() => digestResponse(log.response_body), [log.id, log.response_body]);
    const lines = useMemo(() => describeHappened(log, report, digest), [log, report, digest]);
    const failed = isFailed(log);
    const errorText = log.error || digest.errorMessage || `Upstream returned HTTP ${log.status}.`;

    return (
        <div className="max-w-4xl pb-6">
            <div className="space-y-2.5">
                {failed && <Callout>{errorText}</Callout>}
                <div className="space-y-1">
                    {lines.map((l, i) => (
                        <p key={i} className={i === 0 ? 'text-sm' : 'text-sm text-base-content/70'}>{l}</p>
                    ))}
                </div>
            </div>

            <SectionRule label="What the proxy changed" />
            <ChangesSection report={report} />

            <SectionRule label="DEMON" />
            <DemonSection report={report} demon={demon} protocol={log.protocol} />

            <ResponseSection digest={digest} />
        </div>
    );
};
