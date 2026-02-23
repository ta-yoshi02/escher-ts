import { describe, expect, it } from "vitest";
import { anyArgSmaller, recursiveImpl } from "../../src/components/component.js";
import { showTerm } from "../../src/types/term.js";
import { tyInt, tyList, typeVar } from "../../src/types/type.js";
import { valueInt, valueList, type TermValue } from "../../src/types/value.js";
import { TypedEscherSynthesizer } from "../../src/synthesis/escher/synthesizer.js";
import { createLengthComponents } from "../helpers/length-fixture.js";

describe("typed escher phase3", () => {
  it.each(["then-first", "cond-first"] as const)(
    "synthesizes recursive length from examples (%s)",
    (goalSearchStrategy) => {
    const { isNil, tail, zero, inc } = createLengthComponents();
    const env = new Map([
      ["isNil", isNil],
      ["tail", tail],
      ["zero", zero],
      ["inc", inc],
    ]);

    const examples: readonly (readonly [readonly TermValue[], TermValue])[] = [
      [[valueList([])], valueInt(0)],
      [[valueList([valueInt(4)])], valueInt(1)],
      [[valueList([valueInt(1), valueInt(2), valueInt(3)])], valueInt(3)],
    ];

    const oracle = (args: readonly TermValue[]) => {
      const xs = args[0];
      if (xs?.tag !== "list") {
        return valueInt(0);
      }
      return valueInt(xs.elems.length);
    };

    const synth = new TypedEscherSynthesizer({ maxCost: 9, maxReboots: 3, goalSearchStrategy });
    const result = synth.synthesize("length", [tyList(typeVar(0))], ["xs"], tyInt, env, examples, oracle);

    expect(result).not.toBeNull();
    expect(result?.program.cost).toBeLessThanOrEqual(9);

    const impl = recursiveImpl(result!.program.signature, env, anyArgSmaller, result!.program.body);

    expect(impl.executeEfficient([valueList([valueInt(8), valueInt(9)])])).toEqual(valueInt(2));
    expect(showTerm(result!.program.body)).toContain("if");
    },
  );
});
