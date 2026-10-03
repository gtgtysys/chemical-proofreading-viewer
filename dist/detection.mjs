export function textRows(items) {
  const pages=new Map(),result=[];
  for(const item of items) {if(!pages.has(item.pageNumber)) pages.set(item.pageNumber,[]);pages.get(item.pageNumber).push(item);}
  for(const [pageNumber,pageItems] of pages) {
    const rows=[];
    for(const item of [...pageItems].sort((a,b)=>a.rect.top-b.rect.top || a.rect.left-b.rect.left)) {
      let row=rows.find(r=>Math.abs(r.top-item.rect.top)<=Math.max(3,item.rect.height*.32));
      if(!row){row={top:item.rect.top,items:[]};rows.push(row);}row.items.push(item);
    }
    rows.forEach((row,rowIndex)=>{
      row.items.sort((a,b)=>a.rect.left-b.rect.left);
      let text='';const charMap=[];let previous;
      for(const item of row.items) {
        const gap=previous?item.rect.left-(previous.rect.left+previous.rect.width):0;
        if(previous && gap>Math.max(2,Math.min(item.size,previous.size)*.35)) {text+=' ';charMap.push(null);}
        text+=item.text;
        for(let offset=0;offset<item.text.length;offset++) charMap.push({itemId:item.id,offset,total:item.text.length});
        previous=item;
      }
      const first=row.items[0],left=Math.min(...row.items.map(i=>i.rect.left)),top=Math.min(...row.items.map(i=>i.rect.top));
      const right=Math.max(...row.items.map(i=>i.rect.left+i.rect.width)),bottom=Math.max(...row.items.map(i=>i.rect.top+i.rect.height));
      result.push({...first,id:`line-p${pageNumber}-${rowIndex}`,text,charMap,sourceIds:row.items.map(i=>i.id),virtual:true,
        rect:{left,top,width:right-left,height:bottom-top}});
    });
  }
  return result;
}
export function detectionIndex(rows,normalize=false) {
  let text='';const positionAt=[];
  for(const row of rows) {
    if(text){text+='\n';positionAt.push(null);}
    for(let offset=0;offset<row.text.length;offset++) {
      const value=normalize?row.text[offset].normalize('NFKC'):row.text[offset];
      text+=value;for(let i=0;i<value.length;i++) positionAt.push(row.charMap[offset]);
    }
  }
  return {text,positionAt};
}
export function scriptGroup(text) {
  if(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return '日本語';
  if(/[A-Za-z]/.test(text)) return '欧文';
  return '数字・記号';
}
export function formulaEvidence(token,context='') {
  if(!/^[A-Za-z0-9₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻+−-]+$/.test(token)) return false;
  if(/[₀-₉⁺⁻]/.test(token)) return true;
  const letters=token.replace(/[0-9⁰¹²³⁴⁵⁶⁷⁸⁹+−-]/g,'');
  const parts=letters.match(/[A-Z][a-z]?/g)||[];
  // Mixed-case compounds and multi-element formulas with counts are stronger than variable labels.
  if(parts.length>=2 && (/[a-z]/.test(letters) || /\d/.test(token))) return true;
  return /(?:化学式|分子式|組成式|元素記号|反応式|イオン|分子|酸化|還元|水素|酸素|窒素)/.test(context);
}
export function expectedSubscript(match,segments,items) {
  const byId=new Map(items.map(i=>[i.id,i]));
  const sources=segments.map(s=>byId.get(s.itemId)).filter(Boolean);
  if(segments.some(segment=>/[₀-₉]/.test(byId.get(segment.itemId)?.text.slice(segment.start,segment.end) || ''))) return true;
  const baseline=i=>i.rect.top+i.rect.height/1.18;
  return sources.some(item=>/^\d+$/.test(item.text) && sources.some(base=>/[A-Za-z]/.test(base.text) && item.size<base.size*.88 && baseline(item)>baseline(base)+base.size*.12));
}
