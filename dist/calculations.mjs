const supers='⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻';
function normalized(text) {
  return text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g,s=>'^('+[...s].map(c=>'0123456789+-'[supers.indexOf(c)]).join('')+')').normalize('NFKC').replace(/[−–]/g,'-').replace(/[×·⋅]/g,'*').replace(/÷/g,'/').replace(/[{}]/g,c=>c==='{'?'(':')');
}
export function evaluateNumeric(text) {
  const source=normalized(text).replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g,s=>s.replaceAll(',',''));
  const tokens=[];let cursor=0;
  while(cursor<source.length) {
    if(/\s/.test(source[cursor])) {cursor++;continue;}
    const number=source.slice(cursor).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    if(number) {tokens.push(Number(number[0]));cursor+=number[0].length;}
    else if('+-*/^()√'.includes(source[cursor])) tokens.push(source[cursor++]);
    else return {status:'unknown'};
    if(tokens.length>256) return {status:'unknown'};
  }
  let at=0,depth=0;
  const take=()=>tokens[at++];
  function primary() {
    if(++depth>32) throw Error('depth');
    let value;
    if(tokens[at]==='(') {take();value=sum();if(take()!==')') throw Error('parenthesis');}
    else {value=take();if(typeof value!=='number') throw Error('number');}
    depth--;return value;
  }
  function power() {const value=primary();return tokens[at]==='^'?(take(),Math.pow(value,unary())):value;}
  function unary() {if(tokens[at]==='+' || tokens[at]==='-') {const sign=take();return (sign==='-'?-1:1)*unary();}if(tokens[at]==='√') {take();return Math.sqrt(unary());}return power();}
  function product() {
    let value=unary();
    while(tokens[at]==='*' || tokens[at]==='/' || tokens[at]==='(') {
      const op=tokens[at]==='('? '*':take(),right=unary();
      if(op==='/' && right===0) throw Error('zero');
      value=op==='*'?value*right:value/right;
    }
    return value;
  }
  function sum() {let value=product();while(tokens[at]==='+' || tokens[at]==='-') {const op=take(),right=product();value=op==='+'?value+right:value-right;}return value;}
  try {
    if(!tokens.length) return {status:'unknown'};
    const value=sum();
    return at===tokens.length && Number.isFinite(value)?{status:'parsed',value}:{status:'unknown'};
  } catch(error) {return {status:error.message==='zero'?'division-by-zero':'unknown'};}
}
function rounding(text) {
  const match=normalized(text).replace(/\s/g,'').match(/^[+-]?(\d+(?:\.\d*)?|\.\d+)(?:[eE]([+-]?\d+)|\*10\^\(?([+-]?\d+)\)?)?$/);
  if(!match) return 0;
  const decimals=(match[1].split('.')[1] || '').length;
  return .5*Math.pow(10,Number(match[2] || match[3] || 0)-decimals);
}
const format=value=>Number(value.toPrecision(12)).toString();

