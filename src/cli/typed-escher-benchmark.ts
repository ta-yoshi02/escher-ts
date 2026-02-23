import { parseArgs } from "node:util";
import {
  runTypedEscherBenchmarks,
} from "../benchmarks/harness.js";
import {
  createProgressHooks,
  emitBenchmarkOutputs,
  normalizeCliArgs,
  parseNumber,
  parseStrategy,
  parseSuite,
  selectBenchmarks,
} from "./benchmark-cli-common.js";

const main = () => {
  const normalizedArgs = normalizeCliArgs(process.argv.slice(2));

  const parsed = parseArgs({
    args: normalizedArgs,
    options: {
      maxCost: { type: "string" },
      timeoutMs: { type: "string" },
      searchSizeFactor: { type: "string" },
      maxReboots: { type: "string" },
      strategy: { type: "string" },
      suite: { type: "string" },
      benchmarks: { type: "string" },
      json: { type: "boolean" },
      quiet: { type: "boolean" },
      svg: { type: "string" },
      csv: { type: "string" },
      programs: { type: "string" },
    },
    allowPositionals: false,
  });

  const suite = parseSuite(parsed.values.suite);
  const benchmarks = selectBenchmarks(suite, parsed.values.benchmarks);

  const hooks = createProgressHooks(parsed.values.quiet);

  const report = runTypedEscherBenchmarks({
    benchmarks,
    synthConfig: {
      maxCost: parseNumber(parsed.values.maxCost, 20),
      searchSizeFactor: parseNumber(parsed.values.searchSizeFactor, 3),
      maxReboots: parseNumber(parsed.values.maxReboots, 10),
      goalSearchStrategy: parseStrategy(parsed.values.strategy),
      deleteAllErr: true,
      timeoutMs: parseNumber(parsed.values.timeoutMs, 1000),
    },
    ...(hooks !== undefined ? { hooks } : {}),
  });

  emitBenchmarkOutputs("typed-escher", suite, parsed.values, report);

  if (report.failed > 0) {
    process.exitCode = 1;
  }
};

main();
