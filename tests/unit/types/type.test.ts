import { describe, expect, it } from "vitest";
import {
  TypeSubst,
  alphaNormalForm,
  canAppearIn,
  instanceOfType,
  tyBool,
  tyInt,
  tyList,
  tyMap,
  tyPair,
  typeFixedVar,
  typeVar,
  unify,
} from "../../../src/types/type.js";

describe("type migration", () => {
  it("unifies representative cases", () => {
    expect(unify(typeVar(1), tyInt)?.equals(new TypeSubst([[1, tyInt]]))).toBe(true);
    expect(unify(tyList(typeVar(0)), tyList(tyInt))?.equals(new TypeSubst([[0, tyInt]]))).toBe(true);
    expect(unify(tyMap(typeVar(0), typeVar(0)), tyMap(tyInt, tyBool))).toBeNull();
  });

  it("keeps alpha-equivalent types equal after normalization", () => {
    const t1 = tyMap(typeVar(1), typeVar(2));
    const t2 = tyMap(typeVar(4), typeVar(1));
    expect(alphaNormalForm(t1)).toEqual(alphaNormalForm(t2));
  });

  it("checks instanceOf and canAppearIn", () => {
    expect(instanceOfType(tyList(tyInt), tyList(typeVar(3)))).toBe(true);
    expect(instanceOfType(tyMap(typeVar(0), typeVar(1)), tyMap(typeVar(2), typeVar(2)))).toBe(false);

    expect(canAppearIn(typeVar(0), tyMap(tyInt, typeVar(1)))).toBe(true);
    expect(canAppearIn(typeFixedVar(0), tyPair(typeFixedVar(0), typeFixedVar(1)))).toBe(true);
    expect(canAppearIn(tyInt, tyList(tyBool))).toBe(false);
  });
});
