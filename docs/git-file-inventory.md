# 未追跡ファイルの分類

## 2026-10-12 Git管理確定

ユーザー承認に基づき、未追跡102件を管理対象79件とローカル生成物23件に確定した。下記の旧表の管理候補78件に `docs/cloudflare-connection-runbook.md` を加えた79件を追加する。既存追跡3件を含む管理対象は合計82件。削除は行わない。

| 対象 | 最終分類・扱い |
| --- | --- |
| 下記旧表のGit管理候補78件と接続手順書 | Git管理する。ソース、設定、lockfile、テスト、文書、架空試験記録、比較用HTML |
| `.wrangler/` の18件 | `.gitignore`へ追加し、ローカル保持。状態DBは配備ソースではない |
| Apps Script生成先3ディレクトリの5件 | `.gitignore`へ追加し、ローカル保持。生成元と生成スクリプトは管理 |
| `.dev.vars`、`.dev.vars.*`、`.env.*.local` | `.gitignore`へ追加。将来のローカルSecretにも適用 |
| `.env.local` | 既存ignoreでローカル保持。試験接続値を含むため管理しない |
| `.env.production.local` | 既存ignoreでローカル保持。初回配備後に実値消去済みの0バイトファイル |
| `dist/`、`node_modules/`、`.npm/` | 既存ignoreでローカル保持。ビルド・依存・キャッシュ |
| `wrangler-first-deploy.log`、`wrangler-verification.log` | 既存の `*.log` で除外してローカル保持 |
| `wrangler-secret-bridge.log` | 既存の `*.log` で除外してローカル保持。一時補助コード、実値なし、サーバー停止済み |
| 削除候補 | 必須の削除なし。一時補助コード、空のSecretファイル、古いログは将来整理候補だが今回は削除しない |

本コミットは、Cloudflare版 `20bdd2d9-fd33-463f-881a-7573994dc98b` の初回配備に使用したソースを基準点にする。Git整理ではアプリ・Worker・UI・仕様・配備設定を変更しない。初回配備URLは `https://sorafes-entry.mnb-bsk-bn.workers.dev`。静的資産200、settingsのCLOSED、Google本番3保存先の更新日時不変を前工程で確認済み。受付開始、保存試験、Git push、Builds接続は今回実施しない。

秘密値監査で過去のPhase 3・4文書に残っていた試験用の実 `/exec` URLを取得元の説明へ置換した。テストの明示的な架空URLと、文書の形式例は保持する。以下の旧分類は履歴として残す。

## 公開前整理時点の履歴

2026-10-11、公開前整理時点の `git ls-files --others --exclude-standard` 全件。今回追加した本表と公開前チェックリストも含む。分類はGit addやignore変更を実行した意味ではない。Git管理候補は秘密情報・実応募データの非混入を確認してから承認のうえで追加する。

追跡済みは `.gitignore`・`.gitattributes`・`README.md` の3ファイルで、READMEには既存変更がある。これらは未追跡一覧に含めない。全ファイルを保持し、削除・移動・ステージは行っていない。

`node_modules/`・`dist/`・`.env.local`・`*.log` は既存ignore対象であり下表には現れない。`.dev.vars`・`.dev.vars.*` は将来使用前のignore提案で、現在の未追跡一覧にはない。`.wrangler/` とApps Script生成物の除外も提案段階である。詳細は [公開前チェックリスト](prelaunch-checklist.md)。

対象 101件：Git管理候補 78件、ローカル生成物 23件（Git除外を推奨／提案）。

2026-10-12追加：`docs/cloudflare-connection-runbook.md` はGit管理候補（接続・試験・復旧手順）。これを含む現在の未追跡は102件、Git管理候補79件、ローカル生成物23件。以下の表は2026-10-11時点の101件を保持する。

