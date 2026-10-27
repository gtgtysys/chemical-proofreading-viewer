import {checkFormula,checkReaction,findReactionRanges} from './reactions.mjs';

export function mathText(row,items) {
  const byId=new Map(items.map(item=>[item.id,item]));
  const chars=row.text.split('');
  let prior;
  row.charMap.forEach((p,n)=>{
    if(!p) return;
    const item=byId.get(p.itemId);
    if(!item) return;
    const inBrackets=/\[[^\[\]]*$/.test(row.text.slice(0,n));
    if(prior && !inBrackets && prior.item.id!==item.id && item.rect.left-(prior.item.rect.left+prior.item.rect.width)>Math.max(item.emHeight ?? item.rect.height,prior.item.emHeight ?? prior.item.rect.height)*.9) {
      for(let k=prior.n+1;k<n;k++) if(/\s/.test(chars[k])) chars[k]='、';
    }
    prior={item,n};
  });
  return chars.join('');
}

export function scriptLabelSpans(row, items) {
  const byId=new Map(items.map(item=>[item.id,item]));
  const members=[...new Set(row.charMap.filter(Boolean).map(p=>p.itemId))].map(id=>byId.get(id)).filter(Boolean);
  const baseline=item=>item.textOrigin?.y ?? item.rect.top+item.rect.height/1.18;
  const height=item=>item.emHeight ?? item.rect.height/1.18;
  const labels=new Set();
  for(const item of members) {
    const left=members.filter(base=>base!==item && base.rect.left<=item.rect.left && item.rect.left-(base.rect.left+base.rect.width)<height(base)*.6).sort((a,b)=>b.rect.left-a.rect.left)[0];
    if(left && item.size<left.size*.88 && baseline(item)>baseline(left)+height(left)*.08) labels.add(item.id);
    if(item.text==='e' && items.some(next=>next.pageNumber===item.pageNumber && next.rect.left>=item.rect.left+item.rect.width*.7 && next.rect.left-(item.rect.left+item.rect.width)<height(item)*.6 && next.size<item.size*.88 && baseline(next)<baseline(item)-height(item)*.08 && baseline(next)>baseline(item)-height(item))) labels.add(item.id);
  }
  const spans=[];
  row.charMap.forEach((p,start)=>{if(p && labels.has(p.itemId)) spans.push({start,length:1});});
  return spans;
}

export function unitSpans(text) {
  const spans=[];
  const pattern=/(?<![A-Za-z])(?:mmol|kmol|mol|kg|mg|mL|kPa|MPa|Pa|kJ|cm|nm|Hz|g|L|J|K|s|m|V|A|W|N|C|F|S|Ω)(?![A-Za-z])/g;
  for(const m of text.matchAll(pattern)) {
    const prefix=text.slice(0,m.index);
    const number=prefix.match(/(?<![A-Za-z0-9₀-₉])\d+(?:[.,]\d+)?[\s·⋅/()]*$/);
    const value=Boolean(number) && !/[A-Za-z₀-₉][\s]*[/*÷^][\s]*$/.test(prefix.slice(0,number.index));
    const named=/単位(?:は|が|を|に|として|[：:])?[\s（(]*$/.test(prefix);
    const compound=spans.some(span=>/^[\s·⋅/()\[\]⁻⁰¹²³⁴⁵⁶⁷⁸⁹0-9−-]+$/.test(text.slice(span.start+span.length,m.index)) && (/[·⋅/]/.test(text.slice(span.start+span.length,m.index)) || /^(?:[−-]\d+|[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)/.test(text.slice(m.index+m[0].length))));
    const open=prefix.lastIndexOf('['),close=text.indexOf(']',m.index);
    const inBrackets=open>prefix.lastIndexOf(']') && close>=0;
    const bracket=inBrackets?text.slice(open+1,close):'';
    const unitExpression=/^(?:(?:mmol|kmol|mol|kg|mg|mL|kPa|MPa|Pa|kJ|cm|nm|Hz|g|L|J|K|s|m|V|A|W|N|C|F|S|Ω)(?:[⁻⁰¹²³⁴⁵⁶⁷⁸⁹0-9−-]+)?[\s·⋅/()]*)+$/;
    const quantityLabel=/(?:単位|長さ|距離|面積|体積|質量|時間|温度|圧力|力|電圧|電流|電荷|抵抗)[：:\s（(]*$/.test(text.slice(0,open));
    const bracketed=inBrackets && unitExpression.test(bracket) && (quantityLabel || /[·⋅/]/.test(bracket) || /[a-z]{2}/.test(bracket) || /^[gsmt]\s*$/.test(bracket) && /[A-Za-z]\s*$/.test(text.slice(0,open)));
    const suffix=text.slice(m.index+m[0].length);
    if(inBrackets && !bracketed) continue;
    if(/[=＝]/.test(text) && m[0].length===1 && !/\s$/.test(prefix) && /^[+−-]\s*\d+(?:[.,]\d+)?\s*(?:$|[=＝])/.test(suffix)) continue;
    if((!/^\s*[=＝<>≤≥≠]/.test(suffix) || /\d$/.test(prefix)) && (value || named || compound || bracketed)) spans.push({start:m.index,length:m[0].length,kind:'unit'});
  }
  return spans;
}

// Variables need mathematical context. Standalone letters, units, chemical
// species, reaction equations and named upright functions are not inferred here.
export function mathVariables(text, protectedRanges=[]) {
  const marks=[];
  const functions=new Set(['sin','cos','tan','asin','acos','atan','sinh','cosh','tanh','log','lg','ln','exp','sqrt','max','min','lim','det']);
  const fixedUnits=new Set(['mol','mmol','kmol','kg','mg','mL','kPa','MPa','Pa','kJ','cm','nm','Hz']);
  if(/[→⇄⇌↔⇒⟶⟷]/.test(text)) return marks;
  const protectedSpans=[...protectedRanges,...[...text.matchAll(/\[[A-Z][A-Za-z0-9₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻+−\s-]*\]|[℃°◦]\s*C/g)].map(m=>({start:m.index,length:m[0].length}))];
  // Named acidity quantities are upright symbols (IUPAC Gold Book S06210).
  for(const m of text.matchAll(/(?<![A-Za-z])p\s*(?:O\s*)?H(?![A-Za-z])/g)) protectedSpans.push({start:m.index,length:m[0].length});
  const labels=[...text.matchAll(/(?<![A-Za-z])\((?:[a-z]|[ivxlcdm]+)\)/g)];
  if(labels.length>=2 || /^\s*\([ivxlcdm]+\)/.test(text)) for(const m of labels) protectedSpans.push({start:m.index,length:m[0].length});
  const atomicAssignments=[...text.matchAll(/([A-Z][a-z]?)\s*[=＝]\s*\d+(?:\.\d+)?/g)].filter(m=>checkFormula(m[1]).status==='parsed');
  if(atomicAssignments.length>=2 || /(?:原子量|原子番号|元素記号)(?:[：:；;]|は|\s)/.test(text)) for(const m of atomicAssignments) protectedSpans.push({start:m.index,length:m[1].length});
  const runs=/[A-Za-zΑ-Ωα-ω∆0-9₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻=＝≈≒<>≤≥≠+−\-*/÷×·^()\[\]., \t]+/gu;
  for(const run of text.matchAll(runs)) {
    if(!/[=＝≈≒<>≤≥≠+−\-*/÷×^]/.test(run[0]) || /(?:->|→|⇄|⇌|↔|⇒)/.test(run[0])) continue;
    const relation=/[=＝≈≒<>≤≥≠]/.test(run[0]);
    const variableOperation=/(?<![A-Za-z])[a-zα-ω](?:[0-9₀-₉]*)\s*[+*/÷×−-]\s*(?:[a-zα-ω]|\d)/u.test(run[0]);
    if(!relation && !variableOperation) continue;
    const species=run[0].trim().split(/[=＝<>≤≥−-]/).map(s=>s.trim()).filter(Boolean);
    if(/[=＝−-]/.test(run[0]) && species.length>=3 && species.every(s=>checkFormula(s).status==='parsed' || /^R(?:[0-9₀-₉]+)?$/.test(s)) && species.filter(s=>checkFormula(s).status==='parsed').length>=2) continue;
    if(!protectedRanges.some(r=>r.kind==='unit' && r.start>=run.index && r.start<run.index+run[0].length) && species.length>1 && species.every(s=>checkFormula(s).status==='parsed')) continue;
    // The run regex stops before Unicode arrows; reject neighbouring arrow ends too.
    if(/[→⇄⇌↔⇒]/.test(text[run.index-1] || '') || /^[→⇄⇌↔⇒]/.test(text.slice(run.index+run[0].length))) continue;
    if(/\((?:s|l|g|aq)\)/.test(run[0])) continue;
    if(findReactionRanges(run[0]).some(h=>h.result.status==='balanced' || h.result.status==='unbalanced')) continue;
    if(!protectedRanges.some(r=>r.kind==='unit' && r.start>=run.index && r.start<run.index+run[0].length) && checkReaction(run[0]).status!=='unknown') continue;
    for(const token of run[0].matchAll(/[A-Za-zΑ-Ωα-ω∆]+/gu)) {
      const value=token[0];
      if(functions.has(value) || fixedUnits.has(value) || value.length>3) continue;
      if(value.length>1 && /[a-z]/.test(value) && checkFormula(value).status==='parsed') continue;
      for(let n=0;n<value.length;n++) {
        if(/[Δ∆]/.test(value[n])) continue;
        const start=run.index+token.index+n;
        if(protectedSpans.some(range=>start>=range.start && start<range.start+range.length)) continue;
        marks.push({start,length:1,kind:'variable'});
      }
    }
  }
  return marks;
}
