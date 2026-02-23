import { componentTerm, ifTerm, varTerm, type Term } from "../types/term.js";
import {
  type Type,
  typeFixedVar,
  typeVar,
  tyBool,
  tyInt,
  tyList,
  tyMap,
  tyPair,
  tyTree,
} from "../types/type.js";
import { type TermValue, valueBool, valueInt, valueList, valuePair } from "../types/value.js";

export const v = (name: string): Term => varTerm(name);
export const c = (name: string, ...args: readonly Term[]): Term => componentTerm(name, args);
export const if_ = (condition: Term, thenBranch: Term, elseBranch: Term): Term => ifTerm(condition, thenBranch, elseBranch);

export const tyVar = (id: number): Type => typeVar(id);
export const tyFixVar = (id: number): Type => typeFixedVar(id);

export { tyInt, tyBool, tyList, tyMap, tyTree, tyPair };

export const intValue = (value: number): TermValue => valueInt(value);
export const boolValue = (value: boolean): TermValue => valueBool(value);
export const listValue = (...elems: readonly TermValue[]): TermValue => valueList(elems);
export const pairValue = (left: TermValue, right: TermValue): TermValue => valuePair(left, right);

export const argList = (...values: readonly TermValue[]): readonly TermValue[] => values;
