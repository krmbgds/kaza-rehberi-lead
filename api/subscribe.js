// Sigortanın Sesi — lead aboneliği (Brevo), çok-magnet.
// POST /api/subscribe  { name, email, phone?, company?, kvkk, list? }
//   list: 'kaza-rehberi' (varsayılan) | 'sektor-raporu'
// - Kişiyi ilgili Brevo listesine ekler (yoksa oluşturur)
// - Otomatik "hazır" mailini gönderir (PDF linki + Sigorta Pusula)
// API anahtarı YALNIZCA sunucuda: process.env.BREVO_API_KEY (Vercel env var).

const BREVO = 'https://api.brevo.com/v3';
const ALLOW_ORIGINS = [
  'https://sigortaninsesi-rehber.vercel.app',
  'https://hasarsesi.com',
  'https://www.hasarsesi.com',
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Her lead magnet için ayrı liste + mail içeriği.
const MAGNETS = {
  'kaza-rehberi': {
    listName: 'Kaza Rehberi İndirenler',
    subject: 'Rehberiniz hazır: Kaza Sonrası İlk 48 Saat',
    title: 'Kaza Sonrası İlk 48 Saat',
    greet: 'Rehberiniz',
    btn: 'Rehberi İndir (PDF)',
    accus: 'rehberi',
    intro: 'rehberini indirmek için aşağıdaki butona tıklayın. Binlerce lira kaybettiren 7 hatayı ve hakkınızı korumanın yollarını içinde bulacaksınız.',
    promo: 'aracınızın değer kaybını saniyeler içinde hesaplayın, poliçenizi anlaşılır dille okutun. App Store\'da ücretsiz.',
    pdfDefault: 'https://sigortaninsesi-rehber.vercel.app/public/Kaza_Sonrasi_Ilk_48_Saat_Rehberi.pdf',
    pdfEnv: 'REHBER_PDF_URL',
    tag: 'kaza-rehberi',
  },
  'sektor-raporu': {
    listName: 'Sektör Raporu İndirenler',
    subject: 'Raporunuz hazır: Şirket Sağlık Tablosu',
    title: 'Şirket Sağlık Tablosu',
    greet: 'Raporunuz',
    btn: 'Raporu İndir (PDF)',
    accus: 'raporu',
    intro: 'raporunu indirmek için aşağıdaki butona tıklayın. TSB çeyreklik bilanço verisinden 69 şirketin Kritik / İzlemede / Sağlam sınıflandırmasını tek sayfada bulacaksınız.',
    promo: 'sigorta şirketlerinin mali durumunu çeyrek çeyrek takip edin, poliçeleri anlaşılır dille okutun. App Store\'da ücretsiz.',
    pdfDefault: 'https://sigortaninsesi-rehber.vercel.app/public/Sektor_Raporu_Sirket_Saglik.pdf',
    pdfEnv: 'RAPOR_PDF_URL',
    tag: 'sektor-raporu',
  },
};

// Warm instance'lar için liste id'lerini isim bazında hafızada tut.
const listIdCache = {};

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
  return null;
}

