import * as pdfjsLib from "./vendor/pdf.mjs";
import {chemicalSpan} from './chemical-spans.mjs?v=41';
import { schoolChecks } from './school-checks.mjs?v=41';
import { curriculumChecks } from './curriculum.mjs?v=41';
import { mathVariables, unitSpans, scriptLabelSpans, mathText } from './math-roles.mjs?v=41';
import { formulaChecks } from './formulas.mjs?v=41';
import { Lexicon } from "./lexicon.mjs?v=41";
import { reviewLabels, reviewKey, snapshotRows, carryReviews, parsePreferences, structureChecks } from './workflow.mjs?v=41';
import { textRows, textFlows, detectionIndex, scriptGroup, formulaEvidence, expectedSubscript } from './detection.mjs?v=41';

pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.mjs";

const $ = (selector) => document.querySelector(selector);
const elements = {
  fileInput: $("#fileInput"),
  searchToggleButton: $("#searchToggleButton"),
  closeSearchButton: $("#closeSearchButton"),
  dropZone: $("#dropZone"),
  documentArea: $("#documentArea"),
  loadingState: $("#loadingState"),
  loadingText: $("#loadingText"),
  pages: $("#pages"),
  candidateList: $("#candidateList"),
  candidateCount: $("#candidateCount"),
  emptyCandidates: $("#emptyCandidates"),
  filters: $("#filters"),
  summary: $("#summary"),
  pageCount: $("#pageCount"),
  itemCount: $("#itemCount"),
  summaryCandidateCount: $("#summaryCandidateCount"),
  candidateActions: $("#candidateActions"),
  highlightAllButton: $("#highlightAllButton"),
  searchForm: $("#searchForm"),
  searchInput: $("#searchInput"),
  searchPreviousButton: $("#searchPreviousButton"),
  searchNextButton: $("#searchNextButton"),
  clearTextSearchButton: $("#clearTextSearchButton"),
  searchResultCount: $("#searchResultCount"),
  emptyDetail: $("#emptyDetail"),
  detail: $("#detail"),
  detailType: $("#detailType"),
  detailText: $("#detailText"),
  detailPage: $("#detailPage"),
  detailRole: $("#detailRole"),
  detailFont: $("#detailFont"),
  detailSize: $("#detailSize"),
  detailStyle: $("#detailStyle"),
  suggestionBox: $("#suggestionBox"),
  detailSuggestion: $("#detailSuggestion"),
  detailPanel: $(".detail-panel"),
  toast: $("#toast"),
};

const state = {
  file: null,
  pdf: null,
  documentType: null,
  pages: [],
  items: [],
  candidates: [],
  selectedId: null,
  filter: "all",
  highlightAll: false,
  searchItemIds: new Set(),
  searchOccurrences: [],
  searchCursor: -1,
  scale: 1.35,
  zoom: 1,
  toastTimer: null,
  dictionary: null,
  lexicon: null,
  generalLexicon: null,
  curriculumPolicy: {schemaVersion:1,entries:[]},
  additionalVocabulary: {entries: []},
  compoundComponents: null,
  rules: { term: [], symbol: [], formula: [] },
  units: [],
  styleSettings: { minimumFormulaSamples: 5, rareStyleRatio: 0.08, minimumRoleSamples: 3 },
  fingerprint: '',
  reviews: {},
  roles: {},
  exclusions: {},
  selectedItemIds: [],
  reviewFilter: 'all',
  profile: 'default',
  preferences: {default: [], middle: [], high: [], workplace: []},
  revisionBaseline: null,
  revision: null,
  revisionSignatures: null,
};

const FALLBACK_DICTIONARY = {
  schemaVersion: 1,
  name: "内蔵最小辞書",
  terms: [],
  patterns: [],
  units: ["mol/L", "mmol/L", "mg/mL", "kg", "g", "mg", "L", "mL", "℃", "°C", "min", "pH"],
  style: { minimumFormulaSamples: 5, rareStyleRatio: 0.08, minimumRoleSamples: 3 },
};

const SUBSCRIPT = "₀₁₂₃₄₅₆₇₈₉";
const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻";
const formulaTokenRegex = new RegExp(`[A-Z][A-Za-zΙ]*(?:[${SUBSCRIPT}0-9]+)?(?:[A-Z][a-z]?(?:[${SUBSCRIPT}0-9]+)?)*(?:[${SUPERSCRIPT}]+)?`, "g");
const elementSymbols = new Set("H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og".split(" "));

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileDictionary(dictionary) {
  if (dictionary.schemaVersion === 2 && Array.isArray(dictionary.entries)) {
    state.lexicon = new Lexicon(dictionary, state.generalLexicon, state.additionalVocabulary, state.compoundComponents);
    return;
  }
  if (!dictionary || dictionary.schemaVersion !== 1 || !Array.isArray(dictionary.terms) || !Array.isArray(dictionary.patterns)) {
    throw new Error("辞書の形式が正しくありません。schemaVersion 1、terms、patterns が必要です。");
  }
  const compiled = { term: [], symbol: [], formula: [] };
  for (const entry of dictionary.terms) {
    if (!entry?.incorrect || !entry?.preferred) continue;
    compiled.term.push({
      pattern: new RegExp(escapeRegExp(entry.incorrect), entry.ignoreCase ? "gi" : "g"),
      suggestion: entry.preferred,
      reason: entry.reason || `「${entry.preferred}」の誤記の可能性があります。`,
      severity: entry.severity || "medium",
    });
  }
  for (const entry of dictionary.patterns) {
    if (!entry?.pattern || !["term", "symbol", "formula"].includes(entry.type)) continue;
    compiled[entry.type].push({
      pattern: new RegExp(entry.pattern, entry.flags?.includes("g") ? entry.flags : `${entry.flags || ""}g`),
      suggestion: entry.suggestion || null,
      reason: entry.reason || "登録済みの判定規則に一致しました。",
      severity: entry.severity || "medium",
      label: entry.label,
    });
  }
  state.dictionary = dictionary;
  state.rules = compiled;
  state.units = Array.isArray(dictionary.units) ? dictionary.units.filter((unit) => typeof unit === "string" && unit.trim()) : [];
  state.styleSettings = { ...FALLBACK_DICTIONARY.style, ...(dictionary.style || {}) };
}

