export const reviewLabels = {unreviewed: '未確認', fix: '要修正', accepted: '問題なし', pending: '保留'};
export function reviewKey(candidate) {
  return JSON.stringify([candidate.type, candidate.text, candidate.reason, candidate.segments.map(s => [s.itemId, s.start, s.end])]);
}
export function snapshotRows(items) {
  const pages = new Map();
  for (const item of items.filter(i => !i.virtual)) {
    if (!pages.has(item.pageNumber)) pages.set(item.pageNumber, []);
    pages.get(item.pageNumber).push(item);
  }
  const rows = [];
  for (const [page, list] of pages) {
    const groups = [];
    for (const item of [...list].sort((a,b) => a.rect.top-b.rect.top || a.rect.left-b.rect.left)) {
      let group = groups.find(g => Math.abs(g.top-item.rect.top) <= Math.max(3,item.rect.height*.32));
      if (!group) {group={top:item.rect.top,items:[]};groups.push(group);}
      group.items.push(item);
    }
    for (const group of groups) {
      const ordered=group.items.sort((a,b)=>a.rect.left-b.rect.left);
      rows.push({page, text:ordered.map(i=>i.text).join(''), ids:ordered.map(i=>i.id)});
    }
  }
  return rows;
}
function contextKeys(rows) {
  return rows.map((row,i) => JSON.stringify([rows[i-1]?.text || '', row.text, rows[i+1]?.text || '']));
}
export function compareRows(oldRows, newRows) {
  // Carry only exact, unique row text AND adjacent text; repeated headers cannot inherit decisions.
  const before=contextKeys(oldRows), after=contextKeys(newRows);
  const counts=list=>{const map=new Map();for(const key of list) map.set(key,(map.get(key)||0)+1);return map;};
  const oldCounts=counts(before), newCounts=counts(after), unchanged=new Map();
  after.forEach((key,i)=>{if(oldCounts.get(key)===1 && newCounts.get(key)===1) unchanged.set(i,before.indexOf(key));});
  function extras(rows,availableRows) {
    const available=counts(availableRows.map(r=>r.text));
    return rows.filter(row=>{const n=available.get(row.text)||0;if(n){available.set(row.text,n-1);return false;}return true;});
  }
  return {unchanged, changed:extras(newRows.map((row,index)=>({...row,index})),oldRows), removed:extras(oldRows,newRows)};
}
export function carryReviews(oldSnapshot, newRows, newCandidates) {
  const comparison=compareRows(oldSnapshot.rows || [],newRows), result={};
  const oldCandidates=oldSnapshot.candidates || [];
  for (const candidate of newCandidates) {
    const rowIndex=newRows.findIndex(row=>candidate.itemIds.every(id=>row.ids.includes(id)));
    const oldIndex=comparison.unchanged.get(rowIndex);
    if(oldIndex===undefined) continue;
    const oldRow=oldSnapshot.rows[oldIndex];
    const matches=oldCandidates.filter(c=>c.itemIds.every(id=>oldRow.ids.includes(id)) && c.type===candidate.type && c.text===candidate.text && c.reason===candidate.reason);
    if(matches.length!==1) continue;
    const oldReview=oldSnapshot.reviews?.[matches[0].key];
    if(oldReview) result[reviewKey(candidate)]={...oldReview};
  }
  return {reviews:result,comparison};
}
export function parsePreferences(text) {
  return text.split(/\r?\n/).filter(line=>line.trim()).map((line,index)=>{
    const parts=line.split('=>').map(s=>s.trim());
    if(parts.length!==2 || !parts[0] || !parts[1] || parts[0]===parts[1]) throw Error(`${index+1}行目を「別表記 => 統一する表記」で入力してください。`);
    return {variant:parts[0],preferred:parts[1]};
  });
}
export function structureChecks(rows) {
  const hits=[], definitions=new Map(), mentions=[];let chapter=0;
  const isChapter=row=>/^(?:化学\s*問題\s*[ⅠⅡⅢⅣⅤIVX]+|第\s*[0-9０-９一二三四五六七八九十]+\s*問)/.test(row.text.replace(/\s/g,''));
  rows.forEach((row,line)=>{
    if(isChapter(row)) chapter++;
    let captionRow=false;
    for (const m of row.text.matchAll(/(図|表)\s*([0-9０-９]+(?:\s*[−‐‑–—－ー一-]\s*[0-9０-９]+)*)/g)) {
      const key=m[1]+m[2].normalize('NFKC').replace(/[−‐‑–—－ー一]/g,'-').replace(/\s/g,'');
      const tail=row.text.slice(m.index+m[0].length);
      // A title at row start must be separated from its number; prose references are excluded.
      const title=(row.text.slice(0,m.index).trim()==='' || captionRow) && !/^\s*(?:[（(]\s*[0-9０-９a-zA-Z]+\s*[）)]\s*)?(?:の|を|に|は|が|と|で|参照|より|から|(?:中|内|上|下|左|右)(?:の|に|で))/.test(tail);
      if(title) captionRow=true;
      const hit={line,start:m.index,length:m[0].length,text:m[0],chapter};
      if(title) {
        const previous=definitions.get(key);
        if(previous && previous.chapter===chapter && (rows[previous.line].page===undefined || rows[previous.line].page===row.page)) hits.push({...hit,related:[previous],reason:`「${key}」の見出しが重複しています。1つ目と2つ目を両方ハイライトします。`});
        definitions.set(key,hit);
      } else mentions.push({...hit,key});
    }
  });
  for(const mention of mentions) if(!definitions.has(mention.key)) hits.push({...mention,reason:`「${mention.key}」の図表見出しをテキストから確認できません。画像内の見出し・別冊への参照も確認してください。`});
  const numbers=new Map();let previousNumber=0;
  rows.forEach((row,line)=>{
    if(isChapter(row)) {numbers.clear();previousNumber=0;}
    const match=row.text.match(/^\s*(?:大問|問題|問)\s*([0-9０-９]+)(?=\s|[.．:：、]|$)/);
    if(!match) return;
    if(/^\s*(?:に|を|の|は|と|で)/.test(row.text.slice(match[0].length))) return;
    // Lists such as "問1、問2に答えよ" are instructions, not question headings.
    if(/^\s*[、,，]\s*(?:問\s*[0-9０-９]+\s*[、,，]?\s*)+(?:に|を|の|は)/.test(row.text.slice(match[0].length))) return;
    const key=match[1].normalize('NFKC');
    if(Number(key)===1 && (previousNumber>1 || rows[line-1]?.page!==row.page)) numbers.clear();
    const current={line,start:match.index,length:match[0].length,text:match[0],page:row.page};
    const previous=numbers.get(key);
    if(previous) hits.push({...current,related:[previous],reason:`${match[0].trim()} が重複しています。1つ目と2つ目を両方ハイライトします。章ごとの振り直しなら「問題なし」にしてください。`});
    else numbers.set(key,current);
    previousNumber=Number(key);
  });
  // ASCII parentheses/brackets are often math intervals, units or detached PDF equation fragments.
  const pairs={'（':'）','「':'」','『':'』'}, stack=[];
  rows.forEach((row,line)=>{
    for(let start=0;start<row.text.length;start++) {
      const original=row.text[start],ch=original==='('? '（': original===')'?'）':original;
      if(pairs[ch]) stack.push({ch,line,start,length:1,text:original});
      else if(Object.values(pairs).includes(ch)) {
        if(stack.length && pairs[stack.at(-1).ch]===ch) stack.pop();
        else if(original!==')' && !/^(?:例|例えば)\s*$/.test(row.text.slice(0,start))) hits.push({line,start,length:1,text:original,reason:'対応する開き括弧を確認できません。本文の読み取り順も確認してください。'});
      }
    }
  });
  for(const entry of stack) if(entry.text!=='(') hits.push({...entry,reason:'対応する閉じ括弧を確認できません。本文の読み取り順も確認してください。'});
  return hits;
}
export function csvCell(value) {
  const text=String(value ?? '');
  const safe=/^[\s]*[=+\-@]/.test(text) ? "'"+text : text;
  return '"'+safe.replaceAll('"','""')+'"';
}
export function validateSession(value, fingerprint) {
  if(!value || value.schemaVersion!==1 || value.fingerprint!==fingerprint || !Array.isArray(value.rows) || !Array.isArray(value.candidates)) throw Error('このPDF用の確認データではありません。');
  const map=value=>value && typeof value==='object' && !Array.isArray(value);
  for(const name of ['reviews','roles','exclusions']) if(!map(value[name])) throw Error('確認データの形式が不正です。');
  for(const entry of Object.values(value.reviews)) if(!map(entry) || !Object.hasOwn(reviewLabels,entry.status) || typeof entry.note!=='string') throw Error('確認状態の形式が不正です。');
  for(const role of Object.values(value.roles)) if(!['本文','見出し','化学式','単位','番号','係数','ページ番号','キャプション'].includes(role)) throw Error('役割の形式が不正です。');
  for(const scope of Object.values(value.exclusions)) if(!['all','text'].includes(scope)) throw Error('除外設定の形式が不正です。');
  if(value.rows.some(row=>!map(row) || typeof row.text!=='string' || !Number.isInteger(row.page) || !Array.isArray(row.ids) || row.ids.some(id=>typeof id!=='string'))) throw Error('比較用の行データが不正です。');
  if(value.candidates.some(c=>!map(c) || typeof c.key!=='string' || typeof c.type!=='string' || typeof c.text!=='string' || typeof c.reason!=='string' || !Array.isArray(c.itemIds) || c.itemIds.some(id=>typeof id!=='string'))) throw Error('候補データが不正です。');
  return value;
}
