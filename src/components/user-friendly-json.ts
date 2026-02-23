import { createComponentEnv, type ComponentDefinition, type ComponentImpl, defineComponents } from "./component.js";
import {
  boolUnary,
  defineUserComponents,
  inferLiteralType,
  intBinary,
  intConst,
  intUnary,
  literalExamples,
  literalToValue,
  valueToLiteral,
  type UserLiteral,
} from "./user-friendly.js";
import { type ArgList } from "./component.js";
import { equalTermValue, type TermValue, valueError, valueObject } from "../types/value.js";
import { equalsType, type Type, tyBool, tyInt, tyList, tyObject, tyPair, tyTree } from "../types/type.js";
import {
  getBenchmarkPresetComponents,
  listBenchmarkComponentPresets,
  listCommonComponentDomains,
  getCommonComponentsByDomain,
} from "../library/common-comps-sets.js";

export interface JsonComponentSpec {
  readonly name: string;
  readonly kind: "intConst" | "intUnary" | "intBinary" | "boolUnary" | "libraryRef";
  readonly value?: number;
  readonly op?: string;
  readonly ref?: string;
}

export interface JsonClassMethodSpec {
  readonly name: string;
  readonly args?: Readonly<Record<string, string>>;
  readonly returnType: string;
  readonly bodyJs: string;
}

export interface JsonClassSpec {
  readonly name: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly methods?: readonly JsonClassMethodSpec[];
}

export interface JsonSynthesisSpec {
  readonly name?: string;
  readonly category?: string;
  readonly classes?: readonly JsonClassSpec[];
  readonly componentsPreset?: string;
  readonly signature?: {
    readonly inputNames: readonly string[];
    readonly inputTypes: readonly string[];
    readonly returnType: string;
  };
  readonly oracle?:
    | {
        readonly kind: "examples";
      }
    | {
        readonly kind: "table";
        readonly entries: readonly (readonly [readonly UserLiteral[], UserLiteral])[];
        readonly default?: UserLiteral | "error";
      }
    | {
        readonly kind: "js";
        readonly args?: readonly string[];
        readonly body: string;
      }
    | {
        readonly kind: "componentRef";
        readonly name: string;
      };
  readonly components: readonly JsonComponentSpec[];
  readonly examples: readonly (readonly [readonly UserLiteral[], UserLiteral])[];
}

const intUnaryOps: Readonly<Record<string, (x: number) => number>> = {
  inc: (x) => x + 1,
  dec: (x) => x - 1,
  neg: (x) => -x,
  abs: (x) => Math.abs(x),
  double: (x) => x * 2,
  square: (x) => x * x,
};

const intBinaryOps: Readonly<Record<string, (x: number, y: number) => number>> = {
  add: (x, y) => x + y,
  sub: (x, y) => x - y,
  mul: (x, y) => x * y,
  max: (x, y) => Math.max(x, y),
  min: (x, y) => Math.min(x, y),
};

const boolUnaryOps: Readonly<Record<string, (x: boolean) => boolean>> = {
  not: (x) => !x,
};

const asString = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
};

