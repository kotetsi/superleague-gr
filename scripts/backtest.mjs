// Walk-forward έλεγχος του μοντέλου στις σεζόν που έχουμε με αποδόσεις: για κάθε αγώνα, μοντέλο εκπαιδευμένο μόνο σε προηγούμενους.
import fs from 'node:fs/promises';
import { marketXG, fit, predict, devig, PARAMS } from '../src/model.mjs';
import { oddsOf, bestOf } from '../src/odds.mjs';
const csv = t => { const L = t.replace(/^﻿/, '').trim().split(/\r?\n/).map(l => l.split(',')); return L.slice(1).map(r => Object.fromEntries(L[0].map((h, i) => [h, r[i] ?? '']))); };
const dateOf = d => { const [dd, mm, yy] = d.split('/'); return `${yy.length === 2 ? '20' + yy : yy}-${mm}-${dd}`; };
const files = [...(await fs.readdir('data/full').catch(() => [])).map(f => 'full/' + f), ...(await fs.readdir('data')).filter(f => /^G1-\d{4}\.csv$/.test(f))].sort((a, b) => a.slice(-8).localeCompare(b.slice(-8)));
const M = [];
for (const f of files) for (const r of csv(await fs.readFile('data/' + f, 'utf8'))) {
  if (!r.HomeTeam || r.FTHG === '') continue;
  const o = oddsOf(r), m = { date: dateOf(r.Date), h: r.HomeTeam, a: r.AwayTeam, hg: +r.FTHG, ag: +r.FTAG, o, xg: r.HxG ? [+r.HxG, +r.AxG] : null };
  m.odds = o.avgC || o.avgO; m.ou = o.ouC.Avg || o.ouO.Avg || []; m.mx = marketXG(m);
  M.push(m);
}
M.sort((a, b) => a.date.localeCompare(b.date));
const beta = +(process.env.BETA ?? PARAMS.beta);
const startIdx = process.env.FROM ? M.findIndex(m => m.date >= process.env.FROM) : Math.floor(M.length * 0.25);
const cache = {}; const rows = [];
for (const m of M.slice(startIdx)) {
  const F = (cache[m.date] ||= fit(M, m.date, { ...PARAMS, beta }));
  const p = predict(F, m.h, m.a), pm = [p.h, p.d, p.a];
  const r = m.hg > m.ag ? 0 : m.hg === m.ag ? 1 : 2;
  rows.push({ m, pm, r, po: m.o.avgO && devig(...m.o.avgO), pc: m.o.avgC && devig(...m.o.avgC), best: bestOf(m.o.open), o25: p.o25 });
}
const ll = (L, k) => { const v = L.filter(x => x[k]); return [-v.reduce((s, x) => s + Math.log(x[k][x.r]), 0) / v.length, v.length]; };
console.log(`Αγώνες ελέγχου: ${rows.length} (από ${rows[0].m.date})`);
for (const k of ['pm', 'po', 'pc']) console.log(k, ll(rows, k).map(x => x.toFixed ? x.toFixed(4) : x).join(' n='));
for (const th of [0, 0.03, 0.05, 0.1]) {
  let n = 0, pr = 0, clv = 0;
  for (const x of rows) for (let i = 0; i < 3; i++) { const b = x.best[i]; if (!b || !x.m.o.avgC) continue; const ev = x.pm[i] * b[0] - 1; if (ev > th) { n++; pr += x.r === i ? b[0] - 1 : -1; clv += b[0] * devig(...x.m.o.avgC)[i] - 1; } }
  console.log(`1X2 EV>${th}: ${n} στοιχήματα, ROI ${(100 * pr / n).toFixed(1)}%, CLV ${(100 * clv / n).toFixed(1)}%`);
}
// έλεγχος: CLV όλων των εκβάσεων χωρίς επιλογή (πόσο «φουσκώνει» το CLV επειδή παίρνουμε την καλύτερη τιμή)
{ let n = 0, clv = 0, clvB = 0, nb = 0;
  for (const x of rows) for (let i = 0; i < 3; i++) { const b = x.best[i]; if (!b || !x.m.o.avgC) continue; n++; clv += b[0] * devig(...x.m.o.avgC)[i] - 1;
    const bc = bestOf(x.m.o.close)[i]; if (bc) { nb++; clvB += b[0] / bc[0] - 1; } }
  console.log(`Βάση (όλες οι εκβάσεις): CLV ${(100 * clv / n).toFixed(1)}% · άνοιγμα καλύτερη / κλείσιμο καλύτερη ${(100 * clvB / nb).toFixed(1)}%`);
  for (const th of [0.05, 0.1]) { let k = 0, c = 0; for (const x of rows) for (let i = 0; i < 3; i++) { const b = x.best[i], bc = bestOf(x.m.o.close)[i]; if (!b || !bc) continue; if (x.pm[i] * b[0] - 1 > th) { k++; c += b[0] / bc[0] - 1; } } console.log(`EV>${th}: καλύτερη άνοιγμα / καλύτερη κλείσιμο ${(100 * c / k).toFixed(1)}% (${k})`); }
}
{ const grp = {};
  for (const x of rows) for (let i = 0; i < 3; i++) { const b = x.best[i], bc = bestOf(x.m.o.close)[i]; if (!b || !bc || !(x.pm[i] * b[0] - 1 > 0.05)) continue;
    const k = (i === 1 ? 'X' : b[0] < 2.2 ? 'fav' : b[0] < 4 ? 'mid' : 'dog'); const g = grp[k] ||= { n: 0, pr: 0, c: 0, mv: 0 };
    g.n++; g.pr += x.r === i ? b[0] - 1 : -1; g.c += b[0] * devig(...x.m.o.avgC)[i] - 1; g.mv += b[0] / bc[0] - 1; }
  for (const [k, g] of Object.entries(grp)) console.log(k, g.n, 'ROI', (100 * g.pr / g.n).toFixed(1), 'CLV', (100 * g.c / g.n).toFixed(1), 'move', (100 * g.mv / g.n).toFixed(1));
  // χωρίς επιλογή ανά ομάδα
  const base = {}; for (const x of rows) for (let i = 0; i < 3; i++) { const b = x.best[i], bc = bestOf(x.m.o.close)[i]; if (!b || !bc) continue; const k = (i === 1 ? 'X' : b[0] < 2.2 ? 'fav' : b[0] < 4 ? 'mid' : 'dog'); const g = base[k] ||= { n: 0, mv: 0, c: 0 }; g.n++; g.mv += b[0] / bc[0] - 1; g.c += b[0] * devig(...x.m.o.avgC)[i] - 1; }
  for (const [k, g] of Object.entries(base)) console.log('base', k, g.n, 'CLV', (100 * g.c / g.n).toFixed(1), 'move', (100 * g.mv / g.n).toFixed(1));
}
{ // στρατηγικές
  const test = (name, sel) => { let n = 0, pr = 0, c = 0; for (const x of rows) { if (!x.po) continue; for (let i = 0; i < 3; i++) { const b = x.best[i]; if (!b || !x.m.o.avgC) continue; if (sel(x, i, b[0])) { n++; pr += x.r === i ? b[0] - 1 : -1; c += b[0] * devig(...x.m.o.avgC)[i] - 1; } } } console.log(name.padEnd(34), n, 'ROI', (100 * pr / n).toFixed(1), 'CLV', (100 * c / n).toFixed(1)); };
  test('γηπεδούχος φαβορί >70%', (x, i) => i === 0 && x.po[0] > 0.7);
  test('γηπεδούχος φαβορί >60%', (x, i) => i === 0 && x.po[0] > 0.6);
  for (const w of [0.3, 0.5]) for (const th of [0.02, 0.05]) test(`μίξη ${w} μοντέλο, EV>${th}`, (x, i, p) => ((w * x.pm[i] + (1 - w) * x.po[i]) * p - 1) > th);
  test('μοντέλο EV>5%, απόδοση<4', (x, i, p) => x.pm[i] * p - 1 > 0.05 && p < 4);
  test('ισοπαλία, μοντέλο EV>5%', (x, i, p) => i === 1 && x.pm[i] * p - 1 > 0.05);
  test('όλα (χωρίς επιλογή)', () => true);
}
{ const by = {}; for (const x of rows) for (let i = 0; i < 3; i++) { const b = x.best[i]; if (!b || !x.m.o.avgC) continue; const p = b[0]; if (!(x.pm[i] * p - 1 > 0.05 && p < 4)) continue; const s = x.m.date.slice(0, 4) + (x.m.date.slice(5, 7) >= '07' ? 'a' : 'b'); const k = (x.m.date.slice(5, 7) >= '07' ? x.m.date.slice(0, 4) : String(+x.m.date.slice(0, 4) - 1)); const g = by[k] ||= { n: 0, pr: 0, X: 0, Xpr: 0 }; g.n++; g.pr += x.r === i ? p - 1 : -1; if (i === 1) { g.X++; g.Xpr += x.r === i ? p - 1 : -1; } }
  for (const [k, g] of Object.entries(by).sort()) console.log(k, g.n, 'ROI', (100 * g.pr / g.n).toFixed(1), '· ισοπαλίες', g.X, (100 * g.Xpr / (g.X || 1)).toFixed(1)); }
