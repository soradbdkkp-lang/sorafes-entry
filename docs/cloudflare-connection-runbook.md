# Cloudflare本番接続の実行前手順

2026-10-12。調査と手順整理のみ。外部接続・Secret取得／登録・配備・Git add / commit / push・受付開始を実施する承認ではない。UI・仕様・コード・設定は変更しない。

## 設定値と未確認項目

| 項目 | 実行時に使用する値・確認 |
| --- | --- |
| Cloudflareアカウント | 未確認。所有者と操作権限、対象アカウントを確認してから作成 |
| Worker名 | `sorafes-entry`。既存同名Workerの有無を事前確認し、あれば上書きせず状態を調査 |
| ソース | GitHubのsorafes-entry。GitHub Appはこのリポジトリだけを許可。実際の所有者・リモート・権限は未確認 |
| 本番ブランチ | `main`。ローカル現在ブランチはmain。GitHub側のブランチと内容は未確認 |
| Root directory | リポジトリルート |
| Build command | `npm run build` |
| Deploy command | 通常の継続配備は `npx wrangler deploy`。初回Secret設定は下記の別手順を先に確定 |
| 依存導入 | lockfileと開発依存を含めた導入を確認。`npm ci`を使う案。今回は実行しない |
| Node | ローカル検証は24系。Buildsで利用可能な24系の版を確認して指定する案。具体版は未確定 |
| Worker entry | `worker/index.mjs` |
| compatibility_date | 現行 `2026-10-11` を維持 |
| Assets | `dist`、binding `ASSETS`、SPAフォールバック、`/api/*` のWorker優先 |
| ランタイムSecret | `SORAFES_PRODUCTION_APPS_SCRIPT_URL` の1つ。追加の試験キー・Google認証キーは現行Workerで使用しない |
| 受付制御 | Apps Scriptの `PRODUCTION_ENABLED=false`。Cloudflareへ別スイッチを追加しない |
| URL | workers.dev有効、version preview URL無効という現行設定。実際のサブドメイン・正式URL・独自ドメインは未決定 |
| プレビュー／自動配備 | 本番Secretをプレビューへ渡さない。自動プレビューと本番pushの配備トリガーを確認する。現行設定だけでBuildsの全プレビューが無効になるとは扱わない |

`npm run build:cloudflare` はdry-run用で、公開するDeploy commandではない。`npm run build:production` はApps Script運営検証画面用で、Cloudflare公開用ビルドではない。Builds用認証トークンはCloudflare配備権限であり、Apps Script接続用Secretとは別。実値はGit・文書・チャットに置かない。

## Secretの値の特定方法

登録する値は、**既存の本番用独立Apps Scriptで、バージョン2を配備したWebアプリの `/exec` URL全体**。所有者の「デプロイを管理」画面で対象と配備バージョンを照合して取得する。今回その画面へアクセスしておらず、実値は取得していない。

- 形式は `https://script.google.com/macros/s/<deployment-id>/exec`。Workerの許可形式に一致すること。
- `/dev` URL、スクリプト編集URL、スプレッドシートURL、Phase 3・4試験URLを使わない。
- 本番3保存先と受付停止設定に結び付いた既存配備であることを所有者が確認する。再配備やURL変更を前提にしない。
- Cloudflareの本番ランタイムSecretへ登録する。`VITE_`、通常のBuild variables、設定JSON、フロントエンド、ログに含めない。
- Google保存先IDや編集コードをCloudflareへ登録する必要はない。保存先設定とGoogle権限はApps Script側に維持する。

## 初回配備の前提と停止点

現行Wrangler 4.149.0の実装と公式資料では、`secrets.required` の未設定は実配備時の失敗要因となる。dry-run成功は本番Secret準備完了の証拠ではない。

新規Workerがまだ存在しない場合、現在のCLIは `wrangler deploy --secrets-file <path>` による初回Secret同時配備を案内する。**提案**：承認後の初回に限り、Git除外確認済みの専用ローカルファイルから当該Secret1個だけを渡し、通常のWorkers Builds接続へ進む。`.env.local` は既存の試験値を含む可能性があるため、そのままSecretファイルとして流用しない。専用ファイルの名前・保持／削除方法・除外は実行前に承認する。今は作成しない。

ダッシュボードで作成・登録する方法を選ぶ場合も、初回インポートが配備を始めるか、Secret登録の保存操作が配備を伴うかを画面で確認し、対象を示したうえで承認を得る。`wrangler secret put` は即時配備を伴うため、「Secret登録だけ」として先に実行しない。

**ここが外部変更前の停止点**：対象アカウント、既存Worker有無、リポジトリ権限、初回方式、Secret取得元、初回URL、試験範囲を確認した段階で、Worker作成・Secret登録・初回配備の明示承認を得る。本書作成時はこの手前で停止している。

## Gitに含める範囲

[全件分類](git-file-inventory.md) のGit管理候補78件はソース・テスト・設定・lockfile・文書・架空試験証跡。今回追加する本手順書も候補とする。追跡済みREADMEの既存変更もレビュー対象。ステージ前に秘密値・実応募情報の非混入を確認し、承認されたファイルだけを追加する。

