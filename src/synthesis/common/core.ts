import { type Term } from "../../types/term.js";
import {
  alphaNormalForm,
  canAppearIn,
  instanceOfType,
  nextFreeId,
  shiftId,
  type Type,
  type TypeSubst,
  TypeSubst as TypeSubstClass,
  tyBool,
  unify,
} from "../../types/type.js";
import {
  type ExtendedValue,
  equalTermValue,
  greaterThan,
  showValue,
  type TermValue,
  valueBool,
  valueError,
} from "../../types/value.js";

export type ValueVector = readonly TermValue[];
export type SynthesisArgList = readonly TermValue[];
export type IndexValueMap = ReadonlyMap<number, TermValue>;
export type ValueTermMap = Map<string, Term>;
export type ExtendedValueVec = readonly ExtendedValue[];

export const allErr = (valueVector: ExtendedValueVec): boolean => valueVector.every((value) => value.tag === "error");
export const notAllErr = (valueVector: ExtendedValueVec): boolean => valueVector.some((value) => value.tag !== "error");

export const showValueVector = (valueVector: ValueVector): string => `<${valueVector.map((v) => showValue(v)).join(", ")}>`;

export const valueVectorEquals = (a: ValueVector, b: ValueVector): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (!equalTermValue(a[i]!, b[i]!)) {
      return false;
    }
  }
  return true;
};

export const matchVector = (valueMap: IndexValueMap, valueVector: ValueVector): boolean => {
  for (const [index, value] of valueMap.entries()) {
    const current = valueVector[index];
    if (current === undefined || !equalTermValue(current, value)) {
      return false;
    }
  }
  return true;
};

export const splitValueMap = (
  valueMap: IndexValueMap,
  valueVector: ValueVector,
): readonly [IndexValueMap, IndexValueMap, IndexValueMap] | null => {
  const condMap = new Map<number, TermValue>();
  const thenMap = new Map<number, TermValue>();
  const elseMap = new Map<number, TermValue>();

  for (const [index, value] of valueMap.entries()) {
    const current = valueVector[index];
    const matched = current !== undefined && equalTermValue(current, value);
    condMap.set(index, valueBool(matched));

    if (matched) {
      thenMap.set(index, value);
    } else {
      elseMap.set(index, value);
    }
  }

  if (thenMap.size > 0 && elseMap.size > 0) {
    return [condMap, thenMap, elseMap];
  }
  return null;
};

export const showIndexValueMap = (valueMap: IndexValueMap, exampleCount: number): string => {
  const elems: string[] = [];
  for (let i = 0; i < exampleCount; i += 1) {
    const value = valueMap.get(i);
    if (value === undefined) {
      elems.push("?");
    } else {
      elems.push(showValue(value));
    }
  }
  return `<${elems.join(", ")}>`;
};

export const toValueVector = (extendedValueVec: ExtendedValueVec): ValueVector | null => {
  const out: TermValue[] = [];
  for (const value of extendedValueVec) {
    if (value.tag === "unknown") {
      return null;
    }
    out.push(value);
  }
  return out;
};

export type MatchResult =
  | { readonly kind: "notMatch" }
  | { readonly kind: "exactMatch" }
  | { readonly kind: "possibleMatch"; readonly leftToCheck: IndexValueMap };

export const matchWithIndexValueMap = (extendedValueVec: ExtendedValueVec, indexValueMap: IndexValueMap): MatchResult => {
  const leftToCheck = new Map<number, TermValue>();

  for (const [index, value] of indexValueMap.entries()) {
    const current = extendedValueVec[index];
    if (current === undefined) {
      return { kind: "notMatch" };
    }

    if (current.tag === "unknown") {
      leftToCheck.set(index, value);
      continue;
    }

    if (!equalTermValue(current, value)) {
      return { kind: "notMatch" };
    }
  }

  if (leftToCheck.size === 0) {
    return { kind: "exactMatch" };
  }

  return { kind: "possibleMatch", leftToCheck };
};

export const showExamples = (examples: readonly (readonly [SynthesisArgList, TermValue])[]): string =>
  examples.map(([args, out]) => `(${args.map((a) => showValue(a)).join(", ")}) -> ${showValue(out)}`).join("; ");

export const divideNumberAsSum = (number: number, pieces: number, minNumber: number): readonly number[][] => {
  if (number < minNumber) {
    return [];
  }
  if (pieces === 1) {
    return [[number]];
  }

  const out: number[][] = [];
  for (let n = minNumber; n <= number; n += 1) {
    const rest = divideNumberAsSum(number - n, pieces - 1, minNumber);
    for (const tail of rest) {
      out.push([n, ...tail]);
    }
  }
  return out;
};

export const cartesianProduct = <A>(listOfSets: readonly (readonly A[])[]): readonly A[][] => {
  if (listOfSets.length === 0) {
    return [[]];
  }

  const [head, ...tail] = listOfSets;
  if (head === undefined) {
    return [[]];
  }
  const tailProduct = cartesianProduct(tail);
  const out: A[][] = [];
  for (const value of head) {
    for (const partial of tailProduct) {
      out.push([value, ...partial]);
    }
  }
  return out;
};

