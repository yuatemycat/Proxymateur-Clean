import { useState, useRef, useEffect } from "react";
import { useTranslation, Trans } from "react-i18next";
import { Save, Check, ChevronDown, Layers, HelpCircle, HardDrive, Trash2, AlertTriangle } from "lucide-react";
import { request } from "../../utils/request";
import { showToast } from "../common/ToastContainer";
import {
    ThinkingBudgetConfig,
    ThinkingControlSource,
    ThinkingBudgetMode,
} from "../../types/config";

interface ThinkingBudgetProps {
    config?: ThinkingBudgetConfig;
    onChange: (config: ThinkingBudgetConfig) => void;
    onSave?: () => Promise<void> | void;
    thinkingStoreEnabled?: boolean;
    onThinkingStoreChange?: (enabled: boolean) => void;
    thinkingMaxMemoryTurns?: number;
    onThinkingMaxMemoryTurnsChange?: (turns: number) => void;
    thinkingRetentionDays?: number;
    onThinkingRetentionDaysChange?: (days: number) => void;
}

interface ConcurrencyGuidePreset {
    key: string;
    icon: string;
    titleKey: string;
    titleDefault: string;
    descKey: string;
    descDefault: string;
}

const CONCURRENCY_GUIDE_PRESETS: ConcurrencyGuidePreset[] = [
    {
        key: "1g",
        icon: "🖥️",
        titleKey: "proxy.config.thinking_budget.guide_preset_1g_title",
        titleDefault: "1GB RAM Lightweight Server:",
        descKey: "proxy.config.thinking_budget.guide_preset_1g_desc",
        descDefault: "Recommended: <1>100 ~ 200 turns</1>. Hundreds of concurrent sessions consume only ~50MB RAM, extremely resilient against OOM.",
    },
    {
        key: "team",
        icon: "👥",
        titleKey: "proxy.config.thinking_budget.guide_preset_team_title",
        titleDefault: "Personal & Small Teams (1-10 Users):",
        descKey: "proxy.config.thinking_budget.guide_preset_team_desc",
        descDefault: "Recommended: <1>600 ~ 1000 turns</1>. Thousands of historical turns stay resident in RAM for 0ms lightning-fast responses.",
    },
    {
        key: "enterprise",
        icon: "🏢",
        titleKey: "proxy.config.thinking_budget.guide_preset_enterprise_title",
        titleDefault: "100 Users Enterprise (2G-4G):",
        descKey: "proxy.config.thinking_budget.guide_preset_enterprise_desc",
        descDefault: "Recommended: <1>300 ~ 600 turns</1>. 95%+ requests hit RAM, delivering peak performance with rock-solid stability.",
    },
    {
        key: "relay",
        icon: "🌐",
        titleKey: "proxy.config.thinking_budget.guide_preset_relay_title",
        titleDefault: "1K+ Users Public Relay (4G-8G):",
        descKey: "proxy.config.thinking_budget.guide_preset_relay_desc",
        descDefault: "Recommended: <1>150 ~ 300 turns</1>. Memory prioritized for connection pools; long-turn cold histories safely offloaded to SQLite.",
    },
    {
        key: "cluster",
        icon: "🚀",
        titleKey: "proxy.config.thinking_budget.guide_preset_cluster_title",
        titleDefault: "10K ~ 100K+ Massive Cluster:",
        descKey: "proxy.config.thinking_budget.guide_preset_cluster_desc",
        descDefault: "Recommended: <1>50 ~ 100 turns</1>. Effortlessly sustains tens of thousands of concurrent sessions; lock-free WAL index ensures sub-second responses.",
    },
];

const DEFAULT_CONFIG: ThinkingBudgetConfig = {
    control_source: "gateway",
    flash_mode: "custom",
    flash_low: 1024,
    flash_medium: 4096,
    flash_high: -1,
    flash_tiered: -1,

    pro_mode: "custom",
    pro_low: 1001,
    pro_high: 10001,

    claude_mode: "custom",
    claude_budget: 16384,
    claude_low: 1024,
    claude_medium: 4096,
    claude_high: 16384,

    mode: "custom",
    custom_value: 24576,
    custom_low: 1024,
    custom_medium: 4096,
    custom_high: 16384,
    custom_tiered: -1,
};

type BudgetFieldKey =
    | "flash_low"
    | "flash_medium"
    | "flash_high"
    | "flash_tiered"
    | "pro_low"
    | "pro_high"
    | "claude_budget"
    | "claude_low"
    | "claude_medium"
    | "claude_high";

const BUDGET_DEFAULTS: Record<BudgetFieldKey, number> = {
    flash_low: 1024,
    flash_medium: 4096,
    flash_high: -1,
    flash_tiered: -1,
    pro_low: 1001,
    pro_high: 10001,
    claude_budget: 16384,
    claude_low: 1024,
    claude_medium: 4096,
    claude_high: 16384,
};

