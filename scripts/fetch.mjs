// Κατεβάζει τα CSV της Super League από το football-data.co.uk (τρέχουσα + προηγούμενη σεζόν, και το πρόγραμμα).
import fs from 'node:fs/promises';
import { seasonCode } from '../src/season.mjs';

const BASE = 'https://www.football-data.co.uk';
const now = new Date();
const cur = seasonCode(now), prev = seasonCode(new Date(now.getFullYear() - 1, now.getMonth(), 15));
const jobs = [[`/mmz4281/${cur}/G1.csv`, `data/G1-${cur}.csv`], [`/mmz4281/${prev}/G1.csv`, `data/G1-${prev}.csv`], ['/fixtures.csv', 'data/fixtures.csv']];
await fs.mkdir('data', { recursive: true });
for (const [url, file] of jobs) {
  const r = await fetch(BASE + url, { headers: { 'user-agent': 'superleague-gr/1.0' } });
  if (!r.ok) { console.error(`${url}: HTTP ${r.status}`); continue; }
  let t = (await r.text()).replace(/^﻿/, '');
  if (url === '/fixtures.csv') { const L = t.split(/\r?\n/); t = [L[0], ...L.filter(l => l.startsWith('G1,'))].join('\n') + '\n'; }
  await fs.writeFile(file, t);
  console.log(`${file}: ${t.split('\n').length - 2} γραμμές`);
}

// Πλήρη αρχεία (με αποδόσεις) για τις σεζόν από το 2016: για τον έλεγχο του μοντέλου. Κατεβαίνουν μία φορά.
await fs.mkdir('data/full', { recursive: true });
for (let y = 2016; ; y++) {
  const c = String(y % 100).padStart(2, '0') + String((y + 1) % 100).padStart(2, '0');
  if (c === prev || c === cur) break;
  const file = `data/full/G1-${c}.csv`;
  if (await fs.stat(file).then(() => true, () => false)) continue;
  const r = await fetch(`${BASE}/mmz4281/${c}/G1.csv`, { headers: { 'user-agent': 'superleague-gr/1.0' } });
  if (!r.ok) { console.error(`${c}: HTTP ${r.status}`); continue; }
  await fs.writeFile(file, (await r.text()).replace(/^\uFEFF/, ''));
  console.log(`${file} αποθηκεύτηκε`);
}
