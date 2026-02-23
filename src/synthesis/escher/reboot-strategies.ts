import { type ArgList } from "../../components/component.js";
import { type TermValue } from "../../types/value.js";
import { compareExamples } from "./example-order.js";

export interface RebootStrategy {
  newExamplesAndOracleBuffer(
    examples: readonly (readonly [ArgList, TermValue])[],
    failed: readonly (readonly [ArgList, TermValue])[],
    passed: readonly (readonly [ArgList, TermValue])[],
  ): readonly [readonly (readonly [ArgList, TermValue])[], readonly (readonly [ArgList, TermValue])[]];
}

export const RebootStrategies = {
  addSimplestFailedExample: {
    newExamplesAndOracleBuffer(
      examples: readonly (readonly [ArgList, TermValue])[],
      failed: readonly (readonly [ArgList, TermValue])[],
      passed: readonly (readonly [ArgList, TermValue])[],
    ) {
      const failSorted = [...failed].sort(compareExamples);
      return [[...examples, failSorted[0]!], [...failSorted.slice(1), ...passed]] as const;
    },
  } satisfies RebootStrategy,
  addMostComplicatedFailedExample: {
    newExamplesAndOracleBuffer(
      examples: readonly (readonly [ArgList, TermValue])[],
      failed: readonly (readonly [ArgList, TermValue])[],
      passed: readonly (readonly [ArgList, TermValue])[],
    ) {
      const failSorted = [...failed].sort(compareExamples);
      const last = failSorted[failSorted.length - 1];
      if (last === undefined) {
        return [examples, passed] as const;
      }
      return [[...examples, last], [...passed, ...failSorted.slice(0, failSorted.length - 1)]] as const;
    },
  } satisfies RebootStrategy,
};
