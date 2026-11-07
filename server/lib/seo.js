// SEO: naslov, opis i strukturirani podaci se ubacuju u HTML na serveru,
// da Google i dijeljenje na Viber/Facebook vide pravi sadržaj svake stranice.
import { q } from '../db/index.js';
import { slugify, int } from './util.js';
import { uEkavicu } from './ekavica.js';

export function sajt(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').replace(/:\d+$/, '').replace(/^www\./, '');
  const srbija = host.includes('bazadelova');
  return {
    srbija,
    ime: srbija ? 'Baza delova' : 'Baza dijelova',
    url: `https://${host || 'bazadijelova.com'}`,
  };
}

export const dioUrl = (d) => `/dio/${d.id}-${slugify([d.naziv, d.marka, d.generacija].filter(Boolean).join(' ')).slice(0, 80)}`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const skrati = (s, n = 155) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

// Vraća { naslov, opis, slika, jsonld, status } za datu putanju
async function podaci(putanja) {
  let m;
  if ((m = putanja.match(/^\/dio\/(\d+)/))) {
    const { rows: [d] } = await q(`
      SELECT d.id, d.naziv, d.oem, d.cijena_km, d.stanje, d.km, d.godiste, d.status, d.slike, d.opis,
             m.naziv marka, g.naziv generacija, o.naziv otpad, o.grad
      FROM dijelovi d JOIN otpadi o ON o.id = d.otpad_id AND o.odobren
      LEFT JOIN marke m ON m.id = d.marka_id LEFT JOIN generacije g ON g.id = d.generacija_id WHERE d.id = $1`, [int(m[1])]);
    if (!d) return { status: 404, naslov: 'Dio nije pronađen' };
    const vozilo = [d.marka, d.generacija].filter(Boolean).join(' ');
    const cijena = d.cijena_km > 0 ? `${Math.round(d.cijena_km)} KM` : 'cijena na upit';
    return {
      naslov: `${d.naziv}${vozilo ? ` ${vozilo}` : ''}${d.oem ? ` ${d.oem}` : ''} — ${cijena}`,
      opis: skrati(`Polovni ${d.naziv.toLowerCase()}${vozilo ? ` za ${vozilo}` : ''}${d.godiste ? ` (${d.godiste})` : ''}${d.oem ? `, OEM ${d.oem}` : ''}. ${cijena}, ${d.otpad}, ${d.grad}. Dostava ili lično preuzimanje.`),
      slika: d.slike?.[0],
      kanonski: dioUrl(d),
      jsonld: {
        '@context': 'https://schema.org', '@type': 'Product', name: `${d.naziv} ${vozilo}`.trim(),
        sku: String(d.id), mpn: d.oem || undefined, brand: d.marka ? { '@type': 'Brand', name: d.marka } : undefined,
        image: d.slike?.length ? d.slike : undefined, itemCondition: 'https://schema.org/UsedCondition',
        offers: d.cijena_km > 0 ? {
          '@type': 'Offer', price: Number(d.cijena_km).toFixed(2), priceCurrency: 'BAM',
          availability: d.status === 'aktivan' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
          seller: { '@type': 'Organization', name: d.otpad },
        } : undefined,
      },
    };
  }
  if ((m = putanja.match(/^\/marka\/([a-z0-9-]+)/))) {
    const { rows: [mk] } = await q(`SELECT naziv FROM marke WHERE slug = $1`, [m[1]]);
    if (!mk) return { status: 404, naslov: 'Marka ne postoji' };
    return { naslov: `${mk.naziv} polovni dijelovi iz otpada`, opis: `Polovni originalni dijelovi za ${mk.naziv} iz otpada širom BiH. Izaberite model i generaciju i pronađite dio po najboljoj cijeni.` };
  }
  if ((m = putanja.match(/^\/generacija\/(\d+)/))) {
    const { rows: [g] } = await q(`
      SELECT g.naziv, g.od_god, g.do_god, m.naziv marka,
        (SELECT COUNT(*)::int FROM dijelovi d WHERE d.generacija_id = g.id AND d.status = 'aktivan') broj
      FROM generacije g JOIN modeli mo ON mo.id = g.model_id JOIN marke m ON m.id = mo.marka_id WHERE g.id = $1`, [int(m[1])]);
    if (!g) return { status: 404, naslov: 'Vozilo ne postoji' };
    return {
      naslov: `${g.marka} ${g.naziv} (${g.od_god}-${g.do_god}) polovni dijelovi`,
      opis: `${g.broj} polovnih dijelova za ${g.marka} ${g.naziv} ${g.od_god}-${g.do_god}: motor, mjenjač, karoserija, svjetla, elektrika. Ponuda više otpada na jednom mjestu.`,
    };
  }
  if ((m = putanja.match(/^\/otpad\/([a-z0-9-]+)/))) {
    const { rows: [o] } = await q(`
      SELECT naziv, grad, adresa, telefon, lat, lng,
        (SELECT COUNT(*)::int FROM dijelovi d WHERE d.otpad_id = otpadi.id AND d.status = 'aktivan') broj
      FROM otpadi WHERE slug = $1 AND odobren`, [m[1]]);
    if (!o) return { status: 404, naslov: 'Otpad nije pronađen' };
    return {
      naslov: `${o.naziv}, ${o.grad} — auto otpad, polovni dijelovi`,
      opis: `${o.naziv} iz mjesta ${o.grad}: ${o.broj} polovnih auto dijelova u ponudi. Pogledajte cijene, naručite ili pošaljite upit.`,
      jsonld: {
        '@context': 'https://schema.org', '@type': 'AutoPartsStore', name: o.naziv, telephone: o.telefon || undefined,
        address: { '@type': 'PostalAddress', streetAddress: o.adresa || undefined, addressLocality: o.grad },
        geo: o.lat ? { '@type': 'GeoCoordinates', latitude: o.lat, longitude: o.lng } : undefined,
      },
    };
  }
  const staticne = {
    '/': ['Polovni auto dijelovi iz otpada', 'Polovni originalni auto dijelovi iz otpada širom BiH na jednom mjestu. Pretraga po OEM broju, marki i modelu, narudžba i dostava.'],
    '/marke': ['Marke vozila — polovni dijelovi', 'Izaberite marku vozila i pronađite polovne originalne dijelove iz otpada.'],
    '/otpadi': ['Auto otpadi', 'Spisak auto otpada sa ponudom polovnih dijelova, ocjenama kupaca i cijenom dostave.'],
    '/trazim': ['Tražim dio — otpadi vam šalju ponude', 'Ne možete naći dio? Objavite šta tražite, a otpadi vam šalju ponude sa cijenom.'],
    '/dijelovi': ['Polovni auto dijelovi', 'Pretražite polovne auto dijelove po nazivu ili OEM broju.'],
    '/za-otpade': ['Za otpade — prodajte dijelove online', 'Postavite dijelove svog otpada na bazadijelova, primajte narudžbe i upite na Telegram.'],
  };
  if (staticne[putanja]) return { naslov: staticne[putanja][0], opis: staticne[putanja][1] };
  return {};
}

