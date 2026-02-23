import { describe, expect, it } from "vitest";
import { type Term, varTerm } from "../../../src/types/term.js";
import { valueError, valueInt, valueUnknown } from "../../../src/types/value.js";
import { tyInt } from "../../../src/types/type.js";
import { fromImplOnTermValue } from "../../../src/synthesis/ascendrec/extended-component.js";
import { createKnownMapRecursiveComponent } from "../../../src/synthesis/ascendrec/known-map-recursive.js";

describe("ascendrec extended components", () => {
  it("propagates unknown and error like Scala ExtendedCompImpl", () => {
    const plus1 = fromImplOnTermValue("plus1", [tyInt], tyInt, (args) => {
      const x = args[0];
      if (x?.tag !== "int") {
        return valueError;
      }
      return valueInt(x.value + 1);
    });

    expect(plus1.execute([valueUnknown])).toEqual(valueUnknown);
    expect(plus1.execute([valueError])).toEqual(valueError);
    expect(plus1.execute([valueInt(3)])).toEqual(valueInt(4));
  });

  it("builds oracle-free recursive stub from known examples", () => {
    const rec = createKnownMapRecursiveComponent(
      "f",
      [tyInt],
      tyInt,
      [
        [[valueInt(0)], valueInt(10)],
        [[valueInt(1)], valueInt(20)],
      ],
    );

    expect(rec.execute([valueInt(0)])).toEqual(valueInt(10));
    expect(rec.execute([valueInt(1)])).toEqual(valueInt(20));
    expect(rec.execute([valueInt(2)])).toEqual(valueUnknown);
  });

  it("keeps isReducible predicate", () => {
    const reducible = (args: readonly Term[]) =>
      args.length === 1 && args[0]?.kind === "var" && args[0].name === "x";

    const comp = fromImplOnTermValue("id", [tyInt], tyInt, (args) => args[0] ?? valueError, reducible);
    expect(comp.isReducible).not.toBeNull();
    expect(comp.isReducible?.([varTerm("x")])).toBe(true);
    expect(comp.isReducible?.([varTerm("y")])).toBe(false);
  });
});
