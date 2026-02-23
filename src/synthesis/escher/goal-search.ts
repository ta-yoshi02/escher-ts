import { ifTerm, type Term } from "../../types/term.js";
import { type TermValue, valueBool } from "../../types/value.js";
import {
  type IndexValueMap,
  type ValueVector,
  matchVector,
  splitValueMap,
} from "../common/core.js";

export type GoalSearchResult =
  | { readonly kind: "found"; readonly cost: number; readonly term: Term }
  | { readonly kind: "notFoundUnderCost"; readonly cost: number };

export const found = (cost: number, term: Term): GoalSearchResult => ({ kind: "found", cost, term });
export const notFoundUnderCost = (cost: number): GoalSearchResult => ({
  kind: "notFoundUnderCost",
  cost,
});

export const emptyGoalBuffer = (): Map<string, GoalSearchResult> => new Map<string, GoalSearchResult>();

const indexValueMapKey = (vm: IndexValueMap): string => {
  const parts = [...vm.entries()]
    .sort(([a], [b]) => a - b)
    .map(([k, v]) => `${k}:${JSON.stringify(v)}`);
  return parts.join("|");
};

export const maxSatConditions = (
  vm: IndexValueMap,
  boolOfVM: (vm: IndexValueMap) => readonly [number, Term] | null,
): readonly [readonly [number, Term], readonly number[]] | null => {
  let keyList = [...vm.entries()]
    .filter(([, value]) => value.tag === "bool" && value.value)
    .map(([index]) => index)
    .sort((a, b) => b - a);

  const vm1 = new Map(vm);
  while (keyList.length > 0) {
    const hit = boolOfVM(vm1);
    if (hit !== null) {
      return [hit, keyList];
    }

    const head = keyList[0]!;
    vm1.set(head, valueBool(false));
    keyList = keyList.slice(1);
  }

  return null;
};

export class BatchGoalSearch {
  private readonly buffer = emptyGoalBuffer();

  constructor(
    private readonly maxCompCost: number,
    private readonly termOfCostAndVM: (cost: number, vm: IndexValueMap) => Term | null,
    private readonly termsOfCost: (cost: number) => readonly (readonly [ValueVector, Term])[],
    private readonly boolTermsOfCost: (cost: number) => readonly (readonly [ValueVector, Term])[],
    private readonly boolOfVM: (vm: IndexValueMap) => readonly [number, Term] | null,
  ) {}

  searchThenFirst(cost: number, currentGoal: IndexValueMap): readonly [number, Term] | null {
    if (cost <= 0) {
      return null;
    }

    const key = indexValueMapKey(currentGoal);
    const cached = this.buffer.get(key);
    if (cached !== undefined) {
      if (cached.kind === "found" && cached.cost <= cost) {
        return [cached.cost, cached.term];
      }
      if (cached.kind === "notFoundUnderCost" && cached.cost >= cost) {
        return null;
      }
    }

    const buffered = (result: GoalSearchResult): readonly [number, Term] | null => {
      this.buffer.set(key, result);
      return result.kind === "found" ? [result.cost, result.term] : null;
    };

    const maxCost = Math.min(this.maxCompCost, cost);
    for (let c = 1; c <= maxCost; c += 1) {
      const direct = this.termOfCostAndVM(c, currentGoal);
      if (direct !== null) {
        return buffered(found(c, direct));
      }
    }

    const ifCost = 1;
    let minCostCandidate: readonly [number, Term] | null = null;

    for (let cThen = 1; cThen <= maxCost - 1 - ifCost; cThen += 1) {
      for (const [thenVec, thenTerm] of this.termsOfCost(cThen)) {
        const split = splitValueMap(currentGoal, thenVec);
        if (split === null) {
          continue;
        }

        const [vm] = split;
        const sat = maxSatConditions(vm, this.boolOfVM);
        if (sat === null) {
          continue;
        }

        const [[cCond, condTerm], trueKeys] = sat;
        const elseGoal = new Map(currentGoal);
        for (const keyToDrop of trueKeys) {
          elseGoal.delete(keyToDrop);
        }

        const costSoFar = cThen + cCond + ifCost;
        const currentBest = minCostCandidate?.[0] ?? Number.POSITIVE_INFINITY;
        const maxCostForElse = Math.min(cost, currentBest - 1) - costSoFar;
        const elseFound = this.searchThenFirst(maxCostForElse, elseGoal);
        if (elseFound === null) {
          continue;
        }

        const [cElse, elseTerm] = elseFound;
        const totalCost = cElse + costSoFar;
        const candidate = ifTerm(condTerm, thenTerm, elseTerm);
        minCostCandidate = [totalCost, candidate];
      }
    }

    if (minCostCandidate !== null) {
      return buffered(found(minCostCandidate[0], minCostCandidate[1]));
    }

    return buffered(notFoundUnderCost(cost));
  }

