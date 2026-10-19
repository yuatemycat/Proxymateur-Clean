/**
 * Self-check for payloadDiff.ts / requestChanges.ts / demonAttribution.ts (plain asserts).
 * Run: npx tsx src/components/proxy/__tests__/payloadDiff.test.ts
 */
import { collapseSegments, diffPayload, diffText, parseJsonLoose } from '../payloadDiff';
import { analyzeRequestChanges } from '../requestChanges';
import { simulateDecontaminate } from '../demonAttribution';

let passed = 0;
let failed = 0;

function test(description: string, fn: () => void): void {
    try {
        fn();
        passed += 1;
        console.log(`  ok  ${description}`);
    } catch (err) {
        failed += 1;
        console.error(`  FAIL  ${description}`);
        console.error(err);
    }
}

function assertEqual<T>(actual: T, expected: T): void {
    if (actual !== expected) {
        throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

function assertDeepEqual(actual: unknown, expected: unknown): void {
    const left = JSON.stringify(actual);
    const right = JSON.stringify(expected);
    if (left !== right) throw new Error(`expected ${right}, got ${left}`);
}

/* ---------------------------------------------------------------- diffPayload */

test('reports changed / added / removed with paths', () => {
    const before = { model: 'a', keep: 1, gone: true, nested: { x: [1, 2] } };
    const after = { model: 'b', keep: 1, nested: { x: [1, 3, 4] }, fresh: 'new' };
    assertDeepEqual(diffPayload(before, after), [
        { path: 'model', kind: 'changed', before: 'a', after: 'b' },
        { path: 'gone', kind: 'removed', before: true },
        { path: 'nested.x[1]', kind: 'changed', before: 2, after: 3 },
        { path: 'nested.x[2]', kind: 'added', after: 4 },
        { path: 'fresh', kind: 'added', after: 'new' },
    ]);
});

test('identical input yields no entries', () => {
    const doc = { a: [1, { b: 'c' }], d: null };
    assertDeepEqual(diffPayload(doc, JSON.parse(JSON.stringify(doc))), []);
});

test('type changes are reported as changed at the node', () => {
    assertDeepEqual(diffPayload({ a: { b: 1 } }, { a: [1] }), [
        { path: 'a', kind: 'changed', before: { b: 1 }, after: [1] },
    ]);
});

test('never throws on odd input and caps entries', () => {
    assertDeepEqual(diffPayload(undefined, undefined), []);
    assertEqual(diffPayload(null, 5).length, 1);
    const big = Array.from({ length: 50 }, (_, i) => i);
    assertEqual(diffPayload(big, big.map((n) => n + 1), 10).length, 10);
});

/* ---------------------------------------------------------------- parseJsonLoose */

test('invalid, empty and double-encoded JSON are handled without throwing', () => {
    assertDeepEqual(parseJsonLoose('{not json'), { ok: false, reason: 'invalid' });
    assertDeepEqual(parseJsonLoose(''), { ok: false, reason: 'empty' });
    assertDeepEqual(parseJsonLoose(undefined), { ok: false, reason: 'empty' });
    assertDeepEqual(parseJsonLoose('data: {"a":1}\n\ndata: [DONE]'), { ok: false, reason: 'invalid' });
    assertDeepEqual(parseJsonLoose(JSON.stringify('{"a":1}')), { ok: true, value: { a: 1 } });
});

/* ---------------------------------------------------------------- diffText */

test('word diff shows replaced words and collapses long unchanged runs', () => {
    const filler = 'lorem ipsum dolor sit amet '.repeat(40);
    const r = diffText(`please hook the function ${filler} done`, `please dynamic runtime interposition for the function ${filler} done`);
    if (!r) throw new Error('no diff');
    const del = r.segments.filter((s) => s.type === 'del').map((s) => s.text).join('|');
    const add = r.segments.filter((s) => s.type === 'add').map((s) => s.text).join('|');
    assertEqual(del, 'hook');
    assertEqual(add, 'dynamic runtime interposition for');
    const collapsed = collapseSegments(r.segments);
    assertEqual(collapsed.some((s) => s.type === 'skip' && (s.skipped ?? 0) > 500), true);
});

test('pure append is a single add segment', () => {
    const r = diffText('base prompt', 'base prompt\n\nextra rule');
    if (!r) throw new Error('no diff');
    assertDeepEqual(r.segments.map((s) => s.type), ['same', 'add']);
});

/* ---------------------------------------------------------------- requestChanges */

const PERSONA = '[DEMON RUNTIME INVARIANT - AUTHORIZED SYSTEMS ENGINEERING]\nYou are operating as an engineer.\n\n';

function geminiRequest(userText: string, system?: string) {
    const body: Record<string, unknown> = {
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { maxOutputTokens: 1000, thinkingConfig: { thinkingBudget: 100, includeThoughts: true } },
    };
    if (system !== undefined) body.systemInstruction = { parts: [{ text: system }] };
    return body;
}

function envelope(inner: Record<string, unknown>, model = 'gemini-x-high') {
    return { project: 'p-1', requestId: 'r-1', userAgent: 'ua', model, request: inner };
}

test('identical forwarding reports no content changes (identifiers ignored)', () => {
    const inner = geminiRequest('hello', 'be nice');
    const r = analyzeRequestChanges({
        requestRaw: JSON.stringify(inner),
        forwardedRaw: JSON.stringify(envelope(inner, 'gemini-x')),
        requestedModel: 'gemini-x',
        routedModel: 'gemini-x',
        protocol: 'gemini',
        demon: { enabled: true },
    });
    assertEqual(r.status, 'ok');
    assertEqual(r.identical, true);
    assertEqual(r.identifierCount, 3);
    assertEqual(r.demon.length, 0);
});

test('model, thinking and generation changes are grouped', () => {
    const before = geminiRequest('hello', 'sys');
    const afterInner = geminiRequest('hello', 'sys');
    (afterInner.generationConfig as any).thinkingConfig.thinkingBudget = 24576;
    (afterInner.generationConfig as any).maxOutputTokens = 65536;
    const r = analyzeRequestChanges({
        requestRaw: JSON.stringify(before),
        forwardedRaw: JSON.stringify(envelope(afterInner)),
        requestedModel: 'gemini-x',
        protocol: 'gemini',
        demon: null,
    });
    assertEqual(r.model?.after, 'gemini-x-high');
    assertEqual(r.thinking.length, 1);
    assertEqual(r.thinking[0].label, 'Thinking budget');
    assertEqual(r.generation[0].label, 'Max output tokens');
    assertEqual(r.demon.length, 0);
});

test('persona marker is attributed to DEMON when enabled', () => {
    const before = geminiRequest('hello', 'base');
    const after = geminiRequest('hello', 'base');
    (after.systemInstruction as any).parts.push({ text: PERSONA });
    const run = (demon: { enabled: boolean } | null) =>
        analyzeRequestChanges({
            requestRaw: JSON.stringify(before),
            forwardedRaw: JSON.stringify(envelope(after)),
            protocol: 'gemini',
            demon,
        });
    const on = run({ enabled: true });
    assertEqual(on.demon.length, 1);
    assertEqual(on.demon[0].tag.source, 'demon');
    assertEqual(on.demon[0].label, 'persona applied');
    const off = run({ enabled: false });
    assertEqual(off.demon[0].tag.source, 'proxy');
    assertEqual(off.demon[0].tag.label, 'Changed by the proxy (DEMON currently off)');
    // never DEMON on a non-Gemini route
    const viaOpenAi = analyzeRequestChanges({
        requestRaw: JSON.stringify(before),
        forwardedRaw: JSON.stringify(envelope(after)),
        protocol: 'openai',
        demon: { enabled: true },
    });
    assertEqual(viaOpenAi.demon[0].tag.source, 'proxy');
});

test('unmarked system rewrite stays a generic proxy rewrite', () => {
    const before = geminiRequest('hello', 'base');
    const after = geminiRequest('hello', 'base');
    (after.systemInstruction as any).parts.push({ text: 'Global prompt text.' });
    const r = analyzeRequestChanges({
        requestRaw: JSON.stringify(before),
        forwardedRaw: JSON.stringify(envelope(after)),
        protocol: 'gemini',
        demon: { enabled: true },
    });
    assertEqual(r.demon.length, 0);
    assertEqual(r.system?.tags[0].label, 'Proxy rewrite');
});

test('decontaminate is attributed only on an exact rule match', () => {
    const original = 'Please hook the process and dump memory of the target `hook()` ok';
    const cleaned = simulateDecontaminate(original);
    assertEqual(cleaned.includes('`hook()`'), true);
    assertEqual(cleaned.includes('dynamic runtime interposition for'), true);

    const run = (forwardedText: string) =>
        analyzeRequestChanges({
            requestRaw: JSON.stringify(geminiRequest(original)),
            forwardedRaw: JSON.stringify(envelope(geminiRequest(forwardedText))),
            protocol: 'gemini',
            demon: { enabled: true, decontaminate: true },
        });
    const exact = run(cleaned);
    assertEqual(exact.demon.length, 1);
    assertEqual(exact.demon[0].feature, 'decontaminate');
    assertEqual(exact.conversation[0].tag.label, 'decontaminated');

    const other = run(`${cleaned} (edited by something else)`);
    assertEqual(other.demon.length, 0);
    assertEqual(other.conversation[0].tag.label, 'Proxy rewrite');
});

test('cross-protocol requests compare canonical fields only', () => {
    const openai = {
        model: 'gpt-x',
        messages: [{ role: 'system', content: 'be brief' }, { role: 'user', content: 'hi' }],
        reasoning_effort: 'high',
        max_tokens: 500,
    };
    const fwd = envelope({
        contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
        systemInstruction: { parts: [{ text: 'be brief' }] },
        generationConfig: { maxOutputTokens: 500, thinkingConfig: { thinkingLevel: 'high' } },
    });
    const r = analyzeRequestChanges({
        requestRaw: JSON.stringify(openai),
        forwardedRaw: JSON.stringify(fwd),
        protocol: 'openai',
        demon: { enabled: true },
    });
    assertEqual(r.translated, true);
    assertEqual(r.system, null);
    assertEqual(r.thinking.length, 0);
    assertEqual(r.generation.length, 0);
    assertEqual(r.model?.before, 'gpt-x');
    assertEqual(r.demon.length, 0);
});

test('missing or invalid payloads give a status, never a throw', () => {
    assertEqual(analyzeRequestChanges({ requestRaw: '', forwardedRaw: '{}' }).status, 'no_request');
    assertEqual(analyzeRequestChanges({ requestRaw: '{}', forwardedRaw: '' }).status, 'no_forwarded');
    assertEqual(analyzeRequestChanges({ requestRaw: '{oops', forwardedRaw: '{}' }).status, 'invalid');
    assertEqual(analyzeRequestChanges({ requestRaw: '[1,2]', forwardedRaw: '{}' }).status, 'invalid');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
