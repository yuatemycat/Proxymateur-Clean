import { useState } from 'react';
import { Key, Plus, Trash2, Edit2, CheckCircle2, Shield, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CustomOAuthClient, OAuthConfig } from '../../types/config';
import { SectionRule, Chip } from '../common/ledger';
import ModalDialog from '../common/ModalDialog';
import { showToast } from '../common/ToastContainer';

interface OAuthSettingsProps {
    config?: OAuthConfig;
    onChange: (config: OAuthConfig) => void;
}

const BUILTIN_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const BUILTIN_KEY = 'antigravity_enterprise';

export default function OAuthSettings({ config, onChange }: OAuthSettingsProps) {
    const { t } = useTranslation();

    const currentConfig: OAuthConfig = config || {
        enable_builtin: true,
        custom_clients: [],
        active_client_key: undefined,
    };

    // Modal state for adding/editing a custom client
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [clientForm, setClientForm] = useState<CustomOAuthClient>({
        key: '',
        label: '',
        client_id: '',
        client_secret: '',
    });

    // Delete confirmation modal state
    const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);

    const handleBuiltinToggle = (enable_builtin: boolean) => {
        const nextConfig: OAuthConfig = {
            ...currentConfig,
            enable_builtin,
        };
        // If builtin was active and is now disabled, reset active key to first custom client if any
        if (!enable_builtin && currentConfig.active_client_key === BUILTIN_KEY) {
            nextConfig.active_client_key = currentConfig.custom_clients[0]?.key || undefined;
        }
        onChange(nextConfig);
    };

    const handleSetActive = (key: string) => {
        onChange({
            ...currentConfig,
            active_client_key: key,
        });
        showToast(t('common.saved'), 'success');
    };

    const openAddModal = () => {
        setEditingIndex(null);
        setClientForm({
            key: '',
            label: '',
            client_id: '',
            client_secret: '',
        });
        setIsModalOpen(true);
    };

    const openEditModal = (index: number) => {
        setEditingIndex(index);
        setClientForm({ ...currentConfig.custom_clients[index] });
        setIsModalOpen(true);
    };

    const handleSaveClient = () => {
        const key = clientForm.key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        const label = clientForm.label.trim();
        const clientId = clientForm.client_id.trim();
        const clientSecret = clientForm.client_secret.trim();

        if (!key) {
            showToast('Please enter a valid client key', 'error');
            return;
        }
        if (!clientId) {
            showToast('Please enter the Google OAuth Client ID', 'error');
            return;
        }
        if (!clientSecret) {
            showToast('Please enter the Google OAuth Client Secret', 'error');
            return;
        }

        // Check key uniqueness
        const existingKeyIndex = currentConfig.custom_clients.findIndex(
            (c, i) => c.key === key && i !== editingIndex
        );
        if (existingKeyIndex !== -1 || key === BUILTIN_KEY) {
            showToast(`Client key "${key}" is already in use`, 'error');
            return;
        }

        const newClient: CustomOAuthClient = {
            key,
            label: label || key,
            client_id: clientId,
            client_secret: clientSecret,
        };

        let updatedClients = [...currentConfig.custom_clients];
        if (editingIndex !== null) {
            updatedClients[editingIndex] = newClient;
        } else {
            updatedClients.push(newClient);
        }

        const nextConfig: OAuthConfig = {
            ...currentConfig,
            custom_clients: updatedClients,
            active_client_key: currentConfig.active_client_key || key,
        };

        onChange(nextConfig);
        setIsModalOpen(false);
        showToast(t('common.saved'), 'success');
    };

    const handleDeleteClient = (index: number) => {
        const target = currentConfig.custom_clients[index];
        if (!target) return;

        const updatedClients = currentConfig.custom_clients.filter((_, i) => i !== index);
        const nextConfig: OAuthConfig = {
            ...currentConfig,
            custom_clients: updatedClients,
            active_client_key:
                currentConfig.active_client_key === target.key
                    ? (currentConfig.enable_builtin ? BUILTIN_KEY : updatedClients[0]?.key || undefined)
                    : currentConfig.active_client_key,
        };

        onChange(nextConfig);
        setDeleteTargetIndex(null);
        showToast(t('common.delete_success'), 'success');
    };

    const activeKey = currentConfig.active_client_key || (currentConfig.enable_builtin ? BUILTIN_KEY : currentConfig.custom_clients[0]?.key);

    return (
        <div className="animate-in fade-in duration-500">
            {/* 01 Built-in OAuth Client */}
            <SectionRule index="01" label={t('settings.oauth.builtin_title', 'Built-in OAuth Client')} />

            <div className="py-3 border-b border-base-content/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    <Shield size={18} className="shrink-0 text-base-content/60 mt-0.5" />
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black uppercase tracking-wide text-base-content">
                                {t('settings.oauth.enable_builtin', 'Enable Built-in OAuth Client')}
                            </span>
                            {currentConfig.enable_builtin ? (
                                <Chip tone="lime">{t('common.enabled', 'Enabled')}</Chip>
                            ) : (
                                <Chip tone="bad">{t('common.disabled', 'Disabled')}</Chip>
                            )}
                            {activeKey === BUILTIN_KEY && currentConfig.enable_builtin && (
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-lime-signal text-black">
                                    {t('settings.oauth.active_badge', 'Default')}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-base-content/60 mt-1">
                            {t(
                                'settings.oauth.builtin_desc',
                                'Use the official Antigravity Enterprise Google Cloud OAuth credentials (1-click authorization without manual Google Cloud Console setup).'
                            )}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-base-content/50 font-mono">
                            <span className="px-2 py-0.5 bg-base-200 border border-base-content/20">key: {BUILTIN_KEY}</span>
                            <span className="px-2 py-0.5 bg-base-200 border border-base-content/20 truncate max-w-xs" title={BUILTIN_CLIENT_ID}>
                                id: {BUILTIN_CLIENT_ID.slice(0, 24)}...
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    {currentConfig.enable_builtin && activeKey !== BUILTIN_KEY && (
                        <button
                            type="button"
                            onClick={() => handleSetActive(BUILTIN_KEY)}
                            className="px-3 py-1 text-xs font-black uppercase tracking-wider border border-base-content/40 hover:bg-base-200 text-base-content transition-colors"
                        >
                            {t('settings.oauth.set_active', 'Set Default')}
                        </button>
                    )}
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={currentConfig.enable_builtin}
                            onChange={(e) => handleBuiltinToggle(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-base-content/20 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-base-content rounded-none peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-base-100 after:rounded-none after:h-5 after:w-5 after:transition-all peer-checked:bg-base-content peer-checked:after:bg-lime-signal"></div>
                    </label>
                </div>
            </div>

            {/* 02 Custom OAuth Clients (BYO OAuth) */}
            <SectionRule
                index="02"
                label={t('settings.oauth.custom_title', 'Custom OAuth Clients (BYO OAuth)')}
                right={
                    <button
                        type="button"
                        onClick={openAddModal}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-black uppercase tracking-wider bg-base-content text-base-100 hover:opacity-90 transition-opacity"
                    >
                        <Plus size={14} />
                        {t('settings.oauth.add_client', 'Add OAuth Client')}
                    </button>
                }
            />

            <p className="text-xs text-base-content/60 mb-4">
                {t(
                    'settings.oauth.custom_desc',
                    'Configure your own Google Cloud Console OAuth 2.0 Web Client credentials for isolated quota and enterprise domain control.'
                )}
            </p>

            {currentConfig.custom_clients.length === 0 ? (
                <div className="p-6 border border-dashed border-base-content/20 text-center text-xs text-base-content/50">
                    {t('settings.oauth.no_custom_clients', 'No custom OAuth clients added yet.')}
                </div>
            ) : (
                <div className="space-y-3">
                    {currentConfig.custom_clients.map((client, idx) => {
                        const isActive = activeKey === client.key;
                        return (
                            <div
                                key={client.key}
                                className={`p-4 border ${isActive ? 'border-base-content bg-base-content/[0.03]' : 'border-base-content/20'} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <Key size={14} className="text-base-content/60" />
                                        <span className="font-bold text-sm text-base-content">{client.label}</span>
                                        <span className="px-2 py-0.5 text-[10px] font-mono bg-base-200 border border-base-content/20">
                                            {client.key}
                                        </span>
                                        {isActive && (
                                            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-lime-signal text-black">
                                                {t('settings.oauth.active_badge', 'Default')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1.5 text-xs font-mono text-base-content/60 truncate max-w-md">
                                        {client.client_id}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                    {!isActive && (
                                        <button
                                            type="button"
                                            onClick={() => handleSetActive(client.key)}
                                            className="px-2.5 py-1 text-xs font-black uppercase tracking-wider border border-base-content/40 hover:bg-base-200 text-base-content transition-colors flex items-center gap-1"
                                        >
                                            <CheckCircle2 size={12} />
                                            {t('settings.oauth.set_active', 'Set Default')}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => openEditModal(idx)}
                                        className="p-1.5 border border-base-content/30 hover:bg-base-200 text-base-content/70 hover:text-base-content transition-colors"
                                        title={t('settings.oauth.edit_client', 'Edit Client')}
                                    >
                                        <Edit2 size={13} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDeleteTargetIndex(idx)}
                                        className="p-1.5 border border-red-500/30 hover:bg-red-500/10 text-red-500 transition-colors"
                                        title={t('settings.oauth.delete_client', 'Delete Client')}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 03 Environment Variable Overrides */}
            <SectionRule index="03" label={t('settings.oauth.env_title', 'Environment Variable Overrides')} />
            <div className="p-4 border border-base-content/20 bg-base-200/50 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-base-content/80 font-bold">
                    <AlertCircle size={14} />
                    <span>{t('settings.oauth.env_title', 'Environment Variable Overrides')}</span>
                </div>
                <p className="text-base-content/60">
                    {t(
                        'settings.oauth.env_desc',
                        'You can also inject OAuth credentials dynamically via ANTIGRAVITY_OAUTH_CLIENTS and ANTIGRAVITY_OAUTH_CLIENT_KEY.'
                    )}
                </p>
                <div className="space-y-1 font-mono text-[11px] text-base-content/70 pt-1">
                    <div className="bg-base-300/60 p-2 border border-base-content/10 select-all">
                        ANTIGRAVITY_OAUTH_CLIENTS="my_key|CLIENT_ID|CLIENT_SECRET|Display Label"
                    </div>
                    <div className="bg-base-300/60 p-2 border border-base-content/10 select-all">
                        ANTIGRAVITY_OAUTH_CLIENT_KEY="my_key"
                    </div>
                </div>
            </div>

            {/* Modal for Add / Edit Custom Client */}
            <ModalDialog
                isOpen={isModalOpen}
                title={editingIndex !== null ? t('settings.oauth.edit_client', 'Edit Client') : t('settings.oauth.add_client', 'Add OAuth Client')}
                type="info"
                onConfirm={handleSaveClient}
                onCancel={() => setIsModalOpen(false)}
                confirmText={t('common.save', 'Save')}
                cancelText={t('common.cancel', 'Cancel')}
            >
                <div className="space-y-4 py-2 text-left">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-base-content/80 mb-1">
                            {t('settings.oauth.client_key', 'Client Key')} *
                        </label>
                        <input
                            type="text"
                            className="input input-sm w-full rounded-none border border-base-content/40 bg-base-200 focus:outline-none focus:border-base-content text-xs font-mono text-base-content"
                            placeholder={t('settings.oauth.client_key_placeholder', 'e.g. personal_gcp')}
                            value={clientForm.key}
                            onChange={(e) => setClientForm({ ...clientForm, key: e.target.value })}
                        />
                        <p className="text-[11px] text-base-content/50 mt-0.5">
                            Unique identifier used in config and CLI routing (letters, numbers, dashes, underscores).
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-base-content/80 mb-1">
                            {t('settings.oauth.client_label', 'Display Label')}
                        </label>
                        <input
                            type="text"
                            className="input input-sm w-full rounded-none border border-base-content/40 bg-base-200 focus:outline-none focus:border-base-content text-xs text-base-content"
                            placeholder={t('settings.oauth.client_label_placeholder', 'e.g. Personal Project GCP')}
                            value={clientForm.label}
                            onChange={(e) => setClientForm({ ...clientForm, label: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-base-content/80 mb-1">
                            {t('settings.oauth.client_id', 'Client ID')} *
                        </label>
                        <input
                            type="text"
                            className="input input-sm w-full rounded-none border border-base-content/40 bg-base-200 focus:outline-none focus:border-base-content text-xs font-mono text-base-content"
                            placeholder={t('settings.oauth.client_id_placeholder', 'e.g. 123456789-xyz.apps.googleusercontent.com')}
                            value={clientForm.client_id}
                            onChange={(e) => setClientForm({ ...clientForm, client_id: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-base-content/80 mb-1">
                            {t('settings.oauth.client_secret', 'Client Secret')} *
                        </label>
                        <input
                            type="password"
                            className="input input-sm w-full rounded-none border border-base-content/40 bg-base-200 focus:outline-none focus:border-base-content text-xs font-mono text-base-content"
                            placeholder={t('settings.oauth.client_secret_placeholder', 'e.g. GOCSPX-...')}
                            value={clientForm.client_secret}
                            onChange={(e) => setClientForm({ ...clientForm, client_secret: e.target.value })}
                        />
                    </div>
                </div>
            </ModalDialog>

            {/* Modal for Delete Confirmation */}
            <ModalDialog
                isOpen={deleteTargetIndex !== null}
                title={t('settings.oauth.delete_client', 'Delete Client')}
                type="confirm"
                isDestructive={true}
                onConfirm={() => {
                    if (deleteTargetIndex !== null) handleDeleteClient(deleteTargetIndex);
                }}
                onCancel={() => setDeleteTargetIndex(null)}
                confirmText={t('common.delete', 'Delete')}
                cancelText={t('common.cancel', 'Cancel')}
                message={
                    deleteTargetIndex !== null && currentConfig.custom_clients[deleteTargetIndex]
                        ? t('settings.oauth.delete_confirm', {
                              name: currentConfig.custom_clients[deleteTargetIndex].label,
                          })
                        : ''
                }
            />
        </div>
    );
}
