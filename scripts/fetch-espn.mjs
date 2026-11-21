// Γεγονότα αγώνων (λεπτά γκολ, σκόρερ, κάρτες) από τη δημόσια ροή της ESPN. Γράφει data/espn.json.
// Ανεπίσημη πηγή: αν αποτύχει, κρατάμε τα προηγούμενα δεδομένα.
import fs from 'node:fs/promises';
import { espnTeam } from '../src/teams.mjs';

const URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/gre.1/scoreboard?dates=';
const sleep = ms => new Promise(z => setTimeout(z, ms));
const prev = JSON.parse(await fs.readFile('data/espn.json', 'utf8').catch(() => '{"days":{}}'));
const days = prev.days || {};
const today = new Date(); const start = new Date(process.env.ESPN_FROM || (today.getUTCMonth() >= 6 ? `${today.getUTCFullYear()}-08-01` : `${today.getUTCFullYear() - 1}-08-01`));
const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');
export const simplify = e => {
  const c = e.competitions[0], H = c.competitors.find(x => x.homeAway === 'home'), A = c.competitors.find(x => x.homeAway === 'away');
  const side = id => (String(id) === String(H.team.id) ? 'h' : 'a');
  const min = d => { const m = String(d || '').match(/(\d+)'?(?:\+(\d+))?/); return m ? [+m[1], +(m[2] || 0)] : [null, 0]; };
  const ev = (c.details || []).map(d => { const [m, x] = min(d.clock?.displayValue); return { m, x, side: side(d.team?.id), p: d.athletesInvolved?.[0]?.displayName || null, k: d.scoringPlay ? (d.ownGoal ? 'og' : d.penaltyKick ? 'pen' : 'g') : d.redCard ? 'r' : d.yellowCard ? 'y' : null }; }).filter(d => d.k);
  return { id: e.id, t: e.date, h: espnTeam(H.team.id, H.team.displayName), a: espnTeam(A.team.id, A.team.displayName), hs: +H.score, as: +A.score, st: e.status?.type?.state, ev };
};
let n = 0, fail = 0;
for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
  const k = ymd(d), age = (today - d) / 864e5;
  if (days[k] && age > 4 && days[k].every(e => e.st === 'post')) continue;
  try {
    const r = await fetch(URL + k); if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    days[k] = (j.events || []).map(simplify); n++;
  } catch (e) { fail++; console.log(k, e.message); }
  await sleep(300);
}
for (const k of Object.keys(days)) if (!days[k].length) delete days[k];
await fs.writeFile('data/espn.json', JSON.stringify({ updated: today.toISOString(), days }));
console.log(`ESPN: ${n} ημέρες ενημερώθηκαν, ${fail} σφάλματα, ${Object.values(days).flat().length} αγώνες`);
