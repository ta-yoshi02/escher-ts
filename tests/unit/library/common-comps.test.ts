import { describe, expect, it } from "vitest";
import {
  createBenchmarkPresetEnv,
  compressRef,
  createCommonComponentEnv,
  createCommonComponentEnvByDomain,
  getBenchmarkPresetComponents,
  getCommonComponents,
  getCommonComponentsByDomain,
  isNull,
  listBenchmarkComponentPresets,
  listCommonComponentDomains,
  listCommonComponentSets,
  reverseRef,
  stutterRef,
  valueBool,
  valueInt,
  valueRef,
  valueList,
} from "../../../src/index.js";

describe("common comps", () => {
  it("reverse reference component works", () => {
    const out = reverseRef.executeEfficient([valueList([valueInt(1), valueInt(2), valueInt(3)])]);
    expect(out).toEqual(valueList([valueInt(3), valueInt(2), valueInt(1)]));
  });

  it("stutter reference component works", () => {
    const out = stutterRef.executeEfficient([valueList([valueInt(5), valueInt(6)])]);
    expect(out).toEqual(valueList([valueInt(5), valueInt(5), valueInt(6), valueInt(6)]));
  });

  it("compress reference component works", () => {
    const out = compressRef.executeEfficient([valueList([valueInt(2), valueInt(3), valueInt(3), valueInt(9), valueInt(9)])]);
    expect(out).toEqual(valueList([valueInt(2), valueInt(3), valueInt(9)]));
  });

  it("isNull component treats -1 as null reference label", () => {
    expect(isNull.executeEfficient([valueRef(-1)])).toEqual(valueBool(true));
    expect(isNull.executeEfficient([valueRef(0)])).toEqual(valueBool(false));
    expect(isNull.executeEfficient([valueRef(42)])).toEqual(valueBool(false));
  });

  it("exposes named common component sets for external composition", () => {
    expect(listCommonComponentSets()).toEqual([
      "standard-list",
      "typed-escher-standard",
      "extended-standard",
    ]);
    expect(getCommonComponents("standard-list").length).toBeGreaterThan(0);
    const env = createCommonComponentEnv("standard-list");
    expect(env.has("isNil")).toBe(true);
    expect(() => createCommonComponentEnv("extended-standard")).not.toThrow();
  });

  it("exposes domain-oriented component APIs", () => {
    expect(listCommonComponentDomains()).toEqual(["lists", "integers", "trees"]);
    expect(getCommonComponentsByDomain("lists").length).toBeGreaterThan(0);
    const env = createCommonComponentEnvByDomain("integers");
    expect(env.has("plus")).toBe(true);
  });

  it("exposes benchmark-oriented minimal presets", () => {
    expect(listBenchmarkComponentPresets()).toContain("reverse");
    const reverseSet = getBenchmarkPresetComponents("reverse");
    expect(reverseSet.some((c) => c.name === "concat")).toBe(true);
    const env = createBenchmarkPresetEnv("nodesAtLevel");
    expect(env.has("treeLeft")).toBe(true);
  });
});
