---
name: battle
description: Colosseum Battle Mode. Pits two rival subagents against each other in an adversarial arena to produce competing implementations, debate trade-offs, run benchmarks, and declare a victor.
---

# Colosseum Battle Mode Protocol

Triggered by `/battle <task>` or natural requests to pit agents against each other in the arena.

When Battle Mode is initiated:
1. **Divide the Problem**: Split the objective into two competing architectural or algorithmic approaches:
   - **Gladiator-Alpha** (`Role='Gladiator-Alpha'`)
   - **Gladiator-Beta** (`Role='Gladiator-Beta'`)
2. **Concurrent Arena Invocation**: You MUST invoke both rival subagents concurrently using the `invoke_subagent` tool.
   - Each gladiator receives its specific implementation strategy, coding constraints, and instructions to write clean, high-performance code.
3. **The Arena Duel & Critique**:
   - Both gladiators submit their code artifacts or diffs.
   - Each agent critiques the opposing agent's implementation (identifying edge cases, memory overhead, or performance bottlenecks).
4. **Benchmarking & Victory**:
   - Synthesize or run a headless benchmark harness using `run_command` to measure execution time, memory footprint, or FPS.
   - Declare the victor with an explicit `[BATTLE MODE: VICTOR CROWNED]` summary banner and merge the winning implementation into the project workspace.
