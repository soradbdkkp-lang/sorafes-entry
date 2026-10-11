# Cloudflare本番サイト構成

2026-10-11確定。参加者向け本番サイトは **Cloudflare Workers + Static Assets + Workers Builds** とし、GitHubの `sorafes-entry` リポジトリをソース管理に引き続き使用する。本書はローカル実装と、外部環境を変更する前の設定手順を管理する。

現時点ではCloudflareアカウント接続、GitHub App認可、Worker作成、Secret登録、デプロイ、独自ドメイン設定を行っていない。Apps Scriptの `PRODUCTION_ENABLED=false` を維持し、保存経路の架空試験データ1件も削除しない。

## 採用構成

```text
参加者
  → sorafes-entry本番サイト（React + Viteの静的資産）
  → 同一オリジン POST /api/entry
  → Cloudflare Worker
  → Apps Script doPost()
  → 本番認証・履歴・応募一覧スプレッドシート
```

1つのWorkerが `dist` の静的資産と `/api/entry` を提供する。ブラウザへApps Script URLを渡さず、WorkerだけがランタイムSecretから接続先を読む。Apps Script HTML Service画面は運営の保存経路検証用として残し、正式応募リンクには使用しない。

## ファイルと責務

| ファイル | 責務 |
| --- | --- |
| `wrangler.jsonc` | Worker名、静的資産、SPAフォールバック、`/api/*` 優先ルーティング |
| `worker/index.mjs` | 同一オリジン・メソッド・容量・入力契約の確認、Apps Script転送、応答の最小化と検証 |
| `src/storage/production-client.ts` | ブラウザから `/api/entry` を呼び、確定応答だけを成功とする。HTML Service用通信も別関数で保持 |
| `src/components/LocalEntry.tsx` | 送信中、受付停止、重複、認証失敗、競合、結果不明と同一操作ID再確認の状態管理 |
| `src/components/Completion.tsx` | 正常な確定応答後だけ、受付番号・編集コード・再確認IDと保存票を表示 |

Workerは本番モードと大会IDをサーバー側で付与する。`testOnly`、故障指定、クライアント指定の本番モード・大会IDは拒否する。Apps Scriptの既存保存処理、重複判定、編集認証、受付番号 `FAC-2026-` と6桁連番の仕様は変更しない。

## Secret

本番接続先はCloudflare Workerの暗号化Secretとして登録する。

```text
SORAFES_PRODUCTION_APPS_SCRIPT_URL
```

React、`VITE_` 変数、`wrangler.jsonc`、Git、ログ、API応答には値を置かない。ローカルで実接続が必要になった場合だけ、Git除外済みの `.env.local` へ設定する。ローカル起動スクリプトは `SORAFES_PRODUCTION_` 接頭辞の値だけをWranglerへ渡し、既存の試験キーや試験URLをWorker環境へ渡さない。今回のローカル結合試験では本番URLを設定せず、`CONFIG` で安全に拒否されることを確認した。

`PRODUCTION_ENABLED` はApps Scriptのスクリプトプロパティを正本とする。Cloudflare側へ別の受付開始スイッチを増やさない。

## ローカル開発

通常のUI開発は従来どおり行う。

```text
npm run dev
```

Cloudflareと同じ静的資産・Worker構成は次で確認する。

```text
npm run dev:cloudflare
```

このコマンドは本番ビルド後にWranglerをローカル起動する。標準URLは `http://127.0.0.1:8787/`。Secret未設定では `/api/entry` が `CONFIG` を返し、外部へ通信しない。通信の成功・受付停止・重複・認証失敗・異常応答は、模擬上流を使う自動テストで確認する。

Cloudflareへ送信せず配備物だけを確認する場合は次を使う。

```text
npm run build:cloudflare
```

これは `wrangler deploy --dry-run` を実行し、実際のデプロイは行わない。

## 正常・異常時の扱い

- `status=committed`、同じ操作ID、`FAC-2026-` 形式、正の版番号をすべて確認した場合だけ完了画面へ進む。
- 受付停止、重複、重複候補、認証失敗、版競合、入力不正は完了画面へ進めず、入力を保持して理由を表示する。
- 通信切断、HTTP失敗、非JSON、不正な成功応答、操作ID不一致は結果不明とする。
- 結果不明では入力をロックし、保持した同じ操作IDで再確認する。新しい応募として再送しない。
- 送信中は画面移動と送信ボタンを無効化し、同一画面からの二重送信を防ぐ。

## Cloudflareで手動設定する項目

公開前整理時点の具体的なビルド・配備設定候補、Git管理準備、残作業は [公開前チェックリスト](prelaunch-checklist.md) にまとめる。以下の外部操作は未実施。

ローカル検証完了後、別途承認を得て次を行う。

1. Cloudflareアカウントと `workers.dev` サブドメインを用意する。
2. Cloudflare Workers & PagesからGitHub Appを認可し、`sorafes-entry` リポジトリだけへのアクセスを許可する。
3. リポジトリをWorkerとしてインポートし、Worker名を `sorafes-entry`、本番ブランチを `main` にする。
4. ランタイムSecret `SORAFES_PRODUCTION_APPS_SCRIPT_URL` を本番環境へ登録する。プレビュー環境には本番URLを登録しない。
5. 初回配備では `PRODUCTION_ENABLED=false` のまま、静的表示、受付停止、ログに秘密値が出ないことを確認する。
6. 必要に応じて独自ドメインを設定する。未決定の間は `https://sorafes-entry.<account>.workers.dev/` が候補となる。
7. 正式公開前の最終確認後、別工程でApps Scriptの `PRODUCTION_ENABLED=true` へ変更し、受付開始日時を記録する。

GitHub Pagesの既存URLは自動転送されない。正式URL確定後に、GitHub Pagesを停止するか移転案内へ変更する。現在のリポジトリにはGitHub Pages用のActions設定はないため、GitHub側のPages設定は公開切り替え時に管理画面で確認する。

## ローカル検証結果

2026-10-11：Workerと本番クライアントを模擬上流で検証し、Secret非露出、成功応答の厳格確認、受付停止・重複・認証失敗の維持、通信失敗・不正応答の結果不明化を確認した。`npm test` は59件成功。本番ViteビルドとWrangler dry-runに成功した。Wranglerローカルサーバーで `/` が200、Secret未設定の `/api/entry` が200と `CONFIG` を返すことを確認し、外部接続は行っていない。

未検証はCloudflare実環境のGitHub連携、Secret登録、Worker公開、独自ドメイン、CloudflareからApps Scriptへの実通信である。