export async function ubaciMeta(html, req) {
  const s = sajt(req);
  const putanja = req.path;
  let p = {};
  try { p = await podaci(putanja); } catch (e) { console.error('SEO:', e.message); }
  const ek = (t) => (s.srbija ? uEkavicu(t) : t);
  const naslov = esc(ek(p.naslov ? `${p.naslov} | ${s.ime}` : `${s.ime} — polovni auto dijelovi iz otpada`));
  const opis = esc(ek(p.opis || 'Polovni originalni auto dijelovi iz otpada na jednom mjestu.'));
  const kanonski = `${s.url}${p.kanonski || (putanja === '/' ? '/' : putanja)}`;
  const slika = p.slika ? (p.slika.startsWith('http') ? p.slika : `${s.url}${p.slika}`) : `${s.url}/favicon.svg`;
  const privatno = /^\/(panel|admin|korpa|moj-nalog|prijava|registracija|sacuvano|zahtjev\/|ocjena\/)/.test(putanja);

  const glava = [
    `<title>${naslov}</title>`,
    `<meta name="description" content="${opis}" />`,
    `<link rel="canonical" href="${esc(kanonski)}" />`,
    privatno || p.status === 404 ? '<meta name="robots" content="noindex" />' : '',
    `<meta property="og:title" content="${naslov}" />`,
    `<meta property="og:description" content="${opis}" />`,
    `<meta property="og:url" content="${esc(kanonski)}" />`,
    `<meta property="og:image" content="${esc(slika)}" />`,
    `<meta property="og:type" content="${putanja.startsWith('/dio/') ? 'product' : 'website'}" />`,
    `<meta property="og:site_name" content="${s.ime}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    p.jsonld ? `<script type="application/ld+json">${JSON.stringify(p.jsonld).replace(/</g, '\\u003c')}</script>` : '',
  ].filter(Boolean).join('\n    ');

  const out = html
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace('<html lang="bs">', `<html lang="${s.srbija ? 'sr-Latn' : 'bs'}">`)
    .replace('</head>', `    ${glava}\n  </head>`);
  return { html: out, status: p.status || 200 };
}

export async function sitemap(req) {
  const s = sajt(req);
  const urls = ['/', '/marke', '/otpadi', '/trazim', '/za-otpade'];
  const [{ rows: marke }, { rows: gens }, { rows: otpadi }, { rows: dijelovi }] = await Promise.all([
    q(`SELECT slug FROM marke`),
    q(`SELECT DISTINCT d.generacija_id id FROM dijelovi d WHERE d.status = 'aktivan' AND d.generacija_id IS NOT NULL`),
    q(`SELECT slug FROM otpadi WHERE odobren`),
    q(`SELECT d.id, d.naziv, d.azuriran, m.naziv marka, g.naziv generacija FROM dijelovi d
       JOIN otpadi o ON o.id = d.otpad_id AND o.odobren
       LEFT JOIN marke m ON m.id = d.marka_id LEFT JOIN generacije g ON g.id = d.generacija_id
       WHERE d.status = 'aktivan' ORDER BY d.azuriran DESC LIMIT 45000`),
  ]);
  for (const m of marke) urls.push(`/marka/${m.slug}`);
  for (const g of gens) urls.push(`/generacija/${g.id}`);
  for (const o of otpadi) urls.push(`/otpad/${o.slug}`);
  const stavke = urls.map((u) => `<url><loc>${s.url}${u}</loc></url>`);
  for (const d of dijelovi)
    stavke.push(`<url><loc>${s.url}${esc(dioUrl(d))}</loc><lastmod>${new Date(d.azuriran).toISOString().slice(0, 10)}</lastmod></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${stavke.join('\n')}\n</urlset>`;
}

export function robots(req) {
  const s = sajt(req);
  return `User-agent: *\nDisallow: /panel\nDisallow: /admin\nDisallow: /api/\nDisallow: /korpa\nDisallow: /moj-nalog\nDisallow: /zahtjev/\nDisallow: /ocjena/\nSitemap: ${s.url}/sitemap.xml\n`;
}
