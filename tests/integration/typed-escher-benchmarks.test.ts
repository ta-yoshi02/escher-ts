import { describe, expect, it } from "vitest";
import {
  type ArgList,
  binaryLeaf,
  binaryNode,
  cartesianBenchmark,
  compressBenchmark,
  dropLastBenchmark,
  evensBenchmark,
  fibBenchmark,
  flattenTreeBenchmark,
  insertBenchmark,
  lastInListBenchmark,
  lengthBenchmark,
  maxInListBenchmark,
  nodesAtLevelBenchmark,
  pureExamplesBenchmarks,
  reverseBenchmark,
  shiftLeftBenchmark,
  squareListBenchmark,
  stutterBenchmark,
  sumUnderBenchmark,
  tConcatBenchmark,
  TypedEscherSynthesizer,
  recursiveImpl,
  anyArgSmaller,
  valueTree,
  valueInt,
  valueList,
} from "../../src/index.js";

const vi = (n: number) => valueInt(n);
const vl = (...xs: readonly number[]) => valueList(xs.map((x) => vi(x)));
const singleNode = (n: number) => binaryNode(vi(n), binaryLeaf, binaryLeaf);

const probesByBenchmark = new Map<string, readonly ArgList[]>([
  [reverseBenchmark.name, [[vl(4, 5, 6)], [vl(9)]]],
  [lengthBenchmark.name, [[vl(10, 11)], [vl(1, 2, 3, 4)]]],
  [compressBenchmark.name, [[vl(1, 1, 2, 2, 2, 3)], [vl(7, 7, 7)]]],
  [stutterBenchmark.name, [[vl(1, 2)], [vl(3, 3, 4)]]],
  [squareListBenchmark.name, [[vi(5)], [vi(-2)]]],
  [insertBenchmark.name, [[vl(4, 5), vi(1), vi(9)], [vl(4, 5), vi(5), vi(9)]]],
  [lastInListBenchmark.name, [[vl(4, 5, 7)], [vl(9)]]],
  [cartesianBenchmark.name, [[vl(1, 2), vl(3)], [vl(2), vl(8, 9)]]],
  [fibBenchmark.name, [[vi(7)], [vi(-5)]]],
  [sumUnderBenchmark.name, [[vi(5)], [vi(-4)]]],
  [dropLastBenchmark.name, [[vl(8, 9)], [vl(1, 2, 3, 4)]]],
  [evensBenchmark.name, [[vl(1, 2, 3, 4, 5)], [vl(8, 9, 10)]]],
  [shiftLeftBenchmark.name, [[vl(9, 8, 7)], [vl(3, 4)]]],
  [maxInListBenchmark.name, [[vl(-2, -7, -1)], [vl(5, 4, 9, 1)]]],
  [flattenTreeBenchmark.name, [[valueTree(binaryNode(vi(1), singleNode(2), binaryLeaf))]]],
  [tConcatBenchmark.name, [[valueTree(binaryNode(vi(2), binaryLeaf, singleNode(3))), valueTree(singleNode(9))]]],
  [nodesAtLevelBenchmark.name, [[valueTree(binaryNode(vi(5), singleNode(2), singleNode(7))), vi(0)], [valueTree(binaryNode(vi(5), singleNode(2), singleNode(7))), vi(1)]]],
]);

describe("typed escher benchmarks", () => {
  it.each([reverseBenchmark, stutterBenchmark])(
    "synthesizes benchmark: %s",
    (benchmark) => {
      const synth = new TypedEscherSynthesizer({
        maxCost: 11,
        searchSizeFactor: 3,
        maxReboots: 3,
        goalSearchStrategy: "then-first",
      });

      const result = synth.synthesize(
        benchmark.name,
        benchmark.inputTypes,
        benchmark.inputNames,
        benchmark.returnType,
        benchmark.env,
        benchmark.examples,
        benchmark.oracle,
      );

      expect(result).not.toBeNull();

      const impl = recursiveImpl(result!.program.signature, benchmark.env, anyArgSmaller, result!.program.body);
      const probe = benchmark.name === "reverse"
        ? valueList([valueInt(1), valueInt(2), valueInt(3), valueInt(4)])
        : valueList([valueInt(9), valueInt(8)]);
      expect(impl.executeEfficient([probe])).toEqual(benchmark.oracle([probe]));
    },
  );

  it(
    "synthesized programs match oracle on benchmark probes",
    () => {
      for (const benchmark of pureExamplesBenchmarks) {
        const synth = new TypedEscherSynthesizer({
          maxCost: 13,
          searchSizeFactor: 3,
          maxReboots: 3,
          goalSearchStrategy: "then-first",
          deleteAllErr: true,
          timeoutMs: 10000,
        });

        const result = synth.synthesize(
          benchmark.name,
          benchmark.inputTypes,
          benchmark.inputNames,
          benchmark.returnType,
          benchmark.env,
          benchmark.examples,
          benchmark.oracle,
        );

        expect(result, `failed to synthesize ${benchmark.name}`).not.toBeNull();

        const impl = recursiveImpl(result!.program.signature, benchmark.env, anyArgSmaller, result!.program.body);
        const probes = probesByBenchmark.get(benchmark.name) ?? [];
        expect(probes.length, `missing probes for ${benchmark.name}`).toBeGreaterThan(0);

        for (const args of probes) {
          expect(impl.executeEfficient(args), `${benchmark.name} probe mismatch`).toEqual(benchmark.oracle(args));
        }
      }
    },
    120000,
  );
});
