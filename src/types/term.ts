import { type TermValue, valueError } from "./value.js";

export interface VarTerm {
  readonly kind: "var";
  readonly name: string;
}

export interface ComponentTerm {
  readonly kind: "component";
  readonly name: string;
  readonly args: readonly Term[];
}

export interface IfTerm {
  readonly kind: "if";
  readonly condition: Term;
  readonly thenBranch: Term;
  readonly elseBranch: Term;
}

export type Term = VarTerm | ComponentTerm | IfTerm;

export const varTerm = (name: string): VarTerm => ({ kind: "var", name });
export const componentTerm = (name: string, args: readonly Term[]): ComponentTerm => ({ kind: "component", name, args });
export const ifTerm = (condition: Term, thenBranch: Term, elseBranch: Term): IfTerm => ({
  kind: "if",
  condition,
  thenBranch,
  elseBranch,
});

export const showTerm = (term: Term): string => {
  switch (term.kind) {
    case "var":
      return `@${term.name}`;
    case "component":
      return `${term.name}(${term.args.map(showTerm).join(", ")})`;
    case "if":
      return `if ${showTerm(term.condition)} then ${showTerm(term.thenBranch)} else ${showTerm(term.elseBranch)}`;
  }
};

const termKind = (term: Term): number => {
  switch (term.kind) {
    case "var":
      return 0;
    case "component":
      return 1;
    case "if":
      return 2;
  }
};

const termsLt = (terms1: readonly Term[], terms2: readonly Term[]): boolean => {
  if (terms1.length !== terms2.length) {
    throw new Error("termsLt requires equal length term lists");
  }

  for (let i = 0; i < terms1.length; i += 1) {
    if (termLt(terms2[i]!, terms1[i]!)) {
      return false;
    }
    if (termLt(terms1[i]!, terms2[i]!)) {
      return true;
    }
  }
  return false;
};

export const termLt = (t1: Term, t2: Term): boolean => {
  if (t1.kind === "var" && t2.kind === "var") {
    return t1.name < t2.name;
  }

  if (t1.kind === "component" && t2.kind === "component") {
    return t1.name < t2.name || (t1.name === t2.name && termsLt(t1.args, t2.args));
  }

  if (t1.kind === "if" && t2.kind === "if") {
    return termsLt([t1.condition, t1.thenBranch, t1.elseBranch], [t2.condition, t2.thenBranch, t2.elseBranch]);
  }

  return termKind(t1) < termKind(t2);
};

export interface ExecutableComponent {
  executeEfficient(args: readonly TermValue[]): TermValue;
}

export type VarResolver = (name: string) => TermValue;

export const executeTerm = (
  varMap: VarResolver,
  compMap: ReadonlyMap<string, ExecutableComponent>,
  term: Term,
): TermValue => {
  switch (term.kind) {
    case "var":
      return varMap(term.name);
    case "component": {
      const args = term.args.map((arg) => executeTerm(varMap, compMap, arg));
      const comp = compMap.get(term.name);
      if (comp === undefined) {
        throw new Error(`component '${term.name}' not in scope`);
      }
      return comp.executeEfficient(args);
    }
    case "if": {
      const cond = executeTerm(varMap, compMap, term.condition);
      if (cond.tag === "error") {
        return valueError;
      }
      if (cond.tag !== "bool") {
        return valueError;
      }
      return cond.value
        ? executeTerm(varMap, compMap, term.thenBranch)
        : executeTerm(varMap, compMap, term.elseBranch);
    }
  }
};

export const executeTermDebug = (
  varMap: ReadonlyMap<string, TermValue>,
  compMap: ReadonlyMap<string, ExecutableComponent>,
  term: Term,
): TermValue => {
  const resolver: VarResolver = (name) => varMap.get(name) ?? valueError;
  return executeTerm(resolver, compMap, term);
};
