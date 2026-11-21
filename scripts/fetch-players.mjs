// Ρόστερ από την ενότητα "Current squad" της αγγλικής Wikipedia και βιογραφικά από το Wikidata.
// Γράφει data/players.json. Αν κάτι αποτύχει, κρατά το προηγούμενο αρχείο.
import fs from 'node:fs/promises';
import { WIKI } from '../src/teams.mjs';

const UA = { 'User-Agent': 'superleague-gr stats site (github.com/kotetsi/superleague-gr)' };
const getJ = async u => { for (let i = 0; i < 3; i++) { const r = await fetch(u, { headers: UA }); if (r.ok) return r.json(); await new Promise(z => setTimeout(z, 2000)); } throw new Error('HTTP ' + u); };
const WP = 'https://en.wikipedia.org/w/api.php?format=json&formatversion=2&';
const chunk = (a, n) => a.reduce((o, x, i) => (i % n ? o[o.length - 1].push(x) : o.push([x]), o), []);

const teams = (process.argv[2] ? process.argv[2].split(',') : Object.keys(WIKI));
const csv = await fs.readFile(`data/fixtures.csv`, 'utf8').catch(() => '');
const cur = (await fs.readdir('data')).filter(f => /^G1-\d{4}\.csv$/.test(f)).sort().pop();
const inLeague = new Set((await fs.readFile('data/' + cur, 'utf8')).split('\n').slice(1).flatMap(l => l.split(',').slice(3, 5)).concat(csv.split('\n').slice(1).flatMap(l => l.split(',').slice(3, 5))).filter(Boolean));

