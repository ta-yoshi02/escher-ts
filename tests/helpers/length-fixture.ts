import {
  ComponentImpl,
  anyArgSmaller,
  recursiveImpl,
  c,
  if_,
  tyBool,
  tyInt,
  tyList,
  tyVar,
  v,
  valueBool,
  valueError,
  valueInt,
  valueList,
} from "../../src/index.js";

export const createLengthComponents = () => {
  const isNil = new ComponentImpl("isNil", [tyList(tyVar(0))], tyBool, (args) => {
    const xs = args[0];
    return xs?.tag === "list" ? valueBool(xs.elems.length === 0) : valueError;
  });

  const tail = new ComponentImpl("tail", [tyList(tyVar(0))], tyList(tyVar(0)), (args) => {
    const xs = args[0];
    if (xs?.tag !== "list" || xs.elems.length === 0) {
      return valueError;
    }
    return valueList(xs.elems.slice(1));
  });

  const zero = new ComponentImpl("zero", [], tyInt, () => valueInt(0));

  const inc = new ComponentImpl("inc", [tyInt], tyInt, (args) => {
    const x = args[0];
    return x?.tag === "int" ? valueInt(x.value + 1) : valueError;
  });

  return { isNil, tail, zero, inc };
};

export const createLengthProgram = () => {
  const { isNil, tail, zero, inc } = createLengthComponents();

  return recursiveImpl(
    {
      name: "length",
      argNames: ["xs"],
      inputTypes: [tyList(tyVar(0))],
      returnType: tyInt,
    },
    new Map([
      ["isNil", isNil],
      ["tail", tail],
      ["zero", zero],
      ["inc", inc],
    ]),
    anyArgSmaller,
    if_(c("isNil", v("xs")), c("zero"), c("inc", c("length", c("tail", v("xs"))))),
  );
};
