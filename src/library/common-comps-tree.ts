import { ComponentImpl } from "../components/component.js";
import { tyBool, tyInt, tyList, tyTree, typeVar } from "../types/type.js";
import {
  binaryLeaf,
  binaryNode,
  type BinaryTree,
  type TermValue,
  valueBool,
  valueError,
  valueList,
  valueTree,
} from "../types/value.js";
import { asInt, noDirectChildren } from "./common-comps-helpers.js";

export const createLeaf = new ComponentImpl("createLeaf", [], tyTree(typeVar(0)), () => valueTree(binaryLeaf));
export const createNode = new ComponentImpl(
  "createNode",
  [typeVar(0), tyTree(typeVar(0)), tyTree(typeVar(0))],
  tyTree(typeVar(0)),
  (args) => {
    const tag = args[0];
    const left = args[1];
    const right = args[2];
    if (tag === undefined || left?.tag !== "tree" || right?.tag !== "tree") {
      return valueError;
    }
    return valueTree(binaryNode(tag, left.value, right.value));
  },
);

export const isLeaf = new ComponentImpl("isLeaf", [tyTree(typeVar(0))], tyBool, (args) => {
  const tree = args[0];
  if (tree?.tag !== "tree") {
    return valueError;
  }
  return valueBool(tree.value.kind === "leaf");
}, true, noDirectChildren("createNode"));

export const treeTag = new ComponentImpl("treeTag", [tyTree(typeVar(0))], typeVar(0), (args) => {
  const tree = args[0];
  if (tree?.tag !== "tree" || tree.value.kind === "leaf") {
    return valueError;
  }
  return tree.value.tag;
}, true, noDirectChildren("createNode"));

export const treeLeft = new ComponentImpl("treeLeft", [tyTree(typeVar(0))], tyTree(typeVar(0)), (args) => {
  const tree = args[0];
  if (tree?.tag !== "tree" || tree.value.kind === "leaf") {
    return valueError;
  }
  return valueTree(tree.value.left);
}, true, noDirectChildren("createNode"));

export const treeRight = new ComponentImpl("treeRight", [tyTree(typeVar(0))], tyTree(typeVar(0)), (args) => {
  const tree = args[0];
  if (tree?.tag !== "tree" || tree.value.kind === "leaf") {
    return valueError;
  }
  return valueTree(tree.value.right);
}, true, noDirectChildren("createNode"));

const flattenTree = (tree: BinaryTree<TermValue>): readonly TermValue[] => {
  if (tree.kind === "leaf") {
    return [];
  }
  return [tree.tag, ...flattenTree(tree.left), ...flattenTree(tree.right)];
};

export const flattenTreeRef = new ComponentImpl("flattenTree", [tyTree(typeVar(0))], tyList(typeVar(0)), (args) => {
  const tree = args[0];
  if (tree?.tag !== "tree") {
    return valueError;
  }
  return valueList(flattenTree(tree.value));
});

const nodesAtLevel = (tree: BinaryTree<TermValue>, level: number): readonly TermValue[] => {
  if (tree.kind === "leaf") {
    return [];
  }
  if (level === 0) {
    return [tree.tag];
  }
  if (level < 0) {
    return [];
  }
  return [...nodesAtLevel(tree.left, level - 1), ...nodesAtLevel(tree.right, level - 1)];
};

export const nodesAtLevelRef = new ComponentImpl("nodesAtLevel", [tyTree(typeVar(0)), tyInt], tyList(typeVar(0)), (args) => {
  const tree = args[0];
  const level = asInt(args[1]!);
  if (tree?.tag !== "tree" || level === null) {
    return valueError;
  }
  return valueList(nodesAtLevel(tree.value, level));
});

export const tConcatRef = new ComponentImpl("tConcat", [tyTree(typeVar(0)), tyTree(typeVar(0))], tyTree(typeVar(0)), (args) => {
  const base = args[0];
  const insert = args[1];
  if (base?.tag !== "tree" || insert?.tag !== "tree") {
    return valueError;
  }
  const impl = (baseTree: BinaryTree<TermValue>, insertTree: BinaryTree<TermValue>): BinaryTree<TermValue> => {
    if (baseTree.kind === "leaf") {
      return insertTree;
    }
    return binaryNode(baseTree.tag, impl(baseTree.left, insertTree), impl(baseTree.right, insertTree));
  };
  return valueTree(impl(base.value, insert.value));
});