export const forEachCartesianProduct = <T>(
  sets: readonly (readonly T[])[],
  visit: (product: readonly T[]) => boolean,
): boolean => {
  if (sets.length === 0) {
    return visit([]);
  }
  const work: T[] = new Array(sets.length);
  const dfs = (depth: number): boolean => {
    if (depth === sets.length) {
      return visit(work);
    }
    const set = sets[depth];
    if (set === undefined) {
      return true;
    }
    for (const item of set) {
      work[depth] = item;
      if (!dfs(depth + 1)) {
        return false;
      }
    }
    return true;
  };
  return dfs(0);
};

export const isInterestingSignature =
  (goalReturnType: Type, inputTypes: readonly Type[]) =>
  (argTypes: readonly Type[], returnType: Type): boolean => {
    const goodTypes = [tyBool, goalReturnType, ...inputTypes];

    const isInterestingType = (ty: Type): boolean => {
      for (const gt of goodTypes) {
        if (canAppearIn(ty, gt)) {
          return true;
        }
      }
      return false;
    };

    return isInterestingType(returnType) || argTypes.every((ty) => isInterestingType(ty));
  };

export const isGoalOrBoolType = (goalReturnType: Type, resolvedReturnType: Type): boolean =>
  instanceOfType(goalReturnType, resolvedReturnType) || instanceOfType(tyBool, resolvedReturnType);

export interface SignatureBuckets {
  readonly related: readonly (readonly [readonly Type[], Type])[];
  readonly unrelated: readonly (readonly [readonly Type[], Type])[];
}

export const bucketSignaturesByGoalOrBool = (
  goalReturnType: Type,
  resolvedSignatures: readonly (readonly [readonly Type[], Type])[],
): SignatureBuckets => {
  const related: Array<readonly [readonly Type[], Type]> = [];
  const unrelated: Array<readonly [readonly Type[], Type]> = [];
  for (const sig of resolvedSignatures) {
    if (isGoalOrBoolType(goalReturnType, sig[1])) {
      related.push(sig);
    } else {
      unrelated.push(sig);
    }
  }
  return { related, unrelated };
};

export const typesForCosts = (
  typesOfCost: (cost: number) => readonly Type[],
  costs: readonly number[],
  inputTypes: readonly Type[],
  returnType: Type,
): readonly (readonly [readonly Type[], Type])[] => {
  const signatureNextFreeId = Math.max(nextFreeId(returnType), ...inputTypes.map((t) => nextFreeId(t)));

  const aux = (argId: number, freeId: number, subst: TypeSubst): readonly (readonly [readonly Type[], Type])[] => {
    if (argId === costs.length) {
      return [[[], alphaNormalForm(subst.apply(returnType))]];
    }

    const needType = subst.apply(inputTypes[argId]!);
    const currentCost = costs[argId]!;
    const out: [Type[], Type][] = [];

    for (const t of typesOfCost(currentCost)) {
      const candidateType = shiftId(t, freeId);
      const unifier = unify(needType, candidateType);
      if (unifier === null) {
        continue;
      }

      const nextId = freeId + nextFreeId(t);
      const tail = aux(argId + 1, nextId, subst.compose(unifier));
      for (const [argTypes, retType] of tail) {
        out.push([[t, ...argTypes], retType]);
      }
    }

    return out;
  };

  return aux(0, signatureNextFreeId, TypeSubstClass.empty);
};

export const splitGoal = (
  boolVector: ValueVector,
  goal: IndexValueMap,
): readonly [IndexValueMap, IndexValueMap] | null => {
  const thenGoal = new Map<number, TermValue>();
  const elseGoal = new Map<number, TermValue>();

  for (const [index, termValue] of goal.entries()) {
    const bv = boolVector[index];
    if (bv === undefined || bv.tag === "error") {
      return null;
    }
    if (bv.tag !== "bool") {
      return null;
    }
    if (bv.value) {
      thenGoal.set(index, termValue);
    } else {
      elseGoal.set(index, termValue);
    }
  }

  if (thenGoal.size > 0 && elseGoal.size > 0) {
    return [thenGoal, elseGoal];
  }
  return null;
};

export const exampleLt = (
  ex1: readonly [SynthesisArgList, TermValue],
  ex2: readonly [SynthesisArgList, TermValue],
): boolean => {
  const [args1] = ex1;
  const [args2] = ex2;
  if (args1.length !== args2.length) {
    return args1.length < args2.length;
  }

  for (let i = 0; i < args1.length; i += 1) {
    const a = args1[i]!;
    const b = args2[i]!;
    if (greaterThan(a, b)) {
      return false;
    }
    if (greaterThan(b, a)) {
      return true;
    }
  }

  return false;
};

export const splitGoalByErr = (
  boolVector: ValueVector,
  goal: IndexValueMap,
): readonly [IndexValueMap, IndexValueMap] | null => {
  if (boolVector.some((v) => v === valueError)) {
    return null;
  }
  return splitGoal(boolVector, goal);
};
