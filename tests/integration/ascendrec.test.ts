import { describe, expect, it } from "vitest";
import { anyArgSmaller, ComponentImpl, recursiveImpl } from "../../src/components/component.js";
import { showTerm, type Term, varTerm } from "../../src/types/term.js";
import { tyInt, tyList, typeVar } from "../../src/types/type.js";
import { type TermValue, valueError, valueInt, valueList } from "../../src/types/value.js";
import { AscendRecSynthesizer } from "../../src/synthesis/ascendrec/synthesizer.js";
import { createLengthComponents } from "../helpers/length-fixture.js";

describe("ascendrec synthesizer", () => {
  it("synthesizes recursive length without oracle", () => {
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

    const synth = new AscendRecSynthesizer({
      maxCost: 10,
      searchSizeFactor: 3,
      timeoutMs: 10000,
      argListCompare: anyArgSmaller,
    });
    const result = synth.synthesize("length", [tyList(typeVar(0))], ["xs"], tyInt, env, examples);

    expect(result).not.toBeNull();
    expect(result?.program.cost).toBeLessThanOrEqual(10);

    const impl = recursiveImpl(result!.program.signature, env, anyArgSmaller, result!.program.body);
    expect(impl.executeEfficient([valueList([valueInt(8), valueInt(9)])])).toEqual(valueInt(2));
    expect(showTerm(result!.program.body)).toContain("if");
  });

  it("returns direct goal hit in only-forward mode", () => {
    const synth = new AscendRecSynthesizer({
      maxCost: 2,
      onlyForwardSearch: true,
      timeoutMs: 10000,
    });
    const examples: readonly (readonly [readonly TermValue[], TermValue])[] = [
      [[valueInt(1)], valueInt(1)],
      [[valueInt(2)], valueInt(2)],
    ];

    const result = synth.synthesize("id", [tyInt], ["x"], tyInt, new Map(), examples);
    expect(result).not.toBeNull();
    expect(result?.program.body).toEqual(varTerm("x"));
    expect(result?.program.cost).toBe(1);
  });

  it("does not prune known non-rec terms by reduction rules", () => {
    const incAlwaysReducible = new ComponentImpl(
      "inc",
      [tyInt],
      tyInt,
      (args) => {
        const x = args[0];
        return x?.tag === "int" ? valueInt(x.value + 1) : valueError;
      },
      true,
      () => true,
    );

    const synth = new AscendRecSynthesizer({
      maxCost: 3,
      timeoutMs: 10000,
      onlyForwardSearch: true,
    });
    const examples: readonly (readonly [readonly TermValue[], TermValue])[] = [
      [[valueInt(1)], valueInt(2)],
    ];

    const result = synth.synthesize("f", [tyInt], ["x"], tyInt, new Map([["inc", incAlwaysReducible]]), examples);
    expect(result).not.toBeNull();
  });

  it("can disable reduction rules", () => {
    const incAlwaysReducible = new ComponentImpl(
      "inc",
      [tyInt],
      tyInt,
      (args) => {
        const x = args[0];
        return x?.tag === "int" ? valueInt(x.value + 1) : valueError;
      },
      true,
      () => true,
    );

    const synth = new AscendRecSynthesizer({
      maxCost: 3,
      timeoutMs: 10000,
      onlyForwardSearch: true,
      useReductionRules: false,
    });
    const examples: readonly (readonly [readonly TermValue[], TermValue])[] = [
      [[valueInt(1)], valueInt(2)],
    ];

    const result = synth.synthesize("f", [tyInt], ["x"], tyInt, new Map([["inc", incAlwaysReducible]]), examples);
    expect(result).not.toBeNull();
  });

  it("does not prune known non-rec terms via external reduction rules map", () => {
    const incNoInternalRule = new ComponentImpl(
      "inc",
      [tyInt],
      tyInt,
      (args) => {
        const x = args[0];
        return x?.tag === "int" ? valueInt(x.value + 1) : valueError;
      },
      true,
      null,
    );
    const synth = new AscendRecSynthesizer({
      maxCost: 3,
      timeoutMs: 10000,
      onlyForwardSearch: true,
      useReductionRules: true,
    });
    const examples: readonly (readonly [readonly TermValue[], TermValue])[] = [
      [[valueInt(1)], valueInt(2)],
    ];
    const reductionRules = new Map<string, (args: readonly Term[]) => boolean>([
      ["inc", () => true],
    ]);

    const result = synth.synthesize("f", [tyInt], ["x"], tyInt, new Map([["inc", incNoInternalRule]]), examples, reductionRules);
    expect(result).not.toBeNull();
  });

  it("returns null immediately when timeout is reached", () => {
    const synth = new AscendRecSynthesizer({
      maxCost: 20,
      timeoutMs: 0,
    });
    const result = synth.synthesize("id", [tyInt], ["x"], tyInt, new Map(), [[[valueInt(1)], valueInt(1)]]);
    expect(result).toBeNull();
  });

  it("honors deleteAllErr toggle for all-error vectors", () => {
    const alwaysErr = new ComponentImpl("alwaysErr", [], tyInt, () => valueError);
    const examples: readonly (readonly [readonly TermValue[], TermValue])[] = [
      [[], valueError],
    ];

    const strictSynth = new AscendRecSynthesizer({
      maxCost: 1,
      onlyForwardSearch: true,
      deleteAllErr: true,
    });
    const strict = strictSynth.synthesize("f", [], [], tyInt, new Map([["alwaysErr", alwaysErr]]), examples);
    expect(strict).toBeNull();

    const relaxedSynth = new AscendRecSynthesizer({
      maxCost: 1,
      onlyForwardSearch: true,
      deleteAllErr: false,
    });
    const relaxed = relaxedSynth.synthesize("f", [], [], tyInt, new Map([["alwaysErr", alwaysErr]]), examples);
    expect(relaxed).not.toBeNull();
  });
});
