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

// Reconstruct logical prose before vocabulary analysis. Physical PDF rows remain
// available separately for font, script-position and reaction-layout checks.
export function textFlows(rows, items, pages = []) {
  const byId=new Map(items.map(item=>[item.id,item]));
  const em=row=>row.emHeight ?? row.rect.height/1.18;
  // Japanese and Latin fonts can expose different baselines on the same
  // printed line. Reunite those visual rows before inferring columns.
  const visual=[];
  for(const row of rows) {
    const direction=row.textDirection || {x:1,y:0};
    const match=direction.x>.95 && visual.find(other=>other.pageNumber===row.pageNumber && (other.textDirection?.x ?? 1)>.95 && Math.abs(other.rect.top-row.rect.top)<Math.max(em(other),em(row))*.45);
    if(!match) {visual.push({...row});continue;}
    const members=[...new Set([...match.sourceIds,...row.sourceIds])].map(id=>byId.get(id)).filter(Boolean).sort((a,b)=>a.rect.left-b.rect.left);
    let text='';const charMap=[];
    for(let n=0;n<members.length;n++) {
      const item=members[n],previous=members[n-1];
      if(previous && item.rect.left-previous.rect.left-previous.rect.width>Math.min(em(item),em(previous))*.35) {text+=' ';charMap.push(null);}
      text+=item.text;
      for(let offset=0;offset<item.text.length;offset++) charMap.push({itemId:item.id,offset,total:item.text.length});
    }
    const left=Math.min(match.rect.left,row.rect.left),top=Math.min(match.rect.top,row.rect.top);
    const right=Math.max(match.rect.left+match.rect.width,row.rect.left+row.rect.width),bottom=Math.max(match.rect.top+match.rect.height,row.rect.top+row.rect.height);
    Object.assign(match,{text,charMap,sourceIds:members.map(item=>item.id),rect:{left,top,width:right-left,height:bottom-top}});
  }
  rows=visual;
  const blocks=[];
  const caption=row=>{
    const text=row.text.trim(),prefix=text.match(/^(?:図|表|fig\.?|figure|table)\s*[0-9０-９]+(?:[–−-][0-9０-９]+)*/i);
    return Boolean(prefix && !/^[中内にのでをはとが]/u.test(text.slice(prefix[0].length).trim()));
  };
  const prose=row=>row.sourceIds.map(id=>byId.get(id)).some(item=>item && item.role==='本文') && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(row.text) && !caption(row) && !row.sourceIds.some(id=>/見出し|キャプション|ページ番号/.test(byId.get(id)?.role || ''));
  const right=row=>row.rect.left+row.rect.width;
  const join=(left,right)=>{
    // Japanese wraps are orthographic continuations; Latin words need a space.
    const separator=/[A-Za-z0-9]$/.test(left.text) && /^[A-Za-z0-9]/.test(right.text)?' ':'';
    return {...left,text:left.text+separator+right.text,charMap:[...left.charMap,...(separator?[null]:[]),...right.charMap],
      sourceIds:[...left.sourceIds,...right.sourceIds],sourceRows:[...left.sourceRows,...right.sourceRows],last:right.last,
      pageNumbers:[...new Set([...left.pageNumbers,...right.pageNumbers])]};
  };
  const newBlock=row=>({...row,id:`flow-${row.id}`,sourceRows:[row],last:row,pageNumbers:[row.pageNumber]});
  for(const pageNumber of [...new Set(rows.map(row=>row.pageNumber))]) {
    let active=[];
    const pageRows=rows.filter(row=>row.pageNumber===pageNumber);
    for(const row of pageRows) {
      // Split widely separated cells/columns before reconstructing reading order.
      const members=row.sourceIds.map(id=>byId.get(id)).filter(Boolean).sort((a,b)=>a.rect.left-b.rect.left);
      const groups=[];
      for(const item of members) {
        const group=groups.at(-1),previous=group?.at(-1);
        if(!previous || item.rect.left-right(previous)>Math.max(em(item),em(previous))*4) groups.push([item]);
        else group.push(item);
      }
      const fragments=groups.length>1 ? groups.flatMap(group=>textRows(group)) : [row];
      for(const fragment of fragments) {
        const next=newBlock(fragment);
        if(!prose(fragment)) {blocks.push(next);continue;}
        const possible=active.filter(block=>{
          const previous=block.last,height=Math.max(em(previous),em(fragment));
          const distance=fragment.rect.top-previous.rect.top;
          const indent=fragment.rect.left-previous.rect.left;
          const overlap=Math.max(0,Math.min(right(fragment),right(previous))-Math.max(fragment.rect.left,previous.rect.left));
          const aligned=Math.abs(indent)<height*.7 || overlap/Math.max(1,Math.min(fragment.rect.width,previous.rect.width))>.65;
          const paragraph=indent>height*.8 && fragment.rect.width>previous.rect.width || /[。！？!?]$/.test(previous.text.trim());
          const direction=previous.textDirection || {x:1,y:0};
          const interrupted=pageRows.some(other=>other.rect.top>previous.rect.top+height*.4 && other.rect.top<fragment.rect.top-height*.4 && !prose(other) && other.rect.left<right(fragment) && right(other)>fragment.rect.left && !other.sourceIds.every(id=>byId.get(id)?.role==='ページ番号'));
          return direction.x>.95 && distance>height*.5 && distance<height*3.2 && aligned && !paragraph && !interrupted;
        });
        // A row spanning several columns is ambiguous, so begin a new block.
        if(possible.length===1) {
          const previous=possible[0],merged=join(previous,next);
          blocks[blocks.indexOf(previous)]=merged;active[active.indexOf(previous)]=merged;
        } else {blocks.push(next);active.push(next);}
      }
    }
  }
  // Cross-page continuation is limited to the bottom/top of adjacent pages.
  for(let n=0;n<blocks.length;n++) {
    const block=blocks[n];if(!prose(block.last)) continue;
    const candidates=blocks.filter(other=>other.pageNumber===block.last.pageNumber+1 && prose(other.sourceRows[0]));
    const first=candidates.sort((a,b)=>a.rect.top-b.rect.top)[0];if(!first) continue;
    const page=pages.find(page=>page.pageNumber===block.last.pageNumber),nextPage=pages.find(page=>page.pageNumber===first.pageNumber);
    if(!page || !nextPage || block.last.rect.top<page.viewport.height*.65 || first.rect.top>nextPage.viewport.height*.25 || /[。！？!?]$/.test(block.text.trim()) || Math.abs(block.last.rect.left-first.rect.left)>Math.max(em(block.last),em(first))*2) continue;
    blocks[n]=join(block,first);blocks.splice(blocks.indexOf(first),1);
  }
  return blocks;
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
