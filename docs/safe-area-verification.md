# iPhone Safe Area表示修正（2026-10-12）

## 再修正：スクロール領域のクリップ（2026-10-12）

以下が最新。前回commit 7fee42cbは本番Version f8b78dfe-b8f7-4efe-b4c5-d5ad4f2e2072へ配備済みだが、ユーザーが **iOS 26.3.1 Safari** で再確認し、スクロール時に「担当ロールを修正」等が時刻16:19付近へ入り込む問題が残ると報告した。前回修正を解消済みとは扱わない。この会話に画像データ自体はなく、実機状況はユーザー報告に基づく。

### 調査と原因の確度

旧body::beforeはposition:fixed、top:0、height:env(safe-area-inset-top, 0px)、z-index:1、背景#101211、pointer-events:none。本文に対抗するposition/z-index/transform/isolation等はなく、通常の描画順では本文より前面。重なり順の不足を示す証拠はない。envのフォールバック0pxは未定義時の値で、実値0を非0へ補正しない。そのためenvが0ならレイヤーは高さ0。非0でもfixedレイヤーはページスクロールやSafari chromeの描画をクリップするものではなく、初期余白・かぶせる方式では実機の目標を満たせなかった。

**実機のenv実測値、visualViewport位置、Safari合成描画の直接原因は未取得・未断定。** [WebKitのfixed/viewportずれ報告](https://bugs.webkit.org/show_bug.cgi?id=300523)も参照したが、今回と同一原因と認定していない。WebページのCSSでSafari自身のステータスバーを直接制御できるとは扱わない。

### 修正範囲

- fixed疑似要素を撤去。html/bodyの外側スクロールを止め、bodyを100dvh（未対応時100%）へ収める。
- body上端にenv(safe-area-inset-top, 0px)を確保し、その内側の#rootだけをheight:100%・overflow-y:autoでスクロールさせる。左右・フッター下端のSafe Area対応は維持。
- #rootにcontain:paintを指定し、子孫がスクロール領域外へ描画されない境界とstacking contextを設ける。上端の非スクロール領域は既存の#101211背景だけ。外側へのスクロール連鎖・オーバースクロールをoverscroll-behavior-y:noneで抑える。
- 初期上端余白の合計は従来と同じmax(20px, inset-top)となるよう、ヘッダー内部はmax(0px, 20px - inset-top)とする。inset=0なら従来のヘッダー20px・フッター24px。固定の端末別高さやiOS判定は追加しない。
- viewport-fit=cover維持。React/フォーム/文字サイズ/配色/ボタン/送信/recover処理の変更なし。スクロールの所有者だけがdocumentから#rootへ変わる。既存コードにwindow.scrollTo等への依存はない。Safariバーの自動縮小、ページ引き下げ更新等は外側スクロール停止で従来と挙動が変わる可能性があり実機で確認する。

### 再検証と停止地点

- npm test：既存71件すべて成功、失敗0。
- npm run build：tsc --noEmitとVite production build成功。
- npx wrangler deploy --dry-run成功。配備なし。
- 生成CSSでhtml/bodyのoverflow:hidden、100dvh、#rootのcontain:paint/overflow-y:auto、上下左右envの保持、旧fixedマスク除去を確認。
- ローカル専用サーバーでsettingsをCLOSEDに模擬し外部APIへ接続せず表示確認。上端59px・下端34pxを生成CSSへ代入した試験用ページを使用（実機の測定値ではない）。390×844で#root上端59px・高さ785px。スクロール位置1051→2546でもdocument.scrollTop=0、上端20pxのhit-testはBODYで本文なし。スクリーンショットでも背景帯と本文のクリップを確認。フッター・次へに到達、STEP 2→3→4と必須エラーのフォーカスが領域内、プレイヤー名入力可能。
- env=0の実buildで1280×900／375×812確認。#root上端0、横はみ出しなし（clientWidth=scrollWidth）。PC2列240px/808px、スマホ1列320px。PCヘッダー20px・フッター24px。
- git diff --check、commit差分と秘密情報非混入を確認。試験サーバーは既存ignore対象.cache配下でcommitしない。dist・.env.production.local・Apps Script生成物も除外維持。
- 今回はsrc/styles.cssと本書だけをcommitし、pushせず停止。既存未commit文書4件はそのまま保持。Google、Apps Script、Worker、Secret、受付・採番に変更操作なし。直前工程で確認したPRODUCTION_ENABLED=false、PRODUCTION_NEXT="4"、試験4件・正式0件、Worker CLOSEDを変更しない。今回は本番値を再取得していない。

**実機解消は未実証。** 次回の承認された反映後に、iOS 26.3.1 Safariで確認画面の「担当ロールを修正」、受付番号、入力・recover画面をスクロールし、時刻等の領域が背景だけになることを確認する。慣性・上下端への引っ張り、縦横回転、Safariバー展開/縮小、キーボード開閉とフォーカス、フッターまで到達できることも確認する。env=0やブラウザー自身の合成描画を含む挙動はChromiumの模擬確認で保証しない。受付停止中の送信ボタン非表示は既存仕様、開始直後の表示・押下可能確認は引き続き残す。

## 前回の記録（履歴）

## 実機結果と現在地

ユーザーが物理iPhoneの正式URLで、フォーム表示、横方向の大きなはみ出しなし、STEP 1〜8、応募形式・入力・確認、必須エラー、サバイバー専用分岐、修正ボタン、受付停止表示、recover関連画面の表示を確認した。実応募送信なし。従来の実機未確認条件はこの報告で更新する。ただしスクロール時に受付番号・上部ボタン等がステータスバーの時刻・電波・Wi-Fi・バッテリーと重なり、公開前の修正・再確認条件として残す。

停止中にSTEP 8の「応募を送信」が表示されないのは受付停止仕様。フォーム未表示・表示崩れとして扱わない。正式受付開始直後に、PRODUCTION_ENABLED=trueで送信ボタンが正常表示され押下可能であることを確認する。今回この確認のために受付を有効にしない。

## 原因と最小修正

従来のindex.htmlはwidth=device-width, initial-scale=1.0のみ。viewport-fit=cover、Safe Area CSS、fixed/sticky要素なし。最上部は通常配置の.site-header（上下20px）、mainは上40px・下60px、footerは24px。ページ側にスクロール時の上端保護がなかった。Safari標準の領域調整がある設定でも実機で重なった直接のブラウザー要因は未特定であり、物理端末での解消は未実証。

- Cloudflare用index.htmlにviewport-fit=coverを追加。
- ヘッダー上端はmax(20px, env(safe-area-inset-top, 0px))、フッター下端はmax(24px, env(safe-area-inset-bottom, 0px))。既存余白へ単純加算しない。
- cover時の横向き保護としてbodyの左右に対応するSafe Area値を適用。
- 余白はスクロールすると消えるため、body::beforeを上端に固定し、Safe Areaの高さだけ既存背景色で覆う。pointer-events:noneで操作を遮らず、値0では高さ0。
- フォーム・配色・文字サイズ・ボタン仕様・送信・recover処理は変更なし。HTML Service検証画面の生成スクリプトは今回対象外。

参考：[WebKitのSafe Area解説](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)。PC・Android等で全insetが0なら従来の余白を維持する。inset非0の端末では必要な端部だけ保護する。

## ローカル検証

- npm test：既存71件成功、失敗0。
- npm run build：tsc --noEmit成功、Vite production build成功。
- npx wrangler deploy --dry-run：成功、実配備なし。
- 初回buildにsandboxのrealpath EPERM、初回dry-runにログ書込EPERMが出たため、承認付きで再実行して成功。
- 生成済みdistをローカルpreviewで表示。PC 1280×900では2列（240px / 808px）、390×844では1列。375×812も含めscrollWidthとclientWidthが一致し横はみ出しなし。ヘッダー上20px・footer下24px・上端マスク0pxを確認。API未接続の静的previewであり外部送信なし。
- dist/index.htmlのviewport-fit=coverと生成CSS内の上下左右Safe Area・固定マスクを確認。
- git diff --check成功。commit対象差分を確認し秘密情報なし。.env.production.local・dist・Apps Script生成物のGit除外を確認。

## 停止地点と残条件

今回のcommitはindex.html、src/styles.css、本書だけ。開始時点からある未commitのdocs/README.md、prelaunch-checklist.md、production-operations.md、production-final-readiness.mdは変更・ステージせず保持する。本書はそれらの実機未確認記述を補足する最新記録。

push・デプロイ・Google操作・外部応募送信なし。本番未反映。ユーザー提示のPRODUCTION_ENABLED=false、PRODUCTION_NEXT="4"、試験応募4件・正式応募0件、Worker settings CLOSEDを変更する操作なし。今回は本番値の再取得はしていない。

物理iPhone再確認：承認後の反映時、縦／横向き、上端・中途・下端のスクロール、Safariバー展開／縮小、受付番号・上部ボタン・recover画面、入力キーボードの開閉、余白過剰やボタン遮蔽がないこと。ローカルのChromium幅確認はiOS Safari固有の非0 Safe Area・バー動作の代替にはならない。

正式開始前に修正のpush／配備を別途承認し実機再確認・開始判定更新・停止／採番／保存先整合の直前照合・所有者の開始承認を行う。開始直後の送信ボタン表示／押下可能確認を残す。締切専用非本番検証は所有者が2026-10-23 18:00日本時間までに実施する既存条件を維持する。詳細は[開始直前チェック](production-final-readiness.md)参照。
