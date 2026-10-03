import json
from pathlib import Path
p=Path(__file__).resolve().parent.parent/'dist'/'dictionaries'
data=json.loads((p/'general-japanese.json').read_text(encoding='utf-8'))
words=set()
for e in data['entries']:
 # A label can belong to only one sense (e.g. an old secondary meaning).
 # Do not discard every standard written form of the whole entry for that label.
 # Irregular/mistaken written forms are already removed by build_general.py.
 for f in e['forms']: words.add(f['text'])
 # Readings of kanji words are not automatically accepted as written forms.
 if not e['forms']:
  for r in e['readings']:
   if not r['restrictTo']: words.add(r['text'])
result={k:data[k] for k in ['attribution','license','licenseUrl','sourceSha256']}
result['words']=sorted(words)
(p/'general-runtime.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(len(words))
