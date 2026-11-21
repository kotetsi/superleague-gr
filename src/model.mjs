// Μοντέλο γκολ Dixon-Coles, με δυνάμεις ομάδων που μαθαίνουν από τα γκολ ΚΑΙ από τις τελικές αποδόσεις των προηγούμενων αγώνων.
// Backtest 1.727 αγώνων 2018–2026 (ρυθμίσεις μόνο από 2016–18): log loss 0,939 (αγορά 0,925, μοντέλο μόνο με γκολ 0,947).
// Η αγορά είναι πιο ακριβής, γι' αυτό τα ποσοστά 1-Χ-2 / over του site είναι της αγοράς· το μοντέλο δίνει αναμενόμενα γκολ και σκορ.
export const PARAMS = { hl: 120, k: 1, rho: -0.1, beta: 0.8 };

const fact = n => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };
const pois = (l, n) => Math.exp(-l) * l ** n / fact(n);

export function devig(...o) { const iv = o.map(x => 1 / x), z = iv.reduce((a, b) => a + b, 0); return iv.map(x => x / z); }

// πίνακας (λ, μ) → πιθανότητες 1, Χ, over 2,5 για την εκτίμηση των «γκολ που περίμενε η αγορά»
const GRID = (() => {
  const L = Array.from({ length: 40 }, (_, i) => (i + 1) / 10), P = L.map(l => Array.from({ length: 11 }, (_, i) => pois(l, i))), out = [];
  for (let a = 0; a < 40; a++) for (let b = 0; b < 40; b++) {
    let H = 0, D = 0, O = 0;
    for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) { const v = P[a][i] * P[b][j]; if (i > j) H += v; else if (i === j) D += v; if (i + j > 2) O += v; }
    out.push([L[a], L[b], H, D, O]);
  }
  return out;
})();

/** αναμενόμενα γκολ γηπεδούχου/φιλοξενούμενου που κρύβουν οι αποδόσεις ενός αγώνα */
export function marketXG(m) {
  if (!m.odds) return null;
  const P = devig(...m.odds);
  let po = null;
  if (m.ou?.[0] && m.ou?.[1]) po = devig(m.ou[0], m.ou[1])[0];
  else if (m.ou?.[0]) po = Math.min(Math.max(1 / m.ou[0] / 1.04, 0.05), 0.95);
  let best = null, bd = Infinity;
  for (const r of GRID) {
    let d = (r[2] - P[0]) ** 2 + (r[3] - P[1]) ** 2 + (1 - r[2] - r[3] - P[2]) ** 2;
    d += po != null ? 0.5 * (r[4] - po) ** 2 : 0.005 * (r[0] + r[1] - 2.45) ** 2;
    if (d < bd) { bd = d; best = r; }
  }
  return [best[0], best[1]];
}

/** δυνάμεις ομάδων από αγώνες πριν από την ημερομηνία ref */
export function fit(matches, ref, p = PARAMS) {
  const { hl, k, beta } = p;
  const tRef = Date.parse(ref) / 864e5;
  const P = matches.filter(m => m.date < ref && tRef - Date.parse(m.date) / 864e5 <= 1100);
  const T = [...new Set(P.flatMap(m => [m.h, m.a]))];
  const W = P.map(m => 0.5 ** ((tRef - Date.parse(m.date) / 864e5) / hl));
  const gh = m => m.mx ? (1 - beta) * m.hg + beta * m.mx[0] : m.hg;
  const ga = m => m.mx ? (1 - beta) * m.ag + beta * m.mx[1] : m.ag;
  const att = Object.fromEntries(T.map(t => [t, 1])), def = Object.fromEntries(T.map(t => [t, 1]));
  let hf = 1.3;
  for (let it = 0; it < 40; it++) {
    const nA = {}, dA = {}; T.forEach(t => { nA[t] = k; dA[t] = k; });
    P.forEach((m, i) => { const w = W[i]; nA[m.h] += w * gh(m); dA[m.h] += w * hf * def[m.a]; nA[m.a] += w * ga(m); dA[m.a] += w * def[m.h]; });
    T.forEach(t => { att[t] = nA[t] / dA[t]; });
    const ma = T.reduce((s, t) => s + att[t], 0) / T.length; T.forEach(t => { att[t] /= ma; });
    const nD = {}, dD = {}; T.forEach(t => { nD[t] = k; dD[t] = k; });
    P.forEach((m, i) => { const w = W[i]; nD[m.a] += w * gh(m); dD[m.a] += w * hf * att[m.h]; nD[m.h] += w * ga(m); dD[m.h] += w * att[m.a]; });
    T.forEach(t => { def[t] = nD[t] / dD[t]; });
    let nh = 0, dh = 0; P.forEach((m, i) => { nh += W[i] * gh(m); dh += W[i] * att[m.h] * def[m.a]; }); hf = nh / dh;
  }
  return { att, def, hf };
}

/** πιθανότητες αγώνα από τα αναμενόμενα γκολ */
export function matchProbs(lam, mu, rho = PARAMS.rho) {
  const G = []; let s = 0;
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) {
    let t = 1;
    if (i === 0 && j === 0) t = 1 - lam * mu * rho; else if (i === 0 && j === 1) t = 1 + lam * rho; else if (i === 1 && j === 0) t = 1 + mu * rho; else if (i === 1 && j === 1) t = 1 - rho;
    const v = pois(lam, i) * pois(mu, j) * t; G.push([i, j, v]); s += v;
  }
  let h = 0, d = 0, o25 = 0, btts = 0;
  for (const g of G) { g[2] /= s; const [i, j, v] = g; if (i > j) h += v; else if (i === j) d += v; if (i + j > 2) o25 += v; if (i && j) btts += v; }
  const top = [...G].sort((a, b) => b[2] - a[2]).slice(0, 3).map(([i, j, v]) => [`${i}-${j}`, v]);
  return { h, d, a: 1 - h - d, o25, btts, top };
}

export function predict(F, h, a) {
  const A = t => F.att[t] ?? 0.8, D = t => F.def[t] ?? 1.25;
  const lam = F.hf * A(h) * D(a), mu = A(a) * D(h);
  return { lam, mu, ...matchProbs(lam, mu) };
}
