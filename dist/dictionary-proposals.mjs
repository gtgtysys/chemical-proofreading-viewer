export function feedbackFormURL(config, report = {}) {
  const url=new URL(config?.url || '');
  if(url.protocol!=='https:' || url.hostname!=='docs.google.com' || !/^\/forms\/d\/(?:e\/)?[A-Za-z0-9_-]+\/viewform$/.test(url.pathname) || url.username || url.password) throw Error('報告フォームの設定が不正です');
  const fields={kind:config.kindEntry,target:config.targetEntry,actual:config.actualEntry,expected:config.expectedEntry,details:config.detailsEntry};
  if(Object.values(fields).some(field=>!/^entry\.\d+$/.test(field)) || new Set(Object.values(fields)).size!==5) throw Error('報告フォームの入力欄設定が不正です');
  if(report.kind && !['判定してほしいもの','誤判定','その他'].includes(report.kind)) throw Error('報告の分類が不正です');
  for(const key of Object.keys(fields)) if(report[key]!==undefined && (typeof report[key]!=='string' || report[key].length>1200)) throw Error('各入力欄は1200文字以内で入力してください');
  url.search='';url.hash='';
  url.searchParams.set('usp','pp_url');
  for(const [key,field] of Object.entries(fields)) if(report[key]) url.searchParams.set(field,report[key]);
  return url.href;
}

export function dictionaryProposalReport(term, note = '') {
  const word=term.normalize('NFKC').trim();
  if(!word || word.length>80 || /[\r\n\u0000-\u001f]/u.test(word)) throw Error('追加したい語だけを80文字以内で入力してください');
  if(note.length>1000) throw Error('説明は1000文字以内にしてください');
  return {kind:'誤判定',target:word,actual:`「${word}」が誤字・用語候補として指摘された。`,expected:'正しい表記なので用語辞書に追加し、誤字として指摘しない。',details:note.trim()};
}

export async function setupDictionaryProposals() {
  let formConfig;
  try {
    const config = await (await fetch('./site-config.json',{cache:'no-store'})).json();
    feedbackFormURL(config.feedbackForm);
    formConfig=config.feedbackForm;
  } catch { /* A missing destination is shown; never pretend a report was sent. */ }
  const feedback=document.querySelector('#feedbackLink');
  if(formConfig) feedback.href=feedbackFormURL(formConfig);
  else {feedback.removeAttribute('href');feedback.title='報告フォームは準備中です';}
  const form=document.querySelector('#dictionaryProposalForm');
  const term=document.querySelector('#dictionaryProposalTerm');
  const note=document.querySelector('#dictionaryProposalNote');
  const link=document.querySelector('#dictionaryProposalLink');
  const error=document.querySelector('#dictionaryProposalError');
  function update() {
    try {
      if(!formConfig) throw Error('報告フォームは準備中です');
      link.href=feedbackFormURL(formConfig,dictionaryProposalReport(term.value,note.value));link.removeAttribute('aria-disabled');error.textContent='';
    }
    catch(e) {link.removeAttribute('href');link.setAttribute('aria-disabled','true');error.textContent=e.message;}
  }
  document.querySelector('#dictionaryProposalButton').addEventListener('click',()=>{
    const selected=document.querySelector('#detailText').textContent.trim();
    term.value=selected.length<=80 ? selected : '';
    note.value='';form.hidden=false;update();term.focus();term.select();
  });
  form.addEventListener('input',update);
  form.addEventListener('submit',event=>event.preventDefault());
  document.querySelector('#closeDictionaryProposal').addEventListener('click',()=>{form.hidden=true;});
  // A new selection must not retain a proposal about the previous selection.
  new MutationObserver(()=>{form.hidden=true;link.removeAttribute('href');}).observe(document.querySelector('#detailText'),{childList:true,characterData:true,subtree:true});
}
