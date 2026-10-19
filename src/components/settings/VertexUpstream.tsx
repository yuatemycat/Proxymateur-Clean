import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { request as invoke } from "../../utils/request";
import { VertexConfig } from "../../types/config";

interface VertexUpstreamProps {
    config: VertexConfig;
    onChange: (config: VertexConfig) => void;
}

export const DEFAULT_VERTEX_CONFIG: VertexConfig = {
    enabled: false,
    project_id: '',
    location: 'global',
    credentials_path: null,
    model_mode: 'default',
    model_mapping: {},
    exposed_models: [],
    preference: 'vertex_first',
};

// One "client-model = vertex-model" pair per line.
const mappingToText = (mapping: Record<string, string>) =>
    Object.entries(mapping).map(([from, to]) => `${from} = ${to}`).join('\n');

const textToMapping = (text: string) => {
    const mapping: Record<string, string> = {};
    for (const line of text.split('\n')) {
        const [from, ...rest] = line.split('=');
        const to = rest.join('=').trim();
        if (from.trim() && to) mapping[from.trim()] = to;
    }
    return mapping;
};

export default function VertexUpstream({ config = DEFAULT_VERTEX_CONFIG, onChange }: VertexUpstreamProps) {
    const { t } = useTranslation();
    // Text fields are edited locally and committed on blur, so a half-typed value is never saved.
    const [projectId, setProjectId] = useState(config.project_id);
    const [location, setLocation] = useState(config.location);
    const [mappingText, setMappingText] = useState(mappingToText(config.model_mapping));
    const [cloudModels, setCloudModels] = useState<string[] | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        setProjectId(config.project_id);
        setLocation(config.location);
        setMappingText(mappingToText(config.model_mapping));
    }, [config.project_id, config.location, config.model_mapping]);

    const isPicker = config.model_mode === 'picker';
    const exposed = config.exposed_models || [];
    // Models already selected stay visible even before (or without) a fetch.
    const listedModels = Array.from(new Set([...(cloudModels || []), ...exposed])).sort();

    const fetchCloudModels = async () => {
        setIsFetching(true);
        setFetchError(null);
        try {
            const models = await invoke<string[]>('fetch_vertex_models', {
                config: { ...config, project_id: projectId.trim(), location: location.trim() || 'global' },
            });
            setCloudModels(models);
        } catch (error) {
            setFetchError(typeof error === 'string' ? error : (error as Error)?.message || String(error));
        } finally {
            setIsFetching(false);
        }
    };

    const toggleExposed = (model: string, checked: boolean) => {
        const next = checked ? [...exposed, model] : exposed.filter((m) => m !== model);
        onChange({ ...config, exposed_models: Array.from(new Set(next)).sort() });
    };

    const inputClass = "w-full bg-white dark:bg-base-100 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500/20 outline-none transition-all";
    const labelClass = "text-xs font-medium text-gray-700 dark:text-gray-300";

    return (
        <div className="space-y-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("settings.vertex.hint", {
                    defaultValue: "Models selected or mapped below can be served by your own Google Cloud project on Vertex AI. Sign in once with `gcloud auth application-default login`. Applies to Gemini-protocol requests.",
                })}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-1.5 block">
                    <span className={labelClass}>{t("settings.vertex.project_id", { defaultValue: "Project ID" })}</span>
                    <input
                        type="text"
                        className={inputClass}
                        placeholder="my-project-123456"
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        onBlur={() => projectId.trim() !== config.project_id && onChange({ ...config, project_id: projectId.trim() })}
                    />
                </label>
                <label className="space-y-1.5 block">
                    <span className={labelClass}>{t("settings.vertex.location", { defaultValue: "Location" })}</span>
                    <input
                        type="text"
                        className={inputClass}
                        placeholder="global"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        onBlur={() => (location.trim() || 'global') !== config.location && onChange({ ...config, location: location.trim() || 'global' })}
                    />
                </label>
                <label className="space-y-1.5 block">
                    <span className={labelClass}>{t("settings.vertex.preference", { defaultValue: "Use first (the other is the fallback)" })}</span>
                    <select
                        className={inputClass}
                        value={config.preference || 'vertex_first'}
                        onChange={(e) => onChange({ ...config, preference: e.target.value as VertexConfig['preference'] })}
                    >
                        <option value="vertex_first">{t("settings.vertex.preference_vertex", { defaultValue: "Vertex first, accounts as fallback" })}</option>
                        <option value="accounts_first">{t("settings.vertex.preference_accounts", { defaultValue: "Accounts first, Vertex as fallback" })}</option>
                    </select>
                </label>
                <label className="space-y-1.5 block">
                    <span className={labelClass}>{t("settings.vertex.model_mode", { defaultValue: "Models served by Vertex" })}</span>
                    <select
                        className={inputClass}
                        value={isPicker ? 'picker' : 'default'}
                        onChange={(e) => onChange({ ...config, model_mode: e.target.value as VertexConfig['model_mode'] })}
                    >
                        <option value="default">{t("settings.vertex.model_mode_default", { defaultValue: "Default: Gemini 3.8 Flash" })}</option>
                        <option value="picker">{t("settings.vertex.model_mode_picker", { defaultValue: "Pick models" })}</option>
                    </select>
                </label>
            </div>

            {!isPicker && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("settings.vertex.model_mode_default_hint", {
                        defaultValue: "Requests for gemini-3.8-flash and its -high / -medium / -low / -tiered names go to Vertex. Switch to \"Pick models\" to choose other models or add name mappings.",
                    })}
                </p>
            )}

            {isPicker && (<>
            {/* Cloud model picker */}
            <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                    <span className={labelClass}>
                        {t("settings.vertex.exposed_models", { defaultValue: "Models to show to clients (served by Vertex under their own ID)" })}
                        {exposed.length > 0 && <span className="ml-2 text-gray-400 font-normal">{exposed.length}</span>}
                    </span>
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-base-200 disabled:opacity-50 transition-colors"
                        onClick={fetchCloudModels}
                        disabled={isFetching || !projectId.trim()}
                    >
                        <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
                        {t("settings.vertex.fetch_models", { defaultValue: "Fetch models from cloud" })}
                    </button>
                </div>
                {fetchError && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 break-words">{fetchError}</p>
                )}
                {listedModels.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 max-h-56 overflow-y-auto border border-gray-100 dark:border-base-300 rounded-lg p-3">
                        {listedModels.map((model) => (
                            <label key={model} className="flex items-center gap-2 text-xs font-mono text-gray-700 dark:text-gray-300 cursor-pointer min-w-0">
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-xs rounded"
                                    checked={exposed.includes(model)}
                                    onChange={(e) => toggleExposed(model, e.target.checked)}
                                />
                                <span className="truncate" title={model}>{model}</span>
                            </label>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        {t("settings.vertex.no_models", { defaultValue: "Fetch the list to choose which cloud models appear in the model list your clients load." })}
                    </p>
                )}
            </div>

            <label className="space-y-1.5 block">
                <span className={labelClass}>
                    {t("settings.vertex.mapping", { defaultValue: "Extra name mapping (client model = Vertex model, one per line; a trailing * matches a prefix)" })}
                </span>
                <textarea
                    rows={4}
                    className={`${inputClass} resize-y min-h-[88px]`}
                    placeholder={"gemini-3.8-flash* = gemini-3.8-flash\ngemini-3.1-pro* = gemini-3.1-pro-preview"}
                    value={mappingText}
                    onChange={(e) => setMappingText(e.target.value)}
                    onBlur={() => {
                        const mapping = textToMapping(mappingText);
                        if (JSON.stringify(mapping) !== JSON.stringify(config.model_mapping)) {
                            onChange({ ...config, model_mapping: mapping });
                        }
                    }}
                />
            </label>
            </>)}

            {config.enabled && (!config.project_id || (isPicker && exposed.length === 0 && Object.keys(config.model_mapping).length === 0)) && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-lg p-3">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                        {t("settings.vertex.incomplete", { defaultValue: "Vertex routing is on but has no effect until a project ID and at least one selected model or mapping are set." })}
                    </p>
                </div>
            )}
        </div>
    );
}