  searchCondFirst(cost: number, currentGoal: IndexValueMap): readonly [number, Term] | null {
    if (cost <= 0) {
      return null;
    }

    const key = `${indexValueMapKey(currentGoal)}#cond`;
    const cached = this.buffer.get(key);
    if (cached !== undefined) {
      if (cached.kind === "found" && cached.cost <= cost) {
        return [cached.cost, cached.term];
      }
      if (cached.kind === "notFoundUnderCost" && cached.cost >= cost) {
        return null;
      }
    }

    const buffered = (result: GoalSearchResult): readonly [number, Term] | null => {
      this.buffer.set(key, result);
      return result.kind === "found" ? [result.cost, result.term] : null;
    };

    const maxCost = Math.min(this.maxCompCost, cost);
    for (let c = 1; c <= maxCost; c += 1) {
      const direct = this.termOfCostAndVM(c, currentGoal);
      if (direct !== null) {
        return buffered(found(c, direct));
      }
    }

    const ifCost = 1;
    let minCostCandidate: readonly [number, Term] | null = null;

    for (let cCond = 1; cCond <= Math.min(this.maxCompCost, cost - ifCost - 2); cCond += 1) {
      for (const [condVec, condTerm] of this.boolTermsOfCost(cCond)) {
        const thenGoal = new Map<number, TermValue>();
        const elseGoal = new Map<number, TermValue>();

        let invalid = false;
        for (const [idx, desired] of currentGoal.entries()) {
          const cv = condVec[idx];
          if (cv === undefined || cv.tag === "error" || cv.tag !== "bool") {
            invalid = true;
            break;
          }
          if (cv.value) {
            thenGoal.set(idx, desired);
          } else {
            elseGoal.set(idx, desired);
          }
        }

        if (invalid || thenGoal.size === 0 || elseGoal.size === 0) {
          continue;
        }

        let thenCandidate: readonly [number, Term] | null = null;
        for (let cThen = 1; cThen <= Math.min(this.maxCompCost, cost - ifCost - cCond - 1); cThen += 1) {
          for (const [vv, term] of this.termsOfCost(cThen)) {
            if (matchVector(thenGoal, vv)) {
              thenCandidate = [cThen, term];
              break;
            }
          }
          if (thenCandidate !== null) {
            break;
          }
        }

        if (thenCandidate === null) {
          continue;
        }

        const [cThen, thenTerm] = thenCandidate;
        const costSoFar = cThen + cCond + ifCost;
        const currentBest = minCostCandidate?.[0] ?? Number.POSITIVE_INFINITY;
        const maxCostForElse = Math.min(cost, currentBest - 1) - costSoFar;
        const elseFound = this.searchCondFirst(maxCostForElse, elseGoal);
        if (elseFound === null) {
          continue;
        }

        const [cElse, elseTerm] = elseFound;
        const totalCost = cElse + costSoFar;
        minCostCandidate = [totalCost, ifTerm(condTerm, thenTerm, elseTerm)];
      }
    }

    if (minCostCandidate !== null) {
      return buffered(found(minCostCandidate[0], minCostCandidate[1]));
    }

    return buffered(notFoundUnderCost(cost));
  }
}
