// Σεζόν τύπου football-data: Αύγουστος 2026 – Ιούνιος 2027 → "2627"
export function seasonCode(d = new Date()) {
  const y = d.getFullYear() % 100, start = d.getMonth() >= 6 ? y : y - 1;
  return String(start).padStart(2, '0') + String(start + 1).padStart(2, '0');
}
export function seasonLabel(code) { return `20${code.slice(0, 2)}–${code.slice(2)}`; }
