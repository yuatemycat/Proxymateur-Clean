import { useState, useEffect, startTransition } from 'react';
import { Save, Github, User, ExternalLink, RefreshCw, Heart, LayoutDashboard, Users, Settings as SettingsIcon, CheckCircle2, Bot, BookOpen, Copy } from 'lucide-react';
import { request as invoke } from '../utils/request';
import { open } from '@tauri-apps/plugin-dialog';
import { useConfigStore } from '../stores/useConfigStore';
import { AppConfig } from '../types/config';
import ModalDialog from '../components/common/ModalDialog';
import { showToast } from '../components/common/ToastContainer';
import QuotaProtection from '../components/settings/QuotaProtection';
import SmartWarmup from '../components/settings/SmartWarmup';
import PinnedQuotaModels from '../components/settings/PinnedQuotaModels';
import LowQuotaAlertSettings from '../components/settings/LowQuotaAlertSettings';
import AntigravityLabSettings from '../components/settings/AntigravityLabSettings';
import OAuthSettings from '../components/settings/OAuthSettings';
import { useDebugConsole } from '../stores/useDebugConsole';

import { useTranslation } from 'react-i18next';
import { isTauri } from '../utils/env';
import { relaunch } from '@tauri-apps/plugin-process';
import { emit } from '@tauri-apps/api/event';

import DebugConsole from '../components/debug/DebugConsole';
import { PageHeader, SectionRule } from '../components/common/ledger';

function normalizeDataDirDisplay(path: string): string {
    const trimmed = path.trim();
    if (trimmed.startsWith('\\\\?\\UNC\\')) {
        return `\\\\${trimmed.slice('\\\\?\\UNC\\'.length)}`;
    }
    if (trimmed.startsWith('\\\\?\\')) {
        return trimmed.slice('\\\\?\\'.length);
    }
    if (trimmed.startsWith('//?/UNC/')) {
        return `//${trimmed.slice('//?/UNC/'.length)}`;
    }
    if (trimmed.startsWith('//?/')) {
        return trimmed.slice('//?/'.length);
    }
    return trimmed;
}

