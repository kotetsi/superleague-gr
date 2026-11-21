// Ιστορικό: όλες οι παλιές σεζόν της Super League (από το 1994) σε μικρό αρχείο data/history.csv.
// Οι ολοκληρωμένες σεζόν δεν αλλάζουν, οπότε κατεβαίνουν μόνο όσες λείπουν.
import fs from 'node:fs/promises';
import { seasonCode } from '../src/season.mjs';

const BASE = 'https://www.football-data.co.uk/mmz4281/';
const cur = seasonCode(new Date());
const prev = JSON.parse(await fs.readFile('data/history.json', 'utf8').catch(() => '{"seasons":{}}'));
const codes = [];
for (let y = 1993; ; y++) { const c = String(y % 100).padStart(2, '0') + String((y + 1) % 100).padStart(2, '0'); if (c === cur) break; codes.push(c); if (y > 2100) break; }
const csvRows = t => { const L = t.replace(/^﻿/, '').trim().split(/\r?\n/).map(l => l.split(',')); const H = L[0]; return L.slice(1).map(r => Object.fromEntries(H.map((h, i) => [h, r[i] ?? '']))); };
let added = 0;
for (const c of codes) {
  if (prev.seasons[c]) continue;
  const r = await fetch(BASE + c + '/G1.csv', { headers: { 'user-agent': 'superleague-gr/1.0' } });
  if (!r.ok) { console.log(`${c}: HTTP ${r.status}`); continue; }
  const rows = csvRows(await r.text()).filter(x => x.HomeTeam && x.FTHG !== '');
  // συμπαγής μορφή: ημερομηνία, γηπεδούχος, φιλοξενούμενος, γκολ, γκολ ημιχρόνου
  prev.seasons[c] = rows.map(x => [x.Date, x.HomeTeam, x.AwayTeam, +x.FTHG, +x.FTAG, x.HTHG === '' ? null : +x.HTHG, x.HTAG === '' ? null : +x.HTAG]);
  added++; console.log(`${c}: ${rows.length} αγώνες`);
  await new Promise(z => setTimeout(z, 400));
}
await fs.writeFile('data/history.json', JSON.stringify(prev));
console.log(`Ιστορικό: ${Object.keys(prev.seasons).length} σεζόν (${added} νέες)`);
