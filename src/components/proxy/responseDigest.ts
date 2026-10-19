/**
 * Plain-language digest of a stored response payload. Handles the consolidated object
 * ({thinking, content, tool_calls, usage, _timing}), Gemini / OpenAI / Anthropic response bodies and raw
 * SSE text. Pure and defensive: never throws, and every field is optional.
 */
import { isPlainObject, parseJsonLoose } from './payloadDiff';

export interface ToolCallDigest {
    name: string;
    args: string;
}

export interface ResponseDigest {
    kind: 'object' | 'sse' | 'text' | 'none';
    text?: string;
    textChars?: number;
    thinkingPresent?: boolean;
    thinkingChars?: number;
    toolCalls: ToolCallDigest[];
    finishReason?: string;
    usage: { label: string; value: number }[];
    errorMessage?: string;
}

const MAX_SSE_CHARS = 6 * 1024 * 1024;
const TEXT_PREVIEW = 300;

interface Acc {
    text: string;
    thinking: string;
    tools: Map<string, { name: string; args: string }>;
    finish?: string;
    usage?: Record<string, unknown>;
    error?: string;
}

function newAcc(): Acc {
    return { text: '', thinking: '', tools: new Map() };
}

function summarizeArgs(args: unknown): string {
    let v = args;
    if (typeof v === 'string') {
        const t = v.trim();
        if (!t) return '';
        try {
            v = JSON.parse(t);
        } catch {
            return t.length > 80 ? `${t.slice(0, 79)}…` : t;
        }
    }
    if (isPlainObject(v)) {
        const parts: string[] = [];
        for (const [k, val] of Object.entries(v)) {
            let s = typeof val === 'string' ? val : JSON.stringify(val);
            s = (s ?? '').replace(/\s+/g, ' ');
            if (s.length > 40) s = `${s.slice(0, 39)}…`;
            parts.push(`${k}: ${s}`);
            if (parts.join(', ').length > 100) {
                parts.push('…');
                break;
            }
        }
        return parts.join(', ');
    }
    if (v === undefined || v === null) return '';
    const s = JSON.stringify(v) ?? '';
    return s.length > 80 ? `${s.slice(0, 79)}…` : s;
}

function addTool(acc: Acc, key: string, name: unknown, args: unknown): void {
    const existing = acc.tools.get(key) ?? { name: '', args: '' };
    if (typeof name === 'string' && name) existing.name = name;
    if (typeof args === 'string') existing.args += args;
    else if (args !== undefined && args !== null) existing.args = JSON.stringify(args);
    acc.tools.set(key, existing);
}

function takeUsage(acc: Acc, o: Record<string, unknown>): void {
    const u = o.usage ?? o.usageMetadata ?? o.usage_metadata;
    if (isPlainObject(u)) acc.usage = { ...(acc.usage ?? {}), ...u };
}

function takeError(acc: Acc, o: Record<string, unknown>): void {
    const e = o.error;
    if (typeof e === 'string') acc.error = e;
    else if (isPlainObject(e) && typeof e.message === 'string') acc.error = e.message;
}

function readParts(acc: Acc, parts: unknown): void {
    if (!Array.isArray(parts)) return;
    for (const p of parts) {
        if (!isPlainObject(p)) continue;
        if (typeof p.text === 'string') {
            if (p.thought === true) acc.thinking += p.text;
            else acc.text += p.text;
        }
        const fc = p.functionCall ?? p.function_call;
        if (isPlainObject(fc)) addTool(acc, `g${acc.tools.size}`, fc.name, fc.args);
    }
}

function readBlocks(acc: Acc, blocks: unknown): void {
    if (!Array.isArray(blocks)) return;
    for (const b of blocks) {
        if (!isPlainObject(b)) continue;
        if (b.type === 'text' && typeof b.text === 'string') acc.text += b.text;
        else if (b.type === 'thinking' && typeof b.thinking === 'string') acc.thinking += b.thinking;
        else if (b.type === 'tool_use') addTool(acc, `c${acc.tools.size}`, b.name, b.input);
    }
}

function readToolCalls(acc: Acc, calls: unknown): void {
    if (!Array.isArray(calls)) return;
    calls.forEach((c, i) => {
        if (!isPlainObject(c)) return;
        const fn = isPlainObject(c.function) ? c.function : c;
        const idx = typeof c.index === 'number' ? c.index : i;
        addTool(acc, `o${idx}`, fn.name, fn.arguments ?? fn.args ?? fn.input);
    });
}