function parseSquad(w) {
  const a = w.search(/==+\s*(Current squad|First[- ]team squad|First team)\s*==+/i);
  if (a < 0) return [];
  const rest = w.slice(a).replace(/^==+[^\n]*\n/, '');
  const end = rest.search(/\n==[^=]|\n===\s*(Out on loan|Players out on loan|Reserve|Youth|B team|Under)/i);
  const sec = end < 0 ? rest : rest.slice(0, end);
  const out = [];
  for (const line of sec.split('\n')) {
    const m = line.match(/\{\{\s*[Ff]s player\s*\|(.*)\}\}\s*$/);
    if (!m) continue;
    const body = m[1].replace(/\{\{[^{}]*\}\}/g, '');
    const o = {};
    for (const kv of body.split('|').reduce((acc, p) => { if (/^\s*\w+\s*=/.test(p) || !acc.length) acc.push(p); else acc[acc.length - 1] += '|' + p; return acc; }, [])) {
      const i = kv.indexOf('='); if (i > 0) o[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
    }
    const link = (o.name || '').match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
    out.push({ no: o.no || '', pos: (o.pos || '').toUpperCase(), nat: (o.nat || '').toUpperCase(), name: link ? (link[2] || link[1]).trim() : (o.name || '').replace(/[[\]]/g, '').trim(), wiki: link ? link[1].trim() : null, loan: /loan/i.test(line) });
  }
  return out;
}

const prev = JSON.parse(await fs.readFile('data/players.json', 'utf8').catch(() => '{"teams":{}}'));
const res = { updated: new Date().toISOString().slice(0, 10), teams: { ...prev.teams } };
const all = [];
for (const t of teams) {
  if (!inLeague.has(t) && !process.argv[2]) continue;
  try {
    const j = await getJ(WP + 'action=parse&prop=wikitext|revid&redirects=1&page=' + encodeURIComponent(WIKI[t][0]));
    const sq = parseSquad(j.parse.wikitext);
    if (sq.length < 11) { console.log(`${t}: μόνο ${sq.length} παίκτες, κρατάω τα προηγούμενα`); continue; }
    res.teams[t] = { source: `https://en.wikipedia.org/wiki/${encodeURIComponent(j.parse.title.replace(/ /g, '_'))}`, players: sq };
    all.push(...sq);
    console.log(`${t}: ${sq.length} παίκτες`);
  } catch (e) { console.log(`${t}: σφάλμα ${e.message}`); }
}

// Wikipedia τίτλος → Wikidata QID
const titles = [...new Set(all.map(p => p.wiki).filter(Boolean))];
const qid = {};
for (const c of chunk(titles, 50)) {
  const j = await getJ(WP + 'action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&titles=' + encodeURIComponent(c.join('|')));
  const norm = {}; for (const n of [...(j.query.normalized || []), ...(j.query.redirects || [])]) norm[n.from] = n.to;
  const byT = Object.fromEntries((j.query.pages || []).filter(p => p.pageprops).map(p => [p.title, p.pageprops.wikibase_item]));
  for (const t of c) { let x = t; for (let k = 0; k < 3 && norm[x]; k++) x = norm[x]; if (byT[x]) qid[t] = byT[x]; }
}
// Wikidata οντότητες
const WD = 'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&languages=el|en&';
const ents = {};
const ids = [...new Set(Object.values(qid))];
for (const c of chunk(ids, 50)) Object.assign(ents, (await getJ(WD + 'props=labels|claims|sitelinks&sitefilter=elwiki&ids=' + c.join('|'))).entities);
const val = (e, p) => e?.claims?.[p]?.find(s => s.rank !== 'deprecated')?.mainsnak?.datavalue?.value;
const refs = new Set();
const info = {};
for (const [t, q] of Object.entries(qid)) {
  const e = ents[q]; if (!e) continue;
  const birth = val(e, 'P569')?.time?.slice(1, 11);
  const place = val(e, 'P19')?.id; if (place) refs.add(place);
  const h = val(e, 'P2048'); let height = h ? +h.amount : null; if (height && h.unit?.endsWith('Q11573')) height *= 100; if (height && height < 3) height *= 100;
  const clubs = (e.claims?.P54 || []).map(s => ({ id: s.mainsnak?.datavalue?.value?.id, from: s.qualifiers?.P580?.[0]?.datavalue?.value?.time?.slice(1, 5), to: s.qualifiers?.P582?.[0]?.datavalue?.value?.time?.slice(1, 5), loan: !!s.qualifiers?.P1642 })).filter(c => c.id);
  clubs.forEach(c => refs.add(c.id));
  info[t] = { q, el: e.labels?.el?.value || null, birth: birth && !birth.includes('-00') ? birth : birth?.slice(0, 4) || null, place, height: height ? Math.round(height) : null, clubs, elwiki: e.sitelinks?.elwiki?.title || null };
}
const lab = {};
for (const c of chunk([...refs], 50)) for (const [id, e] of Object.entries((await getJ(WD + 'props=labels|claims&ids=' + c.join('|'))).entities)) lab[id] = { el: e.labels?.el?.value, en: e.labels?.en?.value, youth: (e.claims?.P31 || []).some(s => ['Q103229495', 'Q20639856', 'Q3507245'].includes(s.mainsnak?.datavalue?.value?.id)) };
for (const T of Object.values(res.teams)) for (const p of T.players) {
  const i = info[p.wiki]; if (!i) continue;
  Object.assign(p, { q: i.q, el: i.el, birth: i.birth, height: i.height, elwiki: i.elwiki, place: i.place ? (lab[i.place]?.el || lab[i.place]?.en || null) : null,
    clubs: i.clubs.filter(c => lab[c.id] && !/national|U-?\d\d|under-\d\d|εθνική/i.test(lab[c.id].en || '')).map(c => ({ n: lab[c.id].el || lab[c.id].en, en: lab[c.id].en, from: c.from || null, to: c.to || null, loan: c.loan })),
    intl: i.clubs.some(c => /national (association )?football team$/i.test(lab[c.id]?.en || '') && !/under|U-?\d|youth|B$/i.test(lab[c.id]?.en || '')) });
}
await fs.writeFile('data/players.json', JSON.stringify(res, null, 1));
console.log(`Σύνολο: ${Object.values(res.teams).reduce((s, T) => s + T.players.length, 0)} παίκτες · με Wikidata ${Object.keys(info).length}`);