async function loadDefaultDictionary() {
  try {
    const response = await fetch("./dictionaries/default.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`辞書を読み込めません (${response.status})`);
    const base = await response.json();
    const individualResponse = await fetch('./dictionaries/individual-rules.json', {cache:'no-store'});
    if(!individualResponse.ok) throw Error('個別ルール取得失敗');
    const individual = await individualResponse.json();
    compileDictionary({...base, terms:individual.terms, patterns:individual.patterns});
    const [chemistry, general, additions, curriculumPolicy, components] = await Promise.all([
      fetch('./dictionaries/school-chemistry.json').then(r => { if(!r.ok) throw Error('化学辞書取得失敗'); return r.json(); }),
      fetch('./dictionaries/general-runtime.json').then(r => { if(!r.ok) throw Error('一般語辞書取得失敗'); return r.json(); }),
      fetch('./dictionaries/community-vocabulary.json', {cache:'no-store'}).then(r => { if(!r.ok) throw Error('追加語彙取得失敗'); return r.json(); }),
      fetch('./dictionaries/curriculum-review.json', {cache:'no-store'}).then(r => { if(!r.ok) throw Error('教科書改訂ルール取得失敗'); return r.json(); }),
      fetch('./dictionaries/compound-components.json', {cache:'no-store'}).then(r => { if(!r.ok) throw Error('化合物名辞書取得失敗'); return r.json(); }),
    ]);
    state.generalLexicon = general;
    state.additionalVocabulary = additions;
    state.curriculumPolicy = curriculumPolicy;
    state.compoundComponents=components;
    state.lexicon = new Lexicon(chemistry, general, additions, components);
  } catch (error) {
    console.warn(error);
    showToast('用語辞書の読み込みに失敗しました。ページを再読み込みしてください。');
    compileDictionary(FALLBACK_DICTIONARY);
    state.rules.term = [];
  }
}

const dictionaryReady = loadDefaultDictionary();

function isUnitText(text) {
  const compact = normalizeForSearch(text);
  return state.units.some((unit) => {
    const normalizedUnit = normalizeForSearch(unit);
    // A bare symbol is ambiguous (m: metre or mass, F: farad or force).
    // Contextual inference below handles units without an attached value.
    const valueWithUnit = new RegExp(`^[+−-]?(?:\\d+(?:[.,]\\d+)?(?:[×x]10[+−-]?\\d+)?)${escapeRegExp(normalizedUnit)}$`);
    return valueWithUnit.test(compact);
  });
}

function normalizeText(text) {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function classifyRole(text, size, bold) {
  const normalized = normalizeText(text);
  const compact = normalized.replace(/\s+/g, "");
  if (/^\[[A-Z]\d{2}\]$/.test(normalized)) return "test-id";
  if (/^(?:figure|fig\.?|table|図|表)\s*\d+/i.test(normalized)) return "キャプション";
  if (isUnitText(normalized)) return "単位";
  if (/^\d+(?:[.,]\d+)?$/.test(normalized)) return "番号";
  if (isLikelyFormulaToken(compact) && formulaEvidence(text)) return "化学式";
  return "本文";
}

function inferDocumentRoles() {
  // Uniformly bold text rows are headings/emphasis; a single bold formula within a normal row is not.
  const byId=new Map(state.items.map(item=>[item.id,item]));
  const bodySizes=new Map();
  for(const page of state.pages) {
    const sizes=page.items.filter(item=>item.role==='本文' && /[\p{Script=Han}\p{Script=Hiragana}]/u.test(item.text) && item.text.trim().length>=2).map(item=>item.size).sort((a,b)=>a-b);
    if(sizes.length>=3) bodySizes.set(page.pageNumber,sizes[Math.floor(sizes.length/2)]);
  }
  for(const row of textRows(state.items)) {
    const members=row.sourceIds.map(id=>byId.get(id)).filter(item=>item.role!=='test-id');
    for(const item of members) if(item.role==='化学式' && !state.roles[item.id]) {
      const start=row.charMap.findIndex(p=>p?.itemId===item.id);
      if(!chemicalSpan(row,start,item.text.length,state.items)) item.role='本文';
    }
    const expression=mathText(row,members);
    const units=unitSpans(expression),variables=mathVariables(expression,[...units,...scriptLabelSpans(row,state.items)]);
    const covered=new Map();
    for(const mark of [...units,...variables]) for(const p of row.charMap.slice(mark.start,mark.start+mark.length).filter(Boolean)) {
      const key=mark.kind+':'+p.itemId;
      if(!covered.has(key)) covered.set(key,{kind:mark.kind,item:byId.get(p.itemId),offsets:new Set()});
      covered.get(key).offsets.add(p.offset);
    }
    for(const {kind,item,offsets} of covered.values()) if(item && item.role==='本文' && offsets.size>=item.text.trim().length) item.role=kind==='unit'?'単位':'変数';
    // Size is a role cue only, never a mismatch warning. Japanese Gothic headings
    // can use a Medium face whose PDF font name does not carry a Bold flag.
    const page=state.pages.find(page=>page.pageNumber===row.pageNumber),bodySize=bodySizes.get(row.pageNumber);
    const titleShape=bodySize && page && row.rect.top<page.viewport.height*.22 && row.text.trim().length<=60 && !/[。．、，,：:=＝→]/.test(row.text) && members.every(item=>item.size>bodySize*1.3);
    if(/[\p{Script=Han}\p{Script=Hiragana}]/u.test(row.text) && members.length && (members.every(item=>item.bold) || titleShape)) {
      for(const item of members) item.role=item.role==='本文'?'見出し':`見出し内${item.role}`;
    }
  }
  for (const page of state.pages) {
    const ordered = [...page.items].sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
    for (let index = 0; index < ordered.length; index += 1) {
      const item = ordered[index];
      if (item.role !== "番号") continue;
      if (item.rect.top >= page.viewport.height * 0.9) {
        item.role = "ページ番号";
        continue;
      }
      const neighbors = [ordered[index - 1], ordered[index + 1]].filter(Boolean);
      const touchesFormula = neighbors.some((neighbor) => {
        const sameLine = Math.abs(neighbor.rect.top - item.rect.top) <= Math.max(4, item.rect.height * 0.45);
        const horizontalGap = Math.max(0, Math.max(neighbor.rect.left, item.rect.left) - Math.min(neighbor.rect.left + neighbor.rect.width, item.rect.left + item.rect.width));
        return sameLine && horizontalGap <= Math.max(24, item.size * 3) && neighbor.role === "化学式";
      });
      if (touchesFormula) item.role = "係数";
    }
  }
}

function fontLabel(fontObj, style, fontRef) {
  const base = fontObj?.name || fontObj?.fallbackName || style?.fontFamily || "不明";
  const reference = fontObj?.loadedName || fontRef;
  if (/^(serif|sans-serif|monospace|不明)$/i.test(base) && reference) return `${base} [${reference}]`;
  return base || reference || "不明";
}

function hasReliableFont(font) {
  return Boolean(font) && !/^(?:serif|sans-serif|monospace|不明)(?:\s*\[.*\])?$/i.test(font);
}

function displayFont(font) {
  return font.replace(/^[A-Z]{6}\+/, '');
}

function styleSuggestion(reference) {
  return [displayFont(reference.font),reference.bold?'太字':null,reference.italic?'斜体':null].filter(Boolean).join('・');
}

function getStyleFlags(font) {
  const value = font.toLowerCase();
  return {
    bold: /bold|black|heavy|demi/.test(value),
    italic: /italic|oblique|(?:^|[+\s])(?:cmmi|cmmib|lmmi|cmsl|lmsl)/.test(value),
  };
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function setLoading(visible, text = "PDFを読み込んでいます") {
  elements.loadingText.textContent = text;
  elements.loadingState.hidden = !visible;
  elements.dropZone.hidden = visible || Boolean(state.pdf);
  if (visible) elements.pages.replaceChildren();
}

function analyzeDocument() {
  state.items = state.items.filter((item) => !item.virtual);
  for (const item of state.items) item.role = classifyRole(item.text, item.size, item.bold);
  inferDocumentRoles();
  for (const item of state.items) if (state.roles[item.id]) item.role = state.roles[item.id];
  state.selectedId = null;
  state.selectedItemIds = [];
  state.candidates = detectCandidates(state.items).filter(candidate => !candidate.itemIds.some(id => state.exclusions[id] === 'all' || (state.exclusions[id] === 'text' && candidate.type !== 'format')));
  if (state.revisionBaseline) {
    const carried = carryReviews(state.revisionBaseline, snapshotRows(state.items), state.candidates);
    state.reviews = {...carried.reviews, ...state.reviews};
    state.revision = carried.comparison;
    state.revisionSignatures = new Set(state.revisionBaseline.candidates.map(c=>JSON.stringify([c.type,c.text,c.reason])));
    state.revisionBaseline = null;
    renderRevision(Object.keys(carried.reviews).length);
  }
  if (state.revision) {
    const changedIds = new Set(state.revision.changed.flatMap(row=>row.ids));
    for (const candidate of state.candidates) candidate.updated = candidate.itemIds.some(id=>changedIds.has(id)) || !state.revisionSignatures.has(JSON.stringify([candidate.type,candidate.text,candidate.reason]));
    state.candidates.sort((a,b)=>Number(Boolean(b.updated))-Number(Boolean(a.updated)));
  }
  renderCandidates();
  renderExclusions();
  renderCoverage();
  elements.summaryCandidateCount.textContent = state.candidates.length.toLocaleString("ja-JP");
  elements.emptyDetail.hidden = false;
  elements.detail.hidden = true;
  $('#selectionControls').hidden = true;
  $('#reviewControls').hidden = true;
}

async function openPdf(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    showToast("PDFファイルを選択してください。");
    return;
  }
  await dictionaryReady;
  state.file = file;
  state.documentType = "pdf";
  state.pdf = null;
  state.pages = [];
  state.items = [];
  state.candidates = [];
  state.selectedId = null;
  state.highlightAll = false;
  state.searchItemIds = new Set();
  state.searchOccurrences = [];
  state.searchCursor = -1;
  resetPanels();
  setLoading(true, `${file.name} を読み込んでいます`);

  try {
    const data = new Uint8Array(await file.arrayBuffer());
    state.fingerprint = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(n => n.toString(16).padStart(2,'0')).join('');
    state.reviews = {}; state.roles = {}; state.exclusions = {}; state.revision = null; state.revisionSignatures = null;
    $('#revisionPanel').hidden = true;
    state.pdf = await pdfjsLib.getDocument({
      data,
      useSystemFonts: true,
      cMapUrl: new URL('./vendor/cmaps/',import.meta.url).href,
      cMapPacked: true,
      standardFontDataUrl: new URL('./vendor/standard_fonts/',import.meta.url).href,
      wasmUrl: new URL('./vendor/wasm/',import.meta.url).href,
    }).promise;
    elements.pageCount.textContent = state.pdf.numPages;
    for (let pageNumber = 1; pageNumber <= state.pdf.numPages; pageNumber += 1) {
      elements.loadingText.textContent = `${pageNumber} / ${state.pdf.numPages} ページを解析しています`;
      await renderAndExtractPage(pageNumber);
    }
    $('#zoomToolbar').hidden=false;
    analyzeDocument();
    elements.summary.hidden = false;
    elements.filters.hidden = false;
    elements.candidateActions.hidden = false;
    const extractedItems = state.items.filter((item) => !item.virtual);
    elements.itemCount.textContent = extractedItems.length.toLocaleString("ja-JP");
    elements.searchToggleButton.disabled = false;
    elements.dropZone.hidden = true;
    showToast(state.items.length ? `${state.pdf.numPages}ページを解析しました。` : "文字データがないため、自動判定できません（画像PDF）。");
  } catch (error) {
    console.error(error);
    state.pdf = null;
    elements.dropZone.hidden = false;
    showToast("PDFを読み込めませんでした。");
  } finally {
    setLoading(false);
  }
}

function pageScrollTop(shell) {
  return elements.documentArea.scrollTop+shell.getBoundingClientRect().top-elements.documentArea.getBoundingClientRect().top-65;
}
let paintingPdf=false, pdfPaintRequested=false, pdfPaintTimer;
function schedulePdfResolution() {
  clearTimeout(pdfPaintTimer);
  pdfPaintTimer=setTimeout(refreshPdfResolution,80);
}
async function refreshPdfResolution() {
  pdfPaintRequested=true;
  if(paintingPdf) return;
  paintingPdf=true;
  try {
    while(pdfPaintRequested) {
      pdfPaintRequested=false;
      if(state.documentType!=='pdf' || !state.pdf) continue;
      const pdf=state.pdf,area=elements.documentArea.getBoundingClientRect();
      for(const record of state.pages) {
        if(state.pdf!==pdf) break;
        const rect=record.shell.getBoundingClientRect();
        const visible=rect.bottom>area.top-200 && rect.top<area.bottom+200;
        if(!visible) {
          if(record.canvas!==record.baseCanvas) {
            const old=record.canvas;
            old.replaceWith(record.baseCanvas);
            record.canvas=record.baseCanvas;
            record.density=record.baseDensity;
            old.width=old.height=0;
          }
          continue;
        }
        const density=window.devicePixelRatio*state.zoom;
        if(Math.abs(record.density-density)<.01) continue;
        const canvas=document.createElement('canvas');
        canvas.width=Math.ceil(record.viewport.width*density);
        canvas.height=Math.ceil(record.viewport.height*density);
        canvas.style.width=record.viewport.width+'px';
        canvas.style.height=record.viewport.height+'px';
        const task=record.pdfPage.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport:record.viewport,transform:[density,0,0,density,0,0]});
        record.paintTask=task;
        try {
          await task.promise;
          if(state.pdf===pdf && record.shell.isConnected && Math.abs(density-window.devicePixelRatio*state.zoom)<.01) {
            const old=record.canvas;
            old.replaceWith(canvas);
            record.canvas=canvas;
            record.density=density;
            if(old!==record.baseCanvas) old.width=old.height=0;
          } else canvas.width=canvas.height=0;
        } catch(error) {
          canvas.width=canvas.height=0;
          if(error.name!=='RenderingCancelledException') console.warn('PDFの拡大描画',error);
        } finally {record.paintTask=null;}
      }
    }
  } finally {paintingPdf=false;}
}
elements.documentArea.addEventListener('scroll',schedulePdfResolution,{passive:true});
window.addEventListener('resize',schedulePdfResolution);
function setZoom(value) {
  if(state.documentType!=='pdf' || !state.pdf) return;
  const prior=state.zoom;
  state.zoom=Math.max(.5,Math.min(3,Math.round(value*100)/100));
  const area=elements.documentArea;
  const center=(area.scrollTop+area.clientHeight/2)/prior;
  for(const page of state.pages) page.shell.style.zoom=state.zoom;
  area.scrollTop=center*state.zoom-area.clientHeight/2;
  $('#zoomValue').textContent=Math.round(state.zoom*100)+'%';
  $('#zoomOut').disabled=state.zoom<=.5;
  $('#zoomIn').disabled=state.zoom>=3;
  for(const page of state.pages) page.paintTask?.cancel();
  refreshPdfResolution();
}
$('#zoomOut').addEventListener('click',()=>setZoom(state.zoom-.25));
$('#zoomIn').addEventListener('click',()=>setZoom(state.zoom+.25));
$('#zoomFit').addEventListener('click',()=>setZoom(availableDocumentWidth()/Math.max(...state.pages.map(page=>page.viewport.width))));
function availableDocumentWidth() {
  const style = getComputedStyle(elements.documentArea);
  const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  return Math.max(280, elements.documentArea.clientWidth - horizontalPadding - 8);
}

