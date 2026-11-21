// Χτίζει το στατικό site στο dist/ από τα CSV του data/.
// SITE_URL: πλήρης διεύθυνση (για canonical/sitemap), SITE_BASE: διαδρομή βάσης (π.χ. /superleague-gr/ στο GitHub Pages).
import fs from 'node:fs/promises';
import path from 'node:path';
import { grName, slugOf } from './src/teams.mjs';
import { seasonCode, seasonLabel } from './src/season.mjs';
import { marketXG, fit, predict, devig } from './src/model.mjs';

const SITE_URL = (process.env.SITE_URL || 'https://kotetsi.github.io/superleague-gr').replace(/\/$/, '');
const BASE = process.env.SITE_BASE ?? '/superleague-gr/';
const OUT = 'dist';
const NAME = 'Στατιστικά Super League';
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
  const s = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, games: [], home: [0, 0, 0], away: [0, 0, 0], o25: 0, btts: 0, cs: 0, fts: 0, shots: 0, sot: 0, corners: 0, cards: 0, shA: 0, sotA: 0, cornA: 0, ht: [0, 0] };
  for (const m of L.filter(m => m.h === t || m.a === t)) {
    const home = m.h === t, gf = home ? m.hg : m.ag, ga = home ? m.ag : m.hg, r = gf > ga ? 'W' : gf === ga ? 'D' : 'L';
    s.p++; s.gf += gf; s.ga += ga; s[{ W: 'w', D: 'd', L: 'l' }[r]]++; s.pts += { W: 3, D: 1, L: 0 }[r];
    s.games.push({ m, r, home, opp: home ? m.a : m.h });
    (home ? s.home : s.away)[{ W: 0, D: 1, L: 2 }[r]]++;
    s.o25 += m.hg + m.ag > 2; s.btts += m.hg > 0 && m.ag > 0; s.cs += ga === 0; s.fts += gf === 0;
    const g = (a, b) => (home ? m[a] : m[b]) ?? 0;
    s.shots += g('hs', 'as'); s.sot += g('hst', 'ast'); s.corners += g('hc', 'ac'); s.cards += g('hy', 'ay') + 2 * g('hr', 'ar');
    s.shA += g('as', 'hs'); s.sotA += g('ast', 'hst'); s.cornA += g('ac', 'hc');
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
<link rel="stylesheet" href="${U('assets/style.css')}">
${[...bc, ...ld].map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head><body>
<header class="top"><div class="wrap"><a class="brand" href="${U('')}">Στατιστικά <b>Super League</b></a>
<nav aria-label="Κύριο μενού"><a href="${U('')}">Αγωνιστική</a><a href="${U('vathmologia/')}">Βαθμολογία</a><a href="${U('programma/')}">Πρόγραμμα</a><a href="${U('apotelesmata/')}">Αποτελέσματα</a><a href="${U('omades/')}">Ομάδες</a></nav></div></header>
<main>${crumbs.length ? body.replace('<!--crumbs-->', `<div class="crumbs"><a href="${U('')}">Αρχική</a>${crumbs.map(([n, u], i) => i === crumbs.length - 1 ? ` › ${esc(n)}` : ` › <a href="${U(u)}">${esc(n)}</a>`).join('')}</div>`) : body}</main>
<footer class="band"><div class="wrap"><p>${NAME} · Super League ${seasonLabel(cur)} · ενημέρωση ${dLong(TODAY)}.</p>
<p>Δεδομένα: football-data.co.uk. Τα ποσοστά 1-Χ-2 και over/under είναι οι μέσες αποδόσεις της αγοράς χωρίς γκανιότα· τα αναμενόμενα γκολ και τα πιθανότερα σκορ βγαίνουν από μοντέλο γκολ (Dixon-Coles). Δεν αποτελούν συμβουλή στοιχήματος. 21+ · Παίξε υπεύθυνα.</p></div></footer>
</body></html>`;
  pages.push([p, html]);
}

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
<p class="note">Πράσινο: γηπεδούχος · γκρι: ισοπαλία · μπλε: φιλοξενούμενος.</p></div></section>
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
<p class="note">Πρώτο ημίχρονο: ${s.ht[0]}:${s.ht[1]} γκολ.</p></div>
<div><h2>Αγώνες σεζόν</h2><div class="scroll"><table><thead><tr><th class="l">Ημ/νία</th><th class="l">Αντίπαλος</th><th></th><th>Σκορ</th></tr></thead><tbody>${s.games.map(g => `<tr><td class="l">${dShort(g.m.date)}</td><td class="l team">${tlink(g.opp)}</td><td class="l">${g.home ? 'εντός' : 'εκτός'}</td><td class="sc ${g.r}"><a href="${U(matchPath(g.m))}">${g.m.hg}-${g.m.ag}</a></td></tr>`).join('')}</tbody></table></div></div></div></section>`,
  });
}

const h2h = (a, b) => M.filter(m => (m.h === a && m.a === b) || (m.h === b && m.a === a)).slice(-6).reverse();
const h2hHtml = (a, b) => { const H = h2h(a, b); return H.length ? `<div class="scroll"><table><tbody>${H.map(m => `<tr><td class="l">${m.date.slice(8)}/${m.date.slice(5, 7)}/${m.date.slice(2, 4)}</td><td class="l">${esc(grName(m.h))}</td><td class="sc">${m.hg}-${m.ag}</td><td class="l">${esc(grName(m.a))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Δεν έχουν αναμετρηθεί τις δύο τελευταίες σεζόν.</p>'; };
const eventLd = (m, extra = {}) => ({ '@context': 'https://schema.org', '@type': 'SportsEvent', name: `${grName(m.h)} – ${grName(m.a)}`, sport: 'Soccer', startDate: m.time ? `${m.date}T${m.time}:00+02:00` : m.date, homeTeam: { '@type': 'SportsTeam', name: grName(m.h) }, awayTeam: { '@type': 'SportsTeam', name: grName(m.a) }, superEvent: { '@type': 'SportsEvent', name: `Super League ${seasonLabel(cur)}` }, eventStatus: 'https://schema.org/EventScheduled', ...extra });

for (const f of FIX) {
  const A = ST[f.h]?.cur, B = ST[f.a]?.cur, nh = grName(f.h), na = grName(f.a);
  const cmp = A?.p && B?.p ? [['Βαθμοί/αγώνα', A.pts / A.p, B.pts / B.p, 2], ['Γκολ υπέρ', A.gf / A.p, B.gf / B.p, 1], ['Γκολ κατά', A.ga / A.p, B.ga / B.p, 1], ['Σουτ στην εστία', A.sot / A.p, B.sot / B.p, 1], ['Κόρνερ', A.corners / A.p, B.corners / B.p, 1], ['Κάρτες', A.cards / A.p, B.cards / B.p, 1], ['Over 2,5', A.o25 / A.p, B.o25 / B.p, 0]] : [];
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
