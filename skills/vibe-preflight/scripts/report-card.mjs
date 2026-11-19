#!/usr/bin/env node
// Report card: reads .vibe-preflight/findings.json, writes grade card, progress card, history.
// Usage: node report-card.mjs [projectDir]. Zero dependencies; no network; no clock.
// Only allow-listed fields are ever read from findings.json, so extra fields can't reach output.
import { readFileSync, writeFileSync, readdirSync, lstatSync, mkdirSync, rmSync, realpathSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// Rubric: mirrored in docs/grading.md (a test keeps them equal).
export const WEIGHTS = { RED: 20, YELLOW: 5, INFO: 1 };
export const BONUS_PER = 1;
export const BONUS_CAP = 5;
export const RED_CAP = 69;
export const GRADES = [['A+', 97], ['A', 90], ['B+', 85], ['B', 80], ['C+', 75], ['C', 70], ['D', 60], ['F', 0]];

const CATEGORIES = [['security', 'Security'], ['secrets', 'Secrets'], ['dependencies', 'Dependencies'],
  ['cost', 'Cost & abuse'], ['unfinished', 'Unfinished code'], ['deployment', 'Deployment'], ['agent', 'Agent config']];
const COLORS = { A: 'brightgreen', B: 'green', C: 'yellow', D: 'orange', F: 'red' };
const GRADE_FILL = { A: '#3fb950', B: '#7ee787', C: '#e3b341', D: '#f0883e', F: '#f85149' };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VERSION_RE = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const SEARCH = 'search vibe-preflight on GitHub';
const FONT = 'JetBrains Mono, DejaVu Sans Mono, Menlo, Consolas, monospace';

class Bad extends Error {} // message is always a field path, never a value

const isInt = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;

export function parseFindings(raw) {
  const o = (v, p) => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Bad(p); return v; };
  const d = o(raw, 'findings.json');
  if (d.schema !== 1) throw new Bad('schema');
  if (typeof d.project !== 'string') throw new Bad('project');
  // ponytail: assumes Latin-width glyphs; CJK/emoji names are wider than 0.6em and may overflow the card.
  const chars = Array.from(d.project.replace(/[\u0000-\u001f\u007f-\u009f]/g, ''));
  const project = chars.length > 24 ? chars.slice(0, 23).join('') + '…' : chars.join('') || 'Untitled';
  if (typeof d.scanDate !== 'string' || !DATE_RE.test(d.scanDate)) throw new Bad('scanDate');
  const fixed = d.fixed === undefined ? 0 : d.fixed;
  if (!isInt(fixed, 1e6)) throw new Bad('fixed');
  if (!Array.isArray(d.findings)) throw new Bad('findings');
  const findings = d.findings.map((f, i) => {
    const p = `findings[${i}]`;
    o(f, p);
    if (!CATEGORIES.some(([k]) => k === f.category)) throw new Bad(`${p}.category`);
    if (f.doneWell !== undefined && typeof f.doneWell !== 'boolean') throw new Bad(`${p}.doneWell`);
    if (f.doneWell) return { doneWell: true, category: f.category };
    if (typeof f.severity !== 'string' || !Object.hasOwn(WEIGHTS, f.severity)) throw new Bad(`${p}.severity`);
    const fixMinutes = f.fixMinutes === undefined ? 0 : f.fixMinutes;
    if (!isInt(fixMinutes, 100000)) throw new Bad(`${p}.fixMinutes`);
    return { severity: f.severity, category: f.category, fixMinutes };
  });
  return { project, scanDate: d.scanDate, fixed, findings };
}

export function score(findings) {
  const n = { RED: 0, YELLOW: 0, INFO: 0 };
  const byCategory = Object.fromEntries(CATEGORIES.map(([k]) => [k, 0]));
  let doneWell = 0, fixMinutes = 0;
  for (const f of findings) {
    if (f.doneWell) { doneWell++; continue; }
    n[f.severity]++;
    byCategory[f.category]++;
    if (f.severity === 'RED') fixMinutes += f.fixMinutes;
  }
  let s = 100 - n.RED * WEIGHTS.RED - n.YELLOW * WEIGHTS.YELLOW - n.INFO * WEIGHTS.INFO
    + Math.min(doneWell * BONUS_PER, BONUS_CAP);
  s = Math.max(0, Math.min(100, s));
  if (n.RED) s = Math.min(s, RED_CAP);
  const grade = GRADES.find(([, min]) => s >= min)[0];
  const verdict = n.RED ? 'Not ready for real users yet'
    : s >= 90 ? 'Ready for real users' : 'Almost ready: a few things worth fixing';
  return { score: s, grade, verdict, mustFix: n.RED, worthFixing: n.YELLOW + n.INFO, doneWell, byCategory, fixMinutes };
}

export function fixTime(min) {
  if (min === 0) return 'none';
  if (min < 60) return `~${min} min`;
  return `~${Math.round(min / 60 * 2) / 2} h`;
}

