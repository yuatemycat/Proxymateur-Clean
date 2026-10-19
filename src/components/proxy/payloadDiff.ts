/**
 * Pure helpers for comparing two request payloads (what the client sent vs. what the proxy forwarded).
 * No React, no I/O, never throws on bad input.
 *
 * - parseJsonLoose: defensive JSON parsing (huge strings, invalid JSON, double-encoded JSON strings).
 * - diffPayload: structural tree diff returning { path, kind, before, after } entries.
 * - diffText / collapseSegments: word-level diff (Myers) with long unchanged runs collapsed.
 */

export type DiffKind = 'changed' | 'added' | 'removed';

export interface DiffEntry {
    path: string;
    kind: DiffKind;
    before?: unknown;
    after?: unknown;
}

/* ------------------------------------------------------------------ parsing */

/** Payloads above this size are not parsed at all. */
export const MAX_PARSE_CHARS = 25 * 1024 * 1024;
/** Above this many characters (per payload) word-level text diffs are skipped. */
export const MAX_TEXT_DIFF_CHARS = 3 * 1024 * 1024;

export type ParseResult =
    | { ok: true; value: unknown }
    | { ok: false; reason: 'empty' | 'invalid' | 'too_large' };

export function parseJsonLoose(raw: string | null | undefined): ParseResult {
    if (raw == null || typeof raw !== 'string' || raw.trim() === '') return { ok: false, reason: 'empty' };
    if (raw.length > MAX_PARSE_CHARS) return { ok: false, reason: 'too_large' };
    try {
        let value: unknown = JSON.parse(raw);
        // Some rows store a JSON document as a JSON string; unwrap once.
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try {
                    value = JSON.parse(trimmed);
                } catch {
                    /* keep the string */
                }
            }
        }
        return { ok: true, value };
    } catch {
        return { ok: false, reason: 'invalid' };
    }
}

/* ------------------------------------------------------------------ tree diff */

const MAX_DEPTH = 48;

export function isPlainObject(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function deepEqual(a: unknown, b: unknown, depth = 0): boolean {
    if (Object.is(a, b)) return true;
    if (depth > MAX_DEPTH) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i], depth + 1)) return false;
        return true;
    }
    if (isPlainObject(a) && isPlainObject(b)) {
        const ka = Object.keys(a);
        const kb = Object.keys(b);
        if (ka.length !== kb.length) return false;
        for (const k of ka) {
            if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
            if (!deepEqual(a[k], b[k], depth + 1)) return false;
        }
        return true;
    }
    return false;
}

const SIMPLE_KEY = /^[A-Za-z_$][\w$-]*$/;

function joinKey(path: string, key: string): string {
    if (SIMPLE_KEY.test(key)) return path ? `${path}.${key}` : key;
    return `${path}[${JSON.stringify(key)}]`;
}

/**
 * Walks both JSON trees and reports every difference.
 * Objects are compared key by key, arrays index by index. Added/removed subtrees are reported once
 * at their root (not expanded). Stops after `maxEntries` entries.
 */
export function diffPayload(before: unknown, after: unknown, maxEntries = 2000): DiffEntry[] {
    const out: DiffEntry[] = [];
    try {
        walk(before, after, '', 0, out, maxEntries);
    } catch {
        /* never throw */
    }
    return out;
}

