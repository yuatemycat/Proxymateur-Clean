import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
    icon: LucideIcon;
    title: string;
    value: string | number;
    description?: string;
    colorClass?: string;
}

/** Flat ledger cell (no card chrome): label, big numeral, hint. The dashboard itself uses <Ticker />. */
function StatsCard({ icon: Icon, title, value, description }: StatsCardProps) {
    return (
        <div className="px-4 py-3 border-l-4 border-base-content">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-base-content/60">
                <Icon className="w-3.5 h-3.5" />
                {title}
            </div>
            <div className="mt-1 text-5xl leading-none font-black tabular-nums [font-stretch:75%]">{value}</div>
            {description && <div className="mt-2 text-xs text-base-content/60">{description}</div>}
        </div>
    );
}

export default StatsCard;
