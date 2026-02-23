import { describe, expect, it } from "vitest";
import { componentTerm } from "../../../src/types/term.js";
import { tyBool, tyInt } from "../../../src/types/type.js";
import { valueBool, valueInt, valueUnknown } from "../../../src/types/value.js";
import { AscendRecState } from "../../../src/synthesis/ascendrec/state.js";

describe("ascendrec state", () => {
  it("separates known non-rec and unknown rec entries", () => {
    const state = new AscendRecState(2, tyInt);
    state.openNextLevel(1);

    const tKnown = componentTerm("k", []);
    const tUnknown = componentTerm("u", []);

    expect(state.registerTermAtLevel(1, tyInt, tKnown, [valueInt(1), valueInt(2)])).toBe(true);
    expect(state.registerTermAtLevel(1, tyInt, tUnknown, [valueUnknown, valueInt(2)])).toBe(true);

    expect(state.nonRecEntriesOfCostAndType(1, tyInt).map((e) => e.term)).toEqual([tKnown]);
    expect(state.recEntriesOfCostAndType(1, tyInt).map((e) => e.term)).toEqual([tUnknown]);
  });

  it("builds per-level libraries for goal return and bool types", () => {
    const state = new AscendRecState(2, tyInt);
    state.openNextLevel(1);

    const tInt = componentTerm("intTerm", []);
    const tBool = componentTerm("boolTerm", []);
    const tRecInt = componentTerm("recInt", []);

    state.registerTermAtLevel(1, tyInt, tInt, [valueInt(3), valueInt(5)]);
    state.registerTermAtLevel(1, tyBool, tBool, [valueBool(true), valueBool(false)]);
    state.registerTermAtLevel(1, tyInt, tRecInt, [valueUnknown, valueInt(5)]);

    state.createLibrariesForThisLevel(1);

    expect(state.termsOfCost(1).map(([, term]) => term)).toContain(tInt);
    expect(state.nonRecBoolTerms(1).map(([, term]) => term)).toContain(tBool);
    expect(state.recTermsOfReturnType(1).map(([term]) => term)).toContain(tRecInt);
  });

  it("applies reduction rules only when registering recursive (unknown) entries", () => {
    const reductionRules = new Map<string, (args: readonly import("../../../src/types/term.js").Term[]) => boolean>([
      ["bad", () => true],
    ]);
    const state = new AscendRecState(1, tyInt, reductionRules);
    state.openNextLevel(1);

    const t = componentTerm("bad", []);
    expect(state.registerTermAtLevel(1, tyInt, t, [valueInt(1)])).toBe(true);
    expect(state.nonRecEntriesOfCostAndType(1, tyInt).map((e) => e.term)).toContain(t);

    expect(state.registerTermAtLevel(1, tyInt, t, [valueUnknown])).toBe(false);
    expect(state.recEntriesOfCostAndType(1, tyInt).map((e) => e.term)).not.toContain(t);
  });
});
