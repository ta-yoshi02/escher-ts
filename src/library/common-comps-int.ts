import { ComponentImpl } from "../components/component.js";
import { tyInt, tyList } from "../types/type.js";
import {
  type TermValue,
  valueError,
  valueInt,
  valueList,
} from "../types/value.js";
import {
  argsDifferent,
  asInt,
  associativeRight,
  commutative2,
  noDirectChildren,
  reduceIf,
} from "./common-comps-helpers.js";

export const plus = new ComponentImpl("plus", [tyInt, tyInt], tyInt, (args) => {
  const x = asInt(args[0]!);
  const y = asInt(args[1]!);
  return x === null || y === null ? valueError : valueInt(x + y);
}, true, reduceIf(commutative2, argsDifferent, noDirectChildren("inc", "dec")));

export const times = new ComponentImpl("times", [tyInt, tyInt], tyInt, (args) => {
  const x = asInt(args[0]!);
  const y = asInt(args[1]!);
  return x === null || y === null ? valueError : valueInt(x * y);
}, true, reduceIf(commutative2, associativeRight("times"), noDirectChildren("zero", "neg")));

export const div = new ComponentImpl("div", [tyInt, tyInt], tyInt, (args) => {
  const x = asInt(args[0]!);
  const y = asInt(args[1]!);
  if (x === null || y === null || y === 0) {
    return valueError;
  }
  return valueInt(Math.trunc(x / y));
}, true, noDirectChildren("zero", "neg"));

export const div2 = new ComponentImpl("div2", [tyInt], tyInt, (args) => {
  const x = asInt(args[0]!);
  return x === null ? valueError : valueInt(Math.trunc(x / 2));
});

export const modulo = new ComponentImpl("modulo", [tyInt, tyInt], tyInt, (args) => {
  const a = asInt(args[0]!);
  const b = asInt(args[1]!);
  if (a === null || b === null || b === 0) {
    return valueError;
  }
  return valueInt(a % b);
});

export const squareListRef = new ComponentImpl("squareList", [tyInt], tyList(tyInt), (args) => {
  const n = asInt(args[0]!);
  if (n === null) {
    return valueError;
  }
  if (n <= 0) {
    return valueList([]);
  }
  const out: TermValue[] = [];
  for (let i = 1; i <= n; i += 1) {
    out.push(valueInt(i * i));
  }
  return valueList(out);
});

export const sumUnderRef = new ComponentImpl("sumUnder", [tyInt], tyInt, (args) => {
  const n = asInt(args[0]!);
  if (n === null || n <= 0) {
    return valueInt(0);
  }
  return valueInt((n * (n + 1)) / 2);
});

export const fibRef = new ComponentImpl("fib", [tyInt], tyInt, (args) => {
  const n = asInt(args[0]!);
  if (n === null) {
    return valueError;
  }
  let a = 1;
  let b = 1;
  for (let i = 0; i < n; i += 1) {
    const c = a + b;
    a = b;
    b = c;
  }
  return valueInt(a);
});
