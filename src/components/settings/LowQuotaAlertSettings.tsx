import { BellRing } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LowQuotaAlertConfig } from '../../types/config';

interface LowQuotaAlertSettingsProps {
    config?: LowQuotaAlertConfig;
    onChange: (config: LowQuotaAlertConfig) => void;
}

const LowQuotaAlertSettings = ({ config, onChange }: LowQuotaAlertSettingsProps) => {
    const { t } = useTranslation();

    const currentConfig: LowQuotaAlertConfig = config || {
        enabled: true,
        threshold_percentage: 20,
        notify_system: true,
    };

    const handleEnabledChange = (enabled: boolean) => {
        onChange({ ...currentConfig, enabled });
    };

    const handlePercentageChange = (value: string) => {
        const percentage = parseInt(value) || 20;
        const clamped = Math.max(5, Math.min(50, percentage));
        onChange({ ...currentConfig, threshold_percentage: clamped });
    };

    const handleNotifySystemChange = (notify_system: boolean) => {
        onChange({ ...currentConfig, notify_system });
    };

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* Icon - Amber/Orange for alerts */}
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                        <BellRing size={20} />
                    </div>
                    <div>
                        <div className="font-bold text-gray-900 dark:text-gray-100">
                            {t('settings.low_quota_alert.title', 'Low Quota Alert & Auto-Switch Suggestion')}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {t('settings.low_quota_alert.desc', 'Autodetects accounts approaching low quota gradually and delivers system and in-app notifications recommending the best high-quota account to switch to.')}
                        </p>
                    </div>
                </div>

                {/* Enable toggle */}
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={currentConfig.enabled}
                        onChange={(e) => handleEnabledChange(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-base-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 shadow-inner"></div>
                </label>
            </div>

            {/* Expanded details */}
            {currentConfig.enabled && (
                <div className="mt-5 pt-5 border-t border-gray-100 dark:border-base-200 space-y-5 animate-in slide-in-from-top-1 duration-200">
                    {/* Threshold Percentage */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                {t('settings.low_quota_alert.threshold_label', 'Low Quota Threshold')}
                            </label>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                                {t('settings.low_quota_alert.threshold_hint', 'Trigger alert when remaining quota falls to or below this percentage (5% - 50%)')}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min="5"
                                max="50"
                                step="5"
                                value={currentConfig.threshold_percentage}
                                onChange={(e) => handlePercentageChange(e.target.value)}
                                className="w-32 accent-amber-500"
                            />
                            <div className="relative flex items-center gap-1">
                                <input
                                    type="number"
                                    className="w-16 px-2.5 py-1.5 bg-gray-50 dark:bg-base-200 border border-gray-200 dark:border-base-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm font-bold text-amber-600 dark:text-amber-400 text-center"
                                    min="5"
                                    max="50"
                                    value={currentConfig.threshold_percentage}
                                    onChange={(e) => handlePercentageChange(e.target.value)}
                                />
                                <span className="text-xs font-bold text-gray-400 dark:text-gray-500">%</span>
                            </div>
                        </div>
                    </div>

                    {/* System Desktop Notification Toggle */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-base-300/50">
                        <div>
                            <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                {t('settings.low_quota_alert.notify_system', 'OS Desktop Notification')}
                            </div>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                                {t('settings.low_quota_alert.notify_system_desc', 'Send native Windows desktop notification with 1-click focus when quota is low')}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {currentConfig.notify_system && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            const { sendOsNotification } = await import('../../utils/lowQuotaMonitor');
                                            await sendOsNotification(
                                                'Antigravity Quota Alert',
                                                'Test Notification: Windows desktop notifications are working properly!'
                                            );
                                            const { showToast } = await import('../common/ToastContainer');
                                            showToast(t('settings.low_quota_alert.test_sent', 'Test notification sent!'), 'success');
                                        } catch (e) {
                                            console.error('Failed to send test notification:', e);
                                        }
                                    }}
                                    className="px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg transition-colors cursor-pointer"
                                >
                                    {t('settings.low_quota_alert.test_btn', 'Test Notification')}
                                </button>
                            )}
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={currentConfig.notify_system}
                                    onChange={(e) => handleNotifySystemChange(e.target.checked)}
                                />
                                <div className="w-9 h-5 bg-gray-200 dark:bg-base-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500 shadow-inner"></div>
                            </label>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LowQuotaAlertSettings;
