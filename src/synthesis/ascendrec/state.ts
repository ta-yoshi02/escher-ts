import { type Term } from "../../types/term.js";
import { alphaNormalForm, instanceOfType, showType, tyBool, type Type } from "../../types/type.js";
import { type ExtendedValue, type TermValue } from "../../types/value.js";
import { matchVector } from "../common/core.js";
import { ValueVectorTree } from "../common/value-vector-tree.js";

export type ValueVector = readonly TermValue[];
export type ExtendedValueVec = readonly ExtendedValue[];

export interface NonRecEntry {
  readonly type: Type;
  readonly term: Term;
  readonly valueVector: ValueVector;
}

export interface RecEntry {
  readonly type: Type;
  readonly term: Term;
  readonly valueVector: ExtendedValueVec;
}

const typeKeyCache = new WeakMap<object, string>();
const normalizedTypeKey = (type: Type): string => {
  const asObj = type as unknown as object;
  const cached = typeKeyCache.get(asObj);
  if (cached !== undefined) {
    return cached;
  }
  const key = showType(type);
  typeKeyCache.set(asObj, key);
  return key;
};
const typeKey = (type: Type): string => normalizedTypeKey(alphaNormalForm(type));
const valueKey = (v: TermValue): string => JSON.stringify(v);
const vectorKey = (vv: ValueVector): string => vv.map(valueKey).join("|");
const termKeyCache = new WeakMap<object, string>();
const termKey = (term: Term): string => {
  const asObj = term as unknown as object;
  const cached = termKeyCache.get(asObj);
  if (cached !== undefined) {
    return cached;
  }
  const key = JSON.stringify(term);
  termKeyCache.set(asObj, key);
  return key;
};

const toKnownVector = (vv: ExtendedValueVec): ValueVector | null => {
  const out: TermValue[] = [];
  for (const value of vv) {
    if (value.tag === "unknown") {
      return null;
    }
    out.push(value);
  }
  return out;
};

export class AscendRecState {
  private readonly nonRecByCost = new Map<number, NonRecEntry[]>();
  private readonly nonRecByCostAndType = new Map<number, Map<string, NonRecEntry[]>>();
  private readonly recByCost = new Map<number, Map<string, RecEntry>>();
  private readonly recByCostAndType = new Map<number, Map<string, Map<string, RecEntry>>>();
  private readonly returnTypeTreeByCost = new Map<number, ValueVectorTree<Term>>();
  private readonly boolTreeByCost = new Map<number, ValueVectorTree<Term>>();
  private readonly recReturnTermsByCost = new Map<number, readonly (readonly [Term, ExtendedValueVec])[]>();
  private readonly totalNonRecByType = new Map<string, {
    type: Type;
    vectorsByKey: Map<string, ValueVector>;
  }>();

  constructor(
    readonly exampleCount: number,
    readonly goalReturnType: Type,
    private readonly reductionRulesByName: ReadonlyMap<string, (args: readonly Term[]) => boolean> = new Map(),
  ) {}

  openNextLevel(cost: number): void {
    if (!this.nonRecByCost.has(cost)) this.nonRecByCost.set(cost, []);
    if (!this.nonRecByCostAndType.has(cost)) this.nonRecByCostAndType.set(cost, new Map());
    if (!this.recByCost.has(cost)) this.recByCost.set(cost, new Map());
    if (!this.recByCostAndType.has(cost)) this.recByCostAndType.set(cost, new Map());
  }

  registerNonRecAtLevel(cost: number, type: Type, term: Term, valueVector: ValueVector): boolean {
    const normalizedType = alphaNormalForm(type);
    const normalizedTypeId = normalizedTypeKey(normalizedType);
    const currentVectorKey = vectorKey(valueVector);
    const hasError = valueVector.some((v) => v.tag === "error");
    const partialMap = new Map<number, TermValue>();
    if (hasError) {
      valueVector.forEach((v, idx) => {
        if (v.tag !== "error") {
          partialMap.set(idx, v);
        }
      });
    }

    for (const { type: existingType, vectorsByKey } of this.totalNonRecByType.values()) {
      if (!instanceOfType(normalizedType, existingType)) {
        continue;
      }
      if (vectorsByKey.has(currentVectorKey)) {
        return false;
      }
      for (const vv of vectorsByKey.values()) {
        if (hasError && matchVector(partialMap, vv)) {
          return false;
        }
      }
    }

    const entry: NonRecEntry = { type: normalizedType, term, valueVector };
    this.nonRecByCost.get(cost)?.push(entry);

    const byType = this.nonRecByCostAndType.get(cost) ?? new Map<string, NonRecEntry[]>();
    const entries = byType.get(normalizedTypeId) ?? [];
    entries.push(entry);
    byType.set(normalizedTypeId, entries);
    this.nonRecByCostAndType.set(cost, byType);

    const totalBucket = this.totalNonRecByType.get(normalizedTypeId) ?? {
      type: normalizedType,
      vectorsByKey: new Map<string, ValueVector>(),
    };
    totalBucket.vectorsByKey.set(currentVectorKey, valueVector);
    this.totalNonRecByType.set(normalizedTypeId, totalBucket);
    return true;
  }

