import type { ReactNode } from 'react';
import Mascot from './Mascot';

/**
 * Proxymateur layout kit: the structural vocabulary shared by every page.
 * Minimal and flat: open sections split by hairlines, one big-number strip per page,
 * ledger rows and thin meters, instead of grids of boxed cards.
 */

export function PageHeader({
    title,
    kicker,
    status,
    actions,
}: {
    title: string;
    /** Small muted line above the title (e.g. "Fleet"). */
    kicker?: string;
    /** Live status chips shown under the title. */
    status?: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <header className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-base-content/10">
            <div className="flex items-center gap-3.5 min-w-0">
                <Mascot size={26} className="shrink-0 text-base-content/80" face="var(--color-base-100)" />
                <div className="min-w-0">
                    {kicker && <div className="text-xs text-base-content/50">{kicker}</div>}
                    <h1 className="text-2xl leading-tight font-semibold tracking-tight truncate">{title}</h1>
                    {status && <div className="mt-2 flex flex-wrap items-center gap-2">{status}</div>}
                </div>
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
    );
}

/** Quiet status chip with a small dot. tone: lime = live/healthy, ink = neutral, warn, bad. */
export function Chip({ children, tone = 'ink' }: { children: ReactNode; tone?: 'lime' | 'ink' | 'warn' | 'bad' }) {
    const dot = {
        lime: 'bg-lime-signal',
        ink: 'bg-base-content/40',
        warn: 'bg-amber-400',
        bad: 'bg-red-500',
    } as const;
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-base-content/[0.06] px-2.5 py-0.5 text-xs font-medium text-base-content/80">
            <span className={`h-1.5 w-1.5 rounded-full ${dot[tone]}`} />
            {children}
        </span>
    );
}

/** Section divider: a small muted label on a hairline, with optional right-hand controls. */
export function SectionRule({ index, label, right }: { index?: string; label: string; right?: ReactNode }) {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-10 mb-3">
            <span className="text-sm font-medium text-base-content whitespace-nowrap">
                {index && <span className="mr-2 text-base-content/35 tabular-nums">{index}</span>}
                {label}
            </span>
            <div className="flex-1 min-w-4 border-t border-base-content/10" />
            {right}
        </div>
    );
}

export interface TickerItem {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    tone?: 'default' | 'good' | 'bad';
}

/** One horizontal strip of figures separated by hairlines. */
export function Ticker({ items }: { items: TickerItem[] }) {
    const toneClass = { default: '', good: 'text-emerald-600 dark:text-emerald-400', bad: 'text-red-600 dark:text-red-400' };
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-base-content/10 border-b border-base-content/10">
            {items.map((it, i) => (
                <div key={i} className="px-5 py-5 first:pl-0 min-w-0">
                    <div className="text-xs text-base-content/50 truncate">{it.label}</div>
                    <div className={`mt-1.5 text-4xl leading-none font-semibold tabular-nums ${toneClass[it.tone ?? 'default']}`}>
                        {it.value}
                    </div>
                    {it.hint && <div className="mt-2 text-xs text-base-content/45 truncate">{it.hint}</div>}
                </div>
            ))}
        </div>
    );
}

/** Thin continuous meter: percent 0-100. Colour follows `tone` (lime default, warn, bad). */
export function SegmentBar({ percent, tone = 'lime' }: { percent: number; tone?: 'lime' | 'ink' | 'warn' | 'bad' }) {
    const pct = Math.max(0, Math.min(100, percent));
    const colour = { lime: '#84CC16', ink: 'currentColor', warn: '#F59E0B', bad: '#DC2626' }[tone];
    return (
        <div
            className="relative h-1.5 w-full overflow-hidden rounded-full bg-base-content/10"
            role="meter"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, backgroundColor: colour }} />
        </div>
    );
}

/** A ledger row: hairline-separated, label left, values right. Compose with SegmentBar for quotas. */
export function LedgerRow({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <div className={`flex items-center gap-4 py-3 border-b border-base-content/10 ${className}`}>{children}</div>;
}
