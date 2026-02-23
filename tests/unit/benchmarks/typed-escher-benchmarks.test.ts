import { describe, expect, it } from "vitest";
import {
  paperExamplesBenchmarks,
  standardListBenchmarks,
} from "../../../src/benchmarks/typed-escher-benchmarks.js";

describe("typed escher benchmarks", () => {
  it("defines benchmark cases with consistent examples", () => {
    for (const benchmark of standardListBenchmarks) {
      expect(benchmark.examples.length).toBeGreaterThan(0);
      for (const [args, out] of benchmark.examples) {
        expect(args.length).toBe(benchmark.inputTypes.length);
        expect(benchmark.oracle(args)).toEqual(out);
      }
    }
  });

  it("keeps oracle-consistent examples for all paper cases", () => {
    for (const benchmark of paperExamplesBenchmarks) {
      expect(benchmark.examples.length).toBeGreaterThan(0);
      for (const [args, out] of benchmark.examples) {
        expect(benchmark.oracle(args)).toEqual(out);
      }
    }
  });

  it("uses benchmark-local component envs", () => {
    for (const benchmark of paperExamplesBenchmarks) {
      const ascendRecEnv = benchmark.ascendRecEnv ?? benchmark.env;
      const baselineNames = new Set([...benchmark.env.keys()]);
      const ascendRecNames = new Set([...ascendRecEnv.keys()]);
      expect(ascendRecNames).toEqual(baselineNames);
    }
  });

  it("loads all 17 benchmark specs from JSON", () => {
    expect(paperExamplesBenchmarks).toHaveLength(17);
  });
});
