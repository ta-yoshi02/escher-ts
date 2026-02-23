import { describe, expect, it } from "vitest";
import { RebootStrategies } from "../../../src/synthesis/escher/synthesizer.js";
import { valueBool, valueInt } from "../../../src/types/value.js";

describe("typed escher reboot strategies", () => {
  it("addSimplestFailedExample picks the simplest failed input", () => {
    const examples = [[[valueInt(0)], valueBool(true)]] as const;
    const failed = [
      [[valueInt(2)], valueBool(false)],
      [[valueInt(-3)], valueBool(false)],
      [[valueInt(1)], valueBool(false)],
    ] as const;
    const passed = [[[valueInt(9)], valueBool(true)]] as const;

    const [newExamples, newBuffer] = RebootStrategies.addSimplestFailedExample.newExamplesAndOracleBuffer(
      examples,
      failed,
      passed,
    );

    expect(newExamples.at(-1)).toEqual([[valueInt(1)], valueBool(false)]);
    expect(newBuffer).toEqual([
      [[valueInt(2)], valueBool(false)],
      [[valueInt(-3)], valueBool(false)],
      [[valueInt(9)], valueBool(true)],
    ]);
  });

  it("addMostComplicatedFailedExample picks the most complicated failed input", () => {
    const examples = [[[valueInt(0)], valueBool(true)]] as const;
    const failed = [
      [[valueInt(2)], valueBool(false)],
      [[valueInt(-3)], valueBool(false)],
      [[valueInt(1)], valueBool(false)],
    ] as const;
    const passed = [[[valueInt(9)], valueBool(true)]] as const;

    const [newExamples, newBuffer] = RebootStrategies.addMostComplicatedFailedExample.newExamplesAndOracleBuffer(
      examples,
      failed,
      passed,
    );

    expect(newExamples.at(-1)).toEqual([[valueInt(-3)], valueBool(false)]);
    expect(newBuffer).toEqual([
      [[valueInt(9)], valueBool(true)],
      [[valueInt(1)], valueBool(false)],
      [[valueInt(2)], valueBool(false)],
    ]);
  });
});
