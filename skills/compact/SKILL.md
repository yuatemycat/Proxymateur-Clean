---
name: compact
description: Compact, prune, and summarize the active conversation trajectory to free up context window while preserving critical project state and pending todos.
---

# /compact & Context Compaction Protocol

When the user runs `/compact` or asks to compact context, execute an immediate trajectory compression cycle:

## Compaction Instructions

1. **Extract Core Anchors**:
   - The user's original primary goals and constraints.
   - The authoritative project paths, toolchains, and environment invariants.
   - Current active branches, git status, and uncommitted changes.

2. **Discard Noise**:
   - Discard raw command intermediate outputs, verbose compiler logs, and repeated error backtraces.
   - Retain only the final conclusion or root cause of each debugging cycle.

3. **Produce Structured Continuation Summary**:
   Write a concise, high-density summary conforming to:
   - **Task Status**: What was requested vs. what is complete.
   - **Key Decisions & Findings**: Concrete discoveries, architecture choices, and bug fixes.
   - **Immediate Next Steps**: Exactly what to execute next upon resumption.

4. **Persist & Truncate**:
   - Confirm to the user that conversation context has been compacted.
   - Present the clean resumption anchor.
