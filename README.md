# escher-ts

TypeScript 実装のプログラム合成器です。  
現在は **JSON で定義した合成タスク** を `TypedEscher` / `AscendRec` の両エンジンで実行できます。

元リポジトリ（Scala 実装）:  
https://github.com/MrVPlusOne/Escher-Scala

## クイックスタート

```bash
pnpm install
pnpm run typecheck
pnpm test:run
```

## Web アプリ (GitHub Pages 対応)

`web/` 配下に、ブラウザで合成を実行できる UI を追加しています。

```bash
# 開発サーバ
pnpm run web:dev

# 静的ビルド (web/dist)
pnpm run web:build

# ビルド確認
pnpm run web:preview
```

機能:

- 個別ベンチマークを選択してその場で実行
- `pure` / `classes` suite の一括実行
- 実行結果のテーブル表示と SVG ランタイムグラフ表示

`web/vite.config.ts` は `base: "./"` を使っているため、`web/dist` をそのまま GitHub Pages に配置できます。

### GitHub Pages 手動公開（自動デプロイなし）

1. GitHub 側設定
   - Repository Settings → Pages → Source を `Deploy from a branch` にする
   - Branch を `gh-pages` / `/ (root)` に設定

2. 公開（1コマンド）

```bash
pnpm run deploy:pages
```

実行内容:

```bash
pnpm run build:pages
pnpm dlx gh-pages -d web/dist
```

公開 URL は通常 `https://<GitHubユーザー名>.github.io/<リポジトリ名>/` です。

## 実行コマンド

```bash
# Pure ベンチマーク
pnpm run benchmark:typed-escher -- --suite pure --maxCost 24 --timeoutMs 10000
pnpm run benchmark:ascendrec -- --suite pure --maxCost 24 --timeoutMs 10000

# Classes ベンチマーク
pnpm run benchmark:typed-escher -- --suite classes --maxCost 24 --timeoutMs 10000
pnpm run benchmark:ascendrec -- --suite classes --maxCost 24 --timeoutMs 10000
```

デフォルト出力:

- `outputs/<suite>-typed-escher-runtime.svg`
- `outputs/<suite>-typed-escher-runtime.csv`
- `outputs/<suite>-typed-escher-programs.md`
- `outputs/<suite>-ascendrec-runtime.svg`
- `outputs/<suite>-ascendrec-runtime.csv`
- `outputs/<suite>-ascendrec-programs.md`

## ディレクトリ構成

- `src/`: 合成器本体
- `examples/`: JSON タスク定義とスイート定義
- `tests/`: unit/integration テスト
- `docs/`: 補足ドキュメント
- `outputs/`: ベンチマーク実行結果（生成物）

詳細は `docs/directories.md` を参照してください。

## JSON タスク定義

主な配置先:

- `examples/benchmarks-pure/*.json`
- `examples/benchmarks-classes/*.json`
- `examples/basic/*.json`（小規模サンプル）

スイート定義:

- `examples/benchmark-suites/pure.json`
- `examples/benchmark-suites/classes.json`
- `examples/benchmark-suites/standard.json`（互換用の小スイート）

最小例:

```json
{
  "name": "calc",
  "category": "integers",
  "signature": {
    "inputNames": ["x", "y"],
    "inputTypes": ["Int", "Int"],
    "returnType": "Int"
  },
  "components": [
    { "name": "add", "kind": "intBinary", "op": "add" }
  ],
  "examples": [
    [[1, 2], 3],
    [[4, 5], 9]
  ]
}
```

利用できる詳細仕様:

- コンポーネント定義: `docs/components.md`
- テスト方針: `tests/README.md`

## 新しいタスクを追加する

1. `examples/benchmarks-pure/` または `examples/benchmarks-classes/` に JSON を追加
2. `signature`, `components`, `examples` を定義
3. 必要なら `oracle` を `examples` / `table` / `js` / `componentRef` で指定
4. スイートに含める場合は `examples/benchmark-suites/*.json` を更新
5. `pnpm test:run` と benchmark コマンドで確認

## 新しいコンポーネントを追加する

1. まず JSON の `intConst/intUnary/intBinary/boolUnary/libraryRef/js` で表現できるか確認
2. TS 実装が必要なら `src/library/common-comps-*.ts` に追加
3. `src/library/common-comps-sets.ts` に登録
4. JSON から `libraryRef` で参照
5. `tests/unit/library/common-comps.test.ts` にテストを追加
