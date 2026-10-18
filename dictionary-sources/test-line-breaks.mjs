import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Lexicon} from '../dist/lexicon.mjs';
import {textRows,detectionIndex} from '../dist/detection.mjs';

const read=name=>JSON.parse(fs.readFileSync(new URL('../dist/dictionaries/'+name,import.meta.url),'utf8'));
const lex=new Lexicon(read('school-chemistry.json'),read('general-runtime.json'),read('community-vocabulary.json'));
// Check every split position; these are regression examples, not detector exceptions.
for(const term of ['ビニルアルコール','アボガドロ定数','カルボキシ基','エンタルピー変化','銀鏡反応','中和滴定','アルミニウム','ケイ酸塩ガラス','水酸化マンガン']) {
  for(let at=1;at<term.length;at++) for(const gap of ['\n','\r\n','\n\n','\n \t\r\n ']) {
    const text=term.slice(0,at)+gap+term.slice(at)+'を用いる。';
    assert.equal(lex.scan(text).length,0,JSON.stringify(text));
  }
}
for(const text of ['化学実験でビニ\n\nルアルコールを考える。','ビ\nニ\nル\nア\nル\nコ\nー\nルを考える。']) assert.equal(lex.scan(text).length,0,text);
for(const [text,expected] of [['中和適\n定','中和滴定'],['銀鏡反\n応応','銀鏡反応'],['カルポキシ基','カルボキシ基']]) {
  const hit=lex.scan(text).find(h=>h.options.some(o=>o.term===expected));
  assert(hit,text);
  assert.equal(text.slice(hit.start,hit.start+hit.length),hit.text,'original offsets must be preserved');
}
// A heading gap and a page break use the application's actual text/position index.
const item=(id,text,top,pageNumber=1)=>({id,text,pageNumber,size:10,rect:{left:20,top,width:text.length*5,height:11.8}});
for(const end of [item('b','ルアルコールを考える。',80),item('b','ルアルコールを考える。',20,2)]) {
  const index=detectionIndex(textRows([item('a','ビニ',20),end]),true,true);
  assert.equal(lex.scan(index.text).length,0,index.text);
  assert.equal(index.positionAt[index.text.indexOf('ル')].itemId,'b');
}
// The classifier must still flag an unregistered misspelling when it is not a fragment.
const isolated=new Lexicon({entries:[{term:'検証化合物'}]},{words:[]});
assert(isolated.scan('検証化合勿').length);
let cases=0;
for(const {term} of read('school-chemistry.json').entries.filter(e=>/^[\p{Script=Han}\p{Script=Katakana}ー]{4,32}$/u.test(e.term))) {
  for(let at=1;at<term.length;at++) for(const gap of ['\n','\r\n','\n\n']) {
    const text=term.slice(0,at)+gap+term.slice(at)+'を用いる。';
    assert.equal(lex.scan(text).length,0,JSON.stringify(text));cases++;
  }
  const p=Math.floor(term.length/3),q=Math.floor(term.length*2/3);
  const text=term.slice(0,p)+'\n'+term.slice(p,q)+'\n'+term.slice(q)+'を用いる。';
  assert.equal(lex.scan(text).length,0,JSON.stringify(text));cases++;
}
console.log(`Line breaks: ${cases} dictionary-wide splits, CRLF, paragraph gaps, page boundaries and real typos passed`);
