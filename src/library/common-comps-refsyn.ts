import { ComponentImpl } from "../components/component.js";
import { tyInt, tyList, tyRef, typeVar } from "../types/type.js";
import { type TermValue, valueError, valueRef } from "../types/value.js";
import { asInt, asList, asRef } from "./common-comps-helpers.js";

const isValidIndex = (index: number, size: number): boolean => index >= 0 && index < size;

const readRefEntry = (heap: readonly TermValue[], index: number): number | null => {
  const entry = heap[index];
  return entry !== undefined && entry.tag === "ref" ? entry.value : null;
};

const readIntEntry = (heap: readonly TermValue[], index: number): number | null => {
  const entry = heap[index];
  return entry !== undefined && entry.tag === "int" ? entry.value : null;
};

export const nthNextRef = new ComponentImpl(
  "nthNextRef",
  [tyRef(typeVar(0)), tyList(typeVar(0)), tyList(tyRef(typeVar(0))), tyInt],
  tyRef(typeVar(0)),
  (args) => {
    const start = asRef(args[0]!);
    const nodeHeap = asList(args[1]!);
    const nextHeap = asList(args[2]!);
    const steps = asInt(args[3]!);
    if (start === null || nodeHeap === null || nextHeap === null || steps === null || steps < 0) {
      return valueError;
    }
    if (start === -1) {
      return valueRef(-1);
    }
    if (!isValidIndex(start, nodeHeap.length)) {
      return valueError;
    }

    let current = start;
    let remaining = steps;
    while (remaining > 0) {
      if (current === -1) {
        return valueRef(-1);
      }
      if (!isValidIndex(current, nextHeap.length)) {
        return valueError;
      }
      const next = readRefEntry(nextHeap, current);
      if (next === null) {
        return valueError;
      }
      current = next;
      remaining -= 1;
    }
    return valueRef(current);
  },
);

export const findByValueRef = new ComponentImpl(
  "findByValueRef",
  [tyRef(typeVar(0)), tyList(typeVar(0)), tyList(tyRef(typeVar(0))), tyList(tyInt), tyInt],
  tyRef(typeVar(0)),
  (args) => {
    const start = asRef(args[0]!);
    const nodeHeap = asList(args[1]!);
    const nextHeap = asList(args[2]!);
    const valueHeap = asList(args[3]!);
    const target = asInt(args[4]!);
    if (start === null || nodeHeap === null || nextHeap === null || valueHeap === null || target === null) {
      return valueError;
    }
    if (start === -1) {
      return valueRef(-1);
    }

    const seen = new Set<number>();
    let current = start;
    while (current !== -1) {
      if (seen.has(current)) {
        return valueRef(-1);
      }
      seen.add(current);

      if (
        !isValidIndex(current, nodeHeap.length) ||
        !isValidIndex(current, nextHeap.length) ||
        !isValidIndex(current, valueHeap.length)
      ) {
        return valueError;
      }

      const currentValue = readIntEntry(valueHeap, current);
      if (currentValue === null) {
        return valueError;
      }
      if (currentValue === target) {
        return valueRef(current);
      }

      const next = readRefEntry(nextHeap, current);
      if (next === null) {
        return valueError;
      }
      current = next;
    }

    return valueRef(-1);
  },
);
