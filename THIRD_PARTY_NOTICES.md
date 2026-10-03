# 外部データ・ライブラリの利用条件

確認日：2026-10-02。公開サイトにも `dist/about.html` を同梱します。

## 化学辞書：CC BY-SA 4.0

`dist/dictionaries/school-chemistry.json` は以下の公開データから再構築した加工辞書です。日本語表記・読み・識別子を抽出し、化学分野の選別、学習指導要領での出現照合、重複統合を行いました。説明文・図表は含みません。各提供元による監修ではありません。加工辞書全体をCC BY-SA 4.0で提供し、元のCC0データ等の利用条件を狭めるものではありません。

- JMdict © James William BREEN and the Electronic Dictionary Research and Development Group. CC BY-SA 4.0。詳細は次節。
- 文部科学省「中学校学習指導要領（平成29年告示）解説 理科編」および「高等学校学習指導要領（平成30年告示）解説 理科編 理数編」を加工。公式規約のCC BY 4.0互換条件を利用し、出典・加工表示を保持。
  - https://www.mext.go.jp/content/20230522-mxt_kyoikujinzai02-000033060_04.pdf
  - https://www.mext.go.jp/kaigisiryo/content/000235672.pdf
  - https://www.mext.go.jp/b_menu/1351168.htm
- Wikidataの日本語ラベル・別名（CC0）。項目ID・版IDを記録。
  - https://www.wikidata.org/wiki/Wikidata:Licensing

生成方法は `dictionary-sources/build_public_chemistry.py`。入力のSHA-256と各語の出典をJSONに保持しています。以前使用した出版社由来データは入力に使いません。ローカルに残る旧収集スクリプト・原典・検証記録はGit対象外であり、公開物に追加しないでください。

## 一般語辞書：JMdict

JMdict © James William BREEN and the Electronic Dictionary Research and Development Group.

`dist/dictionaries/general-runtime.json` はJMdictの日本語表記等から作成した加工データです。英語の語釈は含めず、表記注記等に基づく除外・表記の抽出・重複除去を実施しました。この加工データはCC BY-SA 4.0で提供します。アプリの独自コードの利用条件とは別です。

- 原典：https://www.edrdg.org/pub/Nihongo/JMdict_e.gz
- プロジェクト：https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project
- 提供元の条件：https://www.edrdg.org/edrdg/licence.html
- CC BY-SA 4.0：https://creativecommons.org/licenses/by-sa/4.0/
- 条件の保存済みコピー：`dist/dictionaries/EDRDG-LICENSE.html`

提供元は更新手順の整備も求めています。公開後は少なくとも月1回を目安に原典更新を確認し、`dictionary-sources/JMdict_e.gz` へ取得したうえで次を実行し、差分確認・検証後に配布版を更新してください。原典・中間生成物はGit対象外です。自動更新や更新済みであることを保証する仕組みは現在ありません。

```powershell
python dictionary-sources/build_general.py
python dictionary-sources/build_runtime.py
```

## PDF.js 5.6.205

Copyright Mozilla Foundation. Apache License 2.0。
`dist/vendor/pdf.mjs` と `pdf.worker.mjs` の通知を保持しています。

- プロジェクト：https://github.com/mozilla/pdf.js
- ライセンス：`dist/vendor/LICENSE`（Apache License 2.0）
- CMap：`dist/vendor/cmaps/LICENSE`
- 標準フォント：`dist/vendor/standard_fonts/LICENSE_FOXIT` と `LICENSE_LIBERATION`
- WASM：`dist/vendor/wasm/LICENSE_*`

依存物に含まれる通知は削除しないでください。

## pptx-preview 1.0.7

PPTXを端末内のブラウザで表示するために使用します。ISC License。

- パッケージ：https://www.npmjs.com/package/pptx-preview
- プロジェクト：https://github.com/loadfix/pptxjs
- 保存済みライセンス：`dist/vendor/pptx-preview/LICENSE.txt`

## 独自コード

独自コードのライセンスはまだ選択していません。GitHubで閲覧可能にすることと、自由な再利用を許すオープンソースライセンスを付けることは別です。MIT等を選択する場合も、上記の辞書・依存物を一括して同じライセンスに変更しないでください。
