import {
    LayoutDashboard,
    Users,
    Network,
    Activity,
    BarChart3,
    Home,
    Bot,
    Eye,
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
    {
        id: 'agent-proxy',
        labelKey: 'nav.hub_agent_proxy',
        defaultLabel: 'Agent Proxy',
        icon: Bot,
        items: [
            { path: '/api-proxy', labelKey: 'nav.proxy', defaultLabel: 'API Proxy', icon: Network },
        ],
    },
    {
        id: 'observability',
        labelKey: 'nav.hub_observability',
        defaultLabel: 'Observability',
        icon: Eye,
        items: [
            { path: '/monitor', labelKey: 'nav.call_records', defaultLabel: 'Traffic Logs', icon: Activity },
            { path: '/token-stats', labelKey: 'nav.token_stats', defaultLabel: 'Token Stats', icon: BarChart3 },
        ],
    },
];
