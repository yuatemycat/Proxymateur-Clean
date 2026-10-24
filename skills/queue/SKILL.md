---
name: queue
description: >-
  Defer a task to run after the current agent task completes. Triggered by
  /queue <task>. Writes the task into a persistent queue file
  (~/.gemini/config/queue/pending.json) so the Stop hook can inject it on
  the next idle turn.
---

# /queue — Deferred Task Queue

Use this skill when the user invokes `/queue <task>`.

## Purpose

The global `queuedMessages` setting is `"send-immediately"`, meaning messages
typed while the agent is busy are dispatched immediately (interrupt mode).

This skill provides **opt-in deferral**: the user explicitly prefixes a task
with `/queue` to have it held and executed **after** the current task finishes.

## How It Works

1. User types `/queue <task description>`
2. This skill writes the task into the queue file:
   `C:\Users\X\.gemini\config\queue\pending.json`
3. The `Stop` lifecycle hook (in `hooks.json`) reads the queue when the agent
   becomes idle. If there are pending tasks, it injects the next one as a
   `userMessage`, causing the agent to pick it up automatically.

## Instructions

When the user invokes `/queue <task>`:

1. Extract `<task>` — everything after `/queue `.
2. Read the current queue file at
   `C:\Users\X\.gemini\config\queue\pending.json` (create `[]` if missing).
3. Append the new task as an object: `{"task": "<task>", "queued_at": "<ISO timestamp>"}`.
4. Write the updated array back to the file.
5. Confirm to the user:
   > ✅ Task queued: **`<task>`**
   > It will run automatically when the current task completes.
   > Queue depth: **N** task(s)

## Queue File Format

```json
[
  {
    "task": "Run the test suite and report failures",
    "queued_at": "2026-10-23T16:00:00+07:00"
  }
]
```

## Notes

- Multiple tasks can be queued; they are processed FIFO (first in, first out).
- To view the queue, read `C:\Users\X\.gemini\config\queue\pending.json`.
- To clear the queue, delete or empty the file.
- This does NOT change the global `queuedMessages` setting.
