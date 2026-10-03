"""Build a source-traceable Japanese surface lexicon; does not copy glosses."""
import gzip, json, hashlib, datetime
import xml.etree.ElementTree as ET
from pathlib import Path
root = Path(__file__).resolve().parent
source = root / 'JMdict_e.gz'
out = root.parent / 'dist' / 'dictionaries'
entries=[]
excluded=0
with gzip.open(source,'rb') as stream:
 for _,entry in ET.iterparse(stream, events=('end',)):
  if entry.tag != 'entry': continue
  forms=[]
  for node in entry.findall('k_ele'):
   info=[e.text for e in node.findall('ke_inf')]
   # Irregular/mistaken/outdated spellings are not normal-word protection entries.
   if info:
    excluded+=1
    continue
   forms.append({'text':node.findtext('keb'),'common':bool(node.findall('ke_pri'))})
  readings=[]
  for node in entry.findall('r_ele'):
   if node.findall('re_inf'): continue
   readings.append({'text':node.findtext('reb'),'restrictTo':[e.text for e in node.findall('re_restr')],'noKanji':node.find('re_nokanji') is not None,'common':bool(node.findall('re_pri'))})
  labels=sorted({e.text for e in entry.findall('sense/misc') if e.text})
  if forms or readings:
   entries.append({'sourceId':entry.findtext('ent_seq'),'forms':forms,'readings':readings,'partsOfSpeech':sorted({e.text for e in entry.findall('sense/pos') if e.text}),'usageLabels':labels})
  entry.clear()
data={'schemaVersion':1,'name':'一般日本語語彙（JMdict由来）','builtAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceUrl':'https://www.edrdg.org/pub/Nihongo/JMdict_e.gz','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'attribution':'JMdict © James William BREEN and the Electronic Dictionary Research and Development Group. This derived surface/readings/POS dataset uses JMdict in accordance with the EDRDG licence.','license':'CC-BY-SA-4.0','licenseUrl':'https://www.edrdg.org/edrdg/licence.html','changes':'English glosses omitted; annotated kanji/kana spellings excluded; usage labels and reading restrictions retained.','entries':entries}
(out/'general-japanese.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
surfaces={f['text'] for e in entries for f in e['forms']}
readings={r['text'] for e in entries for r in e['readings']}
assert len({e['sourceId'] for e in entries})==len(entries)
checks={word:word in surfaces or word in readings for word in ['安全','眼鏡','参加','観察','確認','操作','結果','比較']}
assert all(checks.values()), checks
report={'entryCount':len(entries),'uniqueWrittenForms':len(surfaces),'uniqueReadings':len(readings),'excludedAnnotatedWrittenForms':excluded,'checks':checks}
(root/'general-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
