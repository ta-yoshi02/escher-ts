import { ComponentImpl } from "../components/component.js";
import {
  tyBool,
  tyInt,
  tyList,
  tyPair,
  typeVar,
} from "../types/type.js";
import {
  equalTermValue,
  type TermValue,
  valueBool,
  valueError,
  valueInt,
  valueList,
  valuePair,
} from "../types/value.js";
import {
  argsDifferent,
  asBool,
  asInt,
  asList,
  associativeRight,
  commutative2,
  noDirectChildren,
  reduceIf,
} from "./common-comps-helpers.js";

export const isNil = new ComponentImpl("isNil", [tyList(typeVar(0))], tyBool, (args) => {
  const xs = asList(args[0]!);
  return xs === null ? valueError : valueBool(xs.length === 0);
}, true, noDirectChildren("cons"));

export const isZero = new ComponentImpl("isZero", [tyInt], tyBool, (args) => {
  const n = asInt(args[0]!);
  return n === null ? valueError : valueBool(n === 0);
});

export const isNonNeg = new ComponentImpl("isNonNeg", [tyInt], tyBool, (args) => {
  const n = asInt(args[0]!);
  return n === null ? valueError : valueBool(n >= 0);
});

export const zero = new ComponentImpl("zero", [], tyInt, () => valueInt(0));
export const tComp = new ComponentImpl("T", [], tyBool, () => valueBool(true));
export const fComp = new ComponentImpl("F", [], tyBool, () => valueBool(false));

export const inc = new ComponentImpl("inc", [tyInt], tyInt, (args) => {
  const n = asInt(args[0]!);
  return n === null ? valueError : valueInt(n + 1);
}, true, noDirectChildren("dec"));

export const dec = new ComponentImpl("dec", [tyInt], tyInt, (args) => {
  const n = asInt(args[0]!);
  return n === null ? valueError : valueInt(n - 1);
}, true, noDirectChildren("inc"));

export const neg = new ComponentImpl("neg", [tyInt], tyInt, (args) => {
  const n = asInt(args[0]!);
  return n === null ? valueError : valueInt(-n);
}, true, noDirectChildren("neg", "inc", "dec"));

export const tail = new ComponentImpl("tail", [tyList(typeVar(0))], tyList(typeVar(0)), (args) => {
  const xs = asList(args[0]!);
  if (xs === null || xs.length === 0) {
    return valueError;
  }
  return valueList(xs.slice(1));
});

export const cons = new ComponentImpl("cons", [typeVar(0), tyList(typeVar(0))], tyList(typeVar(0)), (args) => {
  const head = args[0]!;
  const tailValue = asList(args[1]!);
  if (tailValue === null) {
    return valueError;
  }
  return valueList([head, ...tailValue]);
});

export const head = new ComponentImpl("head", [tyList(typeVar(0))], typeVar(0), (args) => {
  const xs = asList(args[0]!);
  if (xs === null || xs.length === 0) {
    return valueError;
  }
  return xs[0]!;
}, true, noDirectChildren("cons"));

export const nil = new ComponentImpl("nil", [], tyList(typeVar(0)), () => valueList([]));

export const concat = new ComponentImpl("concat", [tyList(typeVar(0)), tyList(typeVar(0))], tyList(typeVar(0)), (args) => {
  const xs = asList(args[0]!);
  const ys = asList(args[1]!);
  if (xs === null || ys === null) {
    return valueError;
  }
  return valueList([...xs, ...ys]);
}, true, associativeRight("concat"));

export const equal = new ComponentImpl("equal", [typeVar(0), typeVar(0)], tyBool, (args) => {
  const [a, b] = args;
  if (a === undefined || b === undefined) {
    return valueError;
  }
  return valueBool(JSON.stringify(a) === JSON.stringify(b));
}, true, reduceIf(commutative2, argsDifferent, noDirectChildren("T", "F")));

export const andComp = new ComponentImpl(
  "and",
  [tyBool, tyBool],
  tyBool,
  (args) => {
    const a = asBool(args[0]!);
    const b = asBool(args[1]!);
    if (a === null || b === null) {
      return valueError;
    }
    return valueBool(a && b);
  },
  true,
  reduceIf(commutative2, associativeRight("and"), argsDifferent, noDirectChildren("T", "F")),
);

export const orComp = new ComponentImpl(
  "or",
  [tyBool, tyBool],
  tyBool,
  (args) => {
    const a = asBool(args[0]!);
    const b = asBool(args[1]!);
    if (a === null || b === null) {
      return valueError;
    }
    return valueBool(a || b);
  },
  true,
  reduceIf(commutative2, associativeRight("or"), argsDifferent, noDirectChildren("T", "F")),
);

export const notComp = new ComponentImpl("not", [tyBool], tyBool, (args) => {
  const a = asBool(args[0]!);
  return a === null ? valueError : valueBool(!a);
}, true, noDirectChildren("not"));

const reverseImpl = (xs: readonly TermValue[]): readonly TermValue[] => [...xs].reverse();

const stutterImpl = (xs: readonly TermValue[]): readonly TermValue[] => {
  const out: TermValue[] = [];
  for (const x of xs) {
    out.push(x, x);
  }
  return out;
};

