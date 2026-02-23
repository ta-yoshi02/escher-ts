import { type ArgList, type ComponentSignature } from "../../components/component.js";
import { type Term } from "../../types/term.js";
import { type TermValue } from "../../types/value.js";
import { type SynthesisState } from "./state.js";
import { RebootStrategies, type RebootStrategy } from "./reboot-strategies.js";
import {
  defaultBaseSynthesisConfig,
  type BaseSynthesisConfig,
} from "../common/config.js";

export interface TypedEscherConfig extends BaseSynthesisConfig {
  maxReboots: number | null;
  rebootStrategy: RebootStrategy;
}

export interface SynthesisData {
  oracleBuffer: readonly (readonly [ArgList, TermValue])[];
  reboots: number;
}

export interface SynthesizedProgram {
  signature: ComponentSignature;
  body: Term;
  cost: number;
  depth: number;
}

export interface SynthesisResult {
  program: SynthesizedProgram;
  state: SynthesisState;
  data: SynthesisData;
}

export const defaultTypedEscherConfig: TypedEscherConfig = {
  ...defaultBaseSynthesisConfig,
  maxReboots: 10,
  rebootStrategy: RebootStrategies.addSimplestFailedExample,
};
