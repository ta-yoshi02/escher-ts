import { describe, expect, it } from "vitest";
import { type TermValue, valueBool, valueInt } from "../../../src/types/value.js";
import { ValueVectorTree } from "../../../src/synthesis/common/value-vector-tree.js";

describe("value vector tree", () => {
  it("adds and deduplicates vectors", () => {
    const tree = new ValueVectorTree<string>(3);

    expect(tree.addTerm("a", [valueInt(1), valueInt(2), valueInt(3)])).toBe(true);
    expect(tree.addTerm("b", [valueInt(1), valueInt(2), valueInt(3)])).toBe(false);
    expect(tree.size).toBe(1);
    expect(tree.get([valueInt(1), valueInt(2), valueInt(3)])).toBe("a");
  });

  it("supports partial-vector search", () => {
    const tree = new ValueVectorTree<string>(3);
    tree.addTerm("tt", [valueBool(true), valueInt(0), valueInt(0)]);
    tree.addTerm("tf", [valueBool(true), valueInt(1), valueInt(2)]);
    tree.addTerm("ff", [valueBool(false), valueInt(1), valueInt(2)]);

    expect(tree.searchATerm(new Map<number, TermValue>([[0, valueBool(true)], [2, valueInt(2)]]))).toBe("tf");

    const terms = tree.searchTerms(new Map<number, TermValue>([[1, valueInt(1)], [2, valueInt(2)]]));
    expect(new Set(terms)).toEqual(new Set(["tf", "ff"]));
  });
});
