import assert from 'node:assert/strict';import fs from 'node:fs';
import {instructionChecks,nonJoyoChecks,scriptPosition,describeScriptPositions} from '../dist/editorial-checks.mjs';
import {evaluateNumeric,calculationChecks,arithmeticRows} from '../dist/calculations.mjs';
import {textRows} from '../dist/detection.mjs';
const joyo=JSON.parse(fs.readFileSync(new URL('../dist/dictionaries/joyo-kanji.json',import.meta.url)));
assert.equal(new Set([...joyo.characters]).size,2136);
const glyph=(id,text,x=0,y=20,size=10,bold=false)=>({id,text,pageNumber:1,size,bold,font:bold?'LMRoman10-Bold':'LMRoman10-Regular',emHeight:size,advance:text.length*6,textOrigin:{x,y},rect:{left:x,top:y-size,width:text.length*6,height:size*1.18}});
const row=items=>({text:items.map(i=>i.text).join(''),pageNumber:1,sourceIds:items.map(i=>i.id),charMap:items.flatMap(i=>i.text.split('').map((c,offset)=>({itemId:i.id,offset,total:i.text.length}))) });
for(const cue of ['誤っているものを選べ。','正しくない記述を選びなさい。','適切でないものを一つ選べ。','金属ではないものを選べ。','適当でないものはどれか。']) {
 const plain=[glyph('a',cue)],bold=[glyph('a',cue,0,20,10,true)];
 assert.equal(instructionChecks([row(plain)],plain).length,1,cue);
 assert.equal(instructionChecks([row(bold)],bold).length,0,cue);
}
assert.equal(instructionChecks([row([glyph('a','誤っているものについて説明する。')])],[glyph('a','誤っているものについて説明する。')]).length,0);
for(const cue of ['正しいものをすべて選べ。','正しいものを二つ選べ。','すべての物質について答えよ。','誤っている理由を答えよ。','金属ではないものがある理由を答えよ。','誤った操作を行った。次の問いに答えよ。']) {
 const plain=[glyph('a',cue)];assert.equal(instructionChecks([row(plain)],plain).length,0,cue);
}
const wrapped=[glyph('a','誤っ\n'),glyph('b','ているものを選べ。')];assert.equal(instructionChecks([row(wrapped)],wrapped)[0].text,'誤っ\nているもの');
const emphasisOnly=[glyph('a','誤っている',0,20,10,true),glyph('b','ものを選べ。',40)];
assert.equal(instructionChecks([row(emphasisOnly)],emphasisOnly).length,0,'bold negative cue is sufficient');
assert.deepEqual(nonJoyoChecks([{text:'攪拌と濾過、𠮷。亜鉛と酸素。'}],joyo).map(h=>h.text),['攪','拌','濾','𠮷']);
assert.equal(nonJoyoChecks([{text:joyo.characters}],joyo).length,0);
const supplement=nonJoyoChecks([{text:'𠮷濾'}],joyo);assert.equal(supplement[1].start,2);
for(const scale of [.5,1,2]) {
 const base=glyph('b','x',0,20,10),sup=glyph('s','2',6,15.4,7),sub=glyph('u','1',6,20.5,7);
 const scaled=items=>items.map(i=>({...i,emHeight:i.emHeight*scale,textOrigin:{x:i.textOrigin.x*scale,y:i.textOrigin.y*scale},rect:Object.fromEntries(Object.entries(i.rect).map(([k,v])=>[k,v*scale]))}));
 const up=scaled([base,sup]),down=scaled([base,sub]);
 assert(Math.abs(scriptPosition(up[1],up).percent-46)<1e-8);
 assert(Math.abs(scriptPosition(down[1],down).percent+5)<1e-8);
 assert(describeScriptPositions([up[1]],up).includes('+46.0%'));
}
for(const [text,expected] of [['2+3*4',14],['(2+3)*4',20],['-2^2',-4],['2^-3',.125],['2^3^2',512],['2(3+4)',14],['√9',3],['2×10³',2000],['1.2e-3',.0012],['1,000+2,000',3000]]) assert.equal(evaluateNumeric(text).value,expected,text);
for(const text of ['alert(1)','2+','2 3','2**3','Infinity','1/','(1+2','x+2','10 mol','NaCl','H₂+O₂']) assert.equal(evaluateNumeric(text).status,'unknown',text);
const check=text=>calculationChecks([{text,charMap:[]}]);
for(const text of ['2+3=5','0.1+0.2=0.3','2/3≒0.67','1.00×10³=1000','2^3=8','1+2=3=6/2']) assert.equal(check(text).length,0,text);
for(const text of ['2+3=6','2/3=0.666','1/0=2','2^3=9','0.5=0.51']) assert(check(text).length>0,text);
for(const text of ['x+2=3','質量 m=2g','H2+O2=H2O','10 mol=1 mol','(1) 2+3=6']) assert.equal(check(text).length,0,text);
for(const exponent of ['3','23','-3']) {
 const items=[glyph('a','2×10',0),...exponent.split('').map((t,n)=>glyph('s'+n,t,24+n*3,15,7)),glyph('z','=3000',45)];
 const assembled=arithmeticRows(textRows(items),items).find(r=>r.text.includes('='));
 assert(assembled.text.includes('^('+exponent+')'),assembled.text);
 assert(calculationChecks([assembled],items).length>0,assembled.text);
 const shared=arithmeticRows([row(items)],items)[0];
 assert(shared.text.includes('^('+exponent+')'),shared.text);
 assert(calculationChecks([shared],items).length>0,shared.text);
}
const detachedRoot=[glyph('root','√',0,12),glyph('numbers','2=1.41',6,20)];
assert.equal(calculationChecks([row([detachedRoot[1]])],detachedRoot).length,0,'detached radical must preserve the expression boundary');
console.log('Editorial review: instruction boldness, 2136 Joyo characters, script percentages at 3 scales, safe arithmetic, rounding and PDF exponent mapping passed');
