# Cloudflare実装の引き継ぎ確認

2026-10-11。既存の未コミット変更を保持し、コード・UI・設定・依存・既存仕様文書を変更せず、ローカル生成と検証を再実施した。Cloudflare・Googleへの接続、配備、Secret登録、実応募送信、Git add / commit / pushは行っていない。

## A. 完成している範囲

- Workerは同一オリジン `POST /api/entry` を受け、Secretから取得するApps Script URLへ本番モード・大会IDを付与して転送する。
- 本番ブラウザ用クライアントとHTML Service用の `google.script.run` クライアントを分離し、`appsScriptMode` で選択している。
- 確定応答の検証、受付完了表示、重複・認証失敗・結果不明の扱い、同一操作IDによる再確認を実装している。
- Apps Script検証用の `Code.gs`・`Index.html`・マニフェストを生成できた。生成HTMLにはHTML Serviceフラグ、`script.run`、`handleProduction` があり、画面側も専用クライアントを選択する。実際のGoogle環境での再配備・再実行はしていない。

## B. 今回の検証結果と未検証

| 確認 | 結果 |
| --- | --- |
| `npm run build:production` | Code.gs・マニフェスト生成成功。HTMLはsandboxのrealpath EPERMで失敗 |
| `npm run build:production-web` のsandbox外再実行 | HTML生成成功。コード修正なし |
| TypeScript `tsc --noEmit` | 成功 |
| `npm test` | 59件成功、失敗・スキップ0件。引き継ぎ文の58件ではなく現在は59件 |
| `npm run build` | sandbox内ではrealpath EPERM。sandbox外の同じコマンドで成功 |
| Wrangler `deploy --dry-run` | 成功。初回の既定ログ出力EPERMは、プロジェクト内ログ先を指定したsandbox外再実行で解消。実配備なし |
| 生成HTML・本番JS | Apps Scriptの実URLなし。本番JSに `/api/entry` を確認 |
| `git diff --check` | 成功。READMEのLF→CRLF予告のみ |

今回はWranglerローカルサーバーのHTTP確認は再実施していない。前回の `/` が200、Secret未設定のAPIが `CONFIG` という記録は `cloudflare-deployment.md` にある。今回も模擬上流によるWorkerテストでSecret未設定時の拒否を確認した。

CloudflareからApps Scriptへの実通信、Cloudflare経由の全形式・4～6名の保存・読込・編集・回復、スマートフォン実機、Google側の現時点の受付停止・共有設定は今回未検証。過去の実環境検証と今回のローカル検証を区別する。

## C. Gitと文書の注意点

Git管理対象は `.gitignore`・`.gitattributes`・`README.md` の3ファイルだけであり、README以外の実装・文書は未追跡。したがって通常の `git diff` では前チャットの変更単位や「25ファイル、+575/-49」を再現できない。関連する未追跡ソース・テストも直接読んで確認した。過去のチャット終了時との完全な差分比較はできない。

`.wrangler/` はignore対象外で、`state/v3` 配下にMiniflareのローカル状態SQLite等を含む。ソースとしてリポジトリへ含める必要はなく、現状は削除せず保持した。Git操作前に対象から除く必要がある。`.gitignore` の変更も行っていない。今回のWrangler確認ログは既存の `*.log` で除外される。

関連正本には次の現在地の食い違いが残る。新しい仕様を推測で採用せず、既存文書はそのまま保持した。

- `entry-flow.md` のPhase 2説明に「受付完了は保存未実装」とあり、末尾の本番フロー説明と現在地が異なる。
- `requirements.md` の受付・修正節に本番認証保存先・権限が未確定とあり、同書の保存情報の保持と共有節・本番設定手順の所有者限定という現在地と異なる。
- `implementation-plan.md` に「公開URL…決定済み」とあり、`production-launch-plan.md` の正式URL未決定と食い違う。Cloudflare公開方式の決定と正式URLの確定を区別する必要がある。
- `production-launch-plan.md` は本番照会制限値を未検証・未決定の一覧に含めているが、設定手順では全体200要求/分・同一受付番号の認証失敗5回/分を採用済み。採用値と実運用での検証を区別する必要がある。

確認したCloudflare通信経路について、再開を妨げる機能上の問題は見つからなかった。上記は文書の現在地の整理事項として残し、仕様・実装の追加変更はしていない。

## D. 本番反映前に残る作業

1. 文書の現在地の食い違いを、採用済み事項と未決定事項を区別して整理する。
2. Gitへ含めるソース・生成物の範囲を確認する。`.wrangler/`、秘密情報、実応募情報を含めない。Git操作は別途承認が必要。
3. Cloudflareの対象アカウント・権限、GitHub Appのリポジトリ限定認可、本番ブランチ、Worker、Workers Builds設定、正式URLを具体化する。
4. 別途承認後、本番ランタイムSecretを登録し、Apps Scriptの受付停止を維持したまま初回配備と停止応答を確認する。プレビューには本番URLを登録しない。
5. 許可された架空データでCloudflareからGoogleまでの往復・異常系を確認し、保存先・認証情報の非混入・共有範囲・ログ・スマートフォン表示を確認する。
6. 正式URL案内と旧公開先の扱い、障害時の受付停止、未確定の運営対応を確認する。受付開始は別途明示承認を得て実施する。

今回の書き込み対象は本記録、生成コマンドの既存出力先（`apps-script/generated/Code.gs`、`apps-script/production-generated/`、Git除外済みの `dist/`）、Git除外済みのWrangler確認ログである。既存のアプリソース・UI・設定・依存・ignoreファイルは変更していない。
