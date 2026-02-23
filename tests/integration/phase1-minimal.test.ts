import { describe, expect, it } from "vitest";
import { valueInt, valueList } from "../../src/types/value.js";
import { createLengthProgram } from "../helpers/length-fixture.js";

describe("phase1 minimal migration", () => {
  it("builds a typed recursive length component end-to-end", () => {
    const length = createLengthProgram();

    const cases = [
      [valueList([]), valueInt(0)],
      [valueList([valueInt(5)]), valueInt(1)],
      [valueList([valueInt(1), valueInt(2), valueInt(3)]), valueInt(3)],
    ] as const;

    for (const [input, expected] of cases) {
      expect(length.executeEfficient([input])).toEqual(expected);
    }
  });
});
