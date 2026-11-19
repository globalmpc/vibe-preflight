import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as rc from '../skills/vibe-preflight/scripts/report-card.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'skills/vibe-preflight/scripts/report-card.mjs');
const fx = (n) => readFileSync(join(root, 'test/fixtures', n), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'skills/vibe-preflight/package.json'), 'utf8'));

function proj(json) {
  const d = mkdtempSync(join(tmpdir(), 'rc-'));
  mkdirSync(join(d, '.vibe-preflight'));
  if (json !== undefined) writeFileSync(join(d, '.vibe-preflight/findings.json'), typeof json === 'string' ? json : JSON.stringify(json));
  return d;
}
const run = (d) => spawnSync(process.execPath, [script, d], { encoding: 'utf8' });
const out = (d, n) => readFileSync(join(d, '.vibe-preflight', n));
const mk = (red, yellow, info, done, extra = {}) => ({
  schema: 1, project: 'P', scanDate: '2026-01-01', fixed: 0, ...extra,
  findings: [
    ...Array(red).fill({ severity: 'RED', category: 'security', fixMinutes: 10 }),
    ...Array(yellow).fill({ severity: 'YELLOW', category: 'cost', fixMinutes: 0 }),
    ...Array(info).fill({ severity: 'INFO', category: 'agent', fixMinutes: 0 }),
    ...Array(done).fill({ doneWell: true, category: 'security' })],
});
const sc = (...a) => rc.score(rc.parseFindings(mk(...a)).findings);

