# GitHub公開手順（Windows）

GitはPC内で変更履歴を記録する道具、GitHubはその履歴を共有する場所、GitHub PagesはHTML等をWebサイトとして配信する機能です。

この手順では **chemical-proofreading-viewer フォルダーだけ** をリポジトリにします。親の「校正支援」や隣の `chemical-proofreading-test` では実行しません。現在は公開準備ファイルを追加した段階で、GitHubへの送信はしていません。

## 0. 公開前に確認すること

標準の化学辞書は、JMdict（CC BY-SA 4.0）、文部科学省資料（CC BY 4.0互換）、Wikidata（CC0）のデータで再構築しました。辞書はCC BY-SA 4.0として配布します。`THIRD_PARTY_NOTICES.md` に記載した帰属・加工・利用条件の表示を残してください。独自コードのライセンスは別途選択できます。

検証PDF、抽出テキストを含む `qa`、ダウンロードした原典、`.openai` などは `.gitignore` で対象外にしています。これはGitの通常操作に適用される設定です。GitHub画面へのフォルダー丸ごとアップロードや `git add -f` には頼れません。過去にコミット済みのファイルにも効かないため、必ず登録一覧を確認してください。

## 1. PC内に履歴を作る

PowerShellで次を一行ずつ実行します。`git init` は初回だけです。

```powershell
cd 'C:\デスクトップ\AI\校正支援\chemical-proofreading-viewer'
git init -b main
git status --short
git add .
git diff --cached --stat
git diff --cached --name-only
```

`git add` は「次の保存に含める変更を選ぶ」操作です。まだ外部へ送られません。対象はアプリ・辞書・ライセンス・公開設定・説明書です。PDF、`qa`、個人情報、勤務先データがないことを一覧と内容で確認します。誤って登録したファイルは、最初のコミット前なら `git rm --cached -- ファイル名` で登録だけを取り消せます。

```powershell
git commit -m "Prepare chemistry PDF viewer for public feedback"
```

名前・メールアドレスを求められた場合は、このリポジトリ用に設定します。メールはコミット履歴に残るため、GitHubの Settings → Emails に表示される自分のnoreplyアドレスも使えます。

```powershell
git config user.name "表示したい名前"
git config user.email "自分のGitHubのnoreplyメールアドレス"
```

設定後、もう一度 `git commit` を実行してください。

## 2. GitHubに空のリポジトリを作る

GitHubにログインし、右上の「+」→「New repository」。名前の例は `chemical-proofreading-viewer`。公開する場合はPublicを選びます。README・.gitignore・ライセンスの自動追加はしません（PC側にあるファイルとの履歴衝突を避けるため）。Create repositoryを押します。

表示されたHTTPS URLを使って、PowerShellで接続先を登録します。`YOUR_NAME` は自分のユーザー名に置き換えます。

```powershell
git remote add origin https://github.com/YOUR_NAME/chemical-proofreading-viewer.git
git remote -v
git push -u origin main
```

`push` が、ファイルと履歴をGitHubへ送る操作です。認証が出たら本人のブラウザーでログインします。アクセストークンやパスワードをファイルに書かないでください。

## 3. 実際に使えるWebサイトを公開する

リポジトリの Settings → Pages → Build and deployment → Source を **GitHub Actions** にします。Actionsタブの「Publish viewer to GitHub Pages」→「Run workflow」でmainを実行します。Pagesを設定する前の初回pushで失敗していた場合もここから再実行できます。

成功後、Settings → PagesにサイトURLが表示されます。通常は `https://YOUR_NAME.github.io/chemical-proofreading-viewer/` です。

用意したワークフローは `dist` だけを配信し、公開先の所有者名・リポジトリ名を `site-config.json` に設定します。「フィードバック」からそのリポジトリのIssuesへ移動できます。GitHub Actions上の実行確認は公開後に行う必要があります。

## 4. フィードバックを受け付ける

Settings → General → FeaturesでIssuesを有効にします。「Issues」→「New issue」に、誤検出・見逃し／動作不良／改善要望の3つが出ることを確認します。フォームはデフォルトブランチに置く必要があるため、mainをデフォルトにしてください。

Webサイトの「フィードバック」からも同じフォームを開けます。GitHubアカウントが必要で、投稿は公開されます。PDFや検査結果を自動添付する機能はありません。

通知を受けたい場合は、リポジトリ右上のWatch → CustomでIssuesを選択し、自分のGitHub通知設定も確認します。自分で動作確認用Issueを1件投稿し、通知・返信・Closeの流れを試すと分かりやすいです。

ローカル版にも窓口を設定したい場合は `dist/site-config.json` を `{"repository":"YOUR_NAME/chemical-proofreading-viewer"}` に編集します。公開先の設定はActionsで自動生成されます。

## 5. 次回以降の更新

```powershell
git status
git diff
git add .
git diff --cached --stat
git commit -m "Describe the change"
git push
```

mainへのpush後にPagesが自動更新されます。Actionsの成功と公開画面を確認してください。

## 公式手順

- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository
