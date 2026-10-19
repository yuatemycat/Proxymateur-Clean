/**
 * "What the proxy changed": compares the request as received with the request as forwarded upstream
 * and returns a grouped, human-oriented report. Pure and defensive: never throws.
 *
 * Same-shape comparisons (Gemini in, Gemini envelope out) use diffPayload for the generic remainder.
 * Cross-protocol requests (OpenAI / Anthropic in, Gemini out) are compared on canonical fields only
 * (model, system prompt, thinking, tools, generation settings) because the trees are not comparable.
 */
import {
    MAX_TEXT_DIFF_CHARS,
    collapseSegments,
    deepEqual,
    diffPayload,
    diffText,
    isPlainObject,
    parseJsonLoose,
    replacementPairs,
    type DiffKind,
    type TextSeg,
} from './payloadDiff';
import {
    DEMON_FEATURE_LABEL,
    DEMON_PERSONA_MARKER,
    DEMON_RULES_MARKER,
    demonAppliesToProtocol,
    demonFeatureState,
    isDemonSafetyBlock,
    simulateDecontaminate,
    type DemonConfigLike,
    type DemonFeature,
} from './demonAttribution';

export type Shape = 'gemini' | 'openai' | 'claude' | 'unknown';

export interface Tag {
    source: 'demon' | 'proxy';
    label: string;
    note?: string;
}

export interface ChangeRow {
    label: string;
    kind: DiffKind;
    before?: string;
    after?: string;
    count?: number;
    tag?: Tag;
}

export interface SystemChange {
    beforeChars: number;
    afterChars: number;
    /** Collapsed word diff, or null when skipped (payload too large). */
    segments: TextSeg[] | null;
    coarse: boolean;
    addedChars: number;
    removedChars: number;
    tags: Tag[];
}

export interface ConvChange {
    where: string;
    kind: DiffKind;
    before?: string;
    after?: string;
    beforeChars: number;
    afterChars: number;
    segments: TextSeg[] | null;
    addedChars: number;
    removedChars: number;
    tag: Tag;
}

export interface DemonChange {
    feature: DemonFeature;
    label: string;
    where: string;
    before?: string;
    after?: string;
    pairs?: { from: string; to: string }[];
    tag: Tag;
}

export type ReportStatus = 'ok' | 'no_request' | 'no_forwarded' | 'invalid' | 'too_large';

export interface ChangeReport {
    status: ReportStatus;
    message?: string;
    fromShape: Shape;
    toShape: Shape;
    translated: boolean;
    identical: boolean;
    identifierCount: number;
    textDiffSkipped: boolean;
    model: ChangeRow | null;
    system: SystemChange | null;
    thinking: ChangeRow[];
    tools: ChangeRow[];
    generation: ChangeRow[];
    safety: ChangeRow[];
    conversation: ConvChange[];
    conversationHidden: number;
    conversationNote?: string;
    other: ChangeRow[];
    demon: DemonChange[];
    protocolApplies: boolean;
    /** Short names of the groups that contain changes, for the "what happened" line. */
    summaryLabels: string[];
}

export interface AnalyzeInput {
    requestRaw?: string | null;
    forwardedRaw?: string | null;
    requestedModel?: string | null;
    routedModel?: string | null;
    protocol?: string | null;
    demon?: DemonConfigLike | null;
}

/* ------------------------------------------------------------------ canonical view */

interface Canon {
    shape: Shape;
    root: Record<string, unknown>;
    envelope: Record<string, unknown> | null;
    inner: Record<string, unknown>;
    model?: string;
    system: string[];
    thinking: Record<string, unknown>;
    generation: Record<string, unknown>;
    tools: Map<string, string>;
    toolChoice?: unknown;
    safety?: unknown;
    messageCount: number;
}

function str(v: unknown): string | undefined {
    return typeof v === 'string' && v ? v : undefined;
}

function textOf(v: unknown, depth = 0): string[] {
    if (depth > 4 || v == null) return [];
    if (typeof v === 'string') return v ? [v] : [];
    if (Array.isArray(v)) return v.flatMap((x) => textOf(x, depth + 1));
    if (isPlainObject(v)) {
        if (typeof v.text === 'string') return v.text ? [v.text] : [];
        if (Array.isArray(v.parts)) return textOf(v.parts, depth + 1);
        if (v.content !== undefined) return textOf(v.content, depth + 1);
    }
    return [];
}

function detectShape(inner: Record<string, unknown>): Shape {
    if (Array.isArray(inner.contents)) return 'gemini';
    if (Array.isArray(inner.messages)) {
        const tools = inner.tools;
        const firstTool = Array.isArray(tools) && isPlainObject(tools[0]) ? tools[0] : null;
        if (
            inner.system !== undefined ||
            inner.anthropic_version !== undefined ||
            (isPlainObject(inner.thinking) && typeof inner.thinking.type === 'string') ||
            (firstTool && firstTool.input_schema !== undefined)
        ) {
            return 'claude';
        }
        return 'openai';
    }
    if (inner.input !== undefined || inner.instructions !== undefined) return 'openai';
    return 'unknown';
}

function putThinking(out: Record<string, unknown>, key: string, value: unknown): void {
    if (value === undefined) return;
    const k = key.toLowerCase();
    if (k === 'thinkingbudget' || k === 'thinking_budget' || k === 'budget_tokens') out.budget = value;
    else if (k === 'thinkinglevel' || k === 'thinking_level' || k === 'effort' || k === 'reasoning_effort') out.level = value;
    else if (k === 'includethoughts' || k === 'include_thoughts') out.includeThoughts = value;
    else if (k === 'type') out.mode = value;
    else out[key] = value;
}

const GEN_ALIASES: Record<string, string> = {
    max_tokens: 'maxOutputTokens',
    max_completion_tokens: 'maxOutputTokens',
    max_output_tokens: 'maxOutputTokens',
    top_p: 'topP',
    top_k: 'topK',
    stop: 'stopSequences',
    stop_sequences: 'stopSequences',
    presence_penalty: 'presencePenalty',
    frequency_penalty: 'frequencyPenalty',
    n: 'candidateCount',
};
const GEN_KEYS = ['temperature', 'seed', 'response_format'];

function canonicalize(root: unknown): Canon | null {
    if (!isPlainObject(root)) return null;
    const hasEnvelopeKey = 'project' in root || 'requestId' in root || 'userAgent' in root || 'model' in root;
    const envelope = isPlainObject(root.request) && hasEnvelopeKey ? root : null;
    const inner = envelope ? (envelope.request as Record<string, unknown>) : root;
    const shape = detectShape(inner);

    const system: string[] = [];
    const thinking: Record<string, unknown> = {};
    const generation: Record<string, unknown> = {};
    const tools = new Map<string, string>();
    let toolChoice: unknown;
    let safety: unknown;
    let messageCount = 0;

    if (shape === 'gemini') {
        system.push(...textOf(inner.systemInstruction ?? inner.system_instruction));
        const gc = inner.generationConfig ?? inner.generation_config;
        if (isPlainObject(gc)) {
            for (const [k, v] of Object.entries(gc)) {
                if (k === 'thinkingConfig' || k === 'thinking_config') {
                    if (isPlainObject(v)) for (const [tk, tv] of Object.entries(v)) putThinking(thinking, tk, tv);
                } else generation[GEN_ALIASES[k] ?? k] = v;
            }
        }
        const topTc = inner.thinkingConfig ?? inner.thinking_config;
        if (isPlainObject(topTc)) for (const [tk, tv] of Object.entries(topTc)) putThinking(thinking, tk, tv);
        if (Array.isArray(inner.tools)) {
            for (const t of inner.tools) {
                if (!isPlainObject(t)) continue;
                const decls = t.functionDeclarations ?? t.function_declarations;
                if (Array.isArray(decls)) {
                    for (const d of decls) {
                        if (isPlainObject(d) && typeof d.name === 'string') tools.set(d.name, safeJson(d));
                    }
                }
                for (const [k, v] of Object.entries(t)) {
                    if (k === 'functionDeclarations' || k === 'function_declarations') continue;
                    tools.set(k, safeJson(v));
                }
            }
        }
        const tcfg = inner.toolConfig ?? inner.tool_config;
        if (isPlainObject(tcfg)) {
            const fc = tcfg.functionCallingConfig ?? tcfg.function_calling_config;
            toolChoice = isPlainObject(fc) ? fc.mode ?? fc : tcfg;
        }
        safety = Array.isArray(inner.safetySettings) && inner.safetySettings.length === 0 ? undefined : inner.safetySettings;
        messageCount = (inner.contents as unknown[]).length;
    } else {
        if (shape === 'claude') {
            system.push(...textOf(inner.system));
            if (isPlainObject(inner.thinking)) {
                for (const [k, v] of Object.entries(inner.thinking)) putThinking(thinking, k, v);
            }
            const oc = inner.output_config;
            if (isPlainObject(oc) && oc.effort !== undefined) putThinking(thinking, 'effort', oc.effort);
        } else if (shape === 'openai') {
            if (typeof inner.instructions === 'string' && inner.instructions) system.push(inner.instructions);
            if (inner.reasoning_effort !== undefined) putThinking(thinking, 'reasoning_effort', inner.reasoning_effort);
            if (isPlainObject(inner.reasoning) && inner.reasoning.effort !== undefined) {
                putThinking(thinking, 'effort', inner.reasoning.effort);
            }
        }
        if (Array.isArray(inner.messages)) {
            messageCount = inner.messages.length;
            if (shape === 'openai') {
                for (const m of inner.messages) {
                    if (isPlainObject(m) && (m.role === 'system' || m.role === 'developer')) system.push(...textOf(m.content));
                }
            }
        }
        for (const [k, v] of Object.entries(inner)) {
            if (GEN_ALIASES[k]) generation[GEN_ALIASES[k]] = v;
            else if (GEN_KEYS.includes(k)) generation[k] = v;
        }
        if (Array.isArray(inner.tools)) {
            for (const t of inner.tools) {
                if (!isPlainObject(t)) continue;
                const fn = isPlainObject(t.function) ? t.function : t;
                const name = str(fn.name) ?? str(t.type);
                if (name) tools.set(name, safeJson(fn));
            }
        }
        toolChoice = inner.tool_choice;
    }

    const model = str(envelope ? envelope.model : undefined) ?? str(inner.model);
    return { shape, root, envelope, inner, model, system, thinking, generation, tools, toolChoice, safety, messageCount };
}

