import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    FlaskConical,
    Terminal,
    Bot,
    Cpu,
    Layout,
    Swords,
    Boxes,
    Code2,
    CheckCheck,
    XCircle,
    RefreshCw,
    ArrowRightLeft,
    Share2,
    Trophy,
    Globe,
    ShieldCheck,
    GitFork,
    Radio,
    Mic,
    KeyRound,
    Sparkles,
    Image,
    Layers,
    Search,
    History,
    Network,
    FileCode,
    RotateCcw,
    Clock,
    LucideIcon
} from 'lucide-react';
import { AntigravityLabConfig } from '../../types/config';
import { request } from '../../utils/request';
import { showToast } from '../common/ToastContainer';

interface AntigravityLabSettingsProps {
    config?: AntigravityLabConfig;
    onChange: (config: AntigravityLabConfig) => void;
    antigravityArgs?: string[];
    onArgsChange?: (args: string[]) => void;
}


export interface LabExperimentItem {
    key: keyof AntigravityLabConfig;
    cliKey: string;
    cliFlag: string;
    badge: string;
    badgeZh?: string;
    badgeEn?: string;
    titleKey: string;
    descKey: string;
    defaultTitle: string;
    defaultDesc: string;
    icon: LucideIcon;
    colorClasses: string;
}

