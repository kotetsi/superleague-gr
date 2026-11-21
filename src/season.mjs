// Σεζόν τύπου football-data: Αύγουστος 2026 – Ιούνιος 2027 → "2627"
export function seasonCode(d = new Date()) {
  const y = d.getFullYear() % 100, start = d.getMonth() >= 6 ? y : y - 1;
  return String(start).padStart(2, '0') + String((start + 1) % 100).padStart(2, '0');
}
export const seasonStart = code => (+code.slice(0, 2) >= 90 ? 1900 : 2000) + +code.slice(0, 2);
export function seasonLabel(code) { return `${seasonStart(code)}–${code.slice(2)}`; }
