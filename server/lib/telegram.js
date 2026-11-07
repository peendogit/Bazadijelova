// Telegram obavještenja.
// Podešavanje: u .env TELEGRAM_BOT_TOKEN i TELEGRAM_BOT_IME (bez @). Bot se pravi kod @BotFather.
// Otpad se poveže tako što u panelu klikne link t.me/<bot>?start=<kod>; bot upamti chat id.
// Koristi "long polling", pa ne treba webhook ni posebno podešavanje na serveru.
// Važno: za ovaj sajt napravi poseban bot (ne isti kao za webshop), jer jedan bot ne može imati dva pollera.
import crypto from 'crypto';
import { q } from '../db/index.js';

const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || '';
export const BOT_IME = () => process.env.TELEGRAM_BOT_IME || '';
export const ukljucen = () => !!TOKEN();

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function tg(metoda, tijelo) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN()}/${metoda}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tijelo),
  });
  return res.json();
}

export async function posalji(chatId, html) {
  if (!ukljucen() || !chatId) return false;
  try {
    const r = await tg('sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true });
    return r.ok;
  } catch (e) {
    console.error('Telegram:', e.message);
    return false;
  }
}

export async function obavijestiOtpad(otpadId, html) {
  const { rows: [o] } = await q(`SELECT telegram_chat_id FROM otpadi WHERE id = $1`, [otpadId]);
  return posalji(o?.telegram_chat_id, html);
}

export async function obavijestiAdmina(html) {
  return posalji(process.env.TELEGRAM_ADMIN_CHAT_ID, html);
}

export function noviKod() {
  return crypto.randomBytes(9).toString('base64url');
}

// ---------- Poruke ----------

const SAJT = () => (process.env.SITE_URL || 'https://bazadijelova.com').replace(/\/$/, '');

export const poruke = {
  narudzba: (n, stavke) =>
    `🛒 <b>Nova narudžba #${n.id}</b>\n` +
    stavke.map((s) => `• ${esc(s.naziv)}${s.oem ? ` (${esc(s.oem)})` : ''} — ${s.cijena_km} KM`).join('\n') +
    `\n\n👤 ${esc(n.ime)}, 📞 ${esc(n.telefon)}\n` +
    (n.nacin === 'licno' ? '🏁 Lično preuzimanje' : `🚚 Dostava: ${esc(n.adresa)}, ${esc(n.grad)}`) +
    (n.napomena ? `\n📝 ${esc(n.napomena)}` : '') +
    `\n\n<a href="${SAJT()}/panel/narudzbe">Otvori narudžbe</a>`,
  upit: (u, dio) =>
    `💬 <b>Novi upit</b>${dio ? ` za: ${esc(dio.naziv)}` : ''}\n\n${esc(u.poruka)}\n\n👤 ${esc(u.ime)}` +
    (u.telefon ? `, 📞 ${esc(u.telefon)}` : '') + (u.email ? `, ✉️ ${esc(u.email)}` : '') +
    `\n\n<a href="${SAJT()}/panel/upiti">Otvori upite</a>`,
  zahtjev: (z, vozilo) =>
    `🔎 <b>Kupac traži dio</b>\n${esc(z.naziv)}${vozilo ? `\n🚗 ${esc(vozilo)}` : ''}${z.godiste ? `, ${z.godiste}` : ''}` +
    (z.oem ? `\nOEM: ${esc(z.oem)}` : '') + (z.opis ? `\n📝 ${esc(z.opis)}` : '') + (z.grad ? `\n📍 ${esc(z.grad)}` : '') +
    `\n\n<a href="${SAJT()}/panel/zahtjevi">Pošalji ponudu</a>`,
  ponuda: (p, otpad, z) =>
    `✅ <b>Nova ponuda za: ${esc(z.naziv)}</b>\n${esc(otpad)}${p.cijena_km ? ` — ${p.cijena_km} KM` : ''}` +
    (p.poruka ? `\n${esc(p.poruka)}` : '') + `\n\n<a href="${SAJT()}/zahtjev/${z.token}">Pogledaj ponude</a>`,
  ocjena: (o) => `⭐ <b>Nova ocjena: ${'★'.repeat(o.ocjena)}${'☆'.repeat(5 - o.ocjena)}</b>${o.komentar ? `\n${esc(o.komentar)}` : ''}`,
};

// ---------- Povezivanje (long polling) ----------

let pomak = 0;
let radi = false;

async function obradi(upd) {
  const m = upd.message;
  if (!m?.text) return;
  const chatId = String(m.chat.id);
  const [komanda, kod] = m.text.trim().split(/\s+/);
  if (komanda === '/start' && kod) {
    const { rows: [o] } = await q(
      `UPDATE otpadi SET telegram_chat_id = $2, telegram_kod = NULL WHERE telegram_kod = $1 RETURNING naziv`, [kod, chatId]);
    if (o) return posalji(chatId, `✅ Povezano s otpadom <b>${esc(o.naziv)}</b>.\nOvdje stižu nove narudžbe, upiti i zahtjevi kupaca.`);
    const { rows: [k] } = await q(
      `UPDATE korisnici SET telegram_chat_id = $2 WHERE id = (SELECT korisnik_id FROM zahtjevi WHERE token = $1 LIMIT 1) RETURNING ime`, [kod, chatId]);
    if (k) return posalji(chatId, '✅ Povezano. Ovdje ćete dobijati ponude otpada.');
    return posalji(chatId, 'Link nije važeći ili je već iskorišten. Otvorite panel otpada i kliknite „Poveži Telegram” ponovo.');
  }
  if (komanda === '/start') return posalji(chatId, 'Zdravo! Za povezivanje otvorite panel otpada na sajtu i kliknite „Poveži Telegram”.');
  if (komanda === '/id') return posalji(chatId, `Vaš chat id: <code>${chatId}</code>`);
}

export function pokreniPolling() {
  if (!ukljucen() || radi) return;
  radi = true;
  const krug = async () => {
    try {
      const r = await tg('getUpdates', { offset: pomak, timeout: 50, allowed_updates: ['message'] });
      if (r.ok) {
        for (const u of r.result) {
          pomak = u.update_id + 1;
          await obradi(u).catch((e) => console.error('Telegram obrada:', e.message));
        }
      } else if (r.error_code === 409) {
        console.error('Telegram: bot već koristi drugi program (webhook ili drugi poller). Napravite poseban bot.');
        await new Promise((s) => setTimeout(s, 60000));
      }
    } catch (e) {
      await new Promise((s) => setTimeout(s, 10000));
    }
    setImmediate(krug);
  };
  krug();
  console.log('Telegram bot uključen');
}
