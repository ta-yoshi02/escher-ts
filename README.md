# escher-ts

Typed Escher / AscendRec 系のプログラム合成器を TypeScript で実装したプロジェクトです。  
現在は **ベンチマーク定義を JSON で外部化** して運用しています。

サンプルタスク:

- `examples/basic/calculator.json`
- `examples/basic/class-point.json`

## セットアップ

```bash
pnpm install
pnpm run typecheck
pnpm test
```

## 主要コマンド

Typed Escher:

```bash
pnpm run benchmark:typed-escher -- --suite paper --maxCost 24 --timeoutMs 10000
```

AscendRec:

```bash
pnpm run benchmark:ascendrec -- --suite paper --maxCost 24 --timeoutMs 10000
```

出力先（デフォルト）:

- `outputs/<suite>-typed-escher-runtime.svg`
- `outputs/<suite>-typed-escher-runtime.csv`
- `outputs/<suite>-typed-escher-programs.md`
- `outputs/<suite>-ascendrec-runtime.svg`
- `outputs/<suite>-ascendrec-runtime.csv`
- `outputs/<suite>-ascendrec-programs.md`

## JSON ベースの合成タスク定義

合成タスクは `examples/benchmarks/*.json` で定義します。

### 最小例

```json
{
  "name": "calc",
  "category": "integers",
  "signature": {
    "inputNames": ["x", "y"],
    "inputTypes": ["Int", "Int"],
    "returnType": "Int"
  },
  "componentsPreset": "fib",
  "oracle": { "kind": "js", "args": ["x", "y"], "body": "return x * 2 + y;" },
  "components": [],
  "examples": [
    [[1, 3], 5],
    [[2, 5], 9],
    [[4, 0], 8]
  ]
}
```

### フィールド

- `name`: タスク名
- `category`: `lists | integers | trees`
- `classes`: ユーザー定義クラス（任意）
- `signature`:
  - `inputNames`: 引数名配列
  - `inputTypes`: 型配列（文字列）
  - `returnType`: 戻り値型（文字列）
- `componentsPreset`: 既存プリセット名（任意）
- `components`: 追加コンポーネント定義（任意）
- `examples`: 入出力例
- `oracle`: オラクル定義（任意、未指定なら examples 由来）

## リテラル記法

`examples` や `oracle` の入出力では以下が使えます。

- Int: `42`
- Bool: `true`
- List: `[1, 2, 3]`
- Pair: `{ "pair": [1, 2] }`
- Tree leaf: `{ "tree": "leaf" }`
- Tree node:
  ```json
  { "tree": { "value": 1, "left": { "tree": "leaf" }, "right": { "tree": "leaf" } } }
  ```
- Error: `{ "error": true }`

## 型記法

- `Int`
- `Bool`
- `List[T]`
- `Pair[A, B]`
- `Tree[T]`

例:

- `List[Int]`
- `Pair[Int, List[Int]]`

## oracle の書き方

### 1. examples 由来（デフォルト）

```json
{ "kind": "examples" }
```

または `oracle` 自体を省略。

### 2. table

```json
{
  "kind": "table",
  "entries": [
    [[1], 10],
    [[2], 20]
  ],
  "default": "error"
}
```

### 3. js

```json
{
  "kind": "js",
  "args": ["x", "y"],
  "body": "return x * 2 + y;"
}
```

`args` を省略した場合、`args` 配列1引数で受け取ります。

### 4. componentRef

```json
{ "kind": "componentRef", "name": "reverse" }
```

既存ライブラリコンポーネントをオラクルとして使います。

## components の書き方

`components` 配列の1要素は次のいずれかです。

- `intConst`:
  ```json
  { "name": "two", "kind": "intConst", "value": 2 }
  ```
- `intUnary`:
  ```json
  { "name": "inc1", "kind": "intUnary", "op": "inc" }
  ```
- `intBinary`:
  ```json
  { "name": "add", "kind": "intBinary", "op": "add" }
  ```
- `boolUnary`:
  ```json
  { "name": "not1", "kind": "boolUnary", "op": "not" }
  ```
- `libraryRef`:
  ```json
  { "name": "isNil", "kind": "libraryRef", "ref": "isNil" }
  ```

## classes の書き方

`classes` を使うと、JSON から以下のコンポーネントが自動生成されます。

- コンストラクタ: `new_<ClassName>`
- フィールドアクセサ: `<ClassName>_<fieldName>`
- メソッド呼び出し: `<ClassName>_<methodName>`

例:

```json
{
  "classes": [
    {
      "name": "Point",
      "fields": { "x": "Int", "y": "Int" },
      "methods": [
        {
          "name": "moveX",
          "args": { "dx": "Int" },
          "returnType": "Point",
          "bodyJs": "return { object: { className: 'Point', fields: { x: this.x + dx, y: this.y } } };"
        }
      ]
    }
  ]
}
```

`bodyJs` では `this.<field>` に加えて、同一クラスの他メソッドを `this.<method>(...)` で呼び出せます。
返り値は UserLiteral 形式（number/list/object など）で返してください。

対応 op:

- `intUnary`: `inc | dec | neg | abs | double | square`
- `intBinary`: `add | sub | mul | max | min`
- `boolUnary`: `not`

## ベンチマークスイート

- 17件の移植済みベンチマーク: `examples/benchmarks/`
- 標準スイート定義: `examples/benchmark-suites/standard.json`

`paper` スイートは `examples/benchmarks/*.json` 全件です。

## 新しい合成タスクを追加する手順

1. `examples/benchmarks/<task>.json` を作成
2. `name`, `category`, `signature`, `examples` を設定
3. `componentsPreset` と `components` で探索空間を構成
4. `oracle` を指定（`componentRef` 推奨）
5. 必要なら `examples/benchmark-suites/standard.json` に追加
6. 検証:
   - `pnpm test`
   - `pnpm run benchmark:typed-escher -- --benchmarks <task>`
   - `pnpm run benchmark:ascendrec -- --benchmarks <task>`

## 既存コンポーネントで足りない場合

### まず JSON で対応できるか確認

- `intConst / intUnary / intBinary / boolUnary / libraryRef` で表現できるなら JSON だけで追加可能です。

### TypeScript 実装が必要な場合

1. `src/library/common-comps-*.ts` に `ComponentImpl` を追加
2. `src/library/common-comps-sets.ts` に登録
   - 必要なら `benchmarkComponentPresets` に追加
3. JSON から `libraryRef` で参照
4. テスト追加（例: `tests/unit/library/common-comps.test.ts`）
5. `pnpm run typecheck && pnpm test`

## 補助 API

`src/components/user-friendly.ts` / `src/components/user-friendly-json.ts` を使うと、
内部の `TermValue` を直接意識せずに定義できます。

主な API:

- `parseJsonSynthesisSpec`
- `prepareJsonSynthesisSpec`
- `prepareJsonSynthesisJob`
- `literalExamples`
- `literalOracle`
- `intConst`, `intUnary`, `intBinary`, `boolUnary`
- `pairLit`, `leafLit`, `nodeLit`, `errorLit`