function safeJson(v: unknown): string {
    try {
        return JSON.stringify(v) ?? '';
    } catch {
        return '';
    }
}

function short(v: unknown, max = 140): string | undefined {
    if (v === undefined) return undefined;
    let s: string;
    if (typeof v === 'string') s = v;
    else s = safeJson(v);
    s = s.replace(/\s+/g, ' ').trim();
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function rowKind(b: unknown, a: unknown): DiffKind {
    if (b === undefined) return 'added';
    if (a === undefined) return 'removed';
    return 'changed';
}

function recordRows(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    label: (key: string) => string,
): ChangeRow[] {
    const rows: ChangeRow[] = [];
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const k of keys) {
        const b = before[k];
        const a = after[k];
        if (deepEqual(b, a)) continue;
        rows.push({ label: label(k), kind: rowKind(b, a), before: short(b), after: short(a) });
    }
    return rows;
}

const THINKING_LABELS: Record<string, string> = {
    budget: 'Thinking budget',
    level: 'Thinking level',
    includeThoughts: 'Include thoughts',
    mode: 'Thinking mode',
};
const GENERATION_LABELS: Record<string, string> = {
    maxOutputTokens: 'Max output tokens',
    temperature: 'Temperature',
    topP: 'Top-p',
    topK: 'Top-k',
    stopSequences: 'Stop sequences',
    candidateCount: 'Candidate count',
};

const NOISE_LEAF = /^(id|requestId|request_id|sessionId|session_id|userAgent|user_agent|timestamp|createTime|updateTime|project|traceId|trace_id)$/i;

function isNoisePath(path: string): boolean {
    const leaf = path.replace(/\[[^\]]*\]$/, '').split('.').pop() ?? '';
    return NOISE_LEAF.test(leaf) || /(Id|_id)$/.test(leaf);
}

