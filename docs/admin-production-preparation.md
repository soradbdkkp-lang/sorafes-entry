# 運営管理の認証・読取バックエンド準備

## 2026-10-13 readonly読取修正完了

以下の停止原因を修正した。管理用Apps ScriptのみをAdvanced Sheets Service v4のSheets.Spreadsheets.Values.batchGetへ変更。ADMIN_AUTH_IDが指す本番認証管理ファイルの「認証管理」B:C（状態・受付番号）とE（操作JSON）を1回で取得する。他ファイルIDは不要。A（記録日時）とD（認証管理JSON）は取得しない。操作JSONから従来の最新committed投影を行い、preparedのみ・試験5IDを除外する。

manifestのdependencies.enabledAdvancedServicesにSheets/sheets/v4を設定。OAuth scopeはspreadsheets.readonlyのみで、書込scope・external_requestは追加しない。Google側のサービス一覧でもSheets登録を確認。

独立管理Web Appを既存配備のversion 2（画面表示2026/10/13 1:27 JST）へ更新。同じexec URLを維持し、Worker Secret4件は変更なし。追加の認可画面は出ず、正しい共有SecretのPOSTはok:true、通常表示0件を確認。無Secret・誤Secret POSTはDENIEDでentriesなし。GETはdoGet未定義でデータなし。応募情報・Secret・配備URL実値は記録していない。

readonly権限による実読取が成功し、既知の読取阻害要因は解消。実環境の通常対象は0件のため、内容表示・最新版判定は架空データのローカルテストで確認する。本番管理UI・Cookie・Durable Objectの実環境検証は管理コード配備後の残工程。ADMIN_ENABLED=falseを維持し、Worker設定変更・deploy・pushは行っていない。

全91テスト、型チェック、production build、Wrangler dry-run成功。sandboxのVite EPERMは承認後の再実行で解消。変更は管理読取ソース・生成スクリプト・管理テスト・関連文書のみ。既存保存処理・採番・recover・Spreadsheet行・PRODUCTION_ENABLED/NEXTは未変更。今回commit指示はないため変更は未commit。push候補には今回修正を含めて別途確定し、公開前にfalseの反映と本番binding/migrationを確認する。

## 2026-10-13 本番設定準備結果：公開不可・停止

対象commit `d2979c3704fafcd1104a1f54d3015d51289bb113` は未push。以下を最新状態とし、本文の外部未実施という記録はローカル実装時の履歴とする。

- 独立「sorafes-entry 運営応募読取」をWeb App version 1として新規配備。所有者実行・全員アクセス、manifestはspreadsheets.readonlyのみ。既存保存Apps Scriptは未変更。
- Script PropertiesのADMIN_RELAY_SECRET・ADMIN_AUTH_IDはユーザー入力・保存後に設定存在を確認。実値は記録しない。
- Worker管理Secret4件を暗号化済みとして確認。ADMIN_PASSWORD・ADMIN_SESSION_SECRET・ADMIN_RELAY_SECRETはユーザー入力、ADMIN_APPS_SCRIPT_URLは新規配備先。暗号化された値の長さ・両側の一致は独立検証できていない。
- ADMIN_ENABLED=falseとSecretはSaveで次回配備用に準備。deployは実行していない。確認時点の稼働版は9e8b7dabが100%、既存commit 190ce8d32dcf289041db7b0ab324f359c06b6085。新しい設定の本番実行環境への反映とは区別する。
- ADMIN_AUTH / AdminAuth / admin-auth-v1（new_sqlite_classes）はローカル設定済み。本番binding・migrationは未適用。初回の管理コード配備時に専用SQLite Durable Objectを作成する。既存応募ストレージの移行はない。
- 管理Apps Scriptの直接GETはデータなし。無Secret・誤Secret POSTはDENIED、応募データなし（HTTP 200の拒否JSON）。正しい共有Secretでもok:falseとなり、正常読取は失敗した。
- 現行本番の管理API GETは404でデータなし。管理URLは既存SPAのフォールバック。管理コード反映後はADMIN_ENABLED=falseならloginを含む管理経路を403、有効化後も管理APIは未認証403とする。
- 応募者トップGETは200、既存応募APIのGETは405。正式応募送信・recover・シート行編集・PRODUCTION_ENABLED/NEXT変更は行っていない。

