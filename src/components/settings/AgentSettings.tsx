import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Save, Check, Bot, Laptop, ShieldCheck, Zap, Terminal } from "lucide-react";
import { ExperimentalConfig } from "../../types/config";
import { showToast } from "../common/ToastContainer";

interface AgentSettingsProps {
    experimentalConfig?: ExperimentalConfig;
    onChange: (updates: Partial<ExperimentalConfig>) => void;
    onSave?: () => Promise<void> | void;
}

export const AgentSettings: React.FC<AgentSettingsProps> = ({
    experimentalConfig,
    onChange,
    onSave,
}) => {
    const { t } = useTranslation();
    const [isSaving, setIsSaving] = useState(false);
    const [savedSuccessfully, setSavedSuccessfully] = useState(false);

    const isEnabled = experimentalConfig?.enable_cowork_auto_compact ?? false;
    const threshold = experimentalConfig?.cowork_compact_threshold ?? 200000;

    const isAgyEnabled = experimentalConfig?.enable_agy_auto_compact ?? false;
    const agyThreshold = experimentalConfig?.agy_compact_threshold ?? 200000;

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
            console.error("Failed to save agent-specific settings:", error);
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
                    <Bot size={14} className="text-blue-600 dark:text-blue-400" />
                    {t("proxy.agent_settings.banner_title", { defaultValue: "Agent-Specific Features & Optimization Governance" })}
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                    {t("proxy.agent_settings.banner_desc", {
                        defaultValue: "Client-specific mechanisms and sandbox restrictions for mainstream agents (Claude Desktop, Claude Code, Cursor, Cline, etc.), with non-intrusive gateway-level coordination. Traffic is passed through untouched by default; the gateway only intervenes for the specified agents once enabled."
                    })}
                </p>
            </div>

            {/* 板块 1: Claude Desktop 板块 */}
            <div className="p-4 bg-gray-50/70 dark:bg-base-200/60 rounded-xl border border-gray-200/70 dark:border-base-300 space-y-4">
                {/* 标题栏 */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-200/60 dark:border-base-300/60">
                    <div className="flex items-center gap-2">
                        <Laptop size={16} className="text-cyan-500" />
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {t("proxy.agent_settings.claude_desktop.title", { defaultValue: "Claude Desktop Series" })}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300">
                            {t("proxy.agent_settings.claude_desktop.tag", { defaultValue: "Cowork mode only" })}
                        </span>
                    </div>
                </div>

                {/* Cowork 模式自动响应式自愈压缩开关 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200/60 dark:border-base-300/60">
                    <div className="space-y-0.5 max-w-xl">
                        <div className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                            <Zap size={14} className="text-amber-500" />
                            {t("proxy.agent_settings.claude_desktop.auto_compact_title", {
                                defaultValue: "Cowork Auto Reactive Compact (self-healing)"
                            })}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal">
                            {t("proxy.agent_settings.claude_desktop.auto_compact_desc", {
                                defaultValue: "Addresses Cowork mode being unable to run /compact, its sandbox bypassing local configuration, and frequent full-screen screenshots inflating the context to 200k+ tokens (a single JSON payload reaching 20-36 MB) and causing stalls of tens of seconds. When enabled, the gateway performs a dual authorization check in the background (strictly identifying Cowork sessions and unconditionally exempting compaction summary requests), then triggers the client's built-in Summarizer in place to insert a compact_boundary that folds history and screenshots, restoring near-instant responses. Disabled by default so you can fully use Gemini's 1M-token context."
                            })}
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                        <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) => onChange({ enable_cowork_auto_compact: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-cyan-600"></div>
                    </label>
                </div>

                {/* 阈值编辑区 (仅开启时可用) */}
                <div className={`space-y-3 transition-all duration-200 ${isEnabled ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                            <label className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                                {t("proxy.agent_settings.claude_desktop.threshold_label", {
                                    defaultValue: "Compaction trigger threshold (Tokens)"
                                })}
                            </label>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                {t("proxy.agent_settings.claude_desktop.threshold_desc", {
                                    defaultValue: "Triggers the self-healing signal when the estimated token level of a Cowork session reaches this value. Full-screen screenshots are estimated at the official rate (~1,600 tokens each)."
                                })}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={50000}
                                max={500000}
                                step={10000}
                                value={threshold}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (!isNaN(val)) {
                                        onChange({ cowork_compact_threshold: Math.max(50000, val) });
                                    }
                                }}
                                className="w-32 px-3 py-1.5 text-xs text-right font-mono bg-white dark:bg-base-100 border border-gray-300 dark:border-base-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                            />
                            <span className="text-xs text-gray-500 dark:text-gray-400">Tokens</span>
                        </div>
                    </div>

                    {/* 快捷推荐预设胶囊 */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 mr-1">Quick presets:</span>
                        {[
                            { label: "150,000 (Fastest)", val: 150000 },
                            { label: "180,000 (Agile)", val: 180000 },
                            { label: "200,000 (Recommended)", val: 200000 },
                            { label: "250,000 (Relaxed)", val: 250000 },
                        ].map((preset) => (
                            <button
                                key={preset.val}
                                type="button"
                                onClick={() => onChange({ cowork_compact_threshold: preset.val })}
                                className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-all ${
                                    threshold === preset.val
                                        ? "bg-cyan-500 text-white shadow-xs"
                                        : "bg-white dark:bg-base-100 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-base-300 hover:border-cyan-300 dark:hover:border-cyan-700"
                                }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    {/* 双重校验安全保障提示 */}
                    <div className="flex items-start gap-2 p-2.5 bg-amber-50/60 dark:bg-amber-950/20 rounded-lg border border-amber-200/60 dark:border-amber-800/30 text-[11px] text-amber-800 dark:text-amber-300">
                        <ShieldCheck size={14} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <span>
                            {t("proxy.agent_settings.claude_desktop.safety_note", {
                                defaultValue: "Background dual safety check: (1) only applies to desktop sessions whose tools explicitly include mcp__cowork, so regular CLI / Cursor traffic is never affected; (2) summary requests carrying x-stainless-helper: compaction, or a prompt containing the official compaction signature, are unconditionally allowed through, so sessions can never deadlock."
                            })}
                        </span>
                    </div>
                </div>
            </div>

            {/* 板块 2: Antigravity CLI (AGY CLI / agy) 板块 */}
            <div className="p-4 bg-gray-50/70 dark:bg-base-200/60 rounded-xl border border-gray-200/70 dark:border-base-300 space-y-4">
                {/* 标题栏 */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-200/60 dark:border-base-300/60">
                    <div className="flex items-center gap-2">
                        <Terminal size={16} className="text-emerald-500" />
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                            Antigravity CLI (AGY CLI / agy) Series
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-full font-medium">
                            Terminal Agent
                        </span>
                    </div>
                </div>

                {/* 开关与说明 */}
                <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-900 dark:text-white flex items-center gap-1.5 cursor-pointer">
                                <Zap size={14} className="text-emerald-500" />
                                AGY CLI Auto Reactive Compact & Token Governor
                            </label>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                                Regulates active session token growth in AGY CLI terminal sessions. When tool outputs, log tailing, and long-turn deliberations push context toward the ceiling, triggers automated history folding into a clean status summary, preventing latency spikes and context buffer overflows.
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            className="toggle toggle-sm toggle-success shrink-0 mt-0.5"
                            checked={isAgyEnabled}
                            onChange={(e) => onChange({ enable_agy_auto_compact: e.target.checked })}
                        />
                    </div>

                    {/* 阈值滑块与输入框 */}
                    <div className={`space-y-2 pt-2 transition-opacity ${!isAgyEnabled ? "opacity-40 pointer-events-none" : ""}`}>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                Compaction trigger threshold (Tokens)
                            </span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={50000}
                                    max={500000}
                                    step={10000}
                                    value={agyThreshold}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        if (!isNaN(val)) {
                                            onChange({ agy_compact_threshold: Math.max(50000, val) });
                                        }
                                    }}
                                    className="w-32 px-3 py-1.5 text-xs text-right font-mono bg-white dark:bg-base-100 border border-gray-300 dark:border-base-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                                />
                                <span className="text-xs text-gray-500 dark:text-gray-400">Tokens</span>
                            </div>
                        </div>

                        {/* 滑块控件 */}
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min={50000}
                                max={500000}
                                step={10000}
                                value={agyThreshold}
                                onChange={(e) => onChange({ agy_compact_threshold: parseInt(e.target.value, 10) })}
                                className="range range-xs range-success flex-1"
                            />
                            <span className="text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-400 w-14 text-right">
                                {(agyThreshold / 1000).toFixed(0)}k
                            </span>
                        </div>

                        {/* 快捷推荐预设胶囊 */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[11px] text-gray-400 dark:text-gray-500 mr-1">Quick presets:</span>
                            {[
                                { label: "120,000 (Fastest - Log Heavy)", val: 120000 },
                                { label: "180,000 (Agile - Coding)", val: 180000 },
                                { label: "250,000 (Recommended Default)", val: 250000 },
                                { label: "400,000 (Deep Context)", val: 400000 },
                            ].map((preset) => (
                                <button
                                    key={preset.val}
                                    type="button"
                                    onClick={() => onChange({ agy_compact_threshold: preset.val })}
                                    className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-all ${
                                        agyThreshold === preset.val
                                            ? "bg-emerald-600 text-white shadow-xs"
                                            : "bg-white dark:bg-base-100 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-base-300 hover:border-emerald-300 dark:hover:border-emerald-700"
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>

                        {/* 协同与防护说明 */}
                        <div className="flex items-start gap-2 p-2.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-lg border border-emerald-200/60 dark:border-emerald-800/30 text-[11px] text-emerald-800 dark:text-emerald-300 mt-2">
                            <ShieldCheck size={14} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                            <span>
                                Synergizes with the <code>agy-context-guard</code> MCP to filter task log spam and tail terminal streams. When threshold is met, the CLI safely condenses previous step history into a concise state checkpoint, while pinned variables remain preserved.
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 保存按钮 */}
            {onSave && (
                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`btn btn-sm text-xs gap-1.5 font-medium transition-all ${
                            savedSuccessfully
                                ? "bg-green-600 hover:bg-green-700 text-white"
                                : "bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs"
                        }`}
                    >
                        {savedSuccessfully ? (
                            <>
                                <Check size={14} />
                                {t("common.saved", { defaultValue: "Saved successfully" })}
                            </>
                        ) : (
                            <>
                                <Save size={14} />
                                {isSaving ? t("common.saving", { defaultValue: "Saving..." }) : t("common.save", { defaultValue: "Save" })}
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default AgentSettings;
