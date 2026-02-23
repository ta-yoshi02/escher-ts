import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type ComponentImpl } from "../components/component.js";
import { parseJsonSynthesisSpec, prepareJsonSynthesisJob } from "../components/user-friendly-json.js";
import { type Term } from "../types/term.js";
import { type Type } from "../types/type.js";
import { type TermValue } from "../types/value.js";

export type BenchmarkCategory = "lists" | "integers" | "trees";

export interface TypedEscherBenchmarkCase {
  name: string;
  category: BenchmarkCategory;
  inputTypes: readonly Type[];
  inputNames: readonly string[];
  returnType: Type;
  env: ReadonlyMap<string, ComponentImpl>;
  ascendRecEnv?: ReadonlyMap<string, ComponentImpl>;
  examples: readonly (readonly [readonly TermValue[], TermValue])[];
  ascendRecExamples?: readonly (readonly [readonly TermValue[], TermValue])[];
  oracle: (args: readonly TermValue[]) => TermValue;
  oraclePretty?: string;
  ascendRecReductionRules?: ReadonlyMap<string, (args: readonly Term[]) => boolean>;
}

const BENCHMARK_DIR = join(process.cwd(), "examples", "benchmarks");
const SUITE_DIR = join(process.cwd(), "examples", "benchmark-suites");
const STANDARD_SUITE_PATH = join(SUITE_DIR, "standard.json");
const asCategory = (value: unknown, benchmarkName: string): BenchmarkCategory => {
  if (value === "lists" || value === "integers" || value === "trees") {
    return value;
  }
  throw new Error(`Benchmark '${benchmarkName}' must define category as 'lists' | 'integers' | 'trees'`);
};

const loadBenchmarksFromJson = (): readonly TypedEscherBenchmarkCase[] => {
  const files = readdirSync(BENCHMARK_DIR).filter((file) => file.endsWith(".json")).sort();
  return files.map((file) => {
    const rawText = readFileSync(join(BENCHMARK_DIR, file), "utf8");
    const rawObj = JSON.parse(rawText) as Record<string, unknown>;
    const spec = parseJsonSynthesisSpec(rawText);
    const job = prepareJsonSynthesisJob(spec);
    return {
      name: job.functionName,
      category: asCategory(rawObj.category, job.functionName),
      inputTypes: job.inputTypes,
      inputNames: job.inputNames,
      returnType: job.returnType,
      env: job.env,
      examples: job.examples,
      oracle: job.oracle,
    };
  });
};

const paperByName = new Map(loadBenchmarksFromJson().map((benchmark) => [benchmark.name, benchmark] as const));
const requireBenchmark = (name: string): TypedEscherBenchmarkCase => {
  const benchmark = paperByName.get(name);
  if (benchmark === undefined) {
    throw new Error(`Benchmark '${name}' is not defined in ${BENCHMARK_DIR}`);
  }
  return benchmark;
};

const loadSuiteNames = (path: string): readonly string[] => {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  if (!Array.isArray(raw.benchmarks)) {
    throw new Error(`Suite file '${path}' must define 'benchmarks' array`);
  }
  return raw.benchmarks.map((name, index) => {
    if (typeof name !== "string" || name.length === 0) {
      throw new Error(`Suite file '${path}' has invalid benchmark name at index ${index}`);
    }
    return name;
  });
};

export const paperExamplesBenchmarks: readonly TypedEscherBenchmarkCase[] = [...paperByName.values()];
export const standardListBenchmarks: readonly TypedEscherBenchmarkCase[] = loadSuiteNames(STANDARD_SUITE_PATH).map((name) =>
  requireBenchmark(name),
);

export const reverseBenchmark = requireBenchmark("reverse");
export const lengthBenchmark = requireBenchmark("length");
export const compressBenchmark = requireBenchmark("compress");
export const stutterBenchmark = requireBenchmark("stutter");
export const squareListBenchmark = requireBenchmark("squareList");
export const insertBenchmark = requireBenchmark("insert");
export const lastInListBenchmark = requireBenchmark("lastInList");
export const cartesianBenchmark = requireBenchmark("cartesian");
export const fibBenchmark = requireBenchmark("fib");
export const sumUnderBenchmark = requireBenchmark("sumUnder");
export const dropLastBenchmark = requireBenchmark("dropLast");
export const evensBenchmark = requireBenchmark("evens");
export const shiftLeftBenchmark = requireBenchmark("shiftLeft");
export const maxInListBenchmark = requireBenchmark("maxInList");
export const flattenTreeBenchmark = requireBenchmark("flattenTree");
export const tConcatBenchmark = requireBenchmark("tConcat");
export const nodesAtLevelBenchmark = requireBenchmark("nodesAtLevel");