function Settings() {
    const { t } = useTranslation();
    const { config, loadConfig, saveConfig, updateTheme } = useConfigStore();
    const { enable, disable, isEnabled } = useDebugConsole();
    const [activeTab, setActiveTab] = useState<'general' | 'account' | 'oauth' | 'advanced' | 'debug' | 'about'>('general');
    const [appVersion, setAppVersion] = useState<string>('1.0.1');
    const [formData, setFormData] = useState<AppConfig>({
        language: 'en',
        theme: 'system',
        auto_refresh: false,
        refresh_interval: 15,
        auto_sync: false,
        sync_interval: 5,
        proxy: {
            enabled: false,
            port: 8080,
            api_key: '',
            auto_start: false,
            request_timeout: 120,
            enable_logging: false,
            upstream_proxy: {
                enabled: false,
                url: ''
            },
            debug_logging: {
                enabled: false,
                output_dir: undefined
            } as { enabled: boolean; output_dir?: string },
            proxy_pool: {
                enabled: false,
                proxies: [],
                health_check_interval: 300,
                auto_failover: true,
                strategy: 'priority',
                account_bindings: {}
            }
        },
        scheduled_warmup: {
            enabled: false,
            monitored_models: [],
            enable_5h_warmup: true
        },
        quota_protection: {
            enabled: false,
            threshold_percentage: 10,
            monitored_models: []
        },
        pinned_quota_models: {
            models: ['gemini-3.1-pro-high', 'gemini-3.8-flash-high', 'gemini-3.1-flash-image', 'claude-sonnet-5-5-high']
        },
        cloudflared: {
            enabled: false,
            mode: 'quick',
            port: 7860,
            use_http2: true
        },
        circuit_breaker: {
            enabled: false,
            backoff_steps: [30, 60, 120, 300, 600]
        },
        low_quota_alert: {
            enabled: true,
            threshold_percentage: 20,
            notify_system: true
        },
        hidden_menu_items: [],  // 菜单显示设置：默认不隐藏任何菜单项

    });

    // Dialog state
    const [dataDirPath, setDataDirPath] = useState<string>('~/.proxymateur/');
    const [pendingDataDir, setPendingDataDir] = useState<string>('');
    const [isMigrateDataDirOpen, setIsMigrateDataDirOpen] = useState(false);
    const [isMigratingDataDir, setIsMigratingDataDir] = useState(false);

    // Antigravity cache clearing state
    const [isClearCacheOpen, setIsClearCacheOpen] = useState(false);
    const [cachePaths, setCachePaths] = useState<string[]>([]);
    const [isClearingCache, setIsClearingCache] = useState(false);

    // Update check state
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<{
        hasUpdate: boolean;
        latestVersion: string;
        currentVersion: string;
        downloadUrl: string;
        source?: string;
        channel?: 'stable' | 'beta';
    } | null>(null);

    // Homebrew Cask state
    const [isBrewInstalled, setIsBrewInstalled] = useState(false);
    const [isBrewUpgrading, setIsBrewUpgrading] = useState(false);
    const [isBrewConfirmOpen, setIsBrewConfirmOpen] = useState(false);
    const [isBrewSuccessOpen, setIsBrewSuccessOpen] = useState(false);
    const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);


    useEffect(() => {
        loadConfig();

        // 获取真实数据目录路径
        invoke<string>('get_data_dir_path')
            .then(path => setDataDirPath(normalizeDataDirDisplay(path)))
            .catch(err => console.error('Failed to get data dir:', err));

        // 加载更新设置
        invoke<{ auto_check: boolean; last_check_time: number; check_interval_hours: number; update_channel?: 'stable' | 'beta' }>('get_update_settings')
            .then(settings => {
                setFormData(prev => ({
                    ...prev,
                    auto_check_update: settings.auto_check,
                    update_check_interval: settings.check_interval_hours,
                    update_channel: settings.update_channel || (appVersion.includes('-') ? 'beta' : 'stable'),
                }));
            })
            .catch(err => console.error('Failed to load update settings:', err));

        // 获取真实的开机自启状态
        invoke<boolean>('is_auto_launch_enabled')
            .then(enabled => {
                setFormData(prev => ({ ...prev, auto_launch: enabled }));
            })
            .catch(err => console.error('Failed to get auto launch status:', err));

        // 获取应用真实版本号
        if (isTauri()) {
            import('@tauri-apps/api/app').then(({ getVersion }) => {
                getVersion().then(v => setAppVersion(v)).catch(() => {});
            });
        }

        // 检测是否通过 Homebrew Cask 安装 (仅 Tauri 环境)
        if (isTauri()) {
            invoke<boolean>('check_homebrew_installation')
                .then(installed => setIsBrewInstalled(installed))
                .catch(err => console.error('Failed to check Homebrew installation:', err));
        }

    }, [loadConfig]);

    useEffect(() => {
        if (config) {
            setFormData({
                ...config,
                low_quota_alert: config.low_quota_alert || {
                    enabled: true,
                    threshold_percentage: 20,
                    notify_system: true,
                },
            });
        }
    }, [config]);

    // 删除自动启用调试控制台的逻辑 - 改为用户手动控制

    const handleSave = async () => {
        try {
            await saveConfig(formData);
            showToast(t('common.saved'), 'success');
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };



    const handleOpenDataDir = async () => {
        try {
            await invoke('open_data_folder');
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    const handleSelectDataDir = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: t('settings.advanced.data_dir_select'),
            });
            if (!selected || typeof selected !== 'string') {
                return;
            }
            if (selected === dataDirPath) {
                return;
            }
            setPendingDataDir(selected);
            setIsMigrateDataDirOpen(true);
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    const confirmMigrateDataDir = async () => {
        if (!pendingDataDir || isMigratingDataDir) {
            return;
        }
        setIsMigratingDataDir(true);
        try {
            const newPath = await invoke<string>('set_data_dir', { path: pendingDataDir });
            setDataDirPath(normalizeDataDirDisplay(newPath));
            setIsMigrateDataDirOpen(false);
            setPendingDataDir('');
            showToast(t('settings.advanced.data_dir_migrated'), 'success');
            showToast(t('settings.advanced.data_dir_restart_hint'), 'info');
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        } finally {
            setIsMigratingDataDir(false);
        }
    };

    const handleSelectExportPath = async () => {
        try {
            // @ts-ignore
            const selected = await open({
                directory: true,
                multiple: false,
                title: t('settings.advanced.export_path'),
            });
            if (selected && typeof selected === 'string') {
                setFormData({ ...formData, default_export_path: selected });
            }
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    const handleSelectAntigravityPath = async () => {
        try {
            const selected = await open({
                directory: false,
                multiple: false,
                title: t('settings.advanced.antigravity_path_select'),
            });
            if (selected && typeof selected === 'string') {
                setFormData({ ...formData, antigravity_executable: selected });
            }
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    const handleSelectAntigravityIdePath = async () => {
        try {
            const selected = await open({
                directory: false,
                multiple: false,
                title: t('settings.advanced.antigravity_ide_path_select', 'Select Antigravity IDE Executable'),
            });
            if (selected && typeof selected === 'string') {
                setFormData({ ...formData, antigravity_ide_executable: selected });
            }
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    const handleDetectAntigravityPath = async () => {
        try {
            const command = isTauri() ? 'get_antigravity_path' : 'get_antigravity_path'; // 后端已统一
            const path = await invoke<string>(command, { bypassConfig: true });
            setFormData({ ...formData, antigravity_executable: path });
            showToast(t('settings.advanced.antigravity_path_detected'), 'success');
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    const handleSelectAntigravityCliPath = async () => {
        try {
            const selected = await open({
                directory: false,
                multiple: false,
                title: t('settings.advanced.antigravity_cli_path_select', 'Select Antigravity CLI (agy) Executable'),
            });
            if (selected && typeof selected === 'string') {
                setFormData({ ...formData, antigravity_cli_executable: selected });
            }
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    const handleDetectAntigravityCliPath = async () => {
        try {
            const path = await invoke<string>('get_antigravity_cli_path', { bypassConfig: true });
            setFormData({ ...formData, antigravity_cli_executable: path });
            showToast(t('settings.advanced.antigravity_cli_path_detected', 'Detected CLI path updated'), 'success');
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    const handleSelectGeminiDesktopPath = async () => {
        try {
            const selected = await open({
                directory: false,
                multiple: false,
                title: t('settings.advanced.gemini_desktop_path_select', 'Select Google Gemini Desktop Executable or Shortcut'),
                filters: [{ name: 'Executables and Shortcuts', extensions: ['exe', 'lnk'] }]
            });
            if (selected && typeof selected === 'string') {
                setFormData({ ...formData, gemini_desktop_executable: selected });
            }
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    const handleDetectGeminiDesktopPath = async () => {
        try {
            const path = await invoke<string>('get_gemini_desktop_path', { bypassConfig: true });
            setFormData({ ...formData, gemini_desktop_executable: path });
            showToast(t('settings.advanced.gemini_desktop_path_detected', 'Detected Google Gemini desktop path'), 'success');
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    const handleInstallGeminiShortcut = async () => {
        try {
            const res = await invoke<string>('install_gemini_shortcut');
            showToast(res, 'success');
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    const handleCheckUpdate = async () => {
        setIsCheckingUpdate(true);
        setUpdateInfo(null);
        try {
            const result = await invoke<{
                has_update: boolean;
                latest_version: string;
                current_version: string;
                download_url: string;
                source?: string;
                channel?: 'stable' | 'beta';
            }>('check_for_updates');

            setUpdateInfo({
                hasUpdate: result.has_update,
                latestVersion: result.latest_version,
                currentVersion: result.current_version,
                downloadUrl: result.download_url,
                source: result.source,
                channel: result.channel,
            });

            if (result.has_update) {
                const sourceMsg = result.source && result.source !== 'GitHub API' ? ` (via ${result.source})` : '';
                showToast(t('settings.about.new_version_available', { version: result.latest_version }) + sourceMsg, 'info');
                setIsUpdateConfirmOpen(true);
            } else {
                showToast(t('settings.about.latest_version'), 'success');
            }
        } catch (error) {
            showToast(`${t('settings.about.update_check_failed')}: ${error}`, 'error');
        } finally {
            setIsCheckingUpdate(false);
        }
    };

    const handleConfirmUpdate = async () => {
        setIsUpdateConfirmOpen(false);
        if (isBrewInstalled) {
            handleBrewUpgrade();
            return;
        }
        if (isTauri()) {
            try {
                await emit('app://trigger-update');
            } catch (err) {
                console.error('Failed to trigger update event:', err);
                if (updateInfo?.downloadUrl) {
                    window.open(updateInfo.downloadUrl, '_blank', 'noopener,noreferrer');
                }
            }
        } else if (updateInfo?.downloadUrl) {
            window.open(updateInfo.downloadUrl, '_blank', 'noopener,noreferrer');
        }
    };

    const handleBrewUpgrade = async () => {
        setIsBrewConfirmOpen(false);
        setIsBrewUpgrading(true);
        try {
            await invoke<string>('brew_upgrade_cask');
            setUpdateInfo(null);
            setIsBrewSuccessOpen(true);
        } catch (error) {
            const errKey = String(error);
            const errMsg = t(`settings.about.brew_error_${errKey}`, t('settings.about.brew_upgrade_failed'));
            showToast(errMsg, 'error');
        } finally {
            setIsBrewUpgrading(false);
        }
    };

    // Handle opening cache clear dialog
    const handleOpenClearCacheDialog = async () => {
        try {
            const paths = await invoke<string[]>('get_antigravity_cache_paths');
            setCachePaths(paths);
            setIsClearCacheOpen(true);
        } catch (error) {
            // If no cache paths found, still allow opening the dialog
            setCachePaths([]);
            setIsClearCacheOpen(true);
        }
    };

    // Handle clearing Antigravity cache
    const confirmClearAntigravityCache = async () => {
        setIsClearingCache(true);
        try {
            const result = await invoke<{
                cleared_paths: string[];
                total_size_freed: number;
                errors: string[];
            }>('clear_antigravity_cache');

            const sizeMB = (result.total_size_freed / 1024 / 1024).toFixed(2);

            if (result.cleared_paths.length > 0) {
                showToast(t('settings.advanced.cache_cleared_success', { size: sizeMB }), 'success');
            } else if (result.errors.length > 0) {
                showToast(`${t('common.error')}: ${result.errors[0]}`, 'error');
            } else {
                showToast(t('settings.advanced.cache_not_found'), 'info');
            }
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        } finally {
            setIsClearingCache(false);
            setIsClearCacheOpen(false);
        }
    };

    return (
        <div className="h-full w-full overflow-y-auto">
            <div className="p-5 space-y-4 max-w-7xl mx-auto">
                <PageHeader
                    kicker="Preferences"
                    title={t('nav.settings')}
                    actions={
                        <button
                            className="btn btn-sm rounded-none bg-base-content text-base-100 border-0 uppercase font-black tracking-[0.14em] gap-2 hover:bg-lime-signal hover:text-[#0A0A0A]"
                            onClick={handleSave}
                        >
                            <Save className="w-4 h-4" />
                            {t('settings.save')}
                        </button>
                    }
                />
                {/* Tab 导航 */}
                <div>
                    <div className="flex flex-wrap items-end gap-1 border-b-4 border-base-content">
                        <button
                            className={`px-5 py-2.5 rounded-none text-xs font-black uppercase tracking-[0.18em] transition-colors border-b-4 -mb-1 ${activeTab === 'general'
                                ? 'bg-base-content text-base-100 border-base-content'
                                : 'text-base-content/60 border-transparent hover:text-base-content hover:border-lime-signal'
                                }`}
                            onClick={() => startTransition(() => setActiveTab('general'))}
                        >
                            {t('settings.tabs.general')}
                        </button>
                        <button
                            className={`px-5 py-2.5 rounded-none text-xs font-black uppercase tracking-[0.18em] transition-colors border-b-4 -mb-1 ${activeTab === 'account'
                                ? 'bg-base-content text-base-100 border-base-content'
                                : 'text-base-content/60 border-transparent hover:text-base-content hover:border-lime-signal'
                                }`}
                            onClick={() => startTransition(() => setActiveTab('account'))}
                        >
                            {t('settings.tabs.account')}
                        </button>
                        <button
                            className={`px-5 py-2.5 rounded-none text-xs font-black uppercase tracking-[0.18em] transition-colors border-b-4 -mb-1 ${activeTab === 'oauth'
                                ? 'bg-base-content text-base-100 border-base-content'
                                : 'text-base-content/60 border-transparent hover:text-base-content hover:border-lime-signal'
                                }`}
                            onClick={() => startTransition(() => setActiveTab('oauth'))}
                        >
                            {t('settings.tabs.oauth', 'OAuth')}
                        </button>
                        <button
                            className={`px-5 py-2.5 rounded-none text-xs font-black uppercase tracking-[0.18em] transition-colors border-b-4 -mb-1 ${activeTab === 'advanced'
                                ? 'bg-base-content text-base-100 border-base-content'
                                : 'text-base-content/60 border-transparent hover:text-base-content hover:border-lime-signal'
                                }`}
                            onClick={() => startTransition(() => setActiveTab('advanced'))}
                        >
                            {t('settings.tabs.advanced')}
                        </button>
                        <button
                            className={`px-5 py-2.5 rounded-none text-xs font-black uppercase tracking-[0.18em] transition-colors border-b-4 -mb-1 ${activeTab === 'debug'
                                ? 'bg-base-content text-base-100 border-base-content'
                                : 'text-base-content/60 border-transparent hover:text-base-content hover:border-lime-signal'
                                }`}
                            onClick={() => startTransition(() => setActiveTab('debug'))}
                        >
                            {t('settings.tabs.debug')}
                        </button>
                        <button
                            className={`px-5 py-2.5 rounded-none text-xs font-black uppercase tracking-[0.18em] transition-colors border-b-4 -mb-1 ${activeTab === 'about'
                                ? 'bg-base-content text-base-100 border-base-content'
                                : 'text-base-content/60 border-transparent hover:text-base-content hover:border-lime-signal'
                                }`}
                            onClick={() => startTransition(() => setActiveTab('about'))}
                        >
                            {t('settings.tabs.about')}
                        </button>
                    </div>
                </div>

                {/* 设置表单 */}
                <div className="pt-1">
                    {/* 通用设置 */}
                    {activeTab === 'general' && (
                        <div>
                            <SectionRule index="01" label={t('settings.general.title')} />

                            {/* 语言选择 */}
                            <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-base-content/20">
                                <label className="text-sm font-black uppercase tracking-wide text-base-content">{t('settings.general.language', 'Language')}</label>
                                <select
                                    className="select select-sm rounded-none border border-base-content/40 bg-base-200 text-base-content w-full sm:w-64 focus:outline-none focus:border-base-content"
                                    value="en"
                                    onChange={(e) => {
                                        setFormData({ ...formData, language: e.target.value });
                                    }}
                                >
                                    <option value="en">English</option>
                                </select>
                            </div>

                            {/* 主题选择 */}
                            <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-base-content/20">
                                <label className="text-sm font-black uppercase tracking-wide text-base-content">{t('settings.general.theme')}</label>
                                <select
                                    className="select select-sm rounded-none border border-base-content/40 bg-base-200 text-base-content w-full sm:w-64 focus:outline-none focus:border-base-content"
                                    value={formData.theme}
                                    onChange={(e) => {
                                        const newTheme = e.target.value;
                                        setFormData({ ...formData, theme: newTheme });
                                        updateTheme(newTheme);
                                    }}
                                >
                                    <option value="light">{t('settings.general.theme_light')}</option>
                                    <option value="dark">{t('settings.general.theme_dark')}</option>
                                    <option value="system">{t('settings.general.theme_system')}</option>
                                </select>
                            </div>

                            {/* 开机自动启动 */}
                            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 border-b border-base-content/20">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-3">
                                        <label className="text-sm font-black uppercase tracking-wide text-base-content">{t('settings.general.auto_launch')}</label>
                                        {!isTauri() && (
                                            <span className="text-xs text-orange-500 dark:text-orange-400">
                                                {t('settings.web_mode_limitation', '(Not supported in web mode)')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-base-content/60 mt-1">{t('settings.general.auto_launch_desc')}</p>
                                </div>
                                <select
                                    className="select select-sm rounded-none border border-base-content/40 bg-base-200 text-base-content w-full sm:w-64 focus:outline-none focus:border-base-content"
                                    value={formData.auto_launch ? 'enabled' : 'disabled'}
                                    onChange={async (e) => {
                                        const enabled = e.target.value === 'enabled';
                                        try {
                                            await invoke('toggle_auto_launch', { enable: enabled });
                                            setFormData({ ...formData, auto_launch: enabled });
                                            showToast(enabled ? t('settings.general.auto_launch_enabled') : t('settings.general.auto_launch_disabled'), 'success');
                                        } catch (error) {
                                            showToast(`${t('common.error')}: ${error}`, 'error');
                                        }
                                    }}
                                >
                                    <option value="disabled">{t('settings.general.auto_launch_disabled')}</option>
                                    <option value="enabled" disabled={!isTauri()}>{t('settings.general.auto_launch_enabled')}</option>

                                </select>
                            </div>

                            {isTauri() && (
                                <div className="flex items-center justify-between gap-4 py-3 border-b border-base-content/20">
                                    <div>
                                        <div className="text-sm font-black uppercase tracking-wide text-base-content">{t('settings.general.quiet_autostart')}</div>
                                        <p className="text-xs text-base-content/60 mt-1">{t('settings.general.quiet_autostart_desc')}</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={formData.quiet_autostart !== false}
                                            onChange={async (e) => {
                                                const enabled = e.target.checked;
                                                const next = { ...formData, quiet_autostart: enabled };
                                                setFormData(next);
                                                if (!config) {
                                                    return;
                                                }
                                                try {
                                                    await saveConfig(next);
                                                    showToast(enabled ? t('settings.general.quiet_autostart_enabled') : t('settings.general.quiet_autostart_disabled'), 'success');
                                                } catch (error) {
                                                    showToast(`${t('common.error')}: ${error}`, 'error');
                                                }
                                            }}
                                        />
                                        <div className="w-11 h-6 bg-base-content/20 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-base-content rounded-none peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-base-100 after:rounded-none after:h-5 after:w-5 after:transition-all peer-checked:bg-base-content peer-checked:after:bg-lime-signal"></div>
                                    </label>
                                </div>
                            )}

                            {/* 自动检查更新 */}
                            <>
                                <div className="flex items-center justify-between gap-4 py-3 border-b border-base-content/20">
                                    <div>
                                        <div className="text-sm font-black uppercase tracking-wide text-base-content">{t('settings.general.auto_check_update')}</div>
                                        <p className="text-xs text-base-content/60 mt-1">{t('settings.general.auto_check_update_desc')}</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={formData.auto_check_update ?? true}
                                            onChange={async (e) => {
                                                const enabled = e.target.checked;
                                                try {
                                                    await invoke('save_update_settings', {
                                                        settings: {
                                                            auto_check: enabled,
                                                            last_check_time: 0,
                                                            check_interval_hours: formData.update_check_interval ?? 24
                                                        }
                                                    });
                                                    setFormData({ ...formData, auto_check_update: enabled });
                                                    showToast(enabled ? t('settings.general.auto_check_update_enabled') : t('settings.general.auto_check_update_disabled'), 'success');
                                                } catch (error) {
                                                    showToast(`${t('common.error')}: ${error}`, 'error');
                                                }
                                            }}
                                        />
                                        <div className="w-11 h-6 bg-base-content/20 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-base-content rounded-none peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-base-100 after:rounded-none after:h-5 after:w-5 after:transition-all peer-checked:bg-base-content peer-checked:after:bg-lime-signal"></div>
                                    </label>
                                </div>

                                {/* 检查间隔 */}
                                {formData.auto_check_update && (
                                    <div className="flex flex-wrap items-center justify-between gap-4 py-3 pl-4 border-b border-base-content/20 border-l-4 border-l-lime-signal">
                                        <div className="min-w-0 flex-1">
                                        <label className="block text-sm font-black uppercase tracking-wide text-base-content">{t('settings.general.update_check_interval')}</label>
                                        <p className="text-xs text-base-content/60 mt-1">{t('settings.general.update_check_interval_desc')}</p>
                                        </div>
                                        <input
                                            type="number"
                                            className="input input-sm w-32 rounded-none border border-base-content/40 bg-base-200 text-base-content focus:outline-none focus:border-base-content"
                                            min="1"
                                            max="168"
                                            value={formData.update_check_interval ?? 24}
                                            onChange={(e) => setFormData({ ...formData, update_check_interval: parseInt(e.target.value) })}
                                            onBlur={async () => {
                                                try {
                                                    await invoke('save_update_settings', {
                                                        settings: {
                                                            auto_check: formData.auto_check_update ?? true,
                                                            last_check_time: 0,
                                                            check_interval_hours: formData.update_check_interval ?? 24
                                                        }
                                                    });
                                                    showToast(t('settings.general.update_check_interval_saved'), 'success');
                                                } catch (error) {
                                                    showToast(`${t('common.error')}: ${error}`, 'error');
                                                }
                                            }}
                                        />
                                    </div>
                                )}
                            </>

                            {/* 轻量模式 (释放内存) */}
                            {isTauri() && (
                                <div className="flex items-center justify-between gap-4 py-3 border-b border-base-content/20">
                                    <div>
                                        <div className="text-sm font-black uppercase tracking-wide text-base-content">{t('settings.general.lightweight_mode')}</div>
                                        <p className="text-xs text-base-content/60 mt-1">{t('settings.general.lightweight_mode_desc')}</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={formData.lightweight_mode ?? false}
                                            onChange={(e) => {
                                                const enabled = e.target.checked;
                                                setFormData({ ...formData, lightweight_mode: enabled });
                                            }}
                                        />
                                        <div className="w-11 h-6 bg-base-content/20 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-base-content rounded-none peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-base-100 after:rounded-none after:h-5 after:w-5 after:transition-all peer-checked:bg-base-content peer-checked:after:bg-lime-signal"></div>
                                    </label>
                                </div>
                            )}

                                {/* 菜单显示设置 */}
                                <div>
                                    <SectionRule index="02" label={t('settings.menu.title')} />
                                    <p className="text-xs text-base-content/60 mb-4">
                                        {t('settings.menu.desc')}
                                    </p>
                                    <div className="grid grid-cols-2 lg:grid-cols-5 border-l-2 border-t-2 border-base-content">
                                        {[
                                            { path: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
                                            { path: '/accounts', label: t('nav.accounts'), icon: Users },
                                            { path: '/chats/agy', label: t('nav.agy_chats', 'AGy-chats'), icon: Bot },
                                            { path: '/readme', label: t('nav.readme', 'Readme'), icon: BookOpen },
                                            { path: '/settings', label: t('nav.settings'), icon: SettingsIcon },
                                        ].map((item) => {
                                            const hiddenItems = formData.hidden_menu_items || [];
                                            const isVisible = !hiddenItems.includes(item.path);
                                            const isSettings = item.path === '/settings';

                                            return (
                                                <div
                                                    key={item.path}
                                                    onClick={async () => {
                                                        if (!isSettings) {
                                                            const originalConfig = { ...formData };
                                                            const hiddenItems = formData.hidden_menu_items || [];
                                                            const newHiddenItems = isVisible
                                                                ? [...hiddenItems, item.path]
                                                                : hiddenItems.filter(p => p !== item.path);

                                                            // 乐观更新 UI
                                                            const newConfig = {
                                                                ...formData,
                                                                hidden_menu_items: newHiddenItems
                                                            };
                                                            setFormData(newConfig);

                                                            // 尝试保存
                                                            try {
                                                                await saveConfig(newConfig);
                                                            } catch (error) {
                                                                // 保存失败，回滚到原始快照
                                                                setFormData(originalConfig);
                                                                showToast(`Save failed, settings restored: ${error}`, 'error');
                                                            }
                                                        }
                                                    }}
                                                    className={`
                                                        relative flex flex-col items-center justify-center gap-3 p-4 rounded-none border-r-2 border-b-2 border-base-content transition-colors cursor-pointer select-none
                                                        ${isSettings
                                                            ? 'bg-base-200 opacity-60 cursor-not-allowed'
                                                            : isVisible
                                                                ? 'bg-base-content text-base-100'
                                                                : 'bg-base-100 text-base-content/50 hover:bg-base-200'
                                                        }
                                                    `}
                                                >
                                                    {/* 选中标记 */}
                                                    {isVisible && (
                                                        <div className="absolute top-2 right-2 text-lime-signal">
                                                            <CheckCircle2 size={16} />
                                                        </div>
                                                    )}

                                                    {isSettings && (
                                                        <div className="absolute top-2 right-2 text-[10px] font-black uppercase tracking-wider text-base-content/60 bg-base-content/10 px-1.5 py-0.5 rounded-none">
                                                            {t('settings.menu.required')}
                                                        </div>
                                                    )}

                                                    <div className="transition-colors">
                                                        <item.icon size={24} />
                                                    </div>

                                                    <span className="font-black uppercase tracking-wide text-xs">
                                                        {item.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-base-content/60 mt-4 flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-none bg-base-content/60"></div>
                                        {t('settings.menu.selected_items_note')}
                                    </p>
                                </div>
                        </div>
                    )}

                    {/* 账号设置 */}
                    {activeTab === 'account' && (
                        <div className="animate-in fade-in duration-500">
                            <SectionRule index="01" label={t('settings.account.auto_refresh')} />
                            {/* 自动刷新配额 */}
                            <div>
                                <div className="flex items-center justify-between gap-4 py-3 border-b border-base-content/20">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <RefreshCw size={16} className="shrink-0 text-base-content/60" />
                                        <div>
                                            <div className="text-sm font-black uppercase tracking-wide text-base-content">{t('settings.account.auto_refresh')}</div>
                                            <p className="text-xs text-base-content/60 mt-0.5">{t('settings.account.auto_refresh_desc')}</p>
                                        </div>
                                    </div>
                                    <label className={`relative inline-flex items-center ${formData.quota_protection.enabled ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={formData.auto_refresh}
                                            disabled={formData.quota_protection.enabled}
                                            onChange={async (e) => {
                                                const enabled = e.target.checked;
                                                const newConfig = { ...formData, auto_refresh: enabled };
                                                setFormData(newConfig);
                                                // Hot Save
                                                try {
                                                    await saveConfig(newConfig);
                                                } catch (error) {
                                                    showToast(`${t('common.error')}: ${error}`, 'error');
                                                }
                                            }}
                                        />
                                        <div className="w-11 h-6 bg-base-content/20 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-base-content rounded-none peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-base-100 after:rounded-none after:h-5 after:w-5 after:transition-all peer-checked:bg-base-content peer-checked:after:bg-lime-signal"></div>
                                    </label>
                                </div>

                                <div className="py-3 pl-4 border-b border-base-content/20 border-l-4 border-l-lime-signal flex items-center justify-between gap-4 animate-in slide-in-from-top-1 duration-200">
                                    <label className="text-xs font-black text-base-content/60 uppercase tracking-wider">{t('settings.account.refresh_interval')}</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            className="input input-sm w-24 rounded-none border border-base-content/40 bg-base-200 focus:outline-none focus:border-base-content text-sm font-black text-base-content"
                                            min="1"
                                            max="35791"
                                            value={formData.refresh_interval}
                                            onChange={(e) => setFormData({ ...formData, refresh_interval: isNaN(parseInt(e.target.value)) ? 1 : Math.min(Math.max(parseInt(e.target.value), 1), 35791) })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 自动获取当前账号 */}
                            <div>
                                <div className="flex items-center justify-between gap-4 py-3 border-b border-base-content/20">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <User size={16} className="shrink-0 text-base-content/60" />
                                        <div>
                                            <div className="text-sm font-black uppercase tracking-wide text-base-content">{t('settings.account.auto_sync')}</div>
                                            <p className="text-xs text-base-content/60 mt-0.5">{t('settings.account.auto_sync_desc')}</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={formData.auto_sync}
                                            onChange={(e) => setFormData({ ...formData, auto_sync: e.target.checked })}
                                        />
                                        <div className="w-11 h-6 bg-base-content/20 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-base-content rounded-none peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-base-100 after:rounded-none after:h-5 after:w-5 after:transition-all peer-checked:bg-base-content peer-checked:after:bg-lime-signal"></div>
                                    </label>
                                </div>

                                {formData.auto_sync && (
                                    <div className="py-3 pl-4 border-b border-base-content/20 border-l-4 border-l-lime-signal flex items-center justify-between gap-4 animate-in slide-in-from-top-1 duration-200">
                                        <label className="text-xs font-black text-base-content/60 uppercase tracking-wider">{t('settings.account.sync_interval')}</label>
                                        <input
                                            type="number"
                                            className="input input-sm w-24 rounded-none border border-base-content/40 bg-base-200 focus:outline-none focus:border-base-content text-sm font-black text-base-content"
                                            min="1"
                                            max="35791"
                                            value={formData.sync_interval}
                                            onChange={(e) => setFormData({ ...formData, sync_interval: isNaN(parseInt(e.target.value)) ? 1 : Math.min(Math.max(parseInt(e.target.value), 1), 35791) })}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* 7天周配额智能预热 (Smart Warmup) */}
                            <div className="mt-8 pt-4 border-t-2 border-base-content">
                                <SmartWarmup
                                    config={formData.scheduled_warmup}
                                    onChange={async (newConfig) => {
                                        const newFormData = {
                                            ...formData,
                                            scheduled_warmup: newConfig
                                        };
                                        setFormData(newFormData);
                                        // Hot Save
                                        try {
                                            await saveConfig(newFormData);
                                        } catch (error) {
                                            showToast(`${t('common.error')}: ${error}`, 'error');
                                        }
                                    }}
                                />
                            </div>

                            {/* 配额保护 (Quota Protection) */}
                            <div className="mt-8 pt-4 border-t-2 border-base-content">
                                <QuotaProtection
                                    config={formData.quota_protection}
                                    onChange={async (newConfig) => {
                                        const updates: any = {
                                            quota_protection: newConfig
                                        };
                                        // 联动逻辑：开启配额保护时，强制开启后台自动刷新 (不仅仅是预热)
                                        if (newConfig.enabled) {
                                            updates.auto_refresh = true;
                                        }

                                        const newFormData = {
                                            ...formData,
                                            ...updates
                                        };
                                        setFormData(newFormData);

                                        // Hot Save
                                        try {
                                            await saveConfig(newFormData);
                                        } catch (error) {
                                            showToast(`${t('common.error')}: ${error}`, 'error');
                                        }
                                    }}
                                />
                            </div>

                            {/* 低配额切号提醒 (Low Quota Alert & Auto-Switch Suggestion) */}
                            <div className="mt-8 pt-4 border-t-2 border-base-content">
                                <LowQuotaAlertSettings
                                    config={formData.low_quota_alert}
                                    onChange={async (newConfig) => {
                                        const newFormData = {
                                            ...formData,
                                            low_quota_alert: newConfig
                                        };
                                        setFormData(newFormData);
                                        // Hot Save
                                        try {
                                            await saveConfig(newFormData);
                                        } catch (error) {
                                            showToast(`${t('common.error')}: ${error}`, 'error');
                                        }
                                    }}
                                />
                            </div>

                            {/* 配额关注列表 (Pinned Quota Models) */}
                            <div className="mt-8 pt-4 border-t-2 border-base-content">
                                <PinnedQuotaModels
                                    config={formData.pinned_quota_models}
                                    onChange={(newConfig) => setFormData({
                                        ...formData,
                                        pinned_quota_models: newConfig
                                    })}
                                />
                            </div>

                            {/* OAuth 凭据管理导航卡片 */}
                            <div className="mt-8 pt-4 border-t-2 border-base-content flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-base-content/[0.03] border border-base-content/20">
                                <div>
                                    <div className="text-sm font-black uppercase tracking-wide text-base-content">
                                        {t('settings.oauth.title', 'OAuth Configuration')}
                                    </div>
                                    <p className="text-xs text-base-content/60 mt-0.5">
                                        {t('settings.oauth.desc', 'Manage built-in and Bring-Your-Own (BYO) Google Cloud OAuth 2.0 credentials for account authorization.')}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => startTransition(() => setActiveTab('oauth'))}
                                    className="px-4 py-2 text-xs font-black uppercase tracking-wider bg-base-content text-base-100 hover:opacity-90 shrink-0 self-start sm:self-auto"
                                >
                                    {t('settings.tabs.oauth', 'OAuth')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* OAuth 设置 */}
                    {activeTab === 'oauth' && (
                        <OAuthSettings
                            config={formData.oauth}
                            onChange={async (newOAuthConfig) => {
                                const newFormData = {
                                    ...formData,
                                    oauth: newOAuthConfig,
                                };
                                setFormData(newFormData);
                                try {
                                    await saveConfig(newFormData);
                                } catch (error) {
                                    showToast(`${t('common.error')}: ${error}`, 'error');
                                }
                            }}
                        />
                    )}

                    {/* 高级设置 */}
                    {activeTab === 'advanced' && (
                        <>
                            <div>
                                <SectionRule index="01" label={t('settings.tabs.advanced')} />
                                {/* 默认导出路径 */}
                                <div className="py-4 border-b border-base-content/20">
                                    <label className="block text-sm font-black uppercase tracking-wide text-base-content mb-2">{t('settings.advanced.export_path')}</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="input input-sm flex-1 rounded-none border border-base-content/40 bg-base-200 text-base-content font-medium focus:outline-none focus:border-base-content"
                                            value={formData.default_export_path || t('settings.advanced.export_path_placeholder')}
                                            readOnly
                                        />
                                        {formData.default_export_path && (
                                            <button
                                                className="btn btn-sm btn-ghost rounded-none border border-red-600 dark:border-red-400 text-red-600 dark:text-red-400 font-black uppercase tracking-wider hover:bg-red-600 hover:text-white"
                                                onClick={() => setFormData({ ...formData, default_export_path: undefined })}
                                            >
                                                {t('common.clear')}
                                            </button>
                                        )}
                                        {isTauri() ? (
                                            <button
                                                className="btn btn-sm btn-ghost rounded-none border border-base-content/40 text-base-content font-black uppercase tracking-wider hover:bg-base-content hover:text-base-100"
                                                onClick={handleSelectExportPath}
                                            >
                                                {t('settings.advanced.select_btn')}
                                            </button>
                                        ) : (
                                            <span className="self-center text-xs text-gray-400 dark:text-gray-500 italic px-2">
                                                {t('settings.web_mode_limitation', '(Not supported in web mode)')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-base-content/60 mt-2">{t('settings.advanced.default_export_path_desc')}</p>
                                </div>

                                {/* 数据目录 */}
                                <div className="py-4 border-b border-base-content/20">
                                    <label className="block text-sm font-black uppercase tracking-wide text-base-content mb-2">{t('settings.advanced.data_dir')}</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="input input-sm flex-1 rounded-none border border-base-content/40 bg-base-200 text-base-content font-medium focus:outline-none focus:border-base-content"
                                            value={dataDirPath}
                                            readOnly
                                        />
                                        {isTauri() ? (
                                            <>
                                                <button
                                                    className="btn btn-sm btn-ghost rounded-none border border-base-content/40 text-base-content font-black uppercase tracking-wider hover:bg-base-content hover:text-base-100"
                                                    onClick={handleSelectDataDir}
                                                    disabled={isMigratingDataDir}
                                                >
                                                    {t('settings.advanced.select_btn')}
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-ghost rounded-none border border-base-content/40 text-base-content font-black uppercase tracking-wider hover:bg-base-content hover:text-base-100"
                                                    onClick={handleOpenDataDir}
                                                >
                                                    {t('settings.advanced.open_btn')}
                                                </button>
                                            </>
                                        ) : (
                                            <span className="self-center text-xs text-gray-400 dark:text-gray-500 italic px-2">
                                                {t('settings.web_mode_limitation', '(Not supported in web mode)')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-base-content/60 mt-2">{t('settings.advanced.data_dir_desc')}</p>
                                </div>

                                {/* 反重力程序路径 */}
                                <div className="py-4 border-b border-base-content/20">
                                    <label className="block text-sm font-black uppercase tracking-wide text-base-content mb-2">
                                        {t('settings.advanced.antigravity_path')}
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="input input-sm flex-1 rounded-none border border-base-content/40 bg-base-200 text-base-content font-medium focus:outline-none focus:border-base-content"
                                            value={formData.antigravity_executable || ''}
                                            placeholder={t('settings.advanced.antigravity_path_placeholder')}
                                            onChange={(e) => setFormData({ ...formData, antigravity_executable: e.target.value })}
                                        />
                                        {formData.antigravity_executable && (
                                            <button
                                                className="btn btn-sm btn-ghost rounded-none border border-red-600 dark:border-red-400 text-red-600 dark:text-red-400 font-black uppercase tracking-wider hover:bg-red-600 hover:text-white"
                                                onClick={() => setFormData({ ...formData, antigravity_executable: undefined })}
                                            >
                                                {t('common.clear')}
                                            </button>
                                        )}
                                        <button
                                            className="btn btn-sm btn-ghost rounded-none border border-base-content/40 text-base-content font-black uppercase tracking-wider hover:bg-base-content hover:text-base-100"
                                            onClick={handleDetectAntigravityPath}
                                        >
                                            {t('settings.advanced.detect_btn')}
                                        </button>
                                        {isTauri() ? (
                                            <button
                                                className="btn btn-sm btn-ghost rounded-none border border-base-content/40 text-base-content font-black uppercase tracking-wider hover:bg-base-content hover:text-base-100"
                                                onClick={handleSelectAntigravityPath}
                                            >
                                                {t('settings.advanced.select_btn')}
                                            </button>
                                        ) : (
                                            <span className="self-center text-xs text-gray-400 dark:text-gray-500 italic px-2">
                                                {t('settings.web_mode_limitation', '(Not supported in web mode)')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-base-content/60 mt-2">
                                        {t('settings.advanced.antigravity_path_desc')}
                                    </p>
                                </div>

                                {/* Antigravity CLI (agy) 程序路径 */}
                                <div className="py-4 border-b border-base-content/20">
                                    <label className="block text-sm font-black uppercase tracking-wide text-base-content mb-2">
                                        {t('settings.advanced.antigravity_cli_path', 'Antigravity CLI (agy) Path')}
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="input input-sm flex-1 rounded-none border border-base-content/40 bg-base-200 text-base-content font-medium focus:outline-none focus:border-base-content"
                                            value={formData.antigravity_cli_executable || ''}
                                            placeholder={t('settings.advanced.antigravity_cli_path_placeholder', 'Not set (Will use auto-detection)')}
                                            onChange={(e) => setFormData({ ...formData, antigravity_cli_executable: e.target.value })}
                                        />
                                        {formData.antigravity_cli_executable && (
                                            <button
                                                className="btn btn-sm btn-ghost rounded-none border border-red-600 dark:border-red-400 text-red-600 dark:text-red-400 font-black uppercase tracking-wider hover:bg-red-600 hover:text-white"
                                                onClick={() => setFormData({ ...formData, antigravity_cli_executable: undefined })}
                                            >
                                                {t('common.clear')}
                                            </button>
                                        )}
                                        <button
                                            className="btn btn-sm btn-ghost rounded-none border border-base-content/40 text-base-content font-black uppercase tracking-wider hover:bg-base-content hover:text-base-100"
                                            onClick={handleDetectAntigravityCliPath}
                                        >
                                            {t('settings.advanced.detect_btn')}
                                        </button>
                                        {isTauri() ? (
                                            <button
                                                className="btn btn-sm btn-ghost rounded-none border border-base-content/40 text-base-content font-black uppercase tracking-wider hover:bg-base-content hover:text-base-100"
                                                onClick={handleSelectAntigravityCliPath}
                                            >
                                                {t('settings.advanced.select_btn')}
                                            </button>
                                        ) : (
                                            <span className="self-center text-xs text-gray-400 dark:text-gray-500 italic px-2">
                                                {t('settings.web_mode_limitation', '(Not supported in web mode)')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-base-content/60 mt-2">
                                        {t('settings.advanced.antigravity_cli_path_desc', 'Set the executable path for the command line client (agy) to bypass account restrictions.')}
                                    </p>
                                    
                                    {/* 新增：解密/修补准入限制一键修补按钮 */}
                                    <div className={`mt-3 flex items-center gap-4 p-3 bg-base-200 border-l-4 ${formData.antigravity_cli_executable ? 'border-lime-signal' : 'border-base-content/30'}`}>
                                        <div className="flex-1">
                                            <h4 className={`text-sm font-black uppercase tracking-wide ${formData.antigravity_cli_executable ? 'text-base-content' : 'text-base-content/50'}`}>
                                                {t('settings.advanced.patch_eligibility_title', 'Bypass Account Eligibility Check')}
                                            </h4>
                                            <p className={`text-xs mt-0.5 ${formData.antigravity_cli_executable ? 'text-base-content/70' : 'text-base-content/50'}`}>
                                                {t('settings.advanced.patch_eligibility_desc', 'Newer agy client versions enforce account checks. This operation dynamically patches it to skip checks.')}
                                                {!formData.antigravity_cli_executable && " (set or detect the path above first)"}
                                            </p>
                                        </div>
                                        <button
                                            className={`btn btn-sm rounded-none border-0 font-black uppercase tracking-wider ${formData.antigravity_cli_executable ? 'bg-base-content text-base-100 hover:bg-lime-signal hover:text-[#0A0A0A]' : 'bg-base-content/10 text-base-content/40 cursor-not-allowed'}`}
                                            disabled={!formData.antigravity_cli_executable}
                                            onClick={async () => {
                                                if (!formData.antigravity_cli_executable) return;
                                                try {
                                                    const res = await invoke<string>('patch_agy_binary', { filePath: formData.antigravity_cli_executable });
                                                    showToast(res, 'success');
                                                } catch (err) {
                                                    showToast(String(err), 'error');
                                                }
                                            }}
                                        >
                                            {t('settings.advanced.patch_btn', 'Bypass Check')}
                                        </button>
                                    </div>
                                </div>

                                {/* Antigravity IDE 程序路径 */}
                                <div className="py-4 border-b border-base-content/20">
                                    <label className="block text-sm font-black uppercase tracking-wide text-base-content mb-2">
                                        {t('settings.advanced.antigravity_ide_path', 'Antigravity IDE Path')}
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="input input-sm flex-1 rounded-none border border-base-content/40 bg-base-200 text-base-content font-medium focus:outline-none focus:border-base-content"
                                            value={formData.antigravity_ide_executable || ''}
                                            placeholder={t('settings.advanced.antigravity_ide_path_placeholder', 'C:\\Program Files\\Google\\Antigravity\\Antigravity.exe')}
                                            onChange={(e) => setFormData({ ...formData, antigravity_ide_executable: e.target.value })}
                                        />
                                        {formData.antigravity_ide_executable && (
                                            <button
                                                className="btn btn-sm btn-ghost rounded-none border border-red-600 dark:border-red-400 text-red-600 dark:text-red-400 font-black uppercase tracking-wider hover:bg-red-600 hover:text-white"
                                                onClick={() => setFormData({ ...formData, antigravity_ide_executable: undefined })}
                                            >
                                                {t('common.clear')}
                                            </button>
                                        )}
                                        {isTauri() ? (
                                            <button
                                                className="btn btn-sm btn-ghost rounded-none border border-base-content/40 text-base-content font-black uppercase tracking-wider hover:bg-base-content hover:text-base-100"
                                                onClick={handleSelectAntigravityIdePath}
                                            >
                                                {t('settings.advanced.select_btn')}
                                            </button>
                                        ) : (
                                            <span className="self-center text-xs text-gray-400 dark:text-gray-500 italic px-2">
                                                {t('settings.web_mode_limitation', '(Not supported in web mode)')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-base-content/60 mt-2">
                                        {t('settings.advanced.antigravity_ide_path_desc', 'Specify the executable path for Antigravity IDE (code editor). Once set, account switching will strictly protect processes at this path from being terminated.')}
                                    </p>
                                </div>

                                {/* Google Gemini 桌面版程序路径 */}
                                <div className="py-4 border-b border-base-content/20">
                                    <label className="block text-sm font-black uppercase tracking-wide text-base-content mb-2">
                                        {t('settings.advanced.gemini_desktop_path', 'Google Gemini Desktop Path')}
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="input input-sm flex-1 rounded-none border border-base-content/40 bg-base-200 text-base-content font-medium focus:outline-none focus:border-base-content"
                                            value={formData.gemini_desktop_executable || ''}
                                            placeholder={t('settings.advanced.gemini_desktop_path_placeholder', 'Not set (Will use auto-detection from shortcut or LocalAppData)')}
                                            onChange={(e) => setFormData({ ...formData, gemini_desktop_executable: e.target.value })}
                                        />
                                        {formData.gemini_desktop_executable && (
                                            <button
                                                className="btn btn-sm btn-ghost rounded-none border border-red-600 dark:border-red-400 text-red-600 dark:text-red-400 font-black uppercase tracking-wider hover:bg-red-600 hover:text-white"
                                                onClick={() => setFormData({ ...formData, gemini_desktop_executable: undefined })}
                                            >
                                                {t('common.clear')}
                                            </button>
                                        )}
                                        <button
                                            className="btn btn-sm btn-ghost rounded-none border border-base-content/40 text-base-content font-black uppercase tracking-wider hover:bg-base-content hover:text-base-100"
                                            onClick={handleDetectGeminiDesktopPath}
                                        >
                                            {t('settings.advanced.detect_btn')}
                                        </button>
                                        {isTauri() ? (
                                            <button
                                                className="btn btn-sm btn-ghost rounded-none border border-base-content/40 text-base-content font-black uppercase tracking-wider hover:bg-base-content hover:text-base-100"
                                                onClick={handleSelectGeminiDesktopPath}
                                            >
                                                {t('settings.advanced.select_btn')}
                                            </button>
                                        ) : (
                                            <span className="self-center text-xs text-gray-400 dark:text-gray-500 italic px-2">
                                                {t('settings.web_mode_limitation', '(Not supported in web mode)')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-base-content/60 mt-2">
                                        {t('settings.advanced.gemini_desktop_path_desc', 'Set the executable or shortcut path for Google Gemini Desktop to enable account switching and dynamic gateway routing.')}
                                    </p>

                                    {/* 一键配置网关快捷方式 */}
                                    <div className="mt-3 flex items-center gap-4 p-3 bg-base-200 border-l-4 border-lime-signal">
                                        <div className="flex-1">
                                            <h4 className="text-sm font-black uppercase tracking-wide text-base-content">
                                                {t('settings.advanced.gemini_shortcut_title', 'Configure Dynamic Gateway Shortcut')}
                                            </h4>
                                            <p className="text-xs mt-0.5 text-base-content/70">
                                                {t('settings.advanced.gemini_shortcut_desc', 'Updates Start Menu and Desktop shortcuts to automatically route Google Gemini Desktop through Proxymateur.')}
                                            </p>
                                        </div>
                                        <button
                                            className="btn btn-sm rounded-none border-0 font-black uppercase tracking-wider bg-base-content text-base-100 hover:bg-lime-signal hover:text-[#0A0A0A]"
                                            onClick={handleInstallGeminiShortcut}
                                        >
                                            {t('settings.advanced.install_shortcut_btn', 'Install Shortcut')}
                                        </button>
                                    </div>
                                </div>

                                {/* 反重力程序启动参数 */}
                                <div className="py-4 border-b border-base-content/20">
                                    <label className="block text-sm font-black uppercase tracking-wide text-base-content mb-2">
                                        {t('settings.advanced.antigravity_args')}
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="input input-sm flex-1 rounded-none border border-base-content/40 bg-base-200 text-base-content font-medium focus:outline-none focus:border-base-content"
                                            value={formData.antigravity_args ? formData.antigravity_args.join(' ') : ''}
                                            placeholder={t('settings.advanced.antigravity_args_placeholder')}
                                            onChange={(e) => {
                                                const args = e.target.value.trim() === '' ? [] : e.target.value.split(' ').map(arg => arg.trim()).filter(arg => arg !== '');
                                                setFormData({ ...formData, antigravity_args: args });
                                            }}
                                        />
                                        <button
                                            className="btn btn-sm btn-ghost rounded-none border border-base-content/40 text-base-content font-black uppercase tracking-wider hover:bg-base-content hover:text-base-100"
                                            onClick={async () => {
                                                try {
                                                    const args = await invoke<string[]>('get_antigravity_args');
                                                    setFormData({ ...formData, antigravity_args: args });
                                                    showToast(t('settings.advanced.antigravity_args_detected'), 'success');
                                                } catch (error) {
                                                    showToast(`${t('settings.advanced.antigravity_args_detect_error')}: ${error}`, 'error');
                                                }
                                            }}
                                        >
                                            {t('settings.advanced.detect_args_btn')}
                                        </button>
                                    </div>
                                    <p className="text-xs text-base-content/60 mt-2">
                                        {t('settings.advanced.antigravity_args_desc')}
                                    </p>
                                </div>

                                {/* Antigravity 实验室与实验性特性开关 */}
                                <AntigravityLabSettings
                                    config={formData.antigravity_lab}
                                    onChange={(labConfig) => setFormData(prev => ({ ...prev, antigravity_lab: labConfig }))}
                                    antigravityArgs={formData.antigravity_args}
                                    onArgsChange={(args) => setFormData(prev => ({ ...prev, antigravity_args: args }))}
                                />

                                {/* 多开模式 (Multi-Instance Mode) */}
                                <div className="flex items-center justify-between gap-4 py-3 border-b border-base-content/20">
                                    <div>
                                        <div className="text-sm font-black uppercase tracking-wide text-base-content">
                                            {t('settings.advanced.multi_instance_mode', 'Multi-Instance Mode (Antigravity 2.0 GUI)')}
                                        </div>
                                        <p className="text-xs text-base-content/60 mt-1">
                                            {t('settings.advanced.multi_instance_mode_desc', 'When switching accounts via the 2.0 GUI button, start a new window in an isolated profile instead of terminating the previous window.')}
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={formData.multi_instance_mode ?? false}
                                            onChange={(e) => {
                                                const enabled = e.target.checked;
                                                setFormData({ ...formData, multi_instance_mode: enabled });
                                            }}
                                        />
                                        <div className="w-11 h-6 bg-base-content/20 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-base-content rounded-none peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-base-100 after:rounded-none after:h-5 after:w-5 after:transition-all peer-checked:bg-base-content peer-checked:after:bg-lime-signal"></div>
                                    </label>
                                </div>



                                {/* Antigravity 缓存清理 */}
                                <div>
                                    <SectionRule index="02" label={t('settings.advanced.antigravity_cache_title')} />
                                    <div className="bg-amber-500/10 border-l-4 border-amber-500 p-3 mb-3">
                                        <p className="text-xs text-amber-700 dark:text-amber-400">{t('settings.advanced.antigravity_cache_warning')}</p>
                                    </div>
                                    <div className="bg-base-200 border-l-4 border-base-content/40 p-3 mb-3">
                                        <p className="text-xs text-base-content/70">{t('settings.advanced.antigravity_cache_desc')}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button
                                            className="btn btn-sm btn-ghost rounded-none border border-orange-600 dark:border-orange-400 text-orange-700 dark:text-orange-400 font-black uppercase tracking-wider hover:bg-orange-600 hover:text-white"
                                            onClick={handleOpenClearCacheDialog}
                                        >
                                            {t('settings.advanced.clear_antigravity_cache')}
                                        </button>
                                    </div>
                                </div>

                            </div>
                        </>
                    )}


                    {/* 调试设置 */}
                    {activeTab === 'debug' && (
                        <div className="space-y-4 animate-in fade-in duration-500">
                            {/* 标题和开关 */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-base-content">
                                        {t('settings.debug.title')}
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        {t('settings.debug.desc')}
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={isEnabled}
                                        onChange={(e) => e.target.checked ? enable() : disable()}
                                    />
                                    <div className="w-11 h-6 bg-base-content/20 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-base-content rounded-none peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-base-100 after:rounded-none after:h-5 after:w-5 after:transition-all peer-checked:bg-base-content peer-checked:after:bg-lime-signal"></div>
                                    <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {isEnabled ? t('settings.debug.enabled') : t('settings.debug.disabled')}
                                    </span>
                                </label>
                            </div>

                            {/* 控制台或提示 */}
                            {isEnabled ? (
                                <div className="h-[calc(100vh-320px)] min-h-[400px]">
                                    <DebugConsole embedded />
                                </div>
                            ) : (
                                <div className="h-[calc(100vh-320px)] min-h-[400px] flex items-center justify-center bg-gray-50 dark:bg-base-200 rounded-xl border border-gray-200 dark:border-base-300">
                                    <div className="text-center">
                                        <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                                            {t('settings.debug.disabled_hint')}
                                        </p>
                                        <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                                            {t('settings.debug.disabled_desc')}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'about' && (
                        <div className="flex flex-col h-full animate-in fade-in duration-500">
                            <div className="flex-1 flex flex-col justify-center items-center space-y-8">
                                {/* Branding Section */}
                                <div className="text-center space-y-4">
                                    <div className="relative inline-block group">
                                        <div className="absolute inset-0 bg-blue-500/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                                        <img
                                            src="/icon.png"
                                            alt="Antigravity Logo"
                                            className="relative w-24 h-24 rounded-3xl shadow-2xl transform group-hover:scale-105 transition-all duration-500 rotate-3 group-hover:rotate-6 object-cover bg-white dark:bg-black"
                                        />
                                    </div>

                                    <div>
                                        <h3 className="text-3xl font-black text-gray-900 dark:text-base-content tracking-tight mb-2">{t('common.app_name', 'Proxymateur')}</h3>
                                        <div className="flex items-center justify-center gap-2 text-sm">
                                            v{appVersion}
                                            <span className="text-gray-400 dark:text-gray-600">•</span>
                                            <span className="text-gray-500 dark:text-gray-400">{t('settings.branding.subtitle')}</span>
                                        </div>
                                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                            Forked from <a href="https://github.com/lbjlaq/Antigravity-Manager" target="_blank" rel="noreferrer" className="underline hover:text-gray-600 dark:hover:text-gray-300">lbjlaq/Antigravity-Manager</a> (CC BY-NC-SA 4.0)
                                        </div>
                                    </div>
                                </div>

                                {/* Cards Grid - 2 columns: Author & GitHub */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl px-4 mx-auto">
                                    {/* Author Card */}
                                    <div className="bg-white dark:bg-base-100 p-4 rounded-2xl border border-gray-100 dark:border-base-300 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all group flex flex-col items-center text-center gap-3">
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl group-hover:scale-110 transition-transform duration-300">
                                            <User className="w-6 h-6 text-blue-500" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">{t('settings.about.author')}</div>
                                            <div className="font-bold text-gray-900 dark:text-base-content">Yuatemycat</div>
                                        </div>
                                    </div>

                                    {/* GitHub Card */}
                                    <a
                                        href="https://github.com/yuatemycat/Proxymateur-Clean"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="bg-white dark:bg-base-100 p-4 rounded-2xl border border-gray-100 dark:border-base-300 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all group flex flex-col items-center text-center gap-3 cursor-pointer"
                                    >
                                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl group-hover:scale-110 transition-transform duration-300">
                                            <Github className="w-6 h-6 text-gray-900 dark:text-white" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">{t('settings.about.github')}</div>
                                            <div className="flex items-center gap-1 font-bold text-gray-900 dark:text-base-content">
                                                 <span>{t('settings.about.view_code')}</span>
                                                 <ExternalLink className="w-3 h-3 text-gray-400" />
                                            </div>
                                        </div>
                                    </a>
                                </div>

                                {/* Donation Banner */}
                                <div className="w-full max-w-xl mx-auto p-3.5 bg-white dark:bg-base-100 rounded-2xl border border-gray-100 dark:border-base-300 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 px-5">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300">
                                        <Heart className="w-4 h-4 text-pink-500 fill-pink-500 shrink-0" />
                                        <span>USDT (BEP20):</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <code className="text-xs font-mono font-semibold text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-base-200 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-base-300 select-all break-all">
                                            0xd08d47bde441888166b801616754c667672cd502
                                        </code>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText('0xd08d47bde441888166b801616754c667672cd502');
                                                showToast(t('common.copied', 'Copied to clipboard!'), 'success');
                                            }}
                                            className="btn btn-xs btn-ghost"
                                            title="Copy"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Tech Stack Badges */}
                                <div className="flex gap-2 justify-center">
                                    <div className="px-3 py-1 bg-gray-50 dark:bg-base-200 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-base-300">
                                        Tauri v2
                                    </div>
                                    <div className="px-3 py-1 bg-gray-50 dark:bg-base-200 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-base-300">
                                        React 19
                                    </div>
                                    <div className="px-3 py-1 bg-gray-50 dark:bg-base-200 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-base-300">
                                        TypeScript
                                    </div>
                                </div>

                                {/* Update Channel Selector */}
                                <div className="flex flex-col items-center gap-2">
                                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                                        <span>{t('settings.about.update_channel')}:</span>
                                        <div className="inline-flex p-1 bg-gray-100 dark:bg-base-300 rounded-xl border border-gray-200/60 dark:border-base-200">
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        await invoke('save_update_settings', {
                                                            settings: {
                                                                auto_check: formData.auto_check_update ?? true,
                                                                last_check_time: 0,
                                                                check_interval_hours: formData.update_check_interval ?? 24,
                                                                update_channel: 'stable',
                                                            }
                                                        });
                                                        setFormData(prev => ({ ...prev, update_channel: 'stable' }));
                                                        setUpdateInfo(null);
                                                        showToast(`${t('settings.about.update_channel')}: ${t('settings.about.channel_stable')}`, 'info');
                                                    } catch (err) {
                                                        showToast(`${t('common.error')}: ${err}`, 'error');
                                                    }
                                                }}
                                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                                                    (formData.update_channel || 'stable') === 'stable'
                                                        ? 'bg-white dark:bg-base-100 text-blue-600 dark:text-blue-400 shadow-sm'
                                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                                }`}
                                            >
                                                {t('settings.about.channel_stable')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        await invoke('save_update_settings', {
                                                            settings: {
                                                                auto_check: formData.auto_check_update ?? true,
                                                                last_check_time: 0,
                                                                check_interval_hours: formData.update_check_interval ?? 24,
                                                                update_channel: 'beta',
                                                            }
                                                        });
                                                        setFormData(prev => ({ ...prev, update_channel: 'beta' }));
                                                        setUpdateInfo(null);
                                                        showToast(`${t('settings.about.update_channel')}: ${t('settings.about.channel_beta')}`, 'info');
                                                    } catch (err) {
                                                        showToast(`${t('common.error')}: ${err}`, 'error');
                                                    }
                                                }}
                                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                                                    formData.update_channel === 'beta'
                                                        ? 'bg-white dark:bg-base-100 text-amber-600 dark:text-amber-400 shadow-sm'
                                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                                }`}
                                            >
                                                <span>{t('settings.about.channel_beta')}</span>
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                            </button>
                                        </div>
                                    </div>
                                    {formData.update_channel === 'beta' && (
                                        <p className="text-[11px] text-amber-600/90 dark:text-amber-400/90">
                                            {t('settings.about.channel_beta_hint')}
                                        </p>
                                    )}
                                </div>

                                {/* Check for Updates */}
                                <div className="flex flex-col items-center gap-3">
                                    <button
                                        onClick={handleCheckUpdate}
                                        disabled={isCheckingUpdate}
                                        className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg transition-all flex items-center gap-2 shadow-sm hover:shadow-md disabled:cursor-not-allowed"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                                        {isCheckingUpdate ? t('settings.about.checking_update') : t('settings.about.check_update')}
                                    </button>

                                    {/* Update Status */}
                                    {updateInfo && !isCheckingUpdate && (
                                        <div className="text-center">
                                            {updateInfo.hasUpdate ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="flex items-center gap-1.5 text-sm text-orange-600 dark:text-orange-400 font-medium">
                                                        <span>{t('settings.about.new_version_available', { version: updateInfo.latestVersion })}</span>
                                                        {updateInfo.channel === 'beta' && (
                                                            <span className="px-1.5 py-0.2 text-[10px] font-semibold rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                                Beta
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-wrap justify-center">
                                                        {isBrewInstalled ? (
                                                            <button
                                                                onClick={() => setIsBrewConfirmOpen(true)}
                                                                disabled={isBrewUpgrading}
                                                                className="px-4 py-1.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5 disabled:cursor-not-allowed"
                                                            >
                                                                {isBrewUpgrading ? (
                                                                    <>
                                                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                                        {t('settings.about.brew_upgrading')}
                                                                    </>
                                                                ) : (
                                                                    t('settings.about.brew_upgrade')
                                                                )}
                                                            </button>
                                                        ) : (
                                                            isTauri() && (
                                                                <button
                                                                    onClick={handleConfirmUpdate}
                                                                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                                                                >
                                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                                    {t('settings.about.upgrade_now_btn', { defaultValue: 'Download & Auto Update' })}
                                                                </button>
                                                            )
                                                        )}
                                                        <a
                                                            href={updateInfo.downloadUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-base-200 dark:hover:bg-base-300 text-gray-700 dark:text-gray-200 text-sm rounded-lg transition-colors flex items-center gap-1.5 border border-gray-200 dark:border-base-300"
                                                        >
                                                            {t('settings.about.download_update')}
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                        </a>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                                                    ✓ {t('settings.about.latest_version')}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="text-center text-[10px] text-gray-300 dark:text-gray-600 mt-auto pb-2">
                                {t('settings.about.copyright')}
                            </div>
                        </div>
                    )
                    }
                </div >



                <ModalDialog
                    isOpen={isMigrateDataDirOpen}
                    title={t('settings.advanced.data_dir_migrate_title')}
                    type="confirm"
                    confirmText={isMigratingDataDir ? t('common.loading') : t('common.confirm')}
                    cancelText={t('common.cancel')}
                    onConfirm={confirmMigrateDataDir}
                    onCancel={() => {
                        if (!isMigratingDataDir) {
                            setIsMigrateDataDirOpen(false);
                            setPendingDataDir('');
                        }
                    }}
                >
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                        {t('settings.advanced.data_dir_migrate_msg', { path: pendingDataDir })}
                    </p>
                </ModalDialog>

                {/* Antigravity Cache Clear Modal */}
                <ModalDialog
                    isOpen={isClearCacheOpen}
                    title={t('settings.advanced.clear_cache_confirm_title')}
                    type="confirm"
                    confirmText={isClearingCache ? t('common.clearing') : t('common.clear')}
                    cancelText={t('common.cancel')}
                    isDestructive={true}
                    onConfirm={confirmClearAntigravityCache}
                    onCancel={() => setIsClearCacheOpen(false)}
                >
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t('settings.advanced.clear_cache_confirm_msg')}
                        </p>
                        {cachePaths.length > 0 ? (
                            <div className="bg-gray-50 dark:bg-base-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                                <ul className="text-xs font-mono text-gray-600 dark:text-gray-400 space-y-1">
                                    {cachePaths.map((path, index) => (
                                        <li key={index} className="truncate">• {path}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <div className="bg-gray-50 dark:bg-base-200 rounded-lg p-3">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {t('settings.advanced.cache_not_found')}
                                </p>
                            </div>
                        )}
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-lg p-2">
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                {t('settings.advanced.antigravity_cache_warning')}
                            </p>
                        </div>
                    </div>
                </ModalDialog>

                {/* Homebrew Upgrade Confirm Modal */}
                <ModalDialog
                    isOpen={isBrewConfirmOpen}
                    title={t('settings.about.brew_confirm_title')}
                    type="confirm"
                    confirmText={t('settings.about.brew_confirm_btn')}
                    cancelText={t('common.cancel')}
                    onConfirm={handleBrewUpgrade}
                    onCancel={() => setIsBrewConfirmOpen(false)}
                >
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t('settings.about.brew_confirm_desc')}
                        </p>
                        <div className="bg-gray-50 dark:bg-base-200 rounded-lg p-3">
                            <div className="flex items-center justify-between gap-2">
                                <code className="text-xs text-gray-700 dark:text-gray-300 break-all">brew upgrade --cask proxymateur</code>
                                <button
                                    className="shrink-0 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-200 dark:border-base-300 rounded hover:bg-gray-100 dark:hover:bg-base-300 transition-colors"
                                    onClick={() => {
                                        navigator.clipboard.writeText('brew upgrade --cask proxymateur');
                                        showToast(t('common.copied', 'Copied'), 'success');
                                    }}
                                >
                                    {t('common.copy', 'Copy')}
                                </button>
                            </div>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-lg p-3">
                            <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">{t('settings.about.brew_quarantine_hint')}</p>
                            <div className="flex items-center justify-between gap-2">
                                <code className="text-xs text-amber-800 dark:text-amber-300 break-all">sudo xattr -rd com.apple.quarantine "/Applications/Proxymateur.app"</code>
                                <button
                                    className="shrink-0 px-2 py-1 text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 border border-amber-200 dark:border-amber-700 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                                    onClick={() => {
                                        navigator.clipboard.writeText('sudo xattr -rd com.apple.quarantine "/Applications/Proxymateur.app"');
                                        showToast(t('common.copied', 'Copied'), 'success');
                                    }}
                                >
                                    {t('common.copy', 'Copy')}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalDialog>

                {/* Homebrew Upgrade Success Modal */}
                <ModalDialog
                    isOpen={isBrewSuccessOpen}
                    title={t('settings.about.brew_success_title')}
                    type="success"
                    confirmText={t('settings.about.brew_restart_btn')}
                    onConfirm={async () => {
                        try {
                            await relaunch();
                        } catch {
                            setIsBrewSuccessOpen(false);
                            showToast(t('settings.about.brew_restart_failed'), 'error');
                        }
                    }}
                >
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('settings.about.brew_upgrade_success')}
                    </p>
                </ModalDialog>

                {/* 新版本自动更新确认弹窗 */}
                <ModalDialog
                    isOpen={isUpdateConfirmOpen}
                    title={t('settings.about.update_dialog_title', { defaultValue: 'New Version Available' })}
                    type="confirm"
                    confirmText={t('settings.about.upgrade_now_btn', { defaultValue: 'Download & Auto Update' })}
                    cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                    onConfirm={handleConfirmUpdate}
                    onCancel={() => setIsUpdateConfirmOpen(false)}
                >
                    <div className="space-y-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                            {t('settings.about.update_confirm_desc', {
                                defaultValue: 'A new version is available. Would you like to download and update now? The app will automatically restart once downloaded.',
                            })}
                        </p>
                        <div className="bg-gray-50 dark:bg-base-200 p-3 rounded-lg border border-gray-200 dark:border-base-300 space-y-1.5 font-mono text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500">{t('settings.about.current_version')}:</span>
                                <span className="font-semibold text-gray-800 dark:text-gray-200">{updateInfo?.currentVersion || appVersion}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500">{t('settings.about.latest_version_label', { defaultValue: 'Latest Version' })}:</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{updateInfo?.latestVersion}</span>
                                    {updateInfo?.channel === 'beta' && (
                                        <span className="px-1.5 py-0.2 text-[10px] font-semibold rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                            Beta
                                        </span>
                                    )}
                                </div>
                            </div>
                            {updateInfo?.source && (
                                <div className="text-[10px] text-gray-400 text-right pt-1 border-t border-gray-200/50 dark:border-base-300">
                                    via {updateInfo.source}
                                </div>
                            )}
                        </div>
                    </div>
                </ModalDialog>

            </div>
        </div>
    );
}

export default Settings;
