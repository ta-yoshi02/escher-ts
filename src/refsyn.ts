import { anyArgSmaller } from "./components/component.js";
import { parseJsonSynthesisSpec, prepareJsonSynthesisJob, type JsonSynthesisSpec } from "./components/user-friendly-json.js";
import { AscendRecSynthesizer } from "./synthesis/ascendrec/synthesizer.js";
import { showTerm, type Term } from "./types/term.js";
import { showType, type Type } from "./types/type.js";

export interface RefsynTaskMetaArg {
  readonly name: string;
  readonly legacyType: string;
  readonly taskType: string;
}

export interface RefsynTaskMeta {
  readonly jsMethodName: string;
  readonly className: string;
  readonly thisRefName: string;
  readonly classHeapName: string;
  readonly valueFields: readonly string[];
  readonly pointerFields: readonly string[];
  readonly fieldHeapNames: Readonly<Record<string, string>>;
  readonly explicitArgs: readonly RefsynTaskMetaArg[];
}

export interface RefsynTaskSpec extends JsonSynthesisSpec {
  readonly refsynMeta?: RefsynTaskMeta;
}

export interface RefsynRunOptions {
  readonly quiet?: boolean;
  readonly maxCost?: number;
  readonly timeoutMs?: number | null;
  readonly searchSizeFactor?: number;
}

export interface RefsynRunOutcome {
  readonly name: string;
  readonly success: boolean;
  readonly rendered: string | null;
  readonly error: string | null;
  readonly compiled_js?: string | null;
}

interface CompileArgInfo {
  readonly rawName: string;
  readonly paramName: string;
  readonly taskType: string;
  readonly inputIndex: number;
}

interface CompileContext {
  readonly taskName: string;
  readonly jsMethodName: string;
  readonly thisRefName: string;
  readonly classHeapName: string;
  readonly receiverIndex: number;
  readonly explicitArgs: readonly CompileArgInfo[];
  readonly heapNames: ReadonlySet<string>;
  readonly valueFields: ReadonlySet<string>;
  readonly pointerFields: ReadonlySet<string>;
  readonly primaryValueField: string | null;
  readonly primaryPointerField: string | null;
  readonly returnKind: ExprKind;
}

type ExprKind = "object" | "int" | "bool" | "valueFieldAccess" | "unknown";

interface CompiledExpr {
  readonly code: string;
  readonly kind: ExprKind;
}

const defaultMaxCost = 20;
const defaultTimeoutMs = 2000;
const defaultSearchSizeFactor = 3;

const getProcessEnv = (): Record<string, string | undefined> | undefined => {
  if (typeof process === "undefined" || process === null) {
    return undefined;
  }
  return process.env as Record<string, string | undefined>;
};