async function renderAndExtractPage(pageNumber) {
  const page = await state.pdf.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(state.scale, availableDocumentWidth() / baseViewport.width);
  const viewport = page.getViewport({ scale });
  const shell = document.createElement("article");
  shell.className = "page-shell";
  shell.dataset.page = String(pageNumber);
  shell.style.zoom=state.zoom;
  shell.style.width = `${viewport.width}px`;
  shell.style.height = `${viewport.height}px`;

  const pageLabel = document.createElement("span");
  pageLabel.className = "page-number";
  pageLabel.textContent = `${pageNumber} / ${state.pdf.numPages}`;
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width * window.devicePixelRatio);
  canvas.height = Math.floor(viewport.height * window.devicePixelRatio);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  const context = canvas.getContext("2d", { alpha: false });
  const highlightLayer = document.createElement("div");
  highlightLayer.className = "highlight-layer";
  const textLayer = document.createElement("div");
  textLayer.className = "text-layer";
  shell.append(pageLabel, canvas, highlightLayer, textLayer);
  elements.pages.append(shell);

  await page.render({ canvasContext: context, viewport, transform:[window.devicePixelRatio,0,0,window.devicePixelRatio,0,0] }).promise;
  const textContent = await page.getTextContent({ includeMarkedContent: true });
  const pageItems = [];

  for (const raw of textContent.items) {
    if (!raw.str || !raw.str.trim() || !raw.transform) continue;
    const tx = pdfjsLib.Util.transform(viewport.transform, raw.transform);
    const scaledHeight = Math.max(5, Math.hypot(tx[2], tx[3]));
    const scaledWidth = Math.max(2, raw.width * scale);
    const fontRef = raw.fontName;
    let fontObj = null;
    try { fontObj = page.commonObjs.get(fontRef); } catch { /* font metadata is optional */ }
    const font = fontLabel(fontObj, textContent.styles?.[fontRef], fontRef);
    const flags = getStyleFlags(font);
    const size = Math.max(1, Math.hypot(raw.transform[2], raw.transform[3]));
    const item = {
      id: `p${pageNumber}-i${pageItems.length}`,
      pageNumber,
      text: raw.str,
      normalized: normalizeText(raw.str),
      font,
      size,
      emHeight: Math.hypot(tx[2],tx[3]),
      advance: raw.width * scale,
      textOrigin: {x:tx[4],y:tx[5]},
      textDirection: {x:tx[0]/Math.hypot(tx[0],tx[1]),y:tx[1]/Math.hypot(tx[0],tx[1])},
      bold: flags.bold,
      italic: flags.italic,
      role: classifyRole(raw.str, size, flags.bold),
      rect: {
        left: tx[4],
        top: tx[5] - scaledHeight,
        width: scaledWidth,
        height: scaledHeight * 1.18,
      },
      shell,
      highlightLayer,
      textLayer,
    };
    const textSpan = document.createElement("span");
    textSpan.textContent = raw.str;
    textSpan.dataset.itemId = item.id;
    textSpan.style.left = `${item.rect.left}px`;
    textSpan.style.top = `${item.rect.top}px`;
    textSpan.style.width = `${item.rect.width}px`;
    textSpan.style.height = `${item.rect.height}px`;
    textSpan.style.fontSize = `${scaledHeight}px`;
    textSpan.style.lineHeight = `${item.rect.height}px`;
    textSpan.style.fontFamily = textContent.styles?.[fontRef]?.fontFamily || "sans-serif";
    textLayer.append(textSpan);
    pageItems.push(item);
    state.items.push(item);
  }
  state.pages.push({ pageNumber, shell, viewport, items: pageItems, pdfPage:page, baseCanvas:canvas, canvas, baseDensity:window.devicePixelRatio, density:window.devicePixelRatio });
}

