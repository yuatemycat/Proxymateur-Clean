---
name: owl
description: Deep codebase investigation, iterative autonomous synthesis, and multi-agent architecture analysis using DeepInvestigator and DeepCoder orchestration.
---

# Owl Autonomous Investigation Pipeline

Triggered by `/owl <task>`.

This skill activates the Owl autonomous deep reasoning and iterative investigation pipeline.

## Architecture & Subagent Coordination
Owl coordinates deep investigation and high-assurance code synthesis across specialized agent roles:
1. **DeepInvestigator** (`TypeName='DeepInvestigator'`):
   - **Layer 0 Scratch Analysis**: Performs unconstrained, thorough root-cause investigations, reverse engineering, and trace reconstruction from source files without premature assumptions.
   - **Challenger / Improvement Verification**: Reviews initial hypotheses, attacks potential edge cases, checks binary and runtime invariants, and validates proof of facts.
2. **DeepCoder** (`TypeName='DeepCoder'`):
   - High-assurance implementation, surgical patch crafting, and end-to-end verification.

## Execution Workflow
1. **Investigate**: Thoroughly analyze the question, codebase, or problem from first principles.
2. **Verify Invariants**: Challenge assumptions and test hypotheses against source code evidence.
3. **Report & Synthesize**: Produce clear, structured artifact reports and actionable code solutions.
