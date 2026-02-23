import { type TermValue } from "../../types/value.js";
import { exampleLt, type SynthesisArgList } from "../common/core.js";

export type Example = readonly [readonly TermValue[], TermValue];

export const compareExamples = (a: Example, b: Example): number => {
  if (exampleLt(a as [SynthesisArgList, TermValue], b as [SynthesisArgList, TermValue])) {
    return -1;
  }
  if (exampleLt(b as [SynthesisArgList, TermValue], a as [SynthesisArgList, TermValue])) {
    return 1;
  }
  return 0;
};

export const sortExamples = (examples: readonly Example[]): Example[] => [...examples].sort(compareExamples);