function addRuleCandidates(candidates, item, rules, type, label, severity = "medium") {
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(item.text)) !== null) {
      const segments = item.charMap
        ? segmentsFromCharacterMap(item.charMap, match.index, match[0].length)
        : [{ itemId: item.id, start: match.index, end: match.index + match[0].length, total: item.text.length }];
      if((type==='symbol' || type==='formula') && !chemicalSpan(item,match.index,match[0].length,state.items)) continue;
      if (rule.suggestion === 'H₂O' && expectedSubscript(match[0], segments, state.items)) continue;
      if (type === "formula" || type === "symbol") {
        for (const segment of segments) {
          const sourceItem = state.items.find((entry) => entry.id === segment.itemId);
          const coverage = (segment.end - segment.start) / Math.max(1, segment.total);
          if (sourceItem && !state.roles[sourceItem.id] && coverage >= 0.8 && normalizeForSearch(sourceItem.text).length <= 12) sourceItem.role = "化学式";
        }
      }
      const anchor = state.items.find((entry) => entry.id === segments[0]?.itemId) || item;
      candidates.push(makeCandidate({ item: anchor, segments, type, label: rule.label || label, severity: rule.severity || severity, text: match[0], suggestion: rule.suggestion, reason: rule.reason }));
      if (match[0].length === 0) rule.pattern.lastIndex += 1;
    }
  }
}

function normalizeForSearch(value) {
  return value.normalize("NFKC").replace(/\s+/g, "");
}

function getReadingOrderItems() {
  return textRows(state.items.filter(item=>!item.virtual)).flatMap(row=>row.sourceIds.map(id=>state.items.find(item=>item.id===id)));
}

function buildDocumentSearchIndex() {
  let text = "";
  const itemAt = [];
  const positionAt = [];
  for (const item of getReadingOrderItems()) {
    const compact = normalizeForSearch(item.text);
    for (let offset = 0; offset < compact.length; offset += 1) {
      const character = compact[offset];
      text += character;
      itemAt.push(item.id);
      positionAt.push({ itemId: item.id, offset, total: compact.length });
    }
  }
  return { text, itemAt, positionAt };
}

function itemIdsForRange(index, start, length) {
  const ids = [];
  for (let cursor = start; cursor < start + length; cursor += 1) {
    const id = index.itemAt[cursor];
    if (id && ids.at(-1) !== id) ids.push(id);
  }
  return ids;
}

function segmentsFromCharacterMap(characterMap, start, length) {
  const segments = [];
  for (let cursor = start; cursor < start + length; cursor += 1) {
    const position = characterMap[cursor];
    if (!position) continue;
    const previous = segments.at(-1);
    if (previous && previous.itemId === position.itemId && previous.end === position.offset) {
      previous.end += 1;
    } else {
      segments.push({ itemId: position.itemId, start: position.offset, end: position.offset + 1, total: position.total });
    }
  }
  return segments;
}

function segmentsForRange(index, start, length) {
  return segmentsFromCharacterMap(index.positionAt, start, length);
}

function addDocumentRuleCandidates(candidates, index, rules, type, label, severity = "medium") {
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(index.text)) !== null) {
      const segments = segmentsForRange(index, match.index, match[0].length);
      if((type==='symbol' || type==='formula') && !chemicalSpan(index,match.index,match[0].length,state.items)) continue;
      if (rule.suggestion === 'H₂O' && expectedSubscript(match[0], segments, state.items)) continue;
      const itemIds = [...new Set(segments.map((segment) => segment.itemId))];
      const item = state.items.find((entry) => entry.id === itemIds[0]);
      if (item && item.role !== "test-id") {
        candidates.push(makeCandidate({
          item,
          itemIds,
          segments,
          type,
          label: rule.label || label,
          severity: rule.severity || severity,
          text: match[0],
          suggestion: rule.suggestion,
          reason: itemIds.length > 1 ? `${rule.reason} 複数の文字要素または行・ページにまたがっています。` : rule.reason,
        }));
      }
      if (match[0].length === 0) rule.pattern.lastIndex += 1;
    }
  }
}

