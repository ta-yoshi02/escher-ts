import { type ArgList } from "../../components/component.js";
import { type TermValue } from "../../types/value.js";

const argListKey = (args: readonly TermValue[]): string => args.map((value) => JSON.stringify(value)).join("|");

export class BufferedOracle {
  private readonly knownMap: Map<string, TermValue>;
  private readonly argMap: Map<string, ArgList>;
  private readonly buffer = new Map<string, TermValue>();

  constructor(
    examples: readonly (readonly [ArgList, TermValue])[],
    private readonly oracle: (args: ArgList) => TermValue,
    initBuffer: readonly (readonly [ArgList, TermValue])[],
  ) {
    this.knownMap = new Map<string, TermValue>();
    this.argMap = new Map<string, ArgList>();

    for (const [args, out] of examples) {
      const key = argListKey(args);
      this.knownMap.set(key, out);
      this.argMap.set(key, args);
    }

    for (const [args, out] of initBuffer) {
      const key = argListKey(args);
      this.buffer.set(key, out);
      this.argMap.set(key, args);
    }
  }

  evaluate(args: ArgList): TermValue {
    const key = argListKey(args);
    this.argMap.set(key, args);

    const known = this.knownMap.get(key);
    if (known !== undefined) {
      return known;
    }

    const buffered = this.buffer.get(key);
    if (buffered !== undefined) {
      return buffered;
    }

    const result = this.oracle(args);
    this.buffer.set(key, result);
    return result;
  }

  bufferEntries(): readonly (readonly [ArgList, TermValue])[] {
    return [...this.buffer.entries()].map(([key, value]) => [this.argMap.get(key)!, value] as const);
  }
}
