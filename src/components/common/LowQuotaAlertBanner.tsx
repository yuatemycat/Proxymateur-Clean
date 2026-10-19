import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Zap, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useLowQuotaAlertStore } from '../../stores/useLowQuotaAlertStore';
import { useAccountStore } from '../../stores/useAccountStore';
import { useViewStore } from '../../stores/useViewStore';
import { getAccountDisplayName } from '../../utils/format';
import { showToast } from './ToastContainer';

const AUTO_DISMISS_MS = 8000;

export default function LowQuotaAlertBanner() {
    const { t } = useTranslation();
    const { activeAlert, dismissAlert } = useLowQuotaAlertStore();
    const { switchAccount } = useAccountStore();
    const { isMiniView } = useViewStore();
    const [isSwitching, setIsSwitching] = useState(false);
    const [remainingMs, setRemainingMs] = useState(AUTO_DISMISS_MS);
    const [isPaused, setIsPaused] = useState(false);
    const lastTickRef = useRef<number>(Date.now());

    // Reset timer when activeAlert changes
    useEffect(() => {
        if (activeAlert) {
            setRemainingMs(AUTO_DISMISS_MS);
            setIsPaused(false);
            lastTickRef.current = Date.now();
        }
    }, [activeAlert?.accountId, activeAlert?.quotaPercentage]);

    // Non-blocking auto-dismiss countdown with pause-on-hover
    useEffect(() => {
        if (!activeAlert) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const delta = now - lastTickRef.current;
            lastTickRef.current = now;

            if (!isPaused && !isSwitching) {
                setRemainingMs(prev => {
                    const next = prev - delta;
                    if (next <= 0) {
                        dismissAlert(activeAlert.accountId);
                        return 0;
                    }
                    return next;
                });
            }
        }, 100);

        return () => clearInterval(interval);
    }, [activeAlert, isPaused, isSwitching, dismissAlert]);

    if (!activeAlert) return null;

    const maskEmails = localStorage.getItem('antigravity_mask_emails') !== 'false';

    const accountName = getAccountDisplayName(
        { email: activeAlert.accountEmail, custom_label: activeAlert.accountLabel },
        maskEmails
    );

    const candidateName = activeAlert.bestCandidate
        ? getAccountDisplayName(
              {
                  email: activeAlert.bestCandidate.email,
                  custom_label: activeAlert.bestCandidate.label,
              },
              maskEmails
          )
        : null;

    const handleSwitch = async () => {
        if (!activeAlert.bestCandidate) return;

        setIsSwitching(true);
        try {
            await switchAccount(activeAlert.bestCandidate.id);
            dismissAlert(activeAlert.accountId);
            showToast(
                t('settings.low_quota_alert.switched_success', {
                    name: candidateName,
                    defaultValue: `Switched to ${candidateName}`,
                }),
                'success'
            );
        } catch (error) {
            showToast(`${t('common.error', 'Error')}: ${error}`, 'error');
        } finally {
            setIsSwitching(false);
        }
    };

    const handleDismiss = () => {
        dismissAlert(activeAlert.accountId);
    };

    const progressPercent = Math.max(0, Math.min(100, (remainingMs / AUTO_DISMISS_MS) * 100));

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, x: 60, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                className={
                    isMiniView
                        ? 'fixed bottom-2 left-2 right-2 z-[195] pointer-events-none'
                        : 'fixed bottom-6 right-6 z-[195] w-96 max-w-[calc(100vw-3rem)] pointer-events-none'
                }
            >
                <div
                    onMouseEnter={() => setIsPaused(true)}
                    onMouseLeave={() => {
                        lastTickRef.current = Date.now();
                        setIsPaused(false);
                    }}
                    className="relative overflow-hidden pointer-events-auto bg-white/95 dark:bg-base-100/95 border border-amber-300/80 dark:border-amber-700/80 shadow-[0_12px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)] rounded-2xl p-4 backdrop-blur-xl"
                >
                    {/* Subtle ambient amber glow */}
                    <div className="absolute -top-12 -right-12 w-28 h-28 bg-amber-500/15 dark:bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

                    <div className="flex items-start gap-3 relative z-10">
                        <div className="p-2 rounded-xl bg-amber-500/15 dark:bg-amber-500/25 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 shadow-sm">
                            <AlertTriangle className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                                    {t('settings.low_quota_alert.alert_title', 'Low Quota Warning')}
                                </h4>
                                <button
                                    onClick={handleDismiss}
                                    className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                                    title={t('common.close', 'Close')}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 line-clamp-2 leading-relaxed">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {accountName}
                                </span>{' '}
                                {t('settings.low_quota_alert.quota_low_msg', 'is running low on quota')} (
                                <span className="font-bold text-amber-600 dark:text-amber-400">
                                    {activeAlert.quotaPercentage}%
                                </span>
                                ).
                            </p>

                            <div className="mt-3 flex items-center gap-2">
                                {activeAlert.bestCandidate ? (
                                    <button
                                        onClick={handleSwitch}
                                        disabled={isSwitching}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                                    >
                                        {isSwitching ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Zap className="w-3.5 h-3.5" />
                                        )}
                                        <span className="truncate max-w-[190px]">
                                            {t('settings.low_quota_alert.switch_to', {
                                                name: candidateName,
                                                quota: activeAlert.bestCandidate.quotaPercentage,
                                                defaultValue: `Switch to ${candidateName} (${activeAlert.bestCandidate.quotaPercentage}%)`,
                                            })}
                                        </span>
                                    </button>
                                ) : (
                                    <span className="text-[11px] text-gray-500 dark:text-gray-400 italic">
                                        {t(
                                            'settings.low_quota_alert.all_accounts_low',
                                            'All accounts are running low on quota'
                                        )}
                                    </span>
                                )}

                                <button
                                    onClick={handleDismiss}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                >
                                    {t('settings.low_quota_alert.dismiss', 'Dismiss')}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Auto-dismiss countdown progress line */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500/15 dark:bg-amber-500/10 overflow-hidden rounded-b-2xl">
                        <div
                            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-100 ease-linear"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
