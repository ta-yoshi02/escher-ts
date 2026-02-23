import { defineComponents, type ArgList, type ComponentDefinition, type ComponentImpl } from "./component.js";
import { tyBool, tyInt, tyList, tyObject, tyPair, tyRef, tyTree, type Type } from "../types/type.js";
import {
  binaryLeaf,
  binaryNode,
  type BinaryTree,
  type TermValue,
  valueBool,
  valueError,
  valueInt,
  valueList,
  valueObject,
  valuePair,
  valueRef,
  valueTree,
} from "../types/value.js";

export interface UserPairLiteral {
  readonly pair: readonly [UserLiteral, UserLiteral];
}

export interface UserRefLiteral {
  readonly ref: number;
}

export interface UserErrorLiteral {
  readonly error: true;
}

export interface UserTreeLeafLiteral {
  readonly tree: "leaf";
}

export interface UserTreeNodeLiteral {
  readonly tree: {
    readonly value: UserLiteral;
    readonly left: UserTreeLiteral;
    readonly right: UserTreeLiteral;
  };
}

export interface UserObjectLiteral {
  readonly object: {
    readonly className: string;
    readonly fields: Readonly<Record<string, UserLiteral>>;
  };
}

export type UserTreeLiteral = UserTreeLeafLiteral | UserTreeNodeLiteral;
export type UserLiteral =
  | number
  | boolean
  | readonly UserLiteral[]
  | UserPairLiteral
  | UserRefLiteral
  | UserTreeLiteral
  | UserObjectLiteral
  | UserErrorLiteral;

const isNumber = (value: TermValue): value is ReturnType<typeof valueInt> => value.tag === "int";
const isBool = (value: TermValue): value is ReturnType<typeof valueBool> => value.tag === "bool";
const isPairLiteral = (literal: UserLiteral): literal is UserPairLiteral =>
  typeof literal === "object" && literal !== null && "pair" in literal;
const isRefLiteral = (literal: UserLiteral): literal is UserRefLiteral =>
  typeof literal === "object" && literal !== null && "ref" in literal;
const isTreeLiteral = (literal: UserLiteral): literal is UserTreeLiteral =>
  typeof literal === "object" && literal !== null && "tree" in literal;
const isObjectLiteral = (literal: UserLiteral): literal is UserObjectLiteral =>
  typeof literal === "object" && literal !== null && "object" in literal;
const isErrorLiteral = (literal: UserLiteral): literal is UserErrorLiteral =>
  typeof literal === "object" && literal !== null && "error" in literal;

export const pairLit = (left: UserLiteral, right: UserLiteral): UserPairLiteral => ({ pair: [left, right] });
export const refLit = (label: number): UserRefLiteral => ({ ref: label });
export const errorLit = (): UserErrorLiteral => ({ error: true });
export const leafLit = (): UserTreeLeafLiteral => ({ tree: "leaf" });
export const nodeLit = (value: UserLiteral, left: UserTreeLiteral, right: UserTreeLiteral): UserTreeNodeLiteral => ({
  tree: { value, left, right },
});
export const objectLit = (
  className: string,
  fields: Readonly<Record<string, UserLiteral>>,
): UserObjectLiteral => ({
  object: { className, fields },
});

const treeLiteralToValueTree = (tree: UserTreeLiteral): BinaryTree<TermValue> => {
  if (tree.tree === "leaf") {
    return binaryLeaf;
  }
  return binaryNode(
    literalToValue(tree.tree.value),
    treeLiteralToValueTree(tree.tree.left),
    treeLiteralToValueTree(tree.tree.right),
  );
};

export const literalToValue = (literal: UserLiteral): TermValue => {
  if (typeof literal === "number") {
    return valueInt(literal);
  }
  if (typeof literal === "boolean") {
    return valueBool(literal);
  }
  if (isPairLiteral(literal)) {
    return valuePair(literalToValue(literal.pair[0]), literalToValue(literal.pair[1]));
  }
  if (isRefLiteral(literal)) {
    return valueRef(literal.ref);
  }
  if (isObjectLiteral(literal)) {
    const fields = Object.fromEntries(
      Object.entries(literal.object.fields).map(([name, value]) => [name, literalToValue(value)] as const),
    );
    return valueObject(literal.object.className, fields);
  }
  if (isErrorLiteral(literal)) {
    return valueError;
  }
  if (isTreeLiteral(literal)) {
    return valueTree(treeLiteralToValueTree(literal));
  }
  return valueList(literal.map(literalToValue));
};

