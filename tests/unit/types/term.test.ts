import { describe, expect, it } from "vitest";
import { ComponentImpl } from "../../../src/components/component.js";
import { componentTerm, executeTerm, ifTerm, termLt, varTerm } from "../../../src/types/term.js";
import { tyBool, tyInt } from "../../../src/types/type.js";
import { valueBool, valueInt } from "../../../src/types/value.js";

describe("term migration", () => {
  it("orders terms deterministically", () => {
    expect(termLt(varTerm("a"), varTerm("b"))).toBe(true);
    expect(termLt(componentTerm("f", [varTerm("a")]), componentTerm("g", [varTerm("a")]))).toBe(true);
  });

  it("evaluates component and if terms", () => {
    const isZero = new ComponentImpl("isZero", [tyInt], tyBool, (args) => {
      const n = args[0];
      if (n?.tag !== "int") {
        return valueBool(false);
      }
      return valueBool(n.value === 0);
    });

    const inc = new ComponentImpl("inc", [tyInt], tyInt, (args) => {
      const n = args[0];
      if (n?.tag !== "int") {
        return valueInt(0);
      }
      return valueInt(n.value + 1);
    });

    const term = ifTerm(componentTerm("isZero", [varTerm("x")]), varTerm("x"), componentTerm("inc", [varTerm("x")]));

    const compMap = new Map([
      ["isZero", isZero],
      ["inc", inc],
    ]);

    const out1 = executeTerm((name) => (name === "x" ? valueInt(0) : valueInt(7)), compMap, term);
    const out2 = executeTerm((name) => (name === "x" ? valueInt(3) : valueInt(7)), compMap, term);

    expect(out1).toEqual(valueInt(0));
    expect(out2).toEqual(valueInt(4));
  });
});
