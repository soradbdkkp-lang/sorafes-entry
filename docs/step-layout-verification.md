# STEPと既存応募入口の配置分離（2026-10-12）

## 原因と変更

LocalEntryをform-panel内に常時配置していたため、STEP 1〜7では本文より先に既存応募の認証・保存結果確認が現れていた。STEP変更時はfocusのみで、見出しが既に可視の場合などに位置が揃わなかった。

新規STEP領域の後へLocalEntryを移し、「既に応募済みの方」を全STEPで常設する。単一のコントローラーを常時マウントし、STEP 8の確認内容直後の専用DOM領域にReact portalで送信準備を表示する。依存追加なし。既存応募の読込・recoverボタンはSTEP内に表示しない。生成・保存確認・送信ボタンはSTEP 8に維持する。

見出しをpreventScrollでfocus後、scrollIntoViewのstart/instantで位置を揃える。scroll-margin-topは4remとしてSTEP番号も見せる。既存Safe Area CSS・viewport設定は変更しない。

コード生成・read・create/update・recover・認証・操作ID・pending原本・committed処理・重複拒否・受付条件は変更なし。両表示で同じstate/refを使い、STEPの修正往復でコードや再確認IDを再生成しない。明示的な認証終了・既存応募読込時の更新用ID準備は既存どおり。

## 検証

- 既存75件＋追加3件＝全78テスト成功、失敗0。既存回復UIテストも分離したportal表示で実行するよう更新。
- 追加：STEP領域外への配置、STEP 8と下部入口の共存・状態保持、全STEPの次へ/戻る、確認画面から各修正先への見出しfocus/scroll。
- 既存の正常送信・読込更新・生成前/保存確認前の送信禁止・CLOSED・連打抑止・unknown/pending/recover各応答を回帰確認。
- ローカルproduction buildと外部上流通信を持たない模擬APIを使用。375px・390px・1280pxで架空6人チームを読み込み、全STEPを次へで進めた。各遷移後の見出し位置は上端から64px、横はみ出しなし、既存応募入口はSTEP外。
- 確認画面から応募形式・チーム情報・プレイヤー情報・担当ロール・実績・時間の全修正先で先頭表示を確認。STEP 1→2→3も未読込状態で確認。
- ローカル画面で未生成/未確認は送信無効、確認後は有効、新規模擬送信の完了、下部入口からreadとrecoverの完了を確認。JavaScriptエラー0。
- 型チェック・production build成功。Viteの初回realpath EPERMは権限制限のため権限付きで再実行し成功。Wrangler dry-run成功、実配備なし。
- Safe Areaのroot contain:paint/overflow:autoを維持し、CSS assetは従来と同じ。物理iPhone/Safariの実機再確認は未実施。

ローカル修正・テスト・commitのみ。本番送信・外部データ操作・Apps Script/Spreadsheet/Worker設定/Secret/受付有効値変更・依存追加・pushなし。既存eeef836/f6db68fを改変せず、新commitを上に積む。試験4IDの正式運営対象からの除外は維持。

最終差分確認：変更7ファイルのみ。diff --check成功。関連文書のローカルリンク45件に欠落なし。既知env長値・秘密鍵/APIキー/トークン/Apps Script実配備URLパターンの一致0。生成物・キャッシュ・envはcommit対象外。
