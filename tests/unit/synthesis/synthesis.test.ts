import { describe, expect, it } from "vitest";
import {
  cartesianProduct,
  divideNumberAsSum,
  exampleLt,
  matchWithIndexValueMap,
  splitGoal,
  splitValueMap,
  toValueVector,
  typesForCosts,
} from "../../../src/synthesis/common/core.js";
import {
  showType,
  tyBool,
  tyInt,
  tyList,
  tyPair,
  type Type,
  typeVar,
} from "../../../src/types/type.js";
import { valueBool, valueError, valueInt, valueUnknown } from "../../../src/types/value.js";

const typePairKey = (argTypes: readonly Type[], retType: Type): string => {
  const args = argTypes.map(showType).join(",");
  return `${args}->${showType(retType)}`;
};

describe("synthesis migration", () => {
  it("computes typesForCosts as in Scala tests", () => {
    const typesAtCost = (cost: number): readonly Type[] => {
      switch (cost) {
        case 1:
          return [tyInt];
        case 2:
          return [tyInt, tyList(typeVar(0))];
        case 3:
          return [tyPair(tyInt, tyBool)];
        default:
          return [];
      }
    };

    const run = (costs: readonly number[], inputTypes: readonly Type[], returnType: Type): Set<string> => {
      const out = typesForCosts(typesAtCost, costs, inputTypes, returnType);
      return new Set(out.map(([args, ret]) => typePairKey(args, ret)));
    };

    expect(run([1, 1], [tyInt, tyInt], tyBool)).toEqual(new Set(["Int,Int->Bool"]));

    expect(run([1, 2], [tyInt, tyList(typeVar(0))], tyBool)).toEqual(new Set(["Int,List[?0]->Bool"]));

    expect(run([1, 2], [tyInt, tyList(typeVar(0))], typeVar(0))).toEqual(new Set(["Int,List[?0]->?0"]));

    expect(run([3, 1], [tyPair(typeVar(0), typeVar(0)), typeVar(0)], tyList(typeVar(1)))).toEqual(new Set());

    expect(run([3, 1], [tyPair(typeVar(0), typeVar(1)), typeVar(0)], tyList(typeVar(2)))).toEqual(
      new Set(["Pair[Int,Bool],Int->List[?0]"]),
    );

    expect(run([2, 2], [typeVar(0), tyList(typeVar(0))], tyList(tyInt))).toEqual(
      new Set(["Int,List[?0]->List[Int]", "List[?0],List[?0]->List[Int]"]),
    );

    expect(run([2, 2], [typeVar(0), tyList(typeVar(0))], tyList(typeVar(0)))).toEqual(
      new Set(["Int,List[?0]->List[Int]", "List[?0],List[?0]->List[List[?0]]"]),
    );
  });

  it("splits value map correctly", () => {
    const map1 = new Map<number, ReturnType<typeof valueInt>>([
      [1, valueInt(1)],
      [2, valueInt(2)],
      [3, valueInt(0)],
      [4, valueInt(0)],
    ]);
    const vec1 = [valueInt(0), valueInt(1), valueInt(2), valueInt(3), valueInt(4), valueInt(5), valueInt(6)] as const;

    const r1 = splitValueMap(map1, vec1);
    expect(r1).not.toBeNull();
    expect(r1?.[0]).toEqual(
      new Map([
        [1, valueBool(true)],
        [2, valueBool(true)],
        [3, valueBool(false)],
        [4, valueBool(false)],
      ]),
    );
    expect(r1?.[1]).toEqual(
      new Map([
        [1, valueInt(1)],
        [2, valueInt(2)],
      ]),
    );
    expect(r1?.[2]).toEqual(
      new Map([
        [3, valueInt(0)],
        [4, valueInt(0)],
      ]),
    );

    const map2 = new Map<number, ReturnType<typeof valueInt>>([
      [1, valueInt(1)],
      [2, valueInt(0)],
      [3, valueInt(0)],
      [4, valueInt(4)],
    ]);
    const vec2 = [valueInt(0), valueInt(1), valueInt(2), valueInt(3), valueInt(4), valueInt(5), valueInt(6)] as const;

    const r2 = splitValueMap(map2, vec2);
    expect(r2).not.toBeNull();
    expect(r2?.[0]).toEqual(
      new Map([
        [1, valueBool(true)],
        [2, valueBool(false)],
        [3, valueBool(false)],
        [4, valueBool(true)],
      ]),
    );
    expect(r2?.[1]).toEqual(
      new Map([
        [1, valueInt(1)],
        [4, valueInt(4)],
      ]),
    );
    expect(r2?.[2]).toEqual(
      new Map([
        [2, valueInt(0)],
        [3, valueInt(0)],
      ]),
    );
  });

  it("handles extended value vector matching", () => {
    const vec = [valueInt(1), valueUnknown, valueInt(3)] as const;
    const m = new Map([
      [0, valueInt(1)],
      [1, valueInt(2)],
    ]);
    const r = matchWithIndexValueMap(vec, m);
    expect(r.kind).toBe("possibleMatch");
    if (r.kind === "possibleMatch") {
      expect(r.leftToCheck).toEqual(new Map([[1, valueInt(2)]]));
    }

    expect(toValueVector([valueInt(1), valueInt(2)])).toEqual([valueInt(1), valueInt(2)]);
    expect(toValueVector([valueInt(1), valueUnknown])).toBeNull();
  });

  it("splits bool goal vectors", () => {
    const vec = [valueBool(true), valueBool(false), valueBool(true)] as const;
    const goal = new Map([
      [0, valueInt(1)],
      [1, valueInt(2)],
      [2, valueInt(3)],
    ]);

    const split = splitGoal(vec, goal);
    expect(split).not.toBeNull();
    expect(split?.[0]).toEqual(
      new Map([
        [0, valueInt(1)],
        [2, valueInt(3)],
      ]),
    );
    expect(split?.[1]).toEqual(new Map([[1, valueInt(2)]]));

    expect(splitGoal([valueError, valueBool(false)], new Map([[0, valueInt(1)]]))).toBeNull();
  });

  it("supports combinatorics helpers", () => {
    expect(divideNumberAsSum(4, 2, 1)).toEqual([
      [1, 3],
      [2, 2],
      [3, 1],
    ]);

    expect(cartesianProduct<number>([[1, 2], [3], [4, 5]])).toEqual([
      [1, 3, 4],
      [1, 3, 5],
      [2, 3, 4],
      [2, 3, 5],
    ]);
  });

  it("orders examples with Scala-compatible arg ordering", () => {
    expect(exampleLt([[valueInt(-1)], valueInt(0)], [[valueInt(2)], valueInt(0)])).toBe(true);
    expect(exampleLt([[valueInt(2)], valueInt(0)], [[valueInt(-1)], valueInt(0)])).toBe(false);
    expect(exampleLt([[valueInt(-2)], valueInt(0)], [[valueInt(2)], valueInt(0)])).toBe(false);
  });
});
