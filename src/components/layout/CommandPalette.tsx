import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Settings } from 'lucide-react';
import { useConfigStore } from '../../stores/useConfigStore';
import { SIDEBAR_HUBS, SETTINGS_PATH, type SidebarItem } from './sidebarConfig';

const SETTINGS_ITEM: SidebarItem = {
    path: SETTINGS_PATH,
    labelKey: 'nav.settings',
    defaultLabel: 'Settings',
    icon: Settings,
};

/** Ctrl/Cmd+K quick-jump palette over all visible sidebar routes. */
export function CommandPalette() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isMenuItemHidden } = useConfigStore();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [index, setIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        return [...SIDEBAR_HUBS.flatMap(h => h.items), SETTINGS_ITEM]
            .filter(item => !isMenuItemHidden(item.path))
            .map(item => ({ item, label: t(item.labelKey, item.defaultLabel) }))
            .filter(({ item, label }) => !q || label.toLowerCase().includes(q) || item.path.includes(q));
    }, [query, isMenuItemHidden, t]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setQuery('');
                setIndex(0);
                setOpen(o => !o);
            } else if (e.key === 'Escape') {
                setOpen(false);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    if (!open) return null;

    const go = (path: string) => {
        setOpen(false);
        navigate(path);
    };

    const onInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIndex(i => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && results[index]) {
            go(results[index].item.path);
        }
    };

    return (
        <div
            className="fixed inset-0 flex items-start justify-center pt-[15vh] bg-black/40"
            style={{ zIndex: 10000 }}
            onMouseDown={() => setOpen(false)}
        >
            <div
                className="w-full max-w-md mx-4 rounded-xl bg-white dark:bg-base-200 shadow-2xl border border-gray-200 dark:border-base-100 overflow-hidden"
                onMouseDown={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-base-100">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => { setQuery(e.target.value); setIndex(0); }}
                        onKeyDown={onInputKeyDown}
                        placeholder={t('nav.quick_jump', 'Jump to...')}
                        className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-base-content"
                    />
                </div>
                <ul className="max-h-72 overflow-y-auto py-1">
                    {results.map(({ item, label }, i) => (
                        <li key={item.path}>
                            <button
                                onClick={() => go(item.path)}
                                onMouseEnter={() => setIndex(i)}
                                className={`w-full px-4 py-2 flex items-center gap-3 text-sm text-left ${i === index ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}
                            >
                                <item.icon className="w-4 h-4" />
                                <span>{label}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
