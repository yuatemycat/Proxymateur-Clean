import { create } from 'zustand';

const STORAGE_KEY = 'agm_sidebar_collapsed';

const readCollapsed = (): boolean => {
    try {
        return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
        return false;
    }
};

const writeCollapsed = (value: boolean) => {
    try {
        localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
        // localStorage unavailable (private mode / blocked); keep in-memory state only
    }
};

interface SidebarState {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    toggleCollapsed: () => void;
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
    collapsed: readCollapsed(),
    setCollapsed: (collapsed) => {
        writeCollapsed(collapsed);
        set({ collapsed });
    },
    toggleCollapsed: () => get().setCollapsed(!get().collapsed),
}));
