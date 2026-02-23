import { describe, expect, it } from "vitest";
import { argList, c, if_, listValue, tyInt, tyList, tyVar, v } from "../../../src/utils/dsl.js";

describe("dsl migration", () => {
  it("builds terms and values", () => {
    const term = if_(c("isNil", v("xs")), c("nil"), c("tail", v("xs")));
    expect(term.kind).toBe("if");

    const values = argList(listValue(), listValue());
    expect(values).toHaveLength(2);

    expect(tyList(tyVar(0))).toEqual(tyList(tyVar(0)));
    expect(tyInt.kind).toBe("apply");
  });
});
