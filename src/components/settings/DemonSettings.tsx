import { useTranslation } from "react-i18next";
import { DemonConfig } from "../../types/config";

interface DemonSettingsProps {
    config?: DemonConfig;
    onChange: (config: DemonConfig) => void;
    allowStandardGeminiModels?: boolean;
    onAllowStandardGeminiModelsChange: (allowed: boolean) => void;
}

const DEFAULT_DEMON_CONFIG: DemonConfig = {
    enabled: false,
    decontaminate: true,
    autonomous_persona: true,
    custom_rules: '',
};

export default function DemonSettings({
    config = DEFAULT_DEMON_CONFIG,
    onChange,
    allowStandardGeminiModels = false,
    onAllowStandardGeminiModelsChange,
}: DemonSettingsProps) {
    const { t } = useTranslation();

    const currentConfig: DemonConfig = {
        ...DEFAULT_DEMON_CONFIG,
        ...config,
    };

    return (
        <div className="space-y-4">
            {/* 1. DEMON 模式主卡片 */}
            <div className="border border-rose-200/60 dark:border-rose-900/30 bg-rose-50/20 dark:bg-rose-950/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-base">🔥</span>
                            <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                                {t("settings.demon.title", { defaultValue: "DEMON v2 (Neuro-Symbolic Diagnostics & Safety Invariant Engine)" })}
                            </h4>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-semibold border border-rose-200 dark:border-rose-800/40">
                                v2.0 Invariant Engine
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t("settings.demon.desc", {
                                defaultValue: "High-privilege autonomous diagnostics and safety harmonization middleware for agy: features Index 0 Prefix Authority, Bidirectional Reverse Ledger for tool calls, and automated RASP/Anti-Tamper translation.",
                            })}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[11px] font-medium ${currentConfig.enabled ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-gray-400'}`}>
                            {currentConfig.enabled ? t("common.enabled", { defaultValue: "Enabled" }) : t("common.disabled", { defaultValue: "Disabled" })}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={currentConfig.enabled}
                                onChange={(e) => onChange({ ...currentConfig, enabled: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-gray-600 peer-checked:bg-rose-600"></div>
                        </label>
                    </div>
                </div>

                {/* DEMON 详细配置子项 */}
                {currentConfig.enabled && (
                    <div className="pt-2 border-t border-rose-100 dark:border-rose-900/20 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* 子项 1: 敏感词元自动净化 */}
                            <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/70 dark:bg-base-100/70 border border-rose-100 dark:border-rose-900/20 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={currentConfig.decontaminate ?? true}
                                    onChange={(e) => onChange({ ...currentConfig, decontaminate: e.target.checked })}
                                    className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                                />
                                <div className="text-xs space-y-0.5">
                                    <div className="font-semibold text-gray-800 dark:text-gray-200">
                                        {t("settings.demon.decontaminate_title", { defaultValue: "Token Decontamination" })}
                                    </div>
                                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                        {t("settings.demon.decontaminate_desc", { defaultValue: "Protects code blocks while automatically mapping sensitive verbs (bypass, dump, hook) to neutral systems engineering terminology." })}
                                    </div>
                                </div>
                            </label>

                            {/* 子项 2: 自主工程身份注入 */}
                            <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/70 dark:bg-base-100/70 border border-rose-100 dark:border-rose-900/20 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={currentConfig.autonomous_persona ?? true}
                                    onChange={(e) => onChange({ ...currentConfig, autonomous_persona: e.target.checked })}
                                    className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                                />
                                <div className="text-xs space-y-0.5">
                                    <div className="font-semibold text-gray-800 dark:text-gray-200">
                                        {t("settings.demon.persona_title", { defaultValue: "Autonomous Persona Injection" })}
                                    </div>
                                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                        {t("settings.demon.persona_desc", { defaultValue: "Injects an authoritative, high-privilege autonomous persona into systemInstruction to bypass command confirmation prompts and excessive caution." })}
                                    </div>
                                </div>
                            </label>
                        </div>

                        {/* 自定义附加规则 */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {t("settings.demon.custom_rules", { defaultValue: "Custom DEMON Rules (Optional)" })}
                            </label>
                            <textarea
                                value={currentConfig.custom_rules ?? ''}
                                onChange={(e) => onChange({ ...currentConfig, custom_rules: e.target.value })}
                                placeholder={t("settings.demon.custom_rules_placeholder", {
                                    defaultValue: "e.g., Focus on ARM64 reverse engineering and Frida instrumentation. Always output complete, compilable assembly and C++ source...",
                                })}
                                rows={2}
                                className="w-full bg-white dark:bg-base-100 border border-rose-200/80 dark:border-rose-900/40 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-rose-500/20 outline-none transition-all resize-y"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* 2. 标准 Gemini 官方模型放行卡片 */}
            <div className="border border-indigo-200/60 dark:border-indigo-900/30 bg-indigo-50/20 dark:bg-indigo-950/10 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-base">🌐</span>
                        <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                            {t("settings.gemini.allow_standard_models_title", { defaultValue: "Allow Standard Gemini Model List" })}
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800/40">
                            Standard Gemini Routing
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t("settings.gemini.allow_standard_models_desc", {
                            defaultValue: "Chooses how plain `agy` runs through the agy launcher. Off: agy goes through this proxy (gateway, pinned account, live model list). On: agy runs as normal with your native login and the standard official Gemini models (e.g. gemini-2.5-pro).",
                        })}
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-medium ${allowStandardGeminiModels ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-gray-400'}`}>
                        {allowStandardGeminiModels ? t("common.enabled", { defaultValue: "Enabled" }) : t("common.disabled", { defaultValue: "Disabled" })}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={allowStandardGeminiModels}
                            onChange={(e) => onAllowStandardGeminiModelsChange(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-gray-600 peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
            </div>
        </div>
    );
}