function detectCandidates(items) {
  const candidates = [];
  const extractedItems = [...items];
  for (const item of extractedItems) {
    if (item.role === "test-id") continue;
    addRuleCandidates(candidates, item, state.rules.term, "term", "用語", "high");
    addRuleCandidates(candidates, item, state.rules.symbol, "symbol", "類似文字", "high");
    addRuleCandidates(candidates, item, state.rules.formula, "formula", "化学式", "medium");
  }

  const virtualLines = buildVirtualLines(extractedItems);
  const proseBlocks = textFlows(virtualLines,extractedItems,state.pages);
  for(const hit of curriculumChecks(proseBlocks,state.curriculumPolicy)) {
    const segments=segmentsFromCharacterMap(hit.row.charMap,hit.start,hit.length);
    const item=extractedItems.find(item=>item.id===segments[0]?.itemId);
    if(item) candidates.push(makeCandidate({item,segments,type:'curriculum',label:hit.label,severity:'medium',text:hit.text,suggestion:hit.suggestion,reason:hit.reason,ruleId:hit.ruleId,ruleKind:hit.ruleKind}));
  }
  for(const hit of schoolChecks(virtualLines,extractedItems)) {
    const segments=segmentsFromCharacterMap(hit.row.charMap,hit.start,hit.length);
    const item=extractedItems.find(item=>item.id===segments[0]?.itemId);
    if(item) candidates.push(makeCandidate({item,segments,type:hit.type,label:hit.label,severity:hit.type==='format'?'format':'medium',text:hit.text,suggestion:hit.suggestion,reason:hit.reason}));
  }
  addWorkflowCandidates(candidates, virtualLines);
  for(const line of virtualLines) for(const hit of formulaChecks(line,extractedItems)) {
    const segments=segmentsFromCharacterMap(line.charMap,hit.start,hit.length);
    const anchor=extractedItems.find(item=>item.id===segments[0]?.itemId);
    if(anchor) candidates.push(makeCandidate({item:anchor,segments,type:hit.type || 'formula',label:hit.type==='symbol'?'元素記号':'添字',severity:'medium',text:hit.text,suggestion:hit.suggestion,reason:hit.reason}));
  }
  for (const line of virtualLines) {
    addRuleCandidates(candidates, line, state.rules.term, "term", "用語", "high");
    addRuleCandidates(candidates, line, state.rules.symbol, "symbol", "類似文字", "high");
    addRuleCandidates(candidates, line, state.rules.formula, "formula", "化学式", "medium");
  }

  // Detection preserves spaces, scripts and row boundaries; search has its own compact index.
  const documentIndex = detectionIndex(virtualLines);
  // Vocabulary sees reconstructed prose, not PDF row breaks. Hard block
  // boundaries prevent a neighbouring heading, column or table becoming a word.
  if (state.lexicon) {
    for (const block of proseBlocks) {
      const termIndex = detectionIndex([block],true);
      for (const hit of state.lexicon.scan(termIndex.text)) {
      const segments = segmentsForRange(termIndex, hit.start, hit.length);
      const item = extractedItems.find(e => e.id === segments[0]?.itemId);
      if (!item) continue;
      // A specific editorial rule already explains this exact span more clearly
      // than a second, generic spelling-neighbour warning.
      if(candidates.some(candidate=>candidate.type==='curriculum' && candidate.ruleKind==='term' && normalizeComparable(candidate.text)===normalizeComparable(hit.text) && segments.every(segment=>candidate.segments.some(s=>s.itemId===segment.itemId && s.start<=segment.start && s.end>=segment.end)))) continue;
      const names = [...new Set(hit.options.map(e=>e.term))];
      candidates.push(makeCandidate({item,segments,type:'term',label:'用語候補',severity:'medium',text:hit.text,
        suggestion:names.join(' ／ '),reason:`正表記辞書の「${names.join('・')}」と1文字の挿入・脱落・置換の差があります。候補の表記を確認してください。`}));
      }
    }
  }
  addDocumentRuleCandidates(candidates, documentIndex, state.rules.term, "term", "用語", "high");
  addDocumentRuleCandidates(candidates, documentIndex, state.rules.symbol, "symbol", "類似文字", "high");
  addDocumentRuleCandidates(candidates, documentIndex, state.rules.formula, "formula", "化学式", "medium");

  const formulaEntries = [];
  for (const item of extractedItems) {
    if (state.exclusions[item.id] === 'all' || (state.roles[item.id] && item.role !== '化学式')) continue;
    if (item.role === "test-id" || item.role.includes("見出し")) continue;
    formulaTokenRegex.lastIndex = 0;
    const matches = item.text.match(formulaTokenRegex) || [];
    for (const token of matches) {
      const row=virtualLines.find(line=>line.sourceIds.includes(item.id));
      if (token.length < 2 || !isLikelyFormulaToken(token) || !formulaEvidence(token,row?.text || item.text)) continue;
      const tokenStart=row?.charMap.findIndex(p=>p?.itemId===item.id && p.offset===item.text.indexOf(token));
      if(row && !chemicalSpan(row,tokenStart,token.length,extractedItems)) continue;
      if (/^(?:見出し|キャプション|単位|番号|ページ番号)/.test(item.role)) continue;
      const following=row?.text.slice(row.text.indexOf(token)+token.length) || '';
      const context=/^[\s]*[\p{Script=Hiragana}]/u.test(following)?'本文内':'独立・列挙';
      formulaEntries.push({ item, token, context, signature: styleSignature(item) });
    }
  }
  const formulaPages=new Map();
  for(const entry of formulaEntries) {
    if(!formulaPages.has(`${entry.item.pageNumber}:${entry.context}`)) formulaPages.set(`${entry.item.pageNumber}:${entry.context}`,[]);
    formulaPages.get(`${entry.item.pageNumber}:${entry.context}`).push(entry);
  }
  // Sparse pages still contribute to a document-wide comparison within the same usage context.
  for(const context of new Set(formulaEntries.map(entry=>entry.context))) {
    const sparse=formulaEntries.filter(entry=>entry.context===context && formulaPages.get(`${entry.item.pageNumber}:${context}`).length<3);
    if(sparse.length>=state.styleSettings.minimumFormulaSamples) formulaPages.set(`sparse:${context}`,sparse);
  }
  for(const entries of formulaPages.values()) {
    const frequencies = new Map();
    for (const entry of entries) frequencies.set(entry.signature, (frequencies.get(entry.signature) || 0) + 1);
    const dominant = [...frequencies.entries()].sort((a, b) => b[1] - a[1])[0];
    const multiplePages=new Set(entries.map(entry=>entry.item.pageNumber)).size>1;
    if (dominant && dominant[1] >= entries.length*(multiplePages ? .85 : .6) && (entries.length >= state.styleSettings.minimumFormulaSamples || entries.length>=3 && formulaEntries.filter(e=>e.context===entries[0].context && e.signature===dominant[0]).length>=state.styleSettings.minimumFormulaSamples)) {
      for (const entry of entries) {
        const count = frequencies.get(entry.signature) || 0;
        if (entry.signature !== dominant[0] && count <= Math.max(1, Math.floor(entries.length * state.styleSettings.rareStyleRatio))) {
          candidates.push(makeCandidate({
            item: entry.item,
            type: "format",
            label: "書式",
            severity: "format",
            text: entry.token,
            suggestion: styleSuggestion(entries.find(e=>e.signature===dominant[0]).item),
            reason: styleDifference(entry.item,entries.find(e=>e.signature===dominant[0]).item,"化学式"),
            segments: tokenSegments(entry.item,entry.token),
          }));
        }
      }
    }
  }
  const repeatedTokens = new Map();
  for (const entry of formulaEntries) {
    if (!repeatedTokens.has(entry.token)) repeatedTokens.set(entry.token, []);
    repeatedTokens.get(entry.token).push(entry);
  }
  for (const [token, entries] of repeatedTokens) {
    if (entries.length < 3) continue;
    if(new Set(entries.map(entry=>entry.item.pageNumber)).size>1) continue;
    const tokenFrequencies = new Map();
    for (const entry of entries) tokenFrequencies.set(entry.signature, (tokenFrequencies.get(entry.signature) || 0) + 1);
    if (tokenFrequencies.size < 2) continue;
    const tokenDominant = [...tokenFrequencies.entries()].sort((a, b) => b[1] - a[1])[0];
    if(tokenDominant[1] < entries.length*.7) continue;
    for (const entry of entries) {
      if (entry.signature !== tokenDominant[0] && tokenFrequencies.get(entry.signature) === 1) {
        candidates.push(makeCandidate({
          item: entry.item,
          type: "format",
          label: "書式",
          severity: "format",
          text: token,
          suggestion: styleSuggestion(entries.find(e=>e.signature===tokenDominant[0]).item),
          reason: styleDifference(entry.item,entries.find(e=>e.signature===tokenDominant[0]).item,`化学式「${token}」`),
          segments: tokenSegments(entry.item,token),
        }));
      }
    }
  }
  const styleItems = extractedItems.filter(item => state.exclusions[item.id] !== 'all');
  for (const role of ['単位', '本文', '番号', '係数', 'ページ番号', 'キャプション']) {
    if(role==='本文') {
      for(const script of ['日本語','欧文']) addRoleStyleOutliers(candidates,styleItems.filter(item=>scriptGroup(item.text)===script && (script==='日本語' || /^[A-Za-z]{4,}(?:[ -][A-Za-z]{4,})*$/.test(item.text))),role);
    } else for(const page of state.pages) for(const script of ['日本語','欧文','数字・記号']) {
      const group=styleItems.filter(item=>item.pageNumber===page.pageNumber && scriptGroup(item.text)===script);
      if(role==='単位') {
        for(const unit of new Set(group.filter(item=>item.role===role).map(item=>item.text.replace(/[0-9.,\s]+/g,'')))) addRoleStyleOutliers(candidates,group.filter(item=>item.text.replace(/[0-9.,\s]+/g,'')===unit),role);
      } else if(role!=='番号' && role!=='係数') addRoleStyleOutliers(candidates,group,role);
    }
  }
  items.push(...virtualLines);
  return deduplicateCandidates(candidates);
}

function buildVirtualLines(items) {
  return textRows(items).map(line=>({...line,normalized:normalizeText(line.text)}));
}

function addRoleStyleOutliers(candidates, items, role) {
  const entries = items.filter((item) => item.role === role && item.text.trim().length > 1 && !(role==='本文' && scriptGroup(item.text)!=='日本語' && item.text.trim().length<4));
  if (entries.length < state.styleSettings.minimumRoleSamples) return;
  const frequencies = new Map();
  for (const item of entries) {
    const signature = styleSignature(item);
    frequencies.set(signature, (frequencies.get(signature) || 0) + 1);
  }
  const dominant = [...frequencies.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!dominant || dominant[1] < Math.max(2,entries.length*(role==='本文' ? .85 : 2/3)) || [...frequencies.entries()].some(([signature,count])=>signature !== dominant[0] && count >= dominant[1])) return;
  for (const item of entries) {
    const signature = styleSignature(item);
    if (signature !== dominant[0] && frequencies.get(signature) === 1) {
      candidates.push(makeCandidate({
        item,
        type: "format",
        label: "書式",
        severity: "format",
        text: item.text.trim(),
        suggestion: styleSuggestion(entries.find(e=>styleSignature(e)===dominant[0])),
        reason: styleDifference(item,entries.find(e=>styleSignature(e)===dominant[0]),role),
      }));
    }
  }
}

function tokenSegments(item, token) {
  const start=item.text.indexOf(token);
  return [{itemId:item.id,start:Math.max(0,start),end:Math.max(0,start)+token.length,total:item.text.length}];
}
function styleDifference(item,reference,role) {
  const differences=[];
  if(hasReliableFont(item.font) && hasReliableFont(reference.font) && item.font.replace(/^[A-Z]{6}\+/, '')!==reference.font.replace(/^[A-Z]{6}\+/, '')) differences.push('フォント：'+item.font.replace(/^[A-Z]{6}\+/, '')+'（基準：'+reference.font.replace(/^[A-Z]{6}\+/, '')+'）');
  if(item.bold!==reference.bold) differences.push('太字：'+(item.bold?'あり':'なし')+'（基準：'+(reference.bold?'あり':'なし')+'）');
  if(item.italic!==reference.italic) differences.push('斜体：'+(item.italic?'あり':'なし')+'（基準：'+(reference.italic?'あり':'なし')+'）');
  return role+'の同じ用途の多数派と異なります。'+differences.join('。')+'。基準例：'+reference.pageNumber+'ページ「'+reference.text.slice(0,35)+'」。';
}

function styleSignature(item) {
  const fontPart = hasReliableFont(item.font)
    ? item.font.replace(/^[A-Z]{6}\+/, "").replace(/((?:LMRoman|LMSans|LMMono|cmr|cmmi|cmsy|cmbx|cmss|cmtt))\d+/gi,"$1").replace(/PSMT|MT$/g, "")
    : "フォント情報なし";
  return `${fontPart}${item.bold ? " / 太字" : ""}${item.italic ? " / 斜体" : ""}`;
}

function isLikelyFormulaToken(token) {
  const stripped = token
    .replace(new RegExp(`[${SUBSCRIPT}${SUPERSCRIPT}0-9+\\-]`, "g"), "")
    .replace(/Ι/g, "I");
  if (!stripped || stripped.length > 18) return false;
  let index = 0;
  let elementCount = 0;
  while (index < stripped.length) {
    if (!/[A-Z]/.test(stripped[index])) return false;
    let symbol = stripped[index];
    if (index + 1 < stripped.length && /[a-z]/.test(stripped[index + 1])) {
      symbol += stripped[index + 1];
      index += 1;
    }
    if (!elementSymbols.has(symbol)) return false;
    elementCount += 1;
    index += 1;
  }
  return elementCount > 0;
}

