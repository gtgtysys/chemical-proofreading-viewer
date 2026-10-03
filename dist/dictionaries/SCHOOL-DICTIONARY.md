# 公開用 化学正表記辞書

`school-chemistry.json` はJMdict、文部科学省の学習指導要領解説、Wikidataから作成した正表記辞書です。旧出版社由来の目次・辞書・分類は生成入力に使いません。辞書内に説明文・図表は含みません。

## 利用条件

加工辞書全体を **CC BY-SA 4.0** で提供します。再配布時は出典・加工内容・ライセンス表示を維持してください。元のCC0データ等の利用条件を狭めるものではありません。各提供元による監修ではありません。

- JMdict © James William BREEN and the Electronic Dictionary Research and Development Group.
  - https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project
  - https://www.edrdg.org/edrdg/licence.html
  - 原典 https://www.edrdg.org/pub/Nihongo/JMdict_e.gz
- 文部科学省「中学校学習指導要領（平成29年告示）解説 理科編」を加工。
  - https://www.mext.go.jp/content/20230522-mxt_kyoikujinzai02-000033060_04.pdf
- 文部科学省「高等学校学習指導要領（平成30年告示）解説 理科編 理数編」を加工。
  - https://www.mext.go.jp/kaigisiryo/content/000235672.pdf
  - 利用規約 https://www.mext.go.jp/b_menu/1351168.htm （CC BY 4.0互換）
- Wikidataの日本語ラベル・別名（CC0）。項目ID・版IDで出典を記録。
  - https://www.wikidata.org/wiki/Wikidata:Licensing
- 加工辞書 https://creativecommons.org/licenses/by-sa/4.0/

## 選定と判定への利用

1. JMdictのchemistry分野の語と、中高の単元に沿った `school-scope.txt` の語を原典で照合。注記付きの表記・読みは除外し、漢字語の読みを別の正表記として無条件に採用しない。
2. 文部科学省PDFの化学の章で表記を照合。中学校は物理ページ40–45・51–56・63–68、高校は94–124。NFKC・空白除去による一致であり、定義・初出学年の保証ではない。
3. 不足する選定語をWikidataの日本語ラベル・別名と完全一致で照合。同義語全部の自動追加や物質式との同一性推定はしない。
4. `candidateEligible: true` は、中高の照合候補として選定した語か、化学分野かつ対象章に出現した語。誤字候補の生成に使う。
5. `candidateEligible: false` は、その他のJMdict化学語。正表記の認識・保護に使うが、類似語の訂正候補には使わない。大学・専門分野の用語による誤検出を抑えるため。

`levels` は対象章での出現を示し、学年の厳密な分類ではありません。高校向け選定には編集判断も含みます。辞書に載ることは文章全体の正しさを保証せず、未登録語を自動で誤りとはしません。

## 再生成

Pythonとpypdfium2を使用。公開原典の `JMdict_e.gz`、`middle.pdf`、`high.pdf` を `dictionary-sources` に置いて実行します。原典ファイルや旧収集資料はGit対象外です。

```powershell
python dictionary-sources/build_public_chemistry.py
```

Wikidataの出典スナップショット `wikidata-school-terms.json` はCC0データとして同梱し、通常の生成は通信しません。追加調査は `fetch_wikidata_terms.py` を実行します（直前の生成レポートにある不足語だけを送信）。送るのは公開の選定用語だけで、PDFや校正結果は読みません。API制限時は待機し、取得済み結果を保存します。語の意味の一致は編集時にも確認してください。

各語の `evidence` にJMdict ID、文科省の物理ページ、Wikidataの項目・版IDを保持。`sources` に入力SHA-256を保持。読みが出典で確認できない語は空欄です。

収録数・未確認の選定語は生成レポート `dictionary-sources/public-chemistry-validation.json` に出力します。未確認語は収録せず、全教科書を網羅した辞書とはしていません。