test('AC1 determinism', () => {
  const [a, b] = [proj(fx('demo.json')), proj(fx('demo.json'))];
  assert.equal(run(a).status, 0); assert.equal(run(b).status, 0);
  for (const n of ['report-card.svg', 'report-card.png']) assert.ok(out(a, n).equals(out(b, n)), n);
  assert.doesNotMatch(readFileSync(script, 'utf8'), /Date\.now|new Date\(|Math\.random/);
});

test('AC2 no leak', () => {
  const d = proj(fx('leak.json'));
  mkdirSync(join(d, '.vibe-preflight/history'));
  writeFileSync(join(d, '.vibe-preflight/history/0001-2026-11-01.json'), JSON.stringify({ schema: 1, date: '2026-11-01', version: '1.0.0', grade: 'D', score: 60, mustFix: 3, worthFixing: 4, doneWell: 0 }));
  const r = run(d);
  assert.equal(r.status, 0);
  const all = [r.stdout, r.stderr, out(d, 'report-card.svg'), out(d, 'report-card-progress.svg'), out(d, 'report-card.png').toString('latin1'), out(d, 'report-card-progress.png').toString('latin1')];
  for (const f of readdirSync(join(d, '.vibe-preflight/history'))) {
    const e = out(d, 'history/' + f).toString();
    assert.deepEqual(Object.keys(JSON.parse(e)).sort(), ['date', 'doneWell', 'grade', 'mustFix', 'schema', 'score', 'version', 'worthFixing']);
    all.push(e);
  }
  assert.equal(readdirSync(join(d, '.vibe-preflight/history')).length, 2);
  for (const c of ['CANARY_TITLE_7a1', 'canary_path_7a1', 'CANARY_SECRET_9f2c1e', 'CANARY_ENV_7a1', 'canary-pkg-7a1']) for (const x of all) assert.ok(!String(x).includes(c), c);
});

test('AC3 invalid input never echoes values', () => {
  const C = 'CANARY_BAD_7a1';
  const cases = { 'findings[0].category': { category: C, severity: 'RED' }, 'findings[0].severity': { category: 'cost', severity: C }, scanDate: null };
  for (const [field, f] of Object.entries(cases)) {
    const j = mk(0, 0, 0, 0);
    if (f) j.findings = [f]; else j.scanDate = C;
    const d = proj(j), r = run(d);
    assert.equal(r.status, 1);
    assert.ok(r.stderr.includes(field), field);
    assert.ok(!r.stderr.includes(C) && !r.stdout.includes(C));
    assert.deepEqual(readdirSync(join(d, '.vibe-preflight')), ['findings.json']);
  }
});

test('AC4 rubric and RED cap', () => {
  let s = sc(1, 0, 0, 0); assert.deepEqual([s.score, s.grade, s.verdict], [69, 'D', 'Not ready for real users yet']);
  s = sc(1, 0, 0, 10); assert.ok(s.score <= 69 && s.grade === 'D');
  s = sc(0, 3, 2, 5); assert.deepEqual([s.score, s.grade], [88, 'B+']);
  s = sc(0, 0, 0, 5); assert.deepEqual([s.score, s.grade], [100, 'A+']);
  assert.equal(sc(13, 0, 0, 0).grade, 'F');
  for (let r = 1; r <= 5; r++) for (let w = 0; w <= 20; w++) for (let y = 0; y <= 3; y++) assert.ok(['D', 'F'].includes(sc(r, y, 0, w).grade));
});

test('AC5 docs match code', () => {
  const md = readFileSync(join(root, 'docs/grading.md'), 'utf8');
  const rows = (h) => md.split('\n').slice(md.split('\n').findIndex((l) => l.startsWith(`| ${h} |`)) + 2)
    .filter((l, i, a) => a.slice(0, i).every((x) => x.startsWith('|')) && l.startsWith('|')).map((l) => l.split('|').slice(1, 3).map((c) => c.trim()));
  const rubric = Object.fromEntries(rows('Rule').map(([k, v]) => [k, Number(v)]));
  assert.deepEqual(rubric, { 'RED deduction': rc.WEIGHTS.RED, 'YELLOW deduction': rc.WEIGHTS.YELLOW, 'INFO deduction': rc.WEIGHTS.INFO,
    'Bonus per done-well': rc.BONUS_PER, 'Bonus cap': rc.BONUS_CAP, 'Max score with any RED': rc.RED_CAP });
  assert.deepEqual(rows('Grade').map(([g, n]) => [g, Number(n)]), rc.GRADES);
});

test('AC6 progress and history', () => {
  const d = proj(mk(2, 0, 0, 0, { scanDate: '2026-02-01' }));
  const f = join(d, '.vibe-preflight/findings.json');
  assert.equal(run(d).status, 0);
  assert.deepEqual(readdirSync(join(d, '.vibe-preflight/history')), ['0001-2026-02-01.json']);
  assert.ok(!existsSync(join(d, '.vibe-preflight/report-card-progress.svg')));
  writeFileSync(f, JSON.stringify(mk(0, 3, 2, 5, { scanDate: '2026-03-01', fixed: 2 })));
  assert.equal(run(d).status, 0);
  const p = out(d, 'report-card-progress.svg').toString();
  for (const s of ['D → B+', '2 → 0', 'Fixed: 2', '2026-02-01 → 2026-03-01']) assert.ok(p.includes(s), s);
  assert.deepEqual(readdirSync(join(d, '.vibe-preflight/history')), ['0001-2026-02-01.json', '0002-2026-03-01.json']);
  assert.equal(run(d).status, 0);
  assert.equal(readdirSync(join(d, '.vibe-preflight/history')).length, 2);
  assert.equal(out(d, 'report-card-progress.svg').toString(), p);
  rmSync(join(d, '.vibe-preflight/history'), { recursive: true });
  assert.equal(run(d).status, 0);
  assert.ok(!existsSync(join(d, '.vibe-preflight/report-card-progress.svg')) && !existsSync(join(d, '.vibe-preflight/report-card-progress.png')));
});

test('AC7 content and readability', () => {
  const meta = { version: pkg.version, url: rc.sanitizeRepoUrl(pkg.repository.url) };
  const data = rc.parseFindings(JSON.parse(fx('demo.json')));
  const svg = rc.renderCard(data, meta);
  const s = rc.score(data.findings);
  const labels = ['Security', 'Secrets', 'Dependencies', 'Cost &amp; abuse', 'Unfinished code', 'Deployment', 'Agent config'];
  const pos = labels.map((l) => svg.indexOf(`>${l}<`));
  assert.ok(pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])));
  for (const x of ['TaskNote', `>${s.grade}<`, s.verdict, 'Must fix', 'Worth fixing', 'Done well', 'Est. fix time (must fix): ~2.5 h', '2026-11-19', `v${pkg.version}`, meta.url, 'search vibe-preflight on GitHub']) assert.ok(svg.includes(x), x);
  const big = rc.parseFindings(JSON.parse(fx('max.json')));
  const evil = rc.parseFindings({ ...mk(0, 0, 0, 0), project: '<script>&"\'' });
  assert.ok(rc.fixTime(rc.score(big.findings).fixMinutes).startsWith('~') && rc.score(big.findings).fixMinutes > 6000);
  const pv = { date: '2026-10-01', grade: 'F', mustFix: 999, worthFixing: 999, doneWell: 0 };
  for (const x of [svg, rc.renderCard(big, meta), rc.renderCard(evil, meta), rc.renderProgress(big, pv, meta)]) {
    for (const m of x.matchAll(/font-size="(\d+)"/g)) assert.ok(+m[1] >= 28);
    for (const m of x.matchAll(/<text [^>]*font-size="(\d+)"[^>]*>(.*)<\/text>/g)) {
      const t = m[2].replace(/&(amp|lt|gt|quot|apos);/g, '_');
      assert.ok(Array.from(t).length * 0.6 * +m[1] <= 960, t);
    }
  }
  const e = rc.renderCard(evil, meta);
  assert.ok(e.includes('&lt;script&gt;&amp;&quot;&apos;') && !e.includes('<script>'));
});

