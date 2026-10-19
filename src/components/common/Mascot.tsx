interface MascotProps {
    /** Rendered height in px (width follows the aspect ratio). */
    size?: number;
    /** Body colour; defaults to the surrounding text colour. */
    className?: string;
    /** Colour of the face marks (eyes, brows, pout). Should contrast with the body. */
    face?: string;
}

/**
 * The Proxymateur "M": a sulky little block-letter with hands on his hips.
 * Same geometry as the app icon (src-tauri/icons), drawn as inline SVG.
 */
export default function Mascot({ size = 32, className = '', face = '#0A0A0A' }: MascotProps) {
    const height = size;
    const width = Math.round((size * 490) / 270);
    return (
        <svg
            role="img"
            aria-label="Proxymateur"
            width={width}
            height={height}
            viewBox="400 640 490 270"
            className={className}
            fill="currentColor"
        >
            {/* body: M-shaped top, solid block below */}
            <polygon points="490,846 490,666 504,652 564,652 648,726 732,652 792,652 806,666 806,846" />
            {/* little M legs */}
            <rect x="512" y="826" width="84" height="78" rx="16" />
            <rect x="700" y="826" width="84" height="78" rx="16" />
            {/* arms akimbo */}
            <g fill="none" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="488,736 424,788 488,852" />
                <polyline points="808,736 872,788 808,852" />
            </g>
            {/* face */}
            <g fill={face} stroke={face} strokeLinecap="round">
                <circle cx="602" cy="764" r="13" stroke="none" />
                <circle cx="694" cy="764" r="13" stroke="none" />
                <line x1="566" y1="734" x2="620" y2="750" strokeWidth="10" />
                <line x1="730" y1="734" x2="676" y2="750" strokeWidth="10" />
                <path d="M 610 806 Q 648 780 686 806" fill="none" strokeWidth="11" />
            </g>
        </svg>
    );
}
