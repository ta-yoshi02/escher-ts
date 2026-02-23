# Synthesis Architecture

This directory is split so Escher-specific logic is isolated from reusable synthesis utilities.

## Shared Core (Oracle policy agnostic)

- `common/core.ts`: value-vector and goal utilities (`typesForCosts`, `splitGoal`, combinators)
- `common/value-vector-tree.ts`: partial-vector index
- `common/config.ts`: shared synthesis config defaults and timeout helpers

These modules should be reusable by both Oracle-based Escher and Oracle-free AscendRec-style engines.

## Escher-Specific

- `escher/synthesizer.ts`: Escher synthesis loop
- `escher/state.ts`: Escher term/value-vector stores and level-indexed libraries
- `escher/goal-search.ts`: Escher batch goal search over known vectors
- `escher/types.ts`: Escher config/result types and defaults
- `escher/reboot-strategies.ts`: reboot policies
- `escher/buffered-oracle.ts`: oracle-backed recursive-call resolution
- `escher/example-order.ts`: Escher-compatible example ordering

Escher-specific behavior currently includes:

- oracle-backed recursive stub
- reboot-on-counterexample workflow

## Planned Oracle-Free Extension Point

To add AscendRec-style synthesis, introduce an engine parallel to `escher/synthesizer.ts` that reuses shared core modules and swaps:

- recursive-call resolution (`Unknown` propagation instead of oracle)
- state partitioning for known/non-rec vs unknown/rec terms
- search validation logic for partial vectors

## AscendRec Foundations (implemented)

- `ascendrec/extended-component.ts`
  - `ExtendedValue` (`TermValue | Unknown`) execution model
  - Unknown/error propagation compatible with Scala `ExtendedCompImpl.fromImplOnTermValue`
- `ascendrec/known-map-recursive.ts`
  - Oracle-free recursive stub:
  - returns known outputs from initial examples
  - returns `Unknown` for unseen recursive inputs
- `ascendrec/state.ts`
  - separates known/non-rec terms from unknown-containing rec terms
  - maintains per-level libraries for goal search
- `ascendrec/goal-search.ts`
  - AscendRec-specific backward search over known + recursive partial vectors
  - includes partial recursive branch validation against assembled recursive programs
  - timeout-aware search and cached recursive-impl validation
- `ascendrec/synthesizer.ts`
  - first Oracle-free synthesis loop using `AscendRecState` + `AscendRecGoalSearch`
  - supports `onlyForwardSearch` direct-hit return path
  - applies configurable reduction-rule pruning
