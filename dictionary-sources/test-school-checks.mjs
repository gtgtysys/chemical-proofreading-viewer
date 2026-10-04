import assert from 'node:assert/strict';
import {schoolChecks} from '../dist/school-checks.mjs';
const check=(text,italic=false,font='LMRoman10-Regular')=>schoolChecks([{text,charMap:Array.from(text,(_,offset)=>({itemId:'a',offset}))}],[{id:'a',font,italic}]);
assert.equal(check('圧力 p、体積 V、絶対温度 T。').filter(h=>h.label==='物理量の書体').length,3);
assert.equal(check('圧力 p、体積 V、絶対温度 T。',true).length,0);
assert.equal(check('10 mol、300 K、5 s',true).length,3);
assert.equal(check('10 mol、300 K、5 s').length,0);
assert.equal(check('イオン積 K',true).length,0);
assert.equal(check('K1K2',true).length,0,'indices next to equilibrium constants are not numerical unit values');
assert.equal(check('C(s) + O₂(g) = CO₂(g) + 394 kJ').filter(h=>h.type==='curriculum').length,1);
for(const delta of ['Δ','∆']) assert.equal(check(`C(s) + O₂(g) = CO₂(g), ${delta}H = -394 kJ/mol`).length,0);
assert.equal(check('熱化学方程式：C(s) + O₂(g) = CO₂(g) + 394 kJ').length,1);
assert.equal(check('≈ ≒').length,1);
assert.equal(check('圧力 p',false,'serif [g1]').length,0);
console.log('School checks: quantities, units, equilibrium constant, old/new notation and missing fonts passed');
import {formulaChecks} from '../dist/formulas.mjs';
for(const scale of [.5,1,2]) {
 const glyph=(id,text,size,baseline,left)=>({id,text,size,pageNumber:1,rect:{left:left*scale,top:(baseline-size)*scale,width:size*.6*scale,height:size*scale*1.18}});
 const items=[glyph('H','H',12,30,0),glyph('2','2',8,33,7),glyph('O','O',12,30,12)];
 const row={text:'化学式：H2O',pageNumber:1,charMap:[null,null,null,null,{itemId:'H',offset:0},{itemId:'2',offset:0},{itemId:'O',offset:0}]};
 assert.equal(formulaChecks(row,items).length,0,'geometric subscript at scale '+scale);
 items[1]=glyph('2','2',12,30,7);
 assert.equal(formulaChecks(row,items).length,1,'inline digit at scale '+scale);
}
console.log('Subscripts: normal and incorrect notation at multiple display scales passed');
