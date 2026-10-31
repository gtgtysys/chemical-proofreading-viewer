import {mathVariables,unitSpans} from './math-roles.mjs?v=41';

const indexes=new WeakMap();
// Combine glyph typography, script geometry and local mathematical context.
export function chemicalSpan(row,start,length,items) {
  if(!Number.isInteger(start) || start<0 || length<=0) return false;
  const text=row.text, end=start+length;
  if(/[A-Za-zΑ-Ωα-ω]/u.test(text[start-1] || '') || /[A-Za-zΑ-Ωα-ω]/u.test(text[end] || '')) return false;
  let byId=indexes.get(items);
  if(!byId) {byId=new Map(items.map(item=>[item.id,item]));indexes.set(items,byId);}
  const positions=(row.charMap || row.positionAt || []).slice(start,end);
  const sources=[...new Set(positions.filter(Boolean).map(p=>p.itemId))].map(id=>byId.get(id)).filter(Boolean);
  if(!sources.length && row.id && byId.has(row.id)) sources.push(byId.get(row.id));
  if(sources.some(item=>item.italic || item.role==='変数')) return false;
  const baseline=i=>i.textOrigin?.y ?? i.rect.top+i.rect.height/1.18;
  const adjacent=[...new Set((row.charMap || row.positionAt || []).slice(Math.max(0,start-5),end).filter(Boolean).map(p=>p.itemId))].map(id=>byId.get(id)).filter(Boolean);
  for(let n=0;n<positions.length;n++) {
    if(!/[A-Za-zΑ-Ωα-ω]/u.test(text[start+n])) continue;
    const item=byId.get(positions[n]?.itemId);
    if(item && adjacent.some(base=>base!==item && item.size<base.size*.88 && baseline(item)>baseline(base)+(base.emHeight ?? base.rect.height/1.18)*.08)) return false;
  }
  if(/^[A-Z][a-z]?[01]$/.test(text.slice(start,end).normalize('NFKC')) && sources.some(item=>/^[0-9₀-₉]+$/.test(item.text) && sources.some(base=>base!==item && item.size<base.size*.88 && baseline(item)>baseline(base)+(base.emHeight ?? base.rect.height/1.18)*.08))) return false;
  const left=Math.max(text.lastIndexOf('\n',start-1)+1,start-50),next=text.indexOf('\n',end);
  const right=Math.min(next<0?text.length:next,end+50),local=text.slice(left,right);
  const explicit=/(?:化学式|分子式|組成式|元素記号)[：:\s]*$/.test(text.slice(Math.max(left,start-15),start));
  if(!explicit && mathVariables(local,unitSpans(local)).some(mark=>mark.start<end-left && mark.start+mark.length>start-left)) return false;
  return true;
}
