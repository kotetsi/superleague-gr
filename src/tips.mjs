// Αυτόματη εκκαθάριση tips από το τελικό σκορ.
export function settle(t, m) {
  if (t.result) return t.result;
  if (!m) return null;
  const { hg, ag } = m, p = String(t.pick).trim().toUpperCase().replace(',', '.');
  const r = hg > ag ? '1' : hg === ag ? 'X' : '2';
  if (['1', 'X', '2'].includes(p)) return p === r ? 'won' : 'lost';
  if (['1X', 'X2', '12'].includes(p)) return p.includes(r) ? 'won' : 'lost';
  if (p === 'GG') return hg && ag ? 'won' : 'lost';
  if (p === 'NG') return hg && ag ? 'lost' : 'won';
  const ou = p.match(/^(OVER|UNDER)\s*([\d.]+)$/);
  if (ou) { const line = +ou[2], g = hg + ag; if (g === line) return 'void'; return (ou[1] === 'OVER') === g > line ? 'won' : 'lost'; }
  return null;
}
export const pickLabel = (p, hn, an) => ({ 1: `1 (${hn})`, X: 'Χ (ισοπαλία)', 2: `2 (${an})`, '1X': `1Χ (${hn} ή ισοπαλία)`, X2: `Χ2 (${an} ή ισοπαλία)`, 12: '12 (όχι ισοπαλία)', GG: 'Γκολ-γκολ', NG: 'Όχι γκολ-γκολ' }[String(p).toUpperCase()] || String(p).replace(/^over/i, 'Over').replace(/^under/i, 'Under'));
