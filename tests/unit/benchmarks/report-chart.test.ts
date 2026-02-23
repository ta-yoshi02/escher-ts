import { describe, expect, it } from "vitest";
import {
  benchmarkReportToCsv,
  benchmarkReportToSvg,
  runTypedEscherBenchmarks,
  standardListBenchmarks,
} from "../../../src/index.js";

describe("benchmark report chart", () => {
  it("renders csv and svg outputs", () => {
    const report = runTypedEscherBenchmarks({
      benchmarks: standardListBenchmarks.slice(0, 2),
      synthConfig: {
        maxCost: 11,
        searchSizeFactor: 3,
        maxReboots: 3,
        goalSearchStrategy: "then-first",
        deleteAllErr: true,
        timeoutMs: 5000,
      },
    });

    const csv = benchmarkReportToCsv(report);
    expect(csv).toContain("name,success,elapsed_ms,cost,depth,reboots");
    expect(csv).toContain("reverse");

    const svg = benchmarkReportToSvg(report);
    expect(svg).toContain("<svg");
    expect(svg).toContain("TypedEscher Benchmark Runtime");
  });
});
