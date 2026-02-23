# Test Structure

- `tests/unit/`
  - Fast, deterministic tests for isolated modules.
  - `types/`, `components/`, `synthesis/`, `utils/` are grouped by production module.
- `tests/integration/`
  - End-to-end behavior across multiple modules.
  - Recursive execution paths and cross-module composition belong here.

## Naming

- Use `*.test.ts` for all test files.
- Prefer one primary subject per file.
- Keep shared setup local until duplication is meaningful; then extract to `tests/helpers/`.

## Current Scope

- Phase1/2 are covered by unit and integration tests.
- Phase3 (enumeration/state machine) tests should be added under `tests/unit/synthesis/` and `tests/integration/`.
