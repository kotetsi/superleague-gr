// Δοκιμή κάλυψης API-Football για τη Super League (id 197). Δεν τυπώνει ποτέ το κλειδί.
const KEY = process.env.API_FOOTBALL_KEY;
if (!KEY) { console.log('Λείπει το API_FOOTBALL_KEY'); process.exit(1); }
const get = async q => { const r = await fetch('https://v3.football.api-sports.io/' + q, { headers: { 'x-apisports-key': KEY } }); return r.json(); };
const out = [];
const st = await get('status');
out.push(`Πακέτο: ${st.response?.subscription?.plan} · κλήσεις σήμερα: ${st.response?.requests?.current}/${st.response?.requests?.limit_day}`);
const lg = await get('leagues?id=197');
const seasons = lg.response?.[0]?.seasons || [];
out.push(`Λίγκα: ${lg.response?.[0]?.league?.name} · σεζόν: ${seasons.map(s => s.year).join(', ')}`);
const cur = seasons.find(s => s.current); if (cur) out.push(`Τρέχουσα: ${cur.year} · κάλυψη: ${JSON.stringify(cur.coverage)}`);
for (const y of [2026, 2025, 2024]) {
  const p = await get(`players?league=197&season=${y}`);
  const fx = await get(`fixtures?league=197&season=${y}&status=FT`);
  out.push(`Σεζόν ${y}: παίκτες σελ.1 ${p.results ?? 0} (σελίδες ${p.paging?.total ?? 0}) · αγώνες ${fx.results ?? 0} · σφάλματα ${JSON.stringify(p.errors)} ${JSON.stringify(fx.errors)}`);
  if (fx.results) {
    const id = fx.response.at(-1).fixture.id;
    const ev = await get(`fixtures/events?fixture=${id}`);
    out.push(`  γεγονότα τελευταίου αγώνα: ${ev.results} π.χ. ${JSON.stringify(ev.response?.find(e => e.type === 'Goal') || {}).slice(0, 200)}`);
    if (p.results) out.push(`  παίκτης: ${JSON.stringify(p.response[0]?.player).slice(0, 250)}`);
    break;
  }
}
console.log(out.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) (await import('node:fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY, '```\n' + out.join('\n') + '\n```\n');