function walk(b: unknown, a: unknown, path: string, depth: number, out: DiffEntry[], max: number): void {
    if (out.length >= max) return;
    if (Object.is(b, a)) return;
    if (depth > MAX_DEPTH) {
        if (!deepEqual(b, a)) out.push({ path, kind: 'changed', before: b, after: a });
        return;
    }
    if (isPlainObject(b) && isPlainObject(a)) {
        for (const k of Object.keys(b)) {
            if (out.length >= max) return;
            const p = joinKey(path, k);
            if (!Object.prototype.hasOwnProperty.call(a, k)) out.push({ path: p, kind: 'removed', before: b[k] });
            else walk(b[k], a[k], p, depth + 1, out, max);
        }
        for (const k of Object.keys(a)) {
            if (out.length >= max) return;
            if (!Object.prototype.hasOwnProperty.call(b, k)) {
                out.push({ path: joinKey(path, k), kind: 'added', after: a[k] });
            }
        }
        return;
    }
    if (Array.isArray(b) && Array.isArray(a)) {
        const n = Math.max(b.length, a.length);
        for (let i = 0; i < n; i++) {
            if (out.length >= max) return;
            const p = `${path}[${i}]`;
            if (i >= b.length) out.push({ path: p, kind: 'added', after: a[i] });
            else if (i >= a.length) out.push({ path: p, kind: 'removed', before: b[i] });
            else walk(b[i], a[i], p, depth + 1, out, max);
        }
        return;
    }
    out.push({ path, kind: 'changed', before: b, after: a });
}

/* ------------------------------------------------------------------ text diff */

export type TextSegType = 'same' | 'del' | 'add' | 'skip';

export interface TextSeg {
    type: TextSegType;
    text: string;
    /** Only for `skip`: number of unchanged characters hidden. */
    skipped?: number;
}

export interface TextDiffResult {
    segments: TextSeg[];
    removedChars: number;
    addedChars: number;
    /** True when the diff was too large/complex and a single removed + single added block is shown. */
    coarse: boolean;
}

const TOKEN_RE = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;

function tokenize(s: string): string[] {
    return s.match(TOKEN_RE) ?? [];
}

type Op = 0 | 1 | 2; // 0 same, 1 del (from a), 2 add (from b)

/** Myers O(ND) diff. Returns null when the edit distance exceeds maxD. */
function myers(a: string[], b: string[], maxD: number): { op: Op; tok: string }[] | null {
    const n = a.length;
    const m = b.length;
    const cap = Math.min(n + m, maxD);
    const offset = cap + 1;
    const v = new Int32Array(2 * cap + 3);
    v[offset + 1] = 0;
    const trace: Int32Array[] = [];
    let found = -1;
    for (let d = 0; d <= cap; d++) {
        trace.push(v.slice(offset - d - 1, offset + d + 2));
        for (let k = -d; k <= d; k += 2) {
            let x: number;
            if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) x = v[offset + k + 1];
            else x = v[offset + k - 1] + 1;
            let y = x - k;
            while (x < n && y < m && a[x] === b[y]) {
                x++;
                y++;
            }
            v[offset + k] = x;
            if (x >= n && y >= m) {
                found = d;
                break;
            }
        }
        if (found >= 0) break;
    }
    if (found < 0) return null;

    const ops: { op: Op; tok: string }[] = [];
    let x = n;
    let y = m;
    for (let d = found; d >= 0; d--) {
        const vs = trace[d];
        const g = (k: number) => vs[k + d + 1];
        const k = x - y;
        const prevK = k === -d || (k !== d && g(k - 1) < g(k + 1)) ? k + 1 : k - 1;
        const prevX = g(prevK);
        const prevY = prevX - prevK;
        while (x > prevX && y > prevY) {
            ops.push({ op: 0, tok: a[x - 1] });
            x--;
            y--;
        }
        if (d > 0) {
            if (x === prevX) ops.push({ op: 2, tok: b[y - 1] });
            else ops.push({ op: 1, tok: a[x - 1] });
        }
        x = prevX;
        y = prevY;
    }
    ops.reverse();
    return ops;
}

function pushSeg(segs: TextSeg[], type: TextSegType, text: string): void {
    if (!text) return;
    const last = segs[segs.length - 1];
    if (last && last.type === type) last.text += text;
    else segs.push({ type, text });
}

/**
 * Word-level diff between two strings. Returns null when either string exceeds MAX_TEXT_DIFF_CHARS.
 * Common prefix/suffix tokens are stripped first so appends (the common case) are instant.
 */