export default function ThinkingBudget({
    config = DEFAULT_CONFIG,
    onChange,
    onSave,
    thinkingStoreEnabled = true,
    onThinkingStoreChange,
    thinkingMaxMemoryTurns = 600,
    onThinkingMaxMemoryTurnsChange,
    thinkingRetentionDays = 15,
    onThinkingRetentionDaysChange,
}: ThinkingBudgetProps) {
    const { t } = useTranslation();
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [showClaudeAdvanced, setShowClaudeAdvanced] = useState(false);
    const [isClearingThinking, setIsClearingThinking] = useState(false);
    const [showClearThinkingConfirm, setShowClearThinkingConfirm] = useState(false);

    const handleClearThinkingStore = async () => {
        setIsClearingThinking(true);
        try {
            const res = await request<number | { deleted?: number }>("clear_thinking_store");
            const count = typeof res === "number" ? res : res?.deleted ?? 0;
            showToast(
                t("proxy.config.thinking_budget.clear_success", {
                    count,
                    defaultValue: `Successfully cleared thinking store ({{count}} records cleaned)`,
                }),
                "success"
            );
            setShowClearThinkingConfirm(false);
        } catch (err: any) {
            showToast(
                t("proxy.config.thinking_budget.clear_error", {
                    error: String(err),
                    defaultValue: `Failed to clear thinking store: {{error}}`,
                }),
                "error"
            );
        } finally {
            setIsClearingThinking(false);
        }
    };

    const currentConfig: ThinkingBudgetConfig = {
        ...DEFAULT_CONFIG,
        ...config,
    };

    // 预算输入框本地编辑文本状态，允许用户清空退格为 "" 或输入负号 "-"
    const [inputValues, setInputValues] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        for (const [key, defaultVal] of Object.entries(BUDGET_DEFAULTS)) {
            const val = (config as any)?.[key];
            init[key] = val !== undefined && val !== null ? String(val) : String(defaultVal);
        }
        return init;
    });

    // 外部配置实质性更新时同步（保留正在编辑的空值状态）
    const lastConfigRef = useRef(config);
    useEffect(() => {
        if (config && config !== lastConfigRef.current) {
            lastConfigRef.current = config;
            setInputValues((prev) => {
                const next = { ...prev };
                for (const key of Object.keys(BUDGET_DEFAULTS)) {
                    const val = (config as any)?.[key];
                    if (val !== undefined && val !== null) {
                        const parsed = parseInt(prev[key], 10);
                        if (parsed !== val && prev[key] !== "" && prev[key] !== "-") {
                            next[key] = String(val);
                        }
                    }
                }
                return next;
            });
        }
    }, [config]);

    // 内存思考轮次与持久化天数输入框本地文本状态，允许自由编辑退格，失焦时自动校验归一化
    const [memoryTurnsInput, setMemoryTurnsInput] = useState<string>(() => String(thinkingMaxMemoryTurns));
    const [retentionDaysInput, setRetentionDaysInput] = useState<string>(() => String(thinkingRetentionDays));

    useEffect(() => {
        setMemoryTurnsInput(String(thinkingMaxMemoryTurns));
    }, [thinkingMaxMemoryTurns]);

    useEffect(() => {
        setRetentionDaysInput(String(thinkingRetentionDays));
    }, [thinkingRetentionDays]);

    const handleControlSourceChange = (source: ThinkingControlSource) => {
        onChange({
            ...currentConfig,
            control_source: source,
        });
    };

    const handleFlashModeChange = (mode: ThinkingBudgetMode) => {
        onChange({
            ...currentConfig,
            flash_mode: mode,
        });
    };

    const handleProModeChange = (mode: ThinkingBudgetMode) => {
        onChange({
            ...currentConfig,
            pro_mode: mode,
        });
    };

    const handleClaudeModeChange = (mode: ThinkingBudgetMode) => {
        onChange({
            ...currentConfig,
            claude_mode: mode,
        });
    };

    // 输入框变更处理：允许清空为 ""，允许 "-"，不自动补 -1
    const handleInputChange = (field: BudgetFieldKey, rawVal: string) => {
        if (rawVal !== "" && rawVal !== "-" && !/^-?\d+$/.test(rawVal)) {
            return;
        }
        setInputValues((prev) => ({
            ...prev,
            [field]: rawVal,
        }));

        // 如果是合法完整数字，实时同步给配置对象；空值时不写入，留待最后保存阶段回填默认值
        const trimmed = rawVal.trim();
        if (trimmed !== "" && trimmed !== "-") {
            const parsed = parseInt(trimmed, 10);
            if (!isNaN(parsed)) {
                onChange({
                    ...currentConfig,
                    [field]: parsed,
                });
            }
        }
    };

    // 最后保存配置阶段：对处于清空/非法状态的预算输入框自动回填为默认值
    const handleSave = async () => {
        const nextInputs = { ...inputValues };
        const nextConfig: ThinkingBudgetConfig = { ...currentConfig };

        for (const [key, defaultVal] of Object.entries(BUDGET_DEFAULTS)) {
            const valStr = (nextInputs[key] ?? "").trim();
            let finalVal: number;
            if (valStr === "" || valStr === "-" || isNaN(parseInt(valStr, 10))) {
                finalVal = defaultVal;
                nextInputs[key] = String(defaultVal);
            } else {
                finalVal = parseInt(valStr, 10);
                nextInputs[key] = String(finalVal);
            }
            (nextConfig as any)[key] = finalVal;
        }

        // 回填到输入框界面显示
        setInputValues(nextInputs);
        // 同步给父组件配置
        onChange(nextConfig);

        if (onSave) {
            setIsSaving(true);
            try {
                await onSave();
                setIsSaved(true);
                setTimeout(() => setIsSaved(false), 2000);
            } finally {
                setIsSaving(false);
            }
        }
    };

    const getPresetTooltip = (val: number): string => {
        if (val === 32768) {
            return t("proxy.config.thinking_budget.tooltip_32768", {
                defaultValue: "32,768 Tokens: Ideal for complex coding and deep architecture design",
            });
        }
        if (val === 16384 || val === 16000) {
            return t("proxy.config.thinking_budget.tooltip_16384", {
                defaultValue: "16K tier (16,384 Tokens): Best for complex agentic workflows",
            });
        }
        if (val === 8192) {
            return t("proxy.config.thinking_budget.tooltip_8192", {
                defaultValue: "8,192 Tokens: Balanced for multi-step reasoning and debugging",
            });
        }
        if (val === 4096) {
            return t("proxy.config.thinking_budget.tooltip_4096", {
                defaultValue: "4,096 Tokens: Standard balance between reasoning quality and speed",
            });
        }
        if (val === 2048) {
            return t("proxy.config.thinking_budget.tooltip_2048", {
                defaultValue: "2,048 Tokens: Lightweight daily reasoning tier",
            });
        }
        if (val === 1024) {
            return t("proxy.config.thinking_budget.tooltip_1024", {
                defaultValue: "1,024 Tokens: Ultra-fast lightweight thinking with minimal token usage",
            });
        }
        if (val === 65536) {
            return t("proxy.config.thinking_budget.tooltip_65536", {
                defaultValue: "65,536 Tokens: Extreme maximum depth reasoning chain tier",
            });
        }
        if (val === 1001) {
            return t("proxy.config.thinking_budget.tooltip_1001", {
                defaultValue: "1,001 Tokens: Google official 3.1 Pro Low thinking baseline",
            });
        }
        if (val === 10001) {
            return t("proxy.config.thinking_budget.tooltip_10001", {
                defaultValue: "10,001 Tokens: Google official 3.1 Pro High deep reasoning primary tier",
            });
        }
        if (val === -1) {
            return t("proxy.config.thinking_budget.tooltip_adaptive", {
                defaultValue: "Adaptive (-1): Dynamic budget allocated automatically by upstream model",
            });
        }
        return `${val.toLocaleString()} Tokens`;
    };

    const renderPresetButtons = (
        field: BudgetFieldKey,
        presets: number[],
        color: "blue" | "purple" = "blue"
    ) => {
        const currentRaw = inputValues[field];
        const currentVal =
            currentRaw !== "" && currentRaw !== "-"
                ? parseInt(currentRaw, 10)
                : (currentConfig as any)[field];

        const activeBg =
            color === "purple"
                ? "bg-purple-600 hover:bg-purple-500"
                : "bg-blue-600 hover:bg-blue-500";
        const hoverText =
            color === "purple"
                ? "hover:text-purple-600 hover:border-purple-400 dark:hover:text-purple-300"
                : "hover:text-blue-600 hover:border-blue-400 dark:hover:text-blue-300";

        return (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {presets.map((val) => (
                    <button
                        key={val}
                        type="button"
                        title={getPresetTooltip(val)}
                        onClick={() => {
                            setInputValues((prev) => ({ ...prev, [field]: String(val) }));
                            onChange({ ...currentConfig, [field]: val });
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all cursor-pointer ${
                            currentVal === val
                                ? `${activeBg} text-white shadow-xs`
                                : `bg-gray-100 dark:bg-base-300/80 border border-gray-200 dark:border-base-300 text-gray-700 dark:text-gray-300 ${hoverText}`
                        }`}
                    >
                        {val === -1
                            ? t("proxy.config.thinking_budget.preset_adaptive", {
                                  defaultValue: "Adaptive (-1)",
                              })
                            : val.toLocaleString()}
                    </button>
                ))}
            </div>
        );
    };

    const controlSource = currentConfig.control_source || "gateway";

    return (
        <div className="space-y-4">
            {/* Header & Section Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 dark:border-base-200 pb-2.5">
                <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <svg
                            className="w-4 h-4 text-purple-500 dark:text-purple-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                            />
                        </svg>
                        {t("proxy.config.thinking_budget.title", {
                            defaultValue: "Thinking Budget Control",
                        })}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {t("proxy.config.thinking_budget.description", {
                            defaultValue:
                                "Normalize cross-protocol reasoning parameters and centrally manage thinking token budgets and adaptive behaviors for Gemini and Claude models.",
                        })}
                    </p>
                </div>
            </div>

            {/* 0. 服务端思考块回填 (Server-side Thought & Signature Restoration) */}
            {onThinkingStoreChange && (
                <div className="p-3.5 bg-purple-50/70 dark:bg-purple-900/20 border border-purple-200/80 dark:border-purple-800/40 rounded-xl flex items-center justify-between gap-4 shadow-2xs">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                                {t("proxy.config.thinking_budget.store_enabled", { defaultValue: "Server-side Thought & Signature Restoration" })}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                                {t("proxy.config.thinking_budget.default_on_tag", { defaultValue: "Default On" })}
                            </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 max-w-xl leading-relaxed">
                            {t("proxy.config.thinking_budget.store_enabled_desc", {
                                defaultValue: "Automatically captures and persists reasoning blocks and encrypted signatures. When client agents (e.g. Cline, Roo, Claude Code) omit thought content in multi-turn chats, the gateway restores them to prevent upstream 400 errors or context loss."
                            })}
                        </p>
                    </div>
                    <input
                        type="checkbox"
                        className="toggle toggle-sm toggle-primary shrink-0"
                        checked={thinkingStoreEnabled}
                        onChange={(e) => onThinkingStoreChange(e.target.checked)}
                    />
                </div>
            )}

            {/* 每轮对话的内存thinking与SQLite存储滑动窗口 */}
            {(onThinkingMaxMemoryTurnsChange || onThinkingRetentionDaysChange) && (
                <div className="p-3.5 bg-blue-50/70 dark:bg-blue-900/20 border border-blue-200/80 dark:border-blue-800/40 rounded-xl space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                <Layers size={14} className="text-blue-600 dark:text-blue-400" />
                                {t("proxy.config.thinking_budget.window_settings_title", {
                                    defaultValue: "Dual-Layer Thinking Sliding Window & Storage Limits (RAM + SQLite)",
                                })}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                                {t("proxy.config.thinking_budget.dual_layer_tag", {
                                    defaultValue: "Dual-layer Index",
                                })}
                            </span>
                        </div>

                        {/* 清空思考块按钮与小字提示 */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 hidden sm:inline-block">
                                {t("proxy.config.thinking_budget.clear_tip", {
                                    defaultValue: "Only delete when cache hit anomalies occur, version updates, or requested by developers",
                                })}
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowClearThinkingConfirm(true)}
                                disabled={isClearingThinking}
                                title={t("proxy.config.thinking_budget.clear_btn_tooltip", {
                                    defaultValue: "Clear all thinking block caches and database (logs are preserved)",
                                })}
                                className="btn btn-xs btn-outline btn-error gap-1.5 h-6 min-h-6 px-2.5 text-[11px] font-medium rounded-lg shadow-2xs hover:shadow-xs transition-all"
                            >
                                <Trash2 size={12} className={isClearingThinking ? "animate-spin" : ""} />
                                {t("proxy.config.thinking_budget.clear_btn", {
                                    defaultValue: "Clear Thinking Store",
                                })}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* 1. 内存常驻思考轮次 (L1 RAM) */}
                        {onThinkingMaxMemoryTurnsChange && (
                            <div className="p-3 bg-white/90 dark:bg-base-100 rounded-lg border border-blue-200/70 dark:border-base-200 shadow-2xs flex items-center justify-between gap-3">
                                <div className="space-y-0.5 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <Layers size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                                            {t("proxy.config.thinking_budget.max_memory_turns_label", {
                                                defaultValue: "Max Memory Thinking Turns per Session",
                                            })}
                                        </span>
                                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shrink-0">
                                            {t("proxy.config.thinking_budget.default_600_tag", {
                                                defaultValue: "Default: 600",
                                            })}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
                                        {t("proxy.config.thinking_budget.max_memory_turns_subdesc", {
                                            defaultValue: "~2 KB per turn; 600 turns ≈ 1.2 MB / session.",
                                        })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <input
                                        type="number"
                                        min={10}
                                        max={10000}
                                        step={50}
                                        className="input input-xs input-bordered w-20 text-center font-mono font-bold bg-gray-50 dark:bg-base-200 text-gray-900 dark:text-white"
                                        value={memoryTurnsInput}
                                        onChange={(e) => {
                                            setMemoryTurnsInput(e.target.value);
                                        }}
                                        onBlur={() => {
                                            const val = parseInt(memoryTurnsInput, 10);
                                            if (isNaN(val)) {
                                                setMemoryTurnsInput(String(thinkingMaxMemoryTurns));
                                            } else {
                                                const clamped = Math.max(10, Math.min(10000, val));
                                                setMemoryTurnsInput(String(clamped));
                                                onThinkingMaxMemoryTurnsChange(clamped);
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                (e.target as HTMLInputElement).blur();
                                            }
                                        }}
                                    />
                                    <span className="text-xs font-medium text-gray-500">
                                        {t("proxy.config.thinking_budget.turns_unit", { defaultValue: "turns" })}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* 2. SQLite 思考库保留周期 (L2 Disk) */}
                        {onThinkingRetentionDaysChange && (
                            <div className="p-3 bg-white/90 dark:bg-base-100 rounded-lg border border-purple-200/70 dark:border-base-200 shadow-2xs flex items-center justify-between gap-3">
                                <div className="space-y-0.5 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <HardDrive size={13} className="text-purple-600 dark:text-purple-400 shrink-0" />
                                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                                            {t("proxy.config.experimental.thinking_retention_days_label", {
                                                defaultValue: "Thinking-store retention (sliding window, days)",
                                            })}
                                        </span>
                                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 shrink-0">
                                            {t("proxy.config.thinking_budget.default_15_days_tag", {
                                                defaultValue: "Default: 15 days",
                                            })}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
                                        {t("proxy.config.thinking_budget.retention_days_subdesc", {
                                            defaultValue: "Active sessions auto-extend on each request; expires only when idle.",
                                        })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <input
                                        type="number"
                                        min={1}
                                        max={365}
                                        className="input input-xs input-bordered w-20 text-center font-mono font-bold bg-gray-50 dark:bg-base-200 text-gray-900 dark:text-white"
                                        value={retentionDaysInput}
                                        onChange={(e) => {
                                            setRetentionDaysInput(e.target.value);
                                        }}
                                        onBlur={() => {
                                            const val = parseInt(retentionDaysInput, 10);
                                            if (isNaN(val)) {
                                                setRetentionDaysInput(String(thinkingRetentionDays));
                                            } else {
                                                const clamped = Math.max(1, Math.min(365, val));
                                                setRetentionDaysInput(String(clamped));
                                                onThinkingRetentionDaysChange(clamped);
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                (e.target as HTMLInputElement).blur();
                                            }
                                        }}
                                    />
                                    <span className="text-xs font-medium text-gray-500">
                                        {t("proxy.config.thinking_budget.days_unit", { defaultValue: "days" })}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 滑动窗口机制与服务器内存配置建议指南 */}
                    <div className="p-3 rounded-lg bg-white/80 dark:bg-base-200/80 border border-blue-100 dark:border-blue-900/40 text-xs space-y-2 text-gray-600 dark:text-gray-300">
                        <div className="flex items-start gap-1.5 font-semibold text-blue-950 dark:text-blue-200">
                            <HelpCircle size={14} className="text-blue-500 shrink-0 mt-0.5" />
                            <span>
                                {t("proxy.config.thinking_budget.window_guide_title", {
                                    defaultValue: "FIFO Sliding Window Eviction & Concurrency Sizing Guide",
                                })}
                                :
                            </span>
                        </div>
                        <p className="leading-relaxed pl-5 text-[11px] text-gray-500 dark:text-gray-400">
                            {t("proxy.config.thinking_budget.window_guide_desc", {
                                defaultValue:
                                    "When session length exceeds this limit, FIFO sliding window automatically evicts oldest thinking blocks from memory. Evicted blocks are rehydrated in nanoseconds via indexed SQLite (primary_tool_id), maintaining strict byte-level Prompt Cache alignment without OOM.",
                            })}
                        </p>
                        <div className="pl-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px] pt-1">
                            {CONCURRENCY_GUIDE_PRESETS.map((preset) => (
                                <div
                                    key={preset.key}
                                    className="p-2 rounded bg-blue-50/40 dark:bg-base-300/40 border border-blue-100/60 dark:border-base-300"
                                >
                                    <span className="font-bold text-gray-800 dark:text-gray-200 block">
                                        {preset.icon} {t(preset.titleKey, { defaultValue: preset.titleDefault })}
                                    </span>
                                    <span className="text-gray-500 dark:text-gray-400">
                                        <Trans
                                            i18nKey={preset.descKey}
                                            defaults={preset.descDefault}
                                            components={{ 1: <strong className="text-blue-600 dark:text-blue-400" /> }}
                                        />
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 顶级大选择：控制权归属 */}
            <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {t("proxy.config.thinking_budget.control_source_label", {
                        defaultValue: "Authority Source",
                    })}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 网关权威控制 */}
                    <button
                        type="button"
                        onClick={() => handleControlSourceChange("gateway")}
                        className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                            controlSource === "gateway"
                                ? "border-blue-500 bg-blue-50/70 dark:bg-blue-900/20 text-gray-900 dark:text-white shadow-xs ring-1 ring-blue-500/40"
                                : "border-gray-200 dark:border-base-300 bg-white dark:bg-base-200 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-base-300"
                        }`}
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold flex items-center gap-1.5 text-gray-900 dark:text-white">
                                <span
                                    className={`w-2.5 h-2.5 rounded-full ${
                                        controlSource === "gateway"
                                            ? "bg-blue-500"
                                            : "bg-gray-300 dark:bg-base-300"
                                    }`}
                                />
                                {t("proxy.config.thinking_budget.source_gateway", {
                                    defaultValue: "Gateway Authoritative Control",
                                })}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                {t("proxy.config.thinking_budget.recommended_tag", {
                                    defaultValue: "Preferred / Recommended",
                                })}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                            {t("proxy.config.thinking_budget.source_gateway_desc", {
                                defaultValue:
                                    "The gateway centrally regulates thinking budgets and heuristic tiers, eliminating client inconsistencies and preventing upstream 400 errors caused by invalid limits.",
                            })}
                        </p>
                    </button>

                    {/* 客户端直接控制 */}
                    <button
                        type="button"
                        onClick={() => handleControlSourceChange("client")}
                        className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                            controlSource === "client"
                                ? "border-amber-500 bg-amber-50/70 dark:bg-amber-900/20 text-gray-900 dark:text-white shadow-xs ring-1 ring-amber-500/40"
                                : "border-gray-200 dark:border-base-300 bg-white dark:bg-base-200 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-base-300"
                        }`}
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold flex items-center gap-1.5 text-gray-900 dark:text-white">
                                <span
                                    className={`w-2.5 h-2.5 rounded-full ${
                                        controlSource === "client"
                                            ? "bg-amber-500"
                                            : "bg-gray-300 dark:bg-base-300"
                                    }`}
                                />
                                {t("proxy.config.thinking_budget.source_client", {
                                    defaultValue: "Client Direct Control",
                                })}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                                {t("proxy.config.thinking_budget.danger_tag", {
                                    defaultValue: "Dangerous / Not Recommended",
                                })}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                            {t("proxy.config.thinking_budget.source_client_desc", {
                                defaultValue:
                                    "Extracts client-provided thinking parameters after normalization and forwards them directly. If omitted, upstream dynamic adaptive reasoning is used. Inappropriate values may trigger Google API errors.",
                            })}
                        </p>
                    </button>
                </div>
            </div>

            {/* 客户端控制警示框 */}
            {controlSource === "client" && (
                <div className="p-3.5 bg-rose-50/80 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
                    <svg
                        className="w-4 h-4 text-rose-500 shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                    <div className="space-y-1 text-[11px] leading-relaxed">
                        <span className="font-semibold">
                            {t("proxy.config.thinking_budget.client_warning_title", {
                                defaultValue: "Warning: Switched to Client Direct Control",
                            })}
                        </span>
                        <p>
                            {t("proxy.config.thinking_budget.client_warning_desc", {
                                defaultValue:
                                    "Different clients (Cline, Roo, Cherry, etc.) submit varying thinking.budget_tokens or effort values. If a client specifies limits exceeding Google API constraints (e.g. Flash > 24576 or non-standard Pro budgets), Google will return 400 Bad Request.",
                            })}
                        </p>
                    </div>
                </div>
            )}

            {/* 网关权威控制下的三大模型分类配置 */}
            {controlSource === "gateway" && (
                <div className="space-y-4 pt-1">
                    {/* 1. Gemini Flash 系列 */}
                    <div className="border border-gray-200 dark:border-base-200 rounded-xl p-4 bg-white dark:bg-base-100 space-y-3.5 shadow-2xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-base-200 pb-2.5">
                            <div>
                                <span className="text-xs font-bold text-gray-900 dark:text-white">
                                    {t("proxy.config.thinking_budget.flash_family_title", {
                                        defaultValue: "Gemini Flash Series (3-flash, 3.7-flash, tiered, etc.)",
                                    })}
                                </span>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {t("proxy.config.thinking_budget.flash_family_desc", {
                                        defaultValue: "Manage four tier budgets for Flash reasoning models (enter -1 for official adaptive)",
                                    })}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
                                    <input
                                        type="radio"
                                        name="flash_mode"
                                        checked={currentConfig.flash_mode === "default"}
                                        onChange={() => handleFlashModeChange("default")}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    {t("proxy.config.thinking_budget.mode_default", {
                                        defaultValue: "Default Mode (Upstream Adaptive)",
                                    })}
                                </label>
                                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
                                    <input
                                        type="radio"
                                        name="flash_mode"
                                        checked={currentConfig.flash_mode !== "default"}
                                        onChange={() => handleFlashModeChange("custom")}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    {t("proxy.config.thinking_budget.mode_custom", {
                                        defaultValue: "Custom Budget Mode (Recommended)",
                                    })}
                                </label>
                            </div>
                        </div>

                        {currentConfig.flash_mode !== "default" ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                            {t("proxy.config.thinking_budget.tier_low", {
                                                defaultValue: "Low Tier",
                                            })}
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="1024"
                                            value={inputValues.flash_low ?? ""}
                                            onChange={(e) =>
                                                handleInputChange("flash_low", e.target.value)
                                            }
                                            className="w-full px-3 py-1.5 border border-gray-300 dark:border-base-300 rounded-lg bg-white dark:bg-base-200 text-xs font-mono font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                        />
                                        {renderPresetButtons("flash_low", [1024, 2048])}
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                            {t("proxy.config.thinking_budget.flash_low_hint", {
                                                defaultValue: "Light reasoning (Default 1024)",
                                            })}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                            {t("proxy.config.thinking_budget.tier_medium", {
                                                defaultValue: "Medium Tier",
                                            })}
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="4096"
                                            value={inputValues.flash_medium ?? ""}
                                            onChange={(e) =>
                                                handleInputChange("flash_medium", e.target.value)
                                            }
                                            className="w-full px-3 py-1.5 border border-gray-300 dark:border-base-300 rounded-lg bg-white dark:bg-base-200 text-xs font-mono font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                        />
                                        {renderPresetButtons("flash_medium", [4096, 8192])}
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                            {t("proxy.config.thinking_budget.flash_medium_hint", {
                                                defaultValue: "Balanced tier (Default 4096)",
                                            })}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                            {t("proxy.config.thinking_budget.tier_high", {
                                                defaultValue: "High Tier",
                                            })}
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="-1"
                                            value={inputValues.flash_high ?? ""}
                                            onChange={(e) =>
                                                handleInputChange("flash_high", e.target.value)
                                            }
                                            className="w-full px-3 py-1.5 border border-gray-300 dark:border-base-300 rounded-lg bg-white dark:bg-base-200 text-xs font-mono font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                        />
                                        {renderPresetButtons("flash_high", [-1, 16384, 32768])}
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                            {t("proxy.config.thinking_budget.flash_high_hint", {
                                                defaultValue: "Deep reasoning (Default 16384)",
                                            })}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                            {t("proxy.config.thinking_budget.tier_tiered", {
                                                defaultValue: "Tiered (Freeform Model)",
                                            })}
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="-1"
                                            value={inputValues.flash_tiered ?? ""}
                                            onChange={(e) =>
                                                handleInputChange("flash_tiered", e.target.value)
                                            }
                                            className="w-full px-3 py-1.5 border border-gray-300 dark:border-base-300 rounded-lg bg-white dark:bg-base-200 text-xs font-mono font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                        />
                                        {renderPresetButtons("flash_tiered", [-1, 2048, 8192, 32768])}
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                            {t("proxy.config.thinking_budget.flash_tiered_hint", {
                                                defaultValue: "Adaptive / Freeform (Default -1)",
                                            })}
                                        </p>
                                    </div>
                                </div>
                                <div className="p-3 bg-blue-50/70 dark:bg-blue-900/20 border border-blue-200/80 dark:border-blue-800/40 rounded-xl text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                                    {t("proxy.config.thinking_budget.tiered_desc", {
                                        defaultValue:
                                            "💡 Tiered Model Note: Designed for Google's dynamic adaptation. When set to -1, the model allocates reasoning dynamically based on task difficulty; setting 30000+ unlocks Max reasoning beyond High.",
                                    })}
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                                {t("proxy.config.thinking_budget.flash_default_hint", {
                                    defaultValue:
                                        "Official default mode enabled: passes model ID directly without injecting thinkingBudget.",
                                })}
                            </p>
                        )}
                    </div>

                    {/* 2. Gemini Pro 系列 */}
                    <div className="border border-gray-200 dark:border-base-200 rounded-xl p-4 bg-white dark:bg-base-100 space-y-3.5 shadow-2xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-base-200 pb-2.5">
                            <div>
                                <span className="text-xs font-bold text-gray-900 dark:text-white">
                                    {t("proxy.config.thinking_budget.pro_family_title", {
                                        defaultValue: "Gemini Pro Series (3-pro, 3.1-pro, etc.)",
                                    })}
                                </span>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {t("proxy.config.thinking_budget.pro_family_desc", {
                                        defaultValue:
                                            "Google's Gemini 3.1 Pro architecture officially provides only Low and High tiers. Unspecified effort or medium automatically routes to High for deep reasoning.",
                                    })}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
                                    <input
                                        type="radio"
                                        name="pro_mode"
                                        checked={currentConfig.pro_mode === "default"}
                                        onChange={() => handleProModeChange("default")}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    {t("proxy.config.thinking_budget.mode_default", {
                                        defaultValue: "Default Mode (Upstream Adaptive)",
                                    })}
                                </label>
                                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
                                    <input
                                        type="radio"
                                        name="pro_mode"
                                        checked={currentConfig.pro_mode !== "default"}
                                        onChange={() => handleProModeChange("custom")}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    {t("proxy.config.thinking_budget.mode_custom", {
                                        defaultValue: "Custom Budget Mode (Recommended)",
                                    })}
                                </label>
                            </div>
                        </div>

                        {currentConfig.pro_mode !== "default" ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        {t("proxy.config.thinking_budget.tier_low", {
                                            defaultValue: "Low Tier",
                                        })}
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="1001"
                                        value={inputValues.pro_low ?? ""}
                                        onChange={(e) =>
                                            handleInputChange("pro_low", e.target.value)
                                        }
                                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-base-300 rounded-lg bg-white dark:bg-base-200 text-xs font-mono font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                    />
                                    {renderPresetButtons("pro_low", [1001, 1024, 2048, 4096])}
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                        {t("proxy.config.thinking_budget.pro_low_hint", {
                                            defaultValue: "Low reasoning tier (Default 1001, -1 for adaptive)",
                                        })}
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        {t("proxy.config.thinking_budget.tier_pro_high", {
                                            defaultValue: "High Tier (Default / Flagship)",
                                        })}
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="10001"
                                        value={inputValues.pro_high ?? ""}
                                        onChange={(e) =>
                                            handleInputChange("pro_high", e.target.value)
                                        }
                                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-base-300 rounded-lg bg-white dark:bg-base-200 text-xs font-mono font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                    />
                                    {renderPresetButtons("pro_high", [10001, 16384, 32768])}
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                        {t("proxy.config.thinking_budget.pro_high_hint", {
                                            defaultValue: "Deep reasoning tier (Default 10001, -1 for adaptive)",
                                        })}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                                {t("proxy.config.thinking_budget.pro_default_hint", {
                                    defaultValue:
                                        "Official default mode enabled: Gemini Pro reasoning is determined dynamically by Google.",
                                })}
                            </p>
                        )}
                    </div>

                    {/* 3. Claude 系列 */}
                    <div className="border border-gray-200 dark:border-base-200 rounded-xl p-4 bg-white dark:bg-base-100 space-y-3.5 shadow-2xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-base-200 pb-2.5">
                            <div>
                                <span className="text-xs font-bold text-gray-900 dark:text-white">
                                    {t("proxy.config.thinking_budget.claude_family_title", {
                                        defaultValue: "Claude Series Thinking Models (claude-3-7-sonnet-thinking, etc.)",
                                    })}
                                </span>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {t("proxy.config.thinking_budget.claude_family_desc", {
                                        defaultValue:
                                            "Manage Claude thinking model token budgets (official models only differentiate between -thinking and standard models; this applies specifically to thinking models)",
                                    })}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
                                    <input
                                        type="radio"
                                        name="claude_mode"
                                        checked={currentConfig.claude_mode === "default"}
                                        onChange={() => handleClaudeModeChange("default")}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    {t("proxy.config.thinking_budget.mode_default", {
                                        defaultValue: "Default Mode (Upstream Adaptive)",
                                    })}
                                </label>
                                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
                                    <input
                                        type="radio"
                                        name="claude_mode"
                                        checked={currentConfig.claude_mode !== "default"}
                                        onChange={() => handleClaudeModeChange("custom")}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    {t("proxy.config.thinking_budget.mode_custom", {
                                        defaultValue: "Custom Budget Mode (Recommended)",
                                    })}
                                </label>
                            </div>
                        </div>

                        {currentConfig.claude_mode !== "default" ? (
                            <div className="space-y-3.5">
                                {/* 核心统一预算输入 */}
                                <div className="p-3.5 bg-purple-50/70 dark:bg-purple-900/20 border border-purple-200/80 dark:border-purple-800/40 rounded-xl space-y-2.5 shadow-2xs">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-900 dark:text-white">
                                                {t("proxy.config.thinking_budget.claude_budget_title", {
                                                    defaultValue: "Claude Thinking Model Budget (Tokens)",
                                                })}
                                            </label>
                                            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                                                {t("proxy.config.thinking_budget.claude_budget_desc", {
                                                    defaultValue: "Core token budget when client calls thinking models like claude-3-7-sonnet-thinking (-1 for upstream default)",
                                                })}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {[1024, 2048, 4096, 8192, 16384, 32768, 65536, -1].map((val) => {
                                                const currentBudgetNum = inputValues.claude_budget !== "" && inputValues.claude_budget !== "-"
                                                    ? parseInt(inputValues.claude_budget, 10)
                                                    : currentConfig.claude_budget;
                                                return (
                                                    <button
                                                        key={val}
                                                        type="button"
                                                        title={getPresetTooltip(val)}
                                                        onClick={() => {
                                                            setInputValues((prev) => ({ ...prev, claude_budget: String(val) }));
                                                            onChange({ ...currentConfig, claude_budget: val });
                                                        }}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                                                            currentBudgetNum === val
                                                                ? "bg-purple-600 hover:bg-purple-500 text-white shadow-xs"
                                                                : "bg-white dark:bg-base-200 border border-gray-300 dark:border-base-300 text-gray-700 dark:text-gray-200 hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-300"
                                                        }`}
                                                    >
                                                        {val === -1 ? t("proxy.config.thinking_budget.preset_adaptive", { defaultValue: "Adaptive (-1)" }) : `${val.toLocaleString()}`}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="16384"
                                            value={inputValues.claude_budget ?? ""}
                                            onChange={(e) =>
                                                handleInputChange("claude_budget", e.target.value)
                                            }
                                            className="w-48 px-3 py-1.5 border border-purple-300 dark:border-purple-800/80 rounded-lg bg-white dark:bg-base-200 text-xs font-mono font-bold text-purple-700 dark:text-purple-300 focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 shadow-2xs"
                                        />
                                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                            {t("proxy.config.thinking_budget.claude_budget_current", {
                                                defaultValue: "Recommended default: 16,384 Tokens (balanced depth and latency)",
                                            })}
                                        </span>
                                    </div>
                                </div>

                                {/* 高级：客户端 Effort 档位映射 */}
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => setShowClaudeAdvanced((prev) => !prev)}
                                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer select-none"
                                    >
                                        <ChevronDown size={14} className={`transition-transform duration-200 ${showClaudeAdvanced ? "" : "-rotate-90"}`} />
                                        <span>
                                            {showClaudeAdvanced
                                                ? t("proxy.config.thinking_budget.claude_hide_advanced", { defaultValue: "Collapse Client Effort Mapping" })
                                                : t("proxy.config.thinking_budget.claude_show_advanced", { defaultValue: "Advanced: Client Effort Tier Mapping (low / medium / high)" })}
                                        </span>
                                    </button>

                                    {showClaudeAdvanced && (
                                        <div className="mt-2.5 p-3.5 bg-gray-50 dark:bg-base-200 border border-gray-200 dark:border-base-300 rounded-xl space-y-2.5 shadow-2xs">
                                            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                                {t("proxy.config.thinking_budget.claude_effort_mapping_desc", {
                                                    defaultValue: "When commercial agents (Cline, Roo, etc.) send reasoning_effort in parameters or headers, budgets are mapped as follows:",
                                                })}
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                                                        {t("proxy.config.thinking_budget.tier_low", { defaultValue: "Low Tier" })}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        placeholder="1024"
                                                        value={inputValues.claude_low ?? ""}
                                                        onChange={(e) => handleInputChange("claude_low", e.target.value)}
                                                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-base-300 rounded-lg bg-white dark:bg-base-200 text-xs font-mono font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                                                    />
                                                    {renderPresetButtons("claude_low", [1024, 2048], "purple")}
                                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                                        {t("proxy.config.thinking_budget.claude_low_hint", { defaultValue: "Light thinking (Default 1024)" })}
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                                                        {t("proxy.config.thinking_budget.tier_medium", { defaultValue: "Medium Tier" })}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        placeholder="4096"
                                                        value={inputValues.claude_medium ?? ""}
                                                        onChange={(e) => handleInputChange("claude_medium", e.target.value)}
                                                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-base-300 rounded-lg bg-white dark:bg-base-200 text-xs font-mono font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                                                    />
                                                    {renderPresetButtons("claude_medium", [4096, 8192], "purple")}
                                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                                        {t("proxy.config.thinking_budget.claude_medium_hint", { defaultValue: "Everyday balanced (Default 4096)" })}
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                                                        {t("proxy.config.thinking_budget.tier_high", { defaultValue: "High Tier" })}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        placeholder="16384"
                                                        value={inputValues.claude_high ?? ""}
                                                        onChange={(e) => handleInputChange("claude_high", e.target.value)}
                                                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-base-300 rounded-lg bg-white dark:bg-base-200 text-xs font-mono font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                                                    />
                                                    {renderPresetButtons("claude_high", [16384, 32768], "purple")}
                                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                                        {t("proxy.config.thinking_budget.claude_high_hint", { defaultValue: "Deep reasoning (Default 16384)" })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 全宽背景说明条 */}
                                <div className="w-full p-3 bg-purple-50/70 dark:bg-purple-900/20 border border-purple-200/80 dark:border-purple-800/40 rounded-xl text-xs text-purple-800 dark:text-purple-200 leading-relaxed">
                                    {t("proxy.config.thinking_budget.claude_thinking_note", {
                                        defaultValue:
                                            "💡 Claude Model Note: Anthropic official models only differentiate between `-thinking` (e.g. claude-3-7-sonnet-thinking) and standard models. This custom budget specifically manages quotas for thinking models; calling standard models will not trigger upstream reasoning.",
                                    })}
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                                {t("proxy.config.thinking_budget.claude_default_hint", {
                                    defaultValue:
                                        "Official default mode enabled: adheres to standard Anthropic specifications without custom limits.",
                                })}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* 底部专属保存操作栏 */}
            {onSave && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3.5 border-t border-gray-200 dark:border-base-200">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {t("proxy.config.thinking_budget.save_hint", {
                            defaultValue: "Changes take effect immediately upon saving and are hot-reloaded into the running proxy service.",
                        })}
                    </span>
                    <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleSave}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 shrink-0 cursor-pointer ${
                            isSaved
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                : "bg-blue-600 hover:bg-blue-500 text-white"
                        } ${isSaving ? "opacity-75 cursor-wait" : ""}`}
                    >
                        {isSaved ? (
                            <>
                                <Check size={14} className="text-white" />
                                <span>{t("common.saved", { defaultValue: "Saved successfully" })}</span>
                            </>
                        ) : (
                            <>
                                <Save size={14} className={isSaving ? "animate-spin" : ""} />
                                <span>{isSaving ? t("common.saving", { defaultValue: "Saving..." }) : t("proxy.config.thinking_budget.save_btn", { defaultValue: "Save & Hot Reload Thinking Config" })}</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* 清空思考块二次确认弹窗 */}
            {showClearThinkingConfirm && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-md bg-white dark:bg-base-100 border border-base-300 shadow-2xl p-5">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-full bg-error/10 text-error shrink-0 mt-0.5">
                                <AlertTriangle size={20} />
                            </div>
                            <div className="space-y-2 min-w-0">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                    {t("proxy.config.thinking_budget.clear_modal_title", {
                                        defaultValue: "Clear Thinking Block Store?",
                                    })}
                                </h3>
                                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                                    {t("proxy.config.thinking_budget.clear_modal_desc", {
                                        defaultValue:
                                            "This operation will completely clear all resident memory turns (RAM) and local SQLite database thinking chains and tool signatures.\n\n⚠️ Note: This only clears thinking data and will NOT delete any proxy request logs.",
                                    })}
                                </p>
                                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                                    {t("proxy.config.thinking_budget.clear_modal_warning", {
                                        defaultValue:
                                            "Recommended only when cache hit anomalies occur, after version updates, or when requested by developers. New requests will rebuild clean prefix indexes.",
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="modal-action mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                className="btn btn-sm btn-ghost"
                                onClick={() => setShowClearThinkingConfirm(false)}
                                disabled={isClearingThinking}
                            >
                                {t("common.cancel", { defaultValue: "Cancel" })}
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-error text-white gap-1.5"
                                onClick={handleClearThinkingStore}
                                disabled={isClearingThinking}
                            >
                                {isClearingThinking ? (
                                    <span className="loading loading-spinner loading-xs" />
                                ) : (
                                    <Trash2 size={13} />
                                )}
                                {t("proxy.config.thinking_budget.clear_confirm_btn", {
                                    defaultValue: "Confirm Clear",
                                })}
                            </button>
                        </div>
                    </div>
                    <div
                        className="modal-backdrop bg-black/40"
                        onClick={() => !isClearingThinking && setShowClearThinkingConfirm(false)}
                    />
                </div>
            )}
        </div>
    );
}
