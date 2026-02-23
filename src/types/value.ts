import {
  type Type,
  type TApplyType,
  TypeSubst,
  TBool,
  TInt,
  TList,
  TRef,
  TPair,
  TTree,
  equalsType,
  objectTypeConstructor,
  typeApply,
  typeVar,
} from "./type.js";

export type ExtendedValue = TermValue | ValueUnknown;

export interface ValueUnknown {
  readonly tag: "unknown";
}

export interface ValueError {
  readonly tag: "error";
}

export interface ValueBool {
  readonly tag: "bool";
  readonly value: boolean;
}

export interface ValueInt {
  readonly tag: "int";
  readonly value: number;
}

export interface ValueRef {
  readonly tag: "ref";
  readonly value: number;
}

export interface ValueList {
  readonly tag: "list";
  readonly elems: readonly TermValue[];
}

export interface ValuePair {
  readonly tag: "pair";
  readonly left: TermValue;
  readonly right: TermValue;
}

export type BinaryTree<T> = BinaryLeaf | BinaryNode<T>;

export interface BinaryLeaf {
  readonly kind: "leaf";
}

export interface BinaryNode<T> {
  readonly kind: "node";
  readonly tag: T;
  readonly left: BinaryTree<T>;
  readonly right: BinaryTree<T>;
}

export interface ValueTree {
  readonly tag: "tree";
  readonly value: BinaryTree<TermValue>;
}

export interface ValueObject {
  readonly tag: "object";
  readonly className: string;
  readonly fields: Readonly<Record<string, TermValue>>;
}

export type TermValue = ValueError | ValueBool | ValueInt | ValueRef | ValueList | ValuePair | ValueTree | ValueObject;

export interface MatchTypeResult {
  readonly subst: TypeSubst;
  readonly nextFreeId: number;
}

export const valueUnknown: ValueUnknown = { tag: "unknown" };
export const valueError: ValueError = { tag: "error" };
export const valueBool = (value: boolean): ValueBool => ({ tag: "bool", value });
export const valueInt = (value: number): ValueInt => ({ tag: "int", value });
export const valueRef = (value: number): ValueRef => ({ tag: "ref", value });
export const valueList = (elems: readonly TermValue[]): ValueList => ({ tag: "list", elems });
export const valuePair = (left: TermValue, right: TermValue): ValuePair => ({ tag: "pair", left, right });
export const valueObject = (className: string, fields: Readonly<Record<string, TermValue>>): ValueObject => ({
  tag: "object",
  className,
  fields,
});
export const binaryLeaf: BinaryLeaf = { kind: "leaf" };
export const binaryNode = <T>(tag: T, left: BinaryTree<T>, right: BinaryTree<T>): BinaryNode<T> => ({
  kind: "node",
  tag,
  left,
  right,
});
export const valueTree = (value: BinaryTree<TermValue>): ValueTree => ({ tag: "tree", value });

const treeSize = (tree: BinaryTree<TermValue>): number =>
  tree.kind === "leaf" ? 0 : 1 + treeSize(tree.left) + treeSize(tree.right);

const showTree = (tree: BinaryTree<TermValue>): string => {
  if (tree.kind === "leaf") {
    return "L";
  }
  return `(${showValue(tree.tag)}: ${showTree(tree.left)}, ${showTree(tree.right)})`;
};

export const showValue = (value: ExtendedValue): string => {
  if (value.tag === "unknown") {
    return "?";
  }

  switch (value.tag) {
    case "error":
      return "Err";
    case "bool":
      return value.value ? "T" : "F";
    case "int":
      return `${value.value}`;
    case "ref":
      return `&${value.value}`;
    case "list":
      return `[${value.elems.map(showValue).join(", ")}]`;
    case "pair":
      return `(${showValue(value.left)}, ${showValue(value.right)})`;
    case "tree":
      return showTree(value.value);
    case "object": {
      const entries = Object.entries(value.fields)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, v]) => `${name}: ${showValue(v)}`);
      return `${value.className}{${entries.join(", ")}}`;
    }
  }
};

