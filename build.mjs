// Χτίζει το στατικό site στο dist/ από τα CSV του data/.
// SITE_URL: πλήρης διεύθυνση (για canonical/sitemap), SITE_BASE: διαδρομή βάσης (π.χ. /superleague-gr/ στο GitHub Pages).
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { grName, slugOf } from './src/teams.mjs';
import { seasonCode, seasonLabel } from './src/season.mjs';
import { marketXG, fit, predict, devig } from './src/model.mjs';

const SITE_URL = (process.env.SITE_URL || 'https://kotetsi.github.io/superleague-gr').replace(/\/$/, '');
const BASE = process.env.SITE_BASE ?? '/superleague-gr/';
const OUT = 'dist';
const NAME = 'Στατιστικά Super League';
const CSSV = createHash('md5').update(await fs.readFile('src/style.css')).digest('hex').slice(0, 8);
const TODAY = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);

// ---------- δεδομένα
function parseCSV(t) {
  const L = t.replace(/^﻿/, '').trim().split(/\r?\n/).map(l => l.split(','));
  const H = L[0];
  return L.slice(1).filter(r => r.length > 4).map(r => Object.fromEntries(H.map((h, i) => [h, r[i] ?? ''])));
}
const num = v => (v === '' || v == null ? null : +v);
const dateOf = d => { const [dd, mm, yy] = d.split('/'); return `${yy.length === 2 ? '20' + yy : yy}-${mm}-${dd}`; };
const first = (r, ...k) => { for (const x of k) if (r[x] !== undefined && r[x] !== '') return num(r[x]); return null; };

