export interface TypeConstructor {
  readonly name: string;
  readonly arity: number;
}

export interface TVarType {
  readonly kind: "var";
  readonly id: number;
}

export interface TFixedVarType {
  readonly kind: "fixedVar";
  readonly id: number;
}

export interface TApplyType {
  readonly kind: "apply";
  readonly constructor: TypeConstructor;
  readonly params: readonly Type[];
}

export type Type = TVarType | TFixedVarType | TApplyType;

export const TBool: TypeConstructor = { name: "Bool", arity: 0 };
export const TInt: TypeConstructor = { name: "Int", arity: 0 };
export const TList: TypeConstructor = { name: "List", arity: 1 };
export const TTree: TypeConstructor = { name: "Tree", arity: 1 };
export const TPair: TypeConstructor = { name: "Pair", arity: 2 };
export const TMap: TypeConstructor = { name: "Map", arity: 2 };
export const TRef: TypeConstructor = { name: "Ref", arity: 1 };
const objectTypeConstructors = new Map<string, TypeConstructor>();

export const typeVar = (id: number): TVarType => ({ kind: "var", id });
export const typeFixedVar = (id: number): TFixedVarType => ({ kind: "fixedVar", id });

export const typeApply = (constructor: TypeConstructor, params: readonly Type[]): TApplyType => {
  if (params.length !== constructor.arity) {
    throw new Error(`Type constructor ${constructor.name} expects ${constructor.arity} params, got ${params.length}`);
  }
  return { kind: "apply", constructor, params };
};

export const tyInt = typeApply(TInt, []);
export const tyBool = typeApply(TBool, []);
export const tyList = (param: Type): Type => typeApply(TList, [param]);
export const tyTree = (param: Type): Type => typeApply(TTree, [param]);
export const tyPair = (left: Type, right: Type): Type => typeApply(TPair, [left, right]);
export const tyMap = (keyType: Type, valueType: Type): Type => typeApply(TMap, [keyType, valueType]);
export const tyRef = (target: Type): Type => typeApply(TRef, [target]);
export const objectTypeConstructor = (className: string): TypeConstructor => {
  const key = className.trim();
  if (key.length === 0) {
    throw new Error("className must be non-empty");
  }
  const known = objectTypeConstructors.get(key);
  if (known !== undefined) {
    return known;
  }
  const created: TypeConstructor = { name: `Object<${key}>`, arity: 0 };
  objectTypeConstructors.set(key, created);
  return created;
};
export const tyObject = (className: string): Type => typeApply(objectTypeConstructor(className), []);

const sameTypeConstructor = (left: TypeConstructor, right: TypeConstructor): boolean =>
  left.name === right.name && left.arity === right.arity;

export const showType = (t: Type): string => {
  switch (t.kind) {
    case "var":
      return `?${t.id}`;
    case "fixedVar":
      return `'${t.id}`;
    case "apply":
      if (t.params.length === 0) {
        return t.constructor.name;
      }
      return `${t.constructor.name}[${t.params.map(showType).join(",")}]`;
  }
};

export const equalsType = (a: Type, b: Type): boolean => {
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.kind === "var" && b.kind === "var") {
    return a.id === b.id;
  }
  if (a.kind === "fixedVar" && b.kind === "fixedVar") {
    return a.id === b.id;
  }
  if (a.kind === "apply" && b.kind === "apply") {
    if (!sameTypeConstructor(a.constructor, b.constructor) || a.params.length !== b.params.length) {
      return false;
    }
    return a.params.every((p, i) => equalsType(p, b.params[i]!));
  }
  return false;
};

export const freeVarSet = (t: Type): Set<number> => {
  switch (t.kind) {
    case "var":
      return new Set([t.id]);
    case "fixedVar":
      return new Set<number>();
    case "apply": {
      const out = new Set<number>();
      for (const p of t.params) {
        for (const v of freeVarSet(p)) {
          out.add(v);
        }
      }
      return out;
    }
  }
};

export const nextFreeId = (t: Type): number => {
  switch (t.kind) {
    case "var":
      return t.id + 1;
    case "fixedVar":
      return 0;
    case "apply":
      return t.params.reduce((mx, p) => Math.max(mx, nextFreeId(p)), 0);
  }
};

export const renameIndices = (t: Type, f: (id: number) => number): Type => {
  switch (t.kind) {
    case "var":
      return typeVar(f(t.id));
    case "fixedVar":
      return t;
    case "apply":
      return typeApply(t.constructor, t.params.map((p) => renameIndices(p, f)));
  }
};

export const shiftId = (t: Type, amount: number): Type => renameIndices(t, (id) => id + amount);

export const fixVars = (t: Type): Type => {
  switch (t.kind) {
    case "var":
      return typeFixedVar(t.id);
    case "fixedVar":
      return t;
    case "apply":
      return typeApply(t.constructor, t.params.map((p) => fixVars(p)));
  }
};

