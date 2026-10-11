# Phase 4 Google試験用Apps Scriptの準備

2026-10-08。試験の実施範囲は [phase4-google-test-plan.md](phase4-google-test-plan.md)。本番仕様・本番受付ではない。

## 作成済みのGoogle構成

- [sorafes-entry Phase4 認証試験](https://docs.google.com/spreadsheets/d/1i-zx49fwyERqaYotjAdXX5qoHlIRVjb9SfQOz5qpB44/edit)：`認証管理`、sheetId `1696651980`。所有者のみ、リンク共有なし。
- [sorafes-entry Phase4 履歴試験](https://docs.google.com/spreadsheets/d/1UjY9OwEQcTl5csrqogaN8dqAmw85eN14W4WX_GScfbo/edit)：`応募履歴`、sheetId `1062652268`。試験段階では所有者のみ、リンク共有なし。
- [応募用の専用試験タブ](https://docs.google.com/spreadsheets/d/1FU3cimJuHg5JGmJvVJpc-U0VNc4zTP5nB-DwiyW8VXE/edit#gid=1040800400)：`sorafes-entry_PHASE4_TEST_v1`、sheetId `1040800400`。既存のファイル共有設定を継承。
- [sorafes-entry Phase4 保存編集試験](https://script.google.com/home/projects/1OkNNdnJdTR_MczSmTDr-iYGJiGt23LP-ONy-rAV1fXW2mDHpN5LiSygx/edit)：独立した新規プロジェクト。コードと5プロパティを保存し、試験用に配備済み。試験終了後は `PHASE4_ENABLED=false`。

所有者はユーザー確認とGoogle UIで同一と確認した。上記2ファイルはMy Driveの既存 `ChatGPT` フォルダーに作成した。技術試験期限は設定時から24時間後の `2026-10-08T17:15:18.685Z` とした。正式応募締切を決定するものではなく、試験再開時に期限切れなら更新が必要。

配備時の確認にユーザーが「この設定で配備する」と回答した。実行者「自分」、アクセス「全員」、説明「Phase4 架空データ専用・初期停止」で配備を完了し、独立した試験用WebアプリURLを取得した。実URLはGit管理外とし、対象の試験Apps Scriptの「デプロイを管理」画面で確認する。Googleの権限承認後に保存試験を実施し、終了時に `PHASE4_ENABLED=false` へ戻した。2026-10-09に設定画面と停止後API応答を再確認した。

## コードと配備の境界

入力検証は共通の `src/storage/contract.ts` を使用する。専用ソースは `apps-script/phase4-server.ts`、生成コマンドは `node scripts/build-phase4-apps-script.mjs`、貼り付け対象は `apps-script/phase4-generated/Code.gs`。新しい独立プロジェクト `sorafes-entry Phase4 保存編集試験` で使用する。旧Phase 3プロジェクトには貼り付けない。

初期状態では受付を閉じる。ファイル作成・権限確認・設定完了後に試験用配備を行い、試験時のみ有効化する。配備の実行者は所有者とする。所有者のGoogleログイン・権限承認が必要な場合、その操作の完了を確認してから試験を開始する。

## スクリプトプロパティ

| 名前 | 内容 |
| --- | --- |
| `PHASE4_ENABLED` | 初期値と試験終了後は `false`。試験中のみ `true` |
| `PHASE4_TEST_KEY` | ユーザー指定に従い既存の試験キーを使用。値を文書・Git・ブラウザに保存しない |
| `PHASE4_AUTH_ID` | 新規の所有者限定認証ファイルID |
| `PHASE4_HISTORY_ID` | 新規の非公開履歴ファイルID。試験段階では所有者のみ |
| `PHASE4_DEADLINE_UTC` | 技術試験の期限をISO 8601 UTC形式で設定。正式応募締切とは別 |

`PHASE4_NEXT`、`PHASE4_TRAFFIC`、`PHASE4_FAIL_…` はサーバーが管理する。カウンターを初期化・巻き戻ししない。保存先IDの重複・不足や期限不正では閉じる。公開応募ファイルIDは指定済みファイルに固定する。

## 保存先の先頭行

空の専用ファイル／タブに以下の列を用意する。既存のタブに列を上書きしない。先頭行を固定し、列名の完全一致を保存側で検証する。

| ファイル／タブ | 先頭行の列順 |
| --- | --- |
| 認証試験／`認証管理` | 記録日時UTC、処理状態、受付番号、認証管理JSON、操作JSON |
| 履歴試験／`応募履歴` | 受付番号、版、処理ID、保存日時UTC、応募原本JSON |
| 指定応募ファイル／`sorafes-entry_PHASE4_TEST_v1` | 受付番号、版、処理ID、処理状態、保存日時UTC、応募原本JSON |

認証管理JSONにはSHA-256検証値と確定版・途中操作を保持し、編集コード原文は保存しない。履歴は受付番号と版ごとに追記し、応募一覧はこの専用試験タブ内の同じ受付番号行だけを更新する。試験受付番号は `P4TEST-` 接頭辞で本番と区別する。

## 模擬検証

`tests/phase4-google.test.mjs` はApps Scriptのスプレッドシート・プロパティ・ロック・SHA-256を模擬し、生成元のサーバーコードを実行する。各書き込みの直前・直後・flush失敗を注入し、再送・認証回復で履歴が重複しないことを確認する。ローカル試験の故障指定を外部APIでは拒否する。

確認項目は全5形式とチーム4／5／6名、読込・編集、古い版の競合、同じ処理の再送、古い操作の回復で最新版を巻き戻さないこと、途中更新の旧確定版読込と別更新拒否、誤キー・誤コード、停止・締切・設定不足・排他拒否、列不一致時の既存履歴保持、コードと検証値の公開領域への混入防止。中継の3件を含め、33件の自動テストが成功した。

## ローカル中継の準備

開発サーバー専用の `/api/phase4-google` と `scripts/phase4-google-relay.mjs` を追加した。専用配備のURLを既存の除外済み `.env.local` に `SORAFES_PHASE4_APPS_SCRIPT_URL` として追記し、既存 `SORAFES_TEST_KEY` をサーバー側で付与する。既存設定は保持した。キーはクライアント指定で上書きできず、確定結果の余剰フィールドも返さない。`.env.local` がGit除外対象であることを確認済み。

未設定、旧Phase 3と同じURL、不正URL、試験モード外、故障注入指定では外部へ送信しない。通信失敗、非JSON、処理ID不一致は結果不明と扱う。同じOrigin以外のブラウザ要求は拒否する。これはローカル開発用であり、本番のアクセス制御ではない。

画面 `/?phase4` の送信先は引き続き `/api/phase4-local`。`/?phase4=google` は専用のGoogle中継を使用し、架空データの保存・読込・編集・再読み込み後の回復を確認した。専用APIは停止中のため、画面から新しい保存・編集はできない。

模擬検証はGoogleの権限・割当制限・実際のflush動作・並列実行の確認を代替しない。実環境の保存先作成・配備・接続・照合・停止後拒否は [検証記録](phase4-google-verification.md) の範囲で実施した。全使用範囲の旧タブ照合、Google権限を意図的に破綻させる故障試験、大量送信は未実施。
