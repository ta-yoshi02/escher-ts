import { termLt, type Term } from "../types/term.js";
import { type TermValue } from "../types/value.js";

export const asList = (value: TermValue): readonly TermValue[] | null => (value.tag === "list" ? value.elems : null);
export const asInt = (value: TermValue): number | null => (value.tag === "int" ? value.value : null);
export const asRef = (value: TermValue): number | null => (value.tag === "ref" ? value.value : null);
export const asBool = (value: TermValue): boolean | null => (value.tag === "bool" ? value.value : null);

export const termEq = (a: Term, b: Term): boolean => JSON.stringify(a) === JSON.stringify(b);

export const reduceIf = (...rules: Array<(args: readonly Term[]) => boolean>) => (args: readonly Term[]): boolean =>
  rules.some((rule) => rule(args));

export const commutative2 = (args: readonly Term[]): boolean => args.length === 2 && termLt(args[1]!, args[0]!);
export const associativeRight = (opName: string) => (args: readonly Term[]): boolean =>
  args.length === 2 && args[1]?.kind === "component" && args[1].name === opName;
export const argsDifferent = (args: readonly Term[]): boolean => args.length === 2 && termEq(args[0]!, args[1]!);
export const noDirectChildren =
  (...childNames: readonly string[]) =>
  (args: readonly Term[]): boolean =>
    args.some((arg) => arg.kind === "component" && childNames.includes(arg.name));
