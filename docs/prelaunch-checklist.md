# 公開前整理と手動作業

2026-10-11。既存仕様の現在地を整理する文書であり、公開・外部設定・Git操作の実行承認ではない。コード・UI・仕様・依存・Git設定・ignoreファイルは変更しない。

## 現在地と文書整理

- [x] 既存変更を保持してGit状態と前回検証記録を確認。
- [x] Phase 2当時の保存未実装と、現在の本番候補の受付完了実装を区別（`entry-flow.md`）。
- [x] 本番保存先・所有者限定権限を作成済みとして整理（`requirements.md`、`production-launch-plan.md`）。
- [x] 公開方式の決定と正式URLの未決定を区別（`implementation-plan.md`）。
- [x] 制限の採用値と実環境での未検証を区別（`production-launch-plan.md`）。
- [x] 概念モデル・Phase 4文書に現在地の補足を追加。古い計画・試験結果を現行本番仕様と混同しない。
- [x] 未追跡ファイル全件を [分類表](git-file-inventory.md) に記録。

前回引き継ぎ記録は履歴として保持する。同記録の文書不整合4点は今回整理した。初期設計・歴史的な各Phaseの未確定事項をすべて現在の仕様へ書き換えることはせず、現在の採用事項への参照を補う。紛失時対応、追加共有、正式URL等の未決定事項は決定していない。

## Git管理の準備

- [ ] 分類表のGit管理候補を確認し、秘密情報・実応募情報・実編集コードがないことをステージ前に確認する。
- [ ] Apps Script生成物をGit除外にする提案を確認する。生成元と生成スクリプトを管理し、配備物は必要時にローカル生成する案。現物は削除しない。
- [ ] `.wrangler/` の除外方法を承認する。ローカル状態・キャッシュDBであり、アプリのソースや必要な本番DBではない。D1等のディレクトリ名は本番でこれらを採用した意味ではない。
- [ ] 除外パターン案：`.wrangler/`、`apps-script/generated/`、`apps-script/phase4-generated/`、`apps-script/production-generated/`。`.dev.vars`・`.dev.vars.*` も現在は未除外なので、将来使用する前に除外する案。
- [ ] `.gitignore` 変更または別の除外方法について明示承認を得る。既存の変更禁止ルールに従い、今回は `.gitignore`・`.git/info/exclude`・グローバルGit設定を変更していない。
- [ ] 承認後、対象を明示してGit add / commitを行う。一括addは生成物や状態DBを取り込むため避ける。pushと接続済みWorkers Buildsによる自動配備のタイミングも承認対象とする。

`package-lock.json` は自動生成されるが、依存の再現に必要なGit管理候補。`docs/phase3-live-results.json` は架空データによる歴史的試験記録であり、通常のビルド出力とは区別する。分類は秘密値非混入の最終監査を代替しない。

## Cloudflare手動設定一覧

2026-10-12補足：初回必須Secretの制約、接続試験とロールバックの具体手順は [本番接続の実行前手順](cloudflare-connection-runbook.md) を参照。外部変更は未実施。

以下は未実施。値の候補は既存ローカル構成から整理したもの。外部操作直前に対象・権限・設定を確認する。

