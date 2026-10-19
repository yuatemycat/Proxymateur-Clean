import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, LogOut, Minimize2, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Mascot from '../common/Mascot';
import { useConfigStore } from '../../stores/useConfigStore';
import { useViewStore } from '../../stores/useViewStore';
import { useSidebarStore } from '../../stores/useSidebarStore';
import { isTauri, isLinux } from '../../utils/env';
import { isActive } from '../navbar/constants';
import { SIDEBAR_HUBS, SETTINGS_PATH, SIDEBAR_AUTO_COLLAPSE_WIDTH } from './sidebarConfig';

const NARROW_QUERY = `(max-width: ${SIDEBAR_AUTO_COLLAPSE_WIDTH}px)`;

/** True while the viewport is narrower than the auto-collapse breakpoint. */
function useIsNarrow(): boolean {
    const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
    useEffect(() => {
        const mql = window.matchMedia(NARROW_QUERY);
        const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, []);
    return narrow;
}

// Minimal sidebar: follows the theme; the active route gets a soft tint and a thin lime marker.
const itemClass = (active: boolean, collapsed: boolean) => `
    relative flex items-center gap-3 rounded-md text-sm transition-colors whitespace-nowrap
    ${collapsed ? 'justify-center w-10 h-10 mx-auto' : 'px-3 py-2'}
    ${active
        ? 'bg-base-content/[0.07] text-base-content font-medium before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-lime-signal'
        : 'text-base-content/60 hover:text-base-content hover:bg-base-content/[0.04]'}
`;

const footerBtnClass = 'w-9 h-9 rounded-md flex items-center justify-center text-base-content/60 hover:text-base-content hover:bg-base-content/[0.06] transition-colors';

/**
 * Left sidebar: hub-grouped navigation, collapsible to an icon rail.
 * Footer hosts the controls formerly in the top navbar (mini view, theme, logout).
 */
export default function Sidebar() {
    const { t } = useTranslation();
    const location = useLocation();
    const { config, saveConfig, isMenuItemHidden } = useConfigStore();
    const { setMiniView } = useViewStore();
    const { collapsed: userCollapsed, toggleCollapsed } = useSidebarStore();
    const isNarrow = useIsNarrow();
    const collapsed = userCollapsed || isNarrow;

    const theme = (config?.theme as 'light' | 'dark') || 'light';

    // Theme toggle with View Transition circular reveal (skipped on Linux, may crash)
    const toggleTheme = async (event: React.MouseEvent<HTMLButtonElement>) => {
        if (!config) return;
        const newTheme = config.theme === 'light' ? 'dark' : 'light';

        if ('startViewTransition' in document && !isLinux()) {
            const x = event.clientX;
            const y = event.clientY;
            const endRadius = Math.hypot(
                Math.max(x, window.innerWidth - x),
                Math.max(y, window.innerHeight - y)
            );

            // @ts-ignore
            const transition = document.startViewTransition(async () => {
                saveConfig({ ...config, theme: newTheme, language: config.language }, true);
            });

            transition.ready.then(() => {
                const isDarkMode = newTheme === 'dark';
                const clipPath = isDarkMode
                    ? [`circle(${endRadius}px at ${x}px ${y}px)`, `circle(0px at ${x}px ${y}px)`]
                    : [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`];

                document.documentElement.animate(
                    { clipPath },
                    {
                        duration: 500,
                        easing: 'ease-in-out',
                        fill: 'forwards',
                        pseudoElement: isDarkMode ? '::view-transition-old(root)' : '::view-transition-new(root)'
                    }
                );
            });
        } else {
            await saveConfig({ ...config, theme: newTheme, language: config.language }, true);
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('abv_admin_api_key');
        localStorage.removeItem('abv_admin_api_key');
        window.location.reload();
    };

    const settingsLabel = t('nav.settings', 'Settings');
    const hubs = SIDEBAR_HUBS
        .map(hub => ({ ...hub, items: hub.items.filter(item => !isMenuItemHidden(item.path)) }))
        .filter(hub => hub.items.length > 0);

    return (
        <aside
            className={`relative shrink-0 h-full flex flex-col pt-9 bg-base-100 text-base-content border-r border-base-content/10 transition-[width] duration-200 ${collapsed ? 'w-16' : 'w-60'}`}
            style={{ zIndex: 50 }}
        >
            {/* Logo */}
            <Link
                to="/"
                draggable="false"
                title={collapsed ? t('common.app_name', 'Proxymateur') : undefined}
                className={`flex items-center gap-2.5 h-14 shrink-0 text-base-content ${collapsed ? 'justify-center' : 'px-4'}`}
            >
                <Mascot size={collapsed ? 20 : 22} className="shrink-0 text-base-content active:scale-95 transition-transform" face="var(--color-base-100)" />
                {!collapsed && (
                    <span className="truncate text-[17px] leading-none font-semibold tracking-tight">
                        {t('common.app_name', 'Proxymateur')}
                    </span>
                )}
            </Link>

            {/* Hub navigation */}
            <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 pb-2">
                {hubs.map((hub, hubIndex) => (
                    <div key={hub.id} className="mb-3">
                        {collapsed ? (
                            hubIndex > 0 && <div className="my-2 mx-3 border-t border-base-content/10" />
                        ) : (
                            <div className="flex items-center gap-2 px-3 pt-4 pb-1 text-[11px] font-medium text-base-content/40">
                                <hub.icon className="w-3.5 h-3.5" />
                                <span className="truncate">{t(hub.labelKey, hub.defaultLabel)}</span>
                            </div>
                        )}
                        <div className="flex flex-col gap-1">
                            {hub.items.map(item => {
                                const label = t(item.labelKey, item.defaultLabel);
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        draggable="false"
                                        title={collapsed ? label : undefined}
                                        aria-label={label}
                                        className={itemClass(isActive(location.pathname, item.path), collapsed)}
                                    >
                                        <item.icon className="w-5 h-5 shrink-0" />
                                        {!collapsed && <span className="truncate">{label}</span>}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Pinned settings */}
            {!isMenuItemHidden(SETTINGS_PATH) && (
                <div className="px-2 pb-2">
                    <Link
                        to={SETTINGS_PATH}
                        draggable="false"
                        title={collapsed ? settingsLabel : undefined}
                        aria-label={settingsLabel}
                        className={itemClass(isActive(location.pathname, SETTINGS_PATH), collapsed)}
                    >
                        <Settings className="w-5 h-5 shrink-0" />
                        {!collapsed && <span className="truncate">{settingsLabel}</span>}
                    </Link>
                </div>
            )}

            {/* Footer controls */}
            <div className={`flex gap-2 p-2 border-t border-base-content/10 ${collapsed ? 'flex-col items-center' : 'flex-wrap justify-center'}`}>
                <button
                    onClick={() => setMiniView(true)}
                    className={footerBtnClass}
                    title={t('nav.mini_view', 'Mini View')}
                >
                    <Minimize2 className="w-5 h-5" />
                </button>

                <button
                    onClick={toggleTheme}
                    className={footerBtnClass}
                    title={theme === 'light' ? t('nav.theme_to_dark') : t('nav.theme_to_light')}
                >
                    {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </button>

                {!isTauri() && (
                    <button
                        onClick={handleLogout}
                        className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center justify-center transition-colors"
                        title={t('nav.logout', 'Logout')}
                    >
                        <LogOut className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </button>
                )}

                {!isNarrow && (
                    <button
                        onClick={toggleCollapsed}
                        className={footerBtnClass}
                        title={collapsed ? t('nav.expand_sidebar', 'Expand sidebar') : t('nav.collapse_sidebar', 'Collapse sidebar')}
                    >
                        {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
                    </button>
                )}
            </div>
        </aside>
    );
}
