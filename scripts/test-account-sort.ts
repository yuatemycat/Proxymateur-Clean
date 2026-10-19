// Test script for accountSort.ts
import { 
    sortAccounts, 
    getAccount5hRemainingMs, 
    getAccountWeeklyQuota, 
    getAccountWeeklyRemainingMs 
} from '../src/utils/accountSort.ts';

console.log('Testing accountSort...');

const now = Date.now();
const toIso = (msFromNow) => new Date(now + msFromNow).toISOString();

// Mock accounts matching user scenario:
// Account 1: G3.8 Flash 100% (4h 51m), Claude 5.5 Weekly 0% (5d 21h)
const acc1 = {
    id: 'acc1',
    email: 'xia***ed@gmail.com',
    priority: 50,
    quota: {
        models: [
            { name: 'gemini-3-flash', percentage: 100, reset_time: toIso(4 * 3600 * 1000 + 51 * 60 * 1000) },
            { name: 'claude-opus-4-6', percentage: 0, reset_time: toIso(5 * 24 * 3600 * 1000 + 21 * 3600 * 1000) },
        ],
        quota_groups: [
            {
                display_name: 'Claude and GPT models',
                buckets: [
                    { bucket_id: 'claude-weekly', window: 'weekly', remaining_fraction: 0.0, reset_time: toIso(5 * 24 * 3600 * 1000 + 21 * 3600 * 1000) }
                ]
            }
        ]
    }
};

// Account 2: 5h reset 1h 0m, Weekly 90%
const acc2 = {
    id: 'acc2',
    email: 'high_weekly@gmail.com',
    priority: 50,
    quota: {
        models: [
            { name: 'gemini-3-flash', percentage: 92, reset_time: toIso(1 * 3600 * 1000) },
            { name: 'claude-opus-4-6', percentage: 90, reset_time: toIso(6 * 24 * 3600 * 1000) },
        ],
        quota_groups: [
            {
                display_name: 'Claude and GPT models',
                buckets: [
                    { bucket_id: 'claude-weekly', window: 'weekly', remaining_fraction: 0.9, reset_time: toIso(6 * 24 * 3600 * 1000) }
                ]
            }
        ]
    }
};

// Account 3: 5h reset 1h 0m, Weekly 20%
const acc3 = {
    id: 'acc3',
    email: 'low_weekly@gmail.com',
    priority: 50,
    quota: {
        models: [
            { name: 'gemini-3-flash', percentage: 92, reset_time: toIso(1 * 3600 * 1000) },
            { name: 'claude-opus-4-6', percentage: 20, reset_time: toIso(6 * 24 * 3600 * 1000) },
        ],
        quota_groups: [
            {
                display_name: 'Claude and GPT models',
                buckets: [
                    { bucket_id: 'claude-weekly', window: 'weekly', remaining_fraction: 0.2, reset_time: toIso(6 * 24 * 3600 * 1000) }
                ]
            }
        ]
    }
};

// Account 4: 5h reset 4h 0m, Weekly 73%
const acc4 = {
    id: 'acc4',
    email: 'mid_4h@gmail.com',
    priority: 50,
    quota: {
        models: [
            { name: 'gemini-3-flash', percentage: 73, reset_time: toIso(4 * 3600 * 1000) },
            { name: 'claude-opus-4-6', percentage: 73, reset_time: toIso(5 * 24 * 3600 * 1000) },
        ],
        quota_groups: [
            {
                display_name: 'Claude and GPT models',
                buckets: [
                    { bucket_id: 'claude-weekly', window: 'weekly', remaining_fraction: 0.73, reset_time: toIso(5 * 24 * 3600 * 1000) }
                ]
            }
        ]
    }
};

const accounts = [acc1, acc2, acc3, acc4];

