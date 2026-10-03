const status = document.querySelector('#feedbackStatus');
try {
  const response = await fetch('./site-config.json', {cache: 'no-store'});
  if (!response.ok) throw new Error('configuration unavailable');
  const {repository} = await response.json();
  if (typeof repository !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(repository)) {
    status.textContent = 'このコピーには報告先がまだ設定されていません。GitHub Pagesで公開すると、公開先リポジトリの報告フォームに接続されます。';
  } else {
    const base = `https://github.com/${repository}/issues`;
    for (const [id, template] of [['detectionLink', 'detection.yml'], ['bugLink', 'bug.yml'], ['featureLink', 'feature.yml']]) {
      document.getElementById(id).href = `${base}/new?template=${template}`;
    }
    document.querySelector('#issuesLink').href = base;
    document.querySelector('#feedbackLinks').hidden = false;
    status.textContent = `報告先：${repository}`;
  }
} catch {
  status.textContent = '報告先の設定を読み込めませんでした。時間をおいて、このページを開き直してください。';
}
