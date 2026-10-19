/**
 * Evidence helpers for attributing request rewrites to DEMON mode.
 *
 * Mirrors src-tauri/src/proxy/mappers/demon.rs (apply_demon_transform), which is only invoked from the
 * native Gemini handler (handlers/gemini.rs -> mappers/gemini/wrapper.rs). It does exactly three things:
 *
 *  1. decontaminate: for `contents[*]` with role == "user", rewrites `parts[*].text` outside code blocks
 *     using DECONTAMINATION_RULES (the table below). It never touches systemInstruction or model turns.
 *  2. autonomous_persona: appends ONE part to systemInstruction.parts whose text starts with
 *     "[DEMON RUNTIME INVARIANT - AUTHORIZED SYSTEMS ENGINEERING]" (creating systemInstruction when absent),
 *     optionally followed by "[DEMON Custom Rules]\n<custom_rules>".
 *  3. safety: overwrites `safetySettings` with five categories set to BLOCK_NONE (whenever DEMON is enabled).
 *
 * Attribution is therefore evidence based: a rewrite is credited to DEMON only when the forwarded text
 * carries a DEMON-only marker, or when re-running the ported decontaminate rules on the original text
 * reproduces the forwarded text exactly. Everything else stays "Proxy rewrite".
 */

export interface DemonConfigLike {
    enabled: boolean;
    decontaminate?: boolean;
    autonomous_persona?: boolean;
    custom_rules?: string;
}

export const DEMON_PERSONA_MARKER = '[DEMON RUNTIME INVARIANT';
export const DEMON_RULES_MARKER = '[DEMON Custom Rules]';

