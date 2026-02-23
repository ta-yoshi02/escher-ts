import { describe, expect, it } from "vitest";
import {
  compareTermValue,
  matchType,
  smallerThan,
  valueBool,
  valueInt,
  valueList,
  valuePair,
} from "../../../src/types/value.js";
import { TypeSubst, tyBool, tyInt, tyList, typeVar } from "../../../src/types/type.js";

describe("value migration", () => {
  it("matches primitive and list types", () => {
    expect(matchType(valueInt(1), tyInt, 1)?.subst.equals(TypeSubst.empty)).toBe(true);
    expect(matchType(valueBool(true), tyBool, 1)?.subst.equals(TypeSubst.empty)).toBe(true);

    const matched = matchType(valueList([valueInt(1), valueInt(2)]), tyList(typeVar(0)), 1);
    expect(matched?.subst.equals(new TypeSubst([[0, tyInt]]))).toBe(true);
  });

  it("supports var target list inference", () => {
    const matched = matchType(valueList([valueBool(true)]), typeVar(0), 5);
    expect(matched?.subst.equals(new TypeSubst([[0, tyList(tyBool)], [5, tyBool]]))).toBe(true);
  });

  it("keeps size ordering semantics", () => {
    expect(smallerThan(valueInt(2), valueInt(10))).toBe(true);
    expect(smallerThan(valueList([valueInt(1)]), valueList([valueInt(1), valueInt(2)]))).toBe(true);
    expect(smallerThan(valuePair(valueInt(1), valueInt(9)), valuePair(valueInt(2), valueInt(1)))).toBe(true);
  });

  it("provides deterministic total ordering for term values", () => {
    expect(compareTermValue(valueBool(false), valueBool(true))).toBeLessThan(0);
    expect(compareTermValue(valueInt(2), valueInt(10))).toBeLessThan(0);
    expect(compareTermValue(valueList([valueInt(1)]), valueList([valueInt(1), valueInt(2)]))).toBeLessThan(0);
  });
});