  registerRecAtLevel(cost: number, type: Type, term: Term, valueVector: ExtendedValueVec): boolean {
    if (term.kind === "component") {
      const reduceRule = this.reductionRulesByName.get(term.name);
      if (reduceRule !== undefined && reduceRule(term.args)) {
        return false;
      }
    }
    const normalizedType = alphaNormalForm(type);
    const normalizedTypeId = normalizedTypeKey(normalizedType);
    const termK = termKey(term);
    const recKey = `${normalizedTypeId}|${termK}`;
    const entry: RecEntry = { type: normalizedType, term, valueVector };
    const recEntries = this.recByCost.get(cost) ?? new Map<string, RecEntry>();
    recEntries.set(recKey, entry);
    this.recByCost.set(cost, recEntries);

    const byType = this.recByCostAndType.get(cost) ?? new Map<string, Map<string, RecEntry>>();
    const entries = byType.get(normalizedTypeId) ?? new Map<string, RecEntry>();
    entries.set(termK, entry);
    byType.set(normalizedTypeId, entries);
    this.recByCostAndType.set(cost, byType);
    return true;
  }

  registerTermAtLevel(cost: number, type: Type, term: Term, valueVector: ExtendedValueVec): boolean {
    const known = toKnownVector(valueVector);
    if (known !== null) {
      return this.registerNonRecAtLevel(cost, type, term, known);
    }
    return this.registerRecAtLevel(cost, type, term, valueVector);
  }

  createLibrariesForThisLevel(cost: number): void {
    const returnTree = new ValueVectorTree<Term>(this.exampleCount);
    const boolTree = new ValueVectorTree<Term>(this.exampleCount);

    for (const entry of this.nonRecByCost.get(cost) ?? []) {
      if (instanceOfType(this.goalReturnType, entry.type)) {
        returnTree.addTerm(entry.term, entry.valueVector);
      }
      if (instanceOfType(tyBool, entry.type)) {
        boolTree.addTerm(entry.term, entry.valueVector);
      }
    }

    this.returnTypeTreeByCost.set(cost, returnTree);
    this.boolTreeByCost.set(cost, boolTree);

    const recReturnTerms: Array<readonly [Term, ExtendedValueVec]> = [];
    for (const entry of this.recByCost.get(cost)?.values() ?? []) {
      if (instanceOfType(this.goalReturnType, entry.type)) {
        recReturnTerms.push([entry.term, entry.valueVector] as const);
      }
    }
    this.recReturnTermsByCost.set(cost, recReturnTerms);
  }

  nonRecTypeSetOfCost(cost: number): readonly Type[] {
    const byType = this.nonRecByCostAndType.get(cost);
    if (byType === undefined) return [];
    return [...byType.values()].map((entries) => entries[0]!.type);
  }

  recTypeSetOfCost(cost: number): readonly Type[] {
    const byType = this.recByCostAndType.get(cost);
    if (byType === undefined) return [];
    return [...byType.values()].map((entries) => entries.values().next().value!.type);
  }

  nonRecEntriesOfCostAndType(cost: number, type: Type): readonly NonRecEntry[] {
    return this.nonRecByCostAndType.get(cost)?.get(typeKey(type)) ?? [];
  }

  recEntriesOfCostAndType(cost: number, type: Type): readonly RecEntry[] {
    const entries = this.recByCostAndType.get(cost)?.get(typeKey(type));
    return entries === undefined ? [] : [...entries.values()];
  }

  termsOfCost(cost: number): readonly (readonly [ValueVector, Term])[] {
    const tree = this.returnTypeTreeByCost.get(cost);
    if (tree === undefined) return [];
    return tree.elements().map(([vector, term]) => [vector, term] as const);
  }

  nonRecBoolTerms(cost: number): readonly (readonly [ValueVector, Term])[] {
    const tree = this.boolTreeByCost.get(cost);
    if (tree === undefined) return [];
    return tree.elements().map(([vector, term]) => [vector, term] as const);
  }

  recTermsOfReturnType(cost: number): readonly (readonly [Term, ExtendedValueVec])[] {
    return this.recReturnTermsByCost.get(cost) ?? [];
  }

  exactKnownGoalHit(cost: number, goalVector: ValueVector): Term | null {
    const tree = this.returnTypeTreeByCost.get(cost);
    if (tree === undefined) {
      return null;
    }
    return tree.get(goalVector);
  }
}