const compareTree = (a: BinaryTree<TermValue>, b: BinaryTree<TermValue>): number => {
  if (a.kind !== b.kind) {
    return a.kind === "leaf" ? -1 : 1;
  }

  if (a.kind === "leaf" && b.kind === "leaf") {
    return 0;
  }

  const nodeA = a as BinaryNode<TermValue>;
  const nodeB = b as BinaryNode<TermValue>;

  const rootCmp = compareTermValue(nodeA.tag, nodeB.tag);
  if (rootCmp !== 0) {
    return rootCmp;
  }

  const leftCmp = compareTree(nodeA.left, nodeB.left);
  if (leftCmp !== 0) {
    return leftCmp;
  }

  return compareTree(nodeA.right, nodeB.right);
};

export const compareTermValue = (left: TermValue, right: TermValue): number => {
  if (left.tag !== right.tag) {
    const order: Record<TermValue["tag"], number> = {
      error: 0,
      bool: 1,
      int: 2,
      ref: 3,
      list: 4,
      pair: 5,
      tree: 6,
      object: 7,
    };
    return order[left.tag] - order[right.tag];
  }

  switch (left.tag) {
    case "error":
      return 0;
    case "bool": {
      const rv = (right as ValueBool).value;
      if (left.value === rv) {
        return 0;
      }
      return left.value ? 1 : -1;
    }
    case "int":
      return left.value - (right as ValueInt).value;
    case "ref":
      return left.value - (right as ValueRef).value;
    case "list": {
      const rhs = (right as ValueList).elems;
      const shared = Math.min(left.elems.length, rhs.length);
      for (let i = 0; i < shared; i += 1) {
        const cmp = compareTermValue(left.elems[i]!, rhs[i]!);
        if (cmp !== 0) {
          return cmp;
        }
      }
      return left.elems.length - rhs.length;
    }
    case "pair": {
      const rhs = right as ValuePair;
      const leftCmp = compareTermValue(left.left, rhs.left);
      if (leftCmp !== 0) {
        return leftCmp;
      }
      return compareTermValue(left.right, rhs.right);
    }
    case "tree":
      return compareTree(left.value, (right as ValueTree).value);
    case "object": {
      const rhs = right as ValueObject;
      if (left.className !== rhs.className) {
        return left.className.localeCompare(rhs.className);
      }
      const leftEntries = Object.entries(left.fields).sort(([a], [b]) => a.localeCompare(b));
      const rightEntries = Object.entries(rhs.fields).sort(([a], [b]) => a.localeCompare(b));
      const shared = Math.min(leftEntries.length, rightEntries.length);
      for (let i = 0; i < shared; i += 1) {
        const [lk, lv] = leftEntries[i]!;
        const [rk, rv] = rightEntries[i]!;
        if (lk !== rk) {
          return lk.localeCompare(rk);
        }
        const cmp = compareTermValue(lv, rv);
        if (cmp !== 0) {
          return cmp;
        }
      }
      return leftEntries.length - rightEntries.length;
    }
  }
};

export const equalTermValue = (a: TermValue, b: TermValue): boolean => compareTermValue(a, b) === 0;

export const smallerThan = (left: TermValue, right: TermValue): boolean => {
  if (left.tag === "bool" && right.tag === "bool") {
    return !left.value && right.value;
  }

  if (left.tag === "int" && right.tag === "int") {
    return Math.abs(left.value) < Math.abs(right.value);
  }
  if (left.tag === "ref" && right.tag === "ref") {
    return Math.abs(left.value) < Math.abs(right.value);
  }

  if (left.tag === "list" && right.tag === "list") {
    return left.elems.length < right.elems.length;
  }

  if (left.tag === "pair" && right.tag === "pair") {
    return smallerThan(left.left, right.left) || (equalTermValue(left.left, right.left) && smallerThan(left.right, right.right));
  }

  if (left.tag === "tree" && right.tag === "tree") {
    return treeSize(left.value) < treeSize(right.value);
  }
  if (left.tag === "object" && right.tag === "object") {
    return Object.keys(left.fields).length < Object.keys(right.fields).length;
  }

  return false;
};

export const greaterThan = (left: TermValue, right: TermValue): boolean => smallerThan(right, left);

