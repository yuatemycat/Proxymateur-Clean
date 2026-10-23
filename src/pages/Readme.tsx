import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Chip, LedgerRow, PageHeader, SectionRule } from '../components/common/ledger';
import Mascot from '../components/common/Mascot';
import { isTauri } from '../utils/env';

const SECTIONS = [
    { id: 'what', label: 'What is Proxymateur-Clean' },
    { id: 'quick-start', label: 'Quick start' },
    { id: 'pages', label: 'The pages' },
    { id: 'quotas', label: 'Accounts and quotas (Strict Decoupling)' },
    { id: 'lab', label: 'Antigravity Lab & Bundled Skills' },
    { id: 'governor', label: 'Auto-Compaction & CLI Status Line' },
    { id: 'byo-oauth', label: 'Bring-Your-Own (BYO) OAuth' },
    { id: 'files', label: 'Where things live' },
    { id: 'shortcuts', label: 'Keyboard shortcuts' },
] as const;

/** Inline code styling for paths, commands and values. */
function Code({ children }: { children: ReactNode }) {
    return <code className="font-mono text-[13px] bg-base-content/[0.06] rounded px-1.5 py-0.5">{children}</code>;
}

function P({ children }: { children: ReactNode }) {
    return <p className="text-sm leading-7 text-base-content/80">{children}</p>;
}

function InlineLink({ to, children }: { to: string; children: ReactNode }) {
    return (
        <Link to={to} className="text-base-content underline underline-offset-4 decoration-base-content/30 hover:decoration-base-content">
            {children}
        </Link>
    );
}

/** A section anchor target wrapping a SectionRule and its body. */
function Section({ id, index, label, children }: { id: string; index: string; label: string; children: ReactNode }) {
    return (
        <section id={id} className="scroll-mt-4">
            <SectionRule index={index} label={label} />
            <div className="space-y-3">{children}</div>
        </section>
    );
}

/** Ledger row with a fixed-width label column and wrapping description. */
function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
    return (
        <LedgerRow className="items-start">
            <div className="w-48 shrink-0 text-sm font-medium text-base-content">{label}</div>
            <div className="flex-1 min-w-0 text-sm leading-6 text-base-content/70">{children}</div>
        </LedgerRow>
    );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
    return (
        <LedgerRow className="items-start">
            <span className="w-6 shrink-0 text-sm tabular-nums text-base-content/35">{n}</span>
            <div className="flex-1 min-w-0 text-sm leading-6 text-base-content/80">{children}</div>
        </LedgerRow>
    );
}

function Kbd({ children }: { children: ReactNode }) {
    return (
        <kbd className="font-mono text-xs rounded border border-base-content/20 bg-base-content/[0.04] px-1.5 py-0.5">
            {children}
        </kbd>
    );
}

