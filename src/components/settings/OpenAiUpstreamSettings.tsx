import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Plus,
    Trash2,
    Edit3,
    CheckCircle2,
    XCircle,
    Eye,
    EyeOff,
    Zap,
    Server,
    Activity,
    Layers,
    Play,
    X
} from 'lucide-react';
import { request as invoke } from '../../utils/request';
import { OpenAiUpstreamConfig, OpenAiRoute } from '../../types/config';
import { showToast } from '../common/ToastContainer';

interface OpenAiUpstreamSettingsProps {
    config?: OpenAiUpstreamConfig;
    onChange: (config: OpenAiUpstreamConfig) => void;
}

export const DEFAULT_OPENAI_CONFIG: OpenAiUpstreamConfig = {
    enabled: false,
    default_base_url: '',
    default_api_key: '',
    default_timeout_secs: 120,
    auto_route_prefix: 'openai/',
    routes: []
};

interface ProbeResult {
    ok: boolean;
    latency_ms: number;
    message: string;
}

interface PresetOption {
    label: string;
    description: string;
    model_id: string;
    upstream_model: string;
    base_url?: string;
    suggested_key_hint?: string;
}

const PRESETS: PresetOption[] = [
    {
        label: 'DeepSeek V4.1 Flash (NVIDIA NIM)',
        description: 'Fast multimodal reasoning model on NVIDIA NIM (free tier available)',
        model_id: 'deepseek-ai/deepseek-v4.1-flash',
        upstream_model: 'deepseek-ai/deepseek-v4.1-flash',
        base_url: 'https://integrate.api.nvidia.com/v1',
        suggested_key_hint: 'nvapi-...'
    },
    {
        label: 'Llama 3.3 70B Instruct (NVIDIA NIM)',
        description: 'Meta flagship open weights model hosted on NVIDIA NIM',
        model_id: 'meta/llama-3.3-70b-instruct',
        upstream_model: 'meta/llama-3.3-70b-instruct',
        base_url: 'https://integrate.api.nvidia.com/v1',
        suggested_key_hint: 'nvapi-...'
    },
    {
        label: 'Qwen 2.5 Coder 32B (Groq)',
        description: 'Ultra-low latency code generation on Groq LPU engine',
        model_id: 'qwen-2.5-coder-32b',
        upstream_model: 'qwen-2.5-coder-32b',
        base_url: 'https://api.groq.com/openai/v1',
        suggested_key_hint: 'gsk_...'
    },
    {
        label: 'Claude 3.5 Sonnet (OpenRouter)',
        description: 'Anthropic Claude via unified OpenRouter OpenAI-compatible gateway',
        model_id: 'openrouter/claude-3.5-sonnet',
        upstream_model: 'anthropic/claude-3.5-sonnet',
        base_url: 'https://openrouter.ai/api/v1',
        suggested_key_hint: 'sk-or-...'
    },
    {
        label: 'DeepSeek R1 (Local Ollama)',
        description: 'Self-hosted local reasoning inference running on localhost:11434',
        model_id: 'ollama/deepseek-r1',
        upstream_model: 'deepseek-r1:latest',
        base_url: 'http://127.0.0.1:11434/v1',
        suggested_key_hint: 'ollama'
    }
];