const compressImpl = (xs: readonly TermValue[]): readonly TermValue[] => {
  if (xs.length <= 1) {
    return [...xs];
  }
  const out: TermValue[] = [xs[0]!];
  for (let i = 1; i < xs.length; i += 1) {
    if (JSON.stringify(xs[i]!) !== JSON.stringify(xs[i - 1]!)) {
      out.push(xs[i]!);
    }
  }
  return out;
};

export const reverseRef = new ComponentImpl("reverse", [tyList(typeVar(0))], tyList(typeVar(0)), (args) => {
  const xs = asList(args[0]!);
  return xs === null ? valueError : valueList(reverseImpl(xs));
});

export const stutterRef = new ComponentImpl("stutter", [tyList(typeVar(0))], tyList(typeVar(0)), (args) => {
  const xs = asList(args[0]!);
  return xs === null ? valueError : valueList(stutterImpl(xs));
});

export const compressRef = new ComponentImpl("compress", [tyList(typeVar(0))], tyList(typeVar(0)), (args) => {
  const xs = asList(args[0]!);
  return xs === null ? valueError : valueList(compressImpl(xs));
});

export const standardListComponents = [
  tComp,
  fComp,
  isNil,
  isZero,
  isNonNeg,
  zero,
  inc,
  dec,
  neg,
  tail,
  cons,
  head,
  nil,
  concat,
  equal,
  andComp,
  orComp,
  notComp,
] as const;

export const listIntType = tyList(tyInt);

const sameValue = (a: TermValue, b: TermValue): boolean => equalTermValue(a, b);

export const containsRef = new ComponentImpl("contains", [tyList(typeVar(0)), typeVar(0)], tyBool, (args) => {
  const xs = asList(args[0]!);
  const x = args[1];
  if (xs === null || x === undefined) {
    return valueError;
  }
  return valueBool(xs.some((elem) => sameValue(elem, x)));
});

export const insertRef = new ComponentImpl(
  "insert",
  [tyList(typeVar(0)), tyInt, typeVar(0)],
  tyList(typeVar(0)),
  (args) => {
    const xs = asList(args[0]!);
    const i = asInt(args[1]!);
    const x = args[2];
    if (xs === null || i === null || x === undefined) {
      return valueError;
    }
    const index = Math.max(0, Math.min(i, xs.length));
    return valueList([...xs.slice(0, index), x, ...xs.slice(index)]);
  },
);

export const dropLastRef = new ComponentImpl("dropLast", [tyList(typeVar(0))], tyList(typeVar(0)), (args) => {
  const xs = asList(args[0]!);
  if (xs === null) {
    return valueError;
  }
  return valueList(xs.slice(0, Math.max(0, xs.length - 1)));
});

export const evensRef = new ComponentImpl("evens", [tyList(typeVar(0))], tyList(typeVar(0)), (args) => {
  const xs = asList(args[0]!);
  if (xs === null) {
    return valueError;
  }
  return valueList(xs.filter((_, i) => i % 2 === 0));
});

export const lengthRef = new ComponentImpl("length", [tyList(typeVar(0))], tyInt, (args) => {
  const xs = asList(args[0]!);
  return xs === null ? valueError : valueInt(xs.length);
});

export const lastInListRef = new ComponentImpl("lastInList", [tyList(typeVar(0))], typeVar(0), (args) => {
  const xs = asList(args[0]!);
  if (xs === null || xs.length === 0) {
    return valueError;
  }
  return xs[xs.length - 1]!;
});

export const shiftLeftRef = new ComponentImpl("shiftLeft", [tyList(typeVar(0))], tyList(typeVar(0)), (args) => {
  const xs = asList(args[0]!);
  if (xs === null || xs.length === 0) {
    return valueList([]);
  }
  return valueList([...xs].reverse());
});

export const maxInListRef = new ComponentImpl("maxInList", [tyList(tyInt)], tyInt, (args) => {
  const xs = asList(args[0]!);
  if (xs === null || xs.length === 0) {
    return valueInt(0);
  }
  const ints = xs.map((v) => asInt(v)).filter((v): v is number => v !== null);
  return ints.length === xs.length ? valueInt(Math.max(...ints)) : valueError;
});

export const createPair = new ComponentImpl("createPair", [typeVar(0), typeVar(1)], tyPair(typeVar(0), typeVar(1)), (args) => {
  const left = args[0];
  const right = args[1];
  if (left === undefined || right === undefined) {
    return valueError;
  }
  return valuePair(left, right);
});

export const createPairIntInt = new ComponentImpl(
  "createPair",
  [tyInt, tyInt],
  tyPair(tyInt, tyInt),
  (args) => createPair.executeEfficient(args),
);

export const cartesianRef = new ComponentImpl(
  "cartesian",
  [tyList(typeVar(0)), tyList(typeVar(1))],
  tyList(tyPair(typeVar(0), typeVar(1))),
  (args) => {
    const xs = asList(args[0]!);
    const ys = asList(args[1]!);
    if (xs === null || ys === null) {
      return valueError;
    }
    const out: TermValue[] = [];
    for (const x of xs) {
      for (const y of ys) {
        out.push(valuePair(x, y));
      }
    }
    return valueList(out);
  },
);
