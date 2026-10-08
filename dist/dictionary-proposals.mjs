export function feedbackFormURL(config, kind = '', details = '') {
  const url=new URL(config?.url || '');
  if(url.protocol!=='https:' || url.hostname!=='docs.google.com' || !/^\/forms\/d\/(?:e\/)?[A-Za-z0-9_-]+\/viewform$/.test(url.pathname) || url.username || url.password) throw Error('報告フォームの設定が不正です');
  if(!/^entry\.\d+$/.test(config.kindEntry) || !/^entry\.\d+$/.test(config.detailsEntry) || config.kindEntry===config.detailsEntry) throw Error('報告フォームの入力欄設定が不正です');
  if(kind && !['判定してほしいもの','誤判定','その他'].includes(kind)) throw Error('報告の分類が不正です');
  if(details.length>1200) throw Error('詳細は1200文字以内にしてください');
  url.search='';url.hash='';
  url.searchParams.set('usp','pp_url');
  if(kind) url.searchParams.set(config.kindEntry,kind);
  if(details) url.searchParams.set(config.detailsEntry,details);
  return url.href;
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
      const word=term.value.normalize('NFKC').trim();
      if(!word || word.length>80 || /[\r\n\u0000-\u001f]/u.test(word)) throw Error('追加したい語だけを80文字以内で入力してください');
      if(note.value.length>1000) throw Error('説明は1000文字以内にしてください');
      link.href=feedbackFormURL(formConfig,'誤判定',`辞書への追加提案\n対象の語：${word}${note.value.trim() ? '\n'+note.value.trim() : ''}`);link.removeAttribute('aria-disabled');error.textContent='';
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
