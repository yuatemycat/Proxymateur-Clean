import { create } from 'zustand';

export interface LowQuotaAlert {
    accountId: string;
    accountEmail: string;
    accountLabel?: string;
    quotaPercentage: number;
    lowModelType: 'gemini' | 'claude' | 'general';
    bestCandidate: {
        id: string;
        email: string;
        label?: string;
        quotaPercentage: number;
    } | null;
    timestamp: number;
}

export interface DismissedRecord {
    dismissedQuota: number;
    dismissedAt: number;
}

interface LowQuotaAlertState {
    activeAlert: LowQuotaAlert | null;
    dismissedAccounts: Map<string, DismissedRecord>;
    setAlert: (alert: LowQuotaAlert) => void;
    dismissAlert: (accountId: string) => void;
    clearAlert: () => void;
}

export const useLowQuotaAlertStore = create<LowQuotaAlertState>((set) => ({
    activeAlert: null,
    dismissedAccounts: new Map<string, DismissedRecord>(),

    setAlert: (alert: LowQuotaAlert) => {
        set((state) => {
            const record = state.dismissedAccounts.get(alert.accountId);
            if (record) {
                const drop = record.dismissedQuota - alert.quotaPercentage;
                const timePassed = Date.now() - record.dismissedAt;
                const cooldownPassed = timePassed >= 30 * 60 * 1000; // 30 minutes
                const droppedSignificantly = drop >= 5;

                // Do not re-show if not dropped by 5%+ and 30m cooldown has not elapsed
                if (!droppedSignificantly && !cooldownPassed) {
                    return state;
                }

                // If qualifying for re-alert, clear old dismissal record
                const newDismissed = new Map(state.dismissedAccounts);
                newDismissed.delete(alert.accountId);
                return { activeAlert: alert, dismissedAccounts: newDismissed };
            }

            // If same alert already active with equal or lower quota, avoid re-rendering
            if (state.activeAlert && state.activeAlert.accountId === alert.accountId && alert.quotaPercentage >= state.activeAlert.quotaPercentage) {
                return state;
            }

            return { activeAlert: alert };
        });
    },

    dismissAlert: (accountId: string) => {
        set((state) => {
            const currentQuota = state.activeAlert?.accountId === accountId 
                ? state.activeAlert.quotaPercentage 
                : 0;
            const newDismissed = new Map(state.dismissedAccounts);
            newDismissed.set(accountId, {
                dismissedQuota: currentQuota,
                dismissedAt: Date.now(),
            });
            return {
                activeAlert: state.activeAlert?.accountId === accountId ? null : state.activeAlert,
                dismissedAccounts: newDismissed,
            };
        });
    },

    clearAlert: () => {
        set({ activeAlert: null });
    },
}));
