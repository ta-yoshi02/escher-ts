import { describe, expect, it } from "vitest";
import {
  formatBenchmarkProgramPairs,
  formatBenchmarkReport,
  reverseBenchmark,
  runAscendRecBenchmarks,
  runTypedEscherBenchmarks,
  stutterBenchmark,
} from "../../../src/index.js";

describe("benchmark report formatters", () => {
  it("formats typed-escher summary and program comparison", () => {
    const report = runTypedEscherBenchmarks({
      benchmarks: [reverseBenchmark, stutterBenchmark],
      synthConfig: {
        maxCost: 11,
        searchSizeFactor: 3,
        maxReboots: 3,
        goalSearchStrategy: "then-first",
        deleteAllErr: true,
        timeoutMs: 5000,
      },
    });

    const text = formatBenchmarkReport(report);
    expect(text).toContain("TypedEscher Benchmarks");
    expect(text).toContain("reverse");
    expect(text).toContain("stutter");
    expect(text).not.toContain("Programs (Oracle vs Synthesized)");
    expect(text).not.toContain("caseConfig:");

    const programs = formatBenchmarkProgramPairs(report);
    expect(programs).toContain("# Benchmark Program Comparison");
    expect(programs).toContain("### Oracle Program");
    expect(programs).toContain("### Synthesized Program");
    expect(programs).toContain("### I/O Examples");
    expect(programs).toContain("- Components (");
    expect(programs).toContain("- Options:");
  });

  it("formats ascendrec summary", () => {
    const report = runAscendRecBenchmarks({
      benchmarks: [reverseBenchmark, stutterBenchmark].map((benchmark) => ({
        ...benchmark,
        ascendRecEnv: benchmark.env,
      })),
      synthConfig: {
        maxCost: 11,
        searchSizeFactor: 3,
        maxReboots: 10,
        goalSearchStrategy: "then-first",
        deleteAllErr: true,
        timeoutMs: 5000,
        onlyForwardSearch: false,
      },
    });

    const text = formatBenchmarkReport(report);
    expect(text).toContain("AscendRec Benchmarks");
    expect(text).toContain("reverse");
    expect(text).toContain("stutter");
  });
});
