const elements = new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' '));
const superChars = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻';
const plainChars = '0123456789+-';
function normalized(text) {
  // Preserve charge notation before compatibility normalization removes superscripts.
  return text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, run => '^' + [...run].map(c => plainChars[superChars.indexOf(c)]).join(''))
    .normalize('NFKC').replace(/[−–]/g, '-').replace(/\s+/g, '');
}
function integer(value) {
  const n = Number(value || 1);
  if (!Number.isSafeInteger(n) || n <= 0 || n > 1000000) throw Error('係数・添字は正の整数で指定してください。');
  return n;
}
function add(target, source, factor = 1) {
  for (const [element, n] of Object.entries(source)) {
    target[element] = (target[element] || 0) + n * factor;
    if (!Number.isSafeInteger(target[element])) throw Error('数が大きすぎるため判定できません。');
  }
}
function atomsOf(formula) {
  let pos = 0;
  function number() { const m = formula.slice(pos).match(/^\d+/); if (m) pos += m[0].length; return integer(m?.[0]); }
  function group(close, depth = 0) {
    if (depth > 16) throw Error('括弧が深すぎます。');
    const counts = {};
    while (pos < formula.length && formula[pos] !== close) {
      const ch = formula[pos];
      if (ch === '(' || ch === '[') {
        pos++; const expected = ch === '(' ? ')' : ']';
        const inner = group(expected, depth + 1);
        if (formula[pos++] !== expected) throw Error('括弧が閉じていません。');
        add(counts, inner, number());
      } else {
        const m = formula.slice(pos).match(/^[A-Z][a-z]?/);
        if (!m || !elements.has(m[0])) throw Error('元素記号または式の表記を読み取れません。');
        pos += m[0].length; add(counts, { [m[0]]: number() });
      }
    }
    if (!Object.keys(counts).length) throw Error('空の化学式・括弧があります。');
    return counts;
  }
  const result = group(undefined);
  if (pos !== formula.length) throw Error('括弧の対応が不正です。');
  return result;
}
function species(text) {
  text = text.replace(/\((?:aq|s|l|g)\)$/, '');
  const leading = text.match(/^\d+/);
  const coefficient = integer(leading?.[0]);
  if (leading) text = text.slice(leading[0].length);
  let charge = 0;
  const explicit = text.match(/\^(\d*)([+-])$/);
  if (explicit) { charge = integer(explicit[1]) * (explicit[2] === '+' ? 1 : -1); text = text.slice(0, -explicit[0].length); }
  else if (/[+-]$/.test(text)) {
    if (/\d[+-]$/.test(text)) throw Error('電荷の数字と添字を区別できません。Fe³⁺ または Fe^3+ のように指定してください。');
    charge = text.endsWith('+') ? 1 : -1; text = text.slice(0, -1);
  }
  if (text === 'e') {
    if (charge !== -1) throw Error('電子は e⁻ または e^- で指定してください。');
    return { atoms: {}, charge: -coefficient };
  }
  const atoms = {};
  for (const [i, part] of text.split(/[·・]/).entries()) {
    const n = i ? part.match(/^\d+/) : null;
    add(atoms, atomsOf(n ? part.slice(n[0].length) : part), coefficient * integer(n?.[0]));
  }
  return { atoms, charge: charge * coefficient };
}
function side(text) {
  // Protect explicit charges, then recognize the plus separating species.
  const protectedText = text.replace(/\^\d*[+-]/g, charge => charge.replace('+', '\u0001'));
  const terms = protectedText.split(/\+(?!\+|$)/).map(t => t.replaceAll('\u0001', '+'));
  const atoms = {}; let charge = 0;
  for (const term of terms) { const s = species(term); add(atoms, s.atoms); charge += s.charge; }
  return { atoms, charge };
}
export function checkFormula(input) {
  try { return {status:'parsed',...species(normalized(input))}; }
  catch(error) { return {status:'unknown',reason:error.message}; }
}
export function checkReaction(input) {
  try {
    if (input.length > 2000) throw Error('式が長すぎます。');
    const text = normalized(input);
    const sides = text.split(/(?:<=>|<->|->|→|⇄|⇌|↔|⟶|⟷|⇒|=)/);
    if (sides.length !== 2 || sides.some(s => !s)) throw Error('左右の式と矢印を1つずつ指定してください。');
    const left = side(sides[0]), right = side(sides[1]);
    const rows = [...new Set([...Object.keys(left.atoms), ...Object.keys(right.atoms)])].map(element => ({ element, left: left.atoms[element] || 0, right: right.atoms[element] || 0 }));
    rows.push({ element: '電荷', left: left.charge, right: right.charge });
    const differences = rows.filter(row => row.left !== row.right);
    return { status: differences.length ? 'unbalanced' : 'balanced', rows, differences,
      reason: differences.length ? differences.map(r => `${r.element}：左辺 ${r.left}、右辺 ${r.right}`).join('／') : '原子数・電荷が一致しています。' };
  } catch (error) { return { status: 'unknown', reason: error.message, rows: [] }; }
}

export function findReactionRanges(text) {
  // Preserve offsets while joining an explicit continuation operator across a line break.
  const source=text;
  text=text.replace(/([+→⇄⇌↔=])[ \t]*\n[ \t]*(?=[A-Za-z0-9₀-₉])/g,m=>m.replace(/\n/g,' '));
  // Restrict extraction to a single text row; never connect independent pages/equations.
  const results = [];
  const runs = /[A-Za-z0-9₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻+−\-()\[\].·・^=→⇄⇌↔⟶⟷⇒<> \t□＿_?]+/gu;
  for (const m of text.matchAll(runs)) {
    if (!/(?:->|→|⇄|⇌|↔|⟶|⟷|⇒|=)/.test(m[0])) continue;
    const value = m[0].trim();
    if (!/[A-Z]/.test(value)) continue;
    if(value.split(/(?:->|→|⇄|⇌|↔|⟶|⟷|⇒|=)/).some(side=>!/[A-Z]|e(?:⁻|\^-)/.test(side))) continue;
    // Adjacent carbon/hydrogen fragments joined by '=' are structural double bonds.
    if(/(?:C|H)[₀-₉0-9]*=(?:C|H)/.test(value) && !/[→⇄⇌↔⟶⟷⇒+]/.test(value) && !/\((?:s|l|g|aq)\)/.test(value)) continue;
    const result=checkReaction(value);
    // '=' is common in algebra. Automatic checking requires chemical species evidence.
    const strong=/(?:[A-Z][a-z](?:[A-Z]|[0-9₀-₉⁺⁻])|[A-Z][0-9₀-₉]|[A-Z][a-z]?[⁺⁻]|[A-Z][a-z]?\^\d*[+-]|e[⁻]|e\^-)/.test(value);
    if(!strong && (value.includes('=') || result.status==='unknown')) continue;
    // Unreadable mathematical expressions are not chemical proofreading candidates.
    if(result.status==='unknown' && !/(?:電荷|添字|括弧|空の|数字|数が|左右)/.test(result.reason) && !/[□＿_?]/.test(value)) continue;
    results.push({ start: m.index + m[0].indexOf(value), length: value.length, text: source.slice(m.index+m[0].indexOf(value),m.index+m[0].indexOf(value)+value.length), result });
  }
  return results;
}