export const containsVar = (t: Type, id: number): boolean => {
  switch (t.kind) {
    case "var":
      return t.id === id;
    case "fixedVar":
      return false;
    case "apply":
      return t.params.some((p) => containsVar(p, id));
  }
};

export const containsFixedVar = (t: Type, id: number): boolean => {
  switch (t.kind) {
    case "var":
      return false;
    case "fixedVar":
      return t.id === id;
    case "apply":
      return t.params.some((p) => containsFixedVar(p, id));
  }
};

export class TypeSubst {
  readonly map: ReadonlyMap<number, Type>;

  constructor(entries?: ReadonlyMap<number, Type> | readonly (readonly [number, Type])[]) {
    this.map = entries instanceof Map ? new Map(entries) : new Map(entries ?? []);
  }

  static readonly empty = new TypeSubst();

  apply(ty: Type): Type {
    switch (ty.kind) {
      case "var":
        return this.map.get(ty.id) ?? ty;
      case "fixedVar":
        return ty;
      case "apply":
        return typeApply(ty.constructor, ty.params.map((p) => this.apply(p)));
    }
  }

  compose(that: TypeSubst): TypeSubst {
    const merged = new Map<number, Type>(that.map);
    for (const [id, t] of this.map) {
      merged.set(id, that.apply(t));
    }
    return new TypeSubst(merged);
  }

  deleteVar(id: number): TypeSubst {
    const next = new Map(this.map);
    next.delete(id);
    return new TypeSubst(next);
  }

  contains(subst: TypeSubst): boolean {
    for (const [id, ty] of subst.map) {
      const own = this.map.get(id);
      if (own === undefined || !equalsType(own, ty)) {
        return false;
      }
    }
    return true;
  }

  equals(other: TypeSubst): boolean {
    if (this.map.size !== other.map.size) {
      return false;
    }
    return this.contains(other);
  }
}

export const alphaNormalRenaming = (t: Type): Map<number, number> => {
  const map = new Map<number, number>();
  let nextIndex = 0;

  const walk = (ty: Type): void => {
    switch (ty.kind) {
      case "var":
        if (!map.has(ty.id)) {
          map.set(ty.id, nextIndex);
          nextIndex += 1;
        }
        return;
      case "fixedVar":
        return;
      case "apply":
        for (const p of ty.params) {
          walk(p);
        }
    }
  };

  walk(t);
  return map;
};

export const alphaNormalForm = (t: Type): Type => {
  const map = alphaNormalRenaming(t);
  return renameIndices(t, (id) => map.get(id) ?? id);
};

export const unify = (ty1: Type, ty2: Type): TypeSubst | null => {
  if (equalsType(ty1, ty2)) {
    return TypeSubst.empty;
  }

  if (ty1.kind === "var") {
    if (containsVar(ty2, ty1.id)) {
      return null;
    }
    return new TypeSubst([[ty1.id, ty2]]);
  }

  if (ty2.kind === "var") {
    if (containsVar(ty1, ty2.id)) {
      return null;
    }
    return new TypeSubst([[ty2.id, ty1]]);
  }

  if (ty1.kind === "fixedVar" || ty2.kind === "fixedVar") {
    return null;
  }

  if (!sameTypeConstructor(ty1.constructor, ty2.constructor) || ty1.params.length !== ty2.params.length) {
    return null;
  }

  let subst = TypeSubst.empty;
  for (let i = 0; i < ty1.params.length; i += 1) {
    const s = unify(subst.apply(ty1.params[i]!), subst.apply(ty2.params[i]!));
    if (s === null) {
      return null;
    }
    subst = subst.compose(s);
  }
  return subst;
};

export const instanceOfWithMap = (t: Type, parent: Type): TypeSubst | null => {
  const parentFree = nextFreeId(parent);
  const shifted = shiftId(t, parentFree);
  const unifier = unify(parent, shifted);
  if (unifier === null) {
    return null;
  }
  return equalsType(unifier.apply(shifted), shifted) ? unifier : null;
};

export const instanceOfType = (t: Type, parent: Type): boolean => instanceOfWithMap(t, parent) !== null;

export const canAppearIn = (smallType: Type, bigType: Type): boolean => {
  if (smallType.kind === "var") {
    return true;
  }

  if (smallType.kind === "fixedVar") {
    return containsFixedVar(bigType, smallType.id);
  }

  if (bigType.kind !== "apply") {
    return false;
  }

  if (
    sameTypeConstructor(smallType.constructor, bigType.constructor) &&
    instanceOfType(bigType, smallType)
  ) {
    return true;
  }

  return bigType.params.some((p) => canAppearIn(smallType, p));
};