const parseEnvInt = (name: string, fallback: number): number => {
  const raw = getProcessEnv()?.[name];
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseEnvNullableInt = (name: string, fallback: number | null): number | null => {
  const raw = getProcessEnv()?.[name];
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  if (raw.trim().toLowerCase() === "null") {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isRefType = (type: Type): boolean =>
  type.kind === "apply" && type.constructor.name === "Ref" && type.params.length === 1;

const isIntType = (type: Type): boolean =>
  type.kind === "apply" && type.constructor.name === "Int" && type.params.length === 0;

const isBoolType = (type: Type): boolean =>
  type.kind === "apply" && type.constructor.name === "Bool" && type.params.length === 0;

const sanitizeJsIdentifier = (raw: string): string => {
  let out = "";
  for (const ch of raw) {
    out += /[A-Za-z0-9_$]/.test(ch) ? ch : "_";
  }
  if (out.length === 0) {
    return "_";
  }
  return /^[0-9]/.test(out) ? `_${out}` : out;
};

const resolveParamName = (raw: string, index: number): string => {
  const sanitized = sanitizeJsIdentifier(raw);
  if (sanitized === "_" || /^_+$/.test(sanitized)) {
    return index === 0 ? "arg" : `arg${index}`;
  }
  if (sanitized === "this") {
    return index === 0 ? "arg_this" : `arg${index}_this`;
  }
  return sanitized;
};

const isValidJsField = (raw: string): boolean => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(raw);

const fieldAccess = (baseExpr: string, field: string): string =>
  isValidJsField(field) ? `(${baseExpr}).${field}` : `(${baseExpr})[${JSON.stringify(field)}]`;

const memberCall = (baseExpr: string, methodName: string, args: readonly string[]): string => {
  const receiver = baseExpr === "this" ? "this" : `(${baseExpr})`;
  return `${receiver}.${methodName}(${args.join(", ")})`;
};

const capitalize = (text: string): string => (text.length === 0 ? text : text[0]!.toUpperCase() + text.slice(1));

const inferReturnKind = (returnType: Type): ExprKind => {
  if (isRefType(returnType)) {
    return "object";
  }
  if (isIntType(returnType)) {
    return "int";
  }
  if (isBoolType(returnType)) {
    return "bool";
  }
  return "unknown";
};

const createCompileContext = (
  rawTask: RefsynTaskSpec,
  job: ReturnType<typeof prepareJsonSynthesisJob>,
): CompileContext => {
  const meta = rawTask.refsynMeta;
  if (meta === undefined) {
    throw new Error(`refsynMeta is required for ${rawTask.name ?? "unnamed task"}`);
  }
  const receiverIndex = job.inputNames.indexOf(meta.thisRefName);
  if (receiverIndex < 0) {
    throw new Error(`receiver input '${meta.thisRefName}' is missing from synthesized signature`);
  }

  const explicitArgs = meta.explicitArgs.map((arg, index) => {
    const inputIndex = job.inputNames.indexOf(arg.name);
    if (inputIndex < 0) {
      throw new Error(`explicit arg '${arg.name}' is missing from synthesized signature`);
    }
    return {
      rawName: arg.name,
      paramName: resolveParamName(arg.name, index),
      taskType: arg.taskType,
      inputIndex,
    } satisfies CompileArgInfo;
  });

  const heapNames = new Set<string>([
    meta.classHeapName,
    ...Object.values(meta.fieldHeapNames ?? {}),
  ]);

  return {
    taskName: rawTask.name ?? "synthesized",
    jsMethodName: meta.jsMethodName,
    thisRefName: meta.thisRefName,
    classHeapName: meta.classHeapName,
    receiverIndex,
    explicitArgs,
    heapNames,
    valueFields: new Set(meta.valueFields ?? []),
    pointerFields: new Set(meta.pointerFields ?? []),
    primaryValueField: meta.valueFields?.[0] ?? null,
    primaryPointerField: meta.pointerFields?.[0] ?? null,
    returnKind: inferReturnKind(job.returnType),
  };
};

const compileVar = (name: string, ctx: CompileContext): CompiledExpr => {
  if (name === ctx.thisRefName) {
    return { code: "this", kind: "object" };
  }

  const explicit = ctx.explicitArgs.find((arg) => arg.rawName === name);
  if (explicit !== undefined) {
    if (explicit.taskType.startsWith("Ref[")) {
      return { code: explicit.paramName, kind: "object" };
    }
    if (explicit.taskType === "Int") {
      return { code: explicit.paramName, kind: "int" };
    }
    if (explicit.taskType === "Bool") {
      return { code: explicit.paramName, kind: "bool" };
    }
    return { code: explicit.paramName, kind: "unknown" };
  }

  if (ctx.heapNames.has(name)) {
    throw new Error(`heap variable '${name}' cannot appear directly in generated JS`);
  }

  throw new Error(`unknown variable '${name}' in generated term`);
};

const compileAutoFieldComponent = (
  name: string,
  args: readonly Term[],
  ctx: CompileContext,
): CompiledExpr | null => {
  for (const field of [...ctx.valueFields, ...ctx.pointerFields]) {
    if (name === `${field}Of`) {
      if (args.length < 2) {
        throw new Error(`${name} expects receiver + heap args`);
      }
      const base = compileExpr(args[0]!, ctx);
      const access = fieldAccess(base.code, field);
      if (ctx.pointerFields.has(field)) {
        return { code: access, kind: "object" };
      }
      return { code: access, kind: "valueFieldAccess" };
    }
    if (name === `has${capitalize(field)}`) {
      if (args.length < 2) {
        throw new Error(`${name} expects receiver + heap args`);
      }
      const base = compileExpr(args[0]!, ctx);
      const access = fieldAccess(base.code, field);
      if (ctx.pointerFields.has(field)) {
        return { code: `${access} !== null`, kind: "bool" };
      }
      return { code: `${access} !== undefined`, kind: "bool" };
    }
  }
  return null;
};

const compileRecursiveCall = (args: readonly Term[], ctx: CompileContext): CompiledExpr => {
  const receiverTerm = args[ctx.receiverIndex];
  if (receiverTerm === undefined) {
    throw new Error(`recursive call is missing receiver arg at index ${ctx.receiverIndex}`);
  }
  const receiver = compileExpr(receiverTerm, ctx);
  if (receiver.kind !== "object") {
    throw new Error("recursive receiver must compile to an object expression");
  }
  const callArgs = ctx.explicitArgs.map((arg) => {
    const term = args[arg.inputIndex];
    if (term === undefined) {
      throw new Error(`recursive call is missing explicit arg '${arg.rawName}'`);
    }
    return compileExpr(term, ctx).code;
  });
  return {
    code: memberCall(receiver.code, ctx.jsMethodName, callArgs),
    kind: ctx.returnKind,
  };
};

const compileComponent = (
  name: string,
  args: readonly Term[],
  ctx: CompileContext,
): CompiledExpr => {
  if (name === ctx.taskName) {
    return compileRecursiveCall(args, ctx);
  }

  const autoField = compileAutoFieldComponent(name, args, ctx);
  if (autoField !== null) {
    return autoField;
  }

  switch (name) {
    case "nthNextRef": {
      if (args.length !== 4) {
        throw new Error("nthNextRef expects 4 args");
      }
      const fieldName = ctx.primaryPointerField;
      if (fieldName === null) {
        throw new Error("nthNextRef requires at least one pointer field");
      }
      const base = compileExpr(args[0]!, ctx);
      const steps = compileExpr(args[3]!, ctx);
      return {
        code:
          `(() => { let __refsynCur = ${base.code}; let __refsynSteps = ${steps.code}; ` +
          `while (__refsynSteps > 0 && __refsynCur !== null) { __refsynCur = ${fieldAccess("__refsynCur", fieldName)}; __refsynSteps -= 1; } ` +
          `return __refsynCur; })()`,
        kind: "object",
      };
    }
    case "findByValueRef": {
      if (args.length !== 5) {
        throw new Error("findByValueRef expects 5 args");
      }
      const pointerField = ctx.primaryPointerField;
      const valueField = ctx.primaryValueField;
      if (pointerField === null || valueField === null) {
        throw new Error("findByValueRef requires one pointer field and one value field");
      }
      const base = compileExpr(args[0]!, ctx);
      const target = compileExpr(args[4]!, ctx);
      return {
        code:
          `(() => { let __refsynCur = ${base.code}; const __refsynTarget = ${target.code}; ` +
          `while (__refsynCur !== null) { if (${fieldAccess("__refsynCur", valueField)} === __refsynTarget) { return __refsynCur; } ` +
          `__refsynCur = ${fieldAccess("__refsynCur", pointerField)}; } return null; })()`,
        kind: "object",
      };
    }
    case "loadInt": {
      if (args.length !== 2) {
        throw new Error("loadInt expects 2 args");
      }
      const refExpr = compileExpr(args[1]!, ctx);
      if (refExpr.kind !== "valueFieldAccess") {
        throw new Error("loadInt is only supported on valueOf(...) expressions in refsyn codegen");
      }
      return { code: refExpr.code, kind: "int" };
    }
    case "isNull": {
      if (args.length !== 1) {
        throw new Error("isNull expects 1 arg");
      }
      const value = compileExpr(args[0]!, ctx);
      return { code: `${value.code} === null`, kind: "bool" };
    }
    case "equal": {
      if (args.length !== 2) {
        throw new Error("equal expects 2 args");
      }
      const left = compileExpr(args[0]!, ctx);
      const right = compileExpr(args[1]!, ctx);
      return { code: `${left.code} === ${right.code}`, kind: "bool" };
    }
    case "and": {
      if (args.length !== 2) {
        throw new Error("and expects 2 args");
      }
      const left = compileExpr(args[0]!, ctx);
      const right = compileExpr(args[1]!, ctx);
      return { code: `${left.code} && ${right.code}`, kind: "bool" };
    }
    case "or": {
      if (args.length !== 2) {
        throw new Error("or expects 2 args");
      }
      const left = compileExpr(args[0]!, ctx);
      const right = compileExpr(args[1]!, ctx);
      return { code: `${left.code} || ${right.code}`, kind: "bool" };
    }
    case "not": {
      if (args.length !== 1) {
        throw new Error("not expects 1 arg");
      }
      const value = compileExpr(args[0]!, ctx);
      return { code: `!(${value.code})`, kind: "bool" };
    }
    case "isZero": {
      if (args.length !== 1) {
        throw new Error("isZero expects 1 arg");
      }
      const value = compileExpr(args[0]!, ctx);
      return { code: `${value.code} === 0`, kind: "bool" };
    }
    case "isNonNeg": {
      if (args.length !== 1) {
        throw new Error("isNonNeg expects 1 arg");
      }
      const value = compileExpr(args[0]!, ctx);
      return { code: `${value.code} >= 0`, kind: "bool" };
    }
    case "inc": {
      if (args.length !== 1) {
        throw new Error("inc expects 1 arg");
      }
      const value = compileExpr(args[0]!, ctx);
      return { code: `${value.code} + 1`, kind: "int" };
    }
    case "dec": {
      if (args.length !== 1) {
        throw new Error("dec expects 1 arg");
      }
      const value = compileExpr(args[0]!, ctx);
      return { code: `${value.code} - 1`, kind: "int" };
    }
    case "neg": {
      if (args.length !== 1) {
        throw new Error("neg expects 1 arg");
      }
      const value = compileExpr(args[0]!, ctx);
      return { code: `-(${value.code})`, kind: "int" };
    }
    case "plus": {
      if (args.length !== 2) {
        throw new Error("plus expects 2 args");
      }
      const left = compileExpr(args[0]!, ctx);
      const right = compileExpr(args[1]!, ctx);
      return { code: `${left.code} + ${right.code}`, kind: "int" };
    }
    case "zero":
      return { code: "0", kind: "int" };
    case "trueConst":
      return { code: "true", kind: "bool" };
    case "falseConst":
      return { code: "false", kind: "bool" };
    case "leInt": {
      if (args.length !== 2) {
        throw new Error("leInt expects 2 args");
      }
      const left = compileExpr(args[0]!, ctx);
      const right = compileExpr(args[1]!, ctx);
      return { code: `${left.code} <= ${right.code}`, kind: "bool" };
    }
    default:
      throw new Error(`unsupported component '${name}' in escher-ts phase1 codegen`);
  }
};

const compileExpr = (term: Term, ctx: CompileContext): CompiledExpr => {
  switch (term.kind) {
    case "var":
      return compileVar(term.name, ctx);
    case "component":
      return compileComponent(term.name, term.args, ctx);
    case "if": {
      const cond = compileExpr(term.condition, ctx);
      const thenExpr = compileExpr(term.thenBranch, ctx);
      const elseExpr = compileExpr(term.elseBranch, ctx);
      return {
        code: `(${cond.code}) ? (${thenExpr.code}) : (${elseExpr.code})`,
        kind: thenExpr.kind === elseExpr.kind ? thenExpr.kind : "unknown",
      };
    }
  }
};

export const compileRefsynMethod = (
  rawTask: RefsynTaskSpec,
  job: ReturnType<typeof prepareJsonSynthesisJob>,
  term: Term,
): string => {
  const ctx = createCompileContext(rawTask, job);
  const expr = compileExpr(term, ctx);
  const params = ctx.explicitArgs.map((arg) => arg.paramName).join(", ");
  return `${ctx.jsMethodName}(${params}) { return ${expr.code}; }`;
};

const renderOutcome = (
  taskName: string,
  inputNames: readonly string[],
  inputTypes: readonly Type[],
  returnType: Type,
  body: Term,
): string =>
  `${taskName}(${inputNames
    .map((name, index) => `@${name}: ${showType(inputTypes[index]!)}`)
    .join(", ")}): ${showType(returnType)} =\n  ${showTerm(body)}`;

export const runRefsynTasks = (
  rawTasks: readonly RefsynTaskSpec[],
  options: RefsynRunOptions = {},
): readonly RefsynRunOutcome[] => {
  const maxCost = options.maxCost ?? parseEnvInt("ESCHER_TS_MAX_COST", defaultMaxCost);
  const timeoutMs = options.timeoutMs ?? parseEnvNullableInt("ESCHER_TS_TIMEOUT_MS", defaultTimeoutMs);
  const searchSizeFactor =
    options.searchSizeFactor ?? parseEnvInt("ESCHER_TS_SEARCH_SIZE_FACTOR", defaultSearchSizeFactor);

  return rawTasks.map((rawTask) => {
    const taskName = rawTask.name ?? "synthesized";
    try {
      const spec = parseJsonSynthesisSpec(JSON.stringify(rawTask));
      const job = prepareJsonSynthesisJob(spec);
      const synth = new AscendRecSynthesizer({
        maxCost,
        timeoutMs,
        searchSizeFactor,
        useReductionRules: true,
        onlyForwardSearch: false,
        argListCompare: anyArgSmaller,
      });
      const result = synth.synthesize(
        job.functionName,
        job.inputTypes,
        job.inputNames,
        job.returnType,
        job.env,
        job.examples,
      );

      if (result === null) {
        return {
          name: taskName,
          success: false,
          rendered: null,
          error: `escher-ts could not synthesize '${taskName}' within the configured budget`,
          compiled_js: null,
        } satisfies RefsynRunOutcome;
      }

      const rendered = renderOutcome(
        taskName,
        job.inputNames,
        job.inputTypes,
        job.returnType,
        result.program.body,
      );
      const compiled = compileRefsynMethod(rawTask, job, result.program.body);
      return {
        name: taskName,
        success: true,
        rendered,
        error: null,
        compiled_js: compiled,
      } satisfies RefsynRunOutcome;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        name: taskName,
        success: false,
        rendered: null,
        error: message,
        compiled_js: null,
      } satisfies RefsynRunOutcome;
    }
  });
};

export const runRefsynTasksJson = (
  jsonText: string,
  options: RefsynRunOptions = {},
): string => {
  const parsed = JSON.parse(jsonText) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("refsyn runner expects a JSON array of task specs");
  }
  const results = runRefsynTasks(parsed as RefsynTaskSpec[], options);
  return JSON.stringify(results);
};
