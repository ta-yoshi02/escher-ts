# Component API

This project provides a small public API so users can define components outside the synthesizer internals.

## 1. Define Custom Components

Use `defineComponent` for one component, then `createComponentEnv` for the synthesizer environment.

```ts
import {
  defineComponent,
  createComponentEnv,
  tyInt,
  valueError,
  valueInt,
} from "escher-ts";

const inc = defineComponent({
  name: "inc",
  inputTypes: [tyInt],
  returnType: tyInt,
  impl: (args) => {
    const x = args[0];
    return x?.tag === "int" ? valueInt(x.value + 1) : valueError;
  },
});

const env = createComponentEnv([inc]);
```

## 2. Reuse Built-in Components

You can start from predefined sets/domains.

```ts
import {
  createCommonComponentEnv,
  createCommonComponentEnvByDomain,
} from "escher-ts";

const typedEscherEnv = createCommonComponentEnv("typed-escher-standard");
const listEnv = createCommonComponentEnvByDomain("lists");
```

For benchmark-style experiments, use minimal per-task presets:

```ts
import { createBenchmarkPresetEnv } from "escher-ts";

const reversePresetEnv = createBenchmarkPresetEnv("reverse");
```

## 3. Merge Multiple Environments

Use `mergeComponentEnvs` to compose modular environments.

```ts
import { mergeComponentEnvs } from "escher-ts";

const merged = mergeComponentEnvs(typedEscherEnv, listEnv);
```

`mergeComponentEnvs` throws if duplicate names exist.