export default function OpenAiUpstreamSettings({
    config,
    onChange
}: OpenAiUpstreamSettingsProps) {
    const { t: _t } = { t: (k: string, f?: string) => f || k };

    // Defensive normalization against legacy config schemas or undefined properties
    const rawRoutes = Array.isArray(config?.routes)
        ? config.routes
        : (Array.isArray((config as any)?.exposed_models) && (config as any).exposed_models.length > 0)
            ? (config as any).exposed_models.map((m: string) => ({
                model_id: m,
                upstream_model: (config as any)?.model_mapping?.[m] || m
            }))
            : [];
    const validRouteIds = new Set(rawRoutes.map((r: any) => r.model_id));

    // If exposed_models is explicitly defined (even as []), respect user selection and prune deleted routes;
    // only fall back to all routes if exposed_models is undefined/null (legacy uninitialized config).
    const exposed = Array.isArray(config?.exposed_models)
        ? config.exposed_models.filter((m) => validRouteIds.has(m))
        : rawRoutes.map((r: any) => r.model_id);

    const safeConfig: OpenAiUpstreamConfig = {
        enabled: config?.enabled ?? DEFAULT_OPENAI_CONFIG.enabled,
        default_base_url: config?.default_base_url || (config as any)?.base_url || '',
        default_api_key: config?.default_api_key || (config as any)?.api_key || '',
        default_timeout_secs: config?.default_timeout_secs ?? 120,
        auto_route_prefix: config?.auto_route_prefix ?? 'openai/',
        routes: rawRoutes,
        exposed_models: exposed
    };

    const [showDefaultKey, setShowDefaultKey] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    // Modal Form State
    const [formModelId, setFormModelId] = useState('');
    const [formUpstreamModel, setFormUpstreamModel] = useState('');
    const [formBaseUrl, setFormBaseUrl] = useState('');
    const [formApiKey, setFormApiKey] = useState('');
    const [formTimeout, setFormTimeout] = useState<number | ''>('');
    const [formExposeOnModel, setFormExposeOnModel] = useState(false);
    const [showFormKey, setShowFormKey] = useState(false);

    // Live testing status map: key is model_id
    const [probingMap, setProbingMap] = useState<Record<string, boolean>>({});
    const [probeResultMap, setProbeResultMap] = useState<Record<string, ProbeResult>>({});

    // Modal test state
    const [modalProbing, setModalProbing] = useState(false);
    const [modalProbeResult, setModalProbeResult] = useState<ProbeResult | null>(null);

    const updateConfig = (updates: Partial<OpenAiUpstreamConfig>) => {
        onChange({ ...safeConfig, ...updates });
    };

    const toggleExposed = (model: string, checked: boolean) => {
        const current = safeConfig.exposed_models || [];
        const next = checked ? [...current, model] : current.filter((m) => m !== model);
        const validIds = new Set(safeConfig.routes.map((r) => r.model_id));
        updateConfig({ exposed_models: Array.from(new Set(next)).filter((m) => validIds.has(m)) });
    };

    const handleOpenAdd = () => {
        setEditingIndex(null);
        setFormModelId('');
        setFormUpstreamModel('');
        setFormBaseUrl('');
        setFormApiKey('');
        setFormTimeout('');
        setFormExposeOnModel(true);
        setShowFormKey(false);
        setModalProbeResult(null);
        setModalOpen(true);
    };

    const handleOpenEdit = (index: number) => {
        const route = safeConfig.routes[index];
        if (!route) return;
        setEditingIndex(index);
        setFormModelId(route.model_id);
        setFormUpstreamModel(route.upstream_model || '');
        setFormBaseUrl(route.base_url || '');
        setFormApiKey(route.api_key || '');
        setFormTimeout(route.timeout_secs ?? '');
        setFormExposeOnModel(exposed.includes(route.model_id));
        setShowFormKey(false);
        setModalProbeResult(null);
        setModalOpen(true);
    };

    const handleApplyPreset = (preset: PresetOption) => {
        setFormModelId(preset.model_id);
        setFormUpstreamModel(preset.upstream_model);
        if (preset.base_url) {
            setFormBaseUrl(preset.base_url);
        }
        setModalProbeResult(null);
    };

    const handleSaveRoute = () => {
        const trimmedModelId = formModelId.trim();
        if (!trimmedModelId) {
            showToast('Model ID cannot be empty', 'error');
            return;
        }

        const newRoute: OpenAiRoute = {
            model_id: trimmedModelId,
            upstream_model: formUpstreamModel.trim() ? formUpstreamModel.trim() : undefined,
            base_url: formBaseUrl.trim() ? formBaseUrl.trim() : undefined,
            api_key: formApiKey.trim() ? formApiKey.trim() : undefined,
            timeout_secs: typeof formTimeout === 'number' && formTimeout > 0 ? formTimeout : undefined
        };

        const currentRoutes = [...safeConfig.routes];
        const prevModelId = editingIndex !== null ? currentRoutes[editingIndex]?.model_id : null;
        if (editingIndex !== null && editingIndex >= 0 && editingIndex < currentRoutes.length) {
            currentRoutes[editingIndex] = newRoute;
        } else {
            // Check for duplicates
            if (currentRoutes.some((r) => r.model_id.toLowerCase() === trimmedModelId.toLowerCase())) {
                showToast(`Model ID "${trimmedModelId}" already exists`, 'error');
                return;
            }
            currentRoutes.push(newRoute);
        }

        const nextValidIds = new Set(currentRoutes.map((r) => r.model_id));
        let nextExposed = (safeConfig.exposed_models || []).filter(
            (m) => nextValidIds.has(m) && m !== trimmedModelId && (!prevModelId || m !== prevModelId)
        );
        if (formExposeOnModel) {
            nextExposed = [...nextExposed, trimmedModelId];
        }

        updateConfig({ routes: currentRoutes, exposed_models: nextExposed });
        setModalOpen(false);
        showToast(editingIndex !== null ? 'Model route updated' : 'Model route added', 'success');
    };

    const handleDeleteRoute = (index: number) => {
        const route = safeConfig.routes[index];
        if (!route) return;
        const nextRoutes = safeConfig.routes.filter((_, idx) => idx !== index);
        const nextValidIds = new Set(nextRoutes.map((r) => r.model_id));
        const nextExposed = (safeConfig.exposed_models || []).filter((m) => nextValidIds.has(m));
        updateConfig({ routes: nextRoutes, exposed_models: nextExposed });
        showToast(`Removed model "${route.model_id}"`, 'info');
    };

    const handleTestRoute = async (route: OpenAiRoute) => {
        const baseUrl = route.base_url || safeConfig.default_base_url;
        const apiKey = route.api_key || safeConfig.default_api_key;
        const model = route.upstream_model || route.model_id;

        if (!baseUrl) {
            showToast('Base URL is missing', 'error');
            return;
        }

        setProbingMap((prev) => ({ ...prev, [route.model_id]: true }));
        try {
            const res = await invoke<ProbeResult>('test_openai_upstream_route', {
                baseUrl,
                apiKey,
                model
            });
            setProbeResultMap((prev) => ({ ...prev, [route.model_id]: res }));
            if (res.ok) {
                showToast(`✓ ${route.model_id}: ${res.message} (${res.latency_ms}ms)`, 'success');
            } else {
                showToast(`✗ ${route.model_id}: ${res.message}`, 'error');
            }
        } catch (err) {
            const errMsg = String(err);
            setProbeResultMap((prev) => ({
                ...prev,
                [route.model_id]: { ok: false, latency_ms: 0, message: errMsg }
            }));
            showToast(`✗ ${route.model_id}: ${errMsg}`, 'error');
        } finally {
            setProbingMap((prev) => ({ ...prev, [route.model_id]: false }));
        }
    };

    const handleModalTest = async () => {
        const baseUrl = formBaseUrl.trim() || safeConfig.default_base_url;
        const apiKey = formApiKey.trim() || safeConfig.default_api_key;
        const model = formUpstreamModel.trim() || formModelId.trim();

        if (!model) {
            showToast('Please enter a Model ID first', 'error');
            return;
        }
        if (!baseUrl) {
            showToast('Please specify a Base URL', 'error');
            return;
        }

        setModalProbing(true);
        setModalProbeResult(null);
        try {
            const res = await invoke<ProbeResult>('test_openai_upstream_route', {
                baseUrl,
                apiKey,
                model
            });
            setModalProbeResult(res);
        } catch (err) {
            setModalProbeResult({ ok: false, latency_ms: 0, message: String(err) });
        } finally {
            setModalProbing(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Master Toggle */}
            <div className="p-4 bg-base-content/[0.03] border border-base-content/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Server className="w-5 h-5 text-lime-signal" />
                        <h3 className="text-sm font-black uppercase tracking-wider text-base-content">
                            OpenAI-Compatible Upstream Bridge
                        </h3>
                    </div>
                    <p className="text-xs text-base-content/60 mt-1">
                        Transpile Gemini protocol calls into standard OpenAI chat completions. Connect NVIDIA NIM, Groq, OpenRouter, DeepSeek, or local Ollama/vLLM instances directly into Google Antigravity CLI and IDE.
                    </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono font-bold uppercase text-base-content/70">
                        {safeConfig.enabled ? 'ACTIVE' : 'DISABLED'}
                    </span>
                    <input
                        type="checkbox"
                        className="toggle toggle-sm toggle-success"
                        checked={safeConfig.enabled}
                        onChange={(e) => updateConfig({ enabled: e.target.checked })}
                    />
                </div>
            </div>

            {/* Default Upstream Credentials */}
            <div className="p-4 bg-base-100 border border-base-content/20 space-y-4">
                <div className="flex items-center gap-2 border-b border-base-content/10 pb-2">
                    <Layers className="w-4 h-4 text-base-content/70" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-base-content">
                        Default Gateway Configuration
                    </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-mono font-bold uppercase text-base-content/70 mb-1">
                            Default Base URL
                        </label>
                        <input
                            type="text"
                            className="input input-sm w-full rounded-none border border-base-content/40 bg-base-200 text-base-content font-mono text-xs focus:outline-none focus:border-base-content"
                            placeholder="https://api.openai.com/v1"
                            value={safeConfig.default_base_url}
                            onChange={(e) => updateConfig({ default_base_url: e.target.value })}
                        />
                        <p className="text-[11px] text-base-content/50 mt-1">
                            Base URL for OpenAI-compatible completions endpoint.
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-mono font-bold uppercase text-base-content/70 mb-1">
                            Default API Key
                        </label>
                        <div className="relative">
                            <input
                                type={showDefaultKey ? 'text' : 'password'}
                                className="input input-sm w-full rounded-none border border-base-content/40 bg-base-200 text-base-content font-mono text-xs pr-8 focus:outline-none focus:border-base-content"
                                placeholder="nvapi-... / sk-..."
                                value={safeConfig.default_api_key}
                                onChange={(e) => updateConfig({ default_api_key: e.target.value })}
                            />
                            <button
                                type="button"
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
                                onClick={() => setShowDefaultKey(!showDefaultKey)}
                            >
                                {showDefaultKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                        <p className="text-[11px] text-base-content/50 mt-1">
                            Bearer key used for routes that do not specify their own key.
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-mono font-bold uppercase text-base-content/70 mb-1">
                            Auto-Route Prefix
                        </label>
                        <input
                            type="text"
                            className="input input-sm w-full rounded-none border border-base-content/40 bg-base-200 text-base-content font-mono text-xs focus:outline-none focus:border-base-content"
                            placeholder="openai/"
                            value={safeConfig.auto_route_prefix || ''}
                            onChange={(e) => updateConfig({ auto_route_prefix: e.target.value || undefined })}
                        />
                        <p className="text-[11px] text-base-content/50 mt-1">
                            Requests starting with this prefix (e.g. <span className="font-mono">openai/qwen-2.5</span>) bypass the route list and dispatch on-the-fly.
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-mono font-bold uppercase text-base-content/70 mb-1">
                            Request Timeout (Seconds)
                        </label>
                        <input
                            type="number"
                            className="input input-sm w-full rounded-none border border-base-content/40 bg-base-200 text-base-content font-mono text-xs focus:outline-none focus:border-base-content"
                            placeholder="120"
                            value={safeConfig.default_timeout_secs}
                            onChange={(e) => updateConfig({ default_timeout_secs: parseInt(e.target.value, 10) || 60 })}
                        />
                        <p className="text-[11px] text-base-content/50 mt-1">
                            Timeout budget for long-running reasoning model streams.
                        </p>
                    </div>
                </div>
            </div>

            {/* Model Routes Management */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-base-content pb-2">
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-base-content flex items-center gap-2">
                            <Activity className="w-4 h-4 text-lime-signal" />
                            Registered Model Routes ({safeConfig.routes.length})
                            {exposed.length > 0 && (
                                <span className="badge badge-xs badge-success font-mono text-[10px]">
                                    {exposed.length} shown on /model
                                </span>
                            )}
                        </h4>
                        <p className="text-[11px] text-base-content/60">
                            Only models explicitly checked below appear in the <span className="font-mono">/models</span> catalog and Antigravity CLI <span className="font-mono">/model</span> picker (like Vertex).
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleOpenAdd}
                        className="px-3 py-1.5 text-xs font-black uppercase tracking-wider bg-base-content text-base-100 hover:opacity-90 flex items-center gap-1.5 self-start sm:self-auto"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Model Route
                    </button>
                </div>

                {safeConfig.routes.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-base-content/30 bg-base-content/[0.02]">
                        <Server className="w-8 h-8 text-base-content/30 mx-auto mb-2" />
                        <p className="text-xs font-bold uppercase tracking-wide text-base-content/60">
                            No custom model routes defined yet
                        </p>
                        <p className="text-[11px] text-base-content/40 mt-1">
                            Click "Add Model Route" above to register an OpenAI model or choose from presets.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {safeConfig.routes.map((route, index) => {
                            const isProbing = probingMap[route.model_id];
                            const probeRes = probeResultMap[route.model_id];
                            const isExposed = exposed.includes(route.model_id);
                            return (
                                <div
                                    key={route.model_id}
                                    className="p-3 bg-base-100 border border-base-content/20 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-base-content/50 transition-colors"
                                >
                                    <div className="space-y-1 min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <label
                                                className="inline-flex items-center gap-2 cursor-pointer"
                                                title="Show this model in client /model picker"
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="checkbox checkbox-xs rounded-none"
                                                    checked={isExposed}
                                                    onChange={(e) => toggleExposed(route.model_id, e.target.checked)}
                                                />
                                                <span className="font-mono text-sm font-black text-base-content truncate">
                                                    {route.model_id}
                                                </span>
                                            </label>
                                            {isExposed && (
                                                <span className="badge badge-xs badge-success font-mono text-[10px]">
                                                    /model
                                                </span>
                                            )}
                                            {route.upstream_model && route.upstream_model !== route.model_id && (
                                                <span className="badge badge-xs badge-neutral font-mono text-[10px]">
                                                    mapped &rarr; {route.upstream_model}
                                                </span>
                                            )}
                                            {route.base_url ? (
                                                <span className="badge badge-xs badge-outline font-mono text-[10px]">
                                                    Custom URL
                                                </span>
                                            ) : (
                                                <span className="badge badge-xs badge-ghost font-mono text-[10px] text-base-content/60">
                                                    Default URL
                                                </span>
                                            )}
                                            {route.api_key && (
                                                <span className="badge badge-xs badge-outline font-mono text-[10px]">
                                                    Custom Key
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-[11px] font-mono text-base-content/60 truncate">
                                            Endpoint: {route.base_url || safeConfig.default_base_url || 'N/A'}
                                        </div>

                                        {probeRes && (
                                            <div className="flex items-center gap-1.5 text-[11px] font-mono mt-1">
                                                {probeRes.ok ? (
                                                    <>
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                                            {probeRes.message} ({probeRes.latency_ms}ms)
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                                        <span className="text-red-500 truncate" title={probeRes.message}>
                                                            {probeRes.message}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                        <button
                                            type="button"
                                            disabled={isProbing}
                                            onClick={() => handleTestRoute(route)}
                                            className="px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-wider border border-base-content/30 text-base-content hover:bg-base-content/10 disabled:opacity-50 flex items-center gap-1"
                                            title="Send live completion probe to verify model connectivity"
                                        >
                                            {isProbing ? (
                                                <span className="loading loading-spinner loading-xs" />
                                            ) : (
                                                <Play className="w-3 h-3 text-lime-signal" />
                                            )}
                                            Test
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEdit(index)}
                                            className="p-1.5 border border-base-content/30 text-base-content hover:bg-base-content/10"
                                            title="Edit route"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteRoute(index)}
                                            className="p-1.5 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white"
                                            title="Delete route"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add / Edit Route Modal */}
            {modalOpen && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setModalOpen(false)}
                    />
                    <div className="relative w-full max-w-2xl bg-base-100 border-2 border-base-content shadow-2xl p-6 z-10 max-h-[90vh] overflow-y-auto space-y-4">
                        <div className="flex items-center justify-between border-b-2 border-base-content pb-3">
                            <h3 className="text-sm font-black uppercase tracking-wider text-base-content flex items-center gap-2">
                                <Server className="w-4 h-4 text-lime-signal" />
                                {editingIndex !== null ? 'Edit OpenAI Upstream Route' : 'Add OpenAI Upstream Route'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                className="p-1 text-base-content/60 hover:text-base-content"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4">
                    {/* Presets Selector (only shown when adding new) */}
                    {editingIndex === null && (
                        <div className="p-3 bg-base-content/[0.03] border border-base-content/20 space-y-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-base-content/70 flex items-center gap-1">
                                <Zap className="w-3.5 h-3.5 text-lime-signal" />
                                One-Click Presets
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {PRESETS.map((p) => (
                                    <button
                                        key={p.label}
                                        type="button"
                                        onClick={() => handleApplyPreset(p)}
                                        className="px-2.5 py-1 text-[11px] font-mono border border-base-content/30 bg-base-100 hover:bg-base-content hover:text-base-100 transition-colors text-left"
                                        title={p.description}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-mono font-bold uppercase text-base-content/80 mb-1">
                                Client Model ID * (Exposed to agy & /models)
                            </label>
                            <input
                                type="text"
                                className="input input-sm w-full rounded-none border border-base-content/40 bg-base-200 text-base-content font-mono text-xs focus:outline-none focus:border-base-content"
                                placeholder="deepseek-ai/deepseek-v4.1-flash"
                                value={formModelId}
                                onChange={(e) => setFormModelId(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-mono font-bold uppercase text-base-content/80 mb-1">
                                Upstream Model Name (Optional, leave blank if identical)
                            </label>
                            <input
                                type="text"
                                className="input input-sm w-full rounded-none border border-base-content/40 bg-base-200 text-base-content font-mono text-xs focus:outline-none focus:border-base-content"
                                placeholder="deepseek-ai/deepseek-v4.1-flash"
                                value={formUpstreamModel}
                                onChange={(e) => setFormUpstreamModel(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-mono font-bold uppercase text-base-content/80 mb-1">
                                Custom Base URL (Optional, overrides default gateway)
                            </label>
                            <input
                                type="text"
                                className="input input-sm w-full rounded-none border border-base-content/40 bg-base-200 text-base-content font-mono text-xs focus:outline-none focus:border-base-content"
                                placeholder={safeConfig.default_base_url || 'https://api.openai.com/v1'}
                                value={formBaseUrl}
                                onChange={(e) => setFormBaseUrl(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-mono font-bold uppercase text-base-content/80 mb-1">
                                Custom API Key (Optional, overrides default key)
                            </label>
                            <div className="relative">
                                <input
                                    type={showFormKey ? 'text' : 'password'}
                                    className="input input-sm w-full rounded-none border border-base-content/40 bg-base-200 text-base-content font-mono text-xs pr-8 focus:outline-none focus:border-base-content"
                                    placeholder="Leave blank to use default API key"
                                    value={formApiKey}
                                    onChange={(e) => setFormApiKey(e.target.value)}
                                />
                                <button
                                    type="button"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
                                    onClick={() => setShowFormKey(!showFormKey)}
                                >
                                    {showFormKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-mono font-bold uppercase text-base-content/80 mb-1">
                                Custom Timeout Seconds (Optional)
                            </label>
                            <input
                                type="number"
                                className="input input-sm w-full rounded-none border border-base-content/40 bg-base-200 text-base-content font-mono text-xs focus:outline-none focus:border-base-content"
                                placeholder={String(safeConfig.default_timeout_secs || 120)}
                                value={formTimeout}
                                onChange={(e) => setFormTimeout(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                            />
                        </div>

                        <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-xs rounded-none"
                                checked={formExposeOnModel}
                                onChange={(e) => setFormExposeOnModel(e.target.checked)}
                            />
                            <span className="text-xs font-mono text-base-content/80">
                                Show in client <span className="font-bold">/model</span> picker
                            </span>
                        </label>

                        {/* Live Probe in Modal */}
                        {modalProbeResult && (
                            <div className="p-2.5 bg-base-200 border border-base-content/20 flex items-start gap-2 text-xs font-mono">
                                {modalProbeResult.ok ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                        <div className="text-emerald-600 dark:text-emerald-400">
                                            <div className="font-bold">Connection Verified ({modalProbeResult.latency_ms}ms)</div>
                                            <div className="text-[11px] text-base-content/60">{modalProbeResult.message}</div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                        <div className="text-red-500">
                                            <div className="font-bold">Connection Failed</div>
                                            <div className="text-[11px] text-base-content/70">{modalProbeResult.message}</div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-base-content/20">
                        <button
                            type="button"
                            disabled={modalProbing || !formModelId.trim()}
                            onClick={handleModalTest}
                            className="px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider border border-base-content/30 text-base-content hover:bg-base-content/10 disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {modalProbing ? (
                                <span className="loading loading-spinner loading-xs" />
                            ) : (
                                <Play className="w-3.5 h-3.5 text-lime-signal" />
                            )}
                            Test Endpoint
                        </button>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                className="px-3 py-1.5 text-xs font-black uppercase tracking-wider border border-base-content/30 text-base-content hover:bg-base-content/10"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveRoute}
                                className="px-4 py-1.5 text-xs font-black uppercase tracking-wider bg-base-content text-base-100 hover:opacity-90"
                            >
                                {editingIndex !== null ? 'Update Route' : 'Save Route'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )}
</div>
    );
}
