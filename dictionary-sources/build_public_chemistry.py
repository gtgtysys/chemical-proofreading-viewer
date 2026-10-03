"""Build from JMdict and MEXT only; never read the former chemistry dictionary.

Requires pypdfium2, JMdict_e.gz, middle.pdf and high.pdf alongside this file.
Source files stay local; provenance and reproducible selection rules are published.
"""
import gzip
import csv
import hashlib
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path
import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / 'dist/dictionaries'
norm = lambda s: re.sub(r'\s+', '', unicodedata.normalize('NFKC', s))
seeds = set(' '.join(l for l in (ROOT/'school-scope.txt').read_text(encoding='utf-8').splitlines() if not l.startswith('#')).split())
sources = [
    {'id':'jmdict','file':'JMdict_e.gz','url':'https://www.edrdg.org/pub/Nihongo/JMdict_e.gz','license':'CC-BY-SA-4.0'},
    {'id':'mext-middle','file':'middle.pdf','url':'https://www.mext.go.jp/content/20230522-mxt_kyoikujinzai02-000033060_04.pdf','license':'CC-BY-4.0','level':'中学校','ranges':[[40,45],[51,56],[63,68]]},
    {'id':'mext-high','file':'high.pdf','url':'https://www.mext.go.jp/kaigisiryo/content/000235672.pdf','license':'CC-BY-4.0','level':'高校','ranges':[[94,124]]},
]
pages = {}
for source in sources:
    source['sha256'] = hashlib.sha256((ROOT/source['file']).read_bytes()).hexdigest()
    if 'ranges' not in source: continue
    with pdfium.PdfDocument(ROOT/source['file']) as doc:
        pages[source['id']] = []
        for a,b in source['ranges']:
            for n in range(a,b+1):
                page = doc[n-1]
                tp = page.get_textpage()
                pages[source['id']].append((n,norm(tp.get_text_range())))
                tp.close()
                page.close()
assert any('中和滴定' in t for _,t in pages['mext-high']), 'MEXT extraction failed'
assert any('化学基礎' in t for _,t in pages['mext-high']), 'Wrong section'

def evidence(term):
    return [{'sourceId':sid,'pdfPages':[n for n,t in texts if norm(term) in t],
             'match':'NFKC・空白除去後の出現。用語の定義や初出学年の保証ではない。'}
            for sid,texts in pages.items() if any(norm(term) in t for _,t in texts)]

entries = {}
with gzip.open(ROOT/'JMdict_e.gz','rb') as stream:
    for _,node in ET.iterparse(stream,events=('end',)):
        if node.tag != 'entry': continue
        fields = {f.text for f in node.findall('sense/field')}
        chem = 'chemistry' in fields
        forms = [k.findtext('keb') for k in node.findall('k_ele') if not k.findall('ke_inf')]
        readings = [r for r in node.findall('r_ele') if not r.findall('re_inf')]
        # Do not turn the reading of a kanji headword into another written variant.
        written = forms or [r.findtext('reb') for r in readings if not r.findall('re_restr')]
        for term in written:
            if not term: continue
            refs = evidence(term) if (chem or term in seeds) else []
            if not chem and term not in seeds: continue
            core = bool(refs) or term in seeds
            row = entries.setdefault(term,{'term':term,'reading':'','readings':[], 'aliases':[], 'levels':[],
                'category':'化学','evidence':[],'candidateEligible':False,'status':'source-attested'})
            row['candidateEligible'] |= core
            for r in readings:
                restrictions = [x.text for x in r.findall('re_restr')]
                if restrictions and term not in restrictions: continue
                reading = r.findtext('reb')
                if reading not in row['readings']: row['readings'].append(reading)
            row['reading'] = row['readings'][0] if row['readings'] else ''
            row['evidence'].append({'sourceId':'jmdict','entryId':node.findtext('ent_seq'),'fields':sorted(fields)})
            for ref in refs:
                if ref not in row['evidence']: row['evidence'].append(ref)
        node.clear()

supplement = ROOT/'wikidata-school-terms.json'
if supplement.exists():
    sources.append({'id':'wikidata','url':'https://www.wikidata.org/','license':'CC0-1.0',
                    'sha256':hashlib.sha256(supplement.read_bytes()).hexdigest()})
    for e in json.loads(supplement.read_text(encoding='utf-8'))['entries']:
        term=e['term']
        assert term==e['label'] or term in e['aliases']
        if term not in seeds or term in entries: continue
        entries[term]={'term':term,'reading':'','readings':[],'aliases':[],'levels':[],
          'category':'化学','evidence':[{'sourceId':'wikidata','entityId':e['entityId'],
          'revision':e['revision'],'url':e['url'],'match':'日本語ラベルまたは別名との完全一致'}],
          'candidateEligible':True,'status':'source-attested'}
missing = []
for term in sorted(seeds - entries.keys()):
    refs = evidence(term)
    if not refs:
        missing.append(term)
        continue
    entries[term] = {'term':term,'reading':'','readings':[],'aliases':[],'levels':[],'category':'化学',
                     'evidence':refs,'candidateEligible':True,'status':'source-attested'}
for row in entries.values():
    row['levels'] = [s['level'] for s in sources if 'level' in s and any(e['sourceId']==s['id'] for e in row['evidence'])]
    row['scope'] = 'school-candidate' if row['candidateEligible'] else 'related-recognition-only'
    row['scopeBasis'] = 'curriculum-occurrence-or-editor-selection' if row['candidateEligible'] else 'jmdict-chemistry-field'
data = {'schemaVersion':2,'name':'公開用 化学正表記辞書（JMdict・文部科学省・Wikidata）','version':'2026-10-02.1',
    'license':'CC-BY-SA-4.0','licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/',
    'attribution':'JMdict © James William BREEN and the Electronic Dictionary Research and Development Group. 文部科学省の学習指導要領解説を加工。Wikidata contributors (CC0). 各提供元の監修ではありません。',
    'changes':'日本語表記・読み・出典IDを抽出し化学分野を選別。学習指導要領・Wikidataで出現確認した語を補完。説明文は収録しない。',
    'scope':'中高向け候補語と、誤字提案に使わない関連化学語を区別。全教科書の網羅・初出学年は保証しない。',
    'sources':sources,'entries':sorted(entries.values(),key=lambda e:e['term'])}
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'school-chemistry.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
with (OUT/'school-chemistry.csv').open('w',encoding='utf-8-sig',newline='') as stream:
    writer=csv.writer(stream)
    writer.writerow(['term','reading','scope','candidateEligible','sources'])
    for e in data['entries']: writer.writerow([e['term'],e['reading'],e['scope'],e['candidateEligible'],','.join(sorted({r['sourceId'] for r in e['evidence']}))])
report = {'entries':len(entries),'candidateEligible':sum(e['candidateEligible'] for e in entries.values()),
          'recognitionOnly':sum(not e['candidateEligible'] for e in entries.values()),'unverifiedSeeds':missing,
          'mextOnly': [t for t,e in entries.items() if all(r['sourceId'].startswith('mext-') for r in e['evidence'])]}
(ROOT/'public-chemistry-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
