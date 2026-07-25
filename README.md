# Kaza Rehberi — Lead Magnet (Sigortanın Sesi)

"Kaza Sonrası İlk 48 Saat" ücretsiz rehberini dağıtan statik açılış sayfası (landing page).

## Yapı
- `index.html` — sayfa (hero + form, "ne var", güven, footer, teşekkür ekranı, KVKK modal)
- `style.css` — kurumsal tasarım (Navy #1F3864, Turuncu #E2661C, Cream #F5F1EB), mobil öncelikli
- `script.js` — form doğrulama, KVKK zorunlu onay, gönderim sonrası teşekkür + otomatik PDF indirme
- `public/Kaza_Sonrasi_Ilk_48_Saat_Rehberi.pdf` — dağıtılan rehber

## Akış
1. Kullanıcı formu doldurur (Ad Soyad*, E-posta*, Telefon, KVKK onayı*).
2. Gönderince: kayıt `console.log`'a ve `localStorage`'a (`ss_leads`) yazılır.
3. Teşekkür ekranı gösterilir + PDF otomatik indirilir + Sigorta Pusula bilgisi.

## Yapılacaklar
- [ ] **Brevo entegrasyonu**: `script.js` içindeki `console.log("[LEAD] ...")` bloğu, Brevo API key gelince
  `fetch("https://api.brevo.com/v3/contacts", ...)` çağrısıyla değiştirilecek; kişi ilgili listeye eklenecek.
  (API key istemci tarafında tutulmaz — Vercel Serverless Function / edge route arkasına alınmalı.)
- [ ] **KVKK metni**: Modaldaki metin standart taslaktır; Kerim'in nihai "Aydınlatma ve Açık Rıza Metni" ile değiştirilecek.
- [ ] **Görseller**: Kerim Bağdaş fotoğrafı (şu an baş harf avatarı) ve gerçek logo eklenebilir.
- [ ] **Alan adı**: `rehber.sigortaninsesi.com` veya `sigortaninsesi.com/rehber` bağlanacak.

## Deploy
Statik site — build gerekmez. Vercel'de "Other" framework olarak servis edilir.
```
vercel --prod
```

## Notlar
- HasarSesi/V1 ve Sigorta Pusula projelerinden bağımsızdır.