export default function Readme() {
    const [version, setVersion] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (isTauri()) {
            import('@tauri-apps/api/app')
                .then(({ getVersion }) => getVersion())
                .then(v => { if (!cancelled) setVersion(v); })
                .catch(() => { /* version is optional on this page */ });
        }
        return () => { cancelled = true; };
    }, []);

    const jump = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="h-full w-full overflow-y-auto overflow-x-hidden">
            <div className="p-5 pb-20 max-w-3xl mx-auto">
                <PageHeader
                    kicker="Guide"
                    title="Readme & Architecture"
                    status={
                        <>
                            <Chip tone="lime">Sovereign / No Proxy</Chip>
                            <Chip tone="ink">BYO OAuth</Chip>
                            {version && <Chip>v{version}</Chip>}
                        </>
                    }
                />

                {/* On this page */}
                <nav aria-label="On this page" className="mt-6">
                    <div className="text-xs text-base-content/50 mb-2">On this page</div>
                    <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                        {SECTIONS.map((s, i) => (
                            <li key={s.id}>
                                <button
                                    type="button"
                                    onClick={() => jump(s.id)}
                                    className="w-full text-left py-1.5 text-sm text-base-content/70 hover:text-base-content transition-colors"
                                >
                                    <span className="mr-2 tabular-nums text-base-content/35">{String(i + 1).padStart(2, '0')}</span>
                                    {s.label}
                                </button>
                            </li>
                        ))}
                    </ol>
                </nav>

                {/* 01 */}
                <Section id="what" index="01" label="What is Proxymateur-Clean">
                    <P>
                        <strong>Proxymateur-Clean</strong> is a sovereign, privacy-first desktop fleet manager and developer studio for your Google Antigravity accounts.
                    </P>
                    <P>
                        Unlike third-party proxies, Proxymateur-Clean has <strong>zero proxy servers, zero port listening, and zero background traffic interception</strong>.
                    </P>
                    <P>
                        Your credentials and session tokens remain 100% local on your workstation. You interact with Antigravity directly using your own Google Cloud OAuth 2.0 credentials or by scanning your local Antigravity installation.
                    </P>
                </Section>

                {/* 02 */}
                <Section id="quick-start" index="02" label="Quick start">
                    <div>
                        <Step n={1}>
                            Open <InlineLink to="/accounts">Accounts</InlineLink> and click <strong>Scan Local Antigravity DB</strong> to auto-import accounts already authenticated on this computer, or click <strong>Add Account</strong> with your own OAuth client.
                        </Step>
                        <Step n={2}>
                            Check the <InlineLink to="/">Dashboard</InlineLink> to inspect your live fleet capacity, model quotas, and 5-hour rolling or 7-day weekly reset timers.
                        </Step>
                        <Step n={3}>
                            Review past conversation logs, tool actions, and subagent transcripts locally in <InlineLink to="/chats/agy">Agy Chats</InlineLink>.
                        </Step>
                        <Step n={4}>
                            Open <InlineLink to="/settings">Settings</InlineLink> &rarr; <strong>Antigravity Lab</strong> to toggle the 15 experimental flags, install the 6 bundled productivity skills (<Code>/owl</Code>, <Code>/swarm</Code>, <Code>/battle</Code>, <Code>/compact</Code>, <Code>/benchmark</Code>, <Code>/generative_ui</Code>), and configure the Auto-Compaction Token Governor.
                        </Step>
                        <Step n={5}>
                            Turn on the <strong>CLI Terminal Status Line</strong> to display real-time active model, token usage (<Code>ctx: 45.2k (4.4% of 1M)</Code>), and generation throughput (<Code>88 tok/s</Code>) in your terminal prompt.
                        </Step>
                    </div>
                </Section>

                {/* 03 */}
                <Section id="pages" index="03" label="The pages">
                    <div>
                        <Row label={<InlineLink to="/">Dashboard</InlineLink>}>
                            Fleet health, remaining capacity matrix, active account card, and reset countdowns across your accounts.
                        </Row>
                        <Row label={<InlineLink to="/accounts">Accounts</InlineLink>}>
                            Add, import, export, and audit accounts, switch the active session account, run 1-click local Antigravity DB scans, and check credentials.
                        </Row>
                        <Row label={<InlineLink to="/chats/agy">Agy Chats</InlineLink>}>
                            Local conversation transcript explorer. Inspect historical prompts, tool calls, and subagent transcripts with zero external telemetry.
                        </Row>
                        <Row label={<InlineLink to="/settings">Settings</InlineLink>}>
                            Tabs for General, Account, OAuth Configuration (BYO OAuth), Advanced (Antigravity Lab &amp; Skills), Debug, and About.
                        </Row>
                    </div>
                </Section>

                {/* 04 */}
                <Section id="quotas" index="04" label="Accounts and quotas (Strict Decoupling)">
                    <P>
                        Antigravity accounts maintain independent quota pools for <strong>Gemini Models</strong> and <strong>Claude / 3P Models</strong>.
                    </P>
                    <div>
                        <Row label="Strict Quota Decoupling">
                            Claude/3P weekly quotas exhaust rapidly (often dropping to 0%), while Gemini quotas remain at 100%. Proxymateur-Clean guarantees that 3P exhaustion never downgrades, throttles, or zeroes out Gemini quota calculations, summaries, or sorting rank.
                        </Row>
                        <Row label="Reset Scheduling">
                            Tracks both 5-hour rolling windows and 7-day weekly reset pools with real-time countdown timers.
                        </Row>
                        <Row label="Low-Quota Alerts">
                            Configurable warning thresholds (5% to 50%) that alert you with non-blocking toasts and system notifications before an account reaches exhaustion.
                        </Row>
                        <Row label="Pinned Quota Models">
                            Customizes which model quotas appear on the main dashboard cards and account badges.
                        </Row>
                    </div>
                </Section>

                {/* 05 */}
                <Section id="lab" index="05" label="Antigravity Lab & Bundled Skills">
                    <P>
                        Located in <InlineLink to="/settings">Settings</InlineLink>, on the Advanced tab. Manages the complete matrix of 54
                        cutting-edge experimental flags organized into 7 functional groups, discovered through binary analysis of{' '}
                        <Code>language_server.exe</Code> and <Code>agy.exe</Code>. Changes sync directly to{' '}
                        <Code>~/.gemini/antigravity-cli/settings.json</Code> and are parsed by the CLI launch gateway.
                    </P>
                    <div>
                        <Row label="Dynamic Slash Commands">
                            <div className="space-y-1.5 text-xs text-base-content/80">
                                <div><Code>/owl &lt;task&gt;</Code> &mdash; Deep architectural synthesis via DeepInvestigator &amp; DeepCoder on full Gemini Pro.</div>
                                <div><Code>/swarm &lt;task&gt;</Code> &mdash; Autonomous Multi-Agent Swarm Hub executing end-to-end hands-free builds without confirmation stalls.</div>
                                <div><Code>/battle &lt;task&gt;</Code> &mdash; Colosseum Arena pitting two rival subagents against each other to debate code, benchmark performance, and crown a winner.</div>
                                <div><Code>/compact | /compaction</Code> &mdash; Prunes and compacts trajectory context cleanly to free up context window while preserving critical variables.</div>
                                <div><Code>/benchmark &lt;task&gt;</Code> &mdash; Programmatic dynamic tool synthesis to generate stress tests and measure frame budgets/latency.</div>
                                <div><Code>/generative_ui &lt;task&gt;</Code> &mdash; Interactive HTML5/JS/Canvas widgets rendered live inside chat artifacts.</div>
                                <div><Code>/compact</Code> &mdash; Trajectory pruning and context recycling while pinning session state.</div>
                                <div><Code>/plan &lt;task&gt;</Code> &mdash; Interactive step-by-step architectural planning and milestone execution.</div>
                                <div><Code>/btw &lt;query&gt;</Code> &mdash; Quick aside question rendered in an interactive overlay card (copy via <Code>/copy btw</Code>).</div>
                            </div>
                        </Row>
                        <Row label="Group 1: Multi-Agent & Swarm">
                            <div className="space-y-2">
                                <div className="text-xs text-base-content/80">
                                    Controls autonomous execution (<Code>jetski-autonomous-mode</Code>), subagent model tier inheritance (<Code>disable-teamwork-forced-flash-model</Code>),
                                    hub lifecycle (<Code>enable-subagent-hub</Code>), live telemetry monitoring (<Code>enable-swarm-monitor</Code>), conversation forking (<Code>enable-fork-with-subagents</Code>),
                                    reactive message dispatch (<Code>send-subagent-initial-prompt-as-message</Code>), swarm narrators (<Code>enable-swarm-narrator</Code>), and native visual generation (<Code>enable-image-generator-subagent</Code>).
                                </div>
                                <div className="text-[11px] font-mono text-base-content/65 bg-base-content/[0.04] p-2.5 rounded border border-base-content/10 whitespace-pre overflow-x-auto leading-relaxed">
{`// Verified Transcript Proof: Subagent Lifecycle & Messaging
{"step_index": 71, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "invoke_subagent", "arguments": {"Model": "flash", "Role": "Tier 1 Architect", "Prompt": "Refactor into Progressive Disclosure Architecture..."}}]}
{"step_index": 493, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "manage_subagents", "arguments": {"Action": "list"}}]}
{"step_index": 124, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "send_message", "arguments": {"Recipient": "subagent-worker-1", "Message": "Issue #13 serialization completed."}}]}`}
                                </div>
                            </div>
                        </Row>
                        <Row label="Group 2: Deep Exploration & Arena">
                            <div className="space-y-2">
                                <div className="text-xs text-base-content/80">
                                    Enables slash commands (<Code>enable-owl-slash-command</Code>, <Code>enable-compact-slash-command</Code>), adversarial duels (<Code>enable-battle-mode</Code>, <Code>enable-battle-mode-custom-agents</Code>),
                                    programmatic test synthesis (<Code>enable-programmatic-tools</Code>), Generative UI widgets (<Code>jetski-generative-ui</Code>), multi-pass reasoning (<Code>enable-deepagent</Code>), and audit gates (<Code>enable-review</Code>).
                                </div>
                                <div className="text-[11px] font-mono text-base-content/65 bg-base-content/[0.04] p-2.5 rounded border border-base-content/10 whitespace-pre overflow-x-auto leading-relaxed">
{`// Verified Transcript Proof: Programmatic Tool Synthesis (/benchmark)
{"step_index": 0, "type": "USER_INPUT", "content": "/benchmark Test the flags in Antigravity Lab..."}
{"step_index": 1, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "write_file", "arguments": {"Path": "scratch/benchmark_antigravity_lab.py", "Content": "#!/usr/bin/env python3\\nimport time..."}}]}
{"step_index": 2, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "run_command", "arguments": {"CommandLine": "python scratch/benchmark_antigravity_lab.py", "WaitMsBeforeAsync": 10000}}]}`}
                                </div>
                            </div>
                        </Row>
                        <Row label="Group 3: Customizations 2.0 & Plugins">
                            <div className="space-y-2">
                                <div className="text-xs text-base-content/80">
                                    Powers the modular plugin subsystem (<Code>enable-plugins</Code>), hook telemetry (<Code>enable-hook-status</Code>), discrete kinds (<Code>enable-customization-kind-agent</Code>, <Code>enable-customization-kind-skill</Code>, <Code>enable-customization-kind-rule</Code>, <Code>enable-customization-kind-mcp</Code>, <Code>enable-customization-kind-hooks</Code>), and legacy deprecation (<Code>deprecate-workflows</Code>).
                                </div>
                                <div className="text-[11px] font-mono text-base-content/65 bg-base-content/[0.04] p-2.5 rounded border border-base-content/10 whitespace-pre overflow-x-auto leading-relaxed">
{`// Verified Transcript Proof: Dynamic Subagent Persona Registration
{"step_index": 105, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "define_subagent", "arguments": {"Name": "ReadmeEngineer", "Description": "Specialist agent for technical documentation", "EnableMCPTools": true, "EnableWriteTools": true}}]}`}
                                </div>
                            </div>
                        </Row>
                        <Row label="Group 4: Sidecar Micro-Frontends">
                            <div className="text-xs text-base-content/80 leading-relaxed">
                                Unlocks embedded iframe companion webviews (<Code>enable-sidecars</Code>, <Code>enable-ui-sidecars</Code>), the companion Sidecar SDK (<Code>enable-sidecar-sdk</Code>),
                                manifest permission verification (<Code>jetski-sidecar-declared-permissions</Code>), local gateway routing (<Code>sidecar-gateway</Code>), and background iframe pre-warming (<Code>sidecar-iframe-prewarm</Code>).
                            </div>
                        </Row>
                        <Row label="Group 5: DeepMind AGI Safety & Guardrails">
                            <div className="text-xs text-base-content/80 leading-relaxed">
                                Enforces proactive command safety classifiers (<Code>enable-command-assessor</Code>), heuristic destructive pattern blockers (<Code>enable-command-antivirus</Code>),
                                experimental monitors (<Code>allow-experimental-monitors</Code>), workspace hygiene gates (<Code>enable-citc-workspace-hygiene-rule</Code>), LOAS2 credential bypass (<Code>disable-stained-loas2-creds</Code>),
                                and CDP-based browser automation (<Code>enable-browser-subagent-v2</Code>).
                            </div>
                        </Row>
                        <Row label="Group 6: Terminal & Execution Resilience">
                            <div className="space-y-2">
                                <div className="text-xs text-base-content/80">
                                    Provides persistent ConPTY pseudo-terminals (<Code>enable-persistent-terminals</Code>, <Code>enable-pty</Code>), high-speed ripgrep indexing (<Code>enable-ripgrep-path-search</Code>),
                                    non-blocking wait polling (<Code>enable-wait-tool</Code>), scheduled tasks v2 (<Code>scheduled-tasks-v2</Code>), capacity retry backoff (<Code>enable-model-capacity-exhausted-retries</Code>),
                                    non-blocking MCP turn loading (<Code>enable-mcp-non-blocking-turn-load</Code>), and remote peer checkpoint pinning (<Code>enable-remote-agent-fastpush-pin</Code>).
                                </div>
                                <div className="text-[11px] font-mono text-base-content/65 bg-base-content/[0.04] p-2.5 rounded border border-base-content/10 whitespace-pre overflow-x-auto leading-relaxed">
{`// Verified Transcript Proof: Scheduled Tasks v2 with Reactive TimerCondition
{"step_index": 242, "type": "PLANNER_RESPONSE", "tool_calls": [{"name": "schedule", "arguments": {"DurationSeconds": 30, "Prompt": "Check if release build has completed", "TimerCondition": "00fad603.../task-233", "ExactTiming": false}}]}`}
                                </div>
                            </div>
                        </Row>
                        <Row label="Group 7: Cortex State & Trajectory Engine">
                            <div className="text-xs text-base-content/80 leading-relaxed">
                                Manages filesystem snapshots and time-travel rewind (<Code>cortex-snapshot-recording</Code>, <Code>cortex-snapshot-revert</Code>), semantic past conversation vector search (<Code>enable-conversation-search-v2</Code>),
                                dynamic model switch toasts (<Code>show-model-selection-change</Code>), AST-guided surgical component rewriting (<Code>use-component-rewrite</Code>), direct core IPC transport (<Code>use-core-direct</Code>),
                                interactive plan mode (<Code>use-slash-plan</Code>), voice event streamers (<Code>enable-voice-activity-events</Code>), and cell-level notebook editors (<Code>cascade-enable-notebook-edit-tool</Code>, <Code>cascade-use-sed-edit-tool</Code>).
                            </div>
                        </Row>
                        <Row label="Benchmark & Telemetry Audit">
                            <div className="text-xs text-base-content/80 leading-relaxed">
                                Automated headless test harness (<Code>scripts/benchmark_antigravity_lab.py</Code>) verified 100% (54/54) flag parity across CLI launch regex patterns,
                                achieved 17,962,444 key translation ops/sec, and scanned 476 real conversation logs across 180,971 transcript lines at 459,552 lines/sec with zero regressions.
                            </div>
                        </Row>
                        <Row label="1-Click Skill Installation">
                            All 6 bundled skills are embedded directly into the app. Click <strong>⚡ Install Skills (1-Click)</strong> in Antigravity Lab to install them to <Code>~/.gemini/config/skills/</Code> instantly.
                        </Row>
                    </div>
                </Section>

                {/* 06 */}
                <Section id="governor" index="06" label="Auto-Compaction & CLI Status Line">
                    <div>
                        <Row label="Auto-Compaction Slider">
                            Interactive token governor slider (50k to 500k tokens). Writes <Code>model_auto_compact_token_limit</Code> directly to <Code>~/.gemini/antigravity-cli/settings.json</Code> so the CLI automatically compacts history when long turns or large command outputs approach the threshold.
                        </Row>
                        <Row label="CLI Terminal Status Line">
                            Injects a dynamic ANSI status line into the bottom of the Antigravity CLI prompt via native STDIN JSON piping:
                            <div className="font-mono text-xs bg-neutral-900 text-neutral-100 p-2 rounded my-1 border border-neutral-700/60">
                                <span className="text-cyan-400 font-bold">Gemini 3 Flash</span>
                                {'                                '}
                                <span className="text-amber-400">ctx: 45.2k (4.4% of 1M)</span>
                                <span className="text-neutral-500"> | </span>
                                <span className="text-emerald-400 font-bold">88 tok/s</span>
                            </div>
                            Zero external dependencies, cross-platform (Windows named pipes &amp; POSIX select), and 1-click toggle in Settings &rarr; Antigravity Lab.
                        </Row>
                    </div>
                </Section>

                {/* 07 */}
                <Section id="byo-oauth" index="07" label="Bring-Your-Own (BYO) OAuth">
                    <P>
                        To ensure complete sovereignty and eliminate shared rate limits, Proxymateur-Clean uses your own Google Cloud Console OAuth 2.0 Client credentials:
                    </P>
                    <div>
                        <Row label="Configuring in GUI">
                            Navigate to <InlineLink to="/settings">Settings</InlineLink> &rarr; <strong>OAuth Configuration</strong>. Click <strong>Add Client</strong> and enter your Client ID and Client Secret from the Google Cloud Console.
                        </Row>
                        <Row label="Via Environment Variable">
                            Set <Code>ANTIGRAVITY_OAUTH_CLIENTS=&quot;key|client_id|client_secret|Label&quot;</Code> to supply credentials automatically on launch.
                        </Row>
                    </div>
                </Section>

                {/* 08 */}
                <Section id="files" index="08" label="Where things live">
                    <P>
                        All configuration files and local state reside strictly on your local filesystem:
                    </P>
                    <div>
                        <Row label={<Code>~/.proxymateur/</Code>}>
                            Contains <Code>accounts.json</Code> (account index), <Code>gui_config.json</Code> (preferences and lab settings), and account tokens in <Code>accounts/</Code>.
                        </Row>
                        <Row label={<Code>~/.gemini/antigravity-cli/</Code>}>
                            Antigravity CLI configuration: <Code>settings.json</Code>, <Code>statusline.py</Code>, and conversation transcripts in <Code>brain/&lt;session_id&gt;/</Code>.
                        </Row>
                        <Row label={<Code>~/.gemini/config/skills/</Code>}>
                            User skills directory containing installed bundled skills (<Code>owl</Code>, <Code>swarm</Code>, <Code>battle</Code>, <Code>compact</Code>, <Code>benchmark</Code>, <Code>generative_ui</Code>).
                        </Row>
                    </div>
                </Section>

                {/* 09 */}
                <Section id="shortcuts" index="09" label="Keyboard shortcuts">
                    <div>
                        <Row label={<><Kbd>Ctrl</Kbd> + <Kbd>K</Kbd></>}>
                            Quick jump palette to navigate between Dashboard, Accounts, Agy Chats, and Settings. (On macOS use <Kbd>Cmd</Kbd> + <Kbd>K</Kbd>).
                        </Row>
                        <Row label={<><Kbd>Esc</Kbd></>}>
                            Close active modals or dismiss jump palette.
                        </Row>
                    </div>
                </Section>

                <div className="mt-14 pt-6 border-t border-base-content/10 flex items-center gap-4">
                    <Mascot size={34} className="shrink-0 text-base-content/70" face="var(--color-base-100)" />
                    <p className="text-sm text-base-content/60">
                        Proxymateur-Clean &mdash; Forked from lbjlaq/Antigravity-Manager (CC BY-NC-SA 4.0). Maintained by Yuatemycat.
                    </p>
                </div>
            </div>
        </div>
    );
}
