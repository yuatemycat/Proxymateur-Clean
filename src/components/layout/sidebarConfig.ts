import {
    LayoutDashboard,
    Users,
    Home,
    BookOpen,
    type LucideIcon,
} from 'lucide-react';

export interface SidebarItem {
    path: string;
    labelKey: string;
    defaultLabel: string;
    icon: LucideIcon;
}

export interface SidebarHub {
    id: string;
    labelKey: string;
    defaultLabel: string;
    icon: LucideIcon;
    items: SidebarItem[];
}

/** /settings is pinned to the bottom of the sidebar, outside of any hub. */
export const SETTINGS_PATH = '/settings';

/** Viewport width (px) below which the sidebar auto-collapses to the icon rail. */
export const SIDEBAR_AUTO_COLLAPSE_WIDTH = 900;

// Every top-level route (except /settings) appears in exactly one hub.
export const SIDEBAR_HUBS: SidebarHub[] = [
    {
        id: 'hub',
        labelKey: 'nav.hub_overview',
        defaultLabel: 'Hub',
        icon: Home,
        items: [
            { path: '/', labelKey: 'nav.dashboard', defaultLabel: 'Dashboard', icon: LayoutDashboard },
            { path: '/accounts', labelKey: 'nav.accounts', defaultLabel: 'Accounts', icon: Users },
            { path: '/readme', labelKey: 'nav.readme', defaultLabel: 'Readme', icon: BookOpen },
        ],
    },
];
