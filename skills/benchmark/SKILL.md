---
name: benchmark
description: Programmatic Tool Synthesis & Performance Benchmarking. Synthesizes ad-hoc stress-test tools and runs headless simulations to profile performance and frame budgets.
---

# Programmatic Benchmark & Tool Synthesis Pipeline

Triggered by `/benchmark <task>` or requests to profile, stress-test, or benchmark runtime performance.

This skill leverages `enable-programmatic-tools` to synthesize ad-hoc measurement code dynamically.

## Operational Protocol

1. **Identify Performance Targets & Invariants**:
   - Define exact performance targets: frame budget (e.g. 16.6ms for 60fps), operations per second, memory allocations, or network round-trip time.

2. **Programmatic Harness Synthesis**:
   - Instead of static manual inspection, write a dedicated, executable headless test harness (Node.js, Python, or Rust).
   - The harness should execute multi-iteration stress tests (e.g. 5,000 objects across 300 simulation ticks).

3. **Execution & Telemetry Capture**:
   - Run the synthesized tool headlessly via `run_command`.
   - Measure minimum, average, maximum, standard deviation (jitter), and 99th percentile (p99) metrics.

4. **Structured JSON Reporting**:
   - Format results as a structured JSON telemetry report followed by a concise diagnostic breakdown of discovered performance bottlenecks and recommended code optimizations.