### 停止理由と修正提案（未実施）

管理読取コードのSpreadsheetApp.openByIdはGoogle公式仕様でspreadsheetsスコープを要求し、現在のreadonly manifestと不整合。正常読取失敗を確認したが、Google実行ログの例外詳細は未確認。readonlyだけでこのメソッドが動くとした前工程の判断を訂正する。書込スコープを追加せず、AGENTS.mdの「要件と実装が矛盾する場合は作業を止め、矛盾と影響を報告する」に従って停止した。

修正案は、独立管理用コードだけをGoogle Sheets APIのvalues.getによるGET読取へ変更すること。spreadsheets.readonlyを保持し、UrlFetchAppに必要なscript.external_requestを追加する。ローカル実装・検証後、管理用だけの再認可・再配備・正常読取確認が必要。現時点で採用・変更・追加権限付与はしていない。

将来のWrangler deployではダッシュボードのVariable保持を確認すること。keep-varsなしではADMIN_ENABLEDが上書きされ得る（欠落しても403）。Secretsは別扱い。公開前にfalseの実反映、認証・正常読取・試験除外・最新版判定を再確認する。

参照：[SpreadsheetApp.openById](https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet-app#openById(String))、[Sheets values.getのreadonly scope](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get)、[UrlFetchAppの必要scope](https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app)、[Wrangler deploy keep-vars](https://developers.cloudflare.com/workers/wrangler/commands/workers/)。

2026-10-12。ユーザーはCloudflare Zero Trust / Accessを使用しない方針へ変更した。Workerの単一運営者パスワード認証へ切り替え、ローカル実装・テスト・commitまで承認。push・本番設定・Google操作は今回行わない。対象初期commitは `68a80c0cab28596d07374a17af84c917bba1d0f1`。

## 採用した構成

`/admin/login` → POST `/api/admin/login` → Worker内パスワード照合 → 署名付きセッションCookie → `/admin/entries`・GET `/api/admin/entries`。ログアウトはPOST `/api/admin/logout`。

認証された管理APIだけが、専用Apps ScriptへHTTPS POSTし、管理共有Secretを付与する。Spreadsheetをブラウザから直接読まない。応募者用 `/`・`/api/entry`、保存・編集・recover・採番・保存Apps Scriptは変更しない。

- Worker Secretの管理パスワードをHMACに変換し、Web Cryptoのverifyで照合する。比較用鍵・セッション署名鍵・IP識別鍵は用途別に分離する。
- Cookieは `__Host-sorafes-admin`、`HttpOnly; Secure; SameSite=Strict; Path=/`、Domain指定なし。ランダム256bitのセッションID・有効期限・HMAC-SHA256署名を持つ。署名対象にはホストを含む。内容にパスワード・共有Secret・応募データを入れない。
- 有効期限は発行から1時間、延長なし。署名改ざん、期限切れ、別ホスト、重複Cookie、ストレージにないIDを拒否する。パスワードまたは署名Secretの変更でも旧Cookieは無効になる。
- Worker内のSQLite-backed Durable Object `AdminAuth` を内部binding `ADMIN_AUTH` で使用。公開URLは持たない。単一Objectのtransactionで試行回数とセッションを永続管理し、拠点やisolateごとに制限が分散しないようにする。
- ログアウトはサーバーのセッションを失効させ、CookieをMax-Age=0で削除する。コピーした旧Cookieも再利用不可。失効処理に失敗した場合は503を返し、成功表示しない。
- 同時セッションは最大10件。新規発行時に上限なら最古のセッションを失効。期限切れデータは次回アクセス時に整理する。
- ログイン試行は成功・失敗を問わず、直近60秒のIP単位5回、全体20回。超過時429とRetry-After:60。制限を通過した試行のみ記録するため記録は最大20件。制限中の要求で待ち時間を延長しない。生IPは保存せず用途別HMACだけを一時保持する。
- IPはCloudflareが付与するCF-Connecting-IPだけを使う。欠落時は拒否。X-Forwarded-For等を代用しない。攻撃によって全体枠が消費されると運営者も一時的にログインできないが、恒久ロックにはしない。
- POSTは同一Originを必須とし、Sec-Fetch-Siteのcross-site/same-siteを拒否する。ログイン本文はストリーム読取を1024byteに制限。HTTPS以外は拒否する。Cookieを必要とするUI/APIはno-store。管理HTMLにframe-ancestors none等を付ける。
- 認証設定・binding不足、Cookie欠落・不正、セッション確認障害は403で閉じる。ログイン/ログアウトのストレージ処理失敗は503、データなし。認証後の読取バックエンド設定不足は503、上流異常は502。
- UIはパスワードを入力中のReactメモリにだけ保持し、送信開始時に入力欄を消す。LocalStorage・SessionStorageへ保存しない。ログアウト開始時に応募表示を消し、遅れて到着する取得応答を無視する。履歴キャッシュ復帰時は再取得する。

## 必要Secret / Variable / binding

| 場所 | 名前 | 用途・条件 |
| --- | --- | --- |
| Worker Secret | `ADMIN_PASSWORD` | 運営者1人用。20～256byte。パスワード管理ツールで生成する十分に長いランダム値を推奨 |
| Worker Secret | `ADMIN_SESSION_SECRET` | セッション署名等に使う専用乱数32byte・64桁hex。パスワード／共有Secretと別値 |
| Worker Secret | `ADMIN_APPS_SCRIPT_URL` | 独立読取Apps Scriptのexec URL |
| Worker Secret | `ADMIN_RELAY_SECRET` | 管理Apps Scriptとの共有Secret、32文字以上。専用乱数を使用 |
| Worker Variable | `ADMIN_ENABLED` | 準備中false。有効化は後工程で明示承認後にtrue |
| Worker binding | `ADMIN_AUTH` | `AdminAuth` Durable Object。migration `admin-auth-v1`、new_sqlite_classesを使用 |
| 管理Apps Script Property | `ADMIN_RELAY_SECRET` | Worker側と同一の管理共有Secret |
| 管理Apps Script Property | `ADMIN_AUTH_ID` | 既存本番認証管理ファイルを参照するID |

既存Worker Secret `SORAFES_PRODUCTION_APPS_SCRIPT_URL` は変更しない。管理SecretをVITE変数・Build変数・ソース・Git・文書・チャットへ入れない。今回の試験値は明確な架空値だけで、本番Secretは取得・設定していない。新しい依存のinstall/updateなし。

## Accessからの変更・廃止

| 対象 | 変更 |
| --- | --- |
| `worker/admin.mjs` | Access JWT解析・RSA公開鍵取得・authorizedを削除。Cookie認証とログイン/ログアウトAPIへ置換 |
| `worker/admin-session.mjs` | HMAC署名、パスワード照合、セッション、レート制限の内部ストアを追加 |
| `worker/index.mjs` | 内部Durable Object classをexport。既存応募relayは未変更 |
| `wrangler.jsonc` | ADMIN_AUTH bindingとSQLite migrationを追加。静的管理パスのWorker優先を維持 |
| `ADMIN_ACCESS_ISSUER` / `ADMIN_ACCESS_AUD` | 使用しない。今回外部未登録、後工程でも不要 |
| `Cf-Access-Jwt-Assertion` | 認証根拠として使用しない。旧ヘッダーだけでは403 |
| React | ログイン画面、ログアウト、再ログイン導線、履歴復帰の再取得を追加 |
| テスト | Access認証試験をセッション認証試験へ置換。既存応募78テストを維持 |

Zero Trustの契約・支払情報登録・メール許可ポリシー・issuer・AUDは不要。これまでのAccess向け案は履歴となる。

## 管理Apps Scriptの現在地と直接迂回拒否

前工程で新規「sorafes-entry 運営応募読取」を作成し、対象初期commitから生成したコードとreadonly manifestを配置・一致確認済み。配備・認可・プロパティ設定は未完了という前工程記録を保持する。入力欄だけを用意してユーザーへ引き継いだ後の設定状態は今回再取得していない。

現行のHTTPS POST本文共有Secret方式は変更しない。欠落・誤Secretはシートを開く前にDENIED。GET用doGetはないためURLを開くだけではデータを返さない。拒否はJSON ok:falseで、Apps Script ContentServiceのHTTP 200を成功と混同しない。

共有Secretを知る者は直接呼べるため、ネットワークの送信元証明ではなくSecretによるサーバー間認証として扱う。Script Property・Worker Secretの権限を所有者限定に保ち、漏洩時は両側で更新する。スプレッドシートのreadonlyスコープ、committed最新版、prepared除外、試験5ID除外、認証検証値の非配信を維持する。

## 後工程の本番反映順序（今回未実施）

1. 所有者限定の独立Apps Scriptへ共有Secret・読取元IDを設定し、readonly認可・所有者実行の専用Webアプリとして配備する。既存保存Apps Scriptや既存プロパティは編集しない。
2. 直接GET、無Secret／誤Secret POST、正しい共有Secretの読取を検証。応募情報はGit・通常ログ・チャットへ転記しない。
3. Workerの管理用4 SecretとADMIN_ENABLED=falseを、本番の既存コード・Assets・既存Secretを維持する方法で準備する。CLIのsecret putは配備を伴い得るため、未承認のローカルコード配備に使わない。
4. SQLite-backed Durable Object binding/migrationを含む最終差分、Workers側の利用条件・枠、設定値の整合を確認する。管理用リソースの本番作成・配備は別途承認が必要。Accessの準備は不要。
5. 管理commit群のpushを明示承認後、Workers Buildsで反映。ADMIN_ENABLED=falseで管理UI/APIが403、応募者側が従来どおりであることを確認。
6. 設定完了を確認して別途承認後にADMIN_ENABLED=true。HTTPSログイン、誤パスワード、試行制限、Cookie属性、一覧・詳細、未認証API、ログアウト後再利用拒否、試験除外・最新確定版、シート不変を実環境で検証する。正式応募は送信しない。

Wrangler run_worker_firstの `/admin`・`/admin/*`・`/api/*` を維持する。Custom Domainやpreviewなど別到達ホストの追加時も、同じWorker認証・同一ホスト署名を適用する。Vite開発サーバーは認証境界ではなく、本番公開しない。

## ローカル検証

- 全テスト：91件成功（既存応募78件維持）。Cookie属性、改ざん、重複Cookie、期限、別ホスト、設定欠落、旧Accessヘッダー拒否、Origin、HTTP拒否、失効、鍵変更、レート制限・同時要求・再起動・時間経過、バックエンド異常、UI成功／失敗を確認。
- `node scripts/verify-admin-runtime.mjs`：既存Wrangler同梱Miniflare/workerdのSQLite Durable Objectでログイン・画面/API保護・バックエンド未設定拒否・失効・試行制限を確認。実Secret・Google通信なし。Windows sandboxのSQLiteアクセス拒否は承認後の実行で解消。
- 型チェック・production build・Wrangler dry-run成功。Viteのsandbox realpath EPERMは承認後の実行で解消。
- diff --checkと変更対象のSecret検査、静的配信物に認証値がないことを確認。

未検証：実ブラウザでのCookie保存・操作・スマホ表示、本番のDurable Object配備と枠、実HTTPSとSecret登録、管理Apps Script実配備・Google readonly認可・実データ経路。ローカル検証成功を本番公開可とは扱わない。

今回の変更対象：worker/admin.mjs、worker/admin-session.mjs、worker/index.mjs、wrangler.jsonc、src/main.tsx、src/admin/Login.tsx、src/admin/Entries.tsx、tests/admin.test.mjs、tests/admin-login-ui.test.mjs、scripts/verify-admin-runtime.mjs、関連文書4件。前工程の未commit文書を今回の変更方針へ更新して含める。

公式参照：[Durable Object SQLite](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/)、[Cookie属性](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)。
