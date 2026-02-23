import { type ArgList } from "../../components/component.js";
import { type Type } from "../../types/type.js";
import { type TermValue, valueUnknown } from "../../types/value.js";
import { fromImplOnTermValue, type ExtendedComponent } from "./extended-component.js";

const argListKey = (args: readonly TermValue[]): string => args.map((value) => JSON.stringify(value)).join("|");

export const createKnownMapRecursiveComponent = (
  name: string,
  inputTypes: readonly Type[],
  returnType: Type,
  examples: readonly (readonly [ArgList, TermValue])[],
): ExtendedComponent => {
  const knownMap = new Map<string, TermValue>();
  for (const [args, out] of examples) {
    knownMap.set(argListKey(args), out);
  }
  return fromImplOnTermValue(
    name,
    inputTypes,
    returnType,
    (args) => knownMap.get(argListKey(args)) ?? valueUnknown,
    null,
  );
};
