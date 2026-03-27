import { createComponentEnv, type ArgList, type ComponentImpl } from "../components/component.js";
import { type TermValue } from "../types/value.js";
import {
  andComp,
  cartesianRef,
  compressRef,
  concat,
  cons,
  containsRef,
  createPair,
  createPairIntInt,
  dec,
  dropLastRef,
  equal,
  evensRef,
  fComp,
  head,
  inc,
  insertRef,
  isNil,
  isNonNeg,
  isNull,
  isZero,
  lastInListRef,
  lengthRef,
  listIntType,
  maxInListRef,
  neg,
  nil,
  notComp,
  orComp,
  reverseRef,
  shiftLeftRef,
  standardListComponents,
  stutterRef,
  tComp,
  tail,
  zero,
} from "./common-comps-list.js";
import {
  div,
  div2,
  fibRef,
  modulo,
  plus,
  squareListRef,
  sumUnderRef,
  times,
} from "./common-comps-int.js";
import { findByValueRef, nthNextRef } from "./common-comps-refsyn.js";
import {
  createLeaf,
  createNode,
  flattenTreeRef,
  isLeaf,
  nodesAtLevelRef,
  tConcatRef,
  treeLeft,
  treeRight,
  treeTag,
} from "./common-comps-tree.js";

export const buildComponentEnv = (components: readonly ComponentImpl[]): ReadonlyMap<string, ComponentImpl> =>
  createComponentEnv(components);

export const typedEscherStandardComponents = [
  ...standardListComponents,
  plus,
  div2,
  createLeaf,
  createNode,
  isLeaf,
  treeTag,
  treeLeft,
  treeRight,
] as const;

export const extendedStandardComponents = [
  ...typedEscherStandardComponents,
  containsRef,
  insertRef,
  dropLastRef,
  evensRef,
  lengthRef,
  times,
  div,
  modulo,
  createPair,
] as const;

const commonComponentSets = {
  "standard-list": standardListComponents,
  "typed-escher-standard": typedEscherStandardComponents,
  "extended-standard": extendedStandardComponents,
} as const satisfies Readonly<Record<string, readonly ComponentImpl[]>>;

export type CommonComponentSetName = keyof typeof commonComponentSets;

export const listDomainComponents = [
  ...standardListComponents,
  reverseRef,
  stutterRef,
  compressRef,
  containsRef,
  insertRef,
  dropLastRef,
  evensRef,
  lengthRef,
  lastInListRef,
  shiftLeftRef,
  maxInListRef,
  createPair,
  cartesianRef,
] as const;

export const integerDomainComponents = [
  isZero,
  isNonNeg,
  zero,
  inc,
  dec,
  neg,
  plus,
  times,
  div,
  div2,
  modulo,
  squareListRef,
  sumUnderRef,
  fibRef,
] as const;

export const treeDomainComponents = [
  createLeaf,
  createNode,
  isLeaf,
  treeTag,
  treeLeft,
  treeRight,
  flattenTreeRef,
  nodesAtLevelRef,
  tConcatRef,
] as const;

export const refsynDomainComponents = [
  nthNextRef,
  findByValueRef,
] as const;

const commonComponentDomains = {
  lists: listDomainComponents,
  integers: integerDomainComponents,
  trees: treeDomainComponents,
  refsyn: refsynDomainComponents,
} as const satisfies Readonly<Record<string, readonly ComponentImpl[]>>;

export type CommonComponentDomainName = keyof typeof commonComponentDomains;

const benchmarkComponentPresets = {
  reverse: [isNil, head, tail, cons, nil, concat],
  length: [isNil, head, tail, cons, nil, zero, inc],
  compress: [isNil, head, tail, cons, nil, equal],
  stutter: [isNil, head, tail, cons, nil],
  squareList: [isNonNeg, neg, dec, times, cons, nil, concat],
  insert: [isNil, isNonNeg, head, tail, cons, dec, neg, orComp],
  lastInList: [isNil, head, tail],
  cartesian: [isNil, head, tail, cons, nil, concat, createPairIntInt, orComp],
  fib: [isZero, isNonNeg, zero, inc, dec, neg, plus],
  sumUnder: [isZero, isNonNeg, zero, inc, dec, neg, plus],
  dropLast: [isNil, head, tail, cons, nil],
  evens: [isNil, head, tail, cons, nil],
  shiftLeft: [isNil, head, tail, cons, nil, concat],
  maxInList: [isNil, isNonNeg, head, tail, plus, neg, zero],
  flattenTree: [isLeaf, treeTag, treeLeft, treeRight, cons, nil, concat],
  tConcat: [isLeaf, treeTag, treeLeft, treeRight, createLeaf, createNode],
  nodesAtLevel: [isLeaf, isZero, isNonNeg, treeTag, treeLeft, treeRight, plus, dec, zero, cons, nil, concat],
} as const satisfies Readonly<Record<string, readonly ComponentImpl[]>>;

export type BenchmarkComponentPresetName = keyof typeof benchmarkComponentPresets;

export const listCommonComponentSets = (): readonly CommonComponentSetName[] =>
  Object.keys(commonComponentSets) as CommonComponentSetName[];

export const getCommonComponents = (setName: CommonComponentSetName): readonly ComponentImpl[] =>
  commonComponentSets[setName];

export const createCommonComponentEnv = (setName: CommonComponentSetName): ReadonlyMap<string, ComponentImpl> =>
  createComponentEnv(getCommonComponents(setName));

export const listCommonComponentDomains = (): readonly CommonComponentDomainName[] =>
  Object.keys(commonComponentDomains) as CommonComponentDomainName[];

export const getCommonComponentsByDomain = (domainName: CommonComponentDomainName): readonly ComponentImpl[] =>
  commonComponentDomains[domainName];

export const createCommonComponentEnvByDomain = (
  domainName: CommonComponentDomainName,
): ReadonlyMap<string, ComponentImpl> => createComponentEnv(getCommonComponentsByDomain(domainName));

export const listBenchmarkComponentPresets = (): readonly BenchmarkComponentPresetName[] =>
  Object.keys(benchmarkComponentPresets) as BenchmarkComponentPresetName[];

export const getBenchmarkPresetComponents = (
  presetName: BenchmarkComponentPresetName,
): readonly ComponentImpl[] => benchmarkComponentPresets[presetName];

export const createBenchmarkPresetEnv = (presetName: BenchmarkComponentPresetName): ReadonlyMap<string, ComponentImpl> =>
  createComponentEnv(getBenchmarkPresetComponents(presetName));

export const oracleFromComponent = (component: ComponentImpl) => (args: ArgList): TermValue => component.executeEfficient(args);

export {
  andComp,
  cartesianRef,
  compressRef,
  concat,
  cons,
  containsRef,
  createLeaf,
  createNode,
  createPair,
  createPairIntInt,
  dec,
  div,
  div2,
  dropLastRef,
  equal,
  evensRef,
  fComp,
  fibRef,
  flattenTreeRef,
  findByValueRef,
  head,
  inc,
  insertRef,
  isLeaf,
  isNil,
  isNonNeg,
  isNull,
  isZero,
  lastInListRef,
  lengthRef,
  listIntType,
  maxInListRef,
  modulo,
  neg,
  nil,
  nthNextRef,
  nodesAtLevelRef,
  notComp,
  orComp,
  plus,
  reverseRef,
  shiftLeftRef,
  squareListRef,
  standardListComponents,
  stutterRef,
  sumUnderRef,
  tComp,
  tConcatRef,
  tail,
  times,
  treeLeft,
  treeRight,
  treeTag,
  zero,
};
