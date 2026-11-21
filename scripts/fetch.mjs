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
