const sub='₀₁₂₃₄₅₆₇₈₉', sup='⁰¹²³⁴⁵⁶⁷⁸⁹';
const baseline=item=>item.rect.top + item.rect.height / 1.18;
export function reactionRows(items) {
  const arrows=items.filter(item=>/(?:→|⇄|⇌|↔|⟶|⟷|⇒|->|=)/.test(item.text));
  const seen=new Set(), rows=[];
  for(const arrow of arrows) {
    const center=arrow.rect.top+arrow.rect.height/2;
    const nearby=items.filter(item=>item.pageNumber===arrow.pageNumber && Math.abs(item.rect.top+item.rect.height/2-center)<=Math.max(arrow.rect.height,item.rect.height)*.7);
    nearby.sort((a,b)=>a.rect.left-b.rect.left || baseline(b)-baseline(a));
    const key=nearby.map(i=>i.id).join('|');if(seen.has(key)) continue;seen.add(key);
    let row=assemble(nearby,arrow);
    // Only join an adjacent, aligned chemical-only row with an explicit continuation.
    // Retain mapping to both physical rows for highlighting.
    for(const direction of [-1,1]) for(let depth=0;depth<3;depth++) {
      const sources=items.filter(item=>row.sourceIds.includes(item.id));
      const edge=direction<0?Math.min(...sources.map(i=>baseline(i))):Math.max(...sources.map(i=>baseline(i)));
      const outside=items.filter(item=>item.pageNumber===arrow.pageNumber && !row.sourceIds.includes(item.id) && direction*(baseline(item)-edge)>arrow.size*.9 && direction*(baseline(item)-edge)<arrow.size*4);
      if(!outside.length) break;
      const neighbour=outside.sort((a,b)=>Math.abs(baseline(a)-edge)-Math.abs(baseline(b)-edge))[0];
      const adjacent=outside.filter(item=>Math.abs(baseline(item)-baseline(neighbour))<Math.max(item.size,neighbour.size)*.7).sort((a,b)=>a.rect.left-b.rect.left);
      const extra=assemble(adjacent,neighbour);
      const left=direction<0?extra:row,right=direction<0?row:extra;
      const chemicalOnly=/^[A-Za-z0-9₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻+−\-()\[\]·.^→⇄⇌↔⟶⟷⇒=<> \t]+$/;
      if(!/[+→⇄⇌↔=]\s*$/.test(left.text) || !/[A-Z]/.test(extra.text)) break;
      const rowLeft=Math.min(...sources.map(i=>i.rect.left)),extraLeft=Math.min(...adjacent.map(i=>i.rect.left));
      if(!chemicalOnly.test(extra.text) || Math.abs(rowLeft-extraLeft)>arrow.size*4) {
        row.incompleteReason='近くに反応式の続きと思われる行があります。結合する範囲を確定できないため、左右の不一致を判定していません。式全体を確認してください。';
        break;
      }
      row={...row,text:left.text+'\n'+right.text,charMap:[...left.charMap,null,...right.charMap],sourceIds:[...left.sourceIds,...right.sourceIds]};
    }
    rows.push(row);
  }
  return rows;
}
function assemble(nearby,arrow) {
    let text='';const charMap=[];
    let previous;
    for(const item of nearby) {
      const gap=previous?item.rect.left-(previous.rect.left+previous.rect.width):0;
      // Keep a question label separate from its equation; preserve spaced coefficients.
      if(previous && gap>Math.max(2,Math.min(previous.size,item.size)*.35)) {
        const questionLabel=/(?:問|問題)\s*[0-9０-９]+$/.test(text);
        const besideArrow=/(?:→|⇄|⇌|↔|⟶|⟷|⇒|->|=)/.test(previous.text+item.text) && gap<=Math.max(previous.size,item.size)*4;
        text+=questionLabel || !besideArrow && gap>Math.max(previous.size,item.size)*1.5?'\n':' ';charMap.push(null);
      }
      let value=item.text;
      if(/^[0-9+−\-]+$/.test(value)) {
        const preceding=nearby.filter(other=>other!==item && other.rect.left < item.rect.left && other.rect.left+other.rect.width<=item.rect.left+4 && item.rect.left-(other.rect.left+other.rect.width)<Math.max(14,other.size*1.8) && /[A-Za-z)\]]$/.test(other.text));
        const reference=preceding.sort((a,b)=>b.rect.left-a.rect.left)[0];
        if(reference && item.size < reference.size*.88) {
          const displacement=baseline(item)-baseline(reference);
          if(displacement>reference.size*.12) value=value.replace(/[0-9]/g,ch=>sub[Number(ch)]);
          else if(displacement < -reference.size*.05) value=value.replace(/[0-9]/g,ch=>sup[Number(ch)]).replaceAll('+','⁺').replace(/[−\-]/g,'⁻');
        }
      }
      text+=value;
      for(let offset=0;offset<item.text.length;offset++) charMap.push({itemId:item.id,offset,total:item.text.length});
      previous=item;
    }
  return {...arrow,text,charMap,sourceIds:nearby.map(i=>i.id)};
}
