export function dictionaryProposalURL(repository, term, note = '') {
  if(!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(repository)) throw Error('公開先の設定が不正です');
  term = term.normalize('NFKC').trim();
  if(!term || term.length>80 || /[\r\n\u0000-\u001f]/u.test(term)) throw Error('追加したい語だけを80文字以内で入力してください');
  if(note.length>1000) throw Error('説明は1000文字以内にしてください');
  const url = new URL(`https://github.com/${repository}/issues/new`);
  url.search = new URLSearchParams({template:'dictionary.yml', title:`[辞書追加] ${term}`, term, note}).toString();
  return url.href;
}

export async function setupDictionaryProposals() {
  let repository = 'gtgtysys/chemical-proofreading-viewer';
  try {
    const config = await (await fetch('./site-config.json')).json();
    if(/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(config.repository)) repository=config.repository;
  } catch { /* The published default remains available. */ }
  const form=document.querySelector('#dictionaryProposalForm');
  const term=document.querySelector('#dictionaryProposalTerm');
  const note=document.querySelector('#dictionaryProposalNote');
  const link=document.querySelector('#dictionaryProposalLink');
  const error=document.querySelector('#dictionaryProposalError');
  function update() {
    try {link.href=dictionaryProposalURL(repository,term.value,note.value);link.removeAttribute('aria-disabled');error.textContent='';}
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
