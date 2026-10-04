import {checkFormula} from './reactions.mjs?v=17';
import {expectedSubscript} from './detection.mjs?v=22';

// Check the notation of a parsed chemical species, not a list of named compounds.
export function formulaChecks(row,items) {
  const hits=[];
  for(const match of row.text.matchAll(/[A-Z][A-Za-zΙΟ0-9₀-₉()\[\]⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻^−-]*(?:\+)?/g)) {
    const token=match[0];
    if(/[A-Za-z]/.test(row.text[match.index-1]||'')) continue;
    const parsed=checkFormula(token);
    const chemicalContext=/(?:化学式|分子式|組成式|反応式|分子|イオン|酸素|水素|窒素|塩素|試薬)/.test(row.text);
    if(parsed.status==='unknown' && chemicalContext && /[a-zΙΟ0-9₀-₉]/.test(token) && /[A-Za-z].*[A-Za-zΙΟ]/.test(token)) {
      const alternatives=new Set();
      for(let index=0;index<token.length;index++) {
        const ch=token[index],replacements=ch==='Ι'?['I','l']:ch==='Ο'?['O']:ch==='0'?['O']:/[A-Za-z]/.test(ch)?[ch===ch.toUpperCase()?ch.toLowerCase():ch.toUpperCase()]:[];
        for(const replacement of replacements) {
          const alternative=token.slice(0,index)+replacement+token.slice(index+1);
          if(checkFormula(alternative).status==='parsed') alternatives.add(alternative);
        }
      }
      if(alternatives.size && alternatives.size<=3) hits.push({start:match.index,length:token.length,text:token,type:'symbol',
        suggestion:[...alternatives].join(' ／ '),reason:'元素記号の並びを解析できません。1文字の大小文字・類似文字を変更すると解析できる候補があります。物質名と照合してください。'});
    }
    if(parsed.status!=='parsed' || !/[A-Za-z)\]][0-9]/.test(token)) continue;
    if(Object.keys(parsed.atoms).length<2 && !chemicalContext) continue;
    const sources=[...new Set(row.charMap.slice(match.index,match.index+token.length).filter(Boolean).map(p=>p.itemId))];
    const baseItems=items.filter(item=>sources.includes(item.id));
    // A single element plus a number is also a variable, orbital or ion charge.
    if(Object.keys(parsed.atoms).length===1) continue;
    if(!chemicalContext && /^[A-Z]+\d+$/.test(token)) continue;
    const pageSizes=items.filter(i=>i.pageNumber===row.pageNumber && /[\p{Script=Han}\p{Script=Hiragana}]/u.test(i.text)).map(i=>i.size).sort((a,b)=>a-b);
    const bodySize=pageSizes[Math.floor(pageSizes.length/2)] || 0;
    // Diagram labels may encode subscript-shaped glyphs as ordinary digits in one PDF item.
    // There is no reliable per-character baseline in that case; do not assert a defect.
    if(bodySize && baseItems.every(i=>i.size<bodySize*.9) && !/[\p{Script=Hiragana}]/u.test(row.text)) continue;
    let needsSubscript=false;
    for(const digits of token.matchAll(/(?<=[A-Za-z)\]])\d+/g)) {
      const offset=match.index+digits.index;
      const segments=row.charMap.slice(offset,offset+digits[0].length).filter(Boolean).map(p=>({itemId:p.itemId,start:p.offset,end:p.offset+1}));
      // Add the other species fragments as baseline references, without treating their
      // Unicode subscripts as evidence about the selected ASCII digit.
      const numeric=segments.map(s=>items.find(i=>i.id===s.itemId)).filter(Boolean);
      const baseline=i=>i.rect.top+i.rect.height/1.18;
      const positioned=numeric.length && numeric.every(i=>/^\d+$/.test(i.text) && baseItems.some(b=>/[A-Za-z]/.test(b.text) && i.size<b.size*.88 && baseline(i)>baseline(b)+b.rect.height/1.18*.12));
      if(!positioned && !expectedSubscript(digits[0],segments,items)) needsSubscript=true;
    }
    if(needsSubscript) hits.push({start:match.index,length:token.length,text:token,
      suggestion:token.replace(/(?<=[A-Za-z)\]])\d+/g,run=>[...run].map(n=>'₀₁₂₃₄₅₆₇₈₉'[Number(n)]).join('')),
      reason:'化学式として解析できる文字列に通常の数字が含まれます。PDFの文字情報では下付きの根拠を確認できないため、表示上の添字を確認してください。'});
  }
  return hits;
}
