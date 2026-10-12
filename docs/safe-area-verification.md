# iPhone Safe Area表示修正（2026-10-12）

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
