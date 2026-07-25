// Kaza Rehberi — lead aboneliği (Brevo)
// POST /api/subscribe  { name, email, phone, kvkk }
// - Kişiyi "Kaza Rehberi İndirenler" listesine ekler (yoksa listeyi oluşturur)
// - Otomatik "rehberiniz hazır" mailini gönderir (PDF linki + Sigorta Pusula)
// API anahtarı YALNIZCA sunucuda: process.env.BREVO_API_KEY (Vercel env var).

const BREVO = 'https://api.brevo.com/v3';
const LIST_NAME = 'Kaza Rehberi İndirenler';
const ALLOW_ORIGINS = [
  'https://sigortaninsesi-rehber.vercel.app',
  'https://hasarsesi.com',
  'https://www.hasarsesi.com',
];

// Warm instance'lar için liste id'sini hafızada tut (her istekte aramamak için).
let cachedListId = null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function brevo(key, path, method, payload) {
  return fetch(BREVO + path, {
    method,
    headers: {
      'api-key': key,
      'content-type': 'application/json; charset=utf-8',
      accept: 'application/json',
    },
    // String gövde: Node fetch bunu UTF-8 kodlar ve Content-Length'i doğru
    // (bayt) hesaplar. (Buffer verince bazı runtime'larda Content-Length
    // uyuşmazlığı olup Türkçe içeren istek reddedilebiliyor.)
    body: payload ? JSON.stringify(payload) : undefined,
  });
}

// "05xx..." / "5xx..." / "+90..." → E.164 (+90XXXXXXXXXX) veya null.
function toE164TR(raw) {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('90') && d.length === 12) return '+' + d;
  if (d.startsWith('0') && d.length === 11) return '+90' + d.slice(1);
  if (d.length === 10 && d.startsWith('5')) return '+90' + d;
  if (d.startsWith('90') && d.length === 12) return '+' + d;
  return null;
}

async function ensureListId(key) {
  if (cachedListId) return cachedListId;
  // Var olan listeyi ara
  for (let offset = 0; offset < 2000; offset += 50) {
    const r = await brevo(key, `/contacts/lists?limit=50&offset=${offset}`, 'GET');
    if (!r.ok) break;
    const j = await r.json();
    const lists = j.lists || [];
    const found = lists.find((l) => l.name === LIST_NAME);
    if (found) { cachedListId = found.id; return found.id; }
    if (lists.length < 50) break;
  }
  // Klasör bul/oluştur (liste için folderId gerekir)
  let folderId = null;
  const fr = await brevo(key, '/contacts/folders?limit=10&offset=0', 'GET');
  if (fr.ok) {
    const fj = await fr.json();
    if (fj.folders && fj.folders[0]) folderId = fj.folders[0].id;
  }
  if (!folderId) {
    const cf = await brevo(key, '/contacts/folders', 'POST', { name: 'Sigortanın Sesi' });
    if (cf.ok) { const cj = await cf.json(); folderId = cj.id; }
  }
  if (!folderId) return null;
  const cl = await brevo(key, '/contacts/lists', 'POST', { name: LIST_NAME, folderId });
  if (cl.ok) { const cj = await cl.json(); cachedListId = cj.id; return cj.id; }
  return null;
}