// Add superscript number glyphs to a separate math view, retaining their source positions.
export function arithmeticRows(rows,items) {
  const baseline=i=>i.textOrigin?.y ?? i.rect.top+i.rect.height/1.18;
  const em=i=>i.emHeight ?? i.rect.height/1.18;
  const byId=new Map(items.map(i=>[i.id,i])),pages=new Map();
  for(const item of [...items].sort((a,b)=>a.rect.left-b.rect.left)) {
    if(!/^(?:[−-]?\d+|[−-])$/.test(item.text)) continue;
    if(!pages.has(item.pageNumber)) pages.set(item.pageNumber,[]);
    const groups=pages.get(item.pageNumber);
    const prior=groups.find(g=>Math.abs(baseline(g)-baseline(item))<em(item)*.12 && Math.abs(g.size-item.size)<item.size*.05 && item.rect.left-g.rect.left-g.rect.width>=-em(item)*.5 && item.rect.left-g.rect.left-g.rect.width<em(item)*.3);
    if(prior) {prior.text+=item.text;prior.parts.push(item);prior.rect.width=item.rect.left+item.rect.width-prior.rect.left;}
    else groups.push({...item,parts:[item],rect:{...item.rect}});
  }
  return rows.map(row=>{
    if(!/[=＝≈≒]/.test(row.text)) return row;
    const members=row.sourceIds.map(id=>byId.get(id)).filter(Boolean),edits=[];
    for(const script of pages.get(row.pageNumber) || []) {
      if(!/^[−-]?\d+$/.test(script.text)) continue;
      const bases=members.filter(base=>/[0-9)]$/.test(base.text) && script.size<base.size*.88 && baseline(script)<baseline(base)-em(base)*.12 && baseline(script)>baseline(base)-em(base)*.85 && script.rect.left>=base.rect.left+base.rect.width-em(base)*.15 && script.rect.left-(base.rect.left+base.rect.width)<em(base)*.5);
      bases.sort((a,b)=>Math.abs(script.rect.left-a.rect.left-a.rect.width)-Math.abs(script.rect.left-b.rect.left-b.rect.width));
      const base=bases[0];if(!base) continue;
      const last=row.charMap.findLastIndex(p=>p?.itemId===base.id);
      if(last>=0) edits.push({at:last+1,script});
    }
    const attached=new Set(edits.flatMap(e=>e.script.parts.map(i=>i.id)));
    let text='',map=[];
    for(let n=0;n<row.text.length;n++) if(!attached.has(row.charMap[n]?.itemId)) {text+=row.text[n];map.push(row.charMap[n]);}
    for(const edit of edits) {
      const basePosition=row.charMap[edit.at-1];
      edit.at=map.findLastIndex(p=>p?.itemId===basePosition?.itemId)+1;
    }
    for(const edit of edits.sort((a,b)=>b.at-a.at)) {
      const value='^('+edit.script.text+')';
      const positions=[null,null,...edit.script.parts.flatMap(item=>[...item.text].map((c,offset)=>({itemId:item.id,offset,total:item.text.length}))),null];
      text=text.slice(0,edit.at)+value+text.slice(edit.at);map.splice(edit.at,0,...positions);
    }
    return {...row,text,charMap:map,sourceIds:[...row.sourceIds,...edits.flatMap(e=>e.script.parts.map(i=>i.id))]};
  });
}
export function calculationChecks(rows,items=[]) {
  const hits=[],byId=new Map(items.map(i=>[i.id,i]));
  for(const row of rows) for(const run of row.text.matchAll(/[A-Za-zΑ-Ωα-ω0-9０-９⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻+＋−–\-*/×÷·⋅^√=＝≈≒()（）{}., \t]+/gu)) {
    const sides=[...run[0].matchAll(/[^=＝≈≒]+/g)];
    if(sides.length<2 || !/[=＝≈≒]/.test(run[0])) continue;
    for(let n=0;n<sides.length-1;n++) {
      const a=sides[n],b=sides[n+1],left=evaluateNumeric(a[0]),right=evaluateNumeric(b[0]);
      if(left.status==='unknown' || right.status==='unknown') continue;
      const start=run.index+a.index,length=b.index+b[0].trimEnd().length-a.index;
      const sources=[...new Set(row.charMap.slice(start,start+length).filter(Boolean).map(p=>p.itemId))].map(id=>byId.get(id)).filter(Boolean);
      if(sources.length) {
        const x1=Math.min(...sources.map(i=>i.rect.left)),x2=Math.max(...sources.map(i=>i.rect.left+i.rect.width)),base=sources.reduce((a,b)=>a.size>b.size?a:b);
        const y=base.textOrigin?.y ?? base.rect.top+base.rect.height/1.18,em=base.emHeight ?? base.rect.height/1.18;
        // Detached fraction/script glyphs indicate an incomplete physical expression.
        if(items.some(i=>i.pageNumber===row.pageNumber && !row.sourceIds.includes(i.id) && /^[A-Za-z0-9−+*/√]+$/.test(i.text) && i.rect.left<x2 && i.rect.left+i.rect.width>x1-(i.text.includes('√')?em*.2:0) && Math.abs((i.textOrigin?.y ?? i.rect.top+i.rect.height/1.18)-y)>em*.15 && Math.abs((i.textOrigin?.y ?? i.rect.top+i.rect.height/1.18)-y)<em*1.05)) continue;
      }
      const zero=left.status==='division-by-zero' || right.status==='division-by-zero';
      const ar=rounding(a[0]),br=rounding(b[0]);
      const tolerance=Math.max(ar && br?0:Math.max(ar,br),1e-10*Math.max(1,Math.abs(left.value || 0),Math.abs(right.value || 0)));
      if(!zero && Math.abs(left.value-right.value)<=tolerance) continue;
      hits.push({row,start,length,text:row.text.slice(start,start+length).trim(),type:'calculation',label:zero?'0による除算':'計算値の不一致',suggestion:zero?'分母を確認':`左辺 ${format(left.value)} ／ 右辺 ${format(right.value)}`,reason:'数値として読み取れた両辺の計算値と、記載精度に応じた丸めを確認しました。'});
    }
  }
  return hits;
}