const matchTApply = (ty: Type, target: TApplyType): TypeSubst | null => {
  if (ty.kind === "var") {
    return new TypeSubst([[ty.id, target]]);
  }
  if (ty.kind === "fixedVar") {
    return null;
  }
  return equalsType(ty, target) ? TypeSubst.empty : null;
};

const matchTypeAux = (value: TermValue, ty: Type, counter: () => number): TypeSubst | null => {
  switch (value.tag) {
    case "error":
      return TypeSubst.empty;
    case "bool":
      return matchTApply(ty, typeApply(TBool, []));
    case "int":
      return matchTApply(ty, typeApply(TInt, []));
    case "ref": {
      if (ty.kind === "var") {
        const e = typeVar(counter());
        const refTy = typeApply(TRef, [e]);
        return new TypeSubst([[ty.id, refTy]]);
      }
      if (ty.kind === "apply" && ty.constructor === TRef && ty.params.length === 1) {
        return TypeSubst.empty;
      }
      return null;
    }
    case "list": {
      if (ty.kind === "var") {
        const fresh = counter();
        const elemTy = typeVar(fresh);
        const listTy = typeApply(TList, [elemTy]);
        const inner = matchTypeAux(value, listTy, counter);
        if (inner === null) {
          return null;
        }
        return new TypeSubst([[ty.id, listTy]]).compose(inner);
      }
      if (ty.kind === "apply" && ty.constructor === TList && ty.params.length === 1) {
        let subst = TypeSubst.empty;
        const elemTy = ty.params[0]!;
        for (const elem of value.elems) {
          const s = matchTypeAux(elem, subst.apply(elemTy), counter);
          if (s === null) {
            return null;
          }
          subst = subst.compose(s);
        }
        return subst;
      }
      return null;
    }
    case "pair": {
      if (ty.kind === "var") {
        const l = typeVar(counter());
        const r = typeVar(counter());
        const pairTy = typeApply(TPair, [l, r]);
        const inner = matchTypeAux(value, pairTy, counter);
        if (inner === null) {
          return null;
        }
        return new TypeSubst([[ty.id, pairTy]]).compose(inner);
      }
      if (ty.kind === "apply" && ty.constructor === TPair && ty.params.length === 2) {
        const leftTy = ty.params[0]!;
        const rightTy = ty.params[1]!;
        const leftSubst = matchTypeAux(value.left, leftTy, counter);
        if (leftSubst === null) {
          return null;
        }
        const rightSubst = matchTypeAux(value.right, leftSubst.apply(rightTy), counter);
        if (rightSubst === null) {
          return null;
        }
        return leftSubst.compose(rightSubst);
      }
      return null;
    }
    case "tree": {
      if (ty.kind === "var") {
        const e = typeVar(counter());
        const treeTy = typeApply(TTree, [e]);
        const inner = matchTypeAux(value, treeTy, counter);
        if (inner === null) {
          return null;
        }
        return new TypeSubst([[ty.id, treeTy]]).compose(inner);
      }
      if (ty.kind === "apply" && ty.constructor === TTree && ty.params.length === 1) {
        let subst = TypeSubst.empty;
        const walk = (tree: BinaryTree<TermValue>): TypeSubst | null => {
          if (tree.kind === "leaf") {
            return subst;
          }
          const s = matchTypeAux(tree.tag, subst.apply(ty.params[0]!), counter);
          if (s === null) {
            return null;
          }
          subst = subst.compose(s);
          const l = walk(tree.left);
          if (l === null) {
            return null;
          }
          return walk(tree.right);
        };
        return walk(value.value);
      }
      return null;
    }
    case "object": {
      if (ty.kind === "var") {
        const objTy = typeApply(objectTypeConstructor(value.className), []);
        return new TypeSubst([[ty.id, objTy]]);
      }
      if (ty.kind === "apply" && ty.params.length === 0 && ty.constructor.name === `Object<${value.className}>`) {
        return TypeSubst.empty;
      }
      return null;
    }
  }
};

export const matchType = (value: TermValue, ty: Type, freeId: number): MatchTypeResult | null => {
  let id = freeId;
  const counter = (): number => {
    const out = id;
    id += 1;
    return out;
  };

  const subst = matchTypeAux(value, ty, counter);
  if (subst === null) {
    return null;
  }
  return { subst, nextFreeId: id };
};
