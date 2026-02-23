import { type ComponentSignature } from "../../components/component.js";
import { type Term } from "../../types/term.js";
import { type Type } from "../../types/type.js";
import { type TermValue } from "../../types/value.js";
import { type AscendRecState } from "./state.js";
import {
  defaultBaseSynthesisConfig,
  type BaseSynthesisConfig,
} from "../common/config.js";

export interface AscendRecConfig extends BaseSynthesisConfig {
  useReductionRules: boolean;
  onlyForwardSearch: boolean;
  onDiagnostics?: ((diagnostics: AscendRecDiagnostics) => void) | null;
}

export interface AscendRecPhaseStats {
  implVisited: number;
  resolvedSignatures: number;
  productsEvaluated: number;
  registeredNonRec: number;
  registeredRec: number;
  prunedAllErr: number;
}

export interface AscendRecLevelDiagnostics {
  level: number;
  related: AscendRecPhaseStats;
  unrelated: AscendRecPhaseStats;
  returnTermsCount: number;
  boolTermsCount: number;
  recReturnTermsCount: number;
  returnTermSamples: readonly string[];
  boolTermSamples: readonly string[];
  recReturnTermSamples: readonly string[];
}

export interface AscendRecGoalSearchDiagnostics {
  searchCalls: number;
  knownHits: number;
  recExactHits: number;
  recPossibleChecks: number;
  recPossibleHits: number;
  splitAttempts: number;
  splitSuccesses: number;
  thenRecCandidatesChecked: number;
  thenRecCandidatesAccepted: number;
}

export interface AscendRecDiagnostics {
  status: "success" | "timeout" | "exhausted";
  levels: readonly AscendRecLevelDiagnostics[];
  goalSearch: AscendRecGoalSearchDiagnostics;
}

export interface AscendRecSynthesizedProgram {
  signature: ComponentSignature;
  body: Term;
  cost: number;
  depth: number;
}

export interface AscendRecSynthesisResult {
  program: AscendRecSynthesizedProgram;
  state: AscendRecState;
  diagnostics: AscendRecDiagnostics;
}

export type AscendRecExample = readonly [readonly TermValue[], TermValue];
export interface AscendRecSynthesisTask {
  name: string;
  inputTypes: readonly Type[];
  inputNames: readonly string[];
  returnType: Type;
  examples: readonly AscendRecExample[];
}

export const defaultAscendRecConfig: AscendRecConfig = {
  ...defaultBaseSynthesisConfig,
  useReductionRules: true,
  onlyForwardSearch: false,
  onDiagnostics: null,
};
