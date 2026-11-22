// Βοηθά η κίνηση των «έξυπνων χρημάτων» (Pinnacle / Betfair) το μοντέλο;
import fs from 'node:fs/promises';
import { marketXG, fit, predict, devig } from '../src/model.mjs';
import { oddsOf, bestOf } from '../src/odds.mjs';
const csv = t => { const L = t.replace(/^﻿/, '').trim().split(/\r?\n/).map(l => l.split(',')); return L.slice(1).map(r => Object.fromEntries(L[0].map((h, i) => [h, r[i] ?? '']))); };
const dateOf = d => { const [dd, mm, yy] = d.split('/'); return `${yy.length === 2 ? '20' + yy : yy}-${mm}-${dd}`; };
const files = [...(await fs.readdir('data/full')).map(f => 'full/' + f), ...(await fs.readdir('data')).filter(f => /^G1-\d{4}\.csv$/.test(f))].sort((a, b) => a.slice(-8).localeCompare(b.slice(-8)));
const M = [];
for (const f of files) for (const r of csv(await fs.readFile('data/' + f, 'utf8'))) { if (!r.HomeTeam || r.FTHG === '') continue; const o = oddsOf(r), m = { date: dateOf(r.Date), h: r.HomeTeam, a: r.AwayTeam, hg: +r.FTHG, ag: +r.FTAG, o }; m.odds = o.avgC || o.avgO; m.ou = o.ouC.Avg || o.ouO.Avg || []; m.mx = marketXG(m); M.push(m); }
M.sort((a, b) => a.date.localeCompare(b.date));
const cache = {}, R = [];
for (const m of M.filter(m => m.date >= '2018-08-01' && m.o.shO && m.o.avgO && m.o.avgC)) {
  const F = (cache[m.date] ||= fit(M, m.date)), p = predict(F, m.h, m.a);
  R.push({ m, r: m.hg > m.ag ? 0 : m.hg === m.ag ? 1 : 2, pm: [p.h, p.d, p.a], ao: devig(...m.o.avgO), ac: devig(...m.o.avgC), so: devig(...m.o.shO), sc: devig(...m.o.shC), bo: bestOf(m.o.open), bc: bestOf(m.o.close) });
}
const ll = f => -R.reduce((s, x) => s + Math.log(f(x)[x.r]), 0) / R.length;
const mix = (a, b, w) => a.map((v, i) => w * v + (1 - w) * b[i]);
const dist = f => R.reduce((s, x) => s + f(x).reduce((t, v, i) => t + Math.abs(v - x.sc[i]), 0) / 3, 0) / R.length;
console.log(`Αγώνες: ${R.length} (${R[0].m.date} – ${R.at(-1).m.date}), πηγή: ${[...new Set(R.map(x => x.m.o.sh))].join('/')}`);
console.log('\nΑΚΡΙΒΕΙΑ (log loss)');
for (const [n, f] of [['μοντέλο', x => x.pm], ['μέση αγορά άνοιγμα', x => x.ao], ['έξυπνα άνοιγμα', x => x.so], ['μέση αγορά κλείσιμο', x => x.ac], ['έξυπνα κλείσιμο', x => x.sc], ['50% μοντέλο + 50% έξυπνα άνοιγμα', x => mix(x.pm, x.so, 0.5)], ['30% μοντέλο + 70% έξυπνα άνοιγμα', x => mix(x.pm, x.so, 0.3)], ['20% μοντέλο + 80% έξυπνα κλείσιμο', x => mix(x.pm, x.sc, 0.2)]]) console.log(n.padEnd(36), ll(f).toFixed(4), '· απόσταση από έξυπνο κλείσιμο', (100 * dist(f)).toFixed(2));
// κίνηση: πιθανότητα έξυπνων άνοιγμα → κλείσιμο
const test = (n, sel, priceOf) => { let k = 0, pr = 0; for (const x of R) for (let i = 0; i < 3; i++) { const pz = priceOf(x, i); if (!pz || !sel(x, i, pz)) continue; k++; pr += x.r === i ? pz - 1 : -1; } console.log(n.padEnd(64), String(k).padStart(4), 'ROI', (100 * pr / (k || 1)).toFixed(1) + '%'); };
const ev = (x, i, p) => x.pm[i] * p - 1, mv = (x, i) => x.sc[i] - x.so[i];
const atOpen = (x, i) => x.bo[i]?.[0], atClose = (x, i) => x.bc[i]?.[0];
console.log('\nΣΤΟΙΧΗΜΑΤΑ (απόδοση < 4)');
test('Α. μοντέλο EV>5% στο άνοιγμα', (x, i, p) => p < 4 && ev(x, i, p) > 0.05, atOpen);
test('   ...και τα έξυπνα χρήματα πήγαν προς τα εκεί (εκ των υστέρων)', (x, i, p) => p < 4 && ev(x, i, p) > 0.05 && mv(x, i) > 0.01, atOpen);
test('   ...και τα έξυπνα χρήματα πήγαν αντίθετα (εκ των υστέρων)', (x, i, p) => p < 4 && ev(x, i, p) > 0.05 && mv(x, i) < -0.01, atOpen);
test('Β. στο κλείσιμο: μοντέλο EV>5% και κίνηση υπέρ (+1μ.)', (x, i, p) => p < 4 && ev(x, i, p) > 0.05 && mv(x, i) > 0.01, atClose);
test('Β2. στο κλείσιμο: μόνο κίνηση υπέρ > 3 μονάδες (χωρίς μοντέλο)', (x, i, p) => p < 4 && mv(x, i) > 0.03, atClose);
test('Γ. στο άνοιγμα: μοντέλο EV>5% και τα έξυπνα ήδη πιο χαμηλά από τη μέση', (x, i, p) => p < 4 && ev(x, i, p) > 0.05 && x.so[i] > x.ao[i] + 0.01, atOpen);
test('Γ2. στο άνοιγμα: τα έξυπνα πιο χαμηλά από τη μέση > 2 μον. (χωρίς μοντέλο)', (x, i, p) => p < 4 && x.so[i] > x.ao[i] + 0.02, atOpen);
test('Δ. στο άνοιγμα: μίξη 30/70 με έξυπνα, EV>3%', (x, i, p) => p < 4 && mix(x.pm, x.so, 0.3)[i] * p - 1 > 0.03, atOpen);
test('Ε. όλα (χωρίς επιλογή), άνοιγμα', (x, i, p) => p < 4, atOpen);
console.log('\nΑΝΤΟΧΗ ΤΟΥ Β');
const avgClose = (x, i) => x.m.o.avgC[i], shClose = (x, i) => x.m.o.shC[i];
for (const [e, d] of [[0.03, 0.01], [0.05, 0.005], [0.05, 0.01], [0.05, 0.02], [0.08, 0.01], [0, 0.01]]) test(`EV>${e}, κίνηση>${d} · καλύτερη κλείσιμο`, (x, i, p) => p < 4 && ev(x, i, p) > e && mv(x, i) > d, atClose);
test('EV>5%, κίνηση>1 · ΜΕΣΗ απόδοση κλεισίματος', (x, i, p) => p < 4 && ev(x, i, p) > 0.05 && mv(x, i) > 0.01, avgClose);
test('EV>5%, κίνηση>1 · απόδοση Pinnacle/Betfair κλεισίματος', (x, i, p) => p < 4 && ev(x, i, p) > 0.05 && mv(x, i) > 0.01, shClose);
test('EV>5%, κίνηση>1 · και αουτσάιντερ (χωρίς όριο 4)', (x, i, p) => ev(x, i, p) > 0.05 && mv(x, i) > 0.01, atClose);
// ανά σεζόν
const by = {}; for (const x of R) for (let i = 0; i < 3; i++) { const p = atClose(x, i); if (!p || !(p < 4 && ev(x, i, p) > 0.05 && mv(x, i) > 0.01)) continue; const y = +x.m.date.slice(0, 4) - (x.m.date.slice(5, 7) < '07'); const g = by[y] ||= { n: 0, pr: 0 }; g.n++; g.pr += x.r === i ? p - 1 : -1; }
console.log(Object.entries(by).map(([y, g]) => `${y}: ${g.n} στοιχ. ${(100 * g.pr / g.n).toFixed(0)}%`).join(' · '));
// τι είδους στοιχήματα
const ty = { 1: 0, X: 0, 2: 0 }; let sp = 0, nn = 0; for (const x of R) for (let i = 0; i < 3; i++) { const p = atClose(x, i); if (!p || !(p < 4 && ev(x, i, p) > 0.05 && mv(x, i) > 0.01)) continue; ty['1X2'[i]]++; sp += p; nn++; }
console.log('είδη', JSON.stringify(ty), 'μέση απόδοση', (sp / nn).toFixed(2));
// τυχαίο: πόσο πιθανό +36% σε 83 στοιχήματα από τύχη; προσομοίωση με τις πιθανότητες κλεισίματος
{ const bets = []; for (const x of R) for (let i = 0; i < 3; i++) { const p = atClose(x, i); if (p && p < 4 && ev(x, i, p) > 0.05 && mv(x, i) > 0.01) bets.push([x.sc[i], p]); }
  let hit = 0; const obs = bets.reduce((s, [q, p], k) => s, 0); const target = 0.364 * bets.length;
  for (let s = 0; s < 20000; s++) { let pr = 0; for (const [q, p] of bets) pr += Math.random() < q ? p - 1 : -1; if (pr >= target) hit++; }
  console.log(`Πιθανότητα να βγει τόσο κέρδος από τύχη (αν η τιμή κλεισίματος είναι «σωστή»): ${(100 * hit / 20000).toFixed(2)}%`); }