async function ensureListId(key, listName) {
  if (listIdCache[listName]) return listIdCache[listName];
  // Var olan listeyi ara
  for (let offset = 0; offset < 2000; offset += 50) {
    const r = await brevo(key, `/contacts/lists?limit=50&offset=${offset}`, 'GET');
    if (!r.ok) break;
    const j = await r.json();
    const lists = j.lists || [];
    const found = lists.find((l) => l.name === listName);
    if (found) { listIdCache[listName] = found.id; return found.id; }
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
  const cl = await brevo(key, '/contacts/lists', 'POST', { name: listName, folderId });
  if (cl.ok) { const cj = await cl.json(); listIdCache[listName] = cj.id; return cj.id; }
  return null;
}

function emailHtml(name, m, pdfUrl) {
  const ilk = (name || '').split(' ')[0] || '';
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#F5F1EB;font-family:Arial,Helvetica,sans-serif;color:#22262e">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F1EB;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e4ddd1">
        <tr><td style="background:#1F3864;padding:22px 28px;color:#fff;font-family:Georgia,serif;font-size:20px;font-weight:bold">Sigortanın Sesi</td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 10px;font-family:Georgia,serif;color:#1F3864;font-size:24px">${m.greet} hazır${ilk ? ', ' + ilk : ''}!</h1>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#3c434e">
            <strong>${m.title}</strong> ${m.intro}
          </p>
          <p style="margin:0 0 24px">
            <a href="${pdfUrl}" style="display:inline-block;background:#E2661C;color:#fff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:11px;font-size:16px">${m.btn}</a>
          </p>
          <table role="presentation" width="100%" style="background:#F5F1EB;border:1px solid #e4ddd1;border-radius:12px">
            <tr><td style="padding:16px 18px;font-size:14px;line-height:1.6;color:#3c434e">
              <strong style="color:#1F3864">Sigorta Pusula</strong> uygulamamıza da göz atın: ${m.promo}
            </td></tr>
          </table>
          <p style="margin:20px 0 0;font-size:12px;color:#8a8f98">
            Bu e-postayı, ücretsiz ${m.accus} talep ettiğiniz için aldınız. Aboneliğiniz için teşekkürler.
          </p>
        </td></tr>
        <tr><td style="background:#182c4e;padding:16px 28px;color:#9fb2d1;font-size:12px">© Sigortanın Sesi · Bağımsız sigorta medya platformu</td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function emailText(name, m, pdfUrl) {
  const ilk = (name || '').split(' ')[0] || '';
  return `${m.greet} hazır${ilk ? ', ' + ilk : ''}!\n\n` +
    `${m.title} — indirmek için: ${pdfUrl}\n\n` +
    `Sigorta Pusula uygulamamıza da göz atın (App Store'da ücretsiz).\n\n` +
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
  const fromEmail = process.env.BREVO_FROM_EMAIL || 'info@hasarsesi.com';
  const fromName = process.env.BREVO_FROM_NAME || 'Sigortanın Sesi';
  const replyToEmail = process.env.BREVO_REPLY_TO || 'kerim.bagdas@sigortaninsesi.com';
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
  const company = String(body.company || '').trim();
  const kvkk = body.kvkk === true;

  // Hangi lead magnet? Bilinmeyen slug → kaza-rehberi (güvenli varsayılan).
  const slug = MAGNETS[String(body.list || '').trim()] ? String(body.list).trim() : 'kaza-rehberi';
  const m = MAGNETS[slug];
  const pdfUrl = process.env[m.pdfEnv] || m.pdfDefault;

  if (!name || !EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: 'Ad soyad ve geçerli e-posta gerekli.' });
  }
  if (!kvkk) {
    return res.status(400).json({ ok: false, error: 'Devam için KVKK onayı gerekli.' });
  }

  try {
    const listId = await ensureListId(key, m.listName);

    // ---- kişi ekle/güncelle ----
    // NOT: Bu Brevo hesabında CREATE (POST /contacts) yolunda Türkçe değer
    // düşüyor. Bu yüzden önce kişiyi listeye ekliyoruz (attribute'suz), sonra
    // attribute'ları UPDATE (PUT) ile yazıyoruz.
    // 1) Kişiyi oluştur / listeye ekle
    const cr = await brevo(key, '/contacts', 'POST', {
      email,
      updateEnabled: true,
      ...(listId ? { listIds: [listId] } : {}),
    });
    if (!cr.ok) {
      const t = await cr.text().catch(() => '');
      console.error('[subscribe] contact ekleme hata', cr.status, t);
    }
    // 2) Attribute'ları update ile yaz (isim + varsa telefon + varsa şirket)
    const sms = toE164TR(phone);
    const attrs = { FIRSTNAME: name };
    if (sms) attrs.SMS = sms;
    if (company) attrs.FIRM_NAME = company; // acente/şirket adı
    const pr = await brevo(
      key,
      `/contacts/${encodeURIComponent(email)}`,
      'PUT',
      { attributes: attrs },
    );
    if (!pr.ok && pr.status !== 204) {
      const t = await pr.text().catch(() => '');
      console.error('[subscribe] attribute güncelleme hata', pr.status, t);
    }

    // ---- otomatik mail ----
    const er = await brevo(key, '/smtp/email', 'POST', {
      sender: { name: fromName, email: fromEmail },
      to: [{ email, name }],
      replyTo: { email: replyToEmail, name: fromName },
      subject: m.subject,
      htmlContent: emailHtml(name, m, pdfUrl),
      textContent: emailText(name, m, pdfUrl),
      tags: [m.tag],
    });
    if (!er.ok) {
      const ej = await er.json().catch(() => ({}));
      console.error('[subscribe] mail hata', er.status, JSON.stringify(ej));
      return res.status(502).json({ ok: false, error: 'Mail gönderilemedi. Lütfen tekrar deneyin.' });
    }

    return res.status(200).json({ ok: true, list: slug, listId: listId || null });
  } catch (e) {
    console.error('[subscribe] sunucu hatası', e && e.message);
    return res.status(500).json({ ok: false, error: 'Sunucu hatası. Lütfen tekrar deneyin.' });
  }
}
