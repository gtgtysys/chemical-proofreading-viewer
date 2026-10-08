export const normalize = text => text.normalize('NFKC');
export function oneEdit(a,b) {
  if(a===b || Math.abs(a.length-b.length)>1) return false;
  let i=0,j=0,edits=0;
  while(i<a.length && j<b.length) {
    if(a[i]===b[j]) {i++;j++;continue;}
    if(++edits>1) return false;
    if(a.length>=b.length) i++;
    if(b.length>=a.length) j++;
  }
  return edits+(i<a.length || j<b.length ? 1:0)===1;
}
export class Lexicon {
  constructor(chemistry, general, additions = {entries: []}) {
    if(!Array.isArray(chemistry.entries) || !Array.isArray(general.words)) throw Error('語彙辞書の形式が不正です');
    this.terms=chemistry.entries.map(e=>({...e,key:normalize(e.term)}));
    if(!Array.isArray(additions.entries) || additions.entries.some(e=>typeof e.term!=='string' || !e.term.trim())) throw Error('追加語彙辞書の形式が不正です');
    // Additional correct spellings are vocabulary, never whole-document exclusions.
    const supplementary=additions.entries.map(e=>normalize(e.term));
    this.known=new Set([...general.words.map(normalize),...this.terms.map(e=>e.key),...supplementary]);
    this.mixedStems=new Set([...this.known].map(word=>word.match(/^[\p{Script=Han}]+[\p{Script=Hiragana}]/u)?.[0]).filter(Boolean));
    this.chemicalWords=new Set(this.terms.map(e=>e.key));
    this.byLength=new Map();
    for(const e of this.terms) {
      if(e.candidateEligible===false) continue;
      if(e.key.length<2 || !/^[\p{Script=Han}\p{Script=Katakana}ー]+$/u.test(e.key)) continue;
      if(!this.byLength.has(e.key.length)) this.byLength.set(e.key.length,[]);
      this.byLength.get(e.key.length).push(e);
    }
  }
  knownCompound(word) {
    const stem=word.replace(/(?:度|率|比|量|内|側|群|基|鎖|時|層|板|型)$/u,'');
    if(stem!==word && this.known.has(stem)) return true;
    // A known general word plus a chemistry word may still be a misspelling
    // of one full term (e.g. 眼鏡 + 反応). Do not let segmentation hide it.
    if(word.length>=4 && [word.length-1,word.length,word.length+1].some(n=>(this.byLength.get(n)||[]).some(entry=>oneEdit(word,entry.key)))) return false;
    // Recognize phrases made of attested words, with at least one chemistry term.
    // Each component has two or more characters; arbitrary trailing letters are not accepted.
    const reachable=Array.from({length:word.length+1},()=>new Set());reachable[0].add(0);
    for(let start=0;start<word.length;start++) for(const flags of reachable[start]) {
      for(let end=start+2;end<=Math.min(word.length,start+32);end++) {
        const part=word.slice(start,end);if(this.known.has(part)) reachable[end].add(flags|1|(this.chemicalWords.has(part)?2:0)|(start?4:0));
      }
      if(start && /^(?:内|側|比|度|群|基|鎖|率|時|量)$/.test(word.slice(start))) reachable[word.length].add(flags|4);
    }
    return [...reachable[word.length]].some(flags=>(flags&6)===6);
  }
  optionsFor(word,context='') {
    if(this.known.has(word) || this.knownCompound(word)) return [];
    // Multiplicative substituent prefixes are productive chemical nomenclature.
    // Require an attested remainder and a recognized substituent, not arbitrary ジ+words.
    const substituted=word.match(/^(モノ|ジ|トリ|テトラ|ペンタ|ヘキサ)((?:ニトロ|クロロ|ブロモ|ヨード|フルオロ|メチル|エチル|ヒドロキシ).+)$/u);
    if(substituted) {
      if(this.known.has(substituted[2])) return [];
      const options=this.optionsFor(substituted[2],context);
      if(options.length) return options.map(entry=>({...entry,term:substituted[1]+entry.term,key:substituted[1]+entry.key}));
    }
    // Productive oligomer terminology: e.g. 二量体 -> 二量化. Require the
    // corresponding dictionary-attested oligomer, rather than a PDF-specific exception.
    if(/^[二三四五六七八九十多]+量化$/u.test(word) && this.known.has(word.slice(0,-1)+'体')) return [];
    if(/^[一二三四五六七八九十百千万]+[行列回個本枚冊点組種章節項段桁]$/u.test(word)) return [];
    const withoutPrefix=word.replace(/^(?:第?[一二三四五六七八九十]+次|問|熱|逆|非|主|両|半|型|万|総|各|低|高|同)/u,'');
    const suffix=/(?:状態|性|論|法|中|塩|前|後|剤|間|名|種|系|殻|則|版|化|可|数|内|側|比|度|群|基|鎖|率)$/u;
    if([withoutPrefix,word.replace(suffix,''),withoutPrefix.replace(suffix,'')].some(core=>core && this.known.has(core))) return [];
    for(let i=2;i<=word.length-2;i++) if(this.chemicalWords.has(word.slice(0,i)) && this.chemicalWords.has(word.slice(i))) return [];
    for(const suffix of ['反応','結合','溶液','電極','物質','元素','電子','積']) if(word.endsWith(suffix) && this.chemicalWords.has(word.slice(0,-suffix.length))) return [];
    const short=word.length<4,options=[];
    for(let n=short?word.length:word.length-1;n<=word.length+(short?0:1);n++) {
      for(const entry of this.byLength.get(n)||[]) {
        if(/^[\p{Script=Katakana}ー]+$/u.test(word) && (word+'ー'===entry.key || entry.key+'ー'===word)) continue;
        if(/^[\p{Script=Katakana}ー]+$/u.test(word) && new RegExp('^'+word+'[\\p{Script=Han}]$','u').test(entry.key)) continue;
        if(oneEdit(word,entry.key)) options.push(entry);
      }
    }
    // Short words have many accidental neighbours. Require a chemical context and few alternatives.
    if(short && (options.length>3 || !/(?:化学|試薬|水溶液|溶液|濃度|反応|滴定|酸|塩|mol|pH)/.test(context))) return [];
    return options;
  }
  scan(text) {
    const normalized=normalize(text),hits=[],protectedRanges=[];
    const runs=[...normalized.matchAll(/[\p{Script=Han}\p{Script=Katakana}ー]{1,}/gu)];
    // Protect complete dictionary words split by PDF spacing without creating typo suggestions.
    // Use whole runs at both ends so a genuine extra character is not hidden.
    for(let i=0;i<runs.length;i++) {
      let joined=runs[i][0];
      for(let j=i+1;j<Math.min(runs.length,i+8);j++) {
        const prev=runs[j-1],gap=normalized.slice(prev.index+prev[0].length,runs[j].index);
        if(!/^[ \t]*(?:\n[ \t]*)?$/.test(gap) || !gap.length) break;
        joined+=runs[j][0];if(joined.length>40) break;
        const suspiciousRun=runs.slice(i,j+1).some(run=>run[0].length>=4 && this.optionsFor(run[0],'化学用語').length);
        if(this.known.has(joined) || !suspiciousRun && this.knownCompound(joined)) protectedRanges.push([runs[i].index,runs[j].index+runs[j][0].length]);
      }
    }
    for(const chain of normalized.matchAll(/[\p{Script=Han}\p{Script=Katakana}ー]+(?:[ \t]+[\p{Script=Han}\p{Script=Katakana}ー]+)+/gu)) {
      const positions=[];let compact='';
      for(let n=0;n<chain[0].length;n++) if(!/[ \t]/.test(chain[0][n])) {compact+=chain[0][n];positions.push(chain.index+n);}
      for(let start=0;start<compact.length;start++) for(let length=2;length<=Math.min(32,compact.length-start);length++) {
        const end=start+length-1;
        if(positions[end]-positions[start]+1===length) continue;
        if(this.known.has(compact.slice(start,start+length))) protectedRanges.push([positions[start],positions[end]+1]);
      }
    }
    // Join complete script runs only over a line boundary. Both known words and typo candidates
    // retain their original span so highlights cover both lines without shifting later offsets.
    for(let i=0;i<runs.length-1;i++) {
      const left=runs[i],right=runs[i+1],gap=normalized.slice(left.index+left[0].length,right.index);
      // Detached math fragments may precede the next body line in PDF reading order.
      // Only an exact attested word can bridge them; never infer a typo over this gap.
      if(gap.includes('\n') && gap.length<100 && /^[\sA-Za-z0-9⁰¹²³⁴⁵⁶⁷⁸⁹₀-₉⁺⁻−+·⋅(){}\[\].=×/^–-]+$/u.test(gap)) {
        for(let a=1;a<=Math.min(32,left[0].length);a++) for(let b=1;b<=Math.min(32-a,right[0].length);b++) if(this.known.has(left[0].slice(-a)+right[0].slice(0,b))) protectedRanges.push([left.index+left[0].length-a,right.index+b]);
      }
      const detachedNumber=/^[ \t]*\n[ \t]*\d{1,3}[ \t]*\n[ \t]*$/.test(gap);
      if(!/^[ \t]*\n[ \t]*$/.test(gap) && !detachedNumber) continue;
      const joined=left[0]+right[0],start=left.index,end=right.index+right[0].length;
      const suspiciousSide=[left[0],right[0]].some(word=>word.length>=4 && this.optionsFor(word,'化学用語').length);
      for(let a=1;a<=Math.min(32,left[0].length);a++) for(let b=1;b<=Math.min(32-a,right[0].length);b++) {
        const boundary=left[0].slice(-a)+right[0].slice(0,b);
        if(this.known.has(boundary) || !suspiciousSide && this.knownCompound(boundary)) protectedRanges.push([start+left[0].length-a,right.index+b]);
      }
      if(joined.length>32) continue;
      // Detached PDF subscripts or page numbers can interrupt a word. Only protect
      // exact known words across these gaps; never invent typo suggestions across them.
      if(detachedNumber) continue;
      const context=normalized.slice(Math.max(0,start-50),end+50);
      // Do not invent a word by attaching a stray symbol to a complete known word.
      const stray=(left[0].length<=1 && right[0].length>=4 && this.known.has(right[0])) || (right[0].length<=1 && left[0].length>=4 && this.known.has(left[0]));
      const compound=[...this.chemicalWords].some(word=>joined.startsWith(word) && this.chemicalWords.has(joined.slice(word.length)));
      const katakana=/^[\p{Script=Katakana}ー]+$/u.test(joined) && left[0].length>=2 && !this.known.has(left[0]) && !this.known.has(right[0]);
      const independent=this.known.has(left[0]) && this.known.has(right[0]);
      const known=this.known.has(joined)||compound,options=joined.length>=4 && !stray && !independent?this.optionsFor(joined,context):[];
      if(known || options.length || katakana) {
        protectedRanges.push([start,end]);
        if(!known && options.length) hits.push({start,length:end-start,text:normalized.slice(start,end),options});
      }
    }
    for(const match of runs) {
      const word=match[0];if(word.length<2) continue;
      // Ordinal punctuation and administrative abbreviations are not chemistry words.
      if(/第$/.test(word) && /^\d+族/.test(normalized.slice(match.index+word.length))) continue;
      if(word.length<4 && /[－−-]$/.test(normalized.slice(0,match.index)) && /^[・）)]/.test(normalized.slice(match.index+word.length))) continue;
      const following=normalized.slice(match.index+word.length).replace(/^[ \t]*\n[ \t]*/,'');
      if(this.mixedStems.has(word+following[0])) continue;
      // A Han run can be just the stem of a mixed-script word, such as 見出し.
      let writtenWord=false;
      for(let n=1;n<=8;n++) {
        const tail=normalized.slice(match.index+word.length,match.index+word.length+n);
        if(!/^[\p{Script=Hiragana}]+$/u.test(tail)) break;
        if(this.known.has(word+tail)) {writtenWord=true;break;}
      }
      if(writtenWord) continue;
      if(protectedRanges.some(([start,end])=>match.index>=start && match.index+word.length<=end)) continue;
      const context=normalized.length===word.length?'化学用語':normalized.slice(Math.max(0,match.index-50),match.index+word.length+50);
      const options=this.optionsFor(word,context);
      if(options.length) hits.push({start:match.index,length:word.length,text:word,options});
    }
    return hits.sort((a,b)=>a.start-b.start);
  }
}
