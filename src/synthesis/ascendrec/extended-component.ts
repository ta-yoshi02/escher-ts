import { type ArgList } from "../../components/component.js";
import { type Term } from "../../types/term.js";
import { type Type } from "../../types/type.js";
import {
  type ExtendedValue,
  type TermValue,
  valueError,
  valueUnknown,
} from "../../types/value.js";

export type ExtendedValueVec = readonly ExtendedValue[];

export interface ExtendedComponent {
  readonly name: string;
  readonly inputTypes: readonly Type[];
  readonly returnType: Type;
  readonly isReducible: ((args: readonly Term[]) => boolean) | null;
  execute(args: ExtendedValueVec): ExtendedValue;
}

const toKnownArgs = (args: ExtendedValueVec): ArgList | null => {
  const known: TermValue[] = [];
  for (const arg of args) {
    if (arg.tag === "unknown") {
      return null;
    }
    known.push(arg);
  }
  return known;
};

export const fromImplOnTermValue = (
  name: string,
  inputTypes: readonly Type[],
  returnType: Type,
  impl: (args: ArgList) => ExtendedValue,
  isReducible: ((args: readonly Term[]) => boolean) | null = null,
): ExtendedComponent => ({
  name,
  inputTypes,
  returnType,
  isReducible,
  execute(args: ExtendedValueVec): ExtendedValue {
    const knownArgs = toKnownArgs(args);
    if (knownArgs === null) {
      return args.some((a) => a.tag === "error") ? valueError : valueUnknown;
    }
    return impl(knownArgs);
  },
});