test('AC8 url sanitizing and badge', () => {
  const u = 'https://github.com/o/r';
  assert.equal(rc.sanitizeRepoUrl('git+https://user:tok3n@github.com/o/r.git?x=1#y'), u);
  assert.equal(rc.sanitizeRepoUrl('git@github.com:o/r.git'), u);
  for (const b of ['http://github.com/o/r', 'file:///o/r', 'javascript:alert(1)', 'https://github.com/o/r"><x']) assert.equal(rc.sanitizeRepoUrl(b), null);
  assert.equal(rc.badge('B+', u), '[![vibe-preflight: B+](https://img.shields.io/badge/vibe--preflight-B%2B-green)](https://github.com/o/r)');
  assert.equal(rc.sanitizeRepoUrl(pkg.repository.url), 'https://github.com/globalmpc/vibe-preflight');
});

test('AC9 write safety', () => {
  for (const what of ['report-card.svg', 'history']) {
    const d = proj(fx('demo.json')), victim = mkdtempSync(join(tmpdir(), 'rc-victim-'));
    const target = join(victim, 'target');
    if (what === 'history') mkdirSync(target); else writeFileSync(target, 'ORIGINAL');
    symlinkSync(target, join(d, '.vibe-preflight', what));
    assert.equal(run(d).status, 1);
    if (what === 'history') assert.deepEqual(readdirSync(target), []); else assert.equal(readFileSync(target, 'utf8'), 'ORIGINAL');
  }
});

test('AC12 vendored files and hashes match grading.md', () => {
  const md = readFileSync(join(root, 'docs/grading.md'), 'utf8');
  const v = join(root, 'skills/vibe-preflight/scripts/vendor');
  for (const f of ['resvg/index.mjs', 'resvg/index_bg.wasm', 'resvg/LICENSE', 'fonts/JetBrainsMono-Regular.ttf', 'fonts/JetBrainsMono-Bold.ttf', 'fonts/OFL.txt']) assert.ok(existsSync(join(v, f)), f);
  for (const f of ['resvg/index_bg.wasm', 'fonts/JetBrainsMono-Regular.ttf', 'fonts/JetBrainsMono-Bold.ttf'])
    assert.ok(md.includes(createHash('sha256').update(readFileSync(join(v, f))).digest('hex')), f);
});

test('AC12 demo card reproduces from demo.json', () => {
  const d = proj(fx('demo.json'));
  assert.equal(run(d).status, 0);
  assert.ok(out(d, 'report-card.svg').equals(readFileSync(join(root, 'docs/demo/report-card.svg'))));
});
