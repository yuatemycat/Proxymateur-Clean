import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export type PillTone = 'lime' | 'ink' | 'warn' | 'bad';

const PILL_DOT: Record<PillTone, string> = {
    lime: 'bg-lime-signal',
    ink: 'bg-emerald-500',
    warn: 'bg-amber-500',
    bad: 'bg-red-500',
};

/** Muted status chip: soft grey pill, sentence case, with an optional tiny coloured dot. */
export function Pill({ children, tone = 'ink', dot = false }: { children: ReactNode; tone?: PillTone; dot?: boolean }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap max-w-full bg-base-content/10',
                tone === 'bad' ? 'text-red-600 dark:text-red-400' : 'text-base-content/70',
            )}
        >
            {dot && <span className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', PILL_DOT[tone])} />}
            {children}
        </span>
    );
}

/** Outlined tier badge (ultra / pro / free): subtle, rounded-sm text, never a solid block. */
export function TierBadge({ tier, children, icon }: { tier: 'ultra' | 'pro' | 'free'; children: ReactNode; icon?: ReactNode }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border text-[11px] font-medium leading-4',
                tier === 'ultra' && 'border-base-content/30 text-base-content',
                tier === 'pro' && 'border-base-content/20 text-base-content/80',
                tier === 'free' && 'border-base-content/10 text-base-content/50',
            )}
        >
            {icon}
            {children}
        </span>
    );
}
