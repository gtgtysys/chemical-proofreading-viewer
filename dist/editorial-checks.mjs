const indexes=new WeakMap();
const pages=new WeakMap();
function index(items) {if(!indexes.has(items)) indexes.set(items,new Map(items.map(i=>[i.id,i])));return indexes.get(items);}
function sources(row,start,length,items) {const byId=index(items);return [...new Set(row.charMap.slice(start,start+length).filter(Boolean).map(p=>p.itemId))].map(id=>byId.get(id)).filter(Boolean);}

export function instructionChecks(blocks,items) {
  const hits=[];
  for(const row of blocks) {
    let text='';const offsets=[];
    for(let n=0;n<row.text.length;n++) if(!/\s/.test(row.text[n])) {text+=row.text[n];offsets.push(n);}
    const pattern=/(?:誤っている|誤った|正しくない|適切でない|適当でない|当てはまらない|該当しない|不適切な|誤りのある|ではない)(?:もの|記述|説明|文章|文|式|選択肢)/g;
    for(const m of text.matchAll(pattern)) {
      const tail=text.slice(m.index+m[0].length,m.index+m[0].length+35).split(/[。．!?！？]/)[0];
      if(!/^(?:を(?:[一二三四五六七八九十0-9０-９]|つ|個|だけ|それぞれ|すべて|全て|ひとつ|ふたつ|各|記号|で|、|，){0,16}(?:選べ|選び|選択|答え|挙げ)|はどれ(?:か|ですか))/.test(tail)) continue;
      const start=offsets[m.index],end=offsets[m.index+m[0].length-1]+1;
      const glyphs=sources(row,start,end-start,items);
      if(!glyphs.length || glyphs.some(i=>/^(?:serif|sans-serif|monospace|不明)(?:\s|$)/i.test(i.font || ''))) continue;
      if(glyphs.some(i=>!i.bold)) hits.push({row,start,length:end-start,text:row.text.slice(start,end),type:'format',label:'設問の強調',suggestion:'太字にする',reason:'選ぶ条件を示す語句の太字を確認してください。'});
    }
  }
  return hits;
}

const sets=new WeakMap();
export function nonJoyoChecks(blocks,policy) {
  if(!policy?.characters) return [];
  if(!sets.has(policy)) sets.set(policy,new Set([...(policy.characters+(policy.acceptable || ''))]));
  const allowed=sets.get(policy),hits=[];
  for(const row of blocks) {
    let offset=0;
    for(const ch of row.text) {
      const normalized=ch.normalize('NFKC');
      if(/\p{Unified_Ideograph}/u.test(ch) && !allowed.has(ch) && !allowed.has(normalized)) hits.push({row,start:offset,length:ch.length,text:ch,type:'kanji',label:'常用漢字外',suggestion:'仮名表記・教材の許容表記を確認',reason:'常用漢字表の本表・許容字体と照合した確認候補です。'});
      offset+=ch.length;
    }
  }
  return hits;
}

export function scriptPosition(item,items) {
  const origin=i=>i.textOrigin || {x:i.rect.left,y:i.rect.top+i.rect.height/1.18};
  const em=i=>i.emHeight ?? i.rect.height/1.18;
  if(!item.rect || !item.size || Math.abs(item.textDirection?.y || 0)>.01) return null;
  if(!pages.has(items)) {const groups=new Map();for(const i of items) if(!i.virtual) {if(!groups.has(i.pageNumber))groups.set(i.pageNumber,[]);groups.get(i.pageNumber).push(i);}pages.set(items,groups);}
  const candidates=(pages.get(items).get(item.pageNumber) || []).filter(base=>base!==item && base.size>=item.size*.98 && base.rect && Math.abs(base.textDirection?.y || 0)<.01 && Math.abs(origin(base).y-origin(item).y)<em(base)*.8 && Math.max(0,item.rect.left-(base.rect.left+base.rect.width),base.rect.left-(item.rect.left+item.rect.width))<em(base)*1.2 && (base.size>item.size*1.08 || base.rect.left<item.rect.left));
  candidates.sort((a,b)=> {
    const distance=base=>Math.max(0,item.rect.left-(base.rect.left+base.rect.width),base.rect.left-(item.rect.left+item.rect.width))+Math.abs(origin(base).y-origin(item).y)*.3;
    return distance(a)-distance(b) || b.size-a.size;
  });
  const base=candidates[0];if(!base) return null;
  return {percent:100*(origin(base).y-origin(item).y)/em(base),reference:base.text,referenceId:base.id};
}

export function describeScriptPositions(selected,items) {
  const values=selected.map(i=>scriptPosition(i,items)).filter(Boolean);
  if(!values.length) return '位置の比較対象なし';
  return [...new Set(values.map(v=>Math.abs(v.percent)<2?'基線（0%）':`${v.percent>0?'上付き':'下付き'} ${v.percent>0?'+':''}${v.percent.toFixed(1)}%`))].join('・');
}
