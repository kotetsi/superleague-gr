// Προϊόντα του sportarena.gr από το XML feed (μορφή Skroutz/BestPrice). Η διεύθυνση μπαίνει στη μεταβλητή SHOP_FEED_URL.
import fs from 'node:fs/promises';
const URL = process.env.SHOP_FEED_URL;
if (!URL) { console.log('Eshop: δεν έχει οριστεί SHOP_FEED_URL, παράλειψη.'); process.exit(0); }
const r = await fetch(URL, { headers: { 'user-agent': 'superleague-gr/1.0' } });
if (!r.ok) { console.log('Eshop: HTTP ' + r.status); process.exit(0); }
const xml = await r.text();
const dec = s => String(s || '').replace(/^<!\[CDATA\[|\]\]>$/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const tag = (b, ...ns) => { for (const n of ns) { const m = b.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i')); if (m) return dec(m[1]); } return ''; };
const items = [...xml.matchAll(/<(product|item)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map(m => m[2]).map(b => ({
  id: tag(b, 'id', 'uid', 'mpn', 'sku'), name: tag(b, 'name', 'title'), link: tag(b, 'link', 'url'), img: tag(b, 'image', 'image_link', 'img', 'mainimage'),
  price: +tag(b, 'price_with_vat', 'price', 'g:price').replace(',', '.').replace(/[^\d.]/g, '') || null, cat: tag(b, 'category', 'category_path', 'product_type'),
  stock: !/^(n|0|out|εκτός|μη διαθέσιμο)/i.test(tag(b, 'instock', 'availability', 'in_stock') || 'y'),
})).filter(p => p.name && p.link && p.stock);
if (items.length < 5) { console.log(`Eshop: μόνο ${items.length} προϊόντα, κρατάω τα προηγούμενα`); process.exit(0); }
await fs.writeFile('data/shop.json', JSON.stringify({ updated: new Date().toISOString(), items }));
console.log(`Eshop: ${items.length} διαθέσιμα προϊόντα`);
