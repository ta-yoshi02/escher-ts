# Component 定義ガイド

このプロジェクトでは、合成タスクを JSON から定義できるようにするため、
コンポーネント API を `src/components/` と `src/library/` に分離しています。

## 1. TypeScript で直接コンポーネントを作る

```ts
import { createComponentEnv, defineComponent, tyInt, valueError, valueInt } from "escher-ts";

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

## 2. 既存ライブラリを使う

```ts
import { createBenchmarkPresetEnv, createCommonComponentEnv, createCommonComponentEnvByDomain } from "escher-ts";

const fullEnv = createCommonComponentEnv("typed-escher-standard");
const listOnlyEnv = createCommonComponentEnvByDomain("lists");
const reversePreset = createBenchmarkPresetEnv("reverse");
```

## 3. 複数の環境を合成する

```ts
import { mergeComponentEnvs } from "escher-ts";

const merged = mergeComponentEnvs(fullEnv, reversePreset);
```

`mergeComponentEnvs` は重複名があると例外を投げます。

## 4. JSON からコンポーネントを定義する

`src/components/user-friendly-json.ts` は以下の `kind` をサポートします。

- `intConst`
- `intUnary` (`inc|dec|neg|abs|double|square`)
- `intBinary` (`add|sub|mul|max|min`)
- `boolUnary` (`not`)
- `libraryRef`
- `js`

例:

```json
{
  "name": "nextOf",
  "kind": "js",
  "inputTypes": ["List[Object[DLNode]]", "List[Int]", "List[Object[DLNode]]", "List[Object[DLNode]]", "Ref[Object[DLNode]]"],
  "returnType": "Ref[Object[DLNode]]",
  "args": ["nodeHeap", "valueHeap", "nextHeap", "prevHeap", "thisRef"],
  "bodyJs": "/* UserLiteral を返す */"
}
```

## 5. クラス定義との連携

`classes` セクションを JSON に書くと次を自動生成できます。

- `new_<ClassName>`
- `<ClassName>_<fieldName>`
- `<ClassName>_<methodName>`

`exposeClassComponents: false` を指定すると自動生成を止め、型情報だけを使えます。

## 6. 実装ファイルの責務

- `src/components/component.ts`
  - `ComponentImpl` / `defineComponent` / `createComponentEnv`
- `src/components/user-friendly.ts`
  - UserLiteral と TypeScript API の橋渡し
- `src/components/user-friendly-json.ts`
  - JSON spec の parse/prepare
- `src/library/common-comps-*.ts`
  - 共通コンポーネント本体
- `src/library/common-comps-sets.ts`
  - ドメイン別・プリセット別の公開セット
