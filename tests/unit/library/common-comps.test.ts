import { describe, expect, it } from "vitest";
import {
  createBenchmarkPresetEnv,
  compressRef,
  createCommonComponentEnv,
  createCommonComponentEnvByDomain,
  findByValueRef,
  freshRefFromHeap,
  getBenchmarkPresetComponents,
  getCommonComponents,
  getCommonComponentsByDomain,
  isNull,
  last_ptr,
  listBenchmarkComponentPresets,
  listCommonComponentDomains,
  listCommonComponentSets,
  nthNextRef,
  penultimateRef,
  reverseRef,
  stutterRef,
  storeAtRef,
  valueBool,
  valueInt,
  valueList,
  valueObject,
  valueRef,
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

  it("storeAtRef replaces the fixed-ID slot without mutating the input heap", () => {
    const input = valueList([valueInt(10), valueInt(20), valueInt(30)]);
    const out = storeAtRef.executeEfficient([input, valueRef(1), valueInt(99)]);
    expect(out).toEqual(valueList([valueInt(10), valueInt(99), valueInt(30)]));
    expect(input).toEqual(valueList([valueInt(10), valueInt(20), valueInt(30)]));
  });

  it("storeAtRef rejects null and out-of-range references", () => {
    const heap = valueList([valueInt(10)]);
    expect(storeAtRef.executeEfficient([heap, valueRef(-1), valueInt(99)]).tag).toBe("error");
    expect(storeAtRef.executeEfficient([heap, valueRef(1), valueInt(99)]).tag).toBe("error");
  });

  it("freshRefFromHeap returns the next fixed object ID", () => {
    const heap = valueList([valueObject("Node", {}), valueObject("Node", {})]);
    expect(freshRefFromHeap.executeEfficient([heap])).toEqual(valueRef(2));
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
    expect(listCommonComponentDomains()).toEqual(["lists", "integers", "trees", "heaps"]);
    expect(getCommonComponentsByDomain("lists").length).toBeGreaterThan(0);
    const env = createCommonComponentEnvByDomain("integers");
    expect(env.has("plus")).toBe(true);
    expect(createCommonComponentEnvByDomain("heaps").has("last_ptr")).toBe(true);
    expect(createCommonComponentEnvByDomain("heaps").has("penultimateRef")).toBe(true);
    expect(createCommonComponentEnvByDomain("heaps").has("storeAtRef")).toBe(true);
    expect(createCommonComponentEnvByDomain("heaps").has("freshRefFromHeap")).toBe(true);
  });

  it("exposes benchmark-oriented minimal presets", () => {
    expect(listBenchmarkComponentPresets()).toContain("reverse");
    const reverseSet = getBenchmarkPresetComponents("reverse");
    expect(reverseSet.some((c) => c.name === "concat")).toBe(true);
    const env = createBenchmarkPresetEnv("nodesAtLevel");
    expect(env.has("treeLeft")).toBe(true);
  });

  it("last_ptr returns the tail reference from a next-heap", () => {
    const out = last_ptr.executeEfficient([
      valueRef(0),
      valueList([valueRef(1), valueRef(2), valueRef(-1)]),
    ]);
    expect(out).toEqual(valueRef(2));
  });

  it("penultimateRef returns the predecessor of the tail from a next-heap", () => {
    const out = penultimateRef.executeEfficient([
      valueRef(0),
      valueList([valueRef(1), valueRef(2), valueRef(-1)]),
    ]);
    expect(out).toEqual(valueRef(1));
    const tooShort = penultimateRef.executeEfficient([valueRef(0), valueList([valueRef(-1)])]);
    expect(tooShort).toEqual(valueRef(-1));
  });

  it("nthNextRef walks forward over a heap-backed next field", () => {
    const nodeHeap = valueList([
      valueObject("Node", {}),
      valueObject("Node", {}),
      valueObject("Node", {}),
    ]);
    const nextHeap = valueList([valueRef(1), valueRef(2), valueRef(-1)]);
    const out = nthNextRef.executeEfficient([valueRef(0), nodeHeap, nextHeap, valueInt(2)]);
    expect(out).toEqual(valueRef(2));
  });

  it("findByValueRef locates the first matching node by value heap", () => {
    const nodeHeap = valueList([
      valueObject("Node", {}),
      valueObject("Node", {}),
      valueObject("Node", {}),
    ]);
    const nextHeap = valueList([valueRef(1), valueRef(2), valueRef(-1)]);
    const valueHeap = valueList([valueInt(10), valueInt(42), valueInt(7)]);
    const out = findByValueRef.executeEfficient([
      valueRef(0),
      nodeHeap,
      nextHeap,
      valueHeap,
      valueInt(42),
    ]);
    expect(out).toEqual(valueRef(1));
  });
});