export const FEATURE_KEYS: LabExperimentItem[] = [
    {
        key: 'enable_owl_slash_command',
        cliKey: 'enable-owl-slash-command',
        cliFlag: '--enable-owl-slash-command',
        badge: 'Explorer',
        badgeZh: '指令探索',
        badgeEn: 'Explorer',
        titleKey: 'settings.lab.owl_slash_command_title',
        descKey: 'settings.lab.owl_slash_command_desc',
        defaultTitle: 'Owl Slash Command',
        defaultDesc: 'Enables the /owl slash command for agentic codebase exploration and deep autonomous synthesis.',
        icon: Terminal,
        colorClasses: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    },
    {
        key: 'jetski_autonomous_mode',
        cliKey: 'jetski-autonomous-mode',
        cliFlag: '--jetski-autonomous-mode',
        badge: 'Autonomous',
        badgeZh: '自主模式',
        badgeEn: 'Autonomous',
        titleKey: 'settings.lab.jetski_autonomous_mode_title',
        descKey: 'settings.lab.jetski_autonomous_mode_desc',
        defaultTitle: 'Jetski Autonomous Mode',
        defaultDesc: 'Unlocks non-interactive, multi-turn autonomous execution for complex engineering workflows without manual interruption.',
        icon: Bot,
        colorClasses: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    {
        key: 'disable_teamwork_forced_flash_model',
        cliKey: 'disable-teamwork-forced-flash-model',
        cliFlag: '--disable-teamwork-forced-flash-model',
        badge: 'Teamwork',
        badgeZh: '协作模型',
        badgeEn: 'Teamwork',
        titleKey: 'settings.lab.disable_teamwork_forced_flash_model_title',
        descKey: 'settings.lab.disable_teamwork_forced_flash_model_desc',
        defaultTitle: 'Disable Teamwork Forced Flash Model',
        defaultDesc: 'Allows subagents in Teamwork mode to inherit parent model capabilities (e.g., Pro/Ultra) instead of being locked to Flash.',
        icon: Cpu,
        colorClasses: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    },
    {
        key: 'jetski_generative_ui',
        cliKey: 'jetski-generative-ui',
        cliFlag: '--jetski-generative-ui',
        badge: 'Generative UI',
        badgeZh: '动态界面',
        badgeEn: 'Generative UI',
        titleKey: 'settings.lab.jetski_generative_ui_title',
        descKey: 'settings.lab.jetski_generative_ui_desc',
        defaultTitle: 'Jetski Generative UI',
        defaultDesc: 'Renders interactive dynamic UI widgets, charts, and visualizations directly within agent conversation turns.',
        icon: Layout,
        colorClasses: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    },
    {
        key: 'enable_battle_mode',
        cliKey: 'enable-battle-mode',
        cliFlag: '--enable-battle-mode',
        badge: 'Arena',
        badgeZh: '竞技对决',
        badgeEn: 'Arena',
        titleKey: 'settings.lab.battle_mode_title',
        descKey: 'settings.lab.battle_mode_desc',
        defaultTitle: 'Battle Mode (Multi-Agent Arena)',
        defaultDesc: 'Runs competing models side-by-side on the same prompt to benchmark quality, reasoning depth, and latency in real time.',
        icon: Swords,
        colorClasses: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
    },
    {
        key: 'enable_subagent_hub',
        cliKey: 'enable-subagent-hub',
        cliFlag: '--enable-subagent-hub',
        badge: 'Subagents',
        badgeZh: '智能体中心',
        badgeEn: 'Subagents',
        titleKey: 'settings.lab.subagent_hub_title',
        descKey: 'settings.lab.subagent_hub_desc',
        defaultTitle: 'Subagent Hub',
        defaultDesc: 'Provides a centralized dashboard for tracking, debugging, and managing distributed subagent lifecycles and transcripts.',
        icon: Boxes,
        colorClasses: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
    },
    {
        key: 'enable_programmatic_tools',
        cliKey: 'enable-programmatic-tools',
        cliFlag: '--enable-programmatic-tools',
        badge: 'Tools',
        badgeZh: '编程式工具',
        badgeEn: 'Tools',
        titleKey: 'settings.lab.programmatic_tools_title',
        descKey: 'settings.lab.programmatic_tools_desc',
        defaultTitle: 'Programmatic Tools Execution',
        defaultDesc: 'Enables direct code-based tool execution pipelines for high-throughput data processing and headless tool chaining.',
        icon: Code2,
        colorClasses: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    },
    {
        key: 'enable_battle_mode_custom_agents',
        cliKey: 'enable-battle-mode-custom-agents',
        cliFlag: '--enable-battle-mode-custom-agents',
        badge: 'Arena',
        badgeZh: '竞技场',
        badgeEn: 'Arena',
        titleKey: 'settings.lab.enable_battle_mode_custom_agents_title',
        descKey: 'settings.lab.enable_battle_mode_custom_agents_desc',
        defaultTitle: 'Battle Mode Custom Agents (Arena)',
        defaultDesc: 'Enables pitting user-defined custom agent personas (custom YAML or prompts) against each other in the Colosseum arena.',
        icon: Trophy,
        colorClasses: 'text-amber-600 bg-amber-600/10 border-amber-600/30',
    },
    {
        key: 'enable_persistent_terminals',
        cliKey: 'enable-persistent-terminals',
        cliFlag: '--enable-persistent-terminals',
        badge: 'Terminal',
        badgeZh: '终端核心',
        badgeEn: 'Terminal',
        titleKey: 'settings.lab.enable_persistent_terminals_title',
        descKey: 'settings.lab.enable_persistent_terminals_desc',
        defaultTitle: 'Persistent Terminals & Sandbox',
        defaultDesc: 'Replaces one-off subshell processes with long-lived ConPTY pseudo-terminals that persist environment variables, background daemons, and state across conversation turns.',
        icon: Terminal,
        colorClasses: 'text-lime-600 bg-lime-600/10 border-lime-600/30',
    },
    {
        key: 'enable_browser_subagent_v2',
        cliKey: 'enable-browser-subagent-v2',
        cliFlag: '--enable-browser-subagent-v2',
        badge: 'Browser',
        badgeZh: '自动化',
        badgeEn: 'Browser',
        titleKey: 'settings.lab.enable_browser_subagent_v2_title',
        descKey: 'settings.lab.enable_browser_subagent_v2_desc',
        defaultTitle: 'Browser Subagent v2 (CDP Automation)',
        defaultDesc: 'Activates next-generation headless browser automation connecting directly via Chrome DevTools Protocol (CDP) for full DOM/network tracing instead of static page scraping.',
        icon: Globe,
        colorClasses: 'text-sky-500 bg-sky-500/10 border-sky-500/30',
    },
    {
        key: 'enable_command_antivirus',
        cliKey: 'enable-command-antivirus',
        cliFlag: '--enable-command-antivirus',
        badge: 'Security',
        badgeZh: '安全防毒',
        badgeEn: 'Security',
        titleKey: 'settings.lab.enable_command_antivirus_title',
        descKey: 'settings.lab.enable_command_antivirus_desc',
        defaultTitle: 'Command Execution Antivirus & Sandbox',
        defaultDesc: 'Interceptors and heuristically evaluates proposed shell commands against known destructive patterns (e.g. recursive wipes or sandbox escapes) before execution.',
        icon: ShieldCheck,
        colorClasses: 'text-red-500 bg-red-500/10 border-red-500/30',
    },
    {
        key: 'enable_fork_with_subagents',
        cliKey: 'enable-fork-with-subagents',
        cliFlag: '--enable-fork-with-subagents',
        badge: 'Branching',
        badgeZh: '分叉分支',
        badgeEn: 'Branching',
        titleKey: 'settings.lab.enable_fork_with_subagents_title',
        descKey: 'settings.lab.enable_fork_with_subagents_desc',
        defaultTitle: 'Fork Conversation with Subagents',
        defaultDesc: 'Allows branching and forking the entire conversation trajectory along with all active child subagents into isolated worktrees.',
        icon: GitFork,
        colorClasses: 'text-violet-500 bg-violet-500/10 border-violet-500/30',
    },
    {
        key: 'enable_swarm_narrator',
        cliKey: 'enable-swarm-narrator',
        cliFlag: '--enable-swarm-narrator',
        badge: 'Swarm',
        badgeZh: '蜂群遥测',
        badgeEn: 'Swarm',
        titleKey: 'settings.lab.enable_swarm_narrator_title',
        descKey: 'settings.lab.enable_swarm_narrator_desc',
        defaultTitle: 'Swarm Telemetry Narrator',
        defaultDesc: 'Enables an internal telemetry narrator that monitors multi-agent swarms in the background and writes real-time narrative summaries of agent interactions.',
        icon: Radio,
        colorClasses: 'text-teal-500 bg-teal-500/10 border-teal-500/30',
    },
    {
        key: 'enable_voice_activity_events',
        cliKey: 'enable-voice-activity-events',
        cliFlag: '--enable-voice-activity-events',
        badge: 'Audio',
        badgeZh: '语音音频',
        badgeEn: 'Audio',
        titleKey: 'settings.lab.enable_voice_activity_events_title',
        descKey: 'settings.lab.enable_voice_activity_events_desc',
        defaultTitle: 'Voice Activity Events & Mic-Serve',
        defaultDesc: 'Activates built-in voice event triggers and audio streamer daemon support for broadcasting host microphones to remote CLI sessions.',
        icon: Mic,
        colorClasses: 'text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/30',
    },
    {
        key: 'disable_stained_loas2_creds',
        cliKey: 'disable-stained-loas2-creds',
        cliFlag: '--disable-stained-loas2-creds',
        badge: 'Internal',
        badgeZh: '底层协议',
        badgeEn: 'Internal',
        titleKey: 'settings.lab.disable_stained_loas2_creds_title',
        descKey: 'settings.lab.disable_stained_loas2_creds_desc',
        defaultTitle: 'Bypass Stained LOAS2 Credentials',
        defaultDesc: 'Bypasses Google corporate-internal Low Overhead Authentication Service (LOAS2) credential checks leftover from internal development builds.',
        icon: KeyRound,
        colorClasses: 'text-yellow-600 bg-yellow-600/10 border-yellow-600/30',
    },
    {
        key: 'enable_deepagent',
        cliKey: 'enable-deepagent',
        cliFlag: '--enable-deepagent',
        badge: 'Reasoning',
        badgeZh: '深度推理',
        badgeEn: 'Reasoning',
        titleKey: 'settings.lab.deepagent_title',
        descKey: 'settings.lab.deepagent_desc',
        defaultTitle: 'DeepAgent Autonomous Reasoning',
        defaultDesc: 'Unlocks Google deep multi-pass reasoning loop and autonomous verification pipeline.',
        icon: Sparkles,
        colorClasses: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    },
    {
        key: 'enable_review',
        cliKey: 'enable-review',
        cliFlag: '--enable-review',
        badge: 'Review',
        badgeZh: '代码审查',
        badgeEn: 'Review',
        titleKey: 'settings.lab.review_title',
        descKey: 'settings.lab.review_desc',
        defaultTitle: 'Automated Code Reviewer Agent',
        defaultDesc: 'Activates an automated code review persona to audit git diffs and rate change safety.',
        icon: CheckCheck,
        colorClasses: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
    },
    {
        key: 'enable_image_generator_subagent',
        cliKey: 'enable-image-generator-subagent',
        cliFlag: '--enable-image-generator-subagent',
        badge: 'Vision',
        badgeZh: '原生生图',
        badgeEn: 'Vision',
        titleKey: 'settings.lab.image_generator_subagent_title',
        descKey: 'settings.lab.image_generator_subagent_desc',
        defaultTitle: 'Image Generator Subagent',
        defaultDesc: 'Embeds a native Google Imagen subagent to generate visual assets directly in transcripts.',
        icon: Image,
        colorClasses: 'text-pink-500 bg-pink-500/10 border-pink-500/30',
    },
    {
        key: 'enable_sidecars',
        cliKey: 'enable-sidecars',
        cliFlag: '--enable-sidecars',
        badge: 'Sidecars',
        badgeZh: '微前端',
        badgeEn: 'Sidecars',
        titleKey: 'settings.lab.sidecars_title',
        descKey: 'settings.lab.sidecars_desc',
        defaultTitle: 'UI Sidecars Extension System',
        defaultDesc: 'Enables the embedded micro-frontend sidecar application extension runtime.',
        icon: Layers,
        colorClasses: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    },
    {
        key: 'enable_ui_sidecars',
        cliKey: 'enable-ui-sidecars',
        cliFlag: '--enable-ui-sidecars',
        badge: 'Sidecars',
        badgeZh: '可视化',
        badgeEn: 'Sidecars',
        titleKey: 'settings.lab.ui_sidecars_title',
        descKey: 'settings.lab.ui_sidecars_desc',
        defaultTitle: 'Pre-warmed Visual Sidecars',
        defaultDesc: 'Renders interactive visual iframe sidecars alongside conversation panels.',
        icon: Layout,
        colorClasses: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    },
    {
        key: 'enable_sidecar_sdk',
        cliKey: 'enable-sidecar-sdk',
        cliFlag: '--enable-sidecar-sdk',
        badge: 'SDK',
        badgeZh: '开发接口',
        badgeEn: 'SDK',
        titleKey: 'settings.lab.sidecar_sdk_title',
        descKey: 'settings.lab.sidecar_sdk_desc',
        defaultTitle: 'Sidecar Developer SDK',
        defaultDesc: 'Exposes the internal sidecar SDK for custom developer tooling and panels.',
        icon: Code2,
        colorClasses: 'text-violet-500 bg-violet-500/10 border-violet-500/30',
    },
    {
        key: 'sidecar_gateway',
        cliKey: 'sidecar-gateway',
        cliFlag: '--sidecar-gateway',
        badge: 'Network',
        badgeZh: '网关通信',
        badgeEn: 'Network',
        titleKey: 'settings.lab.sidecar_gateway_title',
        descKey: 'settings.lab.sidecar_gateway_desc',
        defaultTitle: 'Sidecar Gateway Protocol',
        defaultDesc: 'Routes internal sidecar IPC and RPC requests through the local gateway.',
        icon: Network,
        colorClasses: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    },
    {
        key: 'sidecar_iframe_prewarm',
        cliKey: 'sidecar-iframe-prewarm',
        cliFlag: '--sidecar-iframe-prewarm',
        badge: 'Performance',
        badgeZh: '容器预热',
        badgeEn: 'Performance',
        titleKey: 'settings.lab.sidecar_iframe_prewarm_title',
        descKey: 'settings.lab.sidecar_iframe_prewarm_desc',
        defaultTitle: 'Sidecar Iframe Prewarming',
        defaultDesc: 'Pre-warms iframe sandbox contexts in the background for zero-latency UI loading.',
        icon: RefreshCw,
        colorClasses: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    },
    {
        key: 'enable_swarm_monitor',
        cliKey: 'enable-swarm-monitor',
        cliFlag: '--enable-swarm-monitor',
        badge: 'Swarm',
        badgeZh: '蜂群监控',
        badgeEn: 'Swarm',
        titleKey: 'settings.lab.swarm_monitor_title',
        descKey: 'settings.lab.swarm_monitor_desc',
        defaultTitle: 'Swarm Live Telemetry Monitor',
        defaultDesc: 'Monitors active multi-agent swarm deliberations and thread states in real time.',
        icon: Radio,
        colorClasses: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    {
        key: 'enable_ripgrep_path_search',
        cliKey: 'enable-ripgrep-path-search',
        cliFlag: '--enable-ripgrep-path-search',
        badge: 'Search',
        badgeZh: '文件索引',
        badgeEn: 'Search',
        titleKey: 'settings.lab.ripgrep_path_search_title',
        descKey: 'settings.lab.ripgrep_path_search_desc',
        defaultTitle: 'Ripgrep Fast File Indexing',
        defaultDesc: 'Accelerates file path and symbol lookups using an integrated high-performance ripgrep engine.',
        icon: Search,
        colorClasses: 'text-lime-500 bg-lime-500/10 border-lime-500/30',
    },
    {
        key: 'enable_pty',
        cliKey: 'enable-pty',
        cliFlag: '--enable-pty',
        badge: 'Terminal',
        badgeZh: '伪终端',
        badgeEn: 'Terminal',
        titleKey: 'settings.lab.pty_title',
        descKey: 'settings.lab.pty_desc',
        defaultTitle: 'ConPTY Pseudo-Terminal Engine',
        defaultDesc: 'Enables full Windows ConPTY terminal emulation for interactive terminal programs.',
        icon: Terminal,
        colorClasses: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
    },
    {
        key: 'enable_wait_tool',
        cliKey: 'enable-wait-tool',
        cliFlag: '--enable-wait-tool',
        badge: 'Tools',
        badgeZh: '休眠工具',
        badgeEn: 'Tools',
        titleKey: 'settings.lab.wait_tool_title',
        descKey: 'settings.lab.wait_tool_desc',
        defaultTitle: 'Native Agent Sleep & Wait Tool',
        defaultDesc: 'Equips agents with a non-blocking wait/timer tool for asynchronous polling and timers.',
        icon: Clock,
        colorClasses: 'text-sky-500 bg-sky-500/10 border-sky-500/30',
    },
    {
        key: 'cortex_snapshot_recording',
        cliKey: 'cortex-snapshot-recording',
        cliFlag: '--cortex-snapshot-recording',
        badge: 'Time Travel',
        badgeZh: '快照录制',
        badgeEn: 'Time Travel',
        titleKey: 'settings.lab.cortex_snapshot_recording_title',
        descKey: 'settings.lab.cortex_snapshot_recording_desc',
        defaultTitle: 'Cortex Workspace Snapshot Recorder',
        defaultDesc: 'Continuously records workspace filesystem and conversation state snapshots.',
        icon: History,
        colorClasses: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
    },
    {
        key: 'cortex_snapshot_revert',
        cliKey: 'cortex-snapshot-revert',
        cliFlag: '--cortex-snapshot-revert',
        badge: 'Time Travel',
        badgeZh: '快照回滚',
        badgeEn: 'Time Travel',
        titleKey: 'settings.lab.cortex_snapshot_revert_title',
        descKey: 'settings.lab.cortex_snapshot_revert_desc',
        defaultTitle: 'Cortex Trajectory State Revert',
        defaultDesc: 'Enables rolling back conversation trajectories and file states to previous snapshots.',
        icon: RotateCcw,
        colorClasses: 'text-rose-400 bg-rose-400/10 border-rose-400/30',
    },
    {
        key: 'enable_remote_agent_fastpush_pin',
        cliKey: 'enable-remote-agent-fastpush-pin',
        cliFlag: '--enable-remote-agent-fastpush-pin',
        badge: 'Mesh',
        badgeZh: '网状互联',
        badgeEn: 'Mesh',
        titleKey: 'settings.lab.remote_agent_fastpush_pin_title',
        descKey: 'settings.lab.remote_agent_fastpush_pin_desc',
        defaultTitle: 'Agent Mesh Peer-to-Peer Networking',
        defaultDesc: 'Synchronizes agent tasks and push-pin checkpoints across remote developer machines.',
        icon: Share2,
        colorClasses: 'text-teal-500 bg-teal-500/10 border-teal-500/30',
    },
    {
        key: 'enable_conversation_search_v2',
        cliKey: 'enable-conversation-search-v2',
        cliFlag: '--enable-conversation-search-v2',
        badge: 'Search',
        badgeZh: '语义搜索',
        badgeEn: 'Search',
        titleKey: 'settings.lab.conversation_search_v2_title',
        descKey: 'settings.lab.conversation_search_v2_desc',
        defaultTitle: 'Semantic Conversation Search v2',
        defaultDesc: 'Enables semantic trajectory vector indexing and instant search across past sessions.',
        icon: Search,
        colorClasses: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
    },
    {
        key: 'cascade_enable_notebook_edit_tool',
        cliKey: 'cascade-enable-notebook-edit-tool',
        cliFlag: '--cascade-enable-notebook-edit-tool',
        badge: 'Notebook',
        badgeZh: '笔记本',
        badgeEn: 'Notebook',
        titleKey: 'settings.lab.cascade_enable_notebook_edit_tool_title',
        descKey: 'settings.lab.cascade_enable_notebook_edit_tool_desc',
        defaultTitle: 'Native Jupyter Notebook Editing',
        defaultDesc: 'Allows direct cell-level inspection and manipulation of .ipynb notebooks.',
        icon: FileCode,
        colorClasses: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    },
    {
        key: 'cascade_use_sed_edit_tool',
        cliKey: 'cascade-use-sed-edit-tool',
        cliFlag: '--cascade-use-sed-edit-tool',
        badge: 'Editor',
        badgeZh: '正则流式',
        badgeEn: 'Editor',
        titleKey: 'settings.lab.cascade_use_sed_edit_tool_title',
        descKey: 'settings.lab.cascade_use_sed_edit_tool_desc',
        defaultTitle: 'Native Sed Stream Regex Editing',
        defaultDesc: 'Provides a built-in line-oriented regex stream editing tool directly in the language server.',
        icon: Code2,
        colorClasses: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    },
    {
        key: 'enable_model_capacity_exhausted_retries',
        cliKey: 'enable-model-capacity-exhausted-retries',
        cliFlag: '--enable-model-capacity-exhausted-retries',
        badge: 'Resilience',
        badgeZh: '容错重试',
        badgeEn: 'Resilience',
        titleKey: 'settings.lab.model_capacity_exhausted_retries_title',
        descKey: 'settings.lab.model_capacity_exhausted_retries_desc',
        defaultTitle: 'Model Capacity Exhaustion Auto-Retry',
        defaultDesc: 'Automatically retries transient Google upstream quota and model exhaustion errors.',
        icon: RefreshCw,
        colorClasses: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    {
        key: 'enable_mcp_non_blocking_turn_load',
        cliKey: 'enable-mcp-non-blocking-turn-load',
        cliFlag: '--enable-mcp-non-blocking-turn-load',
        badge: 'MCP',
        badgeZh: '异步加载',
        badgeEn: 'MCP',
        titleKey: 'settings.lab.mcp_non_blocking_turn_load_title',
        descKey: 'settings.lab.mcp_non_blocking_turn_load_desc',
        defaultTitle: 'Non-blocking MCP Turn Loading',
        defaultDesc: 'Loads Model Context Protocol (MCP) tool schemas asynchronously without blocking UI turns.',
        icon: Boxes,
        colorClasses: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    },
];

export const EXPERIMENT_ITEMS: LabExperimentItem[] = FEATURE_KEYS;

export const DEFAULT_LAB_CONFIG: AntigravityLabConfig = FEATURE_KEYS.reduce((acc, item) => {
    acc[item.key] = true;
    return acc;
}, {} as AntigravityLabConfig);

export function syncArgsWithLabConfig(currentArgs: string[] = [], labConfig: AntigravityLabConfig): string[] {
    let result = [...currentArgs];
    for (const item of FEATURE_KEYS) {
        const flag = item.cliFlag;
        const isEnabled = !!labConfig[item.key];

        // 移除该 flag 现有的任何形式（如 --flag, --flag=true, --flag=false）
        result = result.filter(arg => {
            const trimmed = arg.trim();
            return !(trimmed === flag || trimmed.startsWith(`${flag}=`));
        });

        // 若已开启，则写入 --flag=true
        if (isEnabled) {
            result.push(`${flag}=true`);
        }
    }
    return result;
}

export default function AntigravityLabSettings({
    config = DEFAULT_LAB_CONFIG,
    onChange,
    antigravityArgs = [],
    onArgsChange,
}: AntigravityLabSettingsProps) {
    const { t, i18n } = useTranslation();
    const isZh = i18n.language?.startsWith('zh');
    const currentConfig: AntigravityLabConfig = {
        ...DEFAULT_LAB_CONFIG,
        ...config,
    };

    const [isSyncingCli, setIsSyncingCli] = useState(false);
    const [isLoadingCli, setIsLoadingCli] = useState(false);
    const [autoSyncArgs, setAutoSyncArgs] = useState<boolean>(() => {
        const saved = localStorage.getItem('antigravity_lab_auto_sync_args');
        return saved !== 'false';
    });

    const activeCount = FEATURE_KEYS.filter(item => currentConfig[item.key]).length;

    const handleToggle = (key: keyof AntigravityLabConfig, enabled: boolean) => {
        const nextConfig: AntigravityLabConfig = {
            ...currentConfig,
            [key]: enabled,
        };
        onChange(nextConfig);

        if (autoSyncArgs && onArgsChange) {
            const nextArgs = syncArgsWithLabConfig(antigravityArgs, nextConfig);
            onArgsChange(nextArgs);
        }
    };

    const handleEnableAll = () => {
        const nextConfig = FEATURE_KEYS.reduce((acc, item) => {
            acc[item.key] = true;
            return acc;
        }, {} as AntigravityLabConfig);
        onChange(nextConfig);

        if (autoSyncArgs && onArgsChange) {
            const nextArgs = syncArgsWithLabConfig(antigravityArgs, nextConfig);
            onArgsChange(nextArgs);
        }
    };

    const handleDisableAll = () => {
        const nextConfig = FEATURE_KEYS.reduce((acc, item) => {
            acc[item.key] = false;
            return acc;
        }, {} as AntigravityLabConfig);
        onChange(nextConfig);

        if (autoSyncArgs && onArgsChange) {
            const nextArgs = syncArgsWithLabConfig(antigravityArgs, nextConfig);
            onArgsChange(nextArgs);
        }
    };

    const handleToggleAutoSync = (enabled: boolean) => {
        setAutoSyncArgs(enabled);
        localStorage.setItem('antigravity_lab_auto_sync_args', String(enabled));
        if (enabled && onArgsChange) {
            const nextArgs = syncArgsWithLabConfig(antigravityArgs, currentConfig);
            onArgsChange(nextArgs);
            showToast(t('settings.lab.sync_startup_args_success', { defaultValue: 'Startup arguments updated to match active lab flags.' }), 'success');
        }
    };

    const handleManualSyncStartupArgs = () => {
        if (onArgsChange) {
            const nextArgs = syncArgsWithLabConfig(antigravityArgs, currentConfig);
            onArgsChange(nextArgs);
            showToast(t('settings.lab.sync_startup_args_success', { defaultValue: 'Startup arguments updated to match active lab flags.' }), 'success');
        }
    };

    const handleSyncCli = async () => {
        setIsSyncingCli(true);
        try {
            await request('sync_cli_experiments', { experiments: currentConfig });
            showToast(t('settings.lab.sync_cli_success', { defaultValue: 'Successfully synced experimental features to CLI settings (~/.gemini/antigravity-cli/settings.json)' }), 'success');
        } catch (error) {
            console.error('Failed to sync to CLI settings:', error);
            showToast(`${t('settings.lab.sync_cli_error', { defaultValue: 'Failed to sync to CLI settings' })}: ${error}`, 'error');
        } finally {
            setIsSyncingCli(false);
        }
    };

    const handleLoadCli = async () => {
        setIsLoadingCli(true);
        try {
            const cliData = await request<AntigravityLabConfig>('get_cli_experiments');
            if (cliData && typeof cliData === 'object') {
                const nextConfig = {
                    ...currentConfig,
                    ...cliData,
                };
                onChange(nextConfig);
                if (autoSyncArgs && onArgsChange) {
                    const nextArgs = syncArgsWithLabConfig(antigravityArgs, nextConfig);
                    onArgsChange(nextArgs);
                }
                showToast(t('settings.lab.load_cli_success', { defaultValue: 'Successfully loaded experimental features from CLI settings' }), 'success');
            }
        } catch (error) {
            console.error('Failed to load CLI settings:', error);
            showToast(`${t('settings.lab.load_cli_error', { defaultValue: 'Failed to load CLI settings' })}: ${error}`, 'error');
        } finally {
            setIsLoadingCli(false);
        }
    };

    return (
        <div className="border border-purple-200/60 dark:border-purple-900/30 bg-purple-50/20 dark:bg-purple-950/10 rounded-xl p-4 sm:p-5 space-y-4 my-4">
            {/* 1. Header Card */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-purple-100 dark:border-purple-900/30">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 border border-purple-200 dark:border-purple-800/40">
                        <FlaskConical size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                                {t('settings.lab.title', { defaultValue: 'Antigravity Lab (实验性特性开关)' })}
                            </h4>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800/40 flex items-center gap-1">
                                <span>🧪</span>
                                {t('settings.lab.badge', { defaultValue: 'Experimental Lab' })}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-base-200 dark:bg-base-300 text-base-content/70 font-mono">
                                {activeCount} / {FEATURE_KEYS.length} Active
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
                            {t('settings.lab.desc', {
                                defaultValue: 'Configure cutting-edge experimental features for the Antigravity engine and CLI. Flags can be synced dynamically with CLI configurations (~/.gemini/antigravity-cli/settings.json) and startup arguments.',
                            })}
                        </p>
                    </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap">
                    <button
                        type="button"
                        onClick={handleEnableAll}
                        className="btn btn-xs rounded-none border border-base-content/30 text-base-content font-bold uppercase tracking-wider hover:bg-base-content hover:text-base-100 flex items-center gap-1"
                        title={t('settings.lab.enable_all', { defaultValue: 'Enable All' })}
                    >
                        <CheckCheck size={12} />
                        {t('settings.lab.enable_all', { defaultValue: 'Enable All' })}
                    </button>
                    <button
                        type="button"
                        onClick={handleDisableAll}
                        className="btn btn-xs rounded-none border border-base-content/30 text-base-content font-bold uppercase tracking-wider hover:bg-base-content hover:text-base-100 flex items-center gap-1"
                        title={t('settings.lab.disable_all', { defaultValue: 'Disable All' })}
                    >
                        <XCircle size={12} />
                        {t('settings.lab.disable_all', { defaultValue: 'Disable All' })}
                    </button>
                </div>
            </div>

            {/* Quick Slash Commands Cheatsheet */}
            <div className="bg-purple-100/40 dark:bg-purple-900/20 border border-purple-200/50 dark:border-purple-800/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                        <Terminal size={13} className="text-purple-600 dark:text-purple-400" />
                        {isZh ? '快捷斜杠指令 (CLI Slash Commands)' : 'CLI Slash Commands & Workflows'}
                    </span>
                    <span className="text-[10px] text-purple-700 dark:text-purple-300 font-mono">
                        ~/.gemini/config/skills/
                    </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                        <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/owl &lt;task&gt;</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">{isZh ? '深度架构探究与代码合成 (DeepInvestigator + DeepCoder)' : 'Deep architectural synthesis & investigation (Pro tier)'}</div>
                    </div>
                    <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                        <div className="font-mono font-bold text-amber-600 dark:text-amber-400">/battle &lt;task&gt;</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">{isZh ? '角斗场对抗竞技：双智能体辩论与基准测速' : 'Colosseum arena duel: 2 rival agents debate & benchmark'}</div>
                    </div>
                    <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                        <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">/swarm &lt;task&gt;</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">{isZh ? '蜂群枢纽免确认全自主多智能体团队开发' : 'Autonomous multi-agent swarm building hands-free'}</div>
                    </div>
                    <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                        <div className="font-mono font-bold text-blue-600 dark:text-blue-400">/benchmark &lt;task&gt;</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">{isZh ? '编程式动态工具合成：自动化压测与帧率分析' : 'Programmatic tool synthesis & performance profiling'}</div>
                    </div>
                    <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                        <div className="font-mono font-bold text-pink-600 dark:text-pink-400">/generative_ui &lt;task&gt;</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">{isZh ? '生成式交互 UI：在对话 Artifact 中嵌入可玩控件' : 'Interactive UI widgets rendered directly inside artifacts'}</div>
                    </div>
                    <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                        <div className="font-mono font-bold text-violet-600 dark:text-violet-400">/compact</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">{isZh ? '压缩修剪对话历史轨迹以释放上下文窗口' : 'Prune and compact trajectory context window cleanly'}</div>
                    </div>
                </div>
            </div>

            {/* 2. Startup Arguments & CLI Synchronization Hub */}
            <div className="bg-base-100/70 dark:bg-base-200/50 border border-purple-100 dark:border-purple-900/20 rounded-lg p-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-md bg-purple-100/50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
                            <ArrowRightLeft size={16} />
                        </div>
                        <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                                {t('settings.lab.auto_sync_args', { defaultValue: 'Auto-sync with Startup Arguments (antigravity_args)' })}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {t('settings.lab.auto_sync_args_desc', {
                                    defaultValue: 'When enabled, active flags are automatically mirrored in Desktop IDE startup arguments (e.g. --enable-owl-slash-command=true) so the desktop client receives them on startup.',
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        <button
                            type="button"
                            onClick={handleManualSyncStartupArgs}
                            className="btn btn-xs btn-ghost rounded-none border border-base-content/20 text-base-content text-[11px]"
                        >
                            {t('settings.lab.sync_startup_args_btn', { defaultValue: 'Apply to Startup Args' })}
                        </button>

                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoSyncArgs}
                                onChange={(e) => handleToggleAutoSync(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-gray-600 peer-checked:bg-purple-600"></div>
                        </label>
                    </div>
                </div>

                {/* CLI Synchronization Buttons */}
                <div className="pt-2 border-t border-base-200 dark:border-base-300 flex flex-wrap items-center gap-2 justify-between">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                        ~/.gemini/antigravity-cli/settings.json
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={handleLoadCli}
                            disabled={isLoadingCli}
                            className="btn btn-xs rounded-none border border-base-content/30 text-base-content font-bold uppercase tracking-wider hover:bg-base-content hover:text-base-100 flex items-center gap-1.5"
                        >
                            <RefreshCw size={12} className={isLoadingCli ? 'animate-spin' : ''} />
                            {isLoadingCli
                                ? t('settings.lab.loading_cli', { defaultValue: 'Loading...' })
                                : t('settings.lab.load_cli_btn', { defaultValue: 'Fetch from CLI' })}
                        </button>
                        <button
                            type="button"
                            onClick={handleSyncCli}
                            disabled={isSyncingCli}
                            className="btn btn-xs btn-primary rounded-none font-bold uppercase tracking-wider flex items-center gap-1.5"
                        >
                            <Share2 size={12} className={isSyncingCli ? 'animate-spin' : ''} />
                            {isSyncingCli
                                ? t('settings.lab.syncing_cli', { defaultValue: 'Syncing...' })
                                : t('settings.lab.sync_cli_btn', { defaultValue: 'Sync to CLI Settings (~/.gemini/antigravity-cli/settings.json)' })}
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. Experimental Feature Toggles (15 items) */}
            <div className="space-y-2.5">
                {FEATURE_KEYS.map((item) => {
                    const isEnabled = !!currentConfig[item.key];
                    const IconComponent = item.icon;
                    const badgeText = isZh ? (item.badgeZh || item.badge) : (item.badgeEn || item.badge);

                    return (
                        <div
                            key={item.key}
                            className={`p-3 rounded-lg border transition-all duration-200 flex items-start justify-between gap-3 ${
                                isEnabled
                                    ? 'bg-purple-50/30 dark:bg-purple-950/20 border-purple-300/80 dark:border-purple-800/60 shadow-xs'
                                    : 'bg-white/70 dark:bg-base-100/70 border-base-200 dark:border-base-300/60 hover:border-purple-200 dark:hover:border-purple-900/40'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg border mt-0.5 shrink-0 ${item.colorClasses}`}>
                                    <IconComponent size={16} />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-xs text-gray-900 dark:text-gray-100">
                                            {t(item.titleKey, { defaultValue: item.defaultTitle })}
                                        </span>
                                        {badgeText && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-purple-100/70 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40">
                                                {badgeText}
                                            </span>
                                        )}
                                        <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-base-200 dark:bg-base-300 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40">
                                            {item.cliFlag}
                                        </code>
                                    </div>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                                        {t(item.descKey, { defaultValue: item.defaultDesc })}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 pt-0.5">
                                <span className={`text-[11px] font-medium hidden sm:inline ${isEnabled ? 'text-purple-600 dark:text-purple-400 font-semibold' : 'text-gray-400'}`}>
                                    {isEnabled
                                        ? t('common.enabled', { defaultValue: 'Enabled' })
                                        : t('common.disabled', { defaultValue: 'Disabled' })}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isEnabled}
                                        onChange={(e) => handleToggle(item.key, e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-gray-600 peer-checked:bg-purple-600"></div>
                                </label>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