| ファイル | 分類 | 扱い | 理由 |
| --- | --- | --- | --- |
| `.wrangler/state/v3/cache/miniflare-CacheObject/metadata.sqlite` | ローカル生成物 | ignore推奨・現物保持 | Miniflare状態DB／補助ファイル。本番ソースではない |
| `.wrangler/state/v3/cache/miniflare-CacheObject/metadata.sqlite-shm` | ローカル生成物 | ignore推奨・現物保持 | Miniflare状態DB／補助ファイル。本番ソースではない |
| `.wrangler/state/v3/cache/miniflare-CacheObject/metadata.sqlite-wal` | ローカル生成物 | ignore推奨・現物保持 | Miniflare状態DB／補助ファイル。本番ソースではない |
| `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/metadata.sqlite` | ローカル生成物 | ignore推奨・現物保持 | Miniflare状態DB／補助ファイル。本番ソースではない |
| `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/metadata.sqlite-shm` | ローカル生成物 | ignore推奨・現物保持 | Miniflare状態DB／補助ファイル。本番ソースではない |
| `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/metadata.sqlite-wal` | ローカル生成物 | ignore推奨・現物保持 | Miniflare状態DB／補助ファイル。本番ソースではない |
| `.wrangler/state/v3/kv/miniflare-KVNamespaceObject/metadata.sqlite` | ローカル生成物 | ignore推奨・現物保持 | Miniflare状態DB／補助ファイル。本番ソースではない |
| `.wrangler/state/v3/kv/miniflare-KVNamespaceObject/metadata.sqlite-shm` | ローカル生成物 | ignore推奨・現物保持 | Miniflare状態DB／補助ファイル。本番ソースではない |
| `.wrangler/state/v3/kv/miniflare-KVNamespaceObject/metadata.sqlite-wal` | ローカル生成物 | ignore推奨・現物保持 | Miniflare状態DB／補助ファイル。本番ソースではない |
| `.wrangler/state/v3/observability/miniflare-wobs-trace-store/a590acd76969f996ec6e4b599c3c09f58c283a76f2d61392b5d3046caf557602.sqlite` | ローカル生成物 | ignore推奨・現物保持 | Miniflare状態DB／補助ファイル。本番ソースではない |
| `.wrangler/state/v3/observability/miniflare-wobs-trace-store/a590acd76969f996ec6e4b599c3c09f58c283a76f2d61392b5d3046caf557602.sqlite-shm` | ローカル生成物 | ignore推奨・現物保持 | Miniflare状態DB／補助ファイル。本番ソースではない |
| `.wrangler/state/v3/observability/miniflare-wobs-trace-store/a590acd76969f996ec6e4b599c3c09f58c283a76f2d61392b5d3046caf557602.sqlite-wal` | ローカル生成物 | ignore推奨・現物保持 | Miniflare状態DB／補助ファイル。本番ソースではない |
| `.wrangler/state/v3/observability/miniflare-wobs-trace-store/metadata.sqlite` | ローカル生成物 | ignore推奨・現物保持 | Miniflare状態DB／補助ファイル。本番ソースではない |
| `.wrangler/state/v3/observability/miniflare-wobs-trace-store/metadata.sqlite-shm` | ローカル生成物 | ignore推奨・現物保持 | Miniflare状態DB／補助ファイル。本番ソースではない |
| `.wrangler/state/v3/observability/miniflare-wobs-trace-store/metadata.sqlite-wal` | ローカル生成物 | ignore推奨・現物保持 | Miniflare状態DB／補助ファイル。本番ソースではない |
| `.wrangler/state/v3/r2/miniflare-R2BucketObject/metadata.sqlite` | ローカル生成物 | ignore推奨・現物保持 | Miniflare状態DB／補助ファイル。本番ソースではない |
| `.wrangler/state/v3/r2/miniflare-R2BucketObject/metadata.sqlite-shm` | ローカル生成物 | ignore推奨・現物保持 | Miniflare状態DB／補助ファイル。本番ソースではない |
| `.wrangler/state/v3/r2/miniflare-R2BucketObject/metadata.sqlite-wal` | ローカル生成物 | ignore推奨・現物保持 | Miniflare状態DB／補助ファイル。本番ソースではない |
| `AGENTS.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `DESIGN.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `apps-script/generated/Code.gs` | ローカル生成物 | ignore提案・現物保持 | 生成元とscriptsから再生成可能。配備物のGit管理要否は承認待ち |
| `apps-script/phase4-generated/Code.gs` | ローカル生成物 | ignore提案・現物保持 | 生成元とscriptsから再生成可能。配備物のGit管理要否は承認待ち |
| `apps-script/phase4-server.ts` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `apps-script/production-generated/Code.gs` | ローカル生成物 | ignore提案・現物保持 | 生成元とscriptsから再生成可能。配備物のGit管理要否は承認待ち |
| `apps-script/production-generated/Index.html` | ローカル生成物 | ignore提案・現物保持 | 生成元とscriptsから再生成可能。配備物のGit管理要否は承認待ち |
| `apps-script/production-generated/appsscript.json` | ローカル生成物 | ignore提案・現物保持 | 生成元とscriptsから再生成可能。配備物のGit管理要否は承認待ち |
| `apps-script/production-server.ts` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `apps-script/server.ts` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `docs/README.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/apps-script-setup.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/cloudflare-deployment.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/cloudflare-handoff-verification.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/data-model.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/entry-flow.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/git-file-inventory.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/implementation-plan.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/phase3-live-results.json` | Git管理候補 | 架空試験記録として管理 | fictional-onlyのPhase 3検証証跡。コミット前に全内容の秘密値非混入を再確認 |
| `docs/phase3-verification.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/phase4-design.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/phase4-google-setup.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/phase4-google-test-plan.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/phase4-google-verification.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/phase4-local-checklist.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/phase4-local-verification.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/phase4-technical-proposal.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/phase5-design-proposal.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/phase5-google-test-plan.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/phase5-local-verification.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/prelaunch-checklist.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/production-apps-script-setup.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/production-google-verification.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/production-launch-plan.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/requirements.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `docs/storage-integration.md` | Git管理候補 | 管理対象 | 仕様・手順・履歴・作業ルール |
| `index.html` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `package-lock.json` | Git管理候補 | 管理対象 | 生成ファイルだが依存の再現に必要 |
| `package.json` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `phase2-preview.html` | Git管理候補 | 管理対象 | 採用判断の比較用ページ。自動ビルド出力ではない |
| `scripts/build-apps-script.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `scripts/build-phase4-apps-script.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `scripts/build-production-apps-script.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `scripts/build-production-web.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `scripts/phase4-google-relay.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `scripts/phase4-store.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `scripts/run-cloudflare-local.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `scripts/serve-production-generated.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `scripts/serve-storage-fault-test.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `scripts/verify-live-denial.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `scripts/verify-live-storage.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `src/App.tsx` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `src/components/Completion.tsx` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `src/components/Fields.tsx` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `src/components/LocalEntry.tsx` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `src/components/Review.tsx` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `src/config/killers.ts` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `src/config/tournament.ts` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `src/main.tsx` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `src/model.ts` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `src/phase5-duplicates.ts` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `src/storage/client.ts` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `src/storage/contract.ts` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `src/storage/prepare-draft.ts` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `src/storage/production-client.ts` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `src/styles.css` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `src/validation.ts` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `src/vite-env.d.ts` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `tests/cloudflare-worker.test.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `tests/completion.test.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `tests/phase4-google-relay.test.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `tests/phase4-google.test.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `tests/phase4-local.test.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `tests/phase5-local.test.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `tests/production-client.test.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `tests/production-google.test.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `tests/storage-client.test.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `tests/storage.test.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `tests/validation.test.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `tsconfig.json` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `vite.config.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `worker/index.mjs` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
| `wrangler.jsonc` | Git管理候補 | 管理対象 | アプリ・Worker・設定・テスト・生成／検証スクリプト |
