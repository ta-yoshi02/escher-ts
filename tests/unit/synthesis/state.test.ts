import { describe, expect, it } from "vitest";
import { componentTerm, varTerm } from "../../../src/types/term.js";
import { tyBool, tyInt } from "../../../src/types/type.js";
import { valueBool, valueInt } from "../../../src/types/value.js";
import { SynthesisState } from "../../../src/synthesis/escher/state.js";

describe("synthesis state", () => {
  it("deduplicates by type and value vector", () => {
    const state = new SynthesisState(2, tyInt);
    state.openNextLevel(1);

    const first = state.registerTerm(1, tyInt, varTerm("x"), [valueInt(1), valueInt(2)]);
    const second = state.registerTerm(1, tyInt, varTerm("y"), [valueInt(1), valueInt(2)]);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(state.levelStats(1)).toEqual({ entries: 1, types: 1 });
  });

  it("indexes bool/return entries and finds goal hit", () => {
    const state = new SynthesisState(2, tyInt);
    state.openNextLevel(1);
    state.openNextLevel(2);

    state.registerTerm(1, tyBool, varTerm("b"), [valueBool(true), valueBool(false)]);
    state.registerTerm(2, tyInt, componentTerm("zero", []), [valueInt(0), valueInt(0)]);

    expect(state.boolEntriesOfCost(1)).toHaveLength(1);
    expect(state.returnTypeEntriesOfCost(2)).toHaveLength(1);

    const hit = state.findGoalHit([valueInt(0), valueInt(0)], 2);
    expect(hit?.cost).toBe(2);
  });
});
