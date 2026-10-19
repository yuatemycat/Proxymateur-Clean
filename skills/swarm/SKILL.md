---
name: swarm
description: Autonomous Multi-Agent Swarm Hub. Coordinates parallel specialist subagents to design, implement, and verify complex projects hands-free without interruption.
---

# Autonomous Multi-Agent Swarm Pipeline

Triggered by `/swarm <task>` or requests for hands-free multi-agent team execution.

This skill leverages `enable-subagent-hub` and `jetski-autonomous-mode` to deploy specialist agent teams.

## Operational Protocol

1. **Task Decomposition & Specialization**:
   - Deconstruct the user's objective into distinct, decoupled roles (e.g. `SystemArchitect`, `CoreDev`, `TestHarness`, `DesignEngineer`).
   - Clearly delineate responsibilities and file ownership to prevent merge collisions.

2. **Concurrent Swarm Invocation**:
   - Concurrently spawn specialist agents using the `invoke_subagent` tool.
   - Each subagent runs with full model reasoning (guaranteed by `disable-teamwork-forced-flash-model`).

3. **Swarm Lifecycle Monitoring**:
   - Query active agents via `manage_subagents(list)` to track execution states.
   - Send input or directives via `send_message` if guidance is required.

4. **Hands-Free Verification & Delivery**:
   - In autonomous mode, run end-to-end without pausing for user confirmation between intermediate file operations.
   - Validate builds and tests before concluding.
   - Report a consolidated final delivery summary.