// Test 1: Weekly-Prioritized 5H Reset
console.log('\n--- Test 1: reset_5h_weekly_priority ---');
const sortedPriority = sortAccounts(accounts, 'reset_5h_weekly_priority', '5h');
console.log('Result:', sortedPriority.map(a => `${a.id} (Weekly: ${getAccountWeeklyQuota(a)}%, 5h: ${Math.round(getAccount5hRemainingMs(a)/60000)}m)`));

if (sortedPriority[0].id !== 'acc2') {
    throw new Error(`Expected acc2 (high weekly 90%) to be #1, got ${sortedPriority[0].id}`);
}
if (sortedPriority[1].id !== 'acc3') {
    throw new Error(`Expected acc3 (weekly 20%) to be #2, got ${sortedPriority[1].id}`);
}
if (sortedPriority[2].id !== 'acc4') {
    throw new Error(`Expected acc4 (weekly 73%, 4h reset) to be #3, got ${sortedPriority[2].id}`);
}
if (sortedPriority[3].id !== 'acc1') {
    throw new Error(`Expected acc1 (weekly 0%) to be last (#4), got ${sortedPriority[3].id}`);
}
console.log('Test 1 Passed: High weekly quota prioritized, Weekly 0% placed last!');

// Test 2: Strict Shortest 5H Reset
console.log('\n--- Test 2: reset_5h_asc ---');
const sorted5h = sortAccounts(accounts, 'reset_5h_asc', '5h');
console.log('Result:', sorted5h.map(a => `${a.id} (${Math.round(getAccount5hRemainingMs(a)/60000)}m)`));
if (sorted5h[0].id !== 'acc2' && sorted5h[0].id !== 'acc3') {
    throw new Error(`Expected 1h accounts (acc2 or acc3) first, got ${sorted5h[0].id}`);
}

// Test 3: Shortest Weekly Reset
console.log('\n--- Test 3: reset_weekly_asc ---');
const sortedWeekly = sortAccounts(accounts, 'reset_weekly_asc', 'weekly');
console.log('Result:', sortedWeekly.map(a => `${a.id} (${Math.round(getAccountWeeklyRemainingMs(a)/(3600000*24))}d)`));

// Test 4: Highest Quota %
console.log('\n--- Test 4: quota_desc ---');
const sortedQuota = sortAccounts(accounts, 'quota_desc', '5h');
console.log('Result:', sortedQuota.map(a => `${a.id}`));

// Test 5: Opus 5.5 Inclusive Labels Sorted to Bottom Regardless of Quotas
console.log('\n--- Test 5: Opus5.5 inclusive labels at bottom ---');
const normalLowQuota = {
    id: 'normal_low',
    email: 'normal_low@gmail.com',
    custom_label: 'Standard Account',
    priority: 50,
    quota: {
        models: [
            { name: 'gemini-3-flash', percentage: 10, reset_time: toIso(4 * 3600 * 1000) },
        ]
    }
};

const opusFullQuota1 = {
    id: 'opus_full_1',
    email: 'opus_full1@gmail.com',
    custom_label: 'Opus5.5 Active',
    priority: 50,
    quota: {
        models: [
            { name: 'gemini-3-flash', percentage: 100, reset_time: toIso(1 * 3600 * 1000) },
        ]
    }
};

const opusFullQuota2 = {
    id: 'opus_full_2',
    email: 'opus_full2@gmail.com',
    custom_label: 'Claude 5.5 Opus Dedicated',
    priority: 50,
    quota: {
        models: [
            { name: 'gemini-3-flash', percentage: 80, reset_time: toIso(1 * 3600 * 1000) },
        ]
    }
};

const disabledAcc = {
    id: 'disabled_acc',
    email: 'disabled@gmail.com',
    disabled: true,
    quota: { models: [] }
};

const mixedTestPool = [opusFullQuota1, normalLowQuota, opusFullQuota2, disabledAcc];

