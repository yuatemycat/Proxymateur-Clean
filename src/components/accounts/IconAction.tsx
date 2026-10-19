import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '../../utils/cn';

/** Quiet icon button used in row / tile action clusters. */
export function IconAction({
    title,
    onClick,
    disabled,
    busy,
    tone = 'default',
    children,
}: {
    title: string;
    onClick: (e: React.MouseEvent) => void;
    disabled?: boolean;
    /** Action in flight / currently engaged. */
    busy?: boolean;
    tone?: 'default' | 'danger' | 'warn';
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            className={cn(
                'inline-flex items-center justify-center w-7 h-7 shrink-0 rounded-md transition-colors',
                busy
                    ? 'bg-base-content/10 text-base-content'
                    : tone === 'warn'
                        ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                        : tone === 'danger'
                            ? 'text-base-content/60 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400'
                            : 'text-base-content/60 hover:bg-base-content/10 hover:text-base-content',
                disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
            )}
            onClick={onClick}
            title={title}
            disabled={disabled}
        >
            {children}
        </button>
    );
}

export interface ActionMenuItem {
    key: string;
    label: string;
    /** Tooltip (e.g. the reason an item is disabled). Falls back to the label. */
    title?: string;
    icon?: ReactNode;
    onClick: () => void;
    disabled?: boolean;
    tone?: 'default' | 'danger';
    /** Draw a hairline above this item. */
    separatorBefore?: boolean;
}

const MENU_WIDTH = 224;
const MENU_GAP = 4;
const VIEWPORT_PAD = 8;

/**
 * "..." overflow menu. The popover is portalled to <body> with fixed positioning so it is never
 * clipped by the table's scroll containers; closes on outside click, Escape, scroll or resize.
 */
export function ActionMenu({
    title,
    items,
}: {
    title: string;
    items: Array<ActionMenuItem | false | null | undefined>;
}) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const visible = items.filter((i): i is ActionMenuItem => Boolean(i));

    // Position after the menu has rendered so its real height can drive the flip-up decision.
    useLayoutEffect(() => {
        if (!open || !buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        const height = menuRef.current?.offsetHeight ?? 0;
        let left = rect.right - MENU_WIDTH;
        left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - MENU_WIDTH - VIEWPORT_PAD));
        let top = rect.bottom + MENU_GAP;
        if (top + height > window.innerHeight - VIEWPORT_PAD) {
            top = Math.max(VIEWPORT_PAD, rect.top - height - MENU_GAP);
        }
        setPos((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
    }, [open, visible.length]);

    useEffect(() => {
        if (!open) return;
        const close = () => setOpen(false);
        const onMouseDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            close();
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        const onScroll = (e: Event) => {
            if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
            close();
        };
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('keydown', onKeyDown);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', close);
        return () => {
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', close);
        };
    }, [open]);

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                className={cn(
                    'inline-flex items-center justify-center w-7 h-7 shrink-0 rounded-md transition-colors',
                    open
                        ? 'bg-base-content/10 text-base-content'
                        : 'text-base-content/60 hover:bg-base-content/10 hover:text-base-content',
                )}
                title={title}
                aria-label={title}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={(e) => {
                    e.stopPropagation();
                    setPos(null);
                    setOpen((v) => !v);
                }}
            >
                <MoreHorizontal className="w-4 h-4" />
            </button>
            {open &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="menu"
                        className="fixed z-[200] rounded-lg border border-base-content/10 bg-base-100 py-1 shadow-lg shadow-black/10"
                        style={{
                            width: MENU_WIDTH,
                            top: pos?.top ?? 0,
                            left: pos?.left ?? 0,
                            visibility: pos ? 'visible' : 'hidden',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {visible.map((item) => (
                            <div key={item.key}>
                                {item.separatorBefore && <div className="my-1 border-t border-base-content/10" />}
                                <button
                                    type="button"
                                    role="menuitem"
                                    disabled={item.disabled}
                                    title={item.title ?? item.label}
                                    onClick={() => {
                                        setOpen(false);
                                        item.onClick();
                                    }}
                                    className={cn(
                                        'w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors',
                                        item.tone === 'danger'
                                            ? 'text-red-600 dark:text-red-400 hover:bg-red-500/10'
                                            : 'text-base-content/80 hover:bg-base-content/5 hover:text-base-content',
                                        item.disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
                                    )}
                                >
                                    {item.icon && <span className="shrink-0 w-3.5 h-3.5 flex items-center justify-center">{item.icon}</span>}
                                    <span className="truncate">{item.label}</span>
                                </button>
                            </div>
                        ))}
                    </div>,
                    document.body,
                )}
        </>
    );
}