export function diffText(before: string, after: string, maxD = 1500): TextDiffResult | null {
    if (typeof before !== 'string' || typeof after !== 'string') return null;
    if (before.length > MAX_TEXT_DIFF_CHARS || after.length > MAX_TEXT_DIFF_CHARS) return null;
    if (before === after) {
        return { segments: before ? [{ type: 'same', text: before }] : [], removedChars: 0, addedChars: 0, coarse: false };
    }
    const a = tokenize(before);
    const b = tokenize(after);
    let p = 0;
    const lim = Math.min(a.length, b.length);
    while (p < lim && a[p] === b[p]) p++;
    let s = 0;
    while (s < lim - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
    const midA = a.slice(p, a.length - s);
    const midB = b.slice(p, b.length - s);

    const segs: TextSeg[] = [];
    pushSeg(segs, 'same', a.slice(0, p).join(''));

    let coarse = false;
    const flushRun = (dels: string[], adds: string[]) => {
        pushSeg(segs, 'del', dels.join(''));
        pushSeg(segs, 'add', adds.join(''));
    };
    if (midA.length === 0 || midB.length === 0) {
        flushRun(midA, midB);
    } else {
        const ops = myers(midA, midB, maxD);
        if (!ops) {
            coarse = true;
            flushRun(midA, midB);
        } else {
            let dels: string[] = [];
            let adds: string[] = [];
            for (const o of ops) {
                if (o.op === 0) {
                    if (dels.length || adds.length) {
                        flushRun(dels, adds);
                        dels = [];
                        adds = [];
                    }
                    pushSeg(segs, 'same', o.tok);
                } else if (o.op === 1) dels.push(o.tok);
                else adds.push(o.tok);
            }
            if (dels.length || adds.length) flushRun(dels, adds);
        }
    }
    pushSeg(segs, 'same', a.slice(a.length - s).join(''));

    let removedChars = 0;
    let addedChars = 0;
    for (const sg of segs) {
        if (sg.type === 'del') removedChars += sg.text.length;
        else if (sg.type === 'add') addedChars += sg.text.length;
    }
    return { segments: segs, removedChars, addedChars, coarse };
}

/**
 * Replaces long unchanged runs by `skip` segments ("... N chars unchanged ..."),
 * keeping `context` characters next to every change.
 */
export function collapseSegments(segments: TextSeg[], context = 48, minSkip = 120): TextSeg[] {
    const out: TextSeg[] = [];
    segments.forEach((sg, i) => {
        if (sg.type !== 'same' || sg.text.length <= context * 2 + minSkip) {
            out.push(sg);
            return;
        }
        const first = i === 0;
        const last = i === segments.length - 1;
        const head = first ? '' : sg.text.slice(0, context);
        const tail = last ? '' : sg.text.slice(sg.text.length - context);
        const skipped = sg.text.length - head.length - tail.length;
        if (head) out.push({ type: 'same', text: head });
        out.push({ type: 'skip', text: '', skipped });
        if (tail) out.push({ type: 'same', text: tail });
    });
    return out;
}

/** Sequential del -> add pairs ("from" -> "to") found in a diff, for compact before -> after lists. */
export function replacementPairs(segments: TextSeg[], limit = 20): { from: string; to: string }[] {
    const pairs: { from: string; to: string }[] = [];
    for (let i = 0; i < segments.length && pairs.length < limit; i++) {
        const sg = segments[i];
        if (sg.type === 'del') {
            const next = segments[i + 1];
            pairs.push({ from: sg.text.trim(), to: next && next.type === 'add' ? next.text.trim() : '' });
        } else if (sg.type === 'add' && !(segments[i - 1] && segments[i - 1].type === 'del')) {
            pairs.push({ from: '', to: sg.text.trim() });
        }
    }
    return pairs;
}
