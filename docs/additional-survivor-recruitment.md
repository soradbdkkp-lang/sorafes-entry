# サバイバー追加募集（2026-10-24）

ユーザーは通常締切後に「1人で応募」「2人で応募」のサバイバー新規応募だけを翌日23:59まで受け付け、既存応募の編集期限は延長しない方針を了承した。本書を今回の受付期間変更の正本とし、過去の全形式共通締切の記述より優先する。

## 確定した受付条件

すべて日本時間。通常応募と編集は既存実装どおり2026-10-24 23:59:00未満まで。追加募集は2026-10-25 00:00:00以上、同日23:59:00未満まで。23:59の判定は既存の秒単位の境界を踏襲する。10月24日23:59:00〜翌日00:00:00は新規・更新とも受け付けない。

- 追加募集で許可する新規応募はsolo/1名、duo/2名で、全員がサバイバー担当の場合のみ。
- killer、survivors、team形式と、solo/duo内のキラー担当可能者を含む新規応募は拒否する。
- 既存応募の更新期限は通常締切のまま。追加募集で受け付けた応募も編集できないことを画面と保存票で案内する。
- 締切前に受理した同一操作の再送・recover、確定済み結果の再確認、認証付きreadは維持する。新しい操作IDの更新は許可しない。
- 人数上限に達した時の自動停止は追加しない。「追加で1、2名」という運営上の募集人数と、フォームの1人・2人の応募形式は別の意味として扱う。
- 通常応募と同じ重複チェック、認証、採番、保存先、操作IDによる回復を使う。

## 実装・検証

`src/config/entry-window.ts` に期間と判定を分離し、Apps Scriptの新規受付判定と本番UIで共用する。本番UIは1秒ごとに時計を再確認し、対象外の形式・キラー担当選択と送信を制限する。端末時計に関係なく、最終判定はApps Scriptの排他範囲内で行う。開いたままの旧画面からも対象外の新規・更新を保存できない。

`settings.deadline` は追加募集締切を返す。既存の `PRODUCTION_DEADLINE_UTC` は通常応募・編集締切の検査値として維持し、プロパティの変更は不要。`PRODUCTION_ENABLED=false` の停止判定も維持する。

ローカル模擬環境で、通常締切直前・一致・直後、追加開始直前・一致、追加締切直前・一致・直後の全5形式、更新、キラー担当を含む応募の拒否、拒否時の保存先・採番不変、締切後の同一操作回復を検証する。UIのイベント試験では時計の進行による送信停止と既存応募読込後の更新拒否も確認する。実応募データ・外部サービスには接続しない。

## 本番反映手順

1. ローカルテスト・ビルドを完了し、今回の変更だけを確認する。
2. 本番反映とGit add / commit / pushの承認後、生成した `apps-script/production-generated/Code.gs` を既存の本番保存Apps Scriptへ反映し、同じWebアプリの新バージョンへ更新する。URL・実行者・アクセス権を維持する。既存のIndex.html、マニフェスト、試験・管理Apps Scriptは変更しない。
3. settingsで追加締切を返すことを確認する。PRODUCTION_ENABLED、NEXT、保存先ID、Secret、共有設定、既存応募行は手動変更しない。
4. 今回の対象ファイルをcommit / pushし、既存Workers Buildsで本番UIを反映する。管理機能やWorker中継の変更は不要。
5. 正式画面の表示とsettingsを読み取り確認する。実応募の送信試験は行わない。日付変更後は対象2形式・サバイバー限定・編集終了、追加締切後は全形式の送信終了を確認する。

バックエンド反映だけでは画面の選択肢は変わらず、UI反映だけでは追加応募を保存できない。両方の反映が必要。本番の変更前には対象の現行コード・配備版を確認し、ローカルとの相違があれば上書きせず報告する。

ローカル検証時点では本番未反映。以降の承認と本番操作の記録を以下に追記する。実ブラウザーでの日付変更の動作は未検証。

## ローカル検証結果

2026-10-24実施。`npm test` は99件すべて合格。`npm run build`、`npm run build:production-apps-script`、`git diff --check` は成功。生成されたCode.gsとdistは既存ignoreの対象であることも確認した。依存追加・Git設定変更はない。

変更ファイル：

- `apps-script/production-server.ts`：保存側の新規受付期間と形式・ロール制限、settingsの追加締切。
- `src/config/entry-window.ts`、`src/use-entry-clock.ts`：共通判定と画面時計。
- `src/App.tsx`、`src/components/LocalEntry.tsx`、`src/components/Completion.tsx`：対象外形式の受付終了、送信制御、編集終了、期限・保存票案内。
- `tests/production-google.test.mjs`、`tests/recovery-ui.test.mjs`、`tests/step-navigation.test.mjs`：制御時計を使った境界・回復・画面イベント試験。
- 本書、`docs/README.md`、`docs/requirements.md`、`docs/production-operations.md`、`docs/production-apps-script-setup.md`：今回の決定・実装状態・反映手順。

## 本番反映の進行記録（2026-10-24）

ユーザーはApps Script更新・再配備と、今回の変更のGit add / commit / pushによる本番反映を承認した。Windows版Chromeの操作はURL判定のため2回自動停止し、変更なしで終了。その後、ユーザーがCodex内ブラウザーで本番Apps Scriptを開き直し、作業を再開した。

既存本番コードは、改行を揃えた全文がローカルHEADのコードを同じstrict設定で生成した結果と一致した。更新コードもローカルの生成物と全文一致を確認して保存した。既存Webアプリをバージョン2から **バージョン3（2026/10/24 22:53 JST）** へ更新し、配備成功を確認。同じWebアプリのURL・所有者実行・全員アクセスを維持し、既存Index.html・マニフェスト・プロパティ・共有・保存行は変更していない。

本番WorkerのsettingsはHTTP 200、ok:true、Cache-Control:no-store、deadline:2026-10-25T14:59:00.000Zを返した。設定確認に伴うPRODUCTION_TRAFFICの自動更新のみ。応募のcreate/update/read/recoverは実行していない。

GitHub mainは750e3d2、ローカルHEADはe2825f4で、差は既存の管理機能検証の文書commit1件のみ。既存commitを改変せず今回のcommitを積む。今回のcommit・pushとWorkers Buildsによる画面反映は、この記録の次工程。