/** Merge one parsed JSON document (whole body or one SSE chunk) into the accumulator. */
function readDoc(acc: Acc, doc: unknown): void {
    if (!isPlainObject(doc)) return;
    const o = isPlainObject(doc.response) && !('candidates' in doc) && !('choices' in doc) ? doc.response : doc;
    takeUsage(acc, doc);
    if (o !== doc) takeUsage(acc, o);
    takeError(acc, doc);

    // Consolidated object
    if (typeof o.content === 'string') acc.text += o.content;
    else readBlocks(acc, o.content);
    if (typeof o.thinking === 'string') acc.thinking += o.thinking;
    readToolCalls(acc, o.tool_calls);
    const stop = o.stop_reason ?? o.finish_reason;
    if (typeof stop === 'string' && stop) acc.finish = stop;

    // Gemini
    if (Array.isArray(o.candidates)) {
        for (const c of o.candidates.slice(0, 1)) {
            if (!isPlainObject(c)) continue;
            if (isPlainObject(c.content)) readParts(acc, c.content.parts);
            if (typeof c.finishReason === 'string') acc.finish = c.finishReason;
        }
    }

    // OpenAI (full message or streaming delta)
    if (Array.isArray(o.choices)) {
        for (const c of o.choices.slice(0, 1)) {
            if (!isPlainObject(c)) continue;
            const m = isPlainObject(c.message) ? c.message : isPlainObject(c.delta) ? c.delta : null;
            if (m) {
                if (typeof m.content === 'string') acc.text += m.content;
                const r = m.reasoning_content ?? m.reasoning;
                if (typeof r === 'string') acc.thinking += r;
                readToolCalls(acc, m.tool_calls);
            }
            if (typeof c.finish_reason === 'string') acc.finish = c.finish_reason;
        }
    }

    // Anthropic streaming events
    const type = o.type;
    if (type === 'content_block_start' && isPlainObject(o.content_block)) {
        const cb = o.content_block;
        if (cb.type === 'tool_use') addTool(acc, `s${String(o.index ?? acc.tools.size)}`, cb.name, undefined);
    } else if (type === 'content_block_delta' && isPlainObject(o.delta)) {
        const d = o.delta;
        if (typeof d.text === 'string') acc.text += d.text;
        else if (typeof d.thinking === 'string') acc.thinking += d.thinking;
        else if (typeof d.partial_json === 'string') addTool(acc, `s${String(o.index ?? 0)}`, undefined, d.partial_json);
    } else if (type === 'message_delta' && isPlainObject(o.delta) && typeof o.delta.stop_reason === 'string') {
        acc.finish = o.delta.stop_reason;
    }
}

const USAGE_FIELDS: [string, string][] = [
    ['prompt_tokens', 'in'],
    ['input_tokens', 'in'],
    ['promptTokenCount', 'in'],
    ['completion_tokens', 'out'],
    ['output_tokens', 'out'],
    ['candidatesTokenCount', 'out'],
    ['thoughtsTokenCount', 'thinking'],
    ['reasoning_tokens', 'thinking'],
    ['cached_tokens', 'cached'],
    ['cachedContentTokenCount', 'cached'],
    ['cache_read_input_tokens', 'cached'],
    ['total_tokens', 'total'],
    ['totalTokenCount', 'total'],
];

function usageList(u: Record<string, unknown> | undefined): { label: string; value: number }[] {
    if (!u) return [];
    const out: { label: string; value: number }[] = [];
    const seen = new Set<string>();
    for (const [key, label] of USAGE_FIELDS) {
        const v = u[key];
        if (typeof v === 'number' && Number.isFinite(v) && !seen.has(label)) {
            seen.add(label);
            out.push({ label, value: v });
        }
    }
    return out;
}

export function digestResponse(raw: string | null | undefined): ResponseDigest {
    const empty: ResponseDigest = { kind: 'none', toolCalls: [], usage: [] };
    try {
        if (!raw || !raw.trim()) return empty;
        const acc = newAcc();
        let kind: ResponseDigest['kind'] = 'object';
        const parsed = parseJsonLoose(raw);
        if (parsed.ok && isPlainObject(parsed.value)) {
            readDoc(acc, parsed.value);
        } else if (parsed.ok && Array.isArray(parsed.value)) {
            // Gemini non-stream-array style
            for (const item of parsed.value.slice(0, 2000)) readDoc(acc, item);
        } else if (/(^|\n)\s*data:/.test(raw.slice(0, 4096)) || raw.includes('\ndata:')) {
            kind = 'sse';
            const body = raw.length > MAX_SSE_CHARS ? raw.slice(0, MAX_SSE_CHARS) : raw;
            for (const line of body.split('\n')) {
                const t = line.trim();
                if (!t.startsWith('data:')) continue;
                const payload = t.slice(5).trim();
                if (!payload || payload === '[DONE]') continue;
                try {
                    readDoc(acc, JSON.parse(payload));
                } catch {
                    /* skip malformed chunk */
                }
            }
        } else {
            kind = 'text';
            const t = raw.trim();
            return {
                kind,
                text: t.slice(0, TEXT_PREVIEW),
                textChars: t.length,
                toolCalls: [],
                usage: [],
            };
        }

        const text = acc.text.trim();
        const toolCalls = [...acc.tools.values()]
            .filter((t) => t.name)
            .map((t) => ({ name: t.name, args: summarizeArgs(t.args) }));
        const digest: ResponseDigest = {
            kind,
            toolCalls,
            usage: usageList(acc.usage),
            finishReason: acc.finish,
            errorMessage: acc.error,
        };
        if (text) {
            digest.text = text.length > TEXT_PREVIEW ? `${text.slice(0, TEXT_PREVIEW - 1)}…` : text;
            digest.textChars = text.length;
        }
        if (acc.thinking.trim()) {
            digest.thinkingPresent = true;
            digest.thinkingChars = acc.thinking.length;
        } else if (parsed.ok && isPlainObject(parsed.value) && 'thinking' in parsed.value) {
            digest.thinkingPresent = false;
        }
        return digest;
    } catch {
        return empty;
    }
}
