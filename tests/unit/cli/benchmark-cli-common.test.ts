import { describe, expect, it } from "vitest";
import { parseSuite, selectBenchmarks } from "../../../src/cli/benchmark-cli-common.js";

describe("benchmark CLI common", () => {
  it("parses suite names including classes/pure", () => {
    expect(parseSuite("classes")).toBe("classes");
    expect(parseSuite("pure")).toBe("pure");
    expect(parseSuite(undefined)).toBe("standard");
    expect(() => parseSuite("unknown")).toThrow(/Unknown suite/);
  });

  it("selects class benchmarks by default for classes suite", () => {
    const selected = selectBenchmarks("classes", undefined);
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.every((b) => b.category === "classes")).toBe(true);
  });

  it("selects pure suite benchmarks from suite file by default", () => {
    const selected = selectBenchmarks("pure", undefined);
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.map((b) => b.name)).toContain("reverse");
    expect(selected.map((b) => b.name)).toContain("nodesAtLevel");
  });

  it("filters by benchmark names", () => {
    const selected = selectBenchmarks("classes", "dllistIsNull,dllistThisRef");
    expect(selected.map((b) => b.name)).toEqual(["dllistIsNull", "dllistThisRef"]);
  });
});
