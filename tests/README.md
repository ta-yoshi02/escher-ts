# Test Structure

## ディレクトリ

- `tests/unit/`
  - 低コストな純粋ユニットテスト
  - `types/`, `components/`, `library/`, `synthesis/`, `cli/`, `benchmarks/`, `utils/` を対象に分割
- `tests/integration/`
  - エンジン横断・JSON 読み込み・ベンチマーク実行などの結合テスト
- `tests/helpers/`
  - 複数テストで使い回す最小フィクスチャ

## 現在のカバレッジ

- TypedEscher / AscendRec の両合成器
- benchmark harness / formatter / chart 出力
- JSON タスク (`examples/`) 読み込みと実行
- クラス参照系タスク（DLList/Point）

## 命名・運用ルール

- テストファイルは `*.test.ts`
- 1ファイル1責務を基本とする
- 重複が発生してから `tests/helpers/` へ抽出する
- 仕様変更時は unit と integration を同時更新する

## よく使うコマンド

```bash
pnpm test
pnpm test:run
pnpm test:coverage
```