const cur = seasonCode(new Date(TODAY)), prevCode = seasonCode(new Date(new Date(TODAY).setFullYear(new Date(TODAY).getFullYear() - 1)));
async function loadSeason(code) {
  const t = await fs.readFile(`data/G1-${code}.csv`, 'utf8').catch(() => null);
  if (!t) return [];
  return parseCSV(t).filter(r => r.HomeTeam && r.FTHG !== '').map(r => {
    const m = {
      s: code, date: dateOf(r.Date), time: r.Time || '', h: r.HomeTeam, a: r.AwayTeam, hg: +r.FTHG, ag: +r.FTAG, hh: num(r.HTHG), ha: num(r.HTAG),
      hs: num(r.HS), as: num(r.AS), hst: num(r.HST), ast: num(r.AST), hc: num(r.HC), ac: num(r.AC), hy: num(r.HY), ay: num(r.AY), hr: num(r.HR), ar: num(r.AR), ref: r.Referee || '',
    };
    const o = [first(r, 'AvgCH', 'PSCH', 'AvgH', 'B365H'), first(r, 'AvgCD', 'PSCD', 'AvgD', 'B365D'), first(r, 'AvgCA', 'PSCA', 'AvgA', 'B365A')];
    m.odds = o.every(x => x > 1) ? o : null;
    m.ou = [first(r, 'AvgC>2.5', 'PC>2.5', 'Avg>2.5'), first(r, 'AvgC<2.5', 'PC<2.5', 'Avg<2.5')];
    m.mx = marketXG(m);
    return m;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}
const M = [...await loadSeason(prevCode), ...await loadSeason(cur)];
const CUR = M.filter(m => m.s === cur), PREV = M.filter(m => m.s === prevCode);
const fixRows = parseCSV(await fs.readFile('data/fixtures.csv', 'utf8').catch(() => 'Div\n'));
const F = fit(M, TODAY);
const FIX = fixRows.filter(r => r.HomeTeam).map(r => {
  const f = { date: dateOf(r.Date), time: r.Time || '', h: r.HomeTeam, a: r.AwayTeam };
  const o = [num(r.AvgH), num(r.AvgD), num(r.AvgA)], ou = [num(r['Avg>2.5']), num(r['Avg<2.5'])];
  f.odds = o.every(x => x > 1) ? o : null;
  f.mkt = f.odds ? devig(...f.odds) : null;
  f.mo = ou[0] && ou[1] ? devig(...ou)[0] : null;
  f.pred = predict(F, f.h, f.a);
  f.p = f.mkt ?? [f.pred.h, f.pred.d, f.pred.a];
  f.o25 = f.mo ?? f.pred.o25;
  return f;
}).filter(f => f.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

// ---------- στατιστικά
function teamStats(t, L) {
  const s = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, games: [], home: [0, 0, 0], away: [0, 0, 0], o25: 0, btts: 0, cs: 0, fts: 0, shots: 0, sot: 0, corners: 0, cards: 0, shA: 0, sotA: 0, cornA: 0, yel: 0, red: 0, ht: [0, 0], nh: 0, htW: 0, htD: 0, htL: 0, htft: {}, comeW: 0, comeD: 0, behind: 0, ahead: 0, leadLost: 0, leadDrew: 0, g2: [0, 0], both: 0, o05h: 0, o15: 0, o35: 0, wtn: 0, w2: 0, l2: 0, c95: 0, c105: 0, crd45: 0, nc: 0, nk: 0, nodds: 0, pW: 0, pX: 0, pL: 0, nou: 0, pO: 0, pU: 0, favN: 0, favW: 0, dogN: 0, dogW: 0, dogNL: 0, mor2h: 0, mor1h: 0 };
  for (const m of L.filter(m => m.h === t || m.a === t)) {
    const home = m.h === t, gf = home ? m.hg : m.ag, ga = home ? m.ag : m.hg, r = gf > ga ? 'W' : gf === ga ? 'D' : 'L';
    s.p++; s.gf += gf; s.ga += ga; s[{ W: 'w', D: 'd', L: 'l' }[r]]++; s.pts += { W: 3, D: 1, L: 0 }[r];
    s.games.push({ m, r, home, opp: home ? m.a : m.h });
    (home ? s.home : s.away)[{ W: 0, D: 1, L: 2 }[r]]++;
    s.o25 += m.hg + m.ag > 2; s.btts += m.hg > 0 && m.ag > 0; s.cs += ga === 0; s.fts += gf === 0;
    const g = (a, b) => (home ? m[a] : m[b]) ?? 0;
    s.shots += g('hs', 'as'); s.sot += g('hst', 'ast'); s.corners += g('hc', 'ac'); s.cards += g('hy', 'ay') + 2 * g('hr', 'ar'); s.yel += g('hy', 'ay'); s.red += g('hr', 'ar');
    s.shA += g('as', 'hs'); s.sotA += g('ast', 'hst'); s.cornA += g('ac', 'hc');
    const T = m.hg + m.ag; s.o15 += T > 1; s.o35 += T > 3; s.wtn += r === 'W' && ga === 0; s.w2 += gf - ga >= 2; s.l2 += ga - gf >= 2;
    if (m.hh != null && m.ha != null) {
      const hf = home ? m.hh : m.ha, ha = home ? m.ha : m.hh, hr = hf > ha ? 'W' : hf === ha ? 'D' : 'L';
      s.nh++; s['ht' + hr]++; const k = { W: '1', D: 'X', L: '2' }[hr] + '/' + { W: '1', D: 'X', L: '2' }[r]; s.htft[k] = (s.htft[k] || 0) + 1;
      if (hr === 'L') { s.behind++; s.comeW += r === 'W'; s.comeD += r === 'D'; }
      if (hr === 'W') { s.ahead++; s.leadLost += r === 'L'; s.leadDrew += r === 'D'; }
      s.g2[0] += gf - hf; s.g2[1] += ga - ha; s.both += hf > 0 && gf - hf > 0; s.o05h += m.hh + m.ha > 0;
      const h1 = m.hh + m.ha, h2 = T - h1; s.mor2h += h2 > h1; s.mor1h += h1 > h2;
    }
    if (m.hc != null && m.ac != null) { s.nc++; s.c95 += m.hc + m.ac > 9.5; s.c105 += m.hc + m.ac > 10.5; }
    if (m.hy != null && m.ay != null) { s.nk++; s.crd45 += m.hy + m.ay + (m.hr ?? 0) + (m.ar ?? 0) > 4.5; }
    if (m.odds) {
      const [oh, od, oa] = m.odds, ow = home ? oh : oa, ol = home ? oa : oh;
      s.nodds++; s.pW += r === 'W' ? ow - 1 : -1; s.pX += r === 'D' ? od - 1 : -1; s.pL += r === 'L' ? ol - 1 : -1;
      if (ow < ol) { s.favN++; s.favW += r === 'W'; } else { s.dogN++; s.dogW += r === 'W'; s.dogNL += r !== 'L'; }
    }
    if (m.ou[0] > 1 && m.ou[1] > 1) { s.nou++; s.pO += T > 2 ? m.ou[0] - 1 : -1; s.pU += T < 3 ? m.ou[1] - 1 : -1; }
    s.ht[0] += (home ? m.hh : m.ha) ?? 0; s.ht[1] += (home ? m.ha : m.hh) ?? 0;
  }
  s.games.reverse();
  return s;
}
const TEAMS = [...new Set(CUR.flatMap(m => [m.h, m.a]).concat(FIX.flatMap(f => [f.h, f.a])))];
const ST = Object.fromEntries(TEAMS.map(t => [t, { cur: teamStats(t, CUR), prev: teamStats(t, PREV) }]));
const TABLE = TEAMS.map(t => ({ t, ...ST[t].cur })).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || grName(a.t).localeCompare(grName(b.t)));
const LG = CUR.length ? { n: CUR.length, gpg: CUR.reduce((s, m) => s + m.hg + m.ag, 0) / CUR.length, home: CUR.filter(m => m.hg > m.ag).length / CUR.length, o25: CUR.filter(m => m.hg + m.ag > 2).length / CUR.length, btts: CUR.filter(m => m.hg && m.ag).length / CUR.length } : null;

// ---------- βοηθητικά HTML
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pc = x => Math.round(100 * x) + '%';
const f1 = x => (Number.isFinite(x) ? x.toFixed(1).replace('.', ',') : '–');
const per = (s, k) => (s.p ? f1(s[k] / s.p) : '–');
const DAYS = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
const MONTHS = ['Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'];
const dObj = s => new Date(s + 'T12:00:00Z');
const dShort = s => { const d = dObj(s); return `${DAYS[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };
const dLong = s => { const d = dObj(s); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const U = p => BASE + p;
const teamUrl = t => U(`omades/${slugOf(t)}/`);
const matchPath = m => `agones/${m.date}-${slugOf(m.h)}-${slugOf(m.a)}/`;
const tlink = t => `<a href="${teamUrl(t)}">${esc(grName(t))}</a>`;
const formHtml = L => `<span class="form" aria-label="Φόρμα">${L.map(r => `<i class="${r}" title="${{ W: 'Νίκη', D: 'Ισοπαλία', L: 'Ήττα' }[r]}">${{ W: 'Ν', D: 'Ι', L: 'Η' }[r]}</i>`).join('')}</span>`;
const strip = p => `<div class="strip" role="img" aria-label="1: ${pc(p[0])}, Χ: ${pc(p[1])}, 2: ${pc(p[2])}">${['ph', 'pd', 'pa'].map((c, i) => `<i class="${c}" style="width:${(100 * p[i]).toFixed(1)}%">${p[i] > 0.12 ? pc(p[i]) : ''}</i>`).join('')}</div>`;

const pages = [];
function page(p, { title, desc, body, ld = [], crumbs = [] }) {
  const url = SITE_URL + '/' + p;
  const bc = crumbs.length ? [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [['Αρχική', ''], ...crumbs].map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE_URL + '/' + u })) }] : [];
  const html = `<!DOCTYPE html>
<html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:type" content="website"><meta property="og:locale" content="el_GR">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Sans+Condensed:wght@600;800&family=Fira+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${U('assets/style.css')}?v=${CSSV}">
${[...bc, ...ld].map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head><body>
<header class="top"><div class="wrap"><a class="brand" href="${U('')}">Στατιστικά <b>Super League</b></a>
<nav aria-label="Κύριο μενού"><a href="${U('')}">Αγωνιστική</a><a href="${U('vathmologia/')}">Βαθμολογία</a><a href="${U('programma/')}">Πρόγραμμα</a><a href="${U('apotelesmata/')}">Αποτελέσματα</a><a href="${U('omades/')}">Ομάδες</a><a href="${U('statistika/')}">Στατιστικά</a><a href="${U('paixnidi/')}">Παιχνίδι</a><a href="${U('kouiz/')}">Κουίζ</a></nav></div></header>
<main>${crumbs.length ? body.replace('<!--crumbs-->', `<div class="crumbs"><a href="${U('')}">Αρχική</a>${crumbs.map(([n, u], i) => i === crumbs.length - 1 ? ` › ${esc(n)}` : ` › <a href="${U(u)}">${esc(n)}</a>`).join('')}</div>`) : body}</main>
<footer class="band"><div class="wrap"><p>${NAME} · Super League ${seasonLabel(cur)} · ενημέρωση ${dLong(TODAY)}.</p>
<p>Δεδομένα: football-data.co.uk. Τα ποσοστά 1-Χ-2 και over/under είναι οι μέσες αποδόσεις της αγοράς χωρίς γκανιότα· τα αναμενόμενα γκολ και τα πιθανότερα σκορ βγαίνουν από μοντέλο γκολ (Dixon-Coles). Δεν αποτελούν συμβουλή στοιχήματος. 21+ · Παίξε υπεύθυνα.</p></div></footer>
</body></html>`;
  pages.push([p, html]);
}


// ---------- κατατάξεις στατιστικών ομάδων
const PG = k => s => (s.p ? s[k] / s.p : null), PCT = k => s => (s.p ? s[k] / s.p : null);
const STATS = [
  { g: 'Γκολ', slug: 'gkol', name: 'Γκολ ανά αγώνα', h: 'Επιθέσεις: γκολ ανά αγώνα', v: PG('gf'), d: 2, tot: s => `${s.gf} γκολ`, about: 'Πόσα γκολ σκοράρει κατά μέσο όρο κάθε ομάδα σε έναν αγώνα πρωταθλήματος.' },
  { g: 'Γκολ', slug: 'gkol-kata', name: 'Γκολ που δέχεται', h: 'Άμυνες: γκολ που δέχεται ανά αγώνα', v: PG('ga'), d: 2, asc: true, tot: s => `${s.ga} γκολ`, about: 'Πόσα γκολ δέχεται κατά μέσο όρο κάθε ομάδα. Η καλύτερη άμυνα είναι πρώτη.' },
  { g: 'Γκολ', slug: 'anepafi-estia', name: 'Ανέπαφη εστία', h: 'Αγώνες με ανέπαφη εστία', v: PCT('cs'), d: 0, tot: s => `${s.cs} ${s.cs === 1 ? 'αγώνας' : 'αγώνες'}`, about: 'Σε τι ποσοστό των αγώνων της κάθε ομάδα δεν δέχτηκε γκολ (clean sheets).' },
  { g: 'Γκολ', slug: 'over-2-5', name: 'Over 2,5', h: 'Over 2,5 γκολ ανά ομάδα', v: PCT('o25'), d: 0, tot: s => `${s.o25}/${s.p}`, about: 'Σε τι ποσοστό των αγώνων κάθε ομάδας μπήκαν 3 ή περισσότερα γκολ.' },
  { g: 'Γκολ', slug: 'goal-goal', name: 'Γκολ-γκολ', h: 'Γκολ-γκολ: σκόραραν και οι δύο ομάδες', v: PCT('btts'), d: 0, tot: s => `${s.btts}/${s.p}`, about: 'Σε τι ποσοστό των αγώνων κάθε ομάδας σκόραραν και οι δύο αντίπαλοι (Γκολ-Γκολ / BTTS).' },
  { g: 'Ημίχρονα', slug: 'gkol-imixrono', name: 'Γκολ στο 1ο ημίχρονο', h: 'Γκολ στο πρώτο ημίχρονο', v: s => (s.p ? s.ht[0] / s.p : null), d: 2, tot: s => `${s.ht[0]} γκολ (δέχτηκε ${s.ht[1]})`, about: 'Πόσα γκολ σκοράρει κάθε ομάδα στο πρώτο ημίχρονο ανά αγώνα.' },
  { g: 'Σουτ', slug: 'sout', name: 'Σουτ ανά αγώνα', h: 'Σουτ ανά αγώνα', v: PG('shots'), d: 1, tot: s => `${s.shots} σουτ`, about: 'Πόσα σουτ επιχειρεί κάθε ομάδα κατά μέσο όρο σε έναν αγώνα.' },
  { g: 'Σουτ', slug: 'sout-estia', name: 'Σουτ στην εστία', h: 'Σουτ στην εστία ανά αγώνα', v: PG('sot'), d: 1, tot: s => `${s.sot} σουτ στην εστία`, about: 'Πόσα σουτ στο τέρμα (εντός εστίας) έχει κάθε ομάδα ανά αγώνα.' },
  { g: 'Σουτ', slug: 'eustoxia', name: 'Ευστοχία σουτ', h: 'Ευστοχία: σουτ στην εστία προς σύνολο σουτ', v: s => (s.shots ? s.sot / s.shots : null), d: 0, tot: s => `${s.sot}/${s.shots}`, about: 'Τι ποσοστό των σουτ κάθε ομάδας βρίσκει τον στόχο.' },
  { g: 'Σουτ', slug: 'sout-antipalon', name: 'Σουτ που δέχεται', h: 'Σουτ που επιτρέπει στους αντιπάλους', v: PG('shA'), d: 1, asc: true, tot: s => `${s.shA} σουτ`, about: 'Πόσα σουτ αφήνει κάθε ομάδα να κάνουν οι αντίπαλοί της ανά αγώνα. Πρώτη η ομάδα που επιτρέπει τα λιγότερα.' },
  { g: 'Κόρνερ', slug: 'korner', name: 'Κόρνερ ανά αγώνα', h: 'Κόρνερ ανά αγώνα', v: PG('corners'), d: 1, tot: s => `${s.corners} κόρνερ`, about: 'Πόσα κόρνερ κερδίζει κάθε ομάδα κατά μέσο όρο σε έναν αγώνα.' },
  { g: 'Κόρνερ', slug: 'korner-kata', name: 'Κόρνερ που δέχεται', h: 'Κόρνερ που δίνει στους αντιπάλους', v: PG('cornA'), d: 1, asc: true, tot: s => `${s.cornA} κόρνερ`, about: 'Πόσα κόρνερ παραχωρεί κάθε ομάδα ανά αγώνα. Πρώτη η ομάδα που δίνει τα λιγότερα.' },
  { g: 'Κόρνερ', slug: 'synolika-korner', name: 'Συνολικά κόρνερ αγώνα', h: 'Συνολικά κόρνερ στους αγώνες κάθε ομάδας', v: s => (s.p ? (s.corners + s.cornA) / s.p : null), d: 1, tot: s => `${s.corners + s.cornA} κόρνερ`, about: 'Πόσα κόρνερ (και των δύο ομάδων) γίνονται κατά μέσο όρο στους αγώνες κάθε ομάδας. Χρήσιμο για τις αγορές συνόλου κόρνερ.' },
  { g: 'Κάρτες', slug: 'kitrines', name: 'Κίτρινες κάρτες', h: 'Κίτρινες κάρτες ανά αγώνα', v: PG('yel'), d: 1, tot: s => `${s.yel} κίτρινες`, about: 'Πόσες κίτρινες κάρτες δέχεται κάθε ομάδα κατά μέσο όρο ανά αγώνα.' },
  { g: 'Κάρτες', slug: 'kokkines', name: 'Κόκκινες κάρτες', h: 'Κόκκινες κάρτες', v: s => (s.p ? s.red : null), d: 0, int: true, tot: s => `σε ${s.p} αγώνες`, about: 'Πόσες κόκκινες κάρτες (και δεύτερες κίτρινες) έχει δεχτεί κάθε ομάδα στη σεζόν.' },
  { g: 'Βαθμοί', slug: 'edra', name: 'Βαθμοί εντός έδρας', h: 'Βαθμοί ανά αγώνα εντός έδρας', v: s => { const n = s.home[0] + s.home[1] + s.home[2]; return n ? (3 * s.home[0] + s.home[1]) / n : null; }, d: 2, tot: s => `${s.home.join('-')} (Ν-Ι-Η)`, about: 'Πόσους βαθμούς παίρνει κάθε ομάδα ανά αγώνα στο γήπεδό της.' },
  { g: 'Βαθμοί', slug: 'ektos-edras', name: 'Βαθμοί εκτός έδρας', h: 'Βαθμοί ανά αγώνα εκτός έδρας', v: s => { const n = s.away[0] + s.away[1] + s.away[2]; return n ? (3 * s.away[0] + s.away[1]) / n : null; }, d: 2, tot: s => `${s.away.join('-')} (Ν-Ι-Η)`, about: 'Πόσους βαθμούς παίρνει κάθε ομάδα ανά αγώνα μακριά από την έδρα της.' },
  { g: 'Βαθμοί', slug: 'forma', name: 'Φόρμα 5 αγώνων', h: 'Φόρμα: βαθμοί στους 5 τελευταίους αγώνες', v: s => (s.p ? s.games.slice(0, 5).reduce((a, g) => a + { W: 3, D: 1, L: 0 }[g.r], 0) : null), d: 0, int: true, tot: s => formHtml(s.games.slice(0, 5).map(g => g.r)), raw: true, about: 'Πόσους βαθμούς μάζεψε κάθε ομάδα στους πέντε πιο πρόσφατους αγώνες της (μέγιστο 15).' },
  { g: 'Ημίχρονα', slug: 'niki-imixrono', name: 'Νίκη στο ημίχρονο', h: 'Προηγείται στο ημίχρονο', v: s => (s.nh ? s.htW / s.nh : null), d: 0, tot: s => `${s.htW}/${s.nh}`, about: 'Σε τι ποσοστό των αγώνων της κάθε ομάδα προηγείται στο τέλος του πρώτου ημιχρόνου (αγορά «Ημίχρονο: 1/2»).' },
  { g: 'Ημίχρονα', slug: 'isopalia-imixrono', name: 'Ισοπαλία στο ημίχρονο', h: 'Ισοπαλία στο ημίχρονο', v: s => (s.nh ? s.htD / s.nh : null), d: 0, tot: s => `${s.htD}/${s.nh}`, about: 'Σε τι ποσοστό των αγώνων κάθε ομάδας το πρώτο ημίχρονο λήγει ισόπαλο (αγορά «Ημίχρονο: Χ»).' },
  { g: 'Ημίχρονα', slug: 'gkol-2o-imixrono', name: 'Γκολ στο 2ο ημίχρονο', h: 'Γκολ στο δεύτερο ημίχρονο', v: s => (s.nh ? s.g2[0] / s.nh : null), d: 2, tot: s => `${s.g2[0]} γκολ (δέχτηκε ${s.g2[1]})`, about: 'Πόσα γκολ σκοράρει κάθε ομάδα στο δεύτερο ημίχρονο ανά αγώνα.' },
  { g: 'Ημίχρονα', slug: 'over-0-5-imixrono', name: 'Over 0,5 στο ημίχρονο', h: 'Γκολ στο πρώτο ημίχρονο (Over 0,5 ημιχρόνου)', v: s => (s.nh ? s.o05h / s.nh : null), d: 0, tot: s => `${s.o05h}/${s.nh}`, about: 'Σε τι ποσοστό των αγώνων κάθε ομάδας μπήκε τουλάχιστον ένα γκολ στο πρώτο ημίχρονο.' },
  { g: 'Ημίχρονα', slug: 'perissotera-gkol-2o', name: 'Περισσότερα γκολ στο 2ο', h: 'Ημίχρονο με τα περισσότερα γκολ: το δεύτερο', v: s => (s.nh ? s.mor2h / s.nh : null), d: 0, tot: s => `${s.mor2h}/${s.nh} (1ο: ${s.mor1h})`, about: 'Σε τι ποσοστό των αγώνων κάθε ομάδας το δεύτερο ημίχρονο είχε περισσότερα γκολ από το πρώτο (αγορά «Ημίχρονο με τα περισσότερα γκολ»).' },
  { g: 'Ημίχρονα', slug: 'skorarei-kai-sta-dyo', name: 'Σκοράρει και στα 2 ημίχρονα', h: 'Σκοράρει και στα δύο ημίχρονα', v: s => (s.nh ? s.both / s.nh : null), d: 0, tot: s => `${s.both}/${s.nh}`, about: 'Σε τι ποσοστό των αγώνων της κάθε ομάδα σκόραρε και στο πρώτο και στο δεύτερο ημίχρονο.' },
  { g: 'Ανατροπές', slug: 'anatropes', name: 'Ανατροπές', h: 'Ανατροπές: από χαμένη στο ημίχρονο σε νίκη', v: s => (s.nh ? s.comeW : null), d: 0, int: true, tot: s => `${s.comeW} ${s.comeW === 1 ? 'νίκη' : 'νίκες'}, ${s.comeD} ${s.comeD === 1 ? 'ισοπαλία' : 'ισοπαλίες'} σε ${s.behind} αγώνες που έχανε στο ημίχρονο`, about: 'Πόσες φορές κάθε ομάδα έχανε στο ημίχρονο και τελικά κέρδισε (αγορά Ημίχρονο/Τελικό 2/1 ή 1/2).' },
  { g: 'Ανατροπές', slug: 'vathmoi-apo-meion', name: 'Βαθμοί από μειονέκτημα', h: 'Βαθμοί όταν έχανε στο ημίχρονο', v: s => (s.behind ? (3 * s.comeW + s.comeD) / s.behind : null), d: 2, tot: s => `${s.comeW}-${s.comeD}-${s.behind - s.comeW - s.comeD} σε ${s.behind}`, about: 'Πόσους βαθμούς ανά αγώνα παίρνει κάθε ομάδα όταν πηγαίνει στα αποδυτήρια χάνοντας. Δείχνει ποιες ομάδες «γυρίζουν» τα ματς.' },
  { g: 'Ανατροπές', slug: 'xamena-provadismata', name: 'Χαμένα προβαδίσματα', h: 'Χαμένα προβαδίσματα: προηγούνταν στο ημίχρονο αλλά δεν κέρδισαν', v: s => (s.nh ? s.leadLost + s.leadDrew : null), d: 0, int: true, tot: s => `${s.leadDrew} ${s.leadDrew === 1 ? 'ισοπαλία' : 'ισοπαλίες'}, ${s.leadLost} ${s.leadLost === 1 ? 'ήττα' : 'ήττες'} σε ${s.ahead} αγώνες που προηγούνταν`, about: 'Πόσες φορές κάθε ομάδα προηγούνταν στο ημίχρονο αλλά δεν κράτησε τη νίκη.' },
  { g: 'Ανατροπές', slug: 'kratame-provadisma', name: 'Κρατάει το προβάδισμα', h: 'Νίκες όταν προηγείται στο ημίχρονο', v: s => (s.ahead ? (s.ahead - s.leadLost - s.leadDrew) / s.ahead : null), d: 0, tot: s => `${s.ahead - s.leadLost - s.leadDrew}/${s.ahead}`, about: 'Τι ποσοστό των αγώνων στους οποίους προηγείται στο ημίχρονο καταλήγει σε νίκη για κάθε ομάδα (Ημίχρονο/Τελικό 1/1 ή 2/2).' },
  { g: 'Γκολ', slug: 'over-1-5', name: 'Over 1,5', h: 'Over 1,5 γκολ ανά ομάδα', v: PCT('o15'), d: 0, tot: s => `${s.o15}/${s.p}`, about: 'Σε τι ποσοστό των αγώνων κάθε ομάδας μπήκαν 2 ή περισσότερα γκολ.' },
  { g: 'Γκολ', slug: 'over-3-5', name: 'Over 3,5', h: 'Over 3,5 γκολ ανά ομάδα', v: PCT('o35'), d: 0, tot: s => `${s.o35}/${s.p}`, about: 'Σε τι ποσοστό των αγώνων κάθε ομάδας μπήκαν 4 ή περισσότερα γκολ.' },
  { g: 'Γκολ', slug: 'niki-xoris-gkol-kata', name: 'Νίκη χωρίς παθητικό', h: 'Νίκη χωρίς να δεχτεί γκολ (win to nil)', v: PCT('wtn'), d: 0, tot: s => `${s.wtn}/${s.p}`, about: 'Σε τι ποσοστό των αγώνων της κάθε ομάδα κέρδισε χωρίς να δεχτεί γκολ.' },
  { g: 'Γκολ', slug: 'niki-me-2', name: 'Νίκη με 2+ γκολ διαφορά', h: 'Νίκες με διαφορά 2 ή περισσότερων γκολ (χάντικαπ -1,5)', v: PCT('w2'), d: 0, tot: s => `${s.w2}/${s.p}`, about: 'Σε τι ποσοστό των αγώνων της κάθε ομάδα κέρδισε με τουλάχιστον δύο γκολ διαφορά. Αντιστοιχεί στο ασιατικό χάντικαπ -1,5.' },
  { g: 'Κόρνερ', slug: 'over-9-5-korner', name: 'Over 9,5 κόρνερ', h: 'Αγώνες με 10+ κόρνερ', v: s => (s.nc ? s.c95 / s.nc : null), d: 0, tot: s => `${s.c95}/${s.nc}`, about: 'Σε τι ποσοστό των αγώνων κάθε ομάδας έγιναν συνολικά 10 ή περισσότερα κόρνερ.' },
  { g: 'Κάρτες', slug: 'over-4-5-kartes', name: 'Over 4,5 κάρτες', h: 'Αγώνες με 5+ κάρτες', v: s => (s.nk ? s.crd45 / s.nk : null), d: 0, tot: s => `${s.crd45}/${s.nk}`, about: 'Σε τι ποσοστό των αγώνων κάθε ομάδας δόθηκαν συνολικά 5 ή περισσότερες κάρτες (κίτρινες και κόκκινες, και των δύο ομάδων).' },
  { g: 'Κέρδος', slug: 'kerdos-niki', name: 'Κέρδος: νίκη ομάδας', h: 'Κέρδος αν πόνταρες 1 € στη νίκη της σε κάθε αγώνα', v: s => (s.nodds ? s.pW : null), d: 2, eur: true, tot: s => `σε ${s.nodds} αγώνες · ROI ${s.nodds ? (s.pW > 0 ? '+' : '') + pc(s.pW / s.nodds) : '–'}`, about: 'Πόσα ευρώ θα είχες κερδίσει ή χάσει αν πόνταρες 1 € στη νίκη κάθε ομάδας σε κάθε αγώνα της, στις μέσες αποδόσεις κλεισίματος. Θετικό σημαίνει ότι η αγορά υποτίμησε την ομάδα.' },
  { g: 'Κέρδος', slug: 'kerdos-isopalia', name: 'Κέρδος: ισοπαλία', h: 'Κέρδος αν πόνταρες 1 € στην ισοπαλία σε κάθε αγώνα της', v: s => (s.nodds ? s.pX : null), d: 2, eur: true, tot: s => `${s.d} ισοπαλίες σε ${s.nodds} αγώνες`, about: 'Πόσα ευρώ θα είχες κερδίσει ή χάσει πονταροντας 1 € στην ισοπαλία σε κάθε αγώνα της ομάδας, στις μέσες αποδόσεις κλεισίματος.' },
  { g: 'Κέρδος', slug: 'kerdos-over', name: 'Κέρδος: Over 2,5', h: 'Κέρδος αν πόνταρες 1 € στο Over 2,5 σε κάθε αγώνα της', v: s => (s.nou ? s.pO : null), d: 2, eur: true, tot: s => `σε ${s.nou} αγώνες`, about: 'Πόσα ευρώ θα είχες κερδίσει ή χάσει πονταροντας 1 € στο Over 2,5 σε κάθε αγώνα της ομάδας, στις μέσες αποδόσεις κλεισίματος.' },
  { g: 'Κέρδος', slug: 'kerdos-under', name: 'Κέρδος: Under 2,5', h: 'Κέρδος αν πόνταρες 1 € στο Under 2,5 σε κάθε αγώνα της', v: s => (s.nou ? s.pU : null), d: 2, eur: true, tot: s => `σε ${s.nou} αγώνες`, about: 'Πόσα ευρώ θα είχες κερδίσει ή χάσει πονταροντας 1 € στο Under 2,5 σε κάθε αγώνα της ομάδας, στις μέσες αποδόσεις κλεισίματος.' },
  { g: 'Κέρδος', slug: 'favori', name: 'Νίκες ως φαβορί', h: 'Πόσο συχνά κερδίζει όταν είναι φαβορί', v: s => (s.favN ? s.favW / s.favN : null), d: 0, tot: s => `${s.favW}/${s.favN}`, about: 'Σε τι ποσοστό των αγώνων όπου η αγορά την είχε φαβορί κέρδισε κάθε ομάδα.' },
  { g: 'Κέρδος', slug: 'aoutsaider', name: 'Αήττητη ως αουτσάιντερ', h: 'Αποτελέσματα όταν δεν είναι φαβορί (διπλή ευκαιρία)', v: s => (s.dogN ? s.dogNL / s.dogN : null), d: 0, tot: s => `${s.dogW} νίκες, ${s.dogNL - s.dogW} ισοπαλίες σε ${s.dogN}`, about: 'Σε τι ποσοστό των αγώνων όπου η αγορά δεν την είχε φαβορί κάθε ομάδα απέφυγε την ήττα.' },
];
const sval = (st, v) => (v == null ? '–' : st.eur ? (v > 0 ? '+' : '') + v.toFixed(2).replace('.', ',') + ' €' : st.int ? String(v) : st.d === 0 && !st.int ? pc(v) : v.toFixed(st.d).replace('.', ','));
const RANK = Object.fromEntries(STATS.map(st => {
  const L = TEAMS.map(t => ({ t, s: ST[t].cur, v: st.v(ST[t].cur) })).filter(r => r.v != null).sort((a, b) => (st.asc ? a.v - b.v : b.v - a.v) || grName(a.t).localeCompare(grName(b.t)));
  L.forEach((r, i) => { r.pos = i && L[i - 1].v === r.v ? L[i - 1].pos : i + 1; });
  return [st.slug, L];
}));
const GROUPS = ['Γκολ', 'Ημίχρονα', 'Ανατροπές', 'Κέρδος', 'Κόρνερ', 'Κάρτες', 'Σουτ', 'Βαθμοί'];
const GDESC = { 'Κέρδος': 'Τι θα είχες κερδίσει ή χάσει πονταροντας 1 € σε κάθε αγώνα κάθε ομάδας, στις μέσες αποδόσεις κλεισίματος. Οι παλιές αποδόσεις δεν εγγυώνται το μέλλον.', 'Ανατροπές': 'Από το σκορ ημιχρόνου και το τελικό: ποιος γυρίζει τα ματς και ποιος χάνει προβαδίσματα.' };
const gid = g => ({ 'Γκολ': 'gkol', 'Ημίχρονα': 'imixrona', 'Ανατροπές': 'anatropes', 'Κέρδος': 'kerdos', 'Κόρνερ': 'korner', 'Κάρτες': 'kartes', 'Σουτ': 'sout', 'Βαθμοί': 'vathmoi' }[g]);
const statUrl = st => U(`statistika/${st.slug}/`);
const statBars = (st, L) => { const mx = Math.max(...L.map(r => Math.abs(r.v))) || 1; return `<div class="rows">${L.map(r => `<div class="row"><span>${r.pos}. ${tlink(r.t)}</span><div class="bar"><i style="width:${(100 * Math.abs(r.v) / mx).toFixed(0)}%${r.v < 0 ? ';background:#c8402f' : ''}"></i></div><span class="v">${sval(st, r.v)}</span></div>`).join('')}</div>`; };

// ---------- σελίδες
const fxRow = f => `<a class="fx" href="${U(matchPath(f))}"><div class="when"><b>${dShort(f.date)}</b>${esc(f.time)}</div><div class="teams"><span>${esc(grName(f.h))}</span><span>${esc(grName(f.a))}</span></div><div class="prob">${strip(f.p)}<div class="legend"><span>1</span><span>X</span><span>2</span></div></div><div class="score">${f.pred.top[0][0]}<small>πιθανότερο σκορ</small></div></a>`;
function tableHtml() {
  return `<div class="scroll"><table><thead><tr><th></th><th class="l">Ομάδα</th><th>Αγ</th><th class="hide-s">Ν</th><th class="hide-s">Ι</th><th class="hide-s">Η</th><th>Γκολ</th><th>Β</th><th class="l hide-s">Φόρμα</th></tr></thead><tbody>${TABLE.map((r, i) => `<tr class="${i < 4 ? 'cl' : ''}"><td class="pos">${i + 1}</td><td class="l team">${tlink(r.t)}</td><td>${r.p}</td><td class="hide-s">${r.w}</td><td class="hide-s">${r.d}</td><td class="hide-s">${r.l}</td><td>${r.gf}:${r.ga}</td><td><b>${r.pts}</b></td><td class="l hide-s">${formHtml(r.games.slice(0, 5).map(g => g.r))}</td></tr>`).join('')}</tbody></table></div><p class="note">Κανονική περίοδος ${seasonLabel(cur)}. Φόρμα: οι 5 τελευταίοι αγώνες, ο πιο πρόσφατος αριστερά.</p>`;
}
const nextRound = FIX.filter(f => dObj(f.date) - dObj(FIX[0]?.date || TODAY) < 5 * 864e5);
const roundNo = Math.round(CUR.length / Math.max(1, Math.floor(TEAMS.length / 2))) + 1;

page('', {
  title: `Super League ${seasonLabel(cur)}: στατιστικά, βαθμολογία, προγνωστικά | ${NAME}`,
  desc: `Στατιστικά της Super League ${seasonLabel(cur)}: βαθμολογία, φόρμα, πιθανότητες για κάθε αγώνα της ${roundNo}ης αγωνιστικής, γκολ, κόρνερ και κάρτες ομάδων.`,
  body: `<section class="hero band"><div class="wrap"><h1>${nextRound.length ? `${roundNo}η αγωνιστική: τι λένε τα νούμερα` : `Super League ${seasonLabel(cur)}`}</h1>
<p class="sub">Πιθανότητες για κάθε αγώνα, φόρμα και στατιστικά ομάδων. Πάτα έναν αγώνα για την ανάλυση.</p>
<div class="board">${nextRound.map(fxRow).join('') || '<p>Δεν υπάρχουν προγραμματισμένοι αγώνες αυτή τη στιγμή.</p>'}</div>
<p class="note">Πράσινο: γηπεδούχος · γκρι: ισοπαλία · μπλε: φιλοξενούμενος.</p>${nextRound.length ? `<p><a class="btn" href="${U('paixnidi/')}">Νομίζεις ότι ξέρεις καλύτερα; Νίκησε το μοντέλο →</a></p>` : ''}</div></section>
<section class="band"><div class="wrap cols"><div><h2>Βαθμολογία</h2>${tableHtml()}</div><div><h2>Η σεζόν σε αριθμούς</h2>
${LG ? `<div class="figs" style="margin-top:0"><div class="fig1"><b>${f1(LG.gpg)}</b><span>γκολ ανά αγώνα</span></div><div class="fig1"><b>${pc(LG.home)}</b><span>νίκες γηπεδούχων</span></div><div class="fig1"><b>${pc(LG.o25)}</b><span>αγώνες με 3+ γκολ</span></div><div class="fig1"><b>${pc(LG.btts)}</b><span>σκόραραν και οι δύο</span></div></div>
<h3>Over 2,5 ανά ομάδα</h3><div class="rows">${TEAMS.map(t => [t, ST[t].cur.p ? ST[t].cur.o25 / ST[t].cur.p : 0]).sort((a, b) => b[1] - a[1]).map(([t, v]) => `<div class="row">${tlink(t)}<div class="bar"><i style="width:${(100 * v).toFixed(0)}%"></i></div><span class="v">${pc(v)}</span></div>`).join('')}</div><p class="note">${LG.n} αγώνες.</p>` : ''}
</div></div></section>`,
});

page('vathmologia/', {
  title: `Βαθμολογία Super League ${seasonLabel(cur)} | ${NAME}`,
  desc: `Η βαθμολογία της Super League ${seasonLabel(cur)} με νίκες, ισοπαλίες, ήττες, γκολ και φόρμα κάθε ομάδας.`,
  crumbs: [['Βαθμολογία', 'vathmologia/']],
  body: `<section class="hero band"><div class="wrap"><!--crumbs--><h1>Βαθμολογία Super League ${seasonLabel(cur)}</h1><p class="sub">Μετά από ${CUR.length} αγώνες. Ενημέρωση ${dLong(TODAY)}.</p></div></section><section class="band"><div class="wrap">${tableHtml()}</div></section>`,
});

page('programma/', {
  title: `Πρόγραμμα Super League: επόμενοι αγώνες και πιθανότητες | ${NAME}`,
  desc: 'Το πρόγραμμα των επόμενων αγώνων της Super League με ημέρα, ώρα και πιθανότητες 1-Χ-2.',
  crumbs: [['Πρόγραμμα', 'programma/']],
  body: `<section class="hero band"><div class="wrap"><!--crumbs--><h1>Πρόγραμμα Super League</h1><div class="board">${FIX.map(fxRow).join('') || '<p>Δεν έχει ανακοινωθεί πρόγραμμα.</p>'}</div></div></section>`,
});

const resTable = L => `<div class="scroll"><table><thead><tr><th class="l">Ημ/νία</th><th class="l">Γηπεδούχος</th><th>Σκορ</th><th class="l">Φιλοξενούμενος</th><th class="hide-s">Σουτ</th><th class="hide-s">Κόρνερ</th><th class="hide-s">Κάρτες</th></tr></thead><tbody>${L.map(m => `<tr><td class="l">${dShort(m.date)}</td><td class="l team">${tlink(m.h)}</td><td class="sc"><a href="${U(matchPath(m))}">${m.hg}-${m.ag}</a></td><td class="l team">${tlink(m.a)}</td><td class="hide-s">${m.hs ?? '–'}-${m.as ?? '–'}</td><td class="hide-s">${m.hc ?? '–'}-${m.ac ?? '–'}</td><td class="hide-s">${(m.hy ?? 0) + 2 * (m.hr ?? 0)}-${(m.ay ?? 0) + 2 * (m.ar ?? 0)}</td></tr>`).join('')}</tbody></table></div>`;
page('apotelesmata/', {
  title: `Αποτελέσματα Super League ${seasonLabel(cur)} | ${NAME}`,
  desc: `Όλα τα αποτελέσματα της Super League ${seasonLabel(cur)} με σουτ, κόρνερ και κάρτες ανά αγώνα.`,
  crumbs: [['Αποτελέσματα', 'apotelesmata/']],
  body: `<section class="band"><div class="wrap"><!--crumbs--><h1>Αποτελέσματα Super League ${seasonLabel(cur)}</h1><p class="sub">Πάτα το σκορ για τα στατιστικά του αγώνα.</p>${resTable([...CUR].reverse())}</div></section>`.replace('<!--crumbs-->', '<!--crumbs-->'),
});

page('omades/', {
  title: `Ομάδες Super League ${seasonLabel(cur)}: στατιστικά και φόρμα | ${NAME}`,
  desc: `Οι ${TEAMS.length} ομάδες της Super League ${seasonLabel(cur)}: φόρμα, εντός και εκτός έδρας, γκολ, σουτ, κόρνερ και κάρτες.`,
  crumbs: [['Ομάδες', 'omades/']],
  body: `<section class="hero band"><div class="wrap"><!--crumbs--><h1>Ομάδες Super League ${seasonLabel(cur)}</h1><div class="tgrid">${TABLE.map((r, i) => `<a href="${teamUrl(r.t)}"><span>${i + 1}. ${esc(grName(r.t))}</span><span>${r.pts} β.</span></a>`).join('')}</div></div></section>`,
});

for (const t of TEAMS) {
  const s = ST[t].cur, pv = ST[t].prev, pos = TABLE.findIndex(r => r.t === t) + 1, n = grName(t);
  const next = FIX.find(f => f.h === t || f.a === t);
  const keys = [['Γκολ υπέρ', 'gf'], ['Γκολ κατά', 'ga'], ['Σουτ', 'shots'], ['Σουτ στην εστία', 'sot'], ['Σουτ αντιπάλων', 'shA'], ['Κόρνερ', 'corners'], ['Κόρνερ αντιπάλων', 'cornA'], ['Κάρτες', 'cards']];
  const pcts = [['Over 2,5', s.o25], ['Σκόραραν και οι δύο', s.btts], ['Ανέπαφη εστία', s.cs], ['Χωρίς γκολ', s.fts]];
  const summary = s.p ? `${n}: ${pos}η θέση στη βαθμολογία με ${s.pts} βαθμούς σε ${s.p} αγώνες (${s.w} ${s.w === 1 ? 'νίκη' : 'νίκες'}, ${s.d} ${s.d === 1 ? 'ισοπαλία' : 'ισοπαλίες'}, ${s.l} ${s.l === 1 ? 'ήττα' : 'ήττες'}) και γκολ ${s.gf}:${s.ga}. Εντός έδρας ${s.home.join('-')}, εκτός ${s.away.join('-')}. Αγώνες με 3+ γκολ: ${pc(s.o25 / s.p)}. Ανέπαφη εστία: ${s.cs} ${s.cs === 1 ? 'αγώνας' : 'αγώνες'}.` : `${n}: χωρίς αγώνα ακόμα στη σεζόν.`;
  page(`omades/${slugOf(t)}/`, {
    title: `${n}: στατιστικά, φόρμα, αποτελέσματα ${seasonLabel(cur)} | ${NAME}`,
    desc: `${n} στη Super League ${seasonLabel(cur)}: ${pos}η θέση, ${s.pts} βαθμοί, φόρμα, γκολ, σουτ, κόρνερ, κάρτες και όλα τα αποτελέσματα.`,
    crumbs: [['Ομάδες', 'omades/'], [n, `omades/${slugOf(t)}/`]],
    ld: [{ '@context': 'https://schema.org', '@type': 'SportsTeam', name: n, alternateName: t, sport: 'Soccer', memberOf: { '@type': 'SportsOrganization', name: 'Super League Greece' }, url: SITE_URL + '/omades/' + slugOf(t) + '/' }],
    body: `<section class="hero band"><div class="wrap"><!--crumbs--><h1>${esc(n)}</h1><p class="sub">${pos}η θέση · ${s.pts} βαθμοί σε ${s.p} αγώνες · ${s.w}-${s.d}-${s.l} · γκολ ${s.gf}:${s.ga}</p>
<div class="figs"><div class="fig1"><b>${s.home.join('-')}</b><span>εντός (Ν-Ι-Η)</span></div><div class="fig1"><b>${s.away.join('-')}</b><span>εκτός (Ν-Ι-Η)</span></div><div class="fig1"><b>${per(s, 'gf')}</b><span>γκολ ανά αγώνα</span></div><div class="fig1"><b>${formHtml(s.games.slice(0, 5).map(g => g.r))}</b><span>φόρμα</span></div></div>
${next ? `<p class="note" style="font-size:15px">Επόμενος αγώνας: <a href="${U(matchPath(next))}" style="color:var(--card)">${esc(grName(next.h))} – ${esc(grName(next.a))}, ${dShort(next.date)} ${esc(next.time)}</a></p>` : ''}</div></section>
<section class="band"><div class="wrap duo"><div><p class="prose">${esc(summary)}</p><h2>Ανά αγώνα</h2><div class="scroll"><table><thead><tr><th class="l"></th><th>${seasonLabel(cur)}</th><th>${seasonLabel(prevCode)}</th></tr></thead><tbody>${keys.map(([l, k]) => `<tr><td class="l">${l}</td><td><b>${per(s, k)}</b></td><td>${pv.p ? per(pv, k) : '–'}</td></tr>`).join('')}</tbody></table></div>
<h3>Συχνότητες</h3><div class="rows">${pcts.map(([l, v]) => `<div class="row"><span>${l}</span><div class="bar"><i style="width:${s.p ? (100 * v / s.p).toFixed(0) : 0}%"></i></div><span class="v">${s.p ? pc(v / s.p) : '–'}</span></div>`).join('')}</div>
<p class="note">Πρώτο ημίχρονο: ${s.ht[0]}:${s.ht[1]} γκολ.</p>
<h3>Ημίχρονο / Τελικό</h3>${s.nh ? `<div class="scroll"><table class="htft"><thead><tr><th class="l">Ημίχρονο ↓ Τελικό →</th><th>1</th><th>Χ</th><th>2</th></tr></thead><tbody>${['1', 'X', '2'].map(a => `<tr><td class="l">${{ 1: 'Προηγείται', X: 'Ισοπαλία', 2: 'Χάνει' }[a]}</td>${['1', 'X', '2'].map(b => `<td>${s.htft[a + '/' + b] || 0}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="note">1 = νίκη της ομάδας, 2 = νίκη του αντιπάλου, από τη σκοπιά της ομάδας. Ανατροπές: ${s.comeW} · χαμένα προβαδίσματα: ${s.leadLost + s.leadDrew}.</p>` : ''}
${s.nodds ? `<h3>Αν πόνταρες 1 € σε κάθε αγώνα</h3><div class="scroll"><table><tbody>${[['Νίκη της', s.pW, s.nodds], ['Ισοπαλία', s.pX, s.nodds], ['Ήττα της', s.pL, s.nodds], ['Over 2,5', s.pO, s.nou], ['Under 2,5', s.pU, s.nou]].map(([l, v, k]) => `<tr><td class="l">${l}</td><td class="${v >= 0 ? 'pos-v' : 'neg-v'}"><b>${v > 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')} €</b></td><td>${k} αγ.</td></tr>`).join('')}</tbody></table></div><p class="note">Μέσες αποδόσεις κλεισίματος. Φαβορί σε ${s.favN} αγώνες, κέρδισε ${s.favW}.</p>` : ''}
<h3>Θέση στα στατιστικά της λίγκας</h3><div class="scroll"><table><tbody>${STATS.map(st => { const r = RANK[st.slug].find(x => x.t === t); return r ? `<tr><td class="l"><a href="${statUrl(st)}">${st.name}</a></td><td>${sval(st, r.v)}</td><td>${r.pos}η</td></tr>` : ''; }).join('')}</tbody></table></div></div>
<div><h2>Αγώνες σεζόν</h2><div class="scroll"><table><thead><tr><th class="l">Ημ/νία</th><th class="l">Αντίπαλος</th><th></th><th>Σκορ</th></tr></thead><tbody>${s.games.map(g => `<tr><td class="l">${dShort(g.m.date)}</td><td class="l team">${tlink(g.opp)}</td><td class="l">${g.home ? 'εντός' : 'εκτός'}</td><td class="sc ${g.r}"><a href="${U(matchPath(g.m))}">${g.m.hg}-${g.m.ag}</a></td></tr>`).join('')}</tbody></table></div></div></div></section>`,
  });
}

const h2h = (a, b) => M.filter(m => (m.h === a && m.a === b) || (m.h === b && m.a === a)).slice(-6).reverse();
const h2hHtml = (a, b) => { const H = h2h(a, b); return H.length ? `<div class="scroll"><table><tbody>${H.map(m => `<tr><td class="l">${m.date.slice(8)}/${m.date.slice(5, 7)}/${m.date.slice(2, 4)}</td><td class="l">${esc(grName(m.h))}</td><td class="sc">${m.hg}-${m.ag}</td><td class="l">${esc(grName(m.a))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Δεν έχουν αναμετρηθεί τις δύο τελευταίες σεζόν.</p>'; };
const eventLd = (m, extra = {}) => ({ '@context': 'https://schema.org', '@type': 'SportsEvent', name: `${grName(m.h)} – ${grName(m.a)}`, sport: 'Soccer', startDate: m.time ? `${m.date}T${m.time}:00+02:00` : m.date, homeTeam: { '@type': 'SportsTeam', name: grName(m.h) }, awayTeam: { '@type': 'SportsTeam', name: grName(m.a) }, superEvent: { '@type': 'SportsEvent', name: `Super League ${seasonLabel(cur)}` }, eventStatus: 'https://schema.org/EventScheduled', ...extra });

for (const f of FIX) {
  const A = ST[f.h]?.cur, B = ST[f.a]?.cur, nh = grName(f.h), na = grName(f.a);
  const cmp = A?.p && B?.p ? [['Βαθμοί/αγώνα', A.pts / A.p, B.pts / B.p, 2], ['Γκολ υπέρ', A.gf / A.p, B.gf / B.p, 1], ['Γκολ κατά', A.ga / A.p, B.ga / B.p, 1], ['Σουτ στην εστία', A.sot / A.p, B.sot / B.p, 1], ['Κόρνερ', A.corners / A.p, B.corners / B.p, 1], ['Κάρτες', A.cards / A.p, B.cards / B.p, 1], ['Over 1,5', A.o15 / A.p, B.o15 / B.p, 0], ['Over 2,5', A.o25 / A.p, B.o25 / B.p, 0], ['Γκολ-γκολ', A.btts / A.p, B.btts / B.p, 0], ['Ανέπαφη εστία', A.cs / A.p, B.cs / B.p, 0], ['Προηγείται στο ημίχρονο', A.nh ? A.htW / A.nh : 0, B.nh ? B.htW / B.nh : 0, 0], ['Ισοπαλία στο ημίχρονο', A.nh ? A.htD / A.nh : 0, B.nh ? B.htD / B.nh : 0, 0], ['Συνολικά κόρνερ αγώνα', (A.corners + A.cornA) / A.p, (B.corners + B.cornA) / B.p, 1], ['Over 4,5 κάρτες', A.nk ? A.crd45 / A.nk : 0, B.nk ? B.crd45 / B.nk : 0, 0]] : [];
  const fmt = (v, d) => (d === 0 ? pc(v) : v.toFixed(d).replace('.', ','));
  const fav = f.p[0] > f.p[2] ? nh : na;
  page(matchPath(f), {
    title: `${nh} – ${na}: προγνωστικά, πιθανότητες, στατιστικά (${dShort(f.date)}) | ${NAME}`,
    desc: `${nh} – ${na}, ${dLong(f.date)} ${f.time}: πιθανότητες 1-Χ-2, αναμενόμενα γκολ, over/under, φόρμα και μεταξύ τους αναμετρήσεις.`,
    crumbs: [['Πρόγραμμα', 'programma/'], [`${nh} – ${na}`, matchPath(f)]],
    ld: [eventLd(f)],
    body: `<section class="hero band"><div class="wrap"><!--crumbs--><h1>${esc(nh)} – ${esc(na)}</h1><p class="sub">${dLong(f.date)}, ${esc(f.time)} · Super League ${seasonLabel(cur)}</p>
<div style="max-width:760px;margin-top:20px">${strip(f.p)}<div class="legend"><span>${esc(nh)} ${pc(f.p[0])}</span><span>Ισοπαλία ${pc(f.p[1])}</span><span>${esc(na)} ${pc(f.p[2])}</span></div></div>
<div class="figs" style="max-width:760px"><div class="fig1"><b>${f1(f.pred.lam)} – ${f1(f.pred.mu)}</b><span>αναμενόμενα γκολ</span></div><div class="fig1"><b>${pc(f.o25)}</b><span>over 2,5</span></div><div class="fig1"><b>${pc(f.pred.btts)}</b><span>σκοράρουν και οι δύο</span></div><div class="fig1"><b>${f.pred.top.map(x => x[0]).join(' · ')}</b><span>πιθανότερα σκορ</span></div></div></div></section>
<section class="band"><div class="wrap duo"><div><p class="prose">${f.p[0] === f.p[2] ? 'Χωρίς φαβορί.' : `Φαβορί: ${esc(fav)} (${pc(Math.max(f.p[0], f.p[2]))}).`} Ισοπαλία: ${pc(f.p[1])}. Το μοντέλο περιμένει ${f1(f.pred.lam + f.pred.mu)} γκολ συνολικά και πιθανότερο σκορ ${f.pred.top[0][0]}.</p>
${cmp.length ? `<h2>Σύγκριση σεζόν</h2><div class="cmp" style="font-weight:600"><span></span><span style="text-align:right">${esc(nh)}</span><span></span><span>${esc(na)}</span><span></span></div>${cmp.map(([l, x, y, d]) => { const mx = Math.max(x, y) || 1; return `<div class="cmp"><span class="n1">${fmt(x, d)}</span><span class="bl"><i style="width:${(100 * x / mx).toFixed(0)}%"></i></span><span class="lb">${l}</span><span class="br"><i style="width:${(100 * y / mx).toFixed(0)}%"></i></span><span>${fmt(y, d)}</span></div>`; }).join('')}
<h3>Φόρμα</h3><p>${tlink(f.h)} ${formHtml(A.games.slice(0, 5).map(g => g.r))}</p><p>${tlink(f.a)} ${formHtml(B.games.slice(0, 5).map(g => g.r))}</p>` : ''}</div>
<div><h2>Αποδόσεις και πιθανότητες</h2>${f.odds ? `<div class="scroll"><table><thead><tr><th class="l"></th><th>1</th><th>X</th><th>2</th></tr></thead><tbody><tr><td class="l">Μέση απόδοση</td>${f.odds.map(o => `<td>${o.toFixed(2)}</td>`).join('')}</tr><tr><td class="l"><b>Αγορά χωρίς γκανιότα</b></td>${f.mkt.map(p => `<td><b>${pc(p)}</b></td>`).join('')}</tr><tr><td class="l">Μοντέλο γκολ</td>${[f.pred.h, f.pred.d, f.pred.a].map(p => `<td>${pc(p)}</td>`).join('')}</tr></tbody></table></div><p class="note">Σε έλεγχο 1.727 αγώνων (2018–2026) η αγορά ήταν πιο ακριβής από το μοντέλο, γι' αυτό τα ποσοστά της σελίδας είναι της αγοράς. Όπου το μοντέλο διαφωνεί πολύ, αξίζει να ψάξεις απουσίες και νέα.</p>` : '<p class="note">Δεν υπάρχουν ακόμα αποδόσεις· τα ποσοστά είναι του μοντέλου.</p>'}
<h3>Τελευταίες μεταξύ τους</h3>${h2hHtml(f.h, f.a)}</div></div></section>`,
  });
}

for (const m of CUR) {
  const nh = grName(m.h), na = grName(m.a);
  const rows = [['Ημίχρονο', m.hh, m.ha], ['Σουτ', m.hs, m.as], ['Σουτ στην εστία', m.hst, m.ast], ['Κόρνερ', m.hc, m.ac], ['Κίτρινες', m.hy, m.ay], ['Κόκκινες', m.hr, m.ar]];
  const mk = m.odds ? devig(...m.odds) : null;
  page(matchPath(m), {
    title: `${nh} – ${na} ${m.hg}-${m.ag} (${dShort(m.date)}): στατιστικά αγώνα | ${NAME}`,
    desc: `${nh} – ${na} ${m.hg}-${m.ag}, ${dLong(m.date)}, Super League ${seasonLabel(cur)}: σουτ, κόρνερ, κάρτες και μεταξύ τους αναμετρήσεις.`,
    crumbs: [['Αποτελέσματα', 'apotelesmata/'], [`${nh} – ${na}`, matchPath(m)]],
    ld: [eventLd(m, { eventStatus: 'https://schema.org/EventCompleted' })],
    body: `<section class="hero band"><div class="wrap"><!--crumbs--><h1>${esc(nh)} ${m.hg}-${m.ag} ${esc(na)}</h1><p class="sub">${dLong(m.date)}${m.time ? ', ' + esc(m.time) : ''} · Super League ${seasonLabel(cur)}${m.ref ? ' · Διαιτητής: ' + esc(m.ref) : ''}</p></div></section>
<section class="band"><div class="wrap duo"><div><h2>Στατιστικά αγώνα</h2><div class="scroll"><table><thead><tr><th class="l"></th><th>${esc(nh)}</th><th>${esc(na)}</th></tr></thead><tbody>${rows.map(([l, a, b]) => `<tr><td class="l">${l}</td><td>${a ?? '–'}</td><td>${b ?? '–'}</td></tr>`).join('')}</tbody></table></div>
${mk ? `<p class="note">Πριν τον αγώνα η αγορά έδινε ${esc(nh)} ${pc(mk[0])}, ισοπαλία ${pc(mk[1])}, ${esc(na)} ${pc(mk[2])}.</p>` : ''}
<p>${tlink(m.h)} · ${tlink(m.a)}</p></div><div><h2>Μεταξύ τους</h2>${h2hHtml(m.h, m.a)}</div></div></section>`,
  });
}


// ---------- παιχνίδι «Νίκησε το μοντέλο»: οι προβλέψεις του μοντέλου κλειδώνουν από την ημέρα του αγώνα
const LEDGER = 'data/predictions.json';
const led = JSON.parse(await fs.readFile(LEDGER, 'utf8').catch(() => '{}'));
const mid = m => `${m.date}-${slugOf(m.h)}-${slugOf(m.a)}`;
for (const f of nextRound) {
  const id = mid(f);
  if (f.date <= TODAY && led[id]) continue;
  const o = f.p.indexOf(Math.max(...f.p));
  const sc = f.pred.top.map(x => x[0]).find(x => { const [a, b] = x.split('-').map(Number); return (a > b ? 0 : a === b ? 1 : 2) === o; }) || f.pred.top[0][0];
  led[id] = { r: roundNo, date: f.date, time: f.time, h: f.h, a: f.a, pick: '1X2'[o], score: sc };
}
await fs.writeFile(LEDGER, JSON.stringify(led, null, 1));
const resOf = Object.fromEntries(CUR.map(m => [mid(m), `${m.hg}-${m.ag}`]));
const GAME = Object.entries(led).map(([id, e]) => ({ id, ...e, hn: grName(e.h), an: grName(e.a), res: resOf[id] || null, url: U(`agones/${id}/`) })).sort((a, b) => b.r - a.r || a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
const gameJs = `
const G=${JSON.stringify(GAME).replace(/</g, '\\u003c')};
const KEY='slgr-predictions';let P={};try{P=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(P))}catch(e){}};
const out=s=>{const[a,b]=s.split('-').map(Number);return a>b?'1':a===b?'X':'2'};
const pts=(p,r)=>!p||!r?0:p===r?3:out(p)===out(r)?1:0;
const locked=g=>new Date(g.date+'T'+(g.time||'00:00')+':00+02:00')<=new Date();
function render(){
 const rounds=[...new Set(G.map(g=>g.r))];let me=0,mo=0,n=0;
 document.getElementById('game').innerHTML=rounds.map(r=>{const L=G.filter(g=>g.r===r);const done=L.every(g=>g.res);let a=0,b=0;
  const rows=L.map(g=>{const p=P[g.id],lk=locked(g),pm=pts(p,g.res),pb=pts(g.score,g.res);if(g.res){a+=pm;b+=pb;if(p){me+=pm;mo+=pb;n++}}
   const [x,y]=(p||'-').split('-');
   const inp=lk?'<b>'+(p||'–')+'</b>':'<input inputmode="numeric" maxlength="2" aria-label="Γκολ '+g.hn+'" data-id="'+g.id+'" data-s="0" value="'+(x||'')+'"> - <input inputmode="numeric" maxlength="2" aria-label="Γκολ '+g.an+'" data-id="'+g.id+'" data-s="1" value="'+(y||'')+'">';
   return '<tr><td class="l"><a href="'+g.url+'">'+g.hn+' – '+g.an+'</a><small>'+g.date.slice(8)+'/'+g.date.slice(5,7)+' '+g.time+'</small></td><td class="pick">'+inp+'</td><td>'+(lk||g.res?g.score:'<span class="hid" title="Φαίνεται μετά τη σέντρα">?</span>')+'</td><td>'+(g.res?'<b>'+g.res+'</b>':'–')+'</td><td>'+(g.res?(p?'<b class="p'+pm+'">'+pm+'</b>':'–')+' / '+pb:'')+'</td></tr>'}).join('');
  return '<h2>'+r+'η αγωνιστική'+(done?' · εσύ '+a+' – μοντέλο '+b:'')+'</h2><div class="scroll"><table class="gt"><thead><tr><th class="l">Αγώνας</th><th>Η πρόβλεψή σου</th><th>Μοντέλο</th><th>Τελικό</th><th>Πόντοι (εσύ / μοντ.)</th></tr></thead><tbody>'+rows+'</tbody></table></div>'}).join('');
 document.getElementById('score').innerHTML=n?'<div class="fig1"><b>'+me+'</b><span>οι πόντοι σου</span></div><div class="fig1"><b>'+mo+'</b><span>πόντοι μοντέλου στους ίδιους αγώνες</span></div><div class="fig1"><b>'+(me>mo?'Νικάς!':me===mo?'Ισοπαλία':'Χάνεις')+'</b><span>σε '+n+' αγώνες</span></div>':'<p class="note" style="font-size:15px">Βάλε σκορ στους αγώνες και γύρνα μετά την αγωνιστική να δεις αν νίκησες το μοντέλο.</p>';
 document.getElementById('share').hidden=!n;document.getElementById('share').dataset.t='Στη Super League έκανα '+me+' πόντους και το μοντέλο '+mo+'. Νίκησέ το κι εσύ: '+location.href;
}
document.addEventListener('input',e=>{const t=e.target;if(!t.dataset.id)return;t.value=t.value.replace(/\\D/g,'').slice(0,2);const I=document.querySelectorAll('input[data-id="'+t.dataset.id+'"]');const v=[I[0].value,I[1].value];if(v[0]!==''&&v[1]!=='')P[t.dataset.id]=(+v[0])+'-'+(+v[1]);else delete P[t.dataset.id];save();document.getElementById('saved').textContent='Αποθηκεύτηκε ✓';});
document.getElementById('share').onclick=async e=>{const t=e.target.dataset.t;try{if(navigator.share)await navigator.share({text:t});else{await navigator.clipboard.writeText(t);e.target.textContent='Αντιγράφηκε ✓'}}catch(x){}};
render();`;
page('paixnidi/', {
  title: `Νίκησε το μοντέλο: προβλέψεις Super League ${roundNo}ης αγωνιστικής | ${NAME}`,
  desc: `Δωρεάν παιχνίδι προβλέψεων για τη Super League: βάλε σκορ στους αγώνες της ${roundNo}ης αγωνιστικής και δες αν νικάς το μοντέλο μας.`,
  crumbs: [['Νίκησε το μοντέλο', 'paixnidi/']],
  body: `<section class="hero band"><div class="wrap"><!--crumbs--><h1>Νίκησε το μοντέλο</h1><p class="sub">Βάλε σκορ σε κάθε αγώνα της αγωνιστικής πριν τη σέντρα. Ακριβές σκορ: 3 πόντοι · σωστό 1-Χ-2: 1 πόντος. Το ίδιο παίρνει και το μοντέλο μας.</p><div class="figs" id="score"></div><p><button id="share" class="btn" hidden>Μοιράσου το σκορ σου</button></p></div></section>
<section class="band"><div class="wrap"><p class="note" id="saved" aria-live="polite">Οι προβλέψεις σου αποθηκεύονται μόνο σε αυτή τη συσκευή.</p><div id="game"><p>Φόρτωση…</p></div>
<p><a href="${U('kouiz/')}">Παίξε και το καθημερινό κουίζ «Ποια ομάδα είναι;» →</a></p>
<p class="note">Η πρόβλεψη του μοντέλου φαίνεται μόλις ξεκινήσει ο αγώνας, για να μην επηρεάσει τη δική σου. Τα αποτελέσματα ενημερώνονται κάθε Δευτέρα και Πέμπτη. Παιχνίδι για διασκέδαση, χωρίς χρήματα.</p></div></section>
<script>${gameJs}</script>`,
});

// ---------- καθημερινό κουίζ «Ποια ομάδα είναι;»
const rk = (slug, t) => RANK[slug].find(r => r.t === t);
const ordn = n => n + 'η';
const QUIZ = TABLE.filter(r => r.p).map(r => {
  const t = r.t, s = ST[t].cur, R = k => rk(k, t), last = s.games[0];
  const c = [
    `Σουτ ανά αγώνα: ${sval(STATS.find(x => x.slug === 'sout'), R('sout')?.v)} (${ordn(R('sout')?.pos)} στη λίγκα).`,
    `Κόρνερ ανά αγώνα: ${f1(s.corners / s.p)} · κάρτες ανά αγώνα: ${f1(s.cards / s.p)}.`,
    `Over 2,5 σε ${pc(s.o25 / s.p)} των αγώνων της · γκολ-γκολ σε ${pc(s.btts / s.p)}.`,
    `Στο ημίχρονο προηγήθηκε σε ${s.htW} αγώνες · ανατροπές: ${s.comeW} · χαμένα προβαδίσματα: ${s.leadLost + s.leadDrew}.`,
    `Εντός έδρας ${s.home.join('-')}, εκτός ${s.away.join('-')} (νίκες-ισοπαλίες-ήττες).`,
    `${s.pts} βαθμοί σε ${s.p} αγώνες, γκολ ${s.gf}:${s.ga}.`,
    `Τελευταίος αγώνας: ${last.home ? 'εντός' : 'εκτός'} έδρας, αντίπαλος ${grName(last.opp)}, σκορ ${last.home ? last.m.hg + '-' + last.m.ag : last.m.ag + '-' + last.m.hg} (πρώτα τα δικά της γκολ).`,
  ];
  return { n: grName(t), url: teamUrl(t), c };
});
const quizJs = `
const Q=${JSON.stringify(QUIZ).replace(/</g, '\\u003c')};
const names=Q.map(q=>q.n).sort((a,b)=>a.localeCompare(b,'el'));
const day=()=>{const d=new Date(Date.now()+2*36e5);return d.toISOString().slice(0,10)};
const dnum=Math.floor(new Date(day()+'T00:00:00Z')/864e5);
let idx=((dnum*5+3)%Q.length+Q.length)%Q.length,practice=false;
const KEY='slgr-quiz';let S={};try{S=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
let st={shown:1,wrong:[],done:false,win:false};
if(S.day===day()&&S.st)st=S.st;
const $=id=>document.getElementById(id);
function render(){const q=Q[idx];
 $('clues').innerHTML=q.c.slice(0,st.shown).map((c,i)=>'<li><span>'+(i+1)+'</span>'+c+'</li>').join('');
 $('opts').innerHTML=st.done?'':names.map(n=>'<button class="opt'+(st.wrong.includes(n)?' no':'')+'"'+(st.wrong.includes(n)?' disabled':'')+'>'+n+'</button>').join('');
 $('more').hidden=st.done||st.shown>=q.c.length;
 $('res').innerHTML=st.done?(st.win?'<p class="big">Σωστά! Ήταν '+q.n+' με '+st.shown+(st.shown===1?' ένδειξη':' ενδείξεις')+'.</p>':'<p class="big">Ήταν '+q.n+'.</p>')+'<p><a href="'+q.url+'">Δες τα στατιστικά της →</a></p>':'';
 $('share').hidden=!st.done||practice;$('again').hidden=!st.done;
 $('streak').textContent=S.streak?'Σερί: '+S.streak+(S.streak===1?' μέρα':' μέρες'):'';
}
function finish(win){st.done=true;st.win=win;if(!practice){const y=new Date(new Date(day()+'T00:00:00Z')-864e5).toISOString().slice(0,10);S.streak=win?(S.last===y?(S.streak||0)+1:1):0;if(win)S.last=day();}}
document.addEventListener('click',e=>{const b=e.target;if(b.classList.contains('opt')&&!st.done){if(b.textContent===Q[idx].n)finish(true);else{st.wrong.push(b.textContent);if(st.shown<Q[idx].c.length)st.shown++;else finish(false)}if(!practice){S.day=day();S.st=st;save()}render()}});
$('more').onclick=()=>{st.shown++;if(!practice){S.day=day();S.st=st;save()}render()};
$('again').onclick=()=>{practice=true;idx=Math.floor(Math.random()*Q.length);st={shown:1,wrong:[],done:false,win:false};render()};
$('share').onclick=async e=>{const t='Ποια ομάδα είναι; '+day().slice(8)+'/'+day().slice(5,7)+' '+(st.win?'✅ με '+st.shown+'/7 ενδείξεις':'❌')+' '+'🟥'.repeat(st.wrong.length)+(st.win?'🟩':'')+' '+location.href;try{if(navigator.share)await navigator.share({text:t});else{await navigator.clipboard.writeText(t);e.target.textContent='Αντιγράφηκε ✓'}}catch(x){}};
render();`;
page('kouiz/', {
  title: `Ποια ομάδα είναι; Καθημερινό κουίζ Super League | ${NAME}`,
  desc: 'Καθημερινό κουίζ ποδοσφαίρου: μάντεψε την ομάδα της Super League από τα στατιστικά της, με όσο λιγότερες ενδείξεις μπορείς.',
  crumbs: [['Κουίζ', 'kouiz/']],
  body: `<section class="hero band"><div class="wrap"><!--crumbs--><h1>Ποια ομάδα είναι;</h1><p class="sub">Μια ομάδα της Super League κάθε μέρα. Μάντεψέ την από τα στατιστικά της. Κάθε λάθος απάντηση φέρνει νέα ένδειξη· έχεις 7.</p><p class="note" id="streak"></p></div></section>
<section class="band"><div class="wrap quiz"><ol id="clues" class="clues"></ol><p><button id="more" class="btn ghost">Δείξε άλλη ένδειξη</button></p><div id="opts" class="opts"></div><div id="res"></div><p><button id="share" class="btn" hidden>Μοιράσου το αποτέλεσμα</button> <button id="again" class="btn ghost" hidden>Εξάσκηση με τυχαία ομάδα</button></p>
<p class="note">Τα στατιστικά είναι της σεζόν ${seasonLabel(cur)} και ενημερώνονται κάθε Δευτέρα και Πέμπτη. Νέα ομάδα κάθε μέρα στις 00:00.</p>
<p><a href="${U('paixnidi/')}">Παίξε και το «Νίκησε το μοντέλο» →</a></p></div></section>
<script>${quizJs}</script>`,
});

page('statistika/', {
  title: `Στοιχηματικά στατιστικά Super League ${seasonLabel(cur)}: ημίχρονο, ανατροπές, over, κόρνερ | ${NAME}`,
  desc: `Στοιχηματικά στατιστικά ομάδων Super League ${seasonLabel(cur)}: over/under, γκολ-γκολ, ημίχρονο/τελικό, ανατροπές, κόρνερ, κάρτες και κέρδος ανά ομάδα.`,
  crumbs: [['Στατιστικά', 'statistika/']],
  body: `<section class="hero band"><div class="wrap"><!--crumbs--><h1>Στοιχηματικά στατιστικά Super League ${seasonLabel(cur)}</h1><p class="sub">${STATS.length} κατατάξεις μετά από ${CUR.length} αγώνες. Πάτα μια κατηγορία για τον πλήρη πίνακα.</p>
<nav class="chips" aria-label="Ομάδες κατηγοριών">${GROUPS.map(g => `<a href="#${gid(g)}">${g}</a>`).join('')}</nav></div></section>
${GROUPS.map(g => `<section class="band" id="${gid(g)}"><div class="wrap"><h2>${g}</h2>${GDESC[g] ? `<p class="note">${GDESC[g]}</p>` : ''}<div class="scards">${STATS.filter(st => st.g === g).map(st => `<div class="scard"><h3><a href="${statUrl(st)}">${st.name}</a></h3>${statBars(st, RANK[st.slug].slice(0, 5))}<a class="more" href="${statUrl(st)}">Όλες οι ομάδες →</a></div>`).join('')}</div></div></section>`).join('')}`,
});
for (const st of STATS) {
  const L = RANK[st.slug], top = L[0];
  const lead = top ? `Στην κορυφή${st.asc ? ' (χαμηλότερη τιμή)' : ''}: ${grName(top.t)} (${sval(st, top.v)})${L[1] ? `, ακολουθεί ${grName(L[1].t)} (${sval(st, L[1].v)})` : ''}.` : '';
  page(`statistika/${st.slug}/`, {
    title: `${st.h} – Super League ${seasonLabel(cur)} | ${NAME}`,
    desc: `${st.h} στη Super League ${seasonLabel(cur)}: πλήρης κατάταξη των ${L.length} ομάδων. ${lead}`.slice(0, 160),
    crumbs: [['Στατιστικά', 'statistika/'], [st.name, `statistika/${st.slug}/`]],
    body: `<section class="hero band"><div class="wrap"><!--crumbs--><h1>${esc(st.h)}</h1><p class="sub">Super League ${seasonLabel(cur)} · ${CUR.length} αγώνες · ενημέρωση ${dLong(TODAY)}</p></div></section>
<section class="band"><div class="wrap duo"><div><p class="prose">${esc(st.about)} ${esc(lead)}</p>
<div class="scroll"><table><thead><tr><th></th><th class="l">Ομάδα</th><th>Αγ</th><th>${esc(st.name)}</th><th class="l hide-s">Σύνολο</th></tr></thead><tbody>${L.map(r => `<tr><td class="pos">${r.pos}</td><td class="l team">${tlink(r.t)}</td><td>${r.s.p}</td><td><b>${sval(st, r.v)}</b></td><td class="l hide-s">${st.raw ? st.tot(r.s) : esc(st.tot(r.s))}</td></tr>`).join('')}</tbody></table></div></div>
<div><h2>Γράφημα</h2>${statBars(st, L)}<h3>Άλλα στατιστικά</h3><nav class="chips light">${STATS.filter(x => x !== st).map(x => `<a href="${statUrl(x)}">${x.name}</a>`).join('')}</nav></div></div></section>`,
  });
}

page('404.html', { title: `Η σελίδα δεν βρέθηκε | ${NAME}`, desc: 'Η σελίδα δεν βρέθηκε.', body: `<section class="band"><div class="wrap"><h1>Η σελίδα δεν βρέθηκε</h1><p><a href="${U('')}">Επιστροφή στην αρχική</a></p></div></section>` });

// ---------- εγγραφή
await fs.rm(OUT, { recursive: true, force: true });
for (const [p, html] of pages) {
  const file = p.endsWith('.html') ? path.join(OUT, p) : path.join(OUT, p, 'index.html');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, html);
}
await fs.mkdir(path.join(OUT, 'assets'), { recursive: true });
await fs.copyFile('src/style.css', path.join(OUT, 'assets/style.css'));
const sm = pages.filter(([p]) => !p.endsWith('.html')).map(([p]) => `<url><loc>${SITE_URL}/${p}</loc><lastmod>${TODAY}</lastmod></url>`).join('');
await fs.writeFile(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sm}</urlset>`);
await fs.writeFile(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
if (process.env.CNAME) await fs.writeFile(path.join(OUT, 'CNAME'), process.env.CNAME + '\n');
console.log(`${pages.length} σελίδες · ${CUR.length} αγώνες ${seasonLabel(cur)} · ${FIX.length} επόμενοι · ${TEAMS.length} ομάδες`);