function stripModel(m: string): string {
    return m.replace(/^models\//, '');
}

/* ------------------------------------------------------------------ analysis */

const EMPTY: Omit<ChangeReport, 'status'> = {
    fromShape: 'unknown',
    toShape: 'unknown',
    translated: false,
    identical: false,
    identifierCount: 0,
    textDiffSkipped: false,
    model: null,
    system: null,
    thinking: [],
    tools: [],
    generation: [],
    safety: [],
    conversation: [],
    conversationHidden: 0,
    other: [],
    demon: [],
    protocolApplies: true,
    summaryLabels: [],
};

function failed(status: ReportStatus, message: string, protocol?: string | null): ChangeReport {
    return { ...EMPTY, status, message, protocolApplies: demonAppliesToProtocol(protocol) };
}

interface TextItem {
    idx: number;
    role: string;
    text: string;
}

function convTexts(contents: unknown): TextItem[] {
    const out: TextItem[] = [];
    if (!Array.isArray(contents)) return out;
    contents.forEach((c, idx) => {
        if (!isPlainObject(c) || !Array.isArray(c.parts)) return;
        const role = typeof c.role === 'string' ? c.role : '';
        for (const p of c.parts) {
            if (isPlainObject(p) && typeof p.text === 'string' && p.text && p.thought !== true) {
                out.push({ idx, role, text: p.text });
            }
        }
    });
    return out;
}

const MAX_CONV_DIFFS = 40;
const MAX_CONV_ROWS = 30;
const MAX_SIMULATE_CHARS = 1_500_000;

export function analyzeRequestChanges(input: AnalyzeInput): ChangeReport {
    try {
        return analyzeInner(input);
    } catch (e) {
        return failed('invalid', `Could not compare payloads (${e instanceof Error ? e.message : 'unexpected error'}).`, input.protocol);
    }
}

function analyzeInner(input: AnalyzeInput): ChangeReport {
    const { requestRaw, forwardedRaw, protocol } = input;
    if (!requestRaw) return failed('no_request', 'The original request payload was not recorded, so there is nothing to compare.', protocol);
    if (!forwardedRaw) {
        return failed('no_forwarded', 'No forwarded payload was recorded (direct forwarding or unrecorded), so there is nothing to compare.', protocol);
    }
    const pb = parseJsonLoose(requestRaw);
    const pa = parseJsonLoose(forwardedRaw);
    if (!pb.ok || !pa.ok) {
        const tooLarge = (!pb.ok && pb.reason === 'too_large') || (!pa.ok && pa.reason === 'too_large');
        if (tooLarge) return failed('too_large', 'A payload is larger than 25 MB, so the comparison was skipped.', protocol);
        const which = !pb.ok ? 'request' : 'forwarded request';
        return failed('invalid', `The ${which} payload is not valid JSON, so it cannot be compared.`, protocol);
    }
    const before = canonicalize(pb.value);
    const after = canonicalize(pa.value);
    if (!before || !after) return failed('invalid', 'The payloads are not JSON objects, so they cannot be compared.', protocol);

    const textDiffSkipped = Math.max(requestRaw.length, forwardedRaw.length) > MAX_TEXT_DIFF_CHARS;
    const applies = demonAppliesToProtocol(protocol);
    const cfg = input.demon ?? null;
    const comparable = before.shape === 'gemini' && after.shape === 'gemini';
    const translated = !comparable;

    const tagFor = (feature: DemonFeature): Tag => {
        if (!applies) return { source: 'proxy', label: 'Proxy rewrite' };
        const st = demonFeatureState(cfg, feature);
        if (st === 'off') {
            return {
                source: 'proxy',
                label: 'Changed by the proxy (DEMON currently off)',
                note: 'The change matches what DEMON writes, so it was probably on when this request ran.',
            };
        }
        return { source: 'demon', label: DEMON_FEATURE_LABEL[feature] };
    };
    const proxyTag: Tag = { source: 'proxy', label: 'Proxy rewrite' };

    const report: ChangeReport = {
        ...EMPTY,
        status: 'ok',
        fromShape: before.shape,
        toShape: after.shape,
        translated,
        textDiffSkipped,
        protocolApplies: applies,
        thinking: [],
        tools: [],
        generation: [],
        safety: [],
        conversation: [],
        other: [],
        demon: [],
        summaryLabels: [],
    };

    /* identifiers */
    let identifierCount = 0;
    if (after.envelope) {
        for (const k of ['project', 'requestId', 'userAgent']) {
            if (k in after.envelope && !deepEqual(before.root[k], after.envelope[k])) identifierCount++;
        }
    }
    const sidB = before.inner.sessionId;
    const sidA = after.inner.sessionId;
    if (sidA !== undefined && !deepEqual(sidB, sidA)) identifierCount++;

    /* model */
    const reqModel = before.model ?? str(input.requestedModel);
    const outModel = after.model ?? str(input.routedModel);
    if (reqModel && outModel && stripModel(reqModel) !== stripModel(outModel)) {
        report.model = { label: 'Model', kind: 'changed', before: reqModel, after: outModel };
    }

    /* system prompt */
    const joinedB = before.system.join('\n\n');
    const joinedA = after.system.join('\n\n');
    const demonChanges: DemonChange[] = [];
    if (joinedB !== joinedA) {
        const remaining = new Map<string, number>();
        for (const s of before.system) remaining.set(s, (remaining.get(s) ?? 0) + 1);
        const addedParts: string[] = [];
        for (const s of after.system) {
            const n = remaining.get(s) ?? 0;
            if (n > 0) remaining.set(s, n - 1);
            else addedParts.push(s);
        }
        const tags: Tag[] = [];
        const pushTag = (t: Tag) => {
            if (!tags.some((x) => x.label === t.label)) tags.push(t);
        };
        let unmarked = false;
        for (const part of addedParts) {
            const pIdx = part.indexOf(DEMON_PERSONA_MARKER);
            if (pIdx < 0) {
                unmarked = true;
                continue;
            }
            const rIdx = part.indexOf(DEMON_RULES_MARKER, pIdx);
            const personaText = part.slice(pIdx, rIdx >= 0 ? rIdx : undefined).trim();
            const rulesText = rIdx >= 0 ? part.slice(rIdx + DEMON_RULES_MARKER.length).trim() : '';
            const t1 = tagFor('persona');
            pushTag(t1);
            demonChanges.push({
                feature: 'persona',
                label: DEMON_FEATURE_LABEL.persona,
                where: 'System prompt, appended part',
                after: personaText,
                tag: t1,
            });
            if (rulesText) {
                const t2 = tagFor('custom_rules');
                pushTag(t2);
                demonChanges.push({
                    feature: 'custom_rules',
                    label: DEMON_FEATURE_LABEL.custom_rules,
                    where: 'System prompt, appended part',
                    after: rulesText,
                    tag: t2,
                });
            }
        }
        if (unmarked || addedParts.length === 0) {
            pushTag({
                ...proxyTag,
                note: 'Not DEMON-marked. The proxy can also append a configured global system prompt.',
            });
        }
        const diff = textDiffSkipped ? null : diffText(joinedB, joinedA);
        report.system = {
            beforeChars: joinedB.length,
            afterChars: joinedA.length,
            segments: diff ? collapseSegments(diff.segments) : null,
            coarse: diff?.coarse ?? false,
            addedChars: diff?.addedChars ?? Math.max(0, joinedA.length - joinedB.length),
            removedChars: diff?.removedChars ?? Math.max(0, joinedB.length - joinedA.length),
            tags,
        };
    }

    /* thinking, generation, tools, safety */
    report.thinking = recordRows(before.thinking, after.thinking, (k) => THINKING_LABELS[k] ?? `Thinking: ${k}`);
    report.generation = recordRows(before.generation, after.generation, (k) => GENERATION_LABELS[k] ?? k);

    {
        const added: string[] = [];
        const removed: string[] = [];
        const changed: string[] = [];
        for (const [name, sig] of after.tools) {
            if (!before.tools.has(name)) added.push(name);
            else if (comparable && sig !== before.tools.get(name)) changed.push(name);
        }
        for (const name of before.tools.keys()) if (!after.tools.has(name)) removed.push(name);
        const names = (l: string[]) => short(l.join(', '), 200);
        if (added.length) report.tools.push({ label: `Tools added (${added.length})`, kind: 'added', after: names(added), count: added.length });
        if (removed.length) report.tools.push({ label: `Tools removed (${removed.length})`, kind: 'removed', before: names(removed), count: removed.length });
        if (changed.length === 1) {
            report.tools.push({
                label: `Tool schema rewritten: ${changed[0]}`,
                kind: 'changed',
                before: short(before.tools.get(changed[0]), 220),
                after: short(after.tools.get(changed[0]), 220),
            });
        } else if (changed.length > 1) {
            report.tools.push({ label: `Tool schemas rewritten (${changed.length})`, kind: 'changed', after: names(changed), count: changed.length });
        }
        if (comparable && !deepEqual(before.toolChoice, after.toolChoice)) {
            report.tools.push({
                label: 'Tool choice',
                kind: rowKind(before.toolChoice, after.toolChoice),
                before: short(before.toolChoice),
                after: short(after.toolChoice),
            });
        }
    }

    if (!deepEqual(before.safety, after.safety)) {
        const describe = (v: unknown): string | undefined => {
            if (v === undefined) return undefined;
            if (isDemonSafetyBlock(v)) return '5 categories set to BLOCK_NONE';
            return Array.isArray(v) ? `${v.length} setting${v.length === 1 ? '' : 's'}` : short(v);
        };
        const evidence = isDemonSafetyBlock(after.safety) && !isDemonSafetyBlock(before.safety);
        const tag = evidence ? tagFor('safety') : proxyTag;
        report.safety.push({
            label: 'Safety settings',
            kind: rowKind(before.safety, after.safety),
            before: describe(before.safety) ?? 'not set',
            after: describe(after.safety) ?? 'not set',
            tag,
        });
        if (evidence) {
            demonChanges.push({
                feature: 'safety',
                label: DEMON_FEATURE_LABEL.safety,
                where: 'safetySettings',
                before: describe(before.safety) ?? 'not set',
                after: describe(after.safety),
                tag,
            });
        }
    }

    /* conversation */
    if (comparable) {
        const bt = convTexts(before.inner.contents);
        const at = convTexts(after.inner.contents);
        const afterBy = new Map<string, TextItem[]>();
        for (const it of at) {
            const l = afterBy.get(it.text);
            if (l) l.push(it);
            else afterBy.set(it.text, [it]);
        }
        let leftB: TextItem[] = [];
        for (const it of bt) {
            const l = afterBy.get(it.text);
            if (l && l.length) l.shift();
            else leftB.push(it);
        }
        let leftA: TextItem[] = [];
        for (const l of afterBy.values()) leftA.push(...l);
        leftA.sort((x, y) => x.idx - y.idx);

        const changes: ConvChange[] = [];
        const label = (it: TextItem) => `Message ${it.idx + 1}${it.role ? ` (${it.role})` : ''}`;
        const mk = (kind: DiffKind, b: TextItem | null, a: TextItem | null, tag: Tag, withDiff: boolean): ConvChange => {
            const diff = withDiff && b && a && !textDiffSkipped ? diffText(b.text, a.text) : null;
            return {
                where: label((a ?? b) as TextItem),
                kind,
                before: b?.text,
                after: a?.text,
                beforeChars: b?.text.length ?? 0,
                afterChars: a?.text.length ?? 0,
                segments: diff ? collapseSegments(diff.segments) : null,
                addedChars: diff?.addedChars ?? (a?.text.length ?? 0),
                removedChars: diff?.removedChars ?? (b?.text.length ?? 0),
                tag,
            };
        };

        /* 1. exact decontaminate matches (evidence: re-running the DEMON rules reproduces the forwarded text) */
        if (!textDiffSkipped && leftB.length && leftA.length) {
            const byText = new Map<string, TextItem[]>();
            for (const it of leftA) {
                const l = byText.get(it.text);
                if (l) l.push(it);
                else byText.set(it.text, [it]);
            }
            const usedA = new Set<TextItem>();
            const rest: TextItem[] = [];
            for (const b of leftB) {
                let matched: TextItem | undefined;
                if (b.role === 'user' && b.text.length <= MAX_SIMULATE_CHARS) {
                    const sim = simulateDecontaminate(b.text);
                    if (sim !== b.text) matched = byText.get(sim)?.shift();
                }
                if (matched) {
                    usedA.add(matched);
                    const tag = applies ? tagFor('decontaminate') : proxyTag;
                    const c = mk('changed', b, matched, tag, true);
                    changes.push(c);
                    if (applies) {
                        const diff = diffText(b.text, matched.text);
                        demonChanges.push({
                            feature: 'decontaminate',
                            label: DEMON_FEATURE_LABEL.decontaminate,
                            where: c.where,
                            pairs: diff ? replacementPairs(diff.segments, 24) : undefined,
                            tag,
                            before: c.beforeChars <= 4000 ? b.text : undefined,
                            after: c.afterChars <= 4000 ? matched.text : undefined,
                        });
                    }
                } else rest.push(b);
            }
            leftB = rest;
            leftA = leftA.filter((x) => !usedA.has(x));
        }

        /* 2. remaining texts: pair in order per role as generic rewrites, the rest are added/removed */
        let diffs = 0;
        for (const b of leftB) {
            const k = leftA.findIndex((a) => a.role === b.role);
            if (k >= 0) {
                const [a] = leftA.splice(k, 1);
                changes.push(mk('changed', b, a, proxyTag, diffs++ < MAX_CONV_DIFFS));
            } else changes.push(mk('removed', b, null, proxyTag, false));
        }
        for (const a of leftA) changes.push(mk('added', null, a, proxyTag, false));

        changes.sort((x, y) => x.where.localeCompare(y.where, undefined, { numeric: true }));
        report.conversation = changes.slice(0, MAX_CONV_ROWS);
        report.conversationHidden = Math.max(0, changes.length - MAX_CONV_ROWS);

        /* structural remainder: equal-length conversations are tree-diffed ignoring text leaves */
        const bc = before.inner.contents as unknown[];
        const ac = after.inner.contents as unknown[];
        if (bc.length !== ac.length) {
            report.conversationNote = `${bc.length} message${bc.length === 1 ? '' : 's'} received, ${ac.length} forwarded.`;
        } else {
            const entries = diffPayload(bc, ac, 1500).filter(
                (e) => !(e.kind === 'changed' && e.path.endsWith('.text') && typeof e.before === 'string' && typeof e.after === 'string'),
            );
            addAggregated(report, entries, 'contents');
        }
    } else {
        const bn = before.messageCount;
        const an = after.messageCount;
        const names = { openai: 'OpenAI', claude: 'Anthropic', gemini: 'Gemini', unknown: 'unknown' } as const;
        report.conversationNote =
            `Translated from ${names[before.shape]} format to ${names[after.shape]} format` +
            (bn || an ? ` (${bn} message${bn === 1 ? '' : 's'} in, ${an} out).` : '.');
    }

    /* everything else (same-shape only) */
    if (comparable) {
        const HANDLED = new Set([
            'model', 'systemInstruction', 'system_instruction', 'generationConfig', 'generation_config',
            'thinkingConfig', 'thinking_config', 'tools', 'toolConfig', 'tool_config', 'safetySettings',
            'contents', 'sessionId',
        ]);
        const strip = (o: Record<string, unknown>) => {
            const r: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(o)) if (!HANDLED.has(k)) r[k] = v;
            return r;
        };
        addAggregated(report, diffPayload(strip(before.inner), strip(after.inner), 1500), '');
    }
    if (after.envelope && typeof after.envelope.requestType === 'string' && before.root.requestType !== after.envelope.requestType) {
        report.other.push({
            label: 'Request type',
            kind: rowKind(before.root.requestType, after.envelope.requestType),
            before: short(before.root.requestType),
            after: short(after.envelope.requestType),
        });
    }

    /* noise already counted inside addAggregated via report.identifierCount */
    report.identifierCount += identifierCount;
    report.demon = demonChanges;

    const groups: [string, boolean][] = [
        ['model', !!report.model],
        ['system prompt', !!report.system],
        ['thinking', report.thinking.length > 0],
        ['tools', report.tools.length > 0],
        ['generation settings', report.generation.length > 0],
        ['safety settings', report.safety.length > 0],
        ['conversation', report.conversation.length > 0],
        ['other fields', report.other.length > 0],
    ];
    report.summaryLabels = groups.filter(([, on]) => on).map(([n]) => n);
    report.identical = report.summaryLabels.length === 0 && !report.conversationHidden;
    return report;
}

/** Aggregates generic tree-diff entries into rows by index-free path; counts identifier noise separately. */
function addAggregated(report: ChangeReport, entries: ReturnType<typeof diffPayload>, prefix: string): void {
    const groups = new Map<string, ChangeRow>();
    for (const e of entries) {
        const full = prefix && !e.path.startsWith('[') ? `${prefix}.${e.path}` : `${prefix}${e.path}`;
        if (isNoisePath(full)) {
            report.identifierCount++;
            continue;
        }
        const norm = full.replace(/\[\d+\]/g, '[]');
        const key = `${e.kind}:${norm}`;
        const g = groups.get(key);
        if (g) g.count = (g.count ?? 1) + 1;
        else groups.set(key, { label: norm, kind: e.kind, before: short(e.before), after: short(e.after), count: 1 });
    }
    for (const row of groups.values()) {
        if (report.other.length >= 200) break;
        report.other.push(row);
    }
}