export function sanitizeRepoUrl(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim().replace(/^git\+/, '');
  const ssh = /^git@([^:/]+):(.+)$/.exec(s);
  if (ssh) s = `https://${ssh[1]}/${ssh[2]}`;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const path = u.pathname.replace(/\/+$/, '').replace(/\.git$/, '').replace(/\/+$/, '');
  return /^(\/[A-Za-z0-9._~-]+)+$/.test(path) ? `https://${u.hostname}${path}` : null;
}

export function badge(grade, url) {
  const img = `![vibe-preflight: ${grade}](https://img.shields.io/badge/vibe--preflight-${encodeURIComponent(grade)}-${COLORS[grade[0]]})`;
  return url ? `[${img}](${url})` : img;
}

// ---- SVG ----
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const text = (x, y, size, s, fill = '#e6edf3', weight = '', anchor = '') =>
  `<text x="${x}" y="${y}" font-size="${size}"${weight ? ` font-weight="${weight}"` : ''}${anchor ? ` text-anchor="${anchor}"` : ''} fill="${fill}">${esc(s)}</text>`;
const MUTED = '#9da7b3';
const frame = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" font-family="${FONT}">\n`
  + `<rect width="1080" height="1350" fill="#0d1117"/>\n${body.join('\n')}\n</svg>\n`;

function footer(meta, y, withDate) {
  const out = [];
  const ver = meta.version ? ` · vibe-preflight v${meta.version}` : ' · vibe-preflight';
  if (withDate) out.push(text(540, y, 28, `Scanned ${withDate}${ver}`, MUTED, '', 'middle'));
  else if (meta.version) out.push(text(540, y, 28, `vibe-preflight v${meta.version}`, MUTED, '', 'middle'));
  let yy = y + 45;
  // ponytail: a URL too long for one line is dropped rather than cut (a cut URL would be wrong).
  if (meta.url && meta.url.length * 0.6 * 28 <= 960) { out.push(text(540, yy, 28, meta.url, '#e6edf3', '', 'middle')); yy += 35; }
  out.push(text(540, yy, 28, SEARCH, MUTED, '', 'middle'));
  return out;
}

export function renderCard(data, meta = {}) {
  const s = score(data.findings);
  const fill = GRADE_FILL[s.grade[0]];
  const b = [
    text(540, 90, 32, 'vibe report card', MUTED, '', 'middle'),
    text(540, 165, 56, data.project, '#e6edf3', 'bold', 'middle'),
    text(540, 470, 280, s.grade, fill, 'bold', 'middle'),
    text(540, 560, 36, s.verdict, fill, 'bold', 'middle'),
  ];
  [['Must fix', s.mustFix, '#f85149'], ['Worth fixing', s.worthFixing, '#e3b341'], ['Done well', s.doneWell, '#3fb950']]
    .forEach(([label, n, c], i) => {
      b.push(text(180 + i * 360, 670, 80, n, c, 'bold', 'middle'), text(180 + i * 360, 715, 28, label, MUTED, '', 'middle'));
    });
  b.push('<rect x="60" y="760" width="960" height="2" fill="#30363d"/>');
  CATEGORIES.forEach(([k, label], i) => {
    const y = 815 + i * 52;
    b.push(text(60, y, 32, label), text(1020, y, 32, s.byCategory[k], s.byCategory[k] ? '#e6edf3' : MUTED, 'bold', 'end'));
  });
  b.push('<rect x="60" y="1145" width="960" height="2" fill="#30363d"/>',
    text(540, 1198, 30, `Est. fix time (must fix): ${fixTime(s.fixMinutes)}`, '#e6edf3', 'bold', 'middle'),
    ...footer(meta, 1243, data.scanDate));
  return frame(b);
}

export function renderProgress(data, prev, meta = {}) {
  const s = score(data.findings);
  const b = [
    text(540, 90, 32, 'vibe report card: progress', MUTED, '', 'middle'),
    text(540, 165, 56, data.project, '#e6edf3', 'bold', 'middle'),
    text(540, 440, 150, `${prev.grade} → ${s.grade}`, GRADE_FILL[s.grade[0]], 'bold', 'middle'),
    text(540, 540, 48, `Fixed: ${data.fixed}`, '#3fb950', 'bold', 'middle'),
  ];
  [['Must fix', prev.mustFix, s.mustFix], ['Worth fixing', prev.worthFixing, s.worthFixing], ['Done well', prev.doneWell, s.doneWell]]
    .forEach(([label, a, c], i) => {
      const y = 680 + i * 100;
      b.push(text(60, y, 36, label, MUTED), text(1020, y, 48, `${a} → ${c}`, '#e6edf3', 'bold', 'end'));
    });
  b.push(text(540, 1010, 36, `${prev.date} → ${data.scanDate}`, '#e6edf3', '', 'middle'), ...footer(meta, 1243, null));
  return frame(b);
}

