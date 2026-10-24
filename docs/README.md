# 設計ドキュメント索引

> 2026-10-24：通常締切後は10月25日0:00〜23:59に1人・2人のサバイバー新規応募だけを追加募集する方針を了承。既存応募の編集期限は延長しない。今回の変更・秒単位の境界・本番未反映の状態は [サバイバー追加募集](additional-survivor-recruitment.md) を優先する。

## 運営管理画面の本番検証完了（2026-10-14）

[本番有効化検証完了・通常利用可](admin-production-preparation.md#2026-10-14-本番有効化検証完了通常利用可)。正常ログイン、認証済みAPI正常0件、試験5ID除外、ログアウト後拒否、誤パスワード失敗、正式受付疎通に加え、ユーザーが本番CookieのHttpOnly / Secure / SameSite=Strictを実測。ADMIN_ENABLED=true、通常Version稼働、一時診断除去済み。2026-10-14、ユーザーが全検証完了を確定し、今回の確認セッションもログアウト・失効済みと報告。以下の準備中・停止中・未配備の記述は履歴。

## 管理画面の本番準備（2026-10-13）

最新：[readonly読取修正完了](admin-production-preparation.md#2026-10-13-readonly読取修正完了)。Advanced Sheets Service v4・readonly scopeのみへ変更し、管理Web App v2で正常読取成功。URL変更なし、Worker設定・pushなし。以下の停止記録は修正前の履歴。

[最新の準備結果](admin-production-preparation.md#2026-10-13-本番設定準備結果公開不可停止)：管理Apps Script v1配備、Worker管理Secret4件とADMIN_ENABLED=falseを次回配備用に保存。正常読取失敗とreadonly scopeの不整合を確認し停止。管理commitは未push、管理コード本番未反映。修正・再検証前は公開不可。

## 運営管理画面のローカル追加（2026-10-12）

最新の [認証・読取バックエンド準備](admin-production-preparation.md)：Access不採用へ変更。Worker内のパスワード・署名Cookie・セッション失効・永続試行制限をローカル実装。独立Apps Scriptとの共有Secretは維持。本番設定・Google操作・pushなし。Access向け記述は履歴。

[運営専用応募管理](admin-entries.md)：読み取り専用一覧・詳細・検索、試験5ID除外、最新committed判定、認証候補と未設定時拒否、独立読取API、ローカル検証。本番配備・外部設定・pushは未実施。

## 受付中の運用への移行（2026-10-12）

開発から正式受付後の運用へ移行する。最初の正式応募の照合、通常監視への移行条件、日常監視、次回バックアップ、締切境界検証、異常時対応は [受付中の運用正本](production-operations.md#正式受付後の運用2026-10-12) を参照。今回は関連文書4件だけをcommitし、push・本番操作は行わない。以下の開始時点・開始前の記録は履歴として保持する。

## 現在の分類訂正（2026-10-12・ユーザー確認）

`FAC-2026-000005` は正式応募ではなく確認用テスト応募。現在の分類は **試験5件・正式0件**。試験除外対象は `FAC-2026-000001`〜`FAC-2026-000005` の完全一致集合とし、集計・抽選・当選処理・連絡・編成・CSV等の正式運営対象から除外する。

`PRODUCTION_ENABLED=true`、`PRODUCTION_NEXT="5"` を維持する。応募行を削除・編集せず、採番を巻き戻さない。他の番号消費がなければ次の新規番号は `FAC-2026-000006`。直前の読取確認では応募一覧5行・履歴5行・認証10行（ヘッダー除外）。今回の分類訂正はユーザー申告に基づく文書変更のみで、外部状態の再取得・Googleデータ・コード・本番設定の変更は行わない。

以前の報告の「正式1件」は誤分類として訂正する。以下の受付開始時・開始前の試験4件／NEXT=4等は当時の履歴であり、現在の分類・除外集合・採番は本節を優先する。詳細は [本番運用ルール](production-operations.md#全試験応募の明示除外集合) を参照。


## 正式受付開始時の記録（2026-10-12・試験4件時点の履歴）

**正式受付開始済み・告知可能。** 有効化保存操作は **2026-10-12 17:01:08.431 JST**、保存後確認は **17:01:09.031 JST**。ユーザー報告で `PRODUCTION_ENABLED=true`、`PRODUCTION_NEXT="4"`、Worker settings HTTP 200／`ok:true`／`Cache-Control: no-store`、PC・スマホUI正常、STEP 8「応募を送信」の表示・有効を確認。

開始直後は正式応募0件・試験応募4件、保存先件数は開始前と一致。`PRODUCTION_TRAFFIC` のみ既存仕様で自動更新。確認用送信は未実施。試験ID `FAC-2026-000001`〜`FAC-2026-000004` の正式運営対象からの除外を維持する。詳細・告知可能判定・後続監視は [正式受付開始記録](production-final-readiness.md) を参照。告知の実施は未記録。

今回、外部環境の再取得・変更なし。関連Markdown5件のみcommitしてpush前で停止する。以下の停止継続・開始未実施・承認待ち・commitなし等は開始前の履歴として扱う。締切専用非本番検証（所有者、2026-10-23 18:00 JSTまで）は後続必須として維持。



> 最新（2026-10-12 開始直前）：[正式受付開始直前チェック](production-final-readiness.md)。判定は **B. 条件付き開始可、停止継続**。未送信UI分岐、バックアップ3点・所有者限定権限・原本一致、停止・採番・Version・Gitを確認済み。正式URLとバックアップ頻度・指定残リスク受容を反映。物理iPhoneのSafe Areaを含む未送信確認はユーザー報告で完了。最新直前照合も合格、正式開始の明示承認待ち。締切専用検証は所有者が10月23日18:00日本時間までに非本番で実施。以下の旧残条件は最新記録に従う。今回受付開始・pushなし。

> 運用整理（2026-10-12）：所有者担当、紛失・重複誤判定の相談保留、Xの3か月確認、年齢条件を追加しない方針を採用。試験4IDの全出力除外手順、未検証リスク分類、最小バックアップ案、正式URL案、停止・再開・開始直前チェックと条件付き開始可の判断は [最新の運用整理](production-operations.md#2026-10-12-開始前の運用確認と開始可否履歴) を参照。バックアップ頻度・URL正式採用・残リスク受容と直前確認は残条件。正式受付は開始せず、今回pushなし。

> 2026-10-12 最新：Cloudflare本番配備・GitHub / Workers Builds接続・回復UI本番反映は前工程で完了。承認済みのteam6・killer新規2件とキラーrecover1件を追加試験し、受付停止へ戻した。`PRODUCTION_ENABLED=false`、`PRODUCTION_NEXT=4`、Worker CLOSED。試験応募4件は保持し、運営出力から明示ID集合で除外する。最新の状態は [追加本番試験](production-additional-verification.md)、採番・除外の確定運用は [本番運用ルール](production-operations.md)、残る開始条件は [公開前チェックリスト](prelaunch-checklist.md) を参照。下記の接続未実施等と [最終監査](final-prelaunch-audit.md) の旧値は履歴。正式受付は開始していない。

Phase 4の架空データによるGoogle実環境試験まで実施し、専用APIは停止しました。続いてPhase 5の判定範囲・ID比較・一方だけ一致した場合の保留を確定し、架空データ専用のローカル試作を検証済みです。2026-10-11、本番用3保存先とApps Scriptを所有者限定で作成し、`FAC-2026-` 接頭辞修正後のバージョン2で架空データの保存・再確認・重複拒否・認証失敗を実環境検証しました。検証後は受付停止へ戻しています。正式公開はCloudflare Workers + Static Assetsから本番画面と同一オリジンAPIを提供し、裏側のApps Scriptへ保存する構成を採用してローカル実装・検証済みです。Cloudflare実環境への接続は完了済み、正式受付開始は未実施です。正式締切は2026年10月24日23:59（日本時間）、運営相談先は [@sora_kkp_game](https://x.com/sora_kkp_game)、初回大会のキラー選択肢はVol.1参照の43体と決定済みです。以下は仕様正本であり、本番DB・シート列・API仕様の最終確定書ではありません。実装範囲は implementation-plan.md を参照してください。

Phase 3の試験保存を接続し、全5応募形式と人数別の実保存・照合・再送、同時送信、入力拒否、保存後の応答切断とフォームの再確認を検証済み。2026-10-08にGoogle側の受付停止と保存内容不変も確認しました。試験APIは停止中です。試験構成は `apps-script-setup.md`、再開後の詳細結果は `phase3-verification.md` を参照し、本番仕様とは区別します。

| ファイル | 正本として扱う内容 |
| --- | --- |
| [requirements.md](requirements.md) | 共通要件、初回大会設定、取得情報、未確定事項 |
| [entry-submit-ux-verification.md](entry-submit-ux-verification.md) | STEP 8内の編集コード生成・保存確認・送信導線、認証保持、ローカル75テストと画面検証、本番未反映 |
| [step-layout-verification.md](step-layout-verification.md) | STEP外への既存応募入口分離、STEP先頭へのスクロール、ローカル78テスト・画面検証、本番未反映 |
| [entry-flow.md](entry-flow.md) | 画面順序、条件付き表示、確認・受付・編集・重複の導線 |
| [data-model.md](data-model.md) | 概念モデル、関係、責務、保存連携の境界 |
| [implementation-plan.md](implementation-plan.md) | フェーズ、依存関係、検証・公開条件 |
| [storage-integration.md](storage-integration.md) | Phase 3の保存連携設計案。保存先・権限・再送・保存期間の未確定事項 |
| [apps-script-setup.md](apps-script-setup.md) | 承認されたPhase 3試験構成、Google側の設定、試験手順・検証状況 |
| [phase3-verification.md](phase3-verification.md) | 再開後の実保存・照合・応答切断試験、自動テスト結果、未完了事項 |
| [phase4-design.md](phase4-design.md) | 受付番号・応募編集の採用済み運用、未確定の技術案、認証情報の分離、実装前の条件 |
| [phase4-technical-proposal.md](phase4-technical-proposal.md) | 採用した基本方式と未確定の技術詳細。送信前コード保存、認証、途中保存回復 |
| [phase4-local-checklist.md](phase4-local-checklist.md) | ローカル実装の作業範囲・検証計画 |
| [phase4-local-verification.md](phase4-local-verification.md) | ローカル実装の確認方法・実施結果・本番との差・未検証事項 |
| [phase4-google-test-plan.md](phase4-google-test-plan.md) | 承認済みのGoogle試験範囲と実施結果の概略。新規対象・権限・試験手順 |
| [phase4-google-setup.md](phase4-google-setup.md) | 専用Apps Scriptの設定、列構成、模擬検証と停止状態 |
| [phase4-google-verification.md](phase4-google-verification.md) | 架空データによる実保存・編集・回復、3保存先の照合、停止後拒否、未検証事項 |
| [phase5-design-proposal.md](phase5-design-proposal.md) | 重複応募チェックの採用済み判断、未決定の提案、今後の検証案 |
| [phase5-local-verification.md](phase5-local-verification.md) | 架空データによるローカル重複チェックの実装・検証結果と未確認事項 |
| [phase5-google-test-plan.md](phase5-google-test-plan.md) | Phase 5の架空データによるGoogle実環境試験の提案。対象・権限・検証・停止条件。未実施 |
| [production-launch-plan.md](production-launch-plan.md) | 初回公開から実応募を受け付けるための現在地、本番サイト構成、Google保存経路、公開前チェック |
| [production-apps-script-setup.md](production-apps-script-setup.md) | 採用したApps Script Webアプリ方式の配置物、保存先の列構成、設定、配備・検証順序 |
| [production-google-verification.md](production-google-verification.md) | `FAC-2026-` 修正後の再配備、架空データ保存、再確認、重複・認証失敗、停止復帰の実環境結果 |
| [production-additional-verification.md](production-additional-verification.md) | 2026-10-12のteam6・killer・確定済みrecoverの追加本番試験、3保存先照合、受付有効時間・停止復帰、未検証範囲 |
| [production-operations.md](production-operations.md) | 採番・全試験ID除外、運営手順、未検証リスク、バックアップ・URL案、障害・停止再開、開始直前チェックと条件付き開始可の判定 |
| [production-final-readiness.md](production-final-readiness.md) | 正式受付開始日時・開始直後状態・告知可能判定、開始前のUI・バックアップ・配備照合履歴、締切専用検証の担当期限 |
| [final-prelaunch-audit.md](final-prelaunch-audit.md) | 最終監査当時の確認結果と残課題。最新状態は各冒頭の補足を優先 |
| [recovery-ui-verification.md](recovery-ui-verification.md) | 回復UIの入力固定修正と71テストの過去検証結果、本番反映後の参照 |
| [cloudflare-deployment.md](cloudflare-deployment.md) | Cloudflare Workers + Static Assetsの本番構成、Secret、ローカル検証、外部設定前の手動手順 |
| [cloudflare-handoff-verification.md](cloudflare-handoff-verification.md) | 引き継ぎ時のローカル再検証結果と当時の文書不整合 |
| [git-file-inventory.md](git-file-inventory.md) | 公開前整理時点の未追跡ファイル全件とGit管理・生成物・除外提案の分類 |
| [prelaunch-checklist.md](prelaunch-checklist.md) | 文書の現在地整理、Git管理準備、Cloudflare手動設定と受付開始前の残作業 |
| [cloudflare-connection-runbook.md](cloudflare-connection-runbook.md) | 本番接続前の設定値、初回Secret配備の前提、停止中接続試験、保存試験の承認境界、ロールバック |
| [DESIGN.md](../DESIGN.md) | 視覚・操作設計、確認済み既存資料のパス、Vol.1から参考にする方針と意図的な差分 |
| [AGENTS.md](../AGENTS.md) | AIエージェントの作業範囲・開発ルール |
| [README.md](../README.md) | プロジェクト概要・現在地 |

仕様変更時は関係する正本を一緒に更新します。不一致があれば実装を止めて報告し、未確定事項は推測で埋めません。受付番号等の例は説明用であり正式仕様ではありません。

既存dbd-tournament-siteのデザイン資料は読み取り専用で確認済みです。参考資料の内容を全面採用せず、sorafes-entryの緑アクセントを含む確定判断は `DESIGN.md` を正本とします。Vol.1のコーラル系アクセントとの差は識別性のための意図的な差分です。
