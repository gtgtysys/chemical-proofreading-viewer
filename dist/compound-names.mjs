// Productive spelling patterns; entries describe nomenclature, not inventories of substances.
export function compoundVocabulary(data) {
  if(!data) return [];
  const elements=[...data.elements.map(e=>e.name),...Object.keys(data.aliases),...data.otherCations];
  const prefixes=[...data.prefixes,...Object.keys(data.prefixAliases)];
  return [...new Set([...elements,...prefixes.flatMap(prefix=>elements.map(name=>prefix+name))])];
}

export function compoundOptions(word,data,oneEdit) {
  if(!data) return null;
  const elements=[...data.elements.map(e=>e.name),...Object.keys(data.aliases),...data.otherCations];
  const prefixes=[...data.prefixes,...Object.keys(data.prefixAliases)].sort((a,b)=>b.length-a.length);
  const count='[一二三四五六七八九十]';
  const matches=[];
  for(const prefix of prefixes) {
    const parts=word.match(new RegExp('^('+count+'{0,2})('+prefix+')('+count+'{0,2})(.+)$'));
    if(!parts) continue;
    const [,before,,after,tail]=parts;
    if(elements.includes(tail)) return [];
    if(tail.length<3) continue;
    for(const name of elements) if(oneEdit(tail,name)) matches.push(before+prefix+after+name);
  }
  if(matches.length) return [...new Set(matches)].map(term=>({term,key:term,category:'化合物名の構成要素'}));
  for(const name of elements.sort((a,b)=>b.length-a.length)) {
    if(!word.endsWith(name)) continue;
    const head=word.slice(0,-name.length);
    for(const prefix of prefixes) if(head.length>=2 && oneEdit(head,prefix)) matches.push(prefix+name);
  }
  return matches.length?[...new Set(matches)].map(term=>({term,key:term,category:'化合物名の構成要素'})):null;
}
