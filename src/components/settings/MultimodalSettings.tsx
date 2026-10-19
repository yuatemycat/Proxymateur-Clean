import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Save, Check, Image as ImageIcon, ShieldAlert, Layers, Sparkles, HardDrive } from "lucide-react";
import { MultimodalConfig } from "../../types/config";
import { showToast } from "../common/ToastContainer";

interface MultimodalSettingsProps {
    config?: MultimodalConfig;
    onChange: (config: MultimodalConfig) => void;
    onSave?: () => Promise<void> | void;
}

export const MultimodalSettings: React.FC<MultimodalSettingsProps> = ({
    config = {
        enable_sliding_window: false,
        strategy: "count",
        max_fresh_images: 10,
        strip_remote_urls: false,
        max_total_image_mb: 32,
    },
    onChange,
    onSave,
}) => {
    const { t } = useTranslation();
    const [isSaving, setIsSaving] = useState(false);
    const [savedSuccessfully, setSavedSuccessfully] = useState(false);

    const localConfig: MultimodalConfig = {
        enable_sliding_window: config?.enable_sliding_window ?? false,
        strategy: config?.strategy ?? "count",
        max_fresh_images: config?.max_fresh_images ?? 10,
        strip_remote_urls: config?.strip_remote_urls ?? false,
        max_total_image_mb: config?.max_total_image_mb ?? 32,
    };

    const updateConfig = (patch: Partial<MultimodalConfig>) => {
        onChange({
            ...localConfig,
            ...patch,
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (onSave) {
                await onSave();
            }
            setSavedSuccessfully(true);
            showToast(t("common.success", { defaultValue: "Success" }), "success");
            setTimeout(() => setSavedSuccessfully(false), 2000);
        } catch (error: any) {
            console.error("Failed to save multimodal settings:", error);
            showToast(t("common.error", { defaultValue: "Error" }), "error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-5 text-gray-800 dark:text-gray-200">
            {/* 顶栏说明提示 */}
            <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/20 rounded-xl border border-blue-200/70 dark:border-blue-800/40 text-xs leading-relaxed space-y-1">
                <div className="font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-blue-600 dark:text-blue-400" />
                    {t("proxy.multimodal.banner_title", { defaultValue: "Multimodal Interaction & Longevity Governance (Pipeline First)" })}
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                    {t("proxy.multimodal.banner_desc", {
                        defaultValue: "Designed for long-horizon multimodal agents (Codex, Claude Code, Cursor) that frequently inspect screenshots and files. Provides protocol-agnostic sliding-window freshness and memory explosion safeguards, preventing 400 errors and token inflation from accumulated historical images."
                    })}
                </p>
            </div>

            {/* 核心配置板块: 滑动窗口历史保鲜总控 */}
            <div className="p-4 bg-gray-50/70 dark:bg-base-200/60 rounded-xl border border-gray-200/70 dark:border-base-300 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200/60 dark:border-base-300/60">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                <Layers size={14} className="text-purple-500" />
                                {t("proxy.multimodal.sliding_window_title", { defaultValue: "Multimodal History Freshness Sliding Window" })}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                                {t("proxy.multimodal.opt_in_tag", { defaultValue: "Recommended for Long-Horizon Agents (Disabled by default)" })}
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            {t("proxy.multimodal.sliding_window_desc", {
                                defaultValue: "Disabled by default (100% transparent forwarding). When enabled, the gateway preserves full multimodal embeddings for the latest N images, stripping Base64 from older history and replacing them with structured placeholders."
                            })}
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={localConfig.enable_sliding_window}
                            onChange={(e) => updateConfig({ enable_sliding_window: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                    </label>
                </div>

                {/* 开启滑窗后的独立策略选择 */}
                <div className={`space-y-4 transition-all duration-200 ${localConfig.enable_sliding_window ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    {/* 策略模式选择切换器 */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                            {t("proxy.multimodal.strategy_select_label", { defaultValue: "Freshness Strategy Mode (Choose one independent strategy)" })}
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {/* 策略一：按张数 */}
                            <div
                                onClick={() => updateConfig({ strategy: "count" })}
                                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                                    localConfig.strategy !== "memory"
                                        ? "bg-purple-50/80 dark:bg-purple-950/30 border-purple-500/80 ring-1 ring-purple-500/40"
                                        : "bg-white dark:bg-base-100 border-gray-200 dark:border-base-300 hover:border-gray-300"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="strategy"
                                    checked={localConfig.strategy !== "memory"}
                                    onChange={() => updateConfig({ strategy: "count" })}
                                    className="mt-0.5 radio radio-xs radio-primary"
                                />
                                <div className="space-y-0.5">
                                    <div className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                        <ImageIcon size={13} className="text-purple-600 dark:text-purple-400" />
                                        {t("proxy.multimodal.strategy_count_title", { defaultValue: "Count-Based Freshness" })}
                                    </div>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                                        {t("proxy.multimodal.strategy_count_desc", { defaultValue: "Preserves the latest N images regardless of size. Intuitive and strictly maps to conversation turns." })}
                                    </p>
                                </div>
                            </div>

                            {/* 策略二：按内存 */}
                            <div
                                onClick={() => updateConfig({ strategy: "memory" })}
                                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                                    localConfig.strategy === "memory"
                                        ? "bg-purple-50/80 dark:bg-purple-950/30 border-purple-500/80 ring-1 ring-purple-500/40"
                                        : "bg-white dark:bg-base-100 border-gray-200 dark:border-base-300 hover:border-gray-300"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="strategy"
                                    checked={localConfig.strategy === "memory"}
                                    onChange={() => updateConfig({ strategy: "memory" })}
                                    className="mt-0.5 radio radio-xs radio-primary"
                                />
                                <div className="space-y-0.5">
                                    <div className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                        <HardDrive size={13} className="text-purple-600 dark:text-purple-400" />
                                        {t("proxy.multimodal.strategy_memory_title", { defaultValue: "Memory-Based Freshness" })}
                                    </div>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                                        {t("proxy.multimodal.strategy_memory_desc", { defaultValue: "Scans backward from latest turn by Base64 volume. Retains images within budget, evicts older ones." })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 策略具体参数配置区 */}
                    <div className="p-3.5 bg-white dark:bg-base-100 rounded-xl border border-gray-200/70 dark:border-base-300 space-y-3">
                        {localConfig.strategy !== "memory" ? (
                            /* 策略一参数: 保鲜最大张数 */
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                                <div className="sm:col-span-2 space-y-0.5">
                                    <label className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                        <ImageIcon size={13} className="text-blue-500" />
                                        {t("proxy.multimodal.max_fresh_images_label", { defaultValue: "Max Fresh Images in Window" })}
                                    </label>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                        {t("proxy.multimodal.max_fresh_images_hint", {
                                            defaultValue: "Retains full visual multimodal embeddings for the latest N images. Older images have their Base64 stripped and replaced by placeholders. Set 0 for unlimited image count (bounded only by total capacity)."
                                        })}
                                    </p>
                                </div>
                                <div className="sm:col-span-1">
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min={0}
                                            max={1000}
                                            value={localConfig.max_fresh_images}
                                            onChange={(e) => updateConfig({ max_fresh_images: Math.max(0, parseInt(e.target.value) || 0) })}
                                            disabled={!localConfig.enable_sliding_window}
                                            className="w-full px-3 py-1.5 border border-gray-300 dark:border-base-300 rounded-lg bg-white dark:bg-base-200 text-xs font-mono text-gray-900 dark:text-base-content focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                            placeholder="10"
                                        />
                                        <span className="absolute right-3 top-1.5 text-xs text-gray-400 pointer-events-none">
                                            {t("proxy.multimodal.unit_images", { defaultValue: "images" })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* 策略二参数: 内存配额 */
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                                <div className="sm:col-span-2 space-y-0.5">
                                    <label className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                        <ShieldAlert size={13} className="text-amber-500" />
                                        {t("proxy.multimodal.memory_budget_label", { defaultValue: "Cumulative Memory Freshness Limit" })}
                                    </label>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                        {t("proxy.multimodal.memory_budget_hint", {
                                            defaultValue: "Sets total decoded Base64 volume budget. Scans backward from latest turn; images within budget are kept, earlier excess images are replaced with placeholders."
                                        })}
                                    </p>
                                </div>
                                <div className="sm:col-span-1">
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min={1}
                                            max={512}
                                            value={localConfig.max_total_image_mb}
                                            onChange={(e) => updateConfig({ max_total_image_mb: Math.max(1, parseInt(e.target.value) || 1) })}
                                            disabled={!localConfig.enable_sliding_window}
                                            className="w-full px-3 py-1.5 border border-gray-300 dark:border-base-300 rounded-lg bg-white dark:bg-base-200 text-xs font-mono text-gray-900 dark:text-base-content focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                            placeholder="32"
                                        />
                                        <span className="absolute right-3 top-1.5 text-xs text-gray-400 pointer-events-none">
                                            MB
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 剥离 OSS / 远程 URL 直链子开关（两种策略均可自由决定） */}
                        <div className="pt-2.5 border-t border-gray-100 dark:border-base-300 flex items-start gap-3">
                            <input
                                type="checkbox"
                                id="strip_remote_urls"
                                checked={localConfig.strip_remote_urls}
                                onChange={(e) => updateConfig({ strip_remote_urls: e.target.checked })}
                                disabled={!localConfig.enable_sliding_window}
                                className="mt-0.5 checkbox checkbox-sm checkbox-primary rounded"
                            />
                            <label htmlFor="strip_remote_urls" className="cursor-pointer space-y-0.5 select-none">
                                <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                                    {t("proxy.multimodal.strip_remote_urls_label", { defaultValue: "Also strip historical remote / OSS image direct links" })}
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                    {t("proxy.multimodal.strip_remote_urls_hint", {
                                        defaultValue: "Disabled by default (only strips heavy Base64 payloads, preserving lightweight HTTP/HTTPS URLs). When checked, historical remote direct links are also replaced with placeholders to maximize token savings."
                                    })}
                                </p>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* 保存按钮 */}
            <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    {t("proxy.multimodal.hot_reload_hint", { defaultValue: "Settings take effect immediately upon saving without restarting proxy service." })}
                </span>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs active:scale-95 ${
                        savedSuccessfully
                            ? 'bg-green-600 text-white'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                    } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {savedSuccessfully ? (
                        <>
                            <Check size={14} />
                            {t("common.saved", { defaultValue: "Saved successfully" })}
                        </>
                    ) : (
                        <>
                            <Save size={14} />
                            {isSaving ? t("common.saving", { defaultValue: "Saving..." }) : t("proxy.multimodal.save_btn", { defaultValue: "Save Multimodal Settings" })}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default MultimodalSettings;