// ---- PNG (vendored resvg-wasm; unmodified upstream) ----
const here = dirname(fileURLToPath(import.meta.url));
let ready;
async function renderPng(svg) {
  const v = join(here, 'vendor');
  ready ??= (async () => {
    const { initWasm, Resvg } = await import(pathToFileURL(join(v, 'resvg', 'index.mjs')).href);
    await initWasm(readFileSync(join(v, 'resvg', 'index_bg.wasm')));
    const fontBuffers = ['Regular', 'Bold'].map((w) => readFileSync(join(v, 'fonts', `JetBrainsMono-${w}.ttf`)));
    return (s) => new Resvg(s, { font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: 'JetBrains Mono', monospaceFamily: 'JetBrains Mono' }, fitTo: { mode: 'original' } }).render().asPng();
  })();
  return (await ready)(svg);
}

// ---- main ----
function readMeta() {
  try {
    const p = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
    const r = p.repository;
    return { version: VERSION_RE.test(p.version) ? p.version : null, url: sanitizeRepoUrl(typeof r === 'string' ? r : r?.url) };
  } catch { return { version: null, url: null }; }
}

const validEntry = (e) => e && typeof e === 'object' && !Array.isArray(e)
  && isDeepStrictEqual(Object.keys(e).sort(), ['date', 'doneWell', 'grade', 'mustFix', 'schema', 'score', 'version', 'worthFixing'])
  && e.schema === 1 && DATE_RE.test(e.date) && GRADES.some(([g]) => g === e.grade)
  && isInt(e.score, 100) && isInt(e.mustFix, 1e9) && isInt(e.worthFixing, 1e9) && isInt(e.doneWell, 1e9)
  && (e.version === null || VERSION_RE.test(e.version));

const isLink = (p) => { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } };

export async function main(projectDir = '.') {
  const vp = join(resolve(projectDir), '.vibe-preflight');
  const hist = join(vp, 'history');
  const out = Object.fromEntries(['report-card.svg', 'report-card.png', 'report-card-progress.svg', 'report-card-progress.png'].map((n) => [n, join(vp, n)]));
  for (const p of [vp, hist, join(vp, 'findings.json'), ...Object.values(out)]) if (isLink(p)) throw new Bad('symlink in .vibe-preflight');

  let raw;
  try { raw = readFileSync(join(vp, 'findings.json'), 'utf8'); } catch { throw new Bad('findings.json (missing or unreadable)'); }
  let json;
  try { json = JSON.parse(raw); } catch { throw new Bad('findings.json (not valid JSON)'); }
  const data = parseFindings(json);
  const meta = readMeta();
  const s = score(data.findings);
  const entry = { schema: 1, date: data.scanDate, version: meta.version, grade: s.grade, score: s.score, mustFix: s.mustFix, worthFixing: s.worthFixing, doneWell: s.doneWell };

  let names = [];
  try { names = readdirSync(hist).filter((n) => /^\d{4}-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort(); } catch { /* no history yet */ }
  const valid = [];
  for (const n of names) {
    try { const e = JSON.parse(readFileSync(join(hist, n), 'utf8')); if (validEntry(e)) valid.push(e); } catch { /* skip malformed */ }
  }
  // ponytail: an identical rescan counts as a re-render, so progress never compares a scan with itself; add a run id if that matters.
  const rerun = valid.length > 0 && isDeepStrictEqual(valid.at(-1), entry);
  const prev = rerun ? valid.at(-2) : valid.at(-1);
  if (!rerun) {
    const seq = names.length ? Number(names.at(-1).slice(0, 4)) + 1 : 1;
    mkdirSync(hist, { recursive: true });
    writeFileSync(join(hist, `${String(seq).padStart(4, '0')}-${data.scanDate}.json`), JSON.stringify(entry, null, 2) + '\n', { flag: 'wx' });
  }

  const written = [];
  const put = (name, content) => { writeFileSync(out[name], content); written.push(out[name]); };
  const card = renderCard(data, meta);
  put('report-card.svg', card);
  put('report-card.png', await renderPng(card));
  if (prev) {
    const prog = renderProgress(data, prev, meta);
    put('report-card-progress.svg', prog);
    put('report-card-progress.png', await renderPng(prog));
  } else {
    rmSync(out['report-card-progress.svg'], { force: true });
    rmSync(out['report-card-progress.png'], { force: true });
  }
  return `Badge (paste into your README; it is self-reported):\n${badge(s.grade, meta.url)}\nWrote:\n${written.join('\n')}\n`;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main(process.argv[2]).then((o) => process.stdout.write(o)).catch((e) => {
    process.stderr.write(`report-card: ${e instanceof Bad ? `invalid or unsafe input at ${e.message}` : `failed (${e.code ?? 'error'})`}\n`);
    process.exit(1);
  });
}
