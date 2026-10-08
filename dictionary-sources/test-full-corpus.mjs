import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Lexicon} from '../dist/lexicon.mjs';
import {findReactionRanges} from '../dist/reactions.mjs';
import {structureChecks} from '../dist/workflow.mjs';
import {textRows} from '../dist/detection.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../dist/dictionaries/'+name,import.meta.url),'utf8'));
const lex=new Lexicon(read('school-chemistry.json'),read('general-runtime.json'),read('community-vocabulary.json'));
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
for(const text of ['中和点','ジニトロベンゼン','トリクロロメタン','沸点上\n昇度','硫酸ナトリウムを溶解させたときの沸点上\n昇度']) assert.equal(lex.scan(text).length,0,text);
assert(lex.scan('ジニトロベンゼソ').length>0,'a substituent prefix must not hide a misspelled remainder');
assert.equal(findReactionRanges('2N₂O₅ −→ 4NO₂ +O₂')[0].result.status,'balanced');
assert.equal(findReactionRanges('2N₂O₅ −→ 3NO₂ +O₂')[0].result.status,'unbalanced');
const vertical=['圧力','（','Pa','）'].map((text,i)=>({id:`rot-${i}`,pageNumber:1,text,size:10,emHeight:10,advance:10,textDirection:{x:0,y:-1},textOrigin:{x:100,y:100-i*10},rect:{left:90,top:90-i*10,width:10,height:10}}));
assert.equal(textRows(vertical)[0].text,'圧力（Pa）');
assert.equal(structureChecks(textRows(vertical).map(r=>({text:r.text,page:1}))).length,0);
for(const text of ['同ガラス','エーテル層']) assert.equal(lex.scan(text).length,0,text);
assert.equal(findReactionRanges('XCO₃²⁻ = [COC³] = K₁K₂').length,0);
assert.equal(findReactionRanges('H₂C=CH−CH=CH₂ −X−→₂ H₂C(X)−CH(X)−CH=CH₂ +H₂C(X)−CH=CH−CH₂(X) (1)').length,0);
assert(lex.scan('意図的に入れた異常例\n眼鏡反応を観察する。').some(c=>c.options.some(o=>o.term==='銀鏡反応')));
for(const text of ['エンタルピー変\n化が伴う。','水蒸気の生\n−242kJ·mol−1\n成エンタルピー','ア\n+\nンモニウムイオン','塩化ナトリウム型','アルミニウム板','第4周期第7族','マンガン酸カリウム','3-クロロ-2-ブタノール','（情－コン・理・医・工・農）']) assert.equal(lex.scan(text).length,0,text);
assert.equal(findReactionRanges('反応4 H₅IO₆ +H⁺ +2e⁻ −→ IO₃⁻ +3H₂O')[0].result.status,'balanced');
assert.equal(findReactionRanges('4 H₅IO₆ +H⁺ +2e⁻ −→ IO₃⁻ +3H₂O')[0].result.status,'unbalanced','a true coefficient must remain');
assert.equal(structureChecks(rows(['図2–2 筒型装置 図2–3 タンク型装置','図2–3に示す装置'])).length,0);
assert.equal(structureChecks(rows(['例）15℃，Mg(OH)₂。'])).length,0);
assert(structureChecks(rows(['溶液）を加える。'])).length>0,'an unmatched prose bracket must remain');
for(const scale of [.5,1,2]) {
 const items=[{id:'O',text:'O',size:10,x:0,y:10,w:8},{id:'sub',text:'7',size:7,x:8,y:11.5,w:5},{id:'qty',text:'1.00',size:10,x:13,y:10,w:20}].map(i=>({...i,pageNumber:1,emHeight:i.size*scale,advance:i.w*scale,textOrigin:{x:i.x*scale,y:i.y*scale},rect:{left:i.x*scale,top:(i.y-i.size)*scale,width:i.w*scale,height:i.size*1.18*scale}}));
 assert.equal(textRows(items)[0].text,'O7 1.00',`script-to-quantity boundary at scale ${scale}`);
}
