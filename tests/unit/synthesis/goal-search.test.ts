import { describe, expect, it } from "vitest";
import { componentTerm, ifTerm } from "../../../src/types/term.js";
import { type TermValue, valueBool, valueInt } from "../../../src/types/value.js";
import { BatchGoalSearch } from "../../../src/synthesis/escher/goal-search.js";
import { matchVector, type IndexValueMap, type ValueVector } from "../../../src/synthesis/common/core.js";

describe("batch goal search", () => {
  const buildSearch = () => {
    const cond = componentTerm("cond", []);
    const thenTerm = componentTerm("thenT", []);
    const elseTerm = componentTerm("elseT", []);

    const termsByCost = new Map<number, readonly (readonly [ValueVector, ReturnType<typeof componentTerm>])[]>([
      [1, [
        [[valueInt(1), valueInt(1)], thenTerm],
        [[valueInt(2), valueInt(2)], elseTerm],
      ]],
    ]);

    const boolByCost = new Map<number, readonly (readonly [ValueVector, ReturnType<typeof componentTerm>])[]>([
      [1, [[[valueBool(true), valueBool(false)], cond]]],
    ]);

    const goal: IndexValueMap = new Map<number, TermValue>([
      [0, valueInt(1)],
      [1, valueInt(2)],
    ]);

    const search = new BatchGoalSearch(
      3,
      (cost, vm) => {
        for (const [vv, term] of termsByCost.get(cost) ?? []) {
          if (matchVector(vm, vv)) {
            return term;
          }
        }
        return null;
      },
      (cost) => termsByCost.get(cost) ?? [],
      (cost) => boolByCost.get(cost) ?? [],
      (vm) => {
        for (const [cost, rows] of boolByCost.entries()) {
          for (const [vv, term] of rows) {
            if (matchVector(vm, vv)) {
              return [cost, term] as const;
            }
          }
        }
        return null;
      },
    );

    return { search, goal, cond, thenTerm, elseTerm };
  };

  it("builds conditional term by splitting goals (then-first)", () => {
    const { search, goal, cond, thenTerm, elseTerm } = buildSearch();
    const found = search.searchThenFirst(4, goal);
    expect(found).not.toBeNull();
    expect(found?.[0]).toBe(4);
    expect(found?.[1]).toEqual(ifTerm(cond, thenTerm, elseTerm));
  });

  it("builds conditional term by splitting goals (cond-first)", () => {
    const { search, goal, cond, thenTerm, elseTerm } = buildSearch();
    const found = search.searchCondFirst(4, goal);
    expect(found).not.toBeNull();
    expect(found?.[0]).toBe(4);
    expect(found?.[1]).toEqual(ifTerm(cond, thenTerm, elseTerm));
  });
});
