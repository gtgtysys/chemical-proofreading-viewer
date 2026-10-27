import assert from 'node:assert/strict';
import {chemicalSpan} from '../dist/chemical-spans.mjs';
import {formulaChecks} from '../dist/formulas.mjs';
import {formulaEvidence} from '../dist/detection.mjs';
import {unitSpans,mathVariables} from '../dist/math-roles.mjs';
import {schoolChecks} from '../dist/school-checks.mjs';

const glyph=(id,text,left=0,size=10,y=20,italic=false)=>({id,text,pageNumber:1,size,italic,font:italic?'CMMI10':'LMRoman10-Regular',emHeight:size,textOrigin:{x:left,y},rect:{left,top:y-size,width:text.length*6,height:size*1.18}});
const row=(text,items)=>({text,pageNumber:1,charMap:items.flatMap(item=>item.text.split('').map((ch,offset)=>({itemId:item.id,offset})))});
for(const text of ['pH=7','pOH=14-pH','p H = 7','pH=-lg[H]']) assert.equal(mathVariables(text).length,0,text);
for(const text of ['α+β=γ','密度 ρ','θ=2π']) {
  const items=[glyph('a',text)];
  assert.equal(schoolChecks([row(text,items)],items).length,0,text);
}
for(const text of ['[N]','[C] = 2','c[C]','x/2 m','y=3m+5','ma=F']) assert.equal(unitSpans(text).length,0,text);
for(const [text,count] of [['3 m',1],['10 mol/L',2],['10 mol L−1',2],['10 mol L⁻¹',2],['d[g/cm3]',2],['力[N]',1],['単位は m',1],['1/2 m',1]]) assert.equal(unitSpans(text).length,count,text);

const upright=[glyph('a','NaCI')],italic=[glyph('a','NaCI',0,10,20,true)];
assert.equal(chemicalSpan(row('NaCI',upright),0,4,upright),true);
assert.equal(chemicalSpan(row('NaCI',italic),0,4,italic),false);
assert.equal(chemicalSpan(italic[0],0,4,italic),false);
assert.equal(chemicalSpan({text:'NaCIX',charMap:[]},0,4,[]),false);
for(const text of ['化学式：Mgcl2','化学式：H2O']) {
  const normal=[glyph('a',text)],sloping=[glyph('a',text,0,10,20,true)];
  assert(formulaChecks(row(text,normal),normal).length>0,text);
  assert.equal(formulaChecks(row(text,sloping),sloping).length,0,text);
}
const indexed=[glyph('C','C'),glyph('I','I',6,7,22)];
assert.equal(chemicalSpan(row('CI',indexed),0,2,indexed),false);
const zero=[glyph('C','C'),glyph('0','0',6,7,22)];
assert.equal(chemicalSpan(row('C0',zero),0,2,zero),false);
const partial=[glyph('p','p'),glyph('N','N',6,7,22),glyph('2','2',10,5,24)];
assert.equal(chemicalSpan(row('pN2',partial),1,2,partial),false);
for(const text of ['V₁','C₀','Pₙ']) assert.equal(formulaEvidence(text),false,text);
assert.equal(formulaEvidence('H₂','反応式：H₂→H₂O'),true);
console.log('Feedback contexts: upright pH, Greek style policy, complete unit expressions, chemical typography and subscript variables passed');
