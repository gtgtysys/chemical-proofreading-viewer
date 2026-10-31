// Conservative school-chemistry checks. Each result maps back to source text.
import {mathVariables,unitSpans,scriptLabelSpans,mathText} from './math-roles.mjs?v=41';
export function schoolChecks(rows, items) {
  const hits=[], byId=new Map(items.map(item=>[item.id,item]));
  const quantities={圧力:'pP',体積:'V',温度:'T',絶対温度:'T',物質量:'n',質量:'m',密度:'ρ',濃度:'c',時間:'t',エンタルピー:'H',エントロピー:'S',気体定数:'R'};
  for (const row of rows) {
    const add=(start,length,type,label,reason,suggestion)=>hits.push({row,start,length,type,label,reason,suggestion,text:row.text.slice(start,start+length)});
    for(const m of row.text.matchAll(/≈/g)) add(m.index,1,'preference','近似記号','教材の表記指定に合わせ、近似記号を「≒」へ統一します。','≒');
    for(const m of row.text.matchAll(/熱化学方程式|化学[ⅠⅡ]|化学[\s]*[IＩ]{1,2}(?![A-Za-z])/g)) add(m.index,m[0].length,'curriculum','旧課程の確認','旧課程の名称・表記が含まれています。現行課程向け教材か確認してください。熱の出入りはエンタルピー変化で表します。');
    // Legacy heat equations put an energy term on the equation side (not ΔH=...).
    if(!/[Δ∆]\s*H|エンタルピー/.test(row.text) && /[=＝]/.test(row.text) && /(?:[A-Z][a-z]?[₀-₉0-9]*\s*[（(][sgl][）)]|H₂|O₂|CO₂)/.test(row.text)) {
      const m=row.text.match(/[+＋−-]\s*\d+(?:\.\d+)?\s*kJ\b/);
      if(m && !row.text.includes('熱化学方程式')) add(0,row.text.length,'curriculum','熱化学方程式の表記','反応式の右辺に熱量を足す旧課程の表記の可能性があります。現行課程では反応式にΔHを付記します。式の意味は手動で確認してください。');
    }
    const marked=[];
    for(const [name,symbols] of Object.entries(quantities)) {
      const pattern=new RegExp(name+'[\\s（(]*(['+symbols+'])'+'(?=[\\s）)、，,。．.=＝]|$)','g');
      for(const m of row.text.matchAll(pattern)) marked.push({start:m.index+m[0].lastIndexOf(m[1]),length:1,kind:'quantity'});
    }
    for(const equation of row.text.matchAll(/\bp\s*V\s*[=＝]\s*n\s*R\s*T\b/g)) for(const m of equation[0].matchAll(/[pVnRT]/g)) marked.push({start:equation.index+m.index,length:1,kind:'quantity'});
    const expression=mathText(row,items);
    marked.push(...unitSpans(expression));
    const protectedRanges=marked.filter(mark=>mark.kind==='unit' || mark.kind==='quantity');
    const formulaRanges=new Map();
    row.charMap.forEach((p,n)=>{
      if(!p || byId.get(p.itemId)?.role!=='化学式') return;
      const range=formulaRanges.get(p.itemId);
      if(range) range.length=n-range.start+1;else formulaRanges.set(p.itemId,{start:n,length:1});
    });
    protectedRanges.push(...formulaRanges.values());
    protectedRanges.push(...scriptLabelSpans(row,items));
    marked.push(...mathVariables(expression,protectedRanges));
    const uniqueMarks=[...new Map(marked.map(mark=>[mark.kind+':'+mark.start+':'+mark.length,mark])).values()];
    for(const mark of uniqueMarks) {
      if(mark.kind!=='unit' && /^[\p{Script=Greek}∆]+$/u.test(row.text.slice(mark.start,mark.start+mark.length))) continue;
      const sources=[...new Set(row.charMap.slice(mark.start,mark.start+mark.length).filter(Boolean).map(p=>p.itemId))].map(id=>byId.get(id));
      if(!sources.length || sources.some(item=>!item || /^(serif|sans-serif|monospace|不明)(?:\s|$)/i.test(item.font))) continue;
      if(mark.kind==='quantity' && sources.some(item=>!item.italic)) add(mark.start,mark.length,'format','物理量の書体','物理量記号が立体です。物理量を表す文字はイタリック体（斜体）にします。','イタリック体');
      if(mark.kind==='variable' && sources.some(item=>!item.italic)) add(mark.start,mark.length,'format','文字式の書体',`文字式の変数「${row.text.slice(mark.start,mark.start+mark.length)}」が立体です。変数はイタリック体にします。`,'イタリック体');
      if(mark.kind==='unit' && sources.some(item=>item.italic)) add(mark.start,mark.length,'format','単位の書体','単位記号が斜体です。単位はローマン体（立体）にします。','ローマン体');
    }
  }
  return hits;
}
