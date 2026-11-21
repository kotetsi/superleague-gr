// Αναρτήσεις στο κανάλι Telegram. Τρέχει μετά το build· στέλνει όσες αναρτήσεις του telegram-queue.json δεν έχουν σταλεί.
//   TELEGRAM_TOKEN: token του bot (@BotFather) · TELEGRAM_CHAT: το κανάλι, π.χ. @superleague_stats
//   TELEGRAM_DRY=1: τυπώνει χωρίς να στέλνει. Χωρίς token/κανάλι δεν κάνει τίποτα.
import fs from 'node:fs/promises';
const TOKEN = String(process.env.TELEGRAM_TOKEN || '').replace(/\s+/g, ''), CHAT = String(process.env.TELEGRAM_CHAT || '').trim(), DRY = process.env.TELEGRAM_DRY === '1';
if ((!TOKEN || !CHAT) && !DRY) { console.log('Telegram: δεν έχουν οριστεί TELEGRAM_TOKEN / TELEGRAM_CHAT, παράλειψη.'); process.exit(0); }
const queue = JSON.parse(await fs.readFile('telegram-queue.json', 'utf8').catch(() => '[]'));
const STATE = 'data/telegram.json';
const state = JSON.parse(await fs.readFile(STATE, 'utf8').catch(() => '{"posted":[]}'));
let sent = 0;
for (const p of queue) {
  if (state.posted.includes(p.key)) continue;
  if (DRY) { console.log(`--- ${p.key}\n${p.text}\n`); continue; }
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: CHAT, text: p.text, parse_mode: 'HTML', disable_web_page_preview: true }) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) { console.log(`Telegram: σφάλμα στο ${p.key}: ${j.description || r.status}`); continue; }
  state.posted.push(p.key); sent++;
  await new Promise(z => setTimeout(z, 1500));
}
state.posted = state.posted.slice(-500);
if (!DRY) await fs.writeFile(STATE, JSON.stringify(state, null, 1));
console.log(`Telegram: ${sent} νέες αναρτήσεις`);
