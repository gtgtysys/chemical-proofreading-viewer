export function textRows(items) {
  const pages=new Map(),result=[];
  for(const item of items) {if(!pages.has(item.pageNumber)) pages.set(item.pageNumber,[]);pages.get(item.pageNumber).push(item);}
  for(const [pageNumber,pageItems] of pages) {
    const rows=[];
    const axis=item=>item.textDirection || {x:1,y:0};
    const origin=item=>item.textOrigin || {x:item.rect.left,y:item.rect.top+item.rect.height/1.18};
    const along=item=>{const d=axis(item),p=origin(item);return p.x*d.x+p.y*d.y;};
    const across=item=>{const d=axis(item),p=origin(item);return -p.x*d.y+p.y*d.x;};
    for(const item of [...pageItems].sort((a,b)=>a.rect.top-b.rect.top || a.rect.left-b.rect.left)) {
      const direction=axis(item),cross=across(item);
      let row=rows.find(r=>r.direction.x*direction.x+r.direction.y*direction.y>.995 && Math.abs(r.cross-cross)<=(item.emHeight ?? item.rect.height/1.18)*.38);
      if(!row){row={cross,direction,items:[]};rows.push(row);}row.items.push(item);
    }
    rows.sort((a,b)=>Math.min(...a.items.map(i=>i.rect.top))-Math.min(...b.items.map(i=>i.rect.top)));
    rows.forEach((row,rowIndex)=>{
      row.items.sort((a,b)=>along(a)-along(b));
      let text='';const charMap=[];let previous;
      for(const item of row.items) {
        const gap=previous?along(item)-(along(previous)+(previous.advance ?? previous.rect.width)):0;
        // Coordinates are in displayed pixels; item.size is in PDF points.
        // Compare gaps with displayed em heights so fitting/zooming cannot
        // join a following quantity into a formula (H2S2O7 + 1.00 mol, etc.).
        const emHeight=i=>i.emHeight ?? i.rect.height/1.18;
        const quantityAfterSubscript=previous && /^\d+$/.test(previous.text) && /^\d/.test(item.text) && emHeight(item)>emHeight(previous)*1.25 && across(item)<across(previous)-emHeight(item)*.08;
        if(previous && (gap>Math.min(emHeight(item),emHeight(previous))*.35 || quantityAfterSubscript)) {text+=' ';charMap.push(null);}
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
export function detectionIndex(rows,normalize=false,respectParagraphs=false) {
  let text='';const positionAt=[];let previous;
  for(const row of rows) {
    if(text){
      const distant=respectParagraphs && previous?.pageNumber===row.pageNumber && (row.rect.top-previous.rect.top>Math.max(row.rect.height,previous.rect.height)*2.8 || Math.abs(row.rect.left-previous.rect.left)>Math.max(row.rect.width,previous.rect.width)*.6);
      text+=distant?'\n\n':'\n';positionAt.push(null);if(distant)positionAt.push(null);
    }
    for(let offset=0;offset<row.text.length;offset++) {
      const value=normalize?row.text[offset].normalize('NFKC'):row.text[offset];
      text+=value;for(let i=0;i<value.length;i++) positionAt.push(row.charMap[offset]);
    }
    previous=row;
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
  const baseline=i=>i.textOrigin?.y ?? i.rect.top+i.rect.height/1.18;
  return sources.some(item=>/^\d+$/.test(item.text) && sources.some(base=>/[A-Za-z]/.test(base.text) && item.size<base.size*.88 && baseline(item)>baseline(base)+(base.emHeight ?? base.rect.height/1.18)*.08));
}