function emailHtml(name, pdfUrl) {
  const ilk = (name || '').split(' ')[0] || '';
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#F5F1EB;font-family:Arial,Helvetica,sans-serif;color:#22262e">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F1EB;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e4ddd1">
        <tr><td style="background:#1F3864;padding:22px 28px;color:#fff;font-family:Georgia,serif;font-size:20px;font-weight:bold">Sigortanın Sesi</td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 10px;font-family:Georgia,serif;color:#1F3864;font-size:24px">Rehberiniz hazır${ilk ? ', ' + ilk : ''}!</h1>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#3c434e">
            <strong>Kaza Sonrası İlk 48 Saat</strong> rehberini indirmek için aşağıdaki butona tıklayın.
            Binlerce lira kaybettiren 7 hatayı ve hakkınızı korumanın yollarını içinde bulacaksınız.
          </p>
          <p style="margin:0 0 24px">
            <a href="${pdfUrl}" style="display:inline-block;background:#E2661C;color:#fff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:11px;font-size:16px">Rehberi İndir (PDF)</a>
          </p>
          <table role="presentation" width="100%" style="background:#F5F1EB;border:1px solid #e4ddd1;border-radius:12px">
            <tr><td style="padding:16px 18px;font-size:14px;line-height:1.6;color:#3c434e">
              <strong style="color:#1F3864">Sigorta Pusula</strong> uygulamamıza da göz atın: aracınızın değer kaybını
              saniyeler içinde hesaplayın, poliçenizi anlaşılır dille okutun. App Store'da ücretsiz.
            </td></tr>
          </table>
          <p style="margin:20px 0 0;font-size:12px;color:#8a8f98">
            Bu e-postayı, ücretsiz rehberi talep ettiğiniz için aldınız. Aboneliğiniz için teşekkürler.
          </p>
        </td></tr>
        <tr><td style="background:#182c4e;padding:16px 28px;color:#9fb2d1;font-size:12px">© Sigortanın Sesi · Bağımsız sigorta medya platformu</td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function emailText(name, pdfUrl) {
  const ilk = (name || '').split(' ')[0] || '';
  return `Rehberiniz hazır${ilk ? ', ' + ilk : ''}!\n\n` +
    `Kaza Sonrası İlk 48 Saat rehberini indirin: ${pdfUrl}\n\n` +
    `Sigorta Pusula uygulamamıza da göz atın (App Store'da ücretsiz): aracınızın değer kaybını hesaplayın, poliçenizi anlaşılır dille okutun.\n\n` +
    `© Sigortanın Sesi`;
}

export default async function handler(req, res) {
  // ---- CORS ----
  const origin = req.headers.origin || '';
  const allowOrigin = ALLOW_ORIGINS.includes(origin) ? origin : ALLOW_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const key = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL || 'kerim.bagdas@sigortaninsesi.com';
  const fromName = process.env.BREVO_FROM_NAME || 'Sigortanın Sesi';
  const pdfUrl = process.env.REHBER_PDF_URL ||
    'https://sigortaninsesi-rehber.vercel.app/public/Kaza_Sonrasi_Ilk_48_Saat_Rehberi.pdf';
  if (!key) {
    return res.status(500).json({ ok: false, error: 'Sunucu yapılandırması eksik (BREVO_API_KEY).' });
  }

  // ---- gövde ----
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  const kvkk = body.kvkk === true;

  if (!name || !EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: 'Ad soyad ve geçerli e-posta gerekli.' });
  }
  if (!kvkk) {
    return res.status(400).json({ ok: false, error: 'Devam için KVKK onayı gerekli.' });
  }

  try {
    const listId = await ensureListId(key);

    // ---- kişi ekle/güncelle ----
    // NOT: Bu Brevo hesabında FIRSTNAME + SMS aynı payload'da gönderilince
    // FIRSTNAME düşüyor. Bu yüzden isim ile telefonu AYRI çağrılarla yazıyoruz.
    // 1) İsim + listeye ekleme
    const cr = await brevo(key, '/contacts', 'POST', {
      email,
      attributes: { FIRSTNAME: name },
      updateEnabled: true,
      ...(listId ? { listIds: [listId] } : {}),
    });
    if (!cr.ok && cr.status !== 204) {
      const j = await cr.json().catch(() => ({}));
      if (j && j.code !== 'duplicate_parameter') {
        console.error('[subscribe] contact hata', cr.status, JSON.stringify(j));
      }
    }
    // 2) Telefon (varsa) — ayrı PUT ile; merge olur, FIRSTNAME korunur
    const sms = toE164TR(phone);
    if (sms) {
      const pr = await brevo(
        key,
        `/contacts/${encodeURIComponent(email)}`,
        'PUT',
        { attributes: { SMS: sms } },
      );
      if (!pr.ok && pr.status !== 204) {
        console.error('[subscribe] telefon güncelleme hata', pr.status);
      }
    }

    // ---- otomatik mail ----
    const er = await brevo(key, '/smtp/email', 'POST', {
      sender: { name: fromName, email: fromEmail },
      to: [{ email, name }],
      replyTo: { email: fromEmail, name: fromName },
      subject: 'Rehberiniz hazır: Kaza Sonrası İlk 48 Saat',
      htmlContent: emailHtml(name, pdfUrl),
      textContent: emailText(name, pdfUrl),
      tags: ['kaza-rehberi'],
    });
    if (!er.ok) {
      const ej = await er.json().catch(() => ({}));
      console.error('[subscribe] mail hata', er.status, JSON.stringify(ej));
      return res.status(502).json({ ok: false, error: 'Rehber maili gönderilemedi. Lütfen tekrar deneyin.' });
    }

    return res.status(200).json({ ok: true, listId: listId || null });
  } catch (e) {
    console.error('[subscribe] sunucu hatası', e && e.message);
    return res.status(500).json({ ok: false, error: 'Sunucu hatası. Lütfen tekrar deneyin.' });
  }
}
