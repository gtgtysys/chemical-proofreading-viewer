import fs from 'node:fs';import crypto from 'node:crypto';
const path='dictionary-sources/joyokanjihyo-upstream.json',raw=fs.readFileSync(path),rows=JSON.parse(raw),characters=[...new Set(rows.map(r=>r.subject))].join('');
if([...characters].length!==2136)throw Error('Expected 2136 characters');
const data={schemaVersion:1,name:'常用漢字表（平成22年内閣告示第2号）',characters,acceptable:[...new Set(rows.flatMap(r=>r.acceptable?[...r.acceptable]:[]))].filter(c=>/\p{Script=Han}/u.test(c)).join(''),sourceUrl:'https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/pdf/joyokanjihyo_20101130.pdf',extractionUrl:'https://github.com/mandel59/joyokanjihyo',inputSha256:crypto.createHash('sha256').update(raw).digest('hex'),license:'PD-Japan-Gov (内閣告示)',changes:'本表の字種と許容字体のみを抽出。音訓・例文は収録していない。'};
fs.writeFileSync('dist/dictionaries/joyo-kanji.json',JSON.stringify(data,null,2)+'\n');
