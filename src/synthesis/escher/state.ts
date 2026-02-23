import { type Term } from "../../types/term.js";
import { alphaNormalForm, type Type, showType, tyBool, instanceOfType } from "../../types/type.js";
import { showValue, type TermValue } from "../../types/value.js";
import { type IndexValueMap, valueVectorEquals } from "../common/core.js";
import { ValueVectorTree } from "../common/value-vector-tree.js";

export type ValueVector = readonly TermValue[];

export interface TermEntry {
  readonly type: Type;
  readonly term: Term;
  readonly valueVector: ValueVector;
  readonly cost: number;
}

const typeKey = (type: Type): string => showType(alphaNormalForm(type));
const valueVectorKey = (valueVector: ValueVector): string => valueVector.map((v) => showValue(v)).join("|");

export class SynthesisState {
  private readonly totalByTypeAndVector = new Map<string, TermEntry>();
  private readonly levelEntries = new Map<number, TermEntry[]>();
  private readonly levelEntriesByType = new Map<number, Map<string, TermEntry[]>>();
  private readonly returnTypeTrees = new Map<number, ValueVectorTree<TermEntry>>();
  private readonly boolTrees = new Map<number, ValueVectorTree<TermEntry>>();

  constructor(readonly exampleCount: number, readonly goalReturnType: Type) {}

  registerTerm(cost: number, type: Type, term: Term, valueVector: ValueVector): boolean {
    const normalizedType = alphaNormalForm(type);
    const key = `${typeKey(normalizedType)}#${valueVectorKey(valueVector)}`;

    if (this.totalByTypeAndVector.has(key)) {
      return false;
    }

    const entry: TermEntry = {
      type: normalizedType,
      term,
      valueVector,
      cost,
    };

    this.totalByTypeAndVector.set(key, entry);
    const current = this.levelEntries.get(cost) ?? [];
    current.push(entry);
    this.levelEntries.set(cost, current);

    const byType = this.levelEntriesByType.get(cost) ?? new Map<string, TermEntry[]>();
    const typeEntries = byType.get(typeKey(normalizedType)) ?? [];
    typeEntries.push(entry);
    byType.set(typeKey(normalizedType), typeEntries);
    this.levelEntriesByType.set(cost, byType);

    if (instanceOfType(this.goalReturnType, normalizedType)) {
      this.returnTypeTrees.get(cost)?.addTerm(entry, valueVector);
    }
    if (instanceOfType(tyBool, normalizedType)) {
      this.boolTrees.get(cost)?.addTerm(entry, valueVector);
    }

    return true;
  }

  openNextLevel(cost: number): void {
    if (!this.levelEntries.has(cost)) {
      this.levelEntries.set(cost, []);
    }
    if (!this.levelEntriesByType.has(cost)) {
      this.levelEntriesByType.set(cost, new Map<string, TermEntry[]>());
    }
    if (!this.returnTypeTrees.has(cost)) {
      this.returnTypeTrees.set(cost, new ValueVectorTree<TermEntry>(this.exampleCount));
    }
    if (!this.boolTrees.has(cost)) {
      this.boolTrees.set(cost, new ValueVectorTree<TermEntry>(this.exampleCount));
    }
  }

  typesOfCost(cost: number): readonly Type[] {
    const byType = this.levelEntriesByType.get(cost);
    if (byType === undefined) {
      return [];
    }
    const out: Type[] = [];
    for (const entries of byType.values()) {
      if (entries.length > 0) {
        out.push(entries[0]!.type);
      }
    }
    return out;
  }

  entriesOfCost(cost: number): readonly TermEntry[] {
    return this.levelEntries.get(cost) ?? [];
  }

  entriesOfCostAndType(cost: number, type: Type): readonly TermEntry[] {
    const byType = this.levelEntriesByType.get(cost);
    if (byType === undefined) {
      return [];
    }
    return byType.get(typeKey(alphaNormalForm(type))) ?? [];
  }

  returnTypeEntriesOfCost(cost: number): readonly TermEntry[] {
    const tree = this.returnTypeTrees.get(cost);
    if (tree === undefined) {
      return [];
    }
    return tree.elements().map(([, entry]) => entry);
  }

  boolEntriesOfCost(cost: number): readonly TermEntry[] {
    const tree = this.boolTrees.get(cost);
    if (tree === undefined) {
      return [];
    }
    return tree.elements().map(([, entry]) => entry);
  }

  returnTypeTermOfCost(cost: number, vm: IndexValueMap): Term | null {
    const tree = this.returnTypeTrees.get(cost);
    if (tree === undefined) {
      return null;
    }
    return tree.searchATerm(vm)?.term ?? null;
  }

  boolTermOfVM(vm: IndexValueMap, maxCost: number): readonly [number, Term] | null {
    for (let cost = 1; cost <= maxCost; cost += 1) {
      const tree = this.boolTrees.get(cost);
      if (tree === undefined) {
        continue;
      }
      const entry = tree.searchATerm(vm);
      if (entry !== null) {
        return [cost, entry.term];
      }
    }
    return null;
  }

  returnTypeTermsAsVectors(cost: number): readonly (readonly [ValueVector, Term])[] {
    const tree = this.returnTypeTrees.get(cost);
    if (tree === undefined) {
      return [];
    }
    return tree.elements().map(([vector, entry]) => [vector, entry.term] as const);
  }

  boolTermsAsVectors(cost: number): readonly (readonly [ValueVector, Term])[] {
    const tree = this.boolTrees.get(cost);
    if (tree === undefined) {
      return [];
    }
    return tree.elements().map(([vector, entry]) => [vector, entry.term] as const);
  }

  findGoalHit(target: ValueVector, maxCost: number): TermEntry | null {
    for (let cost = 1; cost <= maxCost; cost += 1) {
      const tree = this.returnTypeTrees.get(cost);
      const hit = tree?.get(target) ?? null;
      if (hit !== null && valueVectorEquals(hit.valueVector, target)) {
        return hit;
      }
    }
    return null;
  }

  levelStats(cost: number): { entries: number; types: number } {
    return {
      entries: this.entriesOfCost(cost).length,
      types: this.typesOfCost(cost).length,
    };
  }
}