function makeCandidate({ item, itemIds, segments, type, label, severity, text, suggestion, reason, ruleId, ruleKind }) {
  const resolvedSegments = segments?.length
    ? segments
    : [{ itemId: item.id, start: 0, end: item.text.length, total: item.text.length }];
  const resolvedItemIds = itemIds?.length ? itemIds : [...new Set(resolvedSegments.map((segment) => segment.itemId))];
  return {
    id: `c-${item.id}-${type}-${text}-${Math.random().toString(36).slice(2, 7)}`,
    itemId: item.id,
    itemIds: resolvedItemIds,
    segments: resolvedSegments,
    pageNumber: item.pageNumber,
    text,
    type,
    label,
    severity,
    suggestion,
    reason,
    ruleId,
    ruleKind,
    role: item.role,
  };
}

function deduplicateCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const item = state.items.find((entry) => entry.id === candidate.itemId);
    const top = item ? Math.round(item.rect.top / 6) : candidate.itemId;
    const key = `${candidate.pageNumber}|${top}|${candidate.type}|${normalizeComparable(candidate.text)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.pageNumber - b.pageNumber || a.type.localeCompare(b.type));
}

function resetPanels() {
  state.zoom=1;
  $('#zoomToolbar').hidden=true;
  $('#zoomValue').textContent='100%';
  $('#zoomOut').disabled=false;
  $('#zoomIn').disabled=false;
  elements.pages.replaceChildren();
  elements.candidateList.replaceChildren();
  elements.candidateCount.textContent = "0";
  elements.emptyCandidates.hidden = false;
  elements.filters.hidden = true;
  elements.candidateActions.hidden = true;
  elements.summary.hidden = true;
  elements.searchForm.hidden = true;
  elements.searchToggleButton.disabled = true;
  elements.searchToggleButton.setAttribute("aria-expanded", "false");
  elements.searchInput.value = "";
  elements.searchResultCount.textContent = "";
  elements.searchPreviousButton.disabled = true;
  elements.searchNextButton.disabled = true;
  elements.clearTextSearchButton.hidden = true;
  elements.highlightAllButton.setAttribute("aria-pressed", "false");
  elements.highlightAllButton.textContent = "全候補をハイライト";
  elements.emptyDetail.hidden = false;
  elements.detail.hidden = true;
  elements.detailPanel.classList.remove("open");
}

function renderCandidates() {
  const visible = state.candidates.filter(candidate => (state.filter === 'all' || candidate.type === state.filter) && (state.reviewFilter === 'all' || getReview(candidate).status === state.reviewFilter));
  elements.candidateList.replaceChildren();
  elements.candidateCount.textContent = visible.length;
  elements.emptyCandidates.hidden = visible.length > 0;
  if (!visible.length && state.pdf) elements.emptyCandidates.querySelector("p").textContent = state.items.length ? "この条件の候補はありません。" : "文字データがないため検査できません。文字を含むPDFが必要です。";

  for (const candidate of visible) {
    const review = getReview(candidate);
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = `candidate-card${candidate.id === state.selectedId ? " active" : ""}`;
    button.dataset.candidateId = candidate.id;
    button.innerHTML = `
      <span class="severity ${candidate.severity}"></span>
      <span class="candidate-main">
        <span class="candidate-meta"><span class="candidate-label">${escapeHtml(candidate.label)}</span><span>${candidate.pageNumber}ページ</span></span>
        <span class="review-badge">${reviewLabels[review.status]}${candidate.updated ? '・更新後の確認' : ''}</span>
        <strong>${escapeHtml(candidate.text)}</strong>
        ${candidate.suggestion ? '<p>→ '+escapeHtml(candidate.suggestion)+'</p>' : ''}
      </span>`;
    button.addEventListener("click", () => selectCandidate(candidate.id));
    li.append(button);
    elements.candidateList.append(li);
  }
  const reviewed = state.candidates.filter(c => getReview(c).status !== 'unreviewed').length;
  $('#reviewProgress').textContent = `確認済み ${reviewed} / ${state.candidates.length}件`;
  syncHighlights();
}

function selectCandidate(candidateId) {
  state.selectedId = candidateId;
  const candidate = state.candidates.find((entry) => entry.id === candidateId);
  if (!candidate) return;
  const item = state.items.find((entry) => entry.id === candidate.itemId);
  if (!item) return;
  state.selectedItemIds = [...candidate.itemIds];
  $('#selectionControls').hidden = false;
  $('#roleSelect').value = state.roles[item.id] || (item.role.includes('見出し') ? '見出し' : item.role);
  if (!$('#roleSelect').value) $('#roleSelect').value = '本文';
  $('#reviewControls').hidden = false;
  const review = getReview(candidate);
  $('#reviewStatus').value = review.status;
  $('#reviewNote').value = review.note;

  elements.emptyDetail.hidden = true;
  elements.detail.hidden = false;
  elements.detailPanel.classList.add("open");
  elements.detailType.textContent = candidate.label;
  elements.detailText.textContent = candidate.text;
  state.selectedText = candidate.text;

  const candidateItems = (candidate.itemIds || [candidate.itemId])
    .map((id) => state.items.find((entry) => entry.id === id))
    .filter(Boolean);
  const pages = [...new Set(candidateItems.map((entry) => entry.pageNumber))];
  const roles = [...new Set(candidateItems.map((entry) => entry.role).filter((role) => role !== "test-id"))];
  elements.detailPage.textContent = `${pages.length > 1 ? `${pages[0]}–${pages.at(-1)}` : candidate.pageNumber} / ${state.pdf.numPages}`;
  elements.detailRole.textContent = roles.join("・") || candidate.role || item.role;
  elements.detailFont.textContent = hasReliableFont(item.font) ? displayFont(item.font) : "取得できず";
  elements.detailSize.textContent = `${item.size.toFixed(1)} pt`;
  elements.detailStyle.textContent = [item.bold ? "太字" : "標準", item.italic ? "斜体" : null].filter(Boolean).join("・");
  elements.suggestionBox.hidden = !candidate.suggestion;
  elements.detailSuggestion.textContent = candidate.suggestion || "";
  renderCandidates();
  requestAnimationFrame(() => {
    const targetTop = pageScrollTop(item.shell);
    elements.documentArea.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  });
}

function candidateItems(candidate) {
  return (candidate.itemIds || [candidate.itemId])
    .map((id) => state.items.find((entry) => entry.id === id))
    .filter(Boolean);
}

function candidateSegments(candidate) {
  return candidate.segments?.length
    ? candidate.segments
    : candidateItems(candidate).map((item) => ({ itemId: item.id, start: 0, end: item.text.length, total: item.text.length }));
}

function syncHighlights() {
  document.querySelectorAll(".highlight").forEach((node) => node.remove());
  if (state.highlightAll) {
    const highlighted = new Set();
    for (const candidate of state.candidates) {
      for (const segment of candidateSegments(candidate)) {
        const key = `${segment.itemId}:${segment.start}:${segment.end}`;
        if (!highlighted.has(key)) createSegmentHighlight(segment, "candidate");
        highlighted.add(key);
      }
    }
  }
  const selected = state.candidates.find((candidate) => candidate.id === state.selectedId);
  if (selected) {
    for (const segment of candidateSegments(selected)) createSegmentHighlight(segment, "selected");
  }
  state.searchOccurrences.forEach((occurrence, index) => {
    const kind = index === state.searchCursor ? "search-current" : "search";
    for (const segment of occurrence.segments) createSegmentHighlight(segment, kind);
  });
}

function createSegmentHighlight(segment, kind) {
  const item = state.items.find((entry) => entry.id === segment.itemId);
  if (!item) return;
  const total = Math.max(1, segment.total || item.text.length);
  const startRatio = Math.max(0, Math.min(1, segment.start / total));
  const endRatio = Math.max(startRatio, Math.min(1, segment.end / total));
  const partialRect = {
    ...item.rect,
    left: item.rect.left + item.rect.width * startRatio,
    width: Math.max(2, item.rect.width * (endRatio - startRatio)),
  };
  createHighlight(item, kind, partialRect);
}

function createHighlight(item, kind, rect = item.rect) {
  const node = document.createElement("span");
  node.className = `highlight visible ${kind}`;
  node.style.left = `${Math.max(0, rect.left - 2)}px`;
  node.style.top = `${Math.max(0, rect.top - 1)}px`;
  node.style.width = `${rect.width + 4}px`;
  node.style.height = `${rect.height + 2}px`;
  item.highlightLayer.append(node);
}

function updateSearchNavigation() {
  const count = state.searchOccurrences.length;
  elements.searchResultCount.textContent = count ? `${state.searchCursor + 1} / ${count}` : "0件";
  elements.searchPreviousButton.disabled = count === 0;
  elements.searchNextButton.disabled = count === 0;
}

function goToSearchResult(nextIndex) {
  const count = state.searchOccurrences.length;
  if (!count) return;
  state.searchCursor = (nextIndex + count) % count;
  updateSearchNavigation();
  syncHighlights();
  const firstSegment = state.searchOccurrences[state.searchCursor].segments[0];
  const item = state.items.find((entry) => entry.id === firstSegment?.itemId);
  if (item) {
    const targetTop = pageScrollTop(item.shell);
    elements.documentArea.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  }
}

function searchDocument(query) {
  const needle = normalizeForSearch(query);
  state.searchItemIds = new Set();
  state.searchOccurrences = [];
  state.searchCursor = -1;
  if (!needle) {
    elements.searchResultCount.textContent = "";
    elements.searchPreviousButton.disabled = true;
    elements.searchNextButton.disabled = true;
    elements.clearTextSearchButton.hidden = true;
    syncHighlights();
    return 0;
  }
  const index = buildDocumentSearchIndex();
  let start = 0;
  while (start <= index.text.length - needle.length) {
    const found = index.text.indexOf(needle, start);
    if (found < 0) break;
    const segments = segmentsForRange(index, found, needle.length);
    const itemIds = [...new Set(segments.map((segment) => segment.itemId))];
    itemIds.forEach((id) => state.searchItemIds.add(id));
    state.searchOccurrences.push({ itemIds, segments });
    start = found + Math.max(1, needle.length);
  }
  elements.clearTextSearchButton.hidden = false;
  updateSearchNavigation();
  if (state.searchOccurrences.length) goToSearchResult(0);
  else syncHighlights();
  showToast(state.searchOccurrences.length ? `${state.searchOccurrences.length}件見つかりました。` : "一致する文字列はありません。");
  return state.searchOccurrences.length;
}

function showTextSelectionDetails() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  const spans = [...elements.pages.querySelectorAll(".text-layer span")].filter((span) => {
    try { return range.intersectsNode(span); } catch { return false; }
  });
  if (!spans.length) return;
  const selectedItems = [...new Set(spans.map((span) => span.dataset.itemId))]
    .map((id) => state.items.find((item) => item.id === id))
    .filter(Boolean);
  if (!selectedItems.length) return;
  state.selectedId = null;
  state.selectedItemIds = selectedItems.map(item => item.id);
  $('#selectionControls').hidden = false;
  $('#reviewControls').hidden = true;
  $('#roleSelect').value = selectedItems[0].role.includes('見出し') ? '見出し' : selectedItems[0].role;
  if (!$('#roleSelect').value) $('#roleSelect').value = '本文';
  const selectedText = selection.toString().replace(/\s+/g, " ").trim();
  state.selectedText = selectedText;
  const roles = [...new Set(selectedItems.map((item) => item.role).filter((role) => role !== "test-id"))];
  const pages = [...new Set(selectedItems.map((item) => item.pageNumber))];
  const fonts = [...new Set(selectedItems.map((item) => item.font).filter(hasReliableFont))];
  const sizes = [...new Set(selectedItems.map((item) => item.size.toFixed(1)))];
  const styles = [...new Set(selectedItems.map((item) => [item.bold ? "太字" : "標準", item.italic ? "斜体" : null].filter(Boolean).join("・")))];
  elements.emptyDetail.hidden = true;
  elements.detail.hidden = false;
  elements.detailPanel.classList.add("open");
  elements.detailType.textContent = "選択範囲";
  elements.detailText.textContent = selectedText || "選択した文字列";
  elements.detailPage.textContent = `${pages.length > 1 ? `${pages[0]}–${pages.at(-1)}` : pages[0]} / ${state.pdf.numPages}`;
  elements.detailRole.textContent = roles.join("・") || "判定不能";
  elements.detailFont.textContent = fonts.length ? [...new Set(fonts.map(displayFont))].join("・") : "取得できず";
  elements.detailSize.textContent = sizes.length === 1 ? `${sizes[0]} pt` : `${Math.min(...sizes.map(Number)).toFixed(1)}–${Math.max(...sizes.map(Number)).toFixed(1)} pt`;
  elements.detailStyle.textContent = styles.join("・");
  elements.suggestionBox.hidden = true;
  renderCandidates();
}

function getReview(candidate) {
  return state.reviews[reviewKey(candidate)] || {status: 'unreviewed', note: ''};
}

function sessionSnapshot() {
  return {schemaVersion: 1, fingerprint: state.fingerprint, name: state.file?.name,
    rows: snapshotRows(state.items), reviews: state.reviews, roles: state.roles, exclusions: state.exclusions,
    candidates: state.candidates.map(c => ({key: reviewKey(c), type: c.type, text: c.text, reason: c.reason, itemIds: c.itemIds})),
    profile: state.profile, preferences: state.preferences};
}
function addWorkflowCandidates(candidates, lines) {
  const rows=lines.map(line => ({...line, page:line.pageNumber, text: line.text.split('').map((ch,index) => state.exclusions[line.charMap[index]?.itemId] ? ' ' : ch).join('')}));
  function addHit(line, hit, type, label, suggestion) {
    const locations=[hit,...(hit.related || [])];
    const segments=locations.flatMap(location => {
      const sourceLine=location === hit ? line : lines[location.line];
      return sourceLine ? segmentsFromCharacterMap(sourceLine.charMap,location.start,location.length) : [];
    });
    const item=state.items.find(i=>i.id===segments[0]?.itemId);
    if(item) candidates.push(makeCandidate({item,segments,type,label,severity:'medium',text:hit.text,suggestion,reason:hit.reason}));
  }
  for(const hit of structureChecks(rows)) addHit(lines[hit.line],hit,'structure','番号・括弧');
  for(const row of rows) for(const rule of state.preferences[state.profile]) {
    let start=0;
    while((start=row.text.indexOf(rule.variant,start))!==-1) {
      addHit(row,{start,length:rule.variant.length,text:rule.variant,reason:`教材の表記ルールでは「${rule.preferred}」に統一します。`},'preference','表記統一',rule.preferred);
      start+=rule.variant.length;
    }
  }
}
function renderProfile() {
  $('#profileSelect').value=state.profile;
  $('#preferenceInput').value=state.preferences[state.profile].map(r=>`${r.variant} => ${r.preferred}`).join('\n');
}
function renderExclusions() {
  const list=$('#exclusionList'); list.replaceChildren();
  if(!Object.keys(state.exclusions).length) list.textContent='除外はありません。';
  for(const [id,scope] of Object.entries(state.exclusions)) {
    const item=state.items.find(i=>i.id===id); if(!item) continue;
    const row=document.createElement('div'); row.className='revision-entry';
    const text=document.createElement('span'); text.textContent=`${item.pageNumber}ページ：${item.text.slice(0,60)}（${scope==='all'?'すべて':'書式以外'}） `;
    const button=document.createElement('button'); button.type='button'; button.textContent='解除';
    button.addEventListener('click',()=>{delete state.exclusions[id];analyzeDocument();});
    row.append(text,button);list.append(row);
  }
}
function renderCoverage() {
  const missing=state.pages.filter(p=>!p.items.some(i=>i.text.trim())).map(p=>p.pageNumber);
  const corrupted=state.pages.filter(p=>p.items.some(i=>/[\uFFFD\u0000]/.test(i.text))).map(p=>p.pageNumber);
  const uncertain=state.items.filter(i=>!i.virtual && !hasReliableFont(i.font)).length;
  const notes=[];
  if(missing.length) notes.push(`文字を抽出できないページ：${missing.join('、')}。画像内の文字は検査できません。`);
  if(corrupted.length) notes.push(`文字化けの疑いがあるページ：${corrupted.join('、')}。`);
  if(uncertain) notes.push(`フォント名を特定できない文字要素が${uncertain}件あります。元のフォント名に基づく比較はできません。`);
  notes.push('候補をクリックすると、該当箇所と推奨候補を確認できます。');
  $('#coverageReport').textContent=notes.join(' ');
}
function renderRevision(carriedCount) {
  const panel=$('#revisionPanel'), output=$('#revisionResult'); panel.hidden=false; panel.open=true; output.replaceChildren();
  const summary=document.createElement('p'); summary.textContent=`変更・追加された行 ${state.revision.changed.length}、削除された行 ${state.revision.removed.length}。確認状態を${carriedCount}件引き継ぎました。役割変更・除外は更新PDFで再設定してください。`;
  output.append(summary);
  for(const row of state.revision.changed) {
    const button=document.createElement('button'); button.type='button'; button.className='revision-entry'; button.textContent=`現在 ${row.page}ページ：${row.text}`;
    button.addEventListener('click',()=>{state.searchOccurrences=[{itemIds:row.ids,segments:row.ids.map(id=>{const item=state.items.find(i=>i.id===id);return {itemId:id,start:0,end:item.text.length,total:item.text.length};})}];goToSearchResult(0);});
    output.append(button);
  }
  for(const row of state.revision.removed) {const p=document.createElement('p');p.className='revision-entry';p.textContent=`旧 ${row.page}ページ（削除）：${row.text}`;output.append(p);}
}

$('#reviewFilter').addEventListener('change',event=>{state.reviewFilter=event.target.value;renderCandidates();});
$('#nextUnreviewed').addEventListener('click',()=>{
  const remaining=state.candidates.filter(c=>getReview(c).status==='unreviewed' && (state.filter==='all' || state.filter===c.type));
  if(!remaining.length) {showToast('この種類に未確認の候補はありません。');return;}
  const index=state.candidates.findIndex(c=>c.id===state.selectedId);
  selectCandidate(remaining.find(c=>state.candidates.indexOf(c)>index)?.id || remaining[0].id);
});
function updateReview() {
  const candidate=state.candidates.find(c=>c.id===state.selectedId);if(!candidate) return;
  state.reviews[reviewKey(candidate)]={status:$('#reviewStatus').value,note:$('#reviewNote').value};
  renderCandidates();
}
$('#reviewStatus').addEventListener('change',updateReview);
$('#reviewNote').addEventListener('input',updateReview);
$('#applyRole').addEventListener('click',()=>{const role=$('#roleSelect').value;if(!role){showToast('変更する役割を選択してください。');return;}for(const id of state.selectedItemIds) state.roles[id]=role;analyzeDocument();showToast('役割を変更して再判定しました。');});
$('#resetRole').addEventListener('click',()=>{for(const id of state.selectedItemIds) delete state.roles[id];analyzeDocument();});
$('#excludeSelection').addEventListener('click',()=>{for(const id of state.selectedItemIds) state.exclusions[id]=$('#exclusionScope').value;analyzeDocument();showToast('検査対象から除外しました。管理欄で解除できます。');});
$('#profileSelect').addEventListener('change',event=>{state.profile=event.target.value;renderProfile();if(state.pdf) analyzeDocument();});
$('#applyPreferences').addEventListener('click',()=>{
  try {state.preferences[state.profile]=parsePreferences($('#preferenceInput').value);if(state.pdf) analyzeDocument();showToast('表記ルールを適用しました。');}
  catch(error){showToast(error.message);}
});
renderProfile();

function normalizeComparable(value) {
  return value.normalize("NFKC").replace(/[\s、。・：:（）()\[\]]/g, "").toLowerCase();
}

function escapeHtml(value) {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}


$('#findSelectedText').addEventListener('click',()=>{
 if(!state.selectedText) return;
 elements.searchForm.hidden=false;elements.searchToggleButton.setAttribute('aria-expanded','true');
 elements.searchInput.value=state.selectedText;searchDocument(state.selectedText);
});
$('#findSelectedFont').addEventListener('click',()=>{
 const selected=state.selectedItemIds.map(id=>state.items.find(item=>item.id===id)).filter(Boolean);
 const fonts=new Set(selected.filter(item=>hasReliableFont(item.font)).map(item=>item.font.replace(/^[A-Z]{6}\+/,'')));
 if(!fonts.size){showToast('フォント名を特定できないため検索できません。');return;}
 state.searchOccurrences=state.items.filter(item=>!item.virtual && fonts.has(item.font.replace(/^[A-Z]{6}\+/,''))).map(item=>({itemIds:[item.id],segments:tokenSegments(item,item.text)}));
 state.searchCursor=-1;elements.searchForm.hidden=false;elements.searchToggleButton.setAttribute('aria-expanded','true');
 elements.searchInput.value='';elements.searchInput.placeholder='フォント検索：'+[...fonts].join('・');
 elements.clearTextSearchButton.hidden=false;updateSearchNavigation();if(state.searchOccurrences.length)goToSearchResult(0);
});

elements.fileInput.addEventListener("change", (event) => openPdf(event.target.files?.[0]));
elements.searchToggleButton.addEventListener("click", () => {
  const opening = elements.searchForm.hidden;
  elements.searchForm.hidden = !opening;
  elements.searchToggleButton.setAttribute("aria-expanded", String(opening));
  if (opening) elements.searchInput.focus();
});
elements.closeSearchButton.addEventListener("click", () => {
  elements.searchForm.hidden = true;
  elements.searchToggleButton.setAttribute("aria-expanded", "false");
  elements.searchToggleButton.focus();
});
elements.highlightAllButton.addEventListener("click", () => {
  state.highlightAll = !state.highlightAll;
  elements.highlightAllButton.setAttribute("aria-pressed", String(state.highlightAll));
  elements.highlightAllButton.textContent = state.highlightAll ? "全候補ハイライトを解除" : "全候補をハイライト";
  syncHighlights();
});
elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  searchDocument(elements.searchInput.value);
});
elements.searchPreviousButton.addEventListener("click", () => goToSearchResult(state.searchCursor - 1));
elements.searchNextButton.addEventListener("click", () => goToSearchResult(state.searchCursor + 1));
elements.clearTextSearchButton.addEventListener("click", () => {
  elements.searchInput.value = "";
  searchDocument("");
  elements.searchInput.focus();
});
elements.pages.addEventListener("mouseup", () => requestAnimationFrame(showTextSelectionDetails));
elements.pages.addEventListener("keyup", () => requestAnimationFrame(showTextSelectionDetails));

elements.filters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  elements.filters.querySelectorAll(".filter").forEach((node) => node.classList.toggle("active", node === button));
  renderCandidates();
});

for (const eventName of ["dragenter", "dragover"]) {
  elements.documentArea.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (!state.pdf) elements.dropZone.classList.add("dragover");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  elements.documentArea.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("dragover");
  });
}
elements.documentArea.addEventListener("drop", (event) => openPdf(event.dataTransfer?.files?.[0]));
window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f" && state.pdf) {
    event.preventDefault();
    elements.searchForm.hidden = false;
    elements.searchToggleButton.setAttribute("aria-expanded", "true");
    elements.searchInput.focus();
    elements.searchInput.select();
  } else if (event.key === "Escape" && !elements.searchForm.hidden) {
    elements.searchForm.hidden = true;
    elements.searchToggleButton.setAttribute("aria-expanded", "false");
  } else if (event.key === "Escape") elements.detailPanel.classList.remove("open");
});

function registerWebMcpTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const registrations = [
    {
      name: "list_proofreading_candidates",
      title: "校正候補を一覧取得",
      description: "現在読み込まれている資料の校正候補を、ページと種類を含めて返します。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute() {
        return state.candidates.map(({ id, pageNumber, text, type, label, reason, suggestion }) => ({ id, pageNumber, text, type, label, reason, suggestion }));
      },
    },
    {
      name: "select_proofreading_candidate",
      title: "校正候補を選択",
      description: "候補IDを選び、画面上で該当ページと推奨候補を表示します。",
      inputSchema: {
        type: "object",
        properties: { candidateId: { type: "string" } },
        required: ["candidateId"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input.candidateId !== "string") throw new Error("candidateId is required");
        const candidate = state.candidates.find((entry) => entry.id === input.candidateId);
        if (!candidate) throw new Error("candidate not found");
        selectCandidate(candidate.id);
        return { selected: candidate.id, pageNumber: candidate.pageNumber, text: candidate.text };
      },
    },
    {
      name: "search_pdf_text",
      title: "資料内の文字列を検索",
      description: "指定した文字列を資料全体から検索し、空白・改行・ページ境界を無視して一致箇所をハイライトします。",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input.query !== "string" || !input.query.trim()) throw new Error("query is required");
        elements.searchInput.value = input.query;
        return { matchCount: searchDocument(input.query), query: input.query };
      },
    },
    {
      name: "highlight_all_candidates",
      title: "全候補をハイライト",
      description: "検出されたすべての校正候補を資料上でハイライトします。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute() {
        state.highlightAll = true;
        elements.highlightAllButton.setAttribute("aria-pressed", "true");
        elements.highlightAllButton.textContent = "全候補ハイライトを解除";
        syncHighlights();
        return { highlightedCandidateCount: state.candidates.length };
      },
    },
  ];
  for (const tool of registrations) {
    try { void Promise.resolve(context.registerTool(tool)).catch(console.error); }
    catch (error) { console.error(error); }
  }
}

registerWebMcpTools();
