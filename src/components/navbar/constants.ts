import type { LucideIcon } from 'lucide-react';

// 类型定义
export interface NavItem {
    path: string;
    label: string;
    icon: LucideIcon;
    priority: 'high' | 'medium' | 'low';
}

export interface Language {
    code: string;
    label: string;
    short: string;
}

// 语言配置
// English-only build: only English is offered (legacy navbar components are no longer mounted).
export const LANGUAGES: Language[] = [
    { code: 'en', label: 'English', short: 'EN' },
];

// 工具函数
export const isActive = (pathname: string, itemPath: string): boolean => {
    if (itemPath === '/') {
        return pathname === '/';
    }
    return pathname.startsWith(itemPath);
};

export const getCurrentNavItem = (pathname: string, navItems: NavItem[]): NavItem => {
    return navItems.find(item => isActive(pathname, item.path)) || navItems[0];
};
