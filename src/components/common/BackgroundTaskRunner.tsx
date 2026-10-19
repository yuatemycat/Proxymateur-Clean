import { useEffect, useRef } from 'react';
import { useConfigStore } from '../../stores/useConfigStore';
import { useAccountStore } from '../../stores/useAccountStore';
import { checkLowQuotaAccounts, requestNotificationPermission } from '../../utils/lowQuotaMonitor';

function BackgroundTaskRunner() {
    const { config } = useConfigStore();
    const { refreshAllQuotas, accounts, currentAccount } = useAccountStore();

    // Use refs to track previous state to detect "off -> on" transitions
    const prevAutoRefreshRef = useRef(false);
    const prevAutoSyncRef = useRef(false);

    // Auto Refresh Quota Effect
    useEffect(() => {
        if (!config) return;

        let intervalId: ReturnType<typeof setTimeout> | null = null;
        const { auto_refresh, refresh_interval } = config;

        // Check if we just turned it on
        if (auto_refresh && !prevAutoRefreshRef.current) {
            console.log('[BackgroundTask] Auto-refresh enabled, executing immediately...');
            refreshAllQuotas();
        }
        prevAutoRefreshRef.current = auto_refresh;

        if (auto_refresh && refresh_interval > 0) {
            console.log(`[BackgroundTask] Starting auto-refresh quota timer: ${refresh_interval} mins`);
            intervalId = setInterval(() => {
                console.log('[BackgroundTask] Auto-refreshing all quotas...');
                refreshAllQuotas();
            }, Math.min(refresh_interval * 60 * 1000, 2147483647));
        }

        return () => {
            if (intervalId) {
                console.log('[BackgroundTask] Clearing auto-refresh timer');
                clearInterval(intervalId);
            }
        };
    }, [config?.auto_refresh, config?.refresh_interval]);

    // Auto Sync Current Account Effect
    useEffect(() => {
        if (!config) return;

        let intervalId: ReturnType<typeof setTimeout> | null = null;
        const { auto_sync, sync_interval } = config;
        const { syncAccountFromDb } = useAccountStore.getState();

        // Check if we just turned it on
        if (auto_sync && !prevAutoSyncRef.current) {
            console.log('[BackgroundTask] Auto-sync enabled, executing immediately...');
            syncAccountFromDb();
        }
        prevAutoSyncRef.current = auto_sync;

        if (auto_sync && sync_interval > 0) {
            console.log(`[BackgroundTask] Starting auto-sync account timer: ${sync_interval} mins`);
            intervalId = setInterval(() => {
                console.log('[BackgroundTask] Auto-syncing current account from DB...');
                syncAccountFromDb();
            }, Math.min(sync_interval * 60 * 1000, 2147483647));
        }

        return () => {
            if (intervalId) {
                console.log('[BackgroundTask] Clearing auto-sync timer');
                clearInterval(intervalId);
            }
        };
    }, [config?.auto_sync, config?.sync_interval]);

    // Low Quota Alert Detection Effect
    useEffect(() => {
        if (!config?.low_quota_alert?.enabled) return;

        // Request notification permission if system notification enabled
        if (config.low_quota_alert.notify_system) {
            requestNotificationPermission();
        }

        if (accounts && accounts.length > 0) {
            const maskEmails = localStorage.getItem('antigravity_mask_emails') !== 'false';
            checkLowQuotaAccounts(accounts, currentAccount?.id, config.low_quota_alert, maskEmails);
        }
    }, [accounts, currentAccount?.id, config?.low_quota_alert]);

    // Periodic Low Quota Alert Check (every 60s)
    useEffect(() => {
        if (!config?.low_quota_alert?.enabled) return;

        const intervalId = setInterval(() => {
            const { accounts: liveAccounts, currentAccount: liveCurrentAccount } = useAccountStore.getState();
            if (liveAccounts && liveAccounts.length > 0) {
                const maskEmails = localStorage.getItem('antigravity_mask_emails') !== 'false';
                checkLowQuotaAccounts(liveAccounts, liveCurrentAccount?.id, config.low_quota_alert, maskEmails);
            }
        }, 60 * 1000);

        return () => {
            clearInterval(intervalId);
        };
    }, [config?.low_quota_alert]);

    // Render nothing
    return null;
}

export default BackgroundTaskRunner;