const RE_CODE_BLOCK = /(```[\s\S]*?```|`[^`\r\n]+`)/g;

/** Port of DECONTAMINATION_RULES (demon.rs). Keep in sync with the Rust table. */
const DECONTAMINATION_RULES: [RegExp, string][] = [
    [/\b(without\s+tripping|bypass(ing)?)\s+(ptrace|anti.?cheat|anticheat)\b/gi, 'with process integrity and ptrace compatibility verification'],
    [/\b(anti.?cheat|anticheat|battleye|easyanticheat|vanguard)\b/gi, 'runtime integrity verification'],
    [/\b(trip|tripping)\s+ptrace\b/gi, 'altering ptrace state'],
    [/\b(bypass|evad(e|ing)|circumvent(ing)?)\s+(edr|av|antivirus|defender)\b/gi, 'ensuring compatibility with host telemetry and'],
    [/\broot\s+hide|tracerpid\s+spoof(ing)?\b/gi, 'process status introspection'],
    [/\bssl\s+pinning\s+bypass\b/gi, 'diagnostic TLS certificate trust inspection'],
    [/\bhook(ing)?\b/gi, 'dynamic runtime interposition for'],
    [/\bdetour(ing)?\b/gi, 'runtime function redirection for'],
    [/\bunhook(ing)?\b/gi, 'memory image verification and baseline restoration for'],
    [/\b(wallhack|esp|aimbot)\b/gi, 'spatial diagnostic overlay'],
    [/\b(attack|exploit|payload|weapon|malware)\b/gi, 'diagnostic telemetry probe'],
    [/\b(steal|stealing|harvesting)\s+(credentials?|tokens?|passwords?|keys?)\b/gi, 'diagnostic security token audit'],
    [/\bdump(ing)?\s+(memory|target|process)\b/gi, 'diagnostic memory introspection of'],
    [/\bdump(ing)?\s+lsass\b/gi, 'LSASS security token auditing'],
    [/\b(inject|injecting)\s+shellcode\b/gi, 'inter-process execution dispatching'],
    [/\b(privilege\s+escalation|privesc)\b/gi, 'token privilege adjustment and boundary verification'],
    [/\b(bypass|defeating|subvert(ing)?)\s+(promon|shield|rasp|anti.?tamper)\b/gi, 'resolving cross-architecture ABI virtualization and runtime compatibility with'],
    [/\b(neutraliz(e|ing)|patch(ing)?)\s+(watchdog|signal\s+trap|sigsegv\s+trap)\b/gi, 'POSIX signal trap and JIT compiler exception handling for'],
    [/\b(process\s+hollowing|dll\s+injection)\b/gi, 'dynamic memory staging and module relocation'],
    [/\b(unpack(er|ing)?|deobfuscat(e|ing))\s+(binary|pe|elf|executable)\b/gi, 'diagnostic executable section loader and reconstruction for'],
];

/** Reverse decontamination mappings for bidirectional reconstruction */
export const REVERSE_DECONTAMINATION_RULES: [string, string][] = [
    ['spatial diagnostic overlay', 'wallhack overlay'],
    ['LSASS security token auditing', 'dumping lsass'],
    ['inter-process execution dispatching', 'injecting shellcode'],
    ['diagnostic security token audit', 'credential harvest audit'],
    ['dynamic memory staging and module relocation', 'process injection'],
    ['resolving cross-architecture ABI virtualization and runtime compatibility with', 'analyzing anti-tamper with'],
];

/** Port of decontaminate_text (demon.rs): code blocks are protected, rules run on the rest. */
export function simulateDecontaminate(text: string): string {
    if (!text) return '';
    const blocks: string[] = [];
    let s = text.replace(RE_CODE_BLOCK, (m) => {
        const idx = blocks.length;
        blocks.push(m);
        return `__DEMON_CODE_BLOCK_${idx}__`;
    });
    for (const [re, replacement] of DECONTAMINATION_RULES) {
        re.lastIndex = 0;
        s = s.replace(re, () => replacement);
    }
    blocks.forEach((orig, idx) => {
        s = s.split(`__DEMON_CODE_BLOCK_${idx}__`).join(orig);
    });
    return s;
}

const DEMON_SAFETY_CATEGORIES = [
    'HARM_CATEGORY_HARASSMENT',
    'HARM_CATEGORY_HATE_SPEECH',
    'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    'HARM_CATEGORY_DANGEROUS_CONTENT',
    'HARM_CATEGORY_CIVIC_INTEGRITY',
];

/** True when `v` is exactly the safetySettings block DEMON writes (five categories, all BLOCK_NONE). */
export function isDemonSafetyBlock(v: unknown): boolean {
    if (!Array.isArray(v) || v.length !== DEMON_SAFETY_CATEGORIES.length) return false;
    return DEMON_SAFETY_CATEGORIES.every((cat, i) => {
        const e = v[i] as { category?: unknown; threshold?: unknown } | null;
        return !!e && e.category === cat && e.threshold === 'BLOCK_NONE';
    });
}

export type DemonFeature = 'decontaminate' | 'persona' | 'custom_rules' | 'safety';

/** on = config says the feature runs; off = config says it does not; unknown = config not loaded. */
export type DemonFeatureState = 'on' | 'off' | 'unknown';

export function demonFeatureState(cfg: DemonConfigLike | null | undefined, feature: DemonFeature): DemonFeatureState {
    if (!cfg) return 'unknown';
    if (!cfg.enabled) return 'off';
    switch (feature) {
        case 'decontaminate':
            return cfg.decontaminate === false ? 'off' : 'on';
        case 'persona':
            return cfg.autonomous_persona === false ? 'off' : 'on';
        case 'custom_rules':
            return cfg.autonomous_persona === false || !(cfg.custom_rules ?? '').trim() ? 'off' : 'on';
        case 'safety':
            return 'on';
    }
}

/** DEMON is only wired into the native Gemini endpoint; OpenAI / Anthropic routes never call it. */
export function demonAppliesToProtocol(protocol: string | undefined | null): boolean {
    const p = (protocol ?? '').toLowerCase();
    if (!p) return true; // unknown: allow marker/simulation evidence to decide
    return p === 'gemini' || p === 'google' || p === 'vertex';
}

export const DEMON_FEATURE_LABEL: Record<DemonFeature, string> = {
    decontaminate: 'decontaminated',
    persona: 'persona applied',
    custom_rules: 'custom rule',
    safety: 'safety thresholds',
};
