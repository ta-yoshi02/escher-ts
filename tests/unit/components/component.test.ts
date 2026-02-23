import { describe, expect, it } from "vitest";
import {
  anyArgSmaller,
  ComponentImpl,
  createComponentEnv,
  defineComponent,
  defineComponents,
  recursiveImpl,
} from "../../../src/components/component.js";
import { c, if_, tyBool, tyInt, tyList, tyVar, v } from "../../../src/utils/dsl.js";
import { valueBool, valueError, valueInt, valueList } from "../../../src/types/value.js";

describe("component migration", () => {
  it("executes recursive component with decreasing argument", () => {
    const isZero = new ComponentImpl("isZero", [tyInt], tyBool, (args) => {
      const x = args[0];
      return x?.tag === "int" ? valueBool(x.value === 0) : valueBool(false);
    });

    const dec = new ComponentImpl("dec", [tyInt], tyInt, (args) => {
      const x = args[0];
      return x?.tag === "int" ? valueInt(x.value - 1) : valueError;
    });

    const zero = new ComponentImpl("zero", [], tyInt, () => valueInt(0));

    const countdown = recursiveImpl(
      {
        name: "countdown",
        argNames: ["n"],
        inputTypes: [tyInt],
        returnType: tyInt,
      },
      new Map([
        ["isZero", isZero],
        ["dec", dec],
        ["zero", zero],
      ]),
      anyArgSmaller,
      if_(c("isZero", v("n")), c("zero"), c("countdown", c("dec", v("n")))),
    );

    expect(countdown.executeEfficient([valueInt(4)])).toEqual(valueInt(0));
    expect(countdown.executeEfficient([valueInt(-1)])).toEqual(valueError);
  });

  it("supports list length via recursive term evaluation", () => {
    const isNil = new ComponentImpl("isNil", [tyList(tyVar(0))], tyBool, (args) => {
      const xs = args[0];
      return xs?.tag === "list" ? valueBool(xs.elems.length === 0) : valueError;
    });

    const tail = new ComponentImpl("tail", [tyList(tyVar(0))], tyList(tyVar(0)), (args) => {
      const xs = args[0];
      if (xs?.tag !== "list") {
        return valueError;
      }
      const [, ...rest] = xs.elems;
      return valueList(rest);
    });

    const zero = new ComponentImpl("zero", [], tyInt, () => valueInt(0));
    const inc = new ComponentImpl("inc", [tyInt], tyInt, (args) => {
      const x = args[0];
      return x?.tag === "int" ? valueInt(x.value + 1) : valueError;
    });

    const length = recursiveImpl(
      {
        name: "lengthRec",
        argNames: ["xs"],
        inputTypes: [tyList(tyVar(0))],
        returnType: tyInt,
      },
      new Map([
        ["isNil", isNil],
        ["tail", tail],
        ["zero", zero],
        ["inc", inc],
      ]),
      anyArgSmaller,
      if_(c("isNil", v("xs")), c("zero"), c("inc", c("lengthRec", c("tail", v("xs"))))),
    );

    expect(length.executeEfficient([valueList([])])).toEqual(valueInt(0));
    expect(length.executeEfficient([valueList([valueInt(1), valueInt(2), valueInt(3)])])).toEqual(valueInt(3));
  });

  it("provides declarative component definitions", () => {
    const zero = defineComponent({
      name: "zero",
      inputTypes: [],
      returnType: tyInt,
      impl: () => valueInt(0),
    });
    const inc = defineComponent({
      name: "inc",
      inputTypes: [tyInt],
      returnType: tyInt,
      impl: (args) => {
        const n = args[0];
        return n?.tag === "int" ? valueInt(n.value + 1) : valueError;
      },
    });
    const env = createComponentEnv([zero, inc]);
    expect(env.get("zero")?.executeEfficient([])).toEqual(valueInt(0));
    expect(env.get("inc")?.executeEfficient([valueInt(2)])).toEqual(valueInt(3));
  });

  it("rejects duplicate component names in definition/env helpers", () => {
    expect(() =>
      defineComponents([
        { name: "x", inputTypes: [], returnType: tyInt, impl: () => valueInt(0) },
        { name: "x", inputTypes: [], returnType: tyInt, impl: () => valueInt(1) },
      ]),
    ).toThrow("Duplicate component name");

    const compA = defineComponent({ name: "x", inputTypes: [], returnType: tyInt, impl: () => valueInt(0) });
    const compB = defineComponent({ name: "x", inputTypes: [], returnType: tyInt, impl: () => valueInt(1) });
    expect(() => createComponentEnv([compA, compB])).toThrow("Duplicate component name");
  });
});