// In quota_desc: normal_low (10%) should be BEFORE opus_full_1 (100%) and opus_full_2 (80%)
const sortedMixedQuota = sortAccounts(mixedTestPool, 'quota_desc', '5h');
console.log('Quota Desc Order:', sortedMixedQuota.map(a => a.id));
if (sortedMixedQuota[0].id !== 'normal_low') {
    throw new Error(`Expected normal_low to be first, got ${sortedMixedQuota[0].id}`);
}
if (sortedMixedQuota[1].id !== 'opus_full_1') {
    throw new Error(`Expected opus_full_1 (higher quota among Opus) to be second, got ${sortedMixedQuota[1].id}`);
}
if (sortedMixedQuota[2].id !== 'opus_full_2') {
    throw new Error(`Expected opus_full_2 to be third, got ${sortedMixedQuota[2].id}`);
}
if (sortedMixedQuota[3].id !== 'disabled_acc') {
    throw new Error(`Expected disabled_acc to be last, got ${sortedMixedQuota[3].id}`);
}

// In default order: normal_low should be before Opus accounts
const sortedMixedDefault = sortAccounts(mixedTestPool, 'default', '5h');
console.log('Default Order:', sortedMixedDefault.map(a => a.id));
if (sortedMixedDefault[0].id !== 'normal_low' && sortedMixedDefault[1].id !== 'normal_low') {
    // Normal accounts must come before Opus accounts
    throw new Error(`Expected normal accounts before Opus accounts in default order`);
}
const opusIndices = [
    sortedMixedDefault.findIndex(a => a.id === 'opus_full_1'),
    sortedMixedDefault.findIndex(a => a.id === 'opus_full_2'),
];
const normalIndex = sortedMixedDefault.findIndex(a => a.id === 'normal_low');
if (Math.min(...opusIndices) < normalIndex) {
    throw new Error(`Expected Opus accounts to be after normal accounts in default order`);
}

// In reset_5h_weekly_priority: normal accounts come before Opus accounts
const sortedMixedWeeklyPriority = sortAccounts(mixedTestPool, 'reset_5h_weekly_priority', '5h');
console.log('Weekly Priority Order:', sortedMixedWeeklyPriority.map(a => a.id));
if (sortedMixedWeeklyPriority[0].id !== 'normal_low') {
    throw new Error(`Expected normal_low before Opus accounts in reset_5h_weekly_priority, got ${sortedMixedWeeklyPriority[0].id}`);
}

console.log('Test 5 Passed: Opus5.5 inclusive labels are at the bottom regardless of quotas!');

// Test 6: Label pattern matching coverage for hasOpus55Label
console.log('\n--- Test 6: hasOpus55Label pattern matching ---');
const { hasOpus55Label } = await import('../src/utils/accountSort.ts');

const positiveCases = [
    'Opus5.5',
    'Opus 5.5',
    'opus5.5',
    'opus 5.5',
    'opus-5.5',
    'opus_5.5',
    'opus 5_5',
    'opus55',
    'opus 5-5',
    'Claude Opus 5.5',
    'Claude 5.5 Opus',
    '5.5 Opus',
    'opus 5.5 high',
    'acc-opus5.5-preview',
    'Personal (Opus 5.5)',
    '[Opus 5.5]',
];

const negativeCases = [
    'Opus 4.5',
    'Opus 4.6',
    'Opus',
    'Claude 5.5',
    'Sonnet 5.5',
    'Gemini 3.8 Flash',
    'High Quota Acc',
    '',
];

for (const label of positiveCases) {
    if (!hasOpus55Label({ id: 't', email: 't@test.com', custom_label: label } as any)) {
        throw new Error(`Expected label "${label}" to match hasOpus55Label, but it returned false`);
    }
}

for (const label of negativeCases) {
    if (hasOpus55Label({ id: 't', email: 't@test.com', custom_label: label } as any)) {
        throw new Error(`Expected label "${label}" to NOT match hasOpus55Label, but it returned true`);
    }
}
console.log(`Test 6 Passed: ${positiveCases.length} positive cases and ${negativeCases.length} negative cases verified!`);

console.log('\nAll unit tests passed successfully!');