`.wrangler/` 18件とApps Script生成出力5件はローカル生成物として保持し、Git除外を推奨／提案する。既存ignoreの `dist`・`node_modules/`・`.env.local`・`*.log` も管理対象外。`.dev.vars`等を使用する場合は除外確認が先。今回 `.gitignore`、`.git/info/exclude`、Git設定は変更しない。ignore変更、Git add、commit、pushはそれぞれ承認待ちである。

## 接続試験：受付停止での往復確認

以下は初回配備等の明示承認後に行う計画。今回は実行しない。

1. Apps Scriptの受付停止と所有者限定共有を再確認し、3保存先の試験前状態を比較用に確認する。実データ・認証値をGitやログへ転記しない。
2. 初回Worker作成・Secret設定・配備を承認範囲内で実施。配備ID、版、対象ソースのcommit、日時を記録する（秘密値は記録しない）。
3. 候補URLの `/` と静的資産が200で表示されること、PC・スマホで入力と確認まで進めることを確認する。応募の送信ボタンは押さない。
4. 同じサイトのブラウザからJSONで `POST /api/entry`、本文 `{"action":"settings"}` を1回送る。期待はHTTP 200、`{"ok":false,"code":"CLOSED"}`、`Cache-Control: no-store`。既存Apps Scriptの停止判定は書込より先に行われる。
5. `CONFIG` はWorker側Secret未設定・URL形式不一致の可能性、`UNKNOWN` は上流HTTP失敗・非JSON・通信失敗等。成功扱いせず調査する。`ok:true` が返るなら受付停止の前提が崩れているので試験を中止する。
6. 必要なAPI拒否確認はGETが405、別オリジンOriginが403、未知の `/api/` パスが404となることを確認する。これらはWorkerで拒否される。
7. 3保存先に変更がないことを照合し、Secret値・応募情報がブラウザ配信資産・API応答・通常ログへ出ていないことを確認する。CLOSEDだけでは保存先権限・列構成・書込成功までは確認できない。

## 保存経路試験：別途承認が必要

停止往復確認と、保存・更新を伴う試験を分ける。後者は対象・試験時間・架空識別値・行の保持方針・受付一時有効化と停止復帰を具体的に承認してから行う。実応募は送信しない。

- 全5形式／チーム4・5・6名の保存・認証読込・更新。
- 同一操作ID再送、応答切断後の回復、版競合、同時送信、重複／重複候補、誤コードの拒否。
- 3保存先の内容照合、認証情報非混入、所有者限定共有、締切と短時間制限の確認。
- 試験終了後は受付停止へ戻す。架空行と既存行を削除・巻き戻ししない。

受付有効化は既知URL経由の受付も開くため、公開案内前でも外部から到達可能な点を試験計画へ含める。運営検証用HTML Serviceは保存されているまま維持する。

## ロールバックと停止復帰

以下も外部変更であり、今は実施しない。初回承認時に障害時停止・復帰操作まで含めるか確認する。

1. 障害時はまずApps Scriptの `PRODUCTION_ENABLED=false` で受付を停止し、settingsがCLOSEDになることを確認する。停止中は新規・編集・認証読込・回復も拒否される。進行中の処理の完了／途中状態は別途確認し、保存がなかったとは推定しない。
2. Workers Buildsの自動配備を停止・保留して、復旧中の新規pushによる再配備を防ぐ。実際の設定方法は対象Workerで確認する。
3. 以前の正常なCloudflare版がある場合、その版と対応資産・Secret bindingを確認し、Deploymentsから対象版へ戻す。URLは変更しない。初回配備では正常な旧版が存在しないため、旧版へのロールバックを前提にしない。受付停止を維持して原因を直す。
4. WorkerのロールバックはGoogleシート・Apps Scriptコード・プロパティを巻き戻さない。Secret設定も復元される前提で扱わず、戻す版のbindingと接続先を確認する。古いSecretが使えない場合は停止を維持し、別途承認して再設定する。
5. 3保存先の確定／途中状態を読み取りで照合。二重送信を避け、未確定操作は既存の同一ID回復方式で扱う。受付再開が必要な回復は対象と手順を別途承認する。行削除、Git reset、force pushは復旧手順に含めない。
6. 表示・停止往復確認を再度行い、運営確認と明示承認後だけ受付を再開する。停止／復帰時刻、版、確認結果を記録する。

## 根拠と今回の検証範囲

2026-10-12に [Cloudflare Builds設定](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)、[Secretと配備](https://developers.cloudflare.com/workers/configuration/secrets/)、[ロールバック](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/) とインストール済みWranglerの必須Secret検証実装を参照した。アカウントの実状態・Googleの現時点の配備／停止状態は確認していない。

文書のみの変更。前フェーズの59件テスト・型チェック・ビルド・dry-runは再実行せず、文書リンクと差分を確認する。今回作成した手順書は実環境で検証済みの手順という意味ではない。
