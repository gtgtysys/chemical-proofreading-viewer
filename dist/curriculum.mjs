// Explicit editorial rules are data, separate from structural chemistry checks.
export function curriculumChecks(blocks, policy) {
  if(!policy || policy.schemaVersion!==1 || !Array.isArray(policy.entries)) return [];
  const hits=[];
  const compact=text=>text.normalize('NFKC').replace(/\s+/g,'');
  const index=row=>{
    let text='';const offsets=[];
    for(let at=0;at<row.text.length;at++) for(const ch of compact(row.text[at])) {text+=ch;offsets.push(at);}
    return {text,offsets};
  };
  const indexed=blocks.map(row=>({row,...index(row)}));
  const add=(entry,row,text,offsets,start,length)=>{
    if(length<1) return;
    const from=offsets[start],end=offsets[start+length-1]+1;
    hits.push({row,start:from,length:end-from,text:row.text.slice(from,end),type:'curriculum',label:entry.label || '教科書改訂・教材表記',ruleId:entry.id,ruleKind:entry.kind,suggestion:entry.preferred,
      reason:entry.note});
  };
  for(const entry of policy.entries) {
    for(const {row,text,offsets} of indexed) {
      if(entry.kind==='standard-conditions') for(const m of text.matchAll(/標準状態/g)) {
        // Check the annotation on this occurrence, never the title or unrelated
        // numbers elsewhere in the document. Keep the highlighted span on the word.
        const tail=text.slice(m.index+m[0].length);
        const stop=tail.search(/[。;；]/),local=tail.slice(0,stop<0?90:Math.min(stop,90));
        const temperature=/(?<![\d.])0(?:℃|°C)/.test(local);
        const pressure=/(?:1[.,]013(?:×|x|·)10\^?5Pa|1013(?:00|25)Pa)/.test(local);
        if(!temperature || !pressure) add(entry,row,text,offsets,m.index,m[0].length);
      }
      if(entry.kind==='term') for(const term of entry.terms || []) {
        const needle=compact(term);let start=0;
        while(needle && (start=text.indexOf(needle,start))>=0) {
          if(!entry.excludeFollowing || !text.slice(start+needle.length).startsWith(entry.excludeFollowing)) add(entry,row,text,offsets,start,needle.length);
          start+=needle.length;
        }
      }
      if(entry.kind==='deposition') for(const m of text.matchAll(/昇華/g)) {
        const begin=Math.max(text.lastIndexOf('。',m.index-1)+1,m.index-90),stop=text.indexOf('。',m.index);
        const clause=text.slice(begin,stop<0?m.index+90:Math.min(stop,m.index+90));
        if(/(?:気体|気相|蒸気)(?:から|が|→|⇒|を)[^。]{0,18}(?:固体|固相)/.test(clause)) add(entry,row,text,offsets,m.index,m[0].length);
      }
      if(entry.kind==='alkaline-earth') for(const m of text.matchAll(/アルカリ土類金属/g)) {
        const context=text.slice(Math.max(0,m.index-160),m.index+160);
        const elements=/(?:Be|ベリリウム)/.test(context) && /(?:Mg|マグネシウム)/.test(context);
        const optional=/(?:除く|含めない)(?:こと|場合|定義)[^。]{0,12}(?:ある|も)/.test(context);
        if(elements && /除|含めない/.test(context) && !optional) add(entry,row,text,offsets,m.index,m[0].length);
      }
      if(entry.kind==='transition-elements') for(const m of text.matchAll(/遷移元素/g)) {
        const context=text.slice(Math.max(0,m.index-160),m.index+160);
        const oldRange=/(?:第?3(?:族)?(?:～|〜|~|–|−|-|から)(?:第)?11族)/.test(context);
        const optional=/12族[^。]{0,60}含める[^。]{0,30}含めない[^。]{0,30}(?:場合|こと)/.test(context);
        if(oldRange && !optional) add(entry,row,text,offsets,m.index,m[0].length);
      }
    }
  }
  return hits;
}
