import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export function addVocabulary(dictionary, term, issue) {
  term=term.normalize('NFKC').trim();
  if(!term || term.length>80 || /[\r\n\u0000-\u001f]/u.test(term)) throw Error('語は改行を含まない80文字以内で指定してください');
  const githubIssue=/^https:\/\/github\.com\/gtgtysys\/chemical-proofreading-viewer\/issues\/[1-9]\d*$/.test(issue);
  const googleForm=/^https:\/\/docs\.google\.com\/forms\/d\/(?:e\/)?[A-Za-z0-9_-]+\/viewform$/.test(issue);
  if(!githubIssue && !googleForm) throw Error('Issue URLまたはGoogleフォームの回答用URLを指定してください');
  if(dictionary.schemaVersion!==1 || !Array.isArray(dictionary.entries)) throw Error('追加辞書の形式が不正です');
  if(dictionary.entries.some(e=>e.term.normalize('NFKC')===term)) throw Error('すでに登録されています');
  return {...dictionary,entries:[...dictionary.entries,{term,...(githubIssue?{sourceIssue:issue}:{sourceForm:issue})}]};
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const [term,issue,...rest]=process.argv.slice(2);
    if(!term || !issue || rest.length) throw Error('使い方: node dictionary-sources/register-vocabulary.mjs "正しい語" "報告元URL"');
    const file=new URL('../dist/dictionaries/community-vocabulary.json',import.meta.url);
    const updated=addVocabulary(JSON.parse(fs.readFileSync(file,'utf8')),term,issue);
    fs.writeFileSync(file,JSON.stringify(updated,null,2)+'\n');
    console.log(`追加しました: ${updated.entries.at(-1).term}。変更を確認してコミット・公開してください。`);
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