export const literalsToArgs = (args: readonly UserLiteral[]): ArgList => args.map(literalToValue);

export const literalExamples = (
  examples: readonly (readonly [readonly UserLiteral[], UserLiteral])[],
): readonly (readonly [ArgList, TermValue])[] =>
  examples.map(([args, out]) => [literalsToArgs(args), literalToValue(out)] as const);

export const valueToLiteral = (value: TermValue): UserLiteral | null => {
  switch (value.tag) {
    case "error":
      return errorLit();
    case "int":
      return value.value;
    case "ref":
      return refLit(value.value);
    case "bool":
      return value.value;
    case "list": {
      const out: UserLiteral[] = [];
      for (const elem of value.elems) {
        const converted = valueToLiteral(elem);
        if (converted === null) {
          return null;
        }
        out.push(converted);
      }
      return out;
    }
    case "pair": {
      const left = valueToLiteral(value.left);
      const right = valueToLiteral(value.right);
      if (left === null || right === null) {
        return null;
      }
      return pairLit(left, right);
    }
    case "tree": {
      const walk = (tree: BinaryTree<TermValue>): UserTreeLiteral | null => {
        if (tree.kind === "leaf") {
          return leafLit();
        }
        const v = valueToLiteral(tree.tag);
        const l = walk(tree.left);
        const r = walk(tree.right);
        if (v === null || l === null || r === null) {
          return null;
        }
        return nodeLit(v, l, r);
      };
      return walk(value.value);
    }
    case "object": {
      const entries: [string, UserLiteral][] = [];
      for (const [name, fieldValue] of Object.entries(value.fields)) {
        const converted = valueToLiteral(fieldValue);
        if (converted === null) {
          return null;
        }
        entries.push([name, converted]);
      }
      const fields = Object.fromEntries(entries);
      return objectLit(value.className, fields);
    }
    default:
      return null;
  }
};

export const literalOracle = (fn: (args: readonly UserLiteral[]) => UserLiteral) => (args: ArgList): TermValue => {
  const convertedArgs: UserLiteral[] = [];
  for (const arg of args) {
    const converted = valueToLiteral(arg);
    if (converted === null) {
      return valueError;
    }
    convertedArgs.push(converted);
  }
  return literalToValue(fn(convertedArgs));
};

export const intConst = (name: string, value: number): ComponentDefinition => ({
  name,
  inputTypes: [],
  returnType: tyInt,
  impl: () => valueInt(value),
});

export const intUnary = (name: string, impl: (x: number) => number): ComponentDefinition => ({
  name,
  inputTypes: [tyInt],
  returnType: tyInt,
  impl: ([x]) => (x !== undefined && isNumber(x) ? valueInt(impl(x.value)) : valueError),
});

export const intBinary = (name: string, impl: (x: number, y: number) => number): ComponentDefinition => ({
  name,
  inputTypes: [tyInt, tyInt],
  returnType: tyInt,
  impl: ([x, y]) =>
    x !== undefined && y !== undefined && isNumber(x) && isNumber(y) ? valueInt(impl(x.value, y.value)) : valueError,
});

export const boolUnary = (name: string, impl: (x: boolean) => boolean): ComponentDefinition => ({
  name,
  inputTypes: [tyBool],
  returnType: tyBool,
  impl: ([x]) => (x !== undefined && isBool(x) ? valueBool(impl(x.value)) : valueError),
});

export const defineUserComponents = (definitions: readonly ComponentDefinition[]): readonly ComponentImpl[] =>
  defineComponents(definitions);

export const inferLiteralType = (literal: UserLiteral): Type => {
  if (typeof literal === "number") {
    return tyInt;
  }
  if (typeof literal === "boolean") {
    return tyBool;
  }
  if (isErrorLiteral(literal)) {
    throw new Error("Cannot infer a type from an error literal; provide signature explicitly");
  }
  if (isPairLiteral(literal)) {
    return tyPair(inferLiteralType(literal.pair[0]), inferLiteralType(literal.pair[1]));
  }
  if (isRefLiteral(literal)) {
    return tyRef(tyInt);
  }
  if (isTreeLiteral(literal)) {
    if (literal.tree === "leaf") {
      return tyTree(tyInt);
    }
    return tyTree(inferLiteralType(literal.tree.value));
  }
  if (isObjectLiteral(literal)) {
    return tyObject(literal.object.className);
  }
  const elemType = literal.length === 0 ? tyInt : inferLiteralType(literal[0]!);
  return tyList(elemType);
};
