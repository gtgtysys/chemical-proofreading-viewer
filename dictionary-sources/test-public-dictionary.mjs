import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Lexicon} from '../dist/lexicon.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../dist/dictionaries/'+name,import.meta.url),'utf8'));
const chem=read('school-chemistry.json'),general=read('general-runtime.json');
assert.equal(chem.license,'CC-BY-SA-4.0');
const sources=new Set(chem.sources.map(s=>s.id));
assert.deepEqual([...sources].sort(),['jmdict','mext-high','mext-middle','wikidata']);
assert.equal(new Set(chem.entries.map(e=>e.term)).size,chem.entries.length);
for(const e of chem.entries) {
 assert(e.evidence.length,e.term);
 for(const r of e.evidence) {
  assert(sources.has(r.sourceId));
  if(r.sourceId==='jmdict') assert(/^\d+$/.test(r.entryId));
  if(r.sourceId==='wikidata') assert(/^Q\d+$/.test(r.entityId) && r.revision>0);
  if(r.sourceId.startsWith('mext-')) assert(r.pdfPages.every(n=>Number.isInteger(n) && n>0));
 }
}
for(const term of ['銀鏡反応','中和滴定','アボガドロ定数','電気陰性度','モル濃度','溶解度積','付加重合']) {
 assert(chem.entries.some(e=>e.term===term && e.candidateEligible),term);
}
const lex=new Lexicon(chem,general,JSON.parse(fs.readFileSync(new URL('../dist/dictionaries/community-vocabulary.json',import.meta.url),'utf8')));
for(const text of ['アルミニウ\n3\nムは金属である。','エテン','水酸化マグネシウム','ガラス棒','二量化を行う反応。']) assert.equal(lex.scan(text).length,0,text);
assert(lex.scan('銀鏡反応応を観察する。').some(h=>h.options.some(e=>e.term==='銀鏡反応')));
const isolated=new Lexicon({entries:[{term:'検証化合物',candidateEligible:false}]},{words:[]});
assert(isolated.known.has('検証化合物'));
assert.equal(isolated.scan('検証化合勿').length,0,'recognition-only words must not generate suggestions');
console.log('Public dictionary: provenance, essential terms, split words and scope separation passed');