| 項目 | 設定・確認内容 |
| --- | --- |
| アカウント | 対象Cloudflareアカウント、操作メンバー、Workers利用権限、workers.devサブドメインを確認 |
| GitHub App | 対象GitHubアカウントと `sorafes-entry` リポジトリだけへのアクセスを確認 |
| Worker | Workersとして接続。名前 `sorafes-entry` を `wrangler.jsonc` と一致させる |
| 本番ブランチ | 既存手順の `main` をリモートの実際のブランチと照合。今回はGitHub状態を照会していない |
| ルートディレクトリ | リポジトリルート（本プロジェクトの `package.json`・`wrangler.jsonc` がある場所） |
| ビルド | `npm run build`。依存導入はlockfileと開発依存のWrangler・TypeScript等を含めて再現できるか確認 |
| 配備コマンド | 承認後の本番配備は `npx wrangler deploy` が候補。`npm run build:cloudflare` はdry-runなので公開用の配備コマンドにはしない |
| 実行環境 | Node.js 24系がローカル検証環境。Cloudflare側で利用可能な版を確認して揃える。npm実行環境とlockfile整合も確認 |
| 静的資産 | `dist` と `ASSETS`、SPAフォールバック、`/api/*` のWorker優先を既存設定で確認 |
| ランタイムSecret | `SORAFES_PRODUCTION_APPS_SCRIPT_URL` を本番WorkerのランタイムSecretへ。値はVITE変数・ビルド変数・Git・文書へ記載しない |
| プレビュー | 本番Apps Script URLを登録しない。自動プレビューの有効範囲とSecretの継承・分離を設定画面で確認。`preview_urls=false` だけでBuildsのプレビュー全体が無効になるとは扱わない |
| 自動配備 | 初回インポート・設定保存・本番ブランチpush時の配備トリガーを確認。接続開始自体も公開操作と一緒に承認範囲を確認 |
| URL | workers.dev候補か独自ドメインかを運営が決定。DNS変更は決定・承認後。正式URLは未確定 |
| 監視・ログ | POST本文、編集コード、Apps Script URL、応募情報を出力しないことと、エラー確認・権限を確認 |
| 旧公開先 | GitHub Pagesの実際の設定を確認し、移転案内または停止を別途決定。今回は公開URLを変更しない |

Workers Buildsはビルドと配備を別コマンドで実行し、ビルド変数とランタイムSecretも別に設定する。2026-10-11に [Cloudflare公式Builds設定](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) を確認。GitHub権限は [公式GitHub連携](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)、Secret操作は [公式Secret設定](https://developers.cloudflare.com/workers/configuration/secrets/) を参照する。管理画面の実設定・対象アカウントは未確認。

## 初回配備から受付開始まで

- [ ] 明示承認後、上記外部設定と初回配備を行う。Apps Scriptの `PRODUCTION_ENABLED=false` を維持する。
- [ ] 現行Apps Scriptの停止状態・3保存先の所有者限定権限・既存架空データ保持を読み取りで再確認する。
- [ ] 正式候補URLでPC・スマホ表示、入力・確認画面、受付停止応答、秘密情報の非露出を確認する。
- [ ] 別途承認された時間・対象・架空データでCloudflare→Apps Scriptの実通信を検証する。
- [ ] 全5形式とチーム4/5/6名、読込・更新、重複保留、誤認証、競合、二重送信、応答切断後の同一操作ID回復を確認する。
- [ ] 3保存先への反映・認証情報の非混入・短時間制限・締切境界・Google割当制限の確認方法を整理する。未検証を成功扱いしない。
- [ ] 架空試験後は再び受付停止に戻し、架空データを明確に区別して保持する。既存データを削除しない。
- [ ] 運営が正式URL・案内文・情報取扱い・問い合わせ対応・障害時停止手順を確認する。
- [ ] 未確定のコード紛失時の本人確認・運営対応、重複誤判定時対応、追加共有が必要かを確認する。推測で確定しない。
- [ ] 正式受付開始の明示承認後だけ `PRODUCTION_ENABLED=true` とし、開始日時を記録する。

## 今回の検証

文書のみの変更のため、前回成功した59件の自動テスト・型チェック・本番ビルド・dry-runは再実行しない。ファイル分類の全件一致、Markdownリンク、差分の空白チェック、文書以外のファイルのSHA-256一致を確認する。外部アカウント設定・実通信・実応募送信は未実施。

確認結果：未追跡101件と分類表が全件一致（Git管理候補78件、ローカル生成物23件）。変更文書のローカルMarkdownリンク切れなし。`git diff --check` 成功（既存READMEの改行変換予告のみ）。`docs/` と `.wrangler/` を除く追跡済み・未追跡ファイルは作業前後のSHA-256が全件一致し、アプリ・UI・設定・依存・生成物・ignoreファイルの不変を確認した。`.wrangler/` は読み取りによる分類だけで、削除・生成・変更コマンドは実行していない。

今回追加：`prelaunch-checklist.md`、`git-file-inventory.md`。今回更新：`README.md`（docs索引）、`cloudflare-deployment.md`、`entry-flow.md`、`requirements.md`、`implementation-plan.md`、`production-launch-plan.md`、`data-model.md`、`phase4-design.md`、`phase4-technical-proposal.md`。すべて `docs/` 内。前回の引き継ぎ記録とプロジェクト直下READMEの既存変更は保持した。
