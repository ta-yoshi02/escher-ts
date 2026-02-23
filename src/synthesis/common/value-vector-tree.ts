import { type TermValue, equalTermValue, showValue } from "../../types/value.js";
import { type IndexValueMap, matchVector, type ValueVector } from "./core.js";

interface LeafNode<T> {
  readonly kind: "leaf";
  readonly term: T;
}

interface InternalNode<T> {
  readonly kind: "internal";
  readonly children: Map<string, { value: TermValue; node: TreeNode<T> }>;
}

type TreeNode<T> = LeafNode<T> | InternalNode<T>;

const makeInternalNode = <T>(): InternalNode<T> => ({ kind: "internal", children: new Map() });

const valueKey = (value: TermValue): string => showValue(value);
const vectorKey = (vector: ValueVector): string => vector.map((v) => valueKey(v)).join("|");

export class ValueVectorTree<T> {
  private readonly root: InternalNode<T> = makeInternalNode<T>();
  private readonly valueTermMap = new Map<string, { vector: ValueVector; term: T }>();

  constructor(private readonly depth: number) {}

  get size(): number {
    return this.valueTermMap.size;
  }

  elements(): readonly (readonly [ValueVector, T])[] {
    return [...this.valueTermMap.values()].map(({ vector, term }) => [vector, term] as const);
  }

  addTerm(term: T, valueVector: ValueVector): boolean {
    if (valueVector.length !== this.depth) {
      throw new Error(`Expected vector length ${this.depth}, got ${valueVector.length}`);
    }

    const vvKey = vectorKey(valueVector);
    if (this.valueTermMap.has(vvKey)) {
      return false;
    }

    this.valueTermMap.set(vvKey, { vector: valueVector, term });

    let current: InternalNode<T> = this.root;
    for (let i = 0; i < valueVector.length; i += 1) {
      const value = valueVector[i]!;
      const vKey = valueKey(value);
      const next = current.children.get(vKey);

      if (i === valueVector.length - 1) {
        current.children.set(vKey, { value, node: { kind: "leaf", term } });
        return true;
      }

      if (next === undefined || next.node.kind === "leaf") {
        const created = makeInternalNode<T>();
        current.children.set(vKey, { value, node: created });
        current = created;
      } else {
        current = next.node;
      }
    }

    return true;
  }

  update(valueVector: ValueVector, term: T): boolean {
    return this.addTerm(term, valueVector);
  }

  get(valueVector: ValueVector): T | null {
    const found = this.valueTermMap.get(vectorKey(valueVector));
    return found?.term ?? null;
  }

  searchATerm(valueMap: IndexValueMap): T | null {
    const fromTree = this.searchATermInTree(this.root, 0, valueMap);
    if (fromTree !== null) {
      return fromTree;
    }

    for (const { vector, term } of this.valueTermMap.values()) {
      if (matchVector(valueMap, vector)) {
        return term;
      }
    }
    return null;
  }

  searchTerms(valueMap: IndexValueMap): readonly T[] {
    const out: T[] = [];
    this.searchTermsInTree(this.root, 0, valueMap, out);
    return out;
  }

  private searchATermInTree(node: TreeNode<T>, depth: number, valueMap: IndexValueMap): T | null {
    if (node.kind === "leaf") {
      return node.term;
    }

    const wanted = valueMap.get(depth);
    if (wanted !== undefined) {
      for (const { value, node: next } of node.children.values()) {
        if (equalTermValue(value, wanted)) {
          return this.searchATermInTree(next, depth + 1, valueMap);
        }
      }
      return null;
    }

    for (const { node: next } of node.children.values()) {
      const found = this.searchATermInTree(next, depth + 1, valueMap);
      if (found !== null) {
        return found;
      }
    }

    return null;
  }

  private searchTermsInTree(node: TreeNode<T>, depth: number, valueMap: IndexValueMap, out: T[]): void {
    if (node.kind === "leaf") {
      out.push(node.term);
      return;
    }

    const wanted = valueMap.get(depth);
    if (wanted !== undefined) {
      for (const { value, node: next } of node.children.values()) {
        if (equalTermValue(value, wanted)) {
          this.searchTermsInTree(next, depth + 1, valueMap, out);
        }
      }
      return;
    }

    for (const { node: next } of node.children.values()) {
      this.searchTermsInTree(next, depth + 1, valueMap, out);
    }
  }
}
