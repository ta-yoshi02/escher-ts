import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { paperExamplesBenchmarks } from "../src/benchmarks/typed-escher-benchmarks.js";
import { showType } from "../src/types/type.js";
import { type BinaryTree, type TermValue } from "../src/types/value.js";

type UserJsonLiteral =
  | number
  | boolean
  | readonly UserJsonLiteral[]
  | { readonly pair: readonly [UserJsonLiteral, UserJsonLiteral] }
  | { readonly tree: "leaf" | { readonly value: UserJsonLiteral; readonly left: UserJsonLiteral; readonly right: UserJsonLiteral } }
  | { readonly error: true };

const toUserLiteral = (value: TermValue): UserJsonLiteral => {
  const treeToLiteral = (
    tree: BinaryTree<TermValue>,
  ): { readonly tree: "leaf" | { readonly value: UserJsonLiteral; readonly left: UserJsonLiteral; readonly right: UserJsonLiteral } } =>
    tree.kind === "leaf"
      ? { tree: "leaf" }
      : {
          tree: {
            value: toUserLiteral(tree.tag),
            left: treeToLiteral(tree.left),
            right: treeToLiteral(tree.right),
          },
        };

  switch (value.tag) {
    case "error":
      return { error: true };
    case "bool":
      return value.value;
    case "int":
      return value.value;
    case "list":
      return value.elems.map(toUserLiteral);
    case "pair":
      return { pair: [toUserLiteral(value.left), toUserLiteral(value.right)] };
    case "tree":
      return treeToLiteral(value.value);
  }
};

const outDir = join(process.cwd(), "examples", "benchmarks");
mkdirSync(outDir, { recursive: true });

for (const benchmark of paperExamplesBenchmarks) {
  const json = {
    name: benchmark.name,
    componentsPreset: benchmark.name,
    signature: {
      inputNames: benchmark.inputNames,
      inputTypes: benchmark.inputTypes.map((type) => showType(type)),
      returnType: showType(benchmark.returnType),
    },
    oracle: {
      kind: "componentRef",
      name: benchmark.name,
    },
    components: [],
    examples: benchmark.examples.map(([args, out]) => [args.map(toUserLiteral), toUserLiteral(out)]),
  };

  const path = join(outDir, `${benchmark.name}.json`);
  writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`, "utf8");
}

console.log(`Generated ${paperExamplesBenchmarks.length} benchmark specs in ${outDir}`);