const asNumber = (value: unknown, path: string): number => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${path} must be a number`);
  }
  return value;
};

const parseComponent = (spec: JsonComponentSpec, index: number): ComponentDefinition => {
  const path = `components[${index}]`;
  const name = asString(spec.name, `${path}.name`);
  const kind = asString(spec.kind, `${path}.kind`);

  switch (kind) {
    case "intConst":
      return intConst(name, asNumber(spec.value, `${path}.value`));
    case "intUnary": {
      const opName = asString(spec.op, `${path}.op`);
      const op = intUnaryOps[opName];
      if (op === undefined) {
        throw new Error(`${path}.op must be one of: ${Object.keys(intUnaryOps).join(", ")}`);
      }
      return intUnary(name, op);
    }
    case "intBinary": {
      const opName = asString(spec.op, `${path}.op`);
      const op = intBinaryOps[opName];
      if (op === undefined) {
        throw new Error(`${path}.op must be one of: ${Object.keys(intBinaryOps).join(", ")}`);
      }
      return intBinary(name, op);
    }
    case "boolUnary": {
      const opName = asString(spec.op, `${path}.op`);
      const op = boolUnaryOps[opName];
      if (op === undefined) {
        throw new Error(`${path}.op must be one of: ${Object.keys(boolUnaryOps).join(", ")}`);
      }
      return boolUnary(name, op);
    }
    case "libraryRef": {
      const refName = asString(spec.ref, `${path}.ref`);
      const resolved = libraryComponentByName.get(refName);
      if (resolved === undefined) {
        throw new Error(`${path}.ref references unknown library component: ${refName}`);
      }
      return {
        name,
        inputTypes: resolved.inputTypes,
        returnType: resolved.returnType,
        impl: (args) => resolved.executeEfficient(args),
        callByValue: resolved.callByValue,
        isReducible: resolved.isReducible,
      };
    }
    default:
      throw new Error(`${path}.kind must be one of: intConst, intUnary, intBinary, boolUnary, libraryRef`);
  }
};

const buildLibraryComponentByName = (): ReadonlyMap<string, ComponentImpl> => {
  const all = new Map<string, ComponentImpl>();
  for (const domain of listCommonComponentDomains()) {
    for (const comp of getCommonComponentsByDomain(domain)) {
      all.set(comp.name, comp);
    }
  }
  for (const preset of listBenchmarkComponentPresets()) {
    for (const comp of getBenchmarkPresetComponents(preset)) {
      all.set(comp.name, comp);
    }
  }
  return all;
};

const libraryComponentByName = buildLibraryComponentByName();

const ensureSpecShape = (value: unknown): JsonSynthesisSpec => {
  if (typeof value !== "object" || value === null) {
    throw new Error("JSON root must be an object");
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.components)) {
    throw new Error("components must be an array");
  }
  if (!Array.isArray(record.examples)) {
    throw new Error("examples must be an array");
  }
  const name = typeof record.name === "string" ? record.name : undefined;
  const category = typeof record.category === "string" ? record.category : undefined;
  const classes = Array.isArray(record.classes) ? (record.classes as JsonClassSpec[]) : undefined;
  const componentsPreset = typeof record.componentsPreset === "string" ? record.componentsPreset : undefined;
  const signatureRaw =
    typeof record.signature === "object" && record.signature !== null
      ? (record.signature as Record<string, unknown>)
      : undefined;
  const signature =
    signatureRaw === undefined
      ? undefined
      : {
          inputNames: signatureRaw.inputNames as readonly string[],
          inputTypes: signatureRaw.inputTypes as readonly string[],
          returnType: signatureRaw.returnType as string,
        };
  const oracleRaw =
    typeof record.oracle === "object" && record.oracle !== null ? (record.oracle as Record<string, unknown>) : undefined;
  const oracle =
    oracleRaw === undefined
      ? undefined
      : (oracleRaw.kind === "table"
          ? {
              kind: "table" as const,
              entries: oracleRaw.entries as (readonly [readonly UserLiteral[], UserLiteral])[],
              ...(oracleRaw.default !== undefined ? { default: oracleRaw.default as UserLiteral | "error" } : {}),
            }
          : oracleRaw.kind === "js"
            ? {
                kind: "js" as const,
                body: oracleRaw.body as string,
                ...(Array.isArray(oracleRaw.args) ? { args: oracleRaw.args as string[] } : {}),
              }
            : oracleRaw.kind === "componentRef"
              ? {
                  kind: "componentRef" as const,
                  name: oracleRaw.name as string,
                }
          : {
              kind: "examples" as const,
            });

  return {
    ...(name !== undefined ? { name } : {}),
    ...(category !== undefined ? { category } : {}),
    ...(classes !== undefined ? { classes } : {}),
    ...(componentsPreset !== undefined ? { componentsPreset } : {}),
    ...(signature !== undefined ? { signature } : {}),
    ...(oracle !== undefined ? { oracle } : {}),
    components: record.components as JsonComponentSpec[],
    examples: record.examples as (readonly [readonly UserLiteral[], UserLiteral])[],
  };
};

export const parseJsonSynthesisSpec = (jsonText: string): JsonSynthesisSpec =>
  ensureSpecShape(JSON.parse(jsonText) as unknown);

export interface PreparedJsonSpec {
  readonly name: string | undefined;
  readonly components: readonly ComponentImpl[];
  readonly env: ReadonlyMap<string, ComponentImpl>;
  readonly examples: readonly (readonly [ArgList, TermValue])[];
}

export const prepareJsonSynthesisSpec = (spec: JsonSynthesisSpec): PreparedJsonSpec => {
  const presetComponents =
    spec.componentsPreset === undefined
      ? []
      : (() => {
          const known = new Set(listBenchmarkComponentPresets());
          if (!known.has(spec.componentsPreset as (typeof listBenchmarkComponentPresets extends () => readonly (infer T)[] ? T : never))) {
            throw new Error(`Unknown componentsPreset: ${spec.componentsPreset}`);
          }
          return [...getBenchmarkPresetComponents(spec.componentsPreset as never)];
        })();

  const userDefined = defineUserComponents(spec.components.map((component, index) => parseComponent(component, index)));
  const classGenerated = lowerClassSpecsToComponents(spec.classes);
  const components = [...presetComponents, ...classGenerated, ...userDefined];
  return {
    name: spec.name,
    components,
    env: createComponentEnv(components),
    examples: literalExamples(spec.examples),
  };
};

const stripSpaces = (text: string): string => text.replace(/\s+/g, "");

const parseTypeAt = (text: string, start: number): { readonly type: Type; readonly end: number } => {
  const src = stripSpaces(text);
  const consume = (keyword: string, at: number): number => {
    if (!src.startsWith(keyword, at)) {
      throw new Error(`Invalid type expression near '${src.slice(at)}'`);
    }
    return at + keyword.length;
  };
  const parseInner = (pos: number): { readonly type: Type; readonly end: number } => {
    if (src.startsWith("Int", pos)) {
      return { type: tyInt, end: pos + 3 };
    }
    if (src.startsWith("Bool", pos)) {
      return { type: tyBool, end: pos + 4 };
    }
    if (src.startsWith("List[", pos)) {
      const inside = parseInner(pos + 5);
      const end = consume("]", inside.end);
      return { type: tyList(inside.type), end };
    }
    if (src.startsWith("Tree[", pos)) {
      const inside = parseInner(pos + 5);
      const end = consume("]", inside.end);
      return { type: tyTree(inside.type), end };
    }
    if (src.startsWith("Pair[", pos)) {
      const left = parseInner(pos + 5);
      const comma = consume(",", left.end);
      const right = parseInner(comma);
      const end = consume("]", right.end);
      return { type: tyPair(left.type, right.type), end };
    }
    throw new Error(`Unsupported type expression: '${text}'`);
  };
  return parseInner(start);
};

export const parseTypeSpec = (text: string): Type => {
  const src = stripSpaces(text);
  const parsed = parseTypeAt(src, 0);
  if (parsed.end !== src.length) {
    throw new Error(`Invalid trailing type syntax in '${text}'`);
  }
  return parsed.type;
};

const parseTypeSpecWithResolver = (
  text: string,
  resolveNamedType: ((name: string) => Type | null) | undefined,
): Type => {
  const src = stripSpaces(text);
  if (src.startsWith("Object[") && src.endsWith("]")) {
    return tyObject(src.slice("Object[".length, -1));
  }
  try {
    return parseTypeSpec(src);
  } catch {
    const resolved = resolveNamedType?.(src) ?? null;
    if (resolved !== null) {
      return resolved;
    }
    throw new Error(`Unsupported type expression: '${text}'`);
  }
};

const buildClassTypeResolver = (classes: readonly JsonClassSpec[] | undefined) => {
  const map = new Map<string, Type>();
  for (const cls of classes ?? []) {
    map.set(cls.name, tyObject(cls.name));
  }
  return (name: string): Type | null => map.get(name) ?? null;
};

const lowerClassSpecsToComponents = (classes: readonly JsonClassSpec[] | undefined): readonly ComponentImpl[] => {
  if (classes === undefined || classes.length === 0) {
    return [];
  }
  const resolveClassType = buildClassTypeResolver(classes);
  const defs: ComponentDefinition[] = [];

  for (const cls of classes) {
    const className = asString(cls.name, "classes[].name");
    const fields = cls.fields ?? {};
    const fieldNames = Object.keys(fields);
    const fieldTypes = fieldNames.map((f) => parseTypeSpecWithResolver(asString(fields[f], `classes[${className}].fields.${f}`), resolveClassType));
    const selfType = tyObject(className);

    defs.push({
      name: `new_${className}`,
      inputTypes: fieldTypes,
      returnType: selfType,
      impl: (args) => {
        const objFields = Object.fromEntries(fieldNames.map((f, i) => [f, args[i]!] as const));
        return valueObject(className, objFields);
      },
    });

    for (const [i, fieldName] of fieldNames.entries()) {
      defs.push({
        name: `${className}_${fieldName}`,
        inputTypes: [selfType],
        returnType: fieldTypes[i]!,
        impl: ([thisArg]) => {
          if (thisArg === undefined || thisArg.tag !== "object" || thisArg.className !== className) {
            return valueError;
          }
          return thisArg.fields[fieldName] ?? valueError;
        },
      });
    }

    for (const method of cls.methods ?? []) {
      const methodName = asString(method.name, `classes[${className}].methods[].name`);
      const argNames = Object.keys(method.args ?? {});
      const argTypes = argNames.map((argName) =>
        parseTypeSpecWithResolver(
          asString(method.args?.[argName], `classes[${className}].methods[${methodName}].args.${argName}`),
          resolveClassType,
        ),
      );
      const returnType = parseTypeSpecWithResolver(
        asString(method.returnType, `classes[${className}].methods[${methodName}].returnType`),
        resolveClassType,
      );

      const compiledMethods = (cls.methods ?? []).map((m) => {
        const name = asString(m.name, `classes[${className}].methods[].name`);
        const names = Object.keys(m.args ?? {});
        const body = asString(m.bodyJs, `classes[${className}].methods[${name}].bodyJs`);
        return {
          name,
          argNames: names,
          fn: new Function(...names, body) as (...args: unknown[]) => unknown,
        };
      });
      const methodByName = new Map(compiledMethods.map((m) => [m.name, m] as const));

      const invokeClassMethod = (
        targetMethodName: string,
        self: TermValue,
        argsAsLiteral: readonly UserLiteral[],
      ): TermValue => {
        const target = methodByName.get(targetMethodName);
        if (target === undefined || self.tag !== "object" || self.className !== className) {
          return valueError;
        }
        const thisBinding: Record<string, unknown> = {};
        for (const [fieldName, fieldValue] of Object.entries(self.fields)) {
          const asLit = valueToLiteral(fieldValue);
          if (asLit === null) {
            return valueError;
          }
          thisBinding[fieldName] = asLit;
        }
        for (const helper of compiledMethods) {
          thisBinding[helper.name] = (...helperArgs: unknown[]) => {
            const helperLiterals = helperArgs as UserLiteral[];
            const termOut = invokeClassMethod(helper.name, self, helperLiterals);
            const litOut = valueToLiteral(termOut);
            if (litOut === null) {
              throw new Error(`method '${helper.name}' returned non-literal value`);
            }
            return litOut;
          };
        }
        try {
          const out = target.fn.call(thisBinding, ...argsAsLiteral);
          if (out === "error") {
            return valueError;
          }
          return literalToValue(out as UserLiteral);
        } catch {
          return valueError;
        }
      };

      defs.push({
        name: `${className}_${methodName}`,
        inputTypes: [selfType, ...argTypes],
        returnType,
        impl: ([thisArg, ...rest]) => {
          if (thisArg === undefined || thisArg.tag !== "object" || thisArg.className !== className) {
            return valueError;
          }
          const literalArgs = rest.map((arg) => valueToLiteral(arg));
          if (literalArgs.some((arg) => arg === null)) {
            return valueError;
          }
          return invokeClassMethod(methodName, thisArg, literalArgs as UserLiteral[]);
        },
      });
    }
  }

  return defineComponents(defs);
};

const createOracleFromExamples = (examples: readonly (readonly [ArgList, TermValue])[]) => (args: ArgList): TermValue => {
  const hit = examples.find(
    ([input]) =>
      input.length === args.length && input.every((v, idx) => equalTermValue(v, args[idx]!)),
  );
  return hit === undefined ? valueError : hit[1];
};

const createOracleFromTable = (
  entries: readonly (readonly [ArgList, TermValue])[],
  defaultOut: TermValue,
) => (args: ArgList): TermValue => {
  const hit = entries.find(
    ([input]) =>
      input.length === args.length && input.every((v, idx) => equalTermValue(v, args[idx]!)),
  );
  return hit === undefined ? defaultOut : hit[1];
};

const createOracleFromJs = (args: readonly string[] | undefined, body: string) => {
  const argNames = args ?? ["args"];
  const fn = new Function(...argNames, body) as (...argv: unknown[]) => unknown;
  return (termArgs: ArgList): TermValue => {
    const literalArgs = termArgs.map((arg) => valueToLiteral(arg));
    if (literalArgs.some((arg) => arg === null)) {
      return valueError;
    }

    try {
      const resolved = literalArgs as UserLiteral[];
      const callArgs = args === undefined ? [resolved] : resolved;
      const out = fn(...callArgs);
      if (out === "error") {
        return valueError;
      }
      return literalToValue(out as UserLiteral);
    } catch {
      return valueError;
    }
  };
};

export interface PreparedJsonSynthesisJob extends PreparedJsonSpec {
  readonly functionName: string;
  readonly inputNames: readonly string[];
  readonly inputTypes: readonly Type[];
  readonly returnType: Type;
  readonly oracle: (args: ArgList) => TermValue;
}

const inferSignatureFromExamples = (
  examples: readonly (readonly [readonly UserLiteral[], UserLiteral])[],
): { readonly inputNames: readonly string[]; readonly inputTypes: readonly Type[]; readonly returnType: Type } => {
  if (examples.length === 0) {
    throw new Error("Cannot infer signature without examples");
  }
  const [firstArgs, firstOut] = examples[0]!;
  const inputTypes = firstArgs.map((arg) => inferLiteralType(arg));
  const returnType = inferLiteralType(firstOut);
  const inputNames = inputTypes.map((_, i) => `x${i}`);

  for (const [args, out] of examples) {
    if (args.length !== inputTypes.length) {
      throw new Error("All examples must have the same number of input arguments");
    }
    args.forEach((arg, i) => {
      const inferred = inferLiteralType(arg);
      if (!equalsType(inferred, inputTypes[i]!)) {
        throw new Error(`Inconsistent input type at position ${i}`);
      }
    });
    const outType = inferLiteralType(out);
    if (!equalsType(outType, returnType)) {
      throw new Error("Inconsistent output type across examples");
    }
  }

  return { inputNames, inputTypes, returnType };
};

export const prepareJsonSynthesisJob = (spec: JsonSynthesisSpec): PreparedJsonSynthesisJob => {
  const prepared = prepareJsonSynthesisSpec(spec);
  const resolveClassType = buildClassTypeResolver(spec.classes);
  const signature =
    spec.signature === undefined
      ? inferSignatureFromExamples(spec.examples)
      : (() => {
          if (!Array.isArray(spec.signature.inputNames) || !Array.isArray(spec.signature.inputTypes)) {
            throw new Error("signature.inputNames and signature.inputTypes must be arrays");
          }
          if (spec.signature.inputNames.length !== spec.signature.inputTypes.length) {
            throw new Error("signature.inputNames and signature.inputTypes must have the same length");
          }
          const inputNames = spec.signature.inputNames.map((n, i) => asString(n, `signature.inputNames[${i}]`));
          const inputTypes = spec.signature.inputTypes.map((t, i) =>
            parseTypeSpecWithResolver(asString(t, `signature.inputTypes[${i}]`), resolveClassType),
          );
          const returnType = parseTypeSpecWithResolver(
            asString(spec.signature.returnType, "signature.returnType"),
            resolveClassType,
          );
          return { inputNames, inputTypes, returnType };
        })();

  const oracle =
    spec.oracle?.kind === "table"
      ? createOracleFromTable(
          literalExamples(spec.oracle.entries),
          spec.oracle.default === undefined || spec.oracle.default === "error" ? valueError : literalToValue(spec.oracle.default),
        )
      : spec.oracle?.kind === "js"
        ? createOracleFromJs(spec.oracle.args, asString(spec.oracle.body, "oracle.body"))
      : spec.oracle?.kind === "componentRef"
        ? (() => {
            const refName = asString(spec.oracle.name, "oracle.name");
            const comp = libraryComponentByName.get(refName);
            if (comp === undefined) {
              throw new Error(`Unknown oracle component: ${refName}`);
            }
            return (args: ArgList) => comp.executeEfficient(args);
          })()
      : createOracleFromExamples(prepared.examples);

  return {
    ...prepared,
    functionName: prepared.name ?? "synthesized",
    inputNames: signature.inputNames,
    inputTypes: signature.inputTypes,
    returnType: signature.returnType,
    oracle,
  };
};
