import { describe, expect, it } from "vitest";
import { createComponentEnv } from "../../../src/components/component.js";
import {
  defineUserComponents,
  intBinary,
  intConst,
  leafLit,
  literalExamples,
  literalOracle,
  literalToValue,
  nodeLit,
  objectLit,
  pairLit,
} from "../../../src/components/user-friendly.js";
import { binaryLeaf, binaryNode, valueInt, valueObject, valuePair, valueTree } from "../../../src/types/value.js";

describe("user-friendly component API", () => {
  it("converts plain literals into TermValue examples", () => {
    const examples = literalExamples([
      [[1, 2], 3],
      [[[1, 2, 3]], [1, 2, 3]],
      [[true], false],
    ] as const);

    expect(examples[0]?.[0][0]).toEqual(valueInt(1));
    expect(examples[0]?.[1]).toEqual(valueInt(3));
    expect(examples).toHaveLength(3);
  });

  it("builds int components without manual valueInt/valueError", () => {
    const env = createComponentEnv(
      defineUserComponents([intConst("two", 2), intBinary("add", (x, y) => x + y)]),
    );

    expect(env.get("two")?.executeEfficient([])).toEqual(valueInt(2));
    expect(env.get("add")?.executeEfficient([valueInt(4), valueInt(5)])).toEqual(valueInt(9));
  });

  it("wraps literal oracle into internal oracle type", () => {
    const oracle = literalOracle(([x, y]) =>
      typeof x === "number" && typeof y === "number" ? x * 2 + y : 0,
    );
    expect(oracle([literalToValue(7), literalToValue(3)])).toEqual(valueInt(17));
  });

  it("supports pair/tree literals", () => {
    expect(literalToValue(pairLit(1, 2))).toEqual(valuePair(valueInt(1), valueInt(2)));
    expect(literalToValue(nodeLit(1, leafLit(), leafLit()))).toEqual(
      valueTree(binaryNode(valueInt(1), binaryLeaf, binaryLeaf)),
    );
    expect(literalToValue(objectLit("Point", { x: 1, y: 2 }))).toEqual(
      valueObject("Point", { x: valueInt(1), y: valueInt(2) }),
    );
  });
});
