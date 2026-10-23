import { useState, Fragment } from 'react';
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
    Check,
    ChevronDown,
    ChevronUp,
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
    titleZh?: string;
    descZh?: string;
    icon: LucideIcon;
    colorClasses: string;
}

export interface LabFeaturePair {
    pairId: string;
    keys: [keyof AntigravityLabConfig, keyof AntigravityLabConfig];
}

export interface LabFeatureGroup {
    id: string;
    title: string;
    titleZh: string;
    desc: string;
    descZh: string;
    badge: string;
    badgeZh: string;
    icon: LucideIcon;
    colorClasses: string;
    pairs: LabFeaturePair[];
}

// -----------------------------------------------------------------------------
// 54 Flag Dictionary Definitions (Grouped & Paired)
// -----------------------------------------------------------------------------

export const FEATURE_DICT: Record<keyof AntigravityLabConfig, LabExperimentItem> = {
    // --- Group 1: Multi-Agent & Swarm Orchestration ---
    jetski_autonomous_mode: {
        key: 'jetski_autonomous_mode',
        cliKey: 'jetski-autonomous-mode',
        cliFlag: '--jetski-autonomous-mode',
        badge: 'Autonomous',
        badgeZh: '自主模式',
        badgeEn: 'Autonomous',
        titleKey: 'settings.lab.jetski_autonomous_mode_title',
        descKey: 'settings.lab.jetski_autonomous_mode_desc',
        defaultTitle: 'Jetski Autonomous Execution Mode',
        defaultDesc: 'Unlocks non-interactive, multi-turn autonomous execution for complex engineering workflows without manual interruption.',
        titleZh: 'Jetski 全自主执行模式',
        descZh: '解锁无须交互确认的多轮全自主任务执行循环，适合长时运行的复杂工程重构与批处理。',
        icon: Bot,
        colorClasses: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    disable_teamwork_forced_flash_model: {
        key: 'disable_teamwork_forced_flash_model',
        cliKey: 'disable-teamwork-forced-flash-model',
        cliFlag: '--disable-teamwork-forced-flash-model',
        badge: 'Model Tier',
        badgeZh: '协作模型',
        badgeEn: 'Model Tier',
        titleKey: 'settings.lab.disable_teamwork_forced_flash_model_title',
        descKey: 'settings.lab.disable_teamwork_forced_flash_model_desc',
        defaultTitle: 'Disable Teamwork Forced Flash Model',
        defaultDesc: 'Allows subagents in Teamwork mode to inherit parent model capabilities (e.g., Pro/Ultra) instead of being locked to Flash.',
        titleZh: '禁用团队协作强制降级 Flash',
        descZh: '允许 Teamwork 模式下的子智能体继承父级模型能力（如 Pro/Ultra/Opus），防止被强制降级至 Flash。',
        icon: Cpu,
        colorClasses: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    },
    enable_subagent_hub: {
        key: 'enable_subagent_hub',
        cliKey: 'enable-subagent-hub',
        cliFlag: '--enable-subagent-hub',
        badge: 'Subagents',
        badgeZh: '智能体中心',
        badgeEn: 'Subagents',
        titleKey: 'settings.lab.subagent_hub_title',
        descKey: 'settings.lab.subagent_hub_desc',
        defaultTitle: 'Subagent Hub Dashboard',
        defaultDesc: 'Provides a centralized dashboard for tracking, debugging, and managing distributed subagent lifecycles and transcripts.',
        titleZh: '子智能体生命周期中心 (Subagent Hub)',
        descZh: '提供集中式子智能体生命周期控制面板，支持追踪、调试、发送消息与管理独立工作区。',
        icon: Boxes,
        colorClasses: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
    },
    enable_swarm_monitor: {
        key: 'enable_swarm_monitor',
        cliKey: 'enable-swarm-monitor',
        cliFlag: '--enable-swarm-monitor',
        badge: 'Swarm',
        badgeZh: '蜂群监控',
        badgeEn: 'Swarm',
        titleKey: 'settings.lab.swarm_monitor_title',
        descKey: 'settings.lab.swarm_monitor_desc',
        defaultTitle: 'Swarm Live Telemetry Monitor',
        defaultDesc: 'Monitors active multi-agent swarm deliberations, thread states, and inter-agent messages in real time.',
        titleZh: '蜂群协同实时遥测监控',
        descZh: '实时监控多智能体蜂群并发讨论、子智能体执行线程与消息传递状态。',
        icon: Radio,
        colorClasses: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    enable_fork_with_subagents: {
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
        titleZh: '会话与子智能体全量分叉',
        descZh: '允许将整个会话上下文轨迹及所有活跃子智能体分叉到隔离的 Git 工作树分支中运行。',
        icon: GitFork,
        colorClasses: 'text-violet-500 bg-violet-500/10 border-violet-500/30',
    },
    send_subagent_initial_prompt_as_message: {
        key: 'send_subagent_initial_prompt_as_message',
        cliKey: 'send-subagent-initial-prompt-as-message',
        cliFlag: '--send-subagent-initial-prompt-as-message',
        badge: 'Messaging',
        badgeZh: '初始消息',
        badgeEn: 'Messaging',
        titleKey: 'settings.lab.send_subagent_initial_prompt_as_message_title',
        descKey: 'settings.lab.send_subagent_initial_prompt_as_message_desc',
        defaultTitle: 'Subagent Prompt-as-Message Dispatch',
        defaultDesc: 'Delivers subagent initialization prompts via formal turn messages instead of hidden system pre-injections, ensuring full transparency in transcripts.',
        titleZh: '子智能体初始提示词转消息发送',
        descZh: '将子智能体初始化 Prompt 作为正式会话消息发送，而非隐式注入，确保轨迹审计透明可溯源。',
        icon: Share2,
        colorClasses: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    },
    enable_swarm_narrator: {
        key: 'enable_swarm_narrator',
        cliKey: 'enable-swarm-narrator',
        cliFlag: '--enable-swarm-narrator',
        badge: 'Narrator',
        badgeZh: '蜂群解说',
        badgeEn: 'Narrator',
        titleKey: 'settings.lab.enable_swarm_narrator_title',
        descKey: 'settings.lab.enable_swarm_narrator_desc',
        defaultTitle: 'Swarm Telemetry Narrator',
        defaultDesc: 'Enables an internal telemetry narrator that monitors multi-agent swarms in the background and writes real-time narrative summaries of agent interactions.',
        titleZh: '蜂群运行实时叙述解说员',
        descZh: '启用内部遥测解说员，实时归纳多智能体群体决策并生成简洁可读的剧情叙述。',
        icon: Radio,
        colorClasses: 'text-teal-500 bg-teal-500/10 border-teal-500/30',
    },
    enable_image_generator_subagent: {
        key: 'enable_image_generator_subagent',
        cliKey: 'enable-image-generator-subagent',
        cliFlag: '--enable-image-generator-subagent',
        badge: 'Vision',
        badgeZh: '原生生图',
        badgeEn: 'Vision',
        titleKey: 'settings.lab.image_generator_subagent_title',
        descKey: 'settings.lab.image_generator_subagent_desc',
        defaultTitle: 'Image Generator Subagent',
        defaultDesc: 'Embeds a native Google Imagen subagent to generate visual assets and diagrams directly in transcripts.',
        titleZh: '原生 Imagen 图像生成子智能体',
        descZh: '内置 Google Imagen 视觉生成智能体，可在对话轮次中直接绘制图表、架构图与视觉素材。',
        icon: Image,
        colorClasses: 'text-pink-500 bg-pink-500/10 border-pink-500/30',
    },

    // --- Group 2: Deep Exploration & Adversarial Arena (Slash Commands) ---
    enable_owl_slash_command: {
        key: 'enable_owl_slash_command',
        cliKey: 'enable-owl-slash-command',
        cliFlag: '--enable-owl-slash-command',
        badge: 'Explorer',
        badgeZh: '指令探索',
        badgeEn: 'Explorer',
        titleKey: 'settings.lab.owl_slash_command_title',
        descKey: 'settings.lab.owl_slash_command_desc',
        defaultTitle: 'Owl Slash Command (/owl)',
        defaultDesc: 'Enables the /owl slash command for agentic codebase exploration and deep autonomous synthesis.',
        titleZh: 'Owl 深度架构探究指令 (/owl)',
        descZh: '激活 /owl 斜杠指令，启动双核驱动的深度代码库调研与合成管线 (DeepInvestigator + DeepCoder)。',
        icon: Terminal,
        colorClasses: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    },
    enable_compact_slash_command: {
        key: 'enable_compact_slash_command',
        cliKey: 'enable-compact-slash-command',
        cliFlag: '--enable-compact-slash-command',
        badge: 'Trajectory',
        badgeZh: '对话修剪',
        badgeEn: 'Trajectory',
        titleKey: 'settings.lab.compact_slash_command_title',
        descKey: 'settings.lab.compact_slash_command_desc',
        defaultTitle: 'Compact Slash Command (/compact)',
        defaultDesc: 'Activates the /compact slash command to prune and compact long conversation trajectories, freeing context window while preserving critical project state.',
        titleZh: 'Compact 轨迹压缩指令 (/compact)',
        descZh: '激活 /compact 斜杠指令，智能压缩修剪长会话历史轨迹，在释放上下文窗口的同时完好保留关键项目状态。',
        icon: RotateCcw,
        colorClasses: 'text-violet-500 bg-violet-500/10 border-violet-500/30',
    },
    enable_battle_mode: {
        key: 'enable_battle_mode',
        cliKey: 'enable-battle-mode',
        cliFlag: '--enable-battle-mode',
        badge: 'Arena',
        badgeZh: '角斗竞技',
        badgeEn: 'Arena',
        titleKey: 'settings.lab.battle_mode_title',
        descKey: 'settings.lab.battle_mode_desc',
        defaultTitle: 'Battle Mode (Colosseum Arena)',
        defaultDesc: 'Runs competing models side-by-side on the same prompt to benchmark quality, reasoning depth, and latency in real time.',
        titleZh: '角斗场对抗竞技模式 (/battle)',
        descZh: '在相同提示词下并行运行两个模型进行实时辩论、评测与基准测速，对比推理深度与代码质量。',
        icon: Swords,
        colorClasses: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
    },
    enable_battle_mode_custom_agents: {
        key: 'enable_battle_mode_custom_agents',
        cliKey: 'enable-battle-mode-custom-agents',
        cliFlag: '--enable-battle-mode-custom-agents',
        badge: 'Custom Arena',
        badgeZh: '自定义竞技',
        badgeEn: 'Custom Arena',
        titleKey: 'settings.lab.enable_battle_mode_custom_agents_title',
        descKey: 'settings.lab.enable_battle_mode_custom_agents_desc',
        defaultTitle: 'Battle Mode Custom Personas',
        defaultDesc: 'Enables pitting user-defined custom agent personas (custom YAML or prompts) against each other in the Colosseum arena.',
        titleZh: '竞技场自定义角色对决',
        descZh: '支持在 Colosseum 角斗场中加载用户自定义智能体角色（自定义 YAML 或 Prompt）进行对抗。',
        icon: Trophy,
        colorClasses: 'text-amber-600 bg-amber-600/10 border-amber-600/30',
    },
    enable_programmatic_tools: {
        key: 'enable_programmatic_tools',
        cliKey: 'enable-programmatic-tools',
        cliFlag: '--enable-programmatic-tools',
        badge: 'Benchmark',
        badgeZh: '编程式工具',
        badgeEn: 'Benchmark',
        titleKey: 'settings.lab.programmatic_tools_title',
        descKey: 'settings.lab.programmatic_tools_desc',
        defaultTitle: 'Programmatic Tool Synthesis (/benchmark)',
        defaultDesc: 'Synthesizes ad-hoc stress-test tools and runs headless simulations to profile performance, frame budgets, and high-throughput pipelines.',
        titleZh: '编程式工具动态合成 (/benchmark)',
        descZh: '支持根据需要即时合成脚本压测工具与模拟环境，实现高吞吐量数据处理与性能基准评测。',
        icon: Code2,
        colorClasses: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    },
    jetski_generative_ui: {
        key: 'jetski_generative_ui',
        cliKey: 'jetski-generative-ui',
        cliFlag: '--jetski-generative-ui',
        badge: 'Generative UI',
        badgeZh: '动态界面',
        badgeEn: 'Generative UI',
        titleKey: 'settings.lab.jetski_generative_ui_title',
        descKey: 'settings.lab.jetski_generative_ui_desc',
        defaultTitle: 'Jetski Generative UI (/generative_ui)',
        defaultDesc: 'Renders interactive dynamic UI widgets, charts, and visualizations directly within agent conversation turns and artifacts.',
        titleZh: '生成式交互界面 (/generative_ui)',
        descZh: '允许智能体在对话轮次及 Artifact 视窗中直接渲染可交互的 HTML/CSS/JS 动态微控件与图表。',
        icon: Layout,
        colorClasses: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    },
    enable_deepagent: {
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
        titleZh: 'DeepAgent 深度自主推理闭环',
        descZh: '解锁 Google 多轮思维验证闭环与高级反思循环，应对高复杂度数学和算法工程难题。',
        icon: Sparkles,
        colorClasses: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    },
    enable_review: {
        key: 'enable_review',
        cliKey: 'enable-review',
        cliFlag: '--enable-review',
        badge: 'Reviewer',
        badgeZh: '代码审查',
        badgeEn: 'Reviewer',
        titleKey: 'settings.lab.review_title',
        descKey: 'settings.lab.review_desc',
        defaultTitle: 'Automated Code Reviewer Agent',
        defaultDesc: 'Activates an automated code review persona to audit git diffs, rate change safety, and verify architectural invariants.',
        titleZh: '自动代码审查员智能体',
        descZh: '激活专职代码审查员角色，自动审计 Git Diff 差异、评定破坏性风险并检查架构规范。',
        icon: CheckCheck,
        colorClasses: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
    },

    // --- Group 3: Customizations 2.0 & Plugin Ecosystem ---
    enable_plugins: {
        key: 'enable_plugins',
        cliKey: 'enable-plugins',
        cliFlag: '--enable-plugins',
        badge: 'Plugins',
        badgeZh: '插件生态',
        badgeEn: 'Plugins',
        titleKey: 'settings.lab.enable_plugins_title',
        descKey: 'settings.lab.enable_plugins_desc',
        defaultTitle: 'Plugins Extension Architecture (/plugin)',
        defaultDesc: 'Activates unified plugin bundles encapsulating skills, agents, rules, hooks, and MCP servers into single installable packages.',
        titleZh: 'Customizations 2.0 统一插件架构 (/plugin)',
        descZh: '激活统一插件包体系，将技能、智能体、系统规则、生命周期钩子与 MCP 服务打包分发。',
        icon: Boxes,
        colorClasses: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    },
    enable_hook_status: {
        key: 'enable_hook_status',
        cliKey: 'enable-hook-status',
        cliFlag: '--enable-hook-status',
        badge: 'Hooks',
        badgeZh: '钩子状态',
        badgeEn: 'Hooks',
        titleKey: 'settings.lab.enable_hook_status_title',
        descKey: 'settings.lab.enable_hook_status_desc',
        defaultTitle: 'Lifecycle Hook Status Inspector (/hooks)',
        defaultDesc: 'Enables real-time inspection, event firing logs, and health status for pre-tool, post-tool, and session lifecycle hooks.',
        titleZh: '生命周期钩子状态检查器 (/hooks)',
        descZh: '激活钩子状态面板，实时查看工具执行前/后、会话开始等生命周期钩子的加载与触发指标。',
        icon: RefreshCw,
        colorClasses: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    enable_customization_kind_agent: {
        key: 'enable_customization_kind_agent',
        cliKey: 'enable-customization-kind-agent',
        cliFlag: '--enable-customization-kind-agent',
        badge: 'Agent Kind',
        badgeZh: '智能体扩展',
        badgeEn: 'Agent Kind',
        titleKey: 'settings.lab.customization_kind_agent_title',
        descKey: 'settings.lab.customization_kind_agent_desc',
        defaultTitle: 'Custom Agent Personas (Kind: Agent)',
        defaultDesc: 'Permits discovery and execution of modular agent definitions from ~/.gemini/config/agents/ and plugin packages.',
        titleZh: '自定义角色类型 (Kind: Agent)',
        descZh: '支持从 ~/.gemini/config/agents/ 及插件包中加载独立的智能体角色声明与元数据。',
        icon: Bot,
        colorClasses: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
    },
    enable_customization_kind_skill: {
        key: 'enable_customization_kind_skill',
        cliKey: 'enable-customization-kind-skill',
        cliFlag: '--enable-customization-kind-skill',
        badge: 'Skill Kind',
        badgeZh: '技能扩展',
        badgeEn: 'Skill Kind',
        titleKey: 'settings.lab.customization_kind_skill_title',
        descKey: 'settings.lab.customization_kind_skill_desc',
        defaultTitle: 'Custom Skill Packages (Kind: Skill)',
        defaultDesc: 'Enables dynamic skill registry loading from ~/.gemini/config/skills/ with automatic SKILL.md parsing and script dispatch.',
        titleZh: '自定义技能包类型 (Kind: Skill)',
        descZh: '支持动态扫描与解析 ~/.gemini/config/skills/ 下的 SKILL.md 文档与辅助执行脚本。',
        icon: Sparkles,
        colorClasses: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    },
    enable_customization_kind_rule: {
        key: 'enable_customization_kind_rule',
        cliKey: 'enable-customization-kind-rule',
        cliFlag: '--enable-customization-kind-rule',
        badge: 'Rule Kind',
        badgeZh: '规则扩展',
        badgeEn: 'Rule Kind',
        titleKey: 'settings.lab.customization_kind_rule_title',
        descKey: 'settings.lab.customization_kind_rule_desc',
        defaultTitle: 'Modular System Rules (Kind: Rule)',
        defaultDesc: 'Loads modular, directory-scoped, or glob-scoped system prompt constraints from ~/.gemini/config/rules/ and plugins.',
        titleZh: '模块化系统规则约束 (Kind: Rule)',
        descZh: '加载目录级别或工作区级别的系统规则约束，实现严格且灵活的代码与环境操作守则。',
        icon: ShieldCheck,
        colorClasses: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    enable_customization_kind_mcp: {
        key: 'enable_customization_kind_mcp',
        cliKey: 'enable-customization-kind-mcp',
        cliFlag: '--enable-customization-kind-mcp',
        badge: 'MCP Kind',
        badgeZh: '协议扩展',
        badgeEn: 'MCP Kind',
        titleKey: 'settings.lab.customization_kind_mcp_title',
        descKey: 'settings.lab.customization_kind_mcp_desc',
        defaultTitle: 'Packaged MCP Servers (Kind: MCP)',
        defaultDesc: 'Allows plugins to declare and bundle native Model Context Protocol server configurations and client stdio bridges.',
        titleZh: '插件打包 MCP 服务器 (Kind: MCP)',
        descZh: '允许插件内联声明并运行原生的 Model Context Protocol 服务与双向 stdio 适配器。',
        icon: Network,
        colorClasses: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    },
    enable_customization_kind_hooks: {
        key: 'enable_customization_kind_hooks',
        cliKey: 'enable-customization-kind-hooks',
        cliFlag: '--enable-customization-kind-hooks',
        badge: 'Hooks Kind',
        badgeZh: '事件拦截',
        badgeEn: 'Hooks Kind',
        titleKey: 'settings.lab.customization_kind_hooks_title',
        descKey: 'settings.lab.customization_kind_hooks_desc',
        defaultTitle: 'Declarative Hooks (Kind: Hooks)',
        defaultDesc: 'Enables declarative registration of event interceptors triggered before or after tool executions and model turns.',
        titleZh: '声明式事件钩子拦截 (Kind: Hooks)',
        descZh: '支持通过声明式 YAML/JSON 配置工具执行前后以及提示词提交时触发的拦截脚本。',
        icon: ArrowRightLeft,
        colorClasses: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    },
    deprecate_workflows: {
        key: 'deprecate_workflows',
        cliKey: 'deprecate-workflows',
        cliFlag: '--deprecate-workflows',
        badge: 'Migration',
        badgeZh: '平滑弃用',
        badgeEn: 'Migration',
        titleKey: 'settings.lab.deprecate_workflows_title',
        descKey: 'settings.lab.deprecate_workflows_desc',
        defaultTitle: 'Deprecate Legacy Workflows Engine',
        defaultDesc: 'Sunset monolithic workflows in favor of modular Customizations 2.0 skills, hooks, and automated background jobs.',
        titleZh: '弃用旧版 Workflows 转向插件体系',
        descZh: '逐步淘汰旧版单体 Workflows 逻辑，无缝迁移至 Customizations 2.0 插件与钩子体系。',
        icon: RotateCcw,
        colorClasses: 'text-red-500 bg-red-500/10 border-red-500/30',
    },

    // --- Group 4: Sidecar Micro-Frontend & UI Runtime ---
    enable_sidecars: {
        key: 'enable_sidecars',
        cliKey: 'enable-sidecars',
        cliFlag: '--enable-sidecars',
        badge: 'Sidecars',
        badgeZh: '微前端',
        badgeEn: 'Sidecars',
        titleKey: 'settings.lab.sidecars_title',
        descKey: 'settings.lab.sidecars_desc',
        defaultTitle: 'UI Sidecars Extension System',
        defaultDesc: 'Enables the embedded micro-frontend sidecar application extension runtime in Antigravity GUI.',
        titleZh: 'UI Sidecar 微前端扩展系统',
        descZh: '激活 Antigravity 桌面端内嵌的微前端沙箱运行环境，支持第三方可视化工具嵌入。',
        icon: Layers,
        colorClasses: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    },
    enable_ui_sidecars: {
        key: 'enable_ui_sidecars',
        cliKey: 'enable-ui-sidecars',
        cliFlag: '--enable-ui-sidecars',
        badge: 'Visuals',
        badgeZh: '视窗挂载',
        badgeEn: 'Visuals',
        titleKey: 'settings.lab.ui_sidecars_title',
        descKey: 'settings.lab.ui_sidecars_desc',
        defaultTitle: 'Pre-warmed Visual Sidecars',
        defaultDesc: 'Renders interactive visual iframe sidecars alongside conversation panels and dock layouts.',
        titleZh: '可视化 Iframe 边栏挂载',
        descZh: '在主聊天窗口旁挂载交互式可视化 Iframe 面板，与当前对话流双向同步。',
        icon: Layout,
        colorClasses: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    },
    enable_sidecar_sdk: {
        key: 'enable_sidecar_sdk',
        cliKey: 'enable-sidecar-sdk',
        cliFlag: '--enable-sidecar-sdk',
        badge: 'SDK',
        badgeZh: '开发接口',
        badgeEn: 'SDK',
        titleKey: 'settings.lab.sidecar_sdk_title',
        descKey: 'settings.lab.sidecar_sdk_desc',
        defaultTitle: 'Sidecar Developer SDK',
        defaultDesc: 'Exposes the internal sidecar SDK for building custom developer panels, monitors, and tools.',
        titleZh: 'Sidecar 开发者 SDK 运行时',
        descZh: '向内嵌侧边栏应用暴露官方 JavaScript SDK，用于读写会话上下文与调用宿主能力。',
        icon: Code2,
        colorClasses: 'text-violet-500 bg-violet-500/10 border-violet-500/30',
    },
    jetski_sidecar_declared_permissions: {
        key: 'jetski_sidecar_declared_permissions',
        cliKey: 'jetski-sidecar-declared-permissions',
        cliFlag: '--jetski-sidecar-declared-permissions',
        badge: 'Permissions',
        badgeZh: '权限契约',
        badgeEn: 'Permissions',
        titleKey: 'settings.lab.sidecar_declared_permissions_title',
        descKey: 'settings.lab.sidecar_declared_permissions_desc',
        defaultTitle: 'Sidecar Declared Permissions Enforcement',
        defaultDesc: 'Enforces strict manifest validation on sidecar API access (fs, network, clipboard, terminal) before mounting.',
        titleZh: 'Sidecar 声明式权限强校验',
        descZh: '在挂载微前端前严格校验其清单声明的系统权限（文件系统、网络、终端及剪贴板）。',
        icon: ShieldCheck,
        colorClasses: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    sidecar_gateway: {
        key: 'sidecar_gateway',
        cliKey: 'sidecar-gateway',
        cliFlag: '--sidecar-gateway',
        badge: 'Gateway',
        badgeZh: '网关通信',
        badgeEn: 'Gateway',
        titleKey: 'settings.lab.sidecar_gateway_title',
        descKey: 'settings.lab.sidecar_gateway_desc',
        defaultTitle: 'Sidecar Gateway Protocol',
        defaultDesc: 'Routes internal sidecar IPC, RPC, and websocket requests securely through the local gateway bridge.',
        titleZh: 'Sidecar 本地网关通信协议',
        descZh: '通过本地安全通道转发 Sidecar 容器内的 IPC、RPC 及 WebSocket 数据请求。',
        icon: Network,
        colorClasses: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    },
    sidecar_iframe_prewarm: {
        key: 'sidecar_iframe_prewarm',
        cliKey: 'sidecar-iframe-prewarm',
        cliFlag: '--sidecar-iframe-prewarm',
        badge: 'Prewarm',
        badgeZh: '容器预热',
        badgeEn: 'Prewarm',
        titleKey: 'settings.lab.sidecar_iframe_prewarm_title',
        descKey: 'settings.lab.sidecar_iframe_prewarm_desc',
        defaultTitle: 'Sidecar Iframe Prewarming',
        defaultDesc: 'Pre-warms iframe sandbox contexts in the background for zero-latency instant loading of sidecar UIs.',
        titleZh: 'Sidecar Iframe 后台瞬时预热',
        descZh: '在后台提前预加载沙箱上下文与 DOM 框架，实现打开微前端应用时的零延迟瞬启。',
        icon: RefreshCw,
        colorClasses: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    },

    // --- Group 5: DeepMind AGI Control & Security Guardrails ---
    enable_command_assessor: {
        key: 'enable_command_assessor',
        cliKey: 'enable-command-assessor',
        cliFlag: '--enable-command-assessor',
        badge: 'Risk Audit',
        badgeZh: '命令审计',
        badgeEn: 'Risk Audit',
        titleKey: 'settings.lab.command_assessor_title',
        descKey: 'settings.lab.command_assessor_desc',
        defaultTitle: 'DeepMind Command Risk Assessor',
        defaultDesc: 'Performs LLM-backed safety risk analysis on proposed terminal commands before they are queued for execution.',
        titleZh: 'DeepMind 终端命令风险评估',
        descZh: '在终端命令排队执行前，通过专用评估器进行安全风险判定，防止潜在的灾难性误操作。',
        icon: ShieldCheck,
        colorClasses: 'text-red-500 bg-red-500/10 border-red-500/30',
    },
    enable_command_antivirus: {
        key: 'enable_command_antivirus',
        cliKey: 'enable-command-antivirus',
        cliFlag: '--enable-command-antivirus',
        badge: 'Antivirus',
        badgeZh: '杀毒拦截',
        badgeEn: 'Antivirus',
        titleKey: 'settings.lab.enable_command_antivirus_title',
        descKey: 'settings.lab.enable_command_antivirus_desc',
        defaultTitle: 'Command Execution Antivirus Engine',
        defaultDesc: 'Intercepts and heuristically evaluates shell commands against known destructive patterns (recursive wipes, escapes).',
        titleZh: '命令执行启发式防毒拦截',
        descZh: '基于启发式签名库实时拦截高危 Shell 命令（如递归清空根目录、沙箱逃逸攻击等）。',
        icon: ShieldCheck,
        colorClasses: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
    },
    allow_experimental_monitors: {
        key: 'allow_experimental_monitors',
        cliKey: 'allow-experimental-monitors',
        cliFlag: '--allow-experimental-monitors',
        badge: 'Monitors',
        badgeZh: '深度监控',
        badgeEn: 'Monitors',
        titleKey: 'settings.lab.allow_experimental_monitors_title',
        descKey: 'settings.lab.allow_experimental_monitors_desc',
        defaultTitle: 'Experimental Process & Thread Monitors',
        defaultDesc: 'Grants permission to attach experimental deep telemetry monitors to spawned processes and child threads.',
        titleZh: '允许进程底层深度监控探针',
        descZh: '允许向子进程与执行线程挂载实验性监控探针，捕获死锁、资源耗尽及未捕获异常。',
        icon: Radio,
        colorClasses: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    },
    enable_citc_workspace_hygiene_rule: {
        key: 'enable_citc_workspace_hygiene_rule',
        cliKey: 'enable-citc-workspace-hygiene-rule',
        cliFlag: '--enable-citc-workspace-hygiene-rule',
        badge: 'Hygiene',
        badgeZh: '工作区整洁',
        badgeEn: 'Hygiene',
        titleKey: 'settings.lab.citc_workspace_hygiene_rule_title',
        descKey: 'settings.lab.citc_workspace_hygiene_rule_desc',
        defaultTitle: 'Workspace Hygiene & Cleanliness Rule',
        defaultDesc: 'Enforces strict monorepo cleanliness rules, forbidding uncommitted scratch artifacts from polluting checked-out worktrees.',
        titleZh: 'CITC 仓储整洁度守卫法则',
        descZh: '强制执行大仓整洁度规则，禁止智能体在非受管目录遗留临时碎片文件与未跟踪构建产物。',
        icon: CheckCheck,
        colorClasses: 'text-teal-500 bg-teal-500/10 border-teal-500/30',
    },
    disable_stained_loas2_creds: {
        key: 'disable_stained_loas2_creds',
        cliKey: 'disable-stained-loas2-creds',
        cliFlag: '--disable-stained-loas2-creds',
        badge: 'Internal',
        badgeZh: '凭据跳过',
        badgeEn: 'Internal',
        titleKey: 'settings.lab.disable_stained_loas2_creds_title',
        descKey: 'settings.lab.disable_stained_loas2_creds_desc',
        defaultTitle: 'Bypass Stained LOAS2 Credentials',
        defaultDesc: 'Bypasses Google corporate Low Overhead Authentication Service (LOAS2) credential checks leftover from internal builds.',
        titleZh: '跳过内部 LOAS2 身份验证凭据',
        descZh: '绕过 Google 内部低开销鉴权服务 (LOAS2) 的残留校验，确保公开测试环境无阻碍运行。',
        icon: KeyRound,
        colorClasses: 'text-yellow-600 bg-yellow-600/10 border-yellow-600/30',
    },
    enable_browser_subagent_v2: {
        key: 'enable_browser_subagent_v2',
        cliKey: 'enable-browser-subagent-v2',
        cliFlag: '--enable-browser-subagent-v2',
        badge: 'Browser',
        badgeZh: '浏览器沙箱',
        badgeEn: 'Browser',
        titleKey: 'settings.lab.enable_browser_subagent_v2_title',
        descKey: 'settings.lab.enable_browser_subagent_v2_desc',
        defaultTitle: 'Browser Subagent v2 (CDP Automation)',
        defaultDesc: 'Activates next-generation headless browser automation connecting directly via Chrome DevTools Protocol (CDP) for DOM tracing.',
        titleZh: 'CDP 协议浏览器自动化智能体 v2',
        descZh: '基于 Chrome DevTools Protocol 直连的无头浏览器沙箱，支持完整 DOM 树与网络拦截。',
        icon: Globe,
        colorClasses: 'text-sky-500 bg-sky-500/10 border-sky-500/30',
    },

    // --- Group 6: Terminal Engine & Execution Resilience ---
    enable_persistent_terminals: {
        key: 'enable_persistent_terminals',
        cliKey: 'enable-persistent-terminals',
        cliFlag: '--enable-persistent-terminals',
        badge: 'Terminal',
        badgeZh: '持久终端',
        badgeEn: 'Terminal',
        titleKey: 'settings.lab.enable_persistent_terminals_title',
        descKey: 'settings.lab.enable_persistent_terminals_desc',
        defaultTitle: 'Persistent Terminals & Sandbox',
        defaultDesc: 'Replaces one-off subshell processes with long-lived ConPTY pseudo-terminals that persist environment variables and background daemons.',
        titleZh: '跨轮次 ConPTY 长效终端',
        descZh: '以长效驻留的 ConPTY 伪终端取代单次子进程，跨会话保留环境变量、后台守护进程与工作目录。',
        icon: Terminal,
        colorClasses: 'text-lime-600 bg-lime-600/10 border-lime-600/30',
    },
    enable_pty: {
        key: 'enable_pty',
        cliKey: 'enable-pty',
        cliFlag: '--enable-pty',
        badge: 'ConPTY',
        badgeZh: '交互模拟',
        badgeEn: 'ConPTY',
        titleKey: 'settings.lab.pty_title',
        descKey: 'settings.lab.pty_desc',
        defaultTitle: 'ConPTY Emulation Engine',
        defaultDesc: 'Enables full Windows ConPTY terminal emulation for interactive terminal programs and curses-based tools.',
        titleZh: 'Windows ConPTY 终端仿真引擎',
        descZh: '提供完整的 Windows 伪控制台能力，支持交互式 CLI 程序、ANSI 彩色转义序列及全屏 TUI。',
        icon: Terminal,
        colorClasses: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
    },
    enable_ripgrep_path_search: {
        key: 'enable_ripgrep_path_search',
        cliKey: 'enable-ripgrep-path-search',
        cliFlag: '--enable-ripgrep-path-search',
        badge: 'Ripgrep',
        badgeZh: '极速索引',
        badgeEn: 'Ripgrep',
        titleKey: 'settings.lab.ripgrep_path_search_title',
        descKey: 'settings.lab.ripgrep_path_search_desc',
        defaultTitle: 'Ripgrep Fast File Indexing',
        defaultDesc: 'Accelerates file path and symbol lookups across large workspaces using an integrated high-performance ripgrep engine.',
        titleZh: 'Ripgrep 极速文件索引引擎',
        descZh: '集成高性能 ripgrep 原生库，大幅加速超大型代码库的文件路径查找与符号定位。',
        icon: Search,
        colorClasses: 'text-lime-500 bg-lime-500/10 border-lime-500/30',
    },
    enable_wait_tool: {
        key: 'enable_wait_tool',
        cliKey: 'enable-wait-tool',
        cliFlag: '--enable-wait-tool',
        badge: 'Wait Tool',
        badgeZh: '异步休眠',
        badgeEn: 'Wait Tool',
        titleKey: 'settings.lab.wait_tool_title',
        descKey: 'settings.lab.wait_tool_desc',
        defaultTitle: 'Native Agent Sleep & Wait Tool',
        defaultDesc: 'Equips agents with a non-blocking wait/timer tool for asynchronous polling, delays, and background tasks.',
        titleZh: '智能体非阻塞 Wait 工具',
        descZh: '为智能体提供非阻塞的精确休眠与定时等待工具，避免忙轮询并优化异步任务等待。',
        icon: Clock,
        colorClasses: 'text-sky-500 bg-sky-500/10 border-sky-500/30',
    },
    scheduled_tasks_v2: {
        key: 'scheduled_tasks_v2',
        cliKey: 'scheduled-tasks-v2',
        cliFlag: '--scheduled-tasks-v2',
        badge: 'Scheduler',
        badgeZh: '自动化调度',
        badgeEn: 'Scheduler',
        titleKey: 'settings.lab.scheduled_tasks_v2_title',
        descKey: 'settings.lab.scheduled_tasks_v2_desc',
        defaultTitle: 'Scheduled Automations Engine v2 (/schedule)',
        defaultDesc: 'Next-gen cron scheduling daemon for recurring agent jobs, one-shot timers, and proactive background triggers.',
        titleZh: '后台自动化定时任务引擎 v2 (/schedule)',
        descZh: '第二代 Cron 定时任务调度器，支持周期性任务循环、单次计时器与智能唤醒监听。',
        icon: Clock,
        colorClasses: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    },
    enable_model_capacity_exhausted_retries: {
        key: 'enable_model_capacity_exhausted_retries',
        cliKey: 'enable-model-capacity-exhausted-retries',
        cliFlag: '--enable-model-capacity-exhausted-retries',
        badge: 'Resilience',
        badgeZh: '容错重试',
        badgeEn: 'Resilience',
        titleKey: 'settings.lab.model_capacity_exhausted_retries_title',
        descKey: 'settings.lab.model_capacity_exhausted_retries_desc',
        defaultTitle: 'Model Capacity Exhaustion Auto-Retry',
        defaultDesc: 'Automatically retries transient Google upstream quota and model exhaustion errors with intelligent exponential backoff.',
        titleZh: '模型容量耗尽指数退避自动重试',
        descZh: '当上游遭遇临时配额耗尽或负载高峰时，执行智能指数退避重试，保障请求成功率。',
        icon: RefreshCw,
        colorClasses: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    enable_mcp_non_blocking_turn_load: {
        key: 'enable_mcp_non_blocking_turn_load',
        cliKey: 'enable-mcp-non-blocking-turn-load',
        cliFlag: '--enable-mcp-non-blocking-turn-load',
        badge: 'MCP Load',
        badgeZh: '异步协议',
        badgeEn: 'MCP Load',
        titleKey: 'settings.lab.mcp_non_blocking_turn_load_title',
        descKey: 'settings.lab.mcp_non_blocking_turn_load_desc',
        defaultTitle: 'Non-blocking MCP Turn Loading',
        defaultDesc: 'Loads Model Context Protocol (MCP) tool schemas asynchronously in the background without blocking conversation turns.',
        titleZh: '非阻塞 MCP 工具定义异步加载',
        descZh: '在后台异步拉取并解析 MCP 工具 Schema，彻底消除复杂 MCP 服务导致的界面卡顿。',
        icon: Boxes,
        colorClasses: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    },
    enable_remote_agent_fastpush_pin: {
        key: 'enable_remote_agent_fastpush_pin',
        cliKey: 'enable-remote-agent-fastpush-pin',
        cliFlag: '--enable-remote-agent-fastpush-pin',
        badge: 'Mesh',
        badgeZh: '网状互联',
        badgeEn: 'Mesh',
        titleKey: 'settings.lab.remote_agent_fastpush_pin_title',
        descKey: 'settings.lab.remote_agent_fastpush_pin_desc',
        defaultTitle: 'Agent Mesh Peer Fastpush Pin',
        defaultDesc: 'Synchronizes agent tasks, checkpoint pins, and distributed worker state across remote developer machines.',
        titleZh: '远端智能体网状互联与快照 Pin 标记',
        descZh: '在多台开发机与远端智能体集群之间极速同步关键执行状态、检查点及 Pin 标记。',
        icon: Share2,
        colorClasses: 'text-teal-500 bg-teal-500/10 border-teal-500/30',
    },

    // --- Group 7: Cortex State, Direct Planning & Trajectory Engine ---
    cortex_snapshot_recording: {
        key: 'cortex_snapshot_recording',
        cliKey: 'cortex-snapshot-recording',
        cliFlag: '--cortex-snapshot-recording',
        badge: 'Snapshots',
        badgeZh: '快照录制',
        badgeEn: 'Snapshots',
        titleKey: 'settings.lab.cortex_snapshot_recording_title',
        descKey: 'settings.lab.cortex_snapshot_recording_desc',
        defaultTitle: 'Cortex Workspace Snapshot Recorder',
        defaultDesc: 'Continuously records workspace filesystem and conversation state snapshots for zero-loss time-travel inspection.',
        titleZh: 'Cortex 工作区时光机快照录制',
        descZh: '持续对文件系统变更与对话轨迹打标录制快照，为回退还原与时光机溯源提供数据底座。',
        icon: History,
        colorClasses: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
    },
    cortex_snapshot_revert: {
        key: 'cortex_snapshot_revert',
        cliKey: 'cortex-snapshot-revert',
        cliFlag: '--cortex-snapshot-revert',
        badge: 'Revert',
        badgeZh: '快照回滚',
        badgeEn: 'Revert',
        titleKey: 'settings.lab.cortex_snapshot_revert_title',
        descKey: 'settings.lab.cortex_snapshot_revert_desc',
        defaultTitle: 'Cortex Trajectory State Revert',
        defaultDesc: 'Enables rolling back conversation trajectories and file states to previous snapshots with precise undo/redo fidelity.',
        titleZh: 'Cortex 轨迹与文件状态回滚还原',
        descZh: '支持将文件系统和对话轨迹精准回滚到任意历史快照点，实现零损失的状态撤销与重试。',
        icon: RotateCcw,
        colorClasses: 'text-rose-400 bg-rose-400/10 border-rose-400/30',
    },
    enable_conversation_search_v2: {
        key: 'enable_conversation_search_v2',
        cliKey: 'enable-conversation-search-v2',
        cliFlag: '--enable-conversation-search-v2',
        badge: 'Search',
        badgeZh: '语义搜索',
        badgeEn: 'Search',
        titleKey: 'settings.lab.conversation_search_v2_title',
        descKey: 'settings.lab.conversation_search_v2_desc',
        defaultTitle: 'Semantic Conversation Search v2',
        defaultDesc: 'Enables semantic trajectory vector indexing and instant search across past multi-turn sessions.',
        titleZh: '历史会话向量语义检索 v2',
        descZh: '基于向量索引对过往全部多轮对话轨迹进行语义级检索，秒级回溯曾讨论过的技术决策。',
        icon: Search,
        colorClasses: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
    },
    show_model_selection_change: {
        key: 'show_model_selection_change',
        cliKey: 'show-model-selection-change',
        cliFlag: '--show-model-selection-change',
        badge: 'Feedback',
        badgeZh: '切换指示',
        badgeEn: 'Feedback',
        titleKey: 'settings.lab.show_model_selection_change_title',
        descKey: 'settings.lab.show_model_selection_change_desc',
        defaultTitle: 'Model Switching Status Feedback',
        defaultDesc: 'Shows visual notifications and inline indicators in the chat header when the model dynamically adapts or switches.',
        titleZh: '模型动态自适应切换视觉反馈',
        descZh: '当系统在模型间自动切换或自适应调整参数时，在聊天顶部显示醒目的视觉切换通知。',
        icon: Sparkles,
        colorClasses: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    },
    use_component_rewrite: {
        key: 'use_component_rewrite',
        cliKey: 'use-component-rewrite',
        cliFlag: '--use-component-rewrite',
        badge: 'AST Rewrite',
        badgeZh: '组件重写',
        badgeEn: 'AST Rewrite',
        titleKey: 'settings.lab.use_component_rewrite_title',
        descKey: 'settings.lab.use_component_rewrite_desc',
        defaultTitle: 'Component Rewrite AST Engine',
        defaultDesc: 'Employs AST-aware component rewriters for intelligent surgical code updates instead of destructive overwrite replacements.',
        titleZh: 'AST 语法树感知组件精细重写',
        descZh: '采用 AST 级别的组件微重写引擎，替代大面积文件粗暴覆盖，确保高精度的外科手术式补丁。',
        icon: Code2,
        colorClasses: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    },
    use_core_direct: {
        key: 'use_core_direct',
        cliKey: 'use-core-direct',
        cliFlag: '--use-core-direct',
        badge: 'Core Direct',
        badgeZh: '直通内核',
        badgeEn: 'Core Direct',
        titleKey: 'settings.lab.use_core_direct_title',
        descKey: 'settings.lab.use_core_direct_desc',
        defaultTitle: 'Direct Core Dispatch Pipeline',
        defaultDesc: 'Bypasses intermediate abstraction layers to route tool executions directly to native C++ / Rust core handlers.',
        titleZh: '原生 C++/Rust 直通执行管线',
        descZh: '绕过中间包装层，将高频工具调用直接分发到底层本地原生引擎，极致降低端到端延迟。',
        icon: Cpu,
        colorClasses: 'text-violet-500 bg-violet-500/10 border-violet-500/30',
    },
    use_slash_plan: {
        key: 'use_slash_plan',
        cliKey: 'use-slash-plan',
        cliFlag: '--use-slash-plan',
        badge: 'Planning',
        badgeZh: '交互规划',
        badgeEn: 'Planning',
        titleKey: 'settings.lab.use_slash_plan_title',
        descKey: 'settings.lab.use_slash_plan_desc',
        defaultTitle: 'Interactive Plan Mode (/plan & /grill-me)',
        defaultDesc: 'Enables dedicated step-by-step planning and interactive design interview workflows before modifying codebase files.',
        titleZh: '分步交互规划模式 (/plan & /grill-me)',
        descZh: '激活严格的分步计划制定与对齐访谈模式，在动笔修改代码前与用户充分论证架构决策。',
        icon: FileCode,
        colorClasses: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    enable_voice_activity_events: {
        key: 'enable_voice_activity_events',
        cliKey: 'enable-voice-activity-events',
        cliFlag: '--enable-voice-activity-events',
        badge: 'Voice',
        badgeZh: '语音流式',
        badgeEn: 'Voice',
        titleKey: 'settings.lab.enable_voice_activity_events_title',
        descKey: 'settings.lab.enable_voice_activity_events_desc',
        defaultTitle: 'Voice Activity Events & Streamer (/voice)',
        defaultDesc: 'Activates built-in voice event triggers and audio streamer daemon support for broadcasting host microphones to remote sessions.',
        titleZh: '语音活动事件与麦克风流式守护 (/voice)',
        descZh: '激活语音活动事件监听与内置音频流服务守护进程，支持麦克风推流到远程 CLI 会话。',
        icon: Mic,
        colorClasses: 'text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/30',
    },
    cascade_enable_notebook_edit_tool: {
        key: 'cascade_enable_notebook_edit_tool',
        cliKey: 'cascade-enable-notebook-edit-tool',
        cliFlag: '--cascade-enable-notebook-edit-tool',
        badge: 'Notebook',
        badgeZh: 'Jupyter 单元',
        badgeEn: 'Notebook',
        titleKey: 'settings.lab.cascade_enable_notebook_edit_tool_title',
        descKey: 'settings.lab.cascade_enable_notebook_edit_tool_desc',
        defaultTitle: 'Native Jupyter Notebook Editing',
        defaultDesc: 'Allows direct cell-level inspection, execution, and manipulation of .ipynb notebooks without converting to raw JSON.',
        titleZh: '原生 Jupyter Notebook 单元级编辑',
        descZh: '支持在不破坏原始 JSON 结构的前提下，对 .ipynb 笔记本的独立 Cell 单元执行增删改查。',
        icon: FileCode,
        colorClasses: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    },
    cascade_use_sed_edit_tool: {
        key: 'cascade_use_sed_edit_tool',
        cliKey: 'cascade-use-sed-edit-tool',
        cliFlag: '--cascade-use-sed-edit-tool',
        badge: 'Sed Stream',
        badgeZh: '正则流式',
        badgeEn: 'Sed Stream',
        titleKey: 'settings.lab.cascade_use_sed_edit_tool_title',
        descKey: 'settings.lab.cascade_use_sed_edit_tool_desc',
        defaultTitle: 'Native Sed Stream Regex Editing',
        defaultDesc: 'Provides a built-in line-oriented regex stream editing tool directly in the language server for rapid batch updates.',
        titleZh: '原生 Sed 正则流式快速替换',
        descZh: '语言服务器内建的高性能面向行正则流式编辑工具，适合批量重命名与模式替换。',
        icon: Code2,
        colorClasses: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    },
};

// -----------------------------------------------------------------------------
// 7 Cohesive Paired Groups Definition
// -----------------------------------------------------------------------------

export const LAB_GROUPS: LabFeatureGroup[] = [
    {
        id: 'group_multi_agent_swarm',
        title: 'Group 1: Multi-Agent & Swarm Orchestration',
        titleZh: '第 1 组：多智能体与蜂群编排 (Multi-Agent & Swarm)',
        desc: 'Orchestration loops, subagent telemetry, autonomous decision branching, and native image generation subagents.',
        descZh: '自主智能体编排、协作模型继承、蜂群实时遥测、子工作树分叉及原生视觉生成子智能体。',
        badge: 'Swarm Core',
        badgeZh: '蜂群核心',
        icon: Bot,
        colorClasses: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
        pairs: [
            {
                pairId: 'g1_p1',
                keys: ['jetski_autonomous_mode', 'disable_teamwork_forced_flash_model'],
            },
            {
                pairId: 'g1_p2',
                keys: ['enable_subagent_hub', 'enable_swarm_monitor'],
            },
            {
                pairId: 'g1_p3',
                keys: ['enable_fork_with_subagents', 'send_subagent_initial_prompt_as_message'],
            },
            {
                pairId: 'g1_p4',
                keys: ['enable_swarm_narrator', 'enable_image_generator_subagent'],
            },
        ],
    },
    {
        id: 'group_deep_exploration_arena',
        title: 'Group 2: Deep Exploration & Adversarial Arena (Slash Commands)',
        titleZh: '第 2 组：深度探索与竞技对抗 (Deep Exploration & Arena)',
        desc: 'Codebase synthesis via /owl, trajectory compaction via /compact, Colosseum duel benchmarks, and Generative UI widgets.',
        descZh: '深度架构探究 (/owl)、历史轨迹压缩 (/compact)、角斗场双模型辩论 (/battle) 与生成式交互组件。',
        badge: 'Slash & Arena',
        badgeZh: '指令与竞技',
        icon: Swords,
        colorClasses: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
        pairs: [
            {
                pairId: 'g2_p1',
                keys: ['enable_owl_slash_command', 'enable_compact_slash_command'],
            },
            {
                pairId: 'g2_p2',
                keys: ['enable_battle_mode', 'enable_battle_mode_custom_agents'],
            },
            {
                pairId: 'g2_p3',
                keys: ['enable_programmatic_tools', 'jetski_generative_ui'],
            },
            {
                pairId: 'g2_p4',
                keys: ['enable_deepagent', 'enable_review'],
            },
        ],
    },
    {
        id: 'group_customizations_plugins',
        title: 'Group 3: Customizations 2.0 & Plugin Ecosystem',
        titleZh: '第 3 组：定制化 2.0 与插件生态 (Customizations & Plugins)',
        desc: 'Modular plugin packages, lifecycle hook inspectors, discrete agent/skill/rule/MCP kinds, and workflow deprecation.',
        descZh: '模块化统一插件架构、生命周期钩子监控 (/hooks)、细粒度扩展类型及传统单体工作流平滑迁移。',
        badge: 'Plugins & Ext',
        badgeZh: '插件与扩展',
        icon: Boxes,
        colorClasses: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
        pairs: [
            {
                pairId: 'g3_p1',
                keys: ['enable_plugins', 'enable_hook_status'],
            },
            {
                pairId: 'g3_p2',
                keys: ['enable_customization_kind_agent', 'enable_customization_kind_skill'],
            },
            {
                pairId: 'g3_p3',
                keys: ['enable_customization_kind_rule', 'enable_customization_kind_mcp'],
            },
            {
                pairId: 'g3_p4',
                keys: ['enable_customization_kind_hooks', 'deprecate_workflows'],
            },
        ],
    },
    {
        id: 'group_sidecars_runtime',
        title: 'Group 4: Sidecar Micro-Frontend & UI Runtime',
        titleZh: '第 4 组：微前端 Sidecar 与界面运行时 (Sidecars & UI Runtime)',
        desc: 'Embedded iframe sandboxes, Developer SDK, manifest declared permissions, local gateway routing, and background prewarming.',
        descZh: '内嵌微前端沙箱、Sidecar 开发者 SDK、声明式权限契约校验、本地通信网关与瞬时预热。',
        badge: 'Micro-Frontend',
        badgeZh: '微前端',
        icon: Layers,
        colorClasses: 'text-violet-500 bg-violet-500/10 border-violet-500/30',
        pairs: [
            {
                pairId: 'g4_p1',
                keys: ['enable_sidecars', 'enable_ui_sidecars'],
            },
            {
                pairId: 'g4_p2',
                keys: ['enable_sidecar_sdk', 'jetski_sidecar_declared_permissions'],
            },
            {
                pairId: 'g4_p3',
                keys: ['sidecar_gateway', 'sidecar_iframe_prewarm'],
            },
        ],
    },
    {
        id: 'group_deepmind_safety_guardrails',
        title: 'Group 5: DeepMind AGI Control & Security Guardrails',
        titleZh: '第 5 组：AGI 控制与安全防御 (AGI Control & Guardrails)',
        desc: 'LLM command risk assessment, antivirus heuristic blockers, monorepo hygiene, LOAS2 bypass, and CDP browser subagents.',
        descZh: 'DeepMind 终端命令风险评估、启发式杀毒引擎、CITC 大仓整洁度规则、内部凭据跳过与 CDP 浏览器沙箱。',
        badge: 'Safety & Guardrails',
        badgeZh: '安全防护',
        icon: ShieldCheck,
        colorClasses: 'text-red-500 bg-red-500/10 border-red-500/30',
        pairs: [
            {
                pairId: 'g5_p1',
                keys: ['enable_command_assessor', 'enable_command_antivirus'],
            },
            {
                pairId: 'g5_p2',
                keys: ['allow_experimental_monitors', 'enable_citc_workspace_hygiene_rule'],
            },
            {
                pairId: 'g5_p3',
                keys: ['disable_stained_loas2_creds', 'enable_browser_subagent_v2'],
            },
        ],
    },
    {
        id: 'group_terminal_resilience',
        title: 'Group 6: Terminal Engine & Execution Resilience',
        titleZh: '第 6 组：终端引擎与执行韧性 (Terminal & Resilience)',
        desc: 'Persistent ConPTY terminals, integrated ripgrep indexing, non-blocking wait tools, scheduled tasks v2, and auto-retries.',
        descZh: '长效 ConPTY 伪终端沙箱、ripgrep 极速文件索引、异步 Wait 工具、定时任务调度器与配额耗尽自动退避。',
        badge: 'Terminal & Resilience',
        badgeZh: '终端与韧性',
        icon: Terminal,
        colorClasses: 'text-lime-600 bg-lime-600/10 border-lime-600/30',
        pairs: [
            {
                pairId: 'g6_p1',
                keys: ['enable_persistent_terminals', 'enable_pty'],
            },
            {
                pairId: 'g6_p2',
                keys: ['enable_ripgrep_path_search', 'enable_wait_tool'],
            },
            {
                pairId: 'g6_p3',
                keys: ['scheduled_tasks_v2', 'enable_model_capacity_exhausted_retries'],
            },
            {
                pairId: 'g6_p4',
                keys: ['enable_mcp_non_blocking_turn_load', 'enable_remote_agent_fastpush_pin'],
            },
        ],
    },
    {
        id: 'group_cortex_planning_trajectory',
        title: 'Group 7: Cortex State, Direct Planning & Trajectory Engine',
        titleZh: '第 7 组：Cortex 状态、规划与轨迹引擎 (Cortex & Trajectory)',
        desc: 'Time-travel filesystem snapshots, semantic trajectory search, component AST rewrites, interactive plan modes, and notebook editing.',
        descZh: '工作区时光机快照回滚、历史轨迹向量语义检索、Direct 直通执行内核、分步规划模式与 Jupyter 单元编辑。',
        badge: 'Cortex & Trajectory',
        badgeZh: '状态与轨迹',
        icon: History,
        colorClasses: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
        pairs: [
            {
                pairId: 'g7_p1',
                keys: ['cortex_snapshot_recording', 'cortex_snapshot_revert'],
            },
            {
                pairId: 'g7_p2',
                keys: ['enable_conversation_search_v2', 'show_model_selection_change'],
            },
            {
                pairId: 'g7_p3',
                keys: ['use_component_rewrite', 'use_core_direct'],
            },
            {
                pairId: 'g7_p4',
                keys: ['use_slash_plan', 'enable_voice_activity_events'],
            },
            {
                pairId: 'g7_p5',
                keys: ['cascade_enable_notebook_edit_tool', 'cascade_use_sed_edit_tool'],
            },
        ],
    },
];

// Flat export of all 54 items in canonical order
export const FEATURE_KEYS: LabExperimentItem[] = LAB_GROUPS.flatMap((group) =>
    group.pairs.flatMap((pair) => [FEATURE_DICT[pair.keys[0]], FEATURE_DICT[pair.keys[1]]])
);

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
        result = result.filter((arg) => {
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

// -----------------------------------------------------------------------------
// Component Implementation
// -----------------------------------------------------------------------------

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
    const [isCheatsheetExpanded, setIsCheatsheetExpanded] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [autoSyncArgs, setAutoSyncArgs] = useState<boolean>(() => {
        const saved = localStorage.getItem('antigravity_lab_auto_sync_args');
        return saved !== 'false';
    });

    const activeCount = FEATURE_KEYS.filter((item) => currentConfig[item.key]).length;

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

    const handleToggleGroup = (group: LabFeatureGroup, enabled: boolean) => {
        const nextConfig: AntigravityLabConfig = { ...currentConfig };
        for (const pair of group.pairs) {
            nextConfig[pair.keys[0]] = enabled;
            nextConfig[pair.keys[1]] = enabled;
        }
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
            showToast(
                t('settings.lab.sync_startup_args_success', {
                    defaultValue: isZh ? '启动参数已自动更新以同步实验性特性。' : 'Startup arguments updated to match active lab flags.',
                }),
                'success'
            );
        }
    };

    const handleManualSyncStartupArgs = () => {
        if (onArgsChange) {
            const nextArgs = syncArgsWithLabConfig(antigravityArgs, currentConfig);
            onArgsChange(nextArgs);
            showToast(
                t('settings.lab.sync_startup_args_success', {
                    defaultValue: isZh ? '启动参数已应用实验性特性。' : 'Startup arguments updated to match active lab flags.',
                }),
                'success'
            );
        }
    };

    const handleSyncCli = async () => {
        setIsSyncingCli(true);
        try {
            await request('sync_cli_experiments', { experiments: currentConfig });
            showToast(
                t('settings.lab.sync_cli_success', {
                    defaultValue: isZh
                        ? '已成功同步实验性特性到 CLI 配置 (~/.gemini/antigravity-cli/settings.json)'
                        : 'Successfully synced experimental features to CLI settings (~/.gemini/antigravity-cli/settings.json)',
                }),
                'success'
            );
        } catch (error) {
            console.error('Failed to sync to CLI settings:', error);
            showToast(
                `${t('settings.lab.sync_cli_error', { defaultValue: isZh ? '同步到 CLI 失败' : 'Failed to sync to CLI settings' })}: ${error}`,
                'error'
            );
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
                showToast(
                    t('settings.lab.load_cli_success', {
                        defaultValue: isZh ? '已从 CLI 配置成功拉取实验性特性' : 'Successfully loaded experimental features from CLI settings',
                    }),
                    'success'
                );
            }
        } catch (error) {
            console.error('Failed to load CLI settings:', error);
            showToast(
                `${t('settings.lab.load_cli_error', { defaultValue: isZh ? '从 CLI 加载失败' : 'Failed to load CLI settings' })}: ${error}`,
                'error'
            );
        } finally {
            setIsLoadingCli(false);
        }
    };

    const renderItemCard = (item: LabExperimentItem) => {
        const isEnabled = !!currentConfig[item.key];
        const IconComponent = item.icon;
        const badgeText = isZh ? (item.badgeZh || item.badge) : (item.badgeEn || item.badge);
        const titleText = t(item.titleKey, {
            defaultValue: isZh ? (item.titleZh || item.defaultTitle) : item.defaultTitle,
        });
        const descText = t(item.descKey, {
            defaultValue: isZh ? (item.descZh || item.defaultDesc) : item.defaultDesc,
        });

        return (
            <div
                key={item.key}
                className={`p-3 rounded-lg border transition-all duration-200 flex items-start justify-between gap-3 ${
                    isEnabled
                        ? 'bg-purple-50/40 dark:bg-purple-950/25 border-purple-300/80 dark:border-purple-800/60 shadow-xs'
                        : 'bg-white/70 dark:bg-base-100/70 border-base-200 dark:border-base-300/60 hover:border-purple-200 dark:hover:border-purple-900/40'
                }`}
            >
                <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`p-2 rounded-lg border mt-0.5 shrink-0 ${item.colorClasses}`}>
                        <IconComponent size={15} />
                    </div>
                    <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-xs text-gray-900 dark:text-gray-100">
                                {titleText}
                            </span>
                            {badgeText && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-purple-100/70 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40 shrink-0">
                                    {badgeText}
                                </span>
                            )}
                            <code className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-base-200 dark:bg-base-300 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40 shrink-0">
                                {item.cliFlag}
                            </code>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                            {descText}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    <span
                        className={`text-[11px] font-medium hidden sm:inline ${
                            isEnabled ? 'text-purple-600 dark:text-purple-400 font-semibold' : 'text-gray-400'
                        }`}
                    >
                        {isEnabled
                            ? t('common.enabled', { defaultValue: isZh ? '已开启' : 'Enabled' })
                            : t('common.disabled', { defaultValue: isZh ? '已关闭' : 'Disabled' })}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) => handleToggle(item.key, e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-gray-600 peer-checked:bg-purple-600"></div>
                    </label>
                </div>
            </div>
        );
    };

    // Filter items according to search query
    const normalizedQuery = searchQuery.trim().toLowerCase();

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
                                {t('settings.lab.title', { defaultValue: isZh ? 'Antigravity Lab (实验性特性 7 组矩阵)' : 'Antigravity Lab (7 Experimental Feature Groups)' })}
                            </h4>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800/40 flex items-center gap-1">
                                <span>🧪</span>
                                {t('settings.lab.badge', { defaultValue: 'Experimental Lab' })}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-base-200 dark:bg-base-300 text-base-content/70 font-mono">
                                {activeCount} / {FEATURE_KEYS.length} Active
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-200/50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 font-mono">
                                7 Groups / 27 Pairs
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-3xl">
                            {t('settings.lab.desc', {
                                defaultValue: isZh
                                    ? '按功能编排的 7 大核心实验性特性组（共 54 项开关）。支持与桌面端启动参数及 CLI 配置文件 (~/.gemini/antigravity-cli/settings.json) 双向无缝同步。'
                                    : 'Configure cutting-edge experimental features for Antigravity engine and CLI, organized into 7 cohesive paired groups. Flags sync dynamically with CLI configurations and desktop startup arguments.',
                            })}
                        </p>
                    </div>
                </div>

                {/* Header Action Buttons & Search */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap">
                    <button
                        type="button"
                        onClick={handleEnableAll}
                        className="btn btn-xs rounded-none border border-base-content/30 text-base-content font-bold uppercase tracking-wider hover:bg-base-content hover:text-base-100 flex items-center gap-1"
                        title={t('settings.lab.enable_all', { defaultValue: isZh ? '开启全部' : 'Enable All' })}
                    >
                        <CheckCheck size={12} />
                        {t('settings.lab.enable_all', { defaultValue: isZh ? '开启全部' : 'Enable All' })}
                    </button>
                    <button
                        type="button"
                        onClick={handleDisableAll}
                        className="btn btn-xs rounded-none border border-base-content/30 text-base-content font-bold uppercase tracking-wider hover:bg-base-content hover:text-base-100 flex items-center gap-1"
                        title={t('settings.lab.disable_all', { defaultValue: isZh ? '关闭全部' : 'Disable All' })}
                    >
                        <XCircle size={12} />
                        {t('settings.lab.disable_all', { defaultValue: isZh ? '关闭全部' : 'Disable All' })}
                    </button>
                </div>
            </div>

            {/* Quick Slash Commands Cheatsheet */}
            <div className="bg-purple-100/40 dark:bg-purple-900/20 border border-purple-200/50 dark:border-purple-800/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => setIsCheatsheetExpanded(!isCheatsheetExpanded)}
                        className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5 hover:text-purple-700 transition-colors"
                    >
                        <Terminal size={13} className="text-purple-600 dark:text-purple-400" />
                        <span>
                            {isZh ? '快捷斜杠指令集 (CLI Builtin & Dynamic Slash Commands)' : 'CLI Builtin & Dynamic Slash Commands'}
                        </span>
                        {isCheatsheetExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    <span className="text-[10px] text-purple-700 dark:text-purple-300 font-mono hidden sm:inline">
                        ~/.gemini/config/skills/ & builtins
                    </span>
                </div>

                {isCheatsheetExpanded && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 text-xs pt-1">
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/owl &lt;task&gt;</div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isZh ? '深度架构探究与代码合成 (DeepInvestigator + DeepCoder)' : 'Deep architectural synthesis & investigation (Pro tier)'}
                            </div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="font-mono font-bold text-amber-600 dark:text-amber-400">/battle &lt;task&gt;</div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isZh ? '角斗场对抗竞技：双智能体辩论与基准测速' : 'Colosseum arena duel: 2 rival agents debate & benchmark'}
                            </div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">/swarm &lt;task&gt;</div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isZh ? '蜂群枢纽免确认全自主多智能体团队开发' : 'Autonomous multi-agent swarm building hands-free'}
                            </div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="font-mono font-bold text-blue-600 dark:text-blue-400">/benchmark &lt;task&gt;</div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isZh ? '编程式动态工具合成：自动化压测与帧率分析' : 'Programmatic tool synthesis & performance profiling'}
                            </div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="font-mono font-bold text-pink-600 dark:text-pink-400">/generative_ui &lt;task&gt;</div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isZh ? '生成式交互 UI：在对话 Artifact 中嵌入可玩控件' : 'Interactive UI widgets rendered directly inside artifacts'}
                            </div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="font-mono font-bold text-violet-600 dark:text-violet-400">/compact</div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isZh ? '压缩修剪对话历史轨迹以释放上下文窗口' : 'Prune and compact trajectory context window cleanly'}
                            </div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="font-mono font-bold text-cyan-600 dark:text-cyan-400">/btw &lt;query&gt;</div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isZh ? '旁白速问：不污染主会话上下文 (/copy btw 快速复制)' : 'Quick aside query without polluting task context (/copy btw)'}
                            </div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">/effort &lt;level&gt;</div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isZh ? '思考预算调节：动态设定 low / medium / high 深度' : 'Adjust thinking effort budget dynamically (low/med/high)'}
                            </div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="font-mono font-bold text-teal-600 dark:text-teal-400">/remote-control</div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isZh ? '远程控制：CLI 会话配对、移动端流式与接管' : 'Remote CLI pairing, mobile streaming & session handover'}
                            </div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="font-mono font-bold text-fuchsia-600 dark:text-fuchsia-400">/voice</div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isZh ? '语音交互：实时麦克风收音广播与语音活动事件' : 'Push-to-talk voice input & mic-serve streaming daemon'}
                            </div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="font-mono font-bold text-orange-600 dark:text-orange-400">/diff</div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isZh ? '代码差异：带搜索、代码块折叠与暂存的可视化 Diff' : 'Interactive git diff viewer with search, hunk folding & staging'}
                            </div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="font-mono font-bold text-sky-600 dark:text-sky-400">/plugin &lt;cmd&gt;</div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isZh ? '插件生态：统一管理技能、智能体、规则与 MCP 工具包' : 'Manage Customizations 2.0 plugins (list, install, toggle)'}
                            </div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5 sm:col-span-2 lg:col-span-1 xl:col-span-1">
                            <div className="font-mono font-bold text-rose-600 dark:text-rose-400">/hooks</div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isZh ? '钩子状态：查看生命周期事件拦截器与运行日志' : 'Inspect lifecycle hooks, event triggers & health status'}
                            </div>
                        </div>
                    </div>
                )}
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
                                {t('settings.lab.auto_sync_args', { defaultValue: isZh ? '自动同步至启动参数 (antigravity_args)' : 'Auto-sync with Startup Arguments (antigravity_args)' })}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {t('settings.lab.auto_sync_args_desc', {
                                    defaultValue: isZh
                                        ? '启用后，激活的实验性特性将自动镜像为桌面 IDE 启动参数（如 --jetski-autonomous-mode=true），随程序启动生效。'
                                        : 'When enabled, active flags are automatically mirrored in Desktop IDE startup arguments (e.g. --jetski-autonomous-mode=true) so the desktop client receives them on startup.',
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
                            {t('settings.lab.sync_startup_args_btn', { defaultValue: isZh ? '应用到启动参数' : 'Apply to Startup Args' })}
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
                                ? t('settings.lab.loading_cli', { defaultValue: isZh ? '正在拉取...' : 'Loading...' })
                                : t('settings.lab.load_cli_btn', { defaultValue: isZh ? '从 CLI 拉取' : 'Fetch from CLI' })}
                        </button>
                        <button
                            type="button"
                            onClick={handleSyncCli}
                            disabled={isSyncingCli}
                            className="btn btn-xs btn-primary rounded-none font-bold uppercase tracking-wider flex items-center gap-1.5"
                        >
                            <Share2 size={12} className={isSyncingCli ? 'animate-spin' : ''} />
                            {isSyncingCli
                                ? t('settings.lab.syncing_cli', { defaultValue: isZh ? '正在同步...' : 'Syncing...' })
                                : t('settings.lab.sync_cli_btn', { defaultValue: isZh ? '同步至 CLI 设置' : 'Sync to CLI Settings' })}
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. Search & Filter Bar */}
            <div className="flex items-center gap-2 px-1">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={isZh ? '搜索实验性特性名称、参数或分类...' : 'Search flags by title, CLI flag, or badge...'}
                        className="input input-sm input-bordered w-full pl-9 pr-8 text-xs bg-base-100/80 dark:bg-base-200/60 rounded-lg focus:border-purple-500"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* 4. The 7 Paired Feature Groups */}
            <div className="space-y-4">
                {LAB_GROUPS.map((group) => {
                    const GroupIcon = group.icon;

                    // Filter pairs based on search query
                    const filteredPairs = group.pairs.filter((pair) => {
                        if (!normalizedQuery) return true;
                        const itemA = FEATURE_DICT[pair.keys[0]];
                        const itemB = FEATURE_DICT[pair.keys[1]];

                        const matchesItem = (item: LabExperimentItem) => {
                            const text = `${item.defaultTitle} ${item.titleZh || ''} ${item.defaultDesc} ${item.descZh || ''} ${item.cliFlag} ${item.badge} ${item.badgeZh || ''}`.toLowerCase();
                            return text.includes(normalizedQuery);
                        };

                        return matchesItem(itemA) || matchesItem(itemB);
                    });

                    if (filteredPairs.length === 0) {
                        return null;
                    }

                    const allGroupKeys = group.pairs.flatMap((p) => [p.keys[0], p.keys[1]]);
                    const groupActiveCount = allGroupKeys.filter((k) => currentConfig[k]).length;
                    const groupTotalCount = allGroupKeys.length;

                    return (
                        <div
                            key={group.id}
                            className="border border-purple-200/60 dark:border-purple-900/40 bg-purple-50/20 dark:bg-purple-950/15 rounded-xl p-3.5 sm:p-4 space-y-3"
                        >
                            {/* Group Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-purple-100 dark:border-purple-900/30">
                                <div className="flex items-start gap-2.5">
                                    <div className={`p-2 rounded-lg border shrink-0 ${group.colorClasses}`}>
                                        <GroupIcon size={17} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h5 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                                                {isZh ? group.titleZh : group.title}
                                            </h5>
                                            <span className="text-[10px] px-2 py-0.2 rounded-full font-semibold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                                                {isZh ? group.badgeZh : group.badge}
                                            </span>
                                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-base-200 dark:bg-base-300 text-base-content/70">
                                                {groupActiveCount} / {groupTotalCount} Active
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                            {isZh ? group.descZh : group.desc}
                                        </p>
                                    </div>
                                </div>

                                {/* Group Quick Controls */}
                                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                    <button
                                        type="button"
                                        onClick={() => handleToggleGroup(group, true)}
                                        className="btn btn-xs rounded-none border border-base-content/20 text-base-content hover:bg-base-content hover:text-base-100 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 flex items-center gap-1"
                                        title={isZh ? '开启该组全部特性' : 'Enable all flags in this group'}
                                    >
                                        <Check size={11} />
                                        {isZh ? '全开' : 'All On'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleToggleGroup(group, false)}
                                        className="btn btn-xs rounded-none border border-base-content/20 text-base-content hover:bg-base-content hover:text-base-100 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 flex items-center gap-1"
                                        title={isZh ? '关闭该组全部特性' : 'Disable all flags in this group'}
                                    >
                                        <XCircle size={11} />
                                        {isZh ? '全关' : 'All Off'}
                                    </button>
                                </div>
                            </div>

                            {/* Responsive 2-column paired grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {filteredPairs.map((pair, pIdx) => {
                                    const itemA = FEATURE_DICT[pair.keys[0]];
                                    const itemB = FEATURE_DICT[pair.keys[1]];

                                    return (
                                        <Fragment key={`${pair.pairId}-${pIdx}`}>
                                            {renderItemCard(itemA)}
                                            {renderItemCard(itemB)}
                                        </Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
