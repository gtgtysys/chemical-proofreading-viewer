import fs from 'node:fs';
import crypto from 'node:crypto';

// Download the extraction page to this path before running from the repository root.
const raw=fs.readFileSync('dictionary-sources/hyogai-upstream.html');
const rows=raw.toString('utf8').split('<div class="kanji-row">').slice(1).map(section=>({
  number:Number(section.match(/class="no">(\d+)/)?.[1]),
  forms:[...section.matchAll(/class="card_s">([\s\S]*?)<\/div>/g)].map(m=>m[1].trim()),
}));
if(rows.length!==1022 || rows.some((r,n)=>r.number!==n+1 || r.forms.length!==2 || [...r.forms[0]].length!==1 || [...r.forms[1]].length>1)) throw Error('Invalid 1022-row table');
// Original table p.12, No.708: 擢. The transcription repeats 摺 (No.480).
if(rows[707].forms[0]!=='摺') throw Error('Recheck No.708 correction');
rows[707].forms[0]='擢';
// The transcription omits 沪. Its status is confirmed by the National Institute
// for Japanese Language and Linguistics, and the original table's 濾 row.
const filtration=rows.find(r=>r.forms[0]==='濾');
if(!filtration || filtration.forms[1]) throw Error('Recheck the upstream correction');
filtration.forms[1]='沪';
const characters=rows.map(r=>r.forms[0]).join('');
const acceptable=rows.map(r=>r.forms[1]).join('');
if(new Set([...characters]).size!==1022 || new Set([...acceptable]).size!==22) throw Error('Unexpected character counts');
const data={schemaVersion:1,name:'表外漢字字体表（平成12年国語審議会答申）',characters,acceptable,
  sourceUrl:'https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kakuki/22/pdf/jitaihyo.pdf',
  extractionUrl:'https://www.joho-gakushu.or.jp/kanji/hyougaikanjitest.php',
  correctionSourceUrl:'https://kotoba.ninjal.ac.jp/qa/yokuaru/qa-182/',
  inputSha256:crypto.createHash('sha256').update(raw).digest('hex'),
  changes:'印刷標準字体1022字と簡易慣用字体22字のみを抽出。原典のNo.708（PDF12頁）に基づき摺を擢へ補正し、No.994（PDF17頁）に基づき欠落した沪を補完。音訓・熟語・解説は収録しない。'};
fs.writeFileSync('dist/dictionaries/hyogai-kanji.json',JSON.stringify(data,null,2)+'\n');
