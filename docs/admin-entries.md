# 運営専用 応募管理（ローカル初期版）

2026-10-12。ユーザー承認範囲は設計・ローカル実装・検証・commitまで。push、配備、Cloudflare Access設定、Google操作は行わない。受付稼働中、試験5件・正式0件、ENABLED=true／NEXT="5" はユーザー申告の現在地であり、今回外部再取得していない。

## 調査と採用構成

- 保存JSONはDraft（kind/count/teamName/representative/time/players）。playersは名前・X ID・ゲームID・環境・時間・キラー担当・キラーID・大会経験と実績を持つ。代表者は0始まりの配列添字。
- 応募一覧は最新投影だが、書込途中ではpendingになる。履歴にはprepared処理でも原本が先に追加されるため、履歴だけで確定判定しない。
- 認証管理は認証検証情報と操作記録の追記ログ。既存保存処理は順にMapへ上書きして最新版を復元し、確定前の編集中は旧確定draftを保持する。
- 独立読取Apps Scriptでは認証管理の操作IDごとの最終状態を復元し、committedの最大版のみを採用する。preparedだけの新規応募は除外。prepared編集中は旧committed版を表示。初版のadmittedAtを応募日時、最新版のadmittedAtを最終更新日時とする（いずれも処理受付日時）。
- 認証JSONはブラウザへ返さない。独立スクリプトはシート・プロパティ書込み、採番、recover、保存API呼出しを持たない。
- React内の `/admin/entries` を採用。カード一覧とネイティブdetailsによる詳細展開でルーター依存を追加しない。検索は応募ID・全メンバー名・X ID・チーム名を対象とする。欠損は未記録表示。
- 同一オリジンGET `/api/admin/entries` → Worker → 専用Apps Script doPost → 認証管理を読取。APIはno-store、秘密値・余剰フィールドを除いた構造化JSONを返す。
- 試験ID FAC-2026-000001〜000005は完全一致集合でサーバー側除外し、WorkerとUIでも防御的に除外する。データ削除なし。

## 認証案と本番前の外部設定（未実施・最終決定待ち）

第一候補はパス単位のCloudflare Access。`/admin`、`/admin/*`、`/api/admin`、`/api/admin/*` を同じ運営限定ポリシーで保護し、運営の許可アカウントとMFA・セッション長を決める。応募者用 `/` と `/api/entry` は保護対象に含めない。

WorkerはAccess JWTのRS256署名・iss・aud・exp・iat・nbfを検証する。ヘッダーの存在だけでは認証しない。未設定時と検証失敗時は403。静的資産より先に `/admin` をWorkerで処理する。通常のVite開発サーバーは認証境界ではなく、本番配備には使用しない。

代替案は別管理Worker／ホストをAccessで全面保護し、応募者配信と分離する方式。独自ログインはセッション・失効等の追加実装が必要なため初期候補にはしない。

公式根拠：[Access JWT検証](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)。認証案のローカル実装は本番方式の最終採用や外部設定の承認を意味しない。

本番前に必要な作業：

1. 運営アカウントとAccess方式を確定し、全到達ホスト（workers.dev・独自ドメイン・プレビュー）で保護または迂回経路無効化を確認する。
2. 独立Apps Scriptを所有者で作成。`node scripts/build-admin-apps-script.mjs` の `.wrangler/admin-apps-script/` 出力を使用。スプレッドシートreadonlyスコープ、`ADMIN_AUTH_ID` と推測困難な32文字以上の `ADMIN_RELAY_SECRET` を設定。既存保存スクリプトへ上書きしない。
3. Workerへ `ADMIN_ACCESS_ISSUER`（https://チーム名.cloudflareaccess.com）、`ADMIN_ACCESS_AUD`、Secret `ADMIN_APPS_SCRIPT_URL` と `ADMIN_RELAY_SECRET` を設定。値はGit・VITE変数・ログへ保存しない。
4. Accessポリシーと迂回拒否を確かめてから `ADMIN_ENABLED=true` を設定する。設定がない間は拒否する。
5. 未認証・非運営・期限切れ・直API・直接Apps Scriptの拒否、許可運営の表示と既存応募処理を実環境で検証する。実行前に別途承認する。

## 検証結果と制限

既存78件を維持し、新規6件を含む84テスト成功。committed、prepared、試験5ID、最新編集、個人・6人・キラー・欠損・検索、詳細HTMLとエスケープ、認証拒否と署名、API異常、独立Apps Script読取を架空データで確認。型チェック・production build・Wrangler dry-run成功。Viteのsandbox EPERMは承認後の実行で解消。管理Apps Script生成成功。diff --check、変更対象の秘密混入検査を実施。

未検証：PC／スマホの実ブラウザでの表示・操作、実Access、Googleのreadonly権限と実データ接続、データ量増加時の応答時間・割当。初期版は全件取得・検索のため増加時はページングを検討する。JWT公開鍵は要求ごとに取得し、障害時は拒否する。実データ・認証情報の保存やログ出力は行わない。

既存新規・編集・recover・採番・保存処理は未変更。PRODUCTION_ENABLED／NEXT、Googleデータ、共有権限、Cloudflare外部設定は未操作。本番未反映、pushなし。

変更対象：src/adminの4ファイル、src/main.tsx、worker/admin.mjs、worker/index.mjs、wrangler.jsonc、apps-script/admin-server.ts、scripts/build-admin-apps-script.mjs、tests/admin.test.mjs、本書、docs/README.md、DESIGN.md。
