// Αποδόσεις από τα CSV του football-data: ανά εταιρεία, πριν (άνοιγμα) και κλείσιμο.
export const BOOKS = { B365: 'bet365', BW: 'bwin', PP: 'Paddy Power', BV: 'BetVictor', BFD: 'Betfred', SKB: 'Sky Bet' };
const n = v => (v === '' || v == null || !(+v > 1) ? null : +v);
const tri = (r, p, c = '') => { const o = ['H', 'D', 'A'].map(x => n(r[p + c + x])); return o.every(Boolean) ? o : null; };
/** { open: {book:[h,d,a]}, close: {...}, avgO, avgC, maxO, maxC, ouO:{book:[o,u]}, ouC, ah:{line, ...} } */
export function oddsOf(r) {
  const o = { open: {}, close: {}, ouO: {}, ouC: {} };
  for (const b of Object.keys(BOOKS)) {
    const a = tri(r, b), c = tri(r, b, 'C'); if (a) o.open[b] = a; if (c) o.close[b] = c;
  }
  o.avgO = tri(r, 'Avg'); o.avgC = tri(r, 'Avg', 'C'); o.maxO = tri(r, 'Max'); o.maxC = tri(r, 'Max', 'C');
  o.pinO = tri(r, 'PS'); o.pinC = tri(r, 'PS', 'C'); o.bfeO = tri(r, 'BFE'); o.bfeC = tri(r, 'BFE', 'C');
  // «έξυπνα χρήματα»: Pinnacle (έως 2025) ή Betfair Exchange, άνοιγμα και κλείσιμο από την ίδια πηγή
  if (o.pinO && o.pinC) { o.shO = o.pinO; o.shC = o.pinC; o.sh = 'Pinnacle'; } else if (o.bfeO && o.bfeC) { o.shO = o.bfeO; o.shC = o.bfeC; o.sh = 'Betfair'; }
  for (const [b, k] of [['B365', 'B365'], ['Max', 'Max'], ['Avg', 'Avg']]) {
    const ov = n(r[k + '>2.5']), un = n(r[k + '<2.5']); if (ov && un) o.ouO[b] = [ov, un];
    const ovc = n(r[k + 'C>2.5']), unc = n(r[k + 'C<2.5']); if (ovc && unc) o.ouC[b] = [ovc, unc];
  }
  const line = r.AHh === '' ? null : +r.AHh;
  if (line != null && !Number.isNaN(line)) o.ah = { line, b365: [n(r.B365AHH), n(r.B365AHA)], max: [n(r.MaxAHH), n(r.MaxAHA)], avg: [n(r.AvgAHH), n(r.AvgAHA)] };
  return o;
}
/** καλύτερη τιμή ανά έκβαση από τις επώνυμες εταιρείες: [[τιμή, εταιρεία] ×3] */
export function bestOf(books) {
  return [0, 1, 2].map(i => Object.entries(books).reduce((b, [k, v]) => (v[i] > (b?.[0] || 0) ? [v[i], k] : b), null));
}
