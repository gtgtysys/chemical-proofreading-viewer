import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Lexicon} from '../dist/lexicon.mjs';
import {findReactionRanges} from '../dist/reactions.mjs';
import {structureChecks} from '../dist/workflow.mjs';
import {textRows} from '../dist/detection.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../dist/dictionaries/'+name,import.meta.url),'utf8'));
const lex=new Lexicon(read('school-chemistry.json'),read('general-runtime.json'));
for(const text of ['水層','有機層','混合液','反応率','呈色反応','ガラス板','活物質','オリゴ糖','原子核内','物質量比','総物質量','生成物側','各異性体','炭化水素鎖','低分子量','沸点上昇度','化合物群','ケイ 酸塩 ガラス','ナトリ ウム 水溶液','アルデヒ ド','炭 化 水 素','中和滴\n定','銀鏡反 応','ケイ 素原子','反応 開始時','アミ ド結合']) assert.equal(lex.scan(text).length,0,text);
for(const [text,term] of [['硫酢','硫酸'],['銀鏡反応応','銀鏡反応'],['中和適\n定','中和滴定'],['カルポキシ基','カルボキシ基']]) assert(lex.scan(text).some(c=>c.options.some(o=>o.term===term)),text);
for(const text of ['H₂C=CH','CH=CH₂','H₂C=C','(C=C-C=C)','H₂C = CH−CH = CH₂','CH₂ = CH₂']) assert.equal(findReactionRanges(text).length,0,text);
assert.equal(findReactionRanges('C₂H₄ = C₂H₆')[0].result.status,'unbalanced');
assert.equal(findReactionRanges('H₂ + O₂ → H₂O')[0].result.status,'unbalanced');
const rows=texts=>texts.map((text,i)=>({text,page:1+Math.floor(i/2)}));
assert.equal(structureChecks(rows(['図3-1 構造式','図3-2 結合の種類'])).length,0);
assert.equal(structureChecks(rows(['図3ー1 構造式','図3ー2 結合の種類'])).length,0);
assert.equal(structureChecks(rows(['図3-1 構造式','図3-1 別の構造式'])).filter(h=>h.reason.includes('重複')).length,1);
assert.equal(structureChecks(rows(['化学問題Ⅰ','図1 実験装置','化学問題Ⅱ','図1 構造式'])).filter(h=>h.reason.includes('重複')).length,0);
assert.equal(structureChecks(rows(['図1 実験装置','図1(1)に示す装置','図1（2）を用いる'])).length,0);
assert.equal(structureChecks(rows(['図3-3 構造式','図3-3中の異性体を選ぶ。','図3-3内に示した構造式'])).length,0);
assert.equal(structureChecks(rows(['問1、問2に答えよ。','問1 実験について答えよ','問2 反応について答えよ'])).length,0);
assert.equal(structureChecks(rows(['問2 実験','問 2 に答えよ。'])).length,0);
for(const scale of [.5,.8,1.35,2]) {
 const items=[{id:'formula',text:'H₂S₂O₇',size:10,x:0,width:38},{id:'quantity',text:'1.00 mol',size:10,x:42,width:40}].map(i=>({...i,pageNumber:1,emHeight:i.size*scale,rect:{left:i.x*scale,top:10*scale,width:i.width*scale,height:i.size*scale*1.18}}));
 assert.equal(textRows(items)[0].text,'H₂S₂O₇ 1.00 mol',`quantity boundary at scale ${scale}`);
}
console.log('Full-corpus regressions: correct compounds, split vocabulary, double bonds, figure branches and chapter resets passed');
