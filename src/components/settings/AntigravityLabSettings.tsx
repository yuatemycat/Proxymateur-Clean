import { useState, useEffect, Fragment } from 'react';
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
    ListOrdered,
    Send,
    Trash2,
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
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.jetski_autonomous_mode_title',
        descKey: 'settings.lab.jetski_autonomous_mode_desc',
        defaultTitle: 'jetski-autonomous-mode',
        defaultDesc: 'Experiment flag jetski-autonomous-mode. It is present in agy.exe, but no direct code reference was found. What it changes has not been verified.',
        titleZh: 'jetski-autonomous-mode',
        descZh: '实验开关 jetski-autonomous-mode。它存在于 agy.exe 中,但未找到直接代码引用。其具体作用尚未验证。',
        icon: Bot,
        colorClasses: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    disable_teamwork_forced_flash_model: {
        key: 'disable_teamwork_forced_flash_model',
        cliKey: 'disable-teamwork-forced-flash-model',
        cliFlag: '--disable-teamwork-forced-flash-model',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.disable_teamwork_forced_flash_model_title',
        descKey: 'settings.lab.disable_teamwork_forced_flash_model_desc',
        defaultTitle: 'disable-teamwork-forced-flash-model',
        defaultDesc: 'Experiment flag disable-teamwork-forced-flash-model. In agy.exe it is read by handlers.(*InvokeSubagentHandler).Handle, tools.(*InvokeSubagentTool).launch. What it changes has not been verified.',
        titleZh: 'disable-teamwork-forced-flash-model',
        descZh: '实验开关 disable-teamwork-forced-flash-model。在 agy.exe 中由 handlers.(*InvokeSubagentHandler).Handle, tools.(*InvokeSubagentTool).launch 读取。其具体作用尚未验证。',
        icon: Cpu,
        colorClasses: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    },
    enable_subagent_hub: {
        key: 'enable_subagent_hub',
        cliKey: 'enable-subagent-hub',
        cliFlag: '--enable-subagent-hub',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.subagent_hub_title',
        descKey: 'settings.lab.subagent_hub_desc',
        defaultTitle: 'enable-subagent-hub',
        defaultDesc: 'Experiment flag enable-subagent-hub. In agy.exe it is read by cortex.(*CascadeManager).gatedSubagentHub. What it changes has not been verified.',
        titleZh: 'enable-subagent-hub',
        descZh: '实验开关 enable-subagent-hub。在 agy.exe 中由 cortex.(*CascadeManager).gatedSubagentHub 读取。其具体作用尚未验证。',
        icon: Boxes,
        colorClasses: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
    },
    enable_swarm_monitor: {
        key: 'enable_swarm_monitor',
        cliKey: 'enable-swarm-monitor',
        cliFlag: '--enable-swarm-monitor',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.swarm_monitor_title',
        descKey: 'settings.lab.swarm_monitor_desc',
        defaultTitle: 'enable-swarm-monitor',
        defaultDesc: 'Experiment flag enable-swarm-monitor. In agy.exe it is read by config.buildDefaultAgent. What it changes has not been verified.',
        titleZh: 'enable-swarm-monitor',
        descZh: '实验开关 enable-swarm-monitor。在 agy.exe 中由 config.buildDefaultAgent 读取。其具体作用尚未验证。',
        icon: Radio,
        colorClasses: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    enable_fork_with_subagents: {
        key: 'enable_fork_with_subagents',
        cliKey: 'enable-fork-with-subagents',
        cliFlag: '--enable-fork-with-subagents',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.enable_fork_with_subagents_title',
        descKey: 'settings.lab.enable_fork_with_subagents_desc',
        defaultTitle: 'enable-fork-with-subagents',
        defaultDesc: 'Experiment flag enable-fork-with-subagents. In agy.exe it is read by cortex.(*CascadeManager).allowForkWithSubagents. What it changes has not been verified.',
        titleZh: 'enable-fork-with-subagents',
        descZh: '实验开关 enable-fork-with-subagents。在 agy.exe 中由 cortex.(*CascadeManager).allowForkWithSubagents 读取。其具体作用尚未验证。',
        icon: GitFork,
        colorClasses: 'text-violet-500 bg-violet-500/10 border-violet-500/30',
    },
    send_subagent_initial_prompt_as_message: {
        key: 'send_subagent_initial_prompt_as_message',
        cliKey: 'send-subagent-initial-prompt-as-message',
        cliFlag: '--send-subagent-initial-prompt-as-message',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.send_subagent_initial_prompt_as_message_title',
        descKey: 'settings.lab.send_subagent_initial_prompt_as_message_desc',
        defaultTitle: 'send-subagent-initial-prompt-as-message',
        defaultDesc: 'Experiment flag send-subagent-initial-prompt-as-message. In agy.exe it is read by config.getToolConfigOverrides. What it changes has not been verified.',
        titleZh: 'send-subagent-initial-prompt-as-message',
        descZh: '实验开关 send-subagent-initial-prompt-as-message。在 agy.exe 中由 config.getToolConfigOverrides 读取。其具体作用尚未验证。',
        icon: Share2,
        colorClasses: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    },
    enable_swarm_narrator: {
        key: 'enable_swarm_narrator',
        cliKey: 'enable-swarm-narrator',
        cliFlag: '--enable-swarm-narrator',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.enable_swarm_narrator_title',
        descKey: 'settings.lab.enable_swarm_narrator_desc',
        defaultTitle: 'enable-swarm-narrator',
        defaultDesc: 'Experiment flag enable-swarm-narrator. In agy.exe it is read by config.buildDefaultAgent. What it changes has not been verified.',
        titleZh: 'enable-swarm-narrator',
        descZh: '实验开关 enable-swarm-narrator。在 agy.exe 中由 config.buildDefaultAgent 读取。其具体作用尚未验证。',
        icon: Radio,
        colorClasses: 'text-teal-500 bg-teal-500/10 border-teal-500/30',
    },
    enable_image_generator_subagent: {
        key: 'enable_image_generator_subagent',
        cliKey: 'enable-image-generator-subagent',
        cliFlag: '--enable-image-generator-subagent',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.image_generator_subagent_title',
        descKey: 'settings.lab.image_generator_subagent_desc',
        defaultTitle: 'enable-image-generator-subagent',
        defaultDesc: 'Experiment flag enable-image-generator-subagent. In agy.exe it is read by config.ImageGeneratorSubagentEnabled. What it changes has not been verified.',
        titleZh: 'enable-image-generator-subagent',
        descZh: '实验开关 enable-image-generator-subagent。在 agy.exe 中由 config.ImageGeneratorSubagentEnabled 读取。其具体作用尚未验证。',
        icon: Image,
        colorClasses: 'text-pink-500 bg-pink-500/10 border-pink-500/30',
    },

    // --- Group 2: Deep Exploration & Adversarial Arena (Slash Commands) ---
    enable_owl_slash_command: {
        key: 'enable_owl_slash_command',
        cliKey: 'enable-owl-slash-command',
        cliFlag: '--enable-owl-slash-command',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.owl_slash_command_title',
        descKey: 'settings.lab.owl_slash_command_desc',
        defaultTitle: 'enable-owl-slash-command',
        defaultDesc: 'Experiment flag enable-owl-slash-command. In agy.exe it is read by agents.init.func8, admincontrols.(*Manager).overrideMultiagentControls (+2 more). What it changes has not been verified.',
        titleZh: 'enable-owl-slash-command',
        descZh: '实验开关 enable-owl-slash-command。在 agy.exe 中由 agents.init.func8, admincontrols.(*Manager).overrideMultiagentControls (+2 more) 读取。其具体作用尚未验证。',
        icon: Terminal,
        colorClasses: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    },
    enable_compact_slash_command: {
        key: 'enable_compact_slash_command',
        cliKey: 'enable-compact-slash-command',
        cliFlag: '--enable-compact-slash-command',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.compact_slash_command_title',
        descKey: 'settings.lab.compact_slash_command_desc',
        defaultTitle: 'enable-compact-slash-command',
        defaultDesc: 'Experiment flag enable-compact-slash-command. In agy.exe it is read by slashcommands.init.func2, prehooks.NewContextSummaryHook. What it changes has not been verified.',
        titleZh: 'enable-compact-slash-command',
        descZh: '实验开关 enable-compact-slash-command。在 agy.exe 中由 slashcommands.init.func2, prehooks.NewContextSummaryHook 读取。其具体作用尚未验证。',
        icon: RotateCcw,
        colorClasses: 'text-violet-500 bg-violet-500/10 border-violet-500/30',
    },
    enable_battle_mode: {
        key: 'enable_battle_mode',
        cliKey: 'enable-battle-mode',
        cliFlag: '--enable-battle-mode',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.battle_mode_title',
        descKey: 'settings.lab.battle_mode_desc',
        defaultTitle: 'enable-battle-mode',
        defaultDesc: 'Experiment flag enable-battle-mode. In agy.exe it is read by cortex.(*CascadeManager).ValidateBattleMode. What it changes has not been verified.',
        titleZh: 'enable-battle-mode',
        descZh: '实验开关 enable-battle-mode。在 agy.exe 中由 cortex.(*CascadeManager).ValidateBattleMode 读取。其具体作用尚未验证。',
        icon: Swords,
        colorClasses: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
    },
    enable_battle_mode_custom_agents: {
        key: 'enable_battle_mode_custom_agents',
        cliKey: 'enable-battle-mode-custom-agents',
        cliFlag: '--enable-battle-mode-custom-agents',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.enable_battle_mode_custom_agents_title',
        descKey: 'settings.lab.enable_battle_mode_custom_agents_desc',
        defaultTitle: 'enable-battle-mode-custom-agents',
        defaultDesc: 'Experiment flag enable-battle-mode-custom-agents. In agy.exe it is read by cortex.(*CascadeManager).ValidateBattleMode. What it changes has not been verified.',
        titleZh: 'enable-battle-mode-custom-agents',
        descZh: '实验开关 enable-battle-mode-custom-agents。在 agy.exe 中由 cortex.(*CascadeManager).ValidateBattleMode 读取。其具体作用尚未验证。',
        icon: Trophy,
        colorClasses: 'text-amber-600 bg-amber-600/10 border-amber-600/30',
    },
    enable_programmatic_tools: {
        key: 'enable_programmatic_tools',
        cliKey: 'enable-programmatic-tools',
        cliFlag: '--enable-programmatic-tools',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.programmatic_tools_title',
        descKey: 'settings.lab.programmatic_tools_desc',
        defaultTitle: 'enable-programmatic-tools',
        defaultDesc: 'Experiment flag enable-programmatic-tools. In agy.exe it is read by tools.NewRunWorkflowTool. What it changes has not been verified.',
        titleZh: 'enable-programmatic-tools',
        descZh: '实验开关 enable-programmatic-tools。在 agy.exe 中由 tools.NewRunWorkflowTool 读取。其具体作用尚未验证。',
        icon: Code2,
        colorClasses: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    },
    jetski_generative_ui: {
        key: 'jetski_generative_ui',
        cliKey: 'jetski-generative-ui',
        cliFlag: '--jetski-generative-ui',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.jetski_generative_ui_title',
        descKey: 'settings.lab.jetski_generative_ui_desc',
        defaultTitle: 'jetski-generative-ui',
        defaultDesc: 'Experiment flag jetski-generative-ui. In agy.exe it is read by config.buildDefaultAgent. What it changes has not been verified.',
        titleZh: 'jetski-generative-ui',
        descZh: '实验开关 jetski-generative-ui。在 agy.exe 中由 config.buildDefaultAgent 读取。其具体作用尚未验证。',
        icon: Layout,
        colorClasses: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    },
    enable_deepagent: {
        key: 'enable_deepagent',
        cliKey: 'enable-deepagent',
        cliFlag: '--enable-deepagent',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.deepagent_title',
        descKey: 'settings.lab.deepagent_desc',
        defaultTitle: 'enable-deepagent',
        defaultDesc: 'Experiment flag enable-deepagent. In agy.exe it is read by config.deepAgent. What it changes has not been verified.',
        titleZh: 'enable-deepagent',
        descZh: '实验开关 enable-deepagent。在 agy.exe 中由 config.deepAgent 读取。其具体作用尚未验证。',
        icon: Sparkles,
        colorClasses: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    },
    enable_review: {
        key: 'enable_review',
        cliKey: 'enable-review',
        cliFlag: '--enable-review',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.review_title',
        descKey: 'settings.lab.review_desc',
        defaultTitle: 'enable-review',
        defaultDesc: 'Experiment flag enable-review. In agy.exe it is read by config.reviewAgent. What it changes has not been verified.',
        titleZh: 'enable-review',
        descZh: '实验开关 enable-review。在 agy.exe 中由 config.reviewAgent 读取。其具体作用尚未验证。',
        icon: CheckCheck,
        colorClasses: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
    },

    // --- Group 3: Customizations 2.0 & Plugin Ecosystem ---
    enable_plugins: {
        key: 'enable_plugins',
        cliKey: 'enable-plugins',
        cliFlag: '--enable-plugins',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.enable_plugins_title',
        descKey: 'settings.lab.enable_plugins_desc',
        defaultTitle: 'enable-plugins',
        defaultDesc: 'Experiment flag enable-plugins. In agy.exe it is read by migrations.(*adoptBWGInstallsMigration).Enabled, language_server.(*Server).ImportProjectFromUrl (+3 more). What it changes has not been verified.',
        titleZh: 'enable-plugins',
        descZh: '实验开关 enable-plugins。在 agy.exe 中由 migrations.(*adoptBWGInstallsMigration).Enabled, language_server.(*Server).ImportProjectFromUrl (+3 more) 读取。其具体作用尚未验证。',
        icon: Boxes,
        colorClasses: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    },
    enable_hook_status: {
        key: 'enable_hook_status',
        cliKey: 'enable-hook-status',
        cliFlag: '--enable-hook-status',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.enable_hook_status_title',
        descKey: 'settings.lab.enable_hook_status_desc',
        defaultTitle: 'enable-hook-status',
        defaultDesc: 'Experiment flag enable-hook-status. In agy.exe it is read by config.augmentConversationalConfigWithExperiment. What it changes has not been verified.',
        titleZh: 'enable-hook-status',
        descZh: '实验开关 enable-hook-status。在 agy.exe 中由 config.augmentConversationalConfigWithExperiment 读取。其具体作用尚未验证。',
        icon: RefreshCw,
        colorClasses: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    enable_customization_kind_agent: {
        key: 'enable_customization_kind_agent',
        cliKey: 'enable-customization-kind-agent',
        cliFlag: '--enable-customization-kind-agent',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.customization_kind_agent_title',
        descKey: 'settings.lab.customization_kind_agent_desc',
        defaultTitle: 'enable-customization-kind-agent',
        defaultDesc: 'Experiment flag enable-customization-kind-agent. It is present in agy.exe, but no direct code reference was found. What it changes has not been verified.',
        titleZh: 'enable-customization-kind-agent',
        descZh: '实验开关 enable-customization-kind-agent。它存在于 agy.exe 中,但未找到直接代码引用。其具体作用尚未验证。',
        icon: Bot,
        colorClasses: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
    },
    enable_customization_kind_skill: {
        key: 'enable_customization_kind_skill',
        cliKey: 'enable-customization-kind-skill',
        cliFlag: '--enable-customization-kind-skill',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.customization_kind_skill_title',
        descKey: 'settings.lab.customization_kind_skill_desc',
        defaultTitle: 'enable-customization-kind-skill',
        defaultDesc: 'Experiment flag enable-customization-kind-skill. It is present in agy.exe, but no direct code reference was found. What it changes has not been verified.',
        titleZh: 'enable-customization-kind-skill',
        descZh: '实验开关 enable-customization-kind-skill。它存在于 agy.exe 中,但未找到直接代码引用。其具体作用尚未验证。',
        icon: Sparkles,
        colorClasses: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    },
    enable_customization_kind_rule: {
        key: 'enable_customization_kind_rule',
        cliKey: 'enable-customization-kind-rule',
        cliFlag: '--enable-customization-kind-rule',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.customization_kind_rule_title',
        descKey: 'settings.lab.customization_kind_rule_desc',
        defaultTitle: 'enable-customization-kind-rule',
        defaultDesc: 'Experiment flag enable-customization-kind-rule. It is present in agy.exe, but no direct code reference was found. What it changes has not been verified.',
        titleZh: 'enable-customization-kind-rule',
        descZh: '实验开关 enable-customization-kind-rule。它存在于 agy.exe 中,但未找到直接代码引用。其具体作用尚未验证。',
        icon: ShieldCheck,
        colorClasses: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    enable_customization_kind_mcp: {
        key: 'enable_customization_kind_mcp',
        cliKey: 'enable-customization-kind-mcp',
        cliFlag: '--enable-customization-kind-mcp',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.customization_kind_mcp_title',
        descKey: 'settings.lab.customization_kind_mcp_desc',
        defaultTitle: 'enable-customization-kind-mcp',
        defaultDesc: 'Experiment flag enable-customization-kind-mcp. It is present in agy.exe, but no direct code reference was found. What it changes has not been verified.',
        titleZh: 'enable-customization-kind-mcp',
        descZh: '实验开关 enable-customization-kind-mcp。它存在于 agy.exe 中,但未找到直接代码引用。其具体作用尚未验证。',
        icon: Network,
        colorClasses: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    },
    enable_customization_kind_hooks: {
        key: 'enable_customization_kind_hooks',
        cliKey: 'enable-customization-kind-hooks',
        cliFlag: '--enable-customization-kind-hooks',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.customization_kind_hooks_title',
        descKey: 'settings.lab.customization_kind_hooks_desc',
        defaultTitle: 'enable-customization-kind-hooks',
        defaultDesc: 'Experiment flag enable-customization-kind-hooks. It is present in agy.exe, but no direct code reference was found. What it changes has not been verified.',
        titleZh: 'enable-customization-kind-hooks',
        descZh: '实验开关 enable-customization-kind-hooks。它存在于 agy.exe 中,但未找到直接代码引用。其具体作用尚未验证。',
        icon: ArrowRightLeft,
        colorClasses: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    },
    deprecate_workflows: {
        key: 'deprecate_workflows',
        cliKey: 'deprecate-workflows',
        cliFlag: '--deprecate-workflows',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.deprecate_workflows_title',
        descKey: 'settings.lab.deprecate_workflows_desc',
        defaultTitle: 'deprecate-workflows',
        defaultDesc: 'Experiment flag deprecate-workflows. In agy.exe it is read by config.buildDefaultAgent. What it changes has not been verified.',
        titleZh: 'deprecate-workflows',
        descZh: '实验开关 deprecate-workflows。在 agy.exe 中由 config.buildDefaultAgent 读取。其具体作用尚未验证。',
        icon: RotateCcw,
        colorClasses: 'text-red-500 bg-red-500/10 border-red-500/30',
    },

    // --- Group 4: Sidecar Micro-Frontend & UI Runtime ---
    enable_sidecars: {
        key: 'enable_sidecars',
        cliKey: 'enable-sidecars',
        cliFlag: '--enable-sidecars',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.sidecars_title',
        descKey: 'settings.lab.sidecars_desc',
        defaultTitle: 'enable-sidecars',
        defaultDesc: 'Experiment flag enable-sidecars. It is present in agy.exe, but no direct code reference was found. What it changes has not been verified.',
        titleZh: 'enable-sidecars',
        descZh: '实验开关 enable-sidecars。它存在于 agy.exe 中,但未找到直接代码引用。其具体作用尚未验证。',
        icon: Layers,
        colorClasses: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    },
    enable_ui_sidecars: {
        key: 'enable_ui_sidecars',
        cliKey: 'enable-ui-sidecars',
        cliFlag: '--enable-ui-sidecars',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.ui_sidecars_title',
        descKey: 'settings.lab.ui_sidecars_desc',
        defaultTitle: 'enable-ui-sidecars',
        defaultDesc: 'Experiment flag enable-ui-sidecars. In agy.exe it is read by config.buildDefaultAgent. What it changes has not been verified.',
        titleZh: 'enable-ui-sidecars',
        descZh: '实验开关 enable-ui-sidecars。在 agy.exe 中由 config.buildDefaultAgent 读取。其具体作用尚未验证。',
        icon: Layout,
        colorClasses: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    },
    enable_sidecar_sdk: {
        key: 'enable_sidecar_sdk',
        cliKey: 'enable-sidecar-sdk',
        cliFlag: '--enable-sidecar-sdk',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.sidecar_sdk_title',
        descKey: 'settings.lab.sidecar_sdk_desc',
        defaultTitle: 'enable-sidecar-sdk',
        defaultDesc: 'Experiment flag enable-sidecar-sdk. In agy.exe it is read by sidecars.(*SidecarManager).Start. What it changes has not been verified.',
        titleZh: 'enable-sidecar-sdk',
        descZh: '实验开关 enable-sidecar-sdk。在 agy.exe 中由 sidecars.(*SidecarManager).Start 读取。其具体作用尚未验证。',
        icon: Code2,
        colorClasses: 'text-violet-500 bg-violet-500/10 border-violet-500/30',
    },
    jetski_sidecar_declared_permissions: {
        key: 'jetski_sidecar_declared_permissions',
        cliKey: 'jetski-sidecar-declared-permissions',
        cliFlag: '--jetski-sidecar-declared-permissions',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.sidecar_declared_permissions_title',
        descKey: 'settings.lab.sidecar_declared_permissions_desc',
        defaultTitle: 'jetski-sidecar-declared-permissions',
        defaultDesc: 'Experiment flag jetski-sidecar-declared-permissions. In agy.exe it is read by sidecars.(*SidecarManager).SetProjectID, sidecars.(*SidecarManager).RunScheduledTask (+11 more). What it changes has not been verified.',
        titleZh: 'jetski-sidecar-declared-permissions',
        descZh: '实验开关 jetski-sidecar-declared-permissions。在 agy.exe 中由 sidecars.(*SidecarManager).SetProjectID, sidecars.(*SidecarManager).RunScheduledTask (+11 more) 读取。其具体作用尚未验证。',
        icon: ShieldCheck,
        colorClasses: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    sidecar_gateway: {
        key: 'sidecar_gateway',
        cliKey: 'sidecar-gateway',
        cliFlag: '--sidecar-gateway',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.sidecar_gateway_title',
        descKey: 'settings.lab.sidecar_gateway_desc',
        defaultTitle: 'sidecar-gateway',
        defaultDesc: 'Experiment flag sidecar-gateway. In agy.exe it is read by sidecars.(*SidecarManager).runSingleInvocation. What it changes has not been verified.',
        titleZh: 'sidecar-gateway',
        descZh: '实验开关 sidecar-gateway。在 agy.exe 中由 sidecars.(*SidecarManager).runSingleInvocation 读取。其具体作用尚未验证。',
        icon: Network,
        colorClasses: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    },
    sidecar_iframe_prewarm: {
        key: 'sidecar_iframe_prewarm',
        cliKey: 'sidecar-iframe-prewarm',
        cliFlag: '--sidecar-iframe-prewarm',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.sidecar_iframe_prewarm_title',
        descKey: 'settings.lab.sidecar_iframe_prewarm_desc',
        defaultTitle: 'sidecar-iframe-prewarm',
        defaultDesc: 'Experiment flag sidecar-iframe-prewarm. It is present in agy.exe, but no direct code reference was found. What it changes has not been verified.',
        titleZh: 'sidecar-iframe-prewarm',
        descZh: '实验开关 sidecar-iframe-prewarm。它存在于 agy.exe 中,但未找到直接代码引用。其具体作用尚未验证。',
        icon: RefreshCw,
        colorClasses: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    },

    // --- Cluster 5 ---
    enable_command_assessor: {
        key: 'enable_command_assessor',
        cliKey: 'enable-command-assessor',
        cliFlag: '--enable-command-assessor',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.command_assessor_title',
        descKey: 'settings.lab.command_assessor_desc',
        defaultTitle: 'enable-command-assessor',
        defaultDesc: 'Experiment flag enable-command-assessor. In agy.exe it is read by config.CommandAssessorEnabled. What it changes has not been verified.',
        titleZh: 'enable-command-assessor',
        descZh: '实验开关 enable-command-assessor。在 agy.exe 中由 config.CommandAssessorEnabled 读取。其具体作用尚未验证。',
        icon: ShieldCheck,
        colorClasses: 'text-red-500 bg-red-500/10 border-red-500/30',
    },
    enable_command_antivirus: {
        key: 'enable_command_antivirus',
        cliKey: 'enable-command-antivirus',
        cliFlag: '--enable-command-antivirus',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.enable_command_antivirus_title',
        descKey: 'settings.lab.enable_command_antivirus_desc',
        defaultTitle: 'enable-command-antivirus',
        defaultDesc: 'Experiment flag enable-command-antivirus. In agy.exe it is read by config.augmentConversationalConfigWithExperiment. What it changes has not been verified.',
        titleZh: 'enable-command-antivirus',
        descZh: '实验开关 enable-command-antivirus。在 agy.exe 中由 config.augmentConversationalConfigWithExperiment 读取。其具体作用尚未验证。',
        icon: ShieldCheck,
        colorClasses: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
    },
    allow_experimental_monitors: {
        key: 'allow_experimental_monitors',
        cliKey: 'allow-experimental-monitors',
        cliFlag: '--allow-experimental-monitors',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.allow_experimental_monitors_title',
        descKey: 'settings.lab.allow_experimental_monitors_desc',
        defaultTitle: 'allow-experimental-monitors',
        defaultDesc: 'Experiment flag allow-experimental-monitors. In agy.exe it is read by config.augmentConversationalConfigWithExperiment. What it changes has not been verified.',
        titleZh: 'allow-experimental-monitors',
        descZh: '实验开关 allow-experimental-monitors。在 agy.exe 中由 config.augmentConversationalConfigWithExperiment 读取。其具体作用尚未验证。',
        icon: Radio,
        colorClasses: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    },
    enable_citc_workspace_hygiene_rule: {
        key: 'enable_citc_workspace_hygiene_rule',
        cliKey: 'enable-citc-workspace-hygiene-rule',
        cliFlag: '--enable-citc-workspace-hygiene-rule',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.citc_workspace_hygiene_rule_title',
        descKey: 'settings.lab.citc_workspace_hygiene_rule_desc',
        defaultTitle: 'enable-citc-workspace-hygiene-rule',
        defaultDesc: 'Experiment flag enable-citc-workspace-hygiene-rule. It is present in agy.exe, but no direct code reference was found. What it changes has not been verified.',
        titleZh: 'enable-citc-workspace-hygiene-rule',
        descZh: '实验开关 enable-citc-workspace-hygiene-rule。它存在于 agy.exe 中,但未找到直接代码引用。其具体作用尚未验证。',
        icon: CheckCheck,
        colorClasses: 'text-teal-500 bg-teal-500/10 border-teal-500/30',
    },
    disable_stained_loas2_creds: {
        key: 'disable_stained_loas2_creds',
        cliKey: 'disable-stained-loas2-creds',
        cliFlag: '--disable-stained-loas2-creds',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.disable_stained_loas2_creds_title',
        descKey: 'settings.lab.disable_stained_loas2_creds_desc',
        defaultTitle: 'disable-stained-loas2-creds',
        defaultDesc: 'Experiment flag disable-stained-loas2-creds. In agy.exe it is read by sidecars.(*SidecarManager).prepareInvocationEnv, config.getToolConfigOverrides. What it changes has not been verified.',
        titleZh: 'disable-stained-loas2-creds',
        descZh: '实验开关 disable-stained-loas2-creds。在 agy.exe 中由 sidecars.(*SidecarManager).prepareInvocationEnv, config.getToolConfigOverrides 读取。其具体作用尚未验证。',
        icon: KeyRound,
        colorClasses: 'text-yellow-600 bg-yellow-600/10 border-yellow-600/30',
    },
    enable_browser_subagent_v2: {
        key: 'enable_browser_subagent_v2',
        cliKey: 'enable-browser-subagent-v2',
        cliFlag: '--enable-browser-subagent-v2',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.enable_browser_subagent_v2_title',
        descKey: 'settings.lab.enable_browser_subagent_v2_desc',
        defaultTitle: 'enable-browser-subagent-v2',
        defaultDesc: 'Experiment flag enable-browser-subagent-v2. In agy.exe it is read by config.BrowserSubagentWebviewEnabled, config.getToolConfigOverrides (+1 more). What it changes has not been verified.',
        titleZh: 'enable-browser-subagent-v2',
        descZh: '实验开关 enable-browser-subagent-v2。在 agy.exe 中由 config.BrowserSubagentWebviewEnabled, config.getToolConfigOverrides (+1 more) 读取。其具体作用尚未验证。',
        icon: Globe,
        colorClasses: 'text-sky-500 bg-sky-500/10 border-sky-500/30',
    },

    // --- Group 6: Terminal Engine & Execution Resilience ---
    enable_persistent_terminals: {
        key: 'enable_persistent_terminals',
        cliKey: 'enable-persistent-terminals',
        cliFlag: '--enable-persistent-terminals',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.enable_persistent_terminals_title',
        descKey: 'settings.lab.enable_persistent_terminals_desc',
        defaultTitle: 'enable-persistent-terminals',
        defaultDesc: 'Experiment flag enable-persistent-terminals. In agy.exe it is read by config.getToolConfigOverrides. What it changes has not been verified.',
        titleZh: 'enable-persistent-terminals',
        descZh: '实验开关 enable-persistent-terminals。在 agy.exe 中由 config.getToolConfigOverrides 读取。其具体作用尚未验证。',
        icon: Terminal,
        colorClasses: 'text-lime-600 bg-lime-600/10 border-lime-600/30',
    },
    enable_pty: {
        key: 'enable_pty',
        cliKey: 'enable-pty',
        cliFlag: '--enable-pty',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.pty_title',
        descKey: 'settings.lab.pty_desc',
        defaultTitle: 'enable-pty',
        defaultDesc: 'Experiment flag enable-pty. In agy.exe it is read by config.getToolConfigOverrides. What it changes has not been verified.',
        titleZh: 'enable-pty',
        descZh: '实验开关 enable-pty。在 agy.exe 中由 config.getToolConfigOverrides 读取。其具体作用尚未验证。',
        icon: Terminal,
        colorClasses: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
    },
    enable_ripgrep_path_search: {
        key: 'enable_ripgrep_path_search',
        cliKey: 'enable-ripgrep-path-search',
        cliFlag: '--enable-ripgrep-path-search',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.ripgrep_path_search_title',
        descKey: 'settings.lab.ripgrep_path_search_desc',
        defaultTitle: 'enable-ripgrep-path-search',
        defaultDesc: 'Experiment flag enable-ripgrep-path-search. In agy.exe it is read by language_server.(*Server).SearchFiles. What it changes has not been verified.',
        titleZh: 'enable-ripgrep-path-search',
        descZh: '实验开关 enable-ripgrep-path-search。在 agy.exe 中由 language_server.(*Server).SearchFiles 读取。其具体作用尚未验证。',
        icon: Search,
        colorClasses: 'text-lime-500 bg-lime-500/10 border-lime-500/30',
    },
    enable_wait_tool: {
        key: 'enable_wait_tool',
        cliKey: 'enable-wait-tool',
        cliFlag: '--enable-wait-tool',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.wait_tool_title',
        descKey: 'settings.lab.wait_tool_desc',
        defaultTitle: 'enable-wait-tool',
        defaultDesc: 'Experiment flag enable-wait-tool. In agy.exe it is read by config.getToolConfigOverrides, config.buildDefaultAgent. What it changes has not been verified.',
        titleZh: 'enable-wait-tool',
        descZh: '实验开关 enable-wait-tool。在 agy.exe 中由 config.getToolConfigOverrides, config.buildDefaultAgent 读取。其具体作用尚未验证。',
        icon: Clock,
        colorClasses: 'text-sky-500 bg-sky-500/10 border-sky-500/30',
    },
    scheduled_tasks_v2: {
        key: 'scheduled_tasks_v2',
        cliKey: 'scheduled-tasks-v2',
        cliFlag: '--scheduled-tasks-v2',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.scheduled_tasks_v2_title',
        descKey: 'settings.lab.scheduled_tasks_v2_desc',
        defaultTitle: 'scheduled-tasks-v2',
        defaultDesc: 'Experiment flag scheduled-tasks-v2. It is present in agy.exe, but no direct code reference was found. What it changes has not been verified.',
        titleZh: 'scheduled-tasks-v2',
        descZh: '实验开关 scheduled-tasks-v2。它存在于 agy.exe 中,但未找到直接代码引用。其具体作用尚未验证。',
        icon: Clock,
        colorClasses: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    },
    enable_model_capacity_exhausted_retries: {
        key: 'enable_model_capacity_exhausted_retries',
        cliKey: 'enable-model-capacity-exhausted-retries',
        cliFlag: '--enable-model-capacity-exhausted-retries',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.model_capacity_exhausted_retries_title',
        descKey: 'settings.lab.model_capacity_exhausted_retries_desc',
        defaultTitle: 'enable-model-capacity-exhausted-retries',
        defaultDesc: 'Experiment flag enable-model-capacity-exhausted-retries. In agy.exe it is read by modelapiccpa.(*Client).Generate. What it changes has not been verified.',
        titleZh: 'enable-model-capacity-exhausted-retries',
        descZh: '实验开关 enable-model-capacity-exhausted-retries。在 agy.exe 中由 modelapiccpa.(*Client).Generate 读取。其具体作用尚未验证。',
        icon: RefreshCw,
        colorClasses: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    enable_mcp_non_blocking_turn_load: {
        key: 'enable_mcp_non_blocking_turn_load',
        cliKey: 'enable-mcp-non-blocking-turn-load',
        cliFlag: '--enable-mcp-non-blocking-turn-load',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.mcp_non_blocking_turn_load_title',
        descKey: 'settings.lab.mcp_non_blocking_turn_load_desc',
        defaultTitle: 'enable-mcp-non-blocking-turn-load',
        defaultDesc: 'Experiment flag enable-mcp-non-blocking-turn-load. In agy.exe it is read by config.getToolConfigOverrides. What it changes has not been verified.',
        titleZh: 'enable-mcp-non-blocking-turn-load',
        descZh: '实验开关 enable-mcp-non-blocking-turn-load。在 agy.exe 中由 config.getToolConfigOverrides 读取。其具体作用尚未验证。',
        icon: Boxes,
        colorClasses: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    },
    enable_remote_agent_fastpush_pin: {
        key: 'enable_remote_agent_fastpush_pin',
        cliKey: 'enable-remote-agent-fastpush-pin',
        cliFlag: '--enable-remote-agent-fastpush-pin',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.remote_agent_fastpush_pin_title',
        descKey: 'settings.lab.remote_agent_fastpush_pin_desc',
        defaultTitle: 'enable-remote-agent-fastpush-pin',
        defaultDesc: 'Experiment flag enable-remote-agent-fastpush-pin. In agy.exe it is read by language_server.CreateLanguageServerAndServe.func3. What it changes has not been verified.',
        titleZh: 'enable-remote-agent-fastpush-pin',
        descZh: '实验开关 enable-remote-agent-fastpush-pin。在 agy.exe 中由 language_server.CreateLanguageServerAndServe.func3 读取。其具体作用尚未验证。',
        icon: Share2,
        colorClasses: 'text-teal-500 bg-teal-500/10 border-teal-500/30',
    },

    // --- Group 7: Cortex State, Direct Planning & Trajectory Engine ---
    cortex_snapshot_recording: {
        key: 'cortex_snapshot_recording',
        cliKey: 'cortex-snapshot-recording',
        cliFlag: '--cortex-snapshot-recording',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.cortex_snapshot_recording_title',
        descKey: 'settings.lab.cortex_snapshot_recording_desc',
        defaultTitle: 'cortex-snapshot-recording',
        defaultDesc: 'Experiment flag cortex-snapshot-recording. In agy.exe it is read by config.augmentConversationalConfigWithExperiment. What it changes has not been verified.',
        titleZh: 'cortex-snapshot-recording',
        descZh: '实验开关 cortex-snapshot-recording。在 agy.exe 中由 config.augmentConversationalConfigWithExperiment 读取。其具体作用尚未验证。',
        icon: History,
        colorClasses: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
    },
    cortex_snapshot_revert: {
        key: 'cortex_snapshot_revert',
        cliKey: 'cortex-snapshot-revert',
        cliFlag: '--cortex-snapshot-revert',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.cortex_snapshot_revert_title',
        descKey: 'settings.lab.cortex_snapshot_revert_desc',
        defaultTitle: 'cortex-snapshot-revert',
        defaultDesc: 'Experiment flag cortex-snapshot-revert. In agy.exe it is read by config.augmentConversationalConfigWithExperiment, cortex.(*CascadeManager).snapshotRevertEnabled. What it changes has not been verified.',
        titleZh: 'cortex-snapshot-revert',
        descZh: '实验开关 cortex-snapshot-revert。在 agy.exe 中由 config.augmentConversationalConfigWithExperiment, cortex.(*CascadeManager).snapshotRevertEnabled 读取。其具体作用尚未验证。',
        icon: RotateCcw,
        colorClasses: 'text-rose-400 bg-rose-400/10 border-rose-400/30',
    },
    enable_conversation_search_v2: {
        key: 'enable_conversation_search_v2',
        cliKey: 'enable-conversation-search-v2',
        cliFlag: '--enable-conversation-search-v2',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.conversation_search_v2_title',
        descKey: 'settings.lab.conversation_search_v2_desc',
        defaultTitle: 'enable-conversation-search-v2',
        defaultDesc: 'Experiment flag enable-conversation-search-v2. In agy.exe it is read by language_server.(*Server).maybeInitConversationSearch, language_server.(*Server).SearchConversations (+1 more). What it changes has not been verified.',
        titleZh: 'enable-conversation-search-v2',
        descZh: '实验开关 enable-conversation-search-v2。在 agy.exe 中由 language_server.(*Server).maybeInitConversationSearch, language_server.(*Server).SearchConversations (+1 more) 读取。其具体作用尚未验证。',
        icon: Search,
        colorClasses: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
    },
    show_model_selection_change: {
        key: 'show_model_selection_change',
        cliKey: 'show-model-selection-change',
        cliFlag: '--show-model-selection-change',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.show_model_selection_change_title',
        descKey: 'settings.lab.show_model_selection_change_desc',
        defaultTitle: 'show-model-selection-change',
        defaultDesc: 'Experiment flag show-model-selection-change. In agy.exe it is read by config.augmentConversationalConfigWithExperiment. What it changes has not been verified.',
        titleZh: 'show-model-selection-change',
        descZh: '实验开关 show-model-selection-change。在 agy.exe 中由 config.augmentConversationalConfigWithExperiment 读取。其具体作用尚未验证。',
        icon: Sparkles,
        colorClasses: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    },
    use_component_rewrite: {
        key: 'use_component_rewrite',
        cliKey: 'use-component-rewrite',
        cliFlag: '--use-component-rewrite',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.use_component_rewrite_title',
        descKey: 'settings.lab.use_component_rewrite_desc',
        defaultTitle: 'use-component-rewrite',
        defaultDesc: 'Experiment flag use-component-rewrite. In agy.exe it is read by config.buildDefaultAgent, tools.NewRunWorkflowTool. What it changes has not been verified.',
        titleZh: 'use-component-rewrite',
        descZh: '实验开关 use-component-rewrite。在 agy.exe 中由 config.buildDefaultAgent, tools.NewRunWorkflowTool 读取。其具体作用尚未验证。',
        icon: Code2,
        colorClasses: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    },
    use_core_direct: {
        key: 'use_core_direct',
        cliKey: 'use-core-direct',
        cliFlag: '--use-core-direct',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.use_core_direct_title',
        descKey: 'settings.lab.use_core_direct_desc',
        defaultTitle: 'use-core-direct',
        defaultDesc: 'Experiment flag use-core-direct. It is present in agy.exe, but no direct code reference was found. What it changes has not been verified.',
        titleZh: 'use-core-direct',
        descZh: '实验开关 use-core-direct。它存在于 agy.exe 中,但未找到直接代码引用。其具体作用尚未验证。',
        icon: Cpu,
        colorClasses: 'text-violet-500 bg-violet-500/10 border-violet-500/30',
    },
    use_slash_plan: {
        key: 'use_slash_plan',
        cliKey: 'use-slash-plan',
        cliFlag: '--use-slash-plan',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.use_slash_plan_title',
        descKey: 'settings.lab.use_slash_plan_desc',
        defaultTitle: 'use-slash-plan',
        defaultDesc: 'Experiment flag use-slash-plan. In agy.exe it is read by config.augmentConversationalConfigWithExperiment. What it changes has not been verified.',
        titleZh: 'use-slash-plan',
        descZh: '实验开关 use-slash-plan。在 agy.exe 中由 config.augmentConversationalConfigWithExperiment 读取。其具体作用尚未验证。',
        icon: FileCode,
        colorClasses: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    },
    enable_voice_activity_events: {
        key: 'enable_voice_activity_events',
        cliKey: 'enable-voice-activity-events',
        cliFlag: '--enable-voice-activity-events',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.enable_voice_activity_events_title',
        descKey: 'settings.lab.enable_voice_activity_events_desc',
        defaultTitle: 'enable-voice-activity-events',
        defaultDesc: 'enable-voice-activity-events is not an experiment key in agy.exe (its name only matches a Google Cloud Speech field). It has no known effect.',
        titleZh: 'enable-voice-activity-events',
        descZh: 'enable-voice-activity-events 不是 agy.exe 的实验开关键(名称仅与 Google Cloud Speech 字段匹配),无已知作用。',
        icon: Mic,
        colorClasses: 'text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/30',
    },
    cascade_enable_notebook_edit_tool: {
        key: 'cascade_enable_notebook_edit_tool',
        cliKey: 'cascade-enable-notebook-edit-tool',
        cliFlag: '--cascade-enable-notebook-edit-tool',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.cascade_enable_notebook_edit_tool_title',
        descKey: 'settings.lab.cascade_enable_notebook_edit_tool_desc',
        defaultTitle: 'cascade-enable-notebook-edit-tool',
        defaultDesc: 'Experiment flag cascade-enable-notebook-edit-tool. In agy.exe it is read by config.buildDefaultAgent, config.getToolConfigOverrides. What it changes has not been verified.',
        titleZh: 'cascade-enable-notebook-edit-tool',
        descZh: '实验开关 cascade-enable-notebook-edit-tool。在 agy.exe 中由 config.buildDefaultAgent, config.getToolConfigOverrides 读取。其具体作用尚未验证。',
        icon: FileCode,
        colorClasses: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    },
    cascade_use_sed_edit_tool: {
        key: 'cascade_use_sed_edit_tool',
        cliKey: 'cascade-use-sed-edit-tool',
        cliFlag: '--cascade-use-sed-edit-tool',
        badge: 'flag',
        badgeZh: '开关',
        badgeEn: 'flag',
        titleKey: 'settings.lab.cascade_use_sed_edit_tool_title',
        descKey: 'settings.lab.cascade_use_sed_edit_tool_desc',
        defaultTitle: 'cascade-use-sed-edit-tool',
        defaultDesc: 'Experiment flag cascade-use-sed-edit-tool. In agy.exe it is read by config.getToolConfigOverrides. What it changes has not been verified.',
        titleZh: 'cascade-use-sed-edit-tool',
        descZh: '实验开关 cascade-use-sed-edit-tool。在 agy.exe 中由 config.getToolConfigOverrides 读取。其具体作用尚未验证。',
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
        title: 'Cluster 1',
        titleZh: '第 1 组',
        desc: 'UI grouping of 8 experiment toggles. See the project README for the agy.exe code that reads each one.',
        descZh: '界面分组,共 8 个实验开关。每个开关在 agy.exe 中的读取位置见项目 README。',
        badge: 'Cluster 1',
        badgeZh: '第 1 组',
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
        title: 'Cluster 2',
        titleZh: '第 2 组',
        desc: 'UI grouping of 8 experiment toggles. See the project README for the agy.exe code that reads each one.',
        descZh: '界面分组,共 8 个实验开关。每个开关在 agy.exe 中的读取位置见项目 README。',
        badge: 'Cluster 2',
        badgeZh: '第 2 组',
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
        title: 'Cluster 3',
        titleZh: '第 3 组',
        desc: 'UI grouping of 8 experiment toggles. See the project README for the agy.exe code that reads each one.',
        descZh: '界面分组,共 8 个实验开关。每个开关在 agy.exe 中的读取位置见项目 README。',
        badge: 'Cluster 3',
        badgeZh: '第 3 组',
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
        title: 'Cluster 4',
        titleZh: '第 4 组',
        desc: 'UI grouping of 6 experiment toggles. See the project README for the agy.exe code that reads each one.',
        descZh: '界面分组,共 6 个实验开关。每个开关在 agy.exe 中的读取位置见项目 README。',
        badge: 'Cluster 4',
        badgeZh: '第 4 组',
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
        title: 'Cluster 5',
        titleZh: '第 5 组',
        desc: 'UI grouping of 6 experiment toggles. See the project README for the agy.exe code that reads each one.',
        descZh: '界面分组,共 6 个实验开关。每个开关在 agy.exe 中的读取位置见项目 README。',
        badge: 'Cluster 5',
        badgeZh: '第 5 组',
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
        title: 'Cluster 6',
        titleZh: '第 6 组',
        desc: 'UI grouping of 8 experiment toggles. See the project README for the agy.exe code that reads each one.',
        descZh: '界面分组,共 8 个实验开关。每个开关在 agy.exe 中的读取位置见项目 README。',
        badge: 'Cluster 6',
        badgeZh: '第 6 组',
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
        title: 'Cluster 7',
        titleZh: '第 7 组',
        desc: 'UI grouping of 10 experiment toggles. See the project README for the agy.exe code that reads each one.',
        descZh: '界面分组,共 10 个实验开关。每个开关在 agy.exe 中的读取位置见项目 README。',
        badge: 'Cluster 7',
        badgeZh: '第 7 组',
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
    const [queuedMessagesMode, setQueuedMessagesMode] = useState<string>('send-immediately');
    const [queueDepth, setQueueDepth] = useState<number>(0);
    const [isUpdatingQueue, setIsUpdatingQueue] = useState<boolean>(false);

    useEffect(() => {
        const fetchQueueInfo = async () => {
            try {
                const mode = await request<string>('get_cli_queued_messages');
                if (mode) setQueuedMessagesMode(mode);
            } catch (_) {}

            try {
                const status = await request<{ count: number }>('get_cli_queue_status');
                if (status && typeof status.count === 'number') {
                    setQueueDepth(status.count);
                }
            } catch (_) {}
        };
        fetchQueueInfo();
    }, []);

    const handleSetQueuedMessagesMode = async (mode: string) => {
        setIsUpdatingQueue(true);
        try {
            await request('set_cli_queued_messages', { mode });
            setQueuedMessagesMode(mode);
            showToast(
                isZh
                    ? `消息排队模式已更新为：${mode === 'send-immediately' ? '即时发送 (Send Immediately)' : '强制全部排队 (Queue All)'}`
                    : `Queued message delivery mode set to: ${mode}`,
                'success'
            );
        } catch (err) {
            showToast(`${isZh ? '更新失败' : 'Failed to update'}: ${err}`, 'error');
        } finally {
            setIsUpdatingQueue(false);
        }
    };

    const handleClearQueue = async () => {
        try {
            await request('clear_cli_queue');
            setQueueDepth(0);
            showToast(isZh ? '待办任务队列已清空' : 'Queue cleared successfully', 'success');
        } catch (err) {
            showToast(`${isZh ? '清空失败' : 'Failed to clear'}: ${err}`, 'error');
        }
    };

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
                            {isZh ? 'agy.exe 中的斜杠命令(原生表与注入表,描述为二进制中存储的原文)' : 'Slash commands in agy.exe (native and injected tables; descriptions are the strings stored in the binary)'}
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
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/goal</div>
                                <span className="text-[9px] text-gray-400">native</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Run until the specified goal is completely finished."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/compact</div>
                                <span className="text-[9px] text-gray-400">native</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Compact the conversation now (summarize history to free up the context window)."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/schedule</div>
                                <span className="text-[9px] text-gray-400">native</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Run an instruction on a recurring schedule or as a one-time timer."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/browser</div>
                                <span className="text-[9px] text-gray-400">native</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Invoke a browser agent for web tasks."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/browser-vision</div>
                                <span className="text-[9px] text-gray-400">native</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"[Teamfood] Invoke a browser with computer-use tools only with experimental model."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/plan</div>
                                <span className="text-[9px] text-gray-400">native</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Plan carefully before executing a task."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/grill-me</div>
                                <span className="text-[9px] text-gray-400">native</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Interview me to align on a plan."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/teamwork</div>
                                <span className="text-[9px] text-gray-400">native</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Invoke a team of agents to autonomously tackle large projects."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/learn</div>
                                <span className="text-[9px] text-gray-400">native</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Reflect on recent successes or corrections to capture reusable skills or rules."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/boost</div>
                                <span className="text-[9px] text-gray-400">native</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Invoke the Boost multi-agent orchestrator for complex tasks."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/deepagent</div>
                                <span className="text-[9px] text-gray-400">native</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Experimental. Invoke the deep agent to plan, build, verify complex coding tasks."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/review-agent</div>
                                <span className="text-[9px] text-gray-400">native</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Experimental. Invoke the review agent to audit code changes, surface bugs, and verify correctness."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/battle</div>
                                <span className="text-[9px] text-gray-400">injected</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Colosseum Battle Mode. Competing subagents in an adversarial arena."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/owl</div>
                                <span className="text-[9px] text-gray-400">injected</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Deep codebase investigation, iterative autonomous synthesis."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/swarm</div>
                                <span className="text-[9px] text-gray-400">injected</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Autonomous Multi-Agent Swarm Hub. Coordinates parallel specialist subagents."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/benchmark</div>
                                <span className="text-[9px] text-gray-400">injected</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Programmatic Tool Synthesis & Performance Benchmarking."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/generative_ui</div>
                                <span className="text-[9px] text-gray-400">injected</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Render dynamic interactive UI widgets, charts, and visualizations."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/compact</div>
                                <span className="text-[9px] text-gray-400">injected</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Compact and prune active conversation context history."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/teamwork-preview</div>
                                <span className="text-[9px] text-gray-400">injected</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Multi-agent teamwork subagent orchestrator and parallel preview execution."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/teamwork</div>
                                <span className="text-[9px] text-gray-400">injected</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Multi-agent teamwork subagent orchestrator (canonical alias)."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/teamwork-previews</div>
                                <span className="text-[9px] text-gray-400">injected</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Multi-agent teamwork subagent orchestrator (plural alias)."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/team</div>
                                <span className="text-[9px] text-gray-400">injected</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Multi-agent teamwork subagent orchestrator (shorthand alias)."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-purple-600 dark:text-purple-400">/flash</div>
                                <span className="text-[9px] text-gray-400">injected</span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{"Quick prompt execution with Gemini Flash model."}</div>
                        </div>
                        <div className="p-2 rounded bg-base-100/60 dark:bg-base-200/60 border border-purple-100 dark:border-purple-900/30 space-y-0.5 sm:col-span-2 lg:col-span-2 xl:col-span-2">
                            <div className="flex items-center justify-between">
                                <div className="font-mono font-bold text-amber-600 dark:text-amber-400">/queue &lt;task&gt;</div>
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700/40">
                                    Hybrid Mode
                                </span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isZh ? '异步排队执行：即时发送模式下延迟并按 FIFO 队列入队，空闲时通过 Stop 钩子自动取出' : 'Deferred task queue: Enqueue tasks to run FIFO after current task completes via Stop hook'}
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

            {/* 2.5 Queued Messages & Deferred Task Engine (/queue) */}
            <div className="bg-base-100/70 dark:bg-base-200/50 border border-purple-100 dark:border-purple-900/20 rounded-lg p-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-md bg-purple-100/50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
                            <ListOrdered size={16} />
                        </div>
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                                    {isZh ? '消息排队与异步任务调度 (/queue)' : 'Queued Messages & Deferred Task Engine (/queue)'}
                                </span>
                                <span className="text-[10px] px-2 py-0.2 rounded font-semibold bg-purple-100/70 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40">
                                    Hybrid Mode Active
                                </span>
                                {queueDepth > 0 ? (
                                    <span className="text-[10px] px-2 py-0.2 rounded font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700/50 animate-pulse">
                                        {queueDepth} {isZh ? '项待处理任务' : 'Pending Tasks'}
                                    </span>
                                ) : (
                                    <span className="text-[10px] px-2 py-0.2 rounded font-mono bg-base-200 dark:bg-base-300 text-base-content/60">
                                        0 Pending
                                    </span>
                                )}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {isZh
                                    ? '默认即时发送未完成任务时的普通消息，同时允许在聊天中输入 /queue <task> 显式加入队列，并在当前任务空闲（fullyIdle）时通过 Stop 钩子自动取出执行。'
                                    : 'Default behavior immediately dispatches interactive messages. Use /queue <task> to explicitly defer tasks to FIFO queue execution via Stop hook.'}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                        <div className="join border border-base-content/20 rounded-md overflow-hidden">
                            <button
                                type="button"
                                disabled={isUpdatingQueue}
                                onClick={() => handleSetQueuedMessagesMode('send-immediately')}
                                className={`btn btn-xs rounded-none border-none text-[11px] font-bold ${
                                    queuedMessagesMode === 'send-immediately'
                                        ? 'btn-primary text-white'
                                        : 'btn-ghost text-base-content'
                                }`}
                                title={isZh ? '全局即时发送（遇到/queue时排队）' : 'Send interactive messages immediately (defer only on /queue)'}
                            >
                                <Send size={11} className="mr-1" />
                                {isZh ? '即时发送 (默认)' : 'Send Immediately'}
                            </button>
                            <button
                                type="button"
                                disabled={isUpdatingQueue}
                                onClick={() => handleSetQueuedMessagesMode('queue')}
                                className={`btn btn-xs rounded-none border-none text-[11px] font-bold ${
                                    queuedMessagesMode === 'queue'
                                        ? 'btn-primary text-white'
                                        : 'btn-ghost text-base-content'
                                }`}
                                title={isZh ? '全部消息均排队等待' : 'Queue all messages during task execution'}
                            >
                                <Clock size={11} className="mr-1" />
                                {isZh ? '强制全部排队' : 'Queue All'}
                            </button>
                        </div>

                        {queueDepth > 0 && (
                            <button
                                type="button"
                                onClick={handleClearQueue}
                                className="btn btn-xs btn-error btn-outline rounded-none text-[11px] flex items-center gap-1 font-bold"
                                title={isZh ? '清空当前排队的任务' : 'Clear pending queue'}
                            >
                                <Trash2 size={11} />
                                {isZh ? '清空队列' : 'Clear Queue'}
                            </button>
                        )}
                    </div>
                </div>

                <div className="pt-2 border-t border-base-200 dark:border-base-300 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 font-mono flex-wrap gap-2">
                    <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Stop Hook: ~/.gemini/config/queue/scripts/queue-stop-hook.ps1
                    </span>
                    <span>
                        Queue Store: ~/.gemini/config/queue/pending.json
                    </span>
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
