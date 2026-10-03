# 一般語辞書

`general-japanese.json` は JMdict の日本語表記・読み・品詞・用法注記を抽出した語彙データです。英語の語釈は省略しています。化学辞書とは別ファイルで管理します。

原典: https://www.edrdg.org/pub/Nihongo/JMdict_e.gz
プロジェクト: https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project
JMdict © James William BREEN and the Electronic Dictionary Research and Development Group.
本加工データは CC BY-SA 4.0。利用条件: https://www.edrdg.org/edrdg/licence.html
利用条件のローカルコピー: `EDRDG-LICENSE.html`

## 収録と加工

218,828項目、重複しない漢字等の表記206,231件、読み230,439件。表記数と読み数は語数として加算しません。
これは一般的な現代語だけの頻度リストではなく、専門語・古語等も含む辞書です。用法ラベルを維持しています。
`ke_inf` のある漢字等の表記、`re_inf` のある読みは採用していません。誤記・古い表記等が正常語として扱われることを避ける保守的な処理で、正しい異表記も除外される場合があります。
読みの表記制限 `restrictTo` と仮名専用フラグ `noKanji` を保持し、全表記と全読みの無条件な組合せを避けています。
`common` は原典の優先度情報の存在を示すだけで、頻度値や正しさの保証ではありません。

## 校正での使い方

化学用語を優先認識し、一般語辞書は普通の文章の認識・候補の絞り込みに利用します。
一般語として存在することを理由に必ず警告を消す処理は行いません。「参加」も「酸化」も正しい語であり、文脈依存の誤用は別判定です。
部分文字列が既知語というだけで文全体を正常にせず、分かち書き・活用・語の境界を考慮する必要があります。
ビューアはこのデータから作った軽量版 `general-runtime.json` を自動読込します。2026-10-01版は272,355表記です。用法ラベルは一部の語義に付く場合があるため、項目全体の一律除外には使いません。表記と仮名専用語の読みを正常語照合に使います。この一般語ファイルを「辞書を開く」へ手動指定する必要はありません。化学語の候補生成は編集距離1を基本とし、2～3文字の短い語は化学的な周辺語がある場合などに同じ長さの置換だけを候補とします。一般的な意味理解や形態素解析は行っていません。

## 更新と検証

公開された原典を `dictionary-sources/JMdict_e.gz` に保存し、`dictionary-sources/build_general.py` をPythonで実行すると再生成できます。更新時はEDRDGの最新の利用条件も保存してください。
取得元・加工日時・SHA-256をJSONに記録。`dictionary-sources/general-validation.json` に重複ID検査と基本語の収録確認結果を保存しています。
