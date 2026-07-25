/* ===== Sigortanın Sesi — Lead Magnet · script.js ===== */
(function () {
  "use strict";

  var PDF_PATH = "public/Kaza_Sonrasi_Ilk_48_Saat_Rehberi.pdf";

  // Yıl
  var yil = document.getElementById("yil");
  if (yil) yil.textContent = new Date().getFullYear();

  /* ---------- KVKK modal ---------- */
  var modal = document.getElementById("kvkkModal");
  function openModal(e) { if (e) e.preventDefault(); modal.hidden = false; document.body.style.overflow = "hidden"; }
  function closeModal() { modal.hidden = true; document.body.style.overflow = ""; }
  ["openKvkk", "openKvkk2"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("click", openModal);
  });
  modal.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-close")) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });

  /* ---------- Form ---------- */
  var form = document.getElementById("leadForm");
  var errBox = document.getElementById("formErr");

  function showErr(msg) {
    errBox.textContent = msg;
    errBox.hidden = false;
  }
  function clearErr() {
    errBox.hidden = true;
    errBox.textContent = "";
  }
  function mark(el, ok) {
    if (ok) el.classList.remove("invalid");
    else el.classList.add("invalid");
  }
  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearErr();

    var ad = document.getElementById("ad");
    var email = document.getElementById("email");
    var telefon = document.getElementById("telefon");
    var kvkk = document.getElementById("kvkk");

    var ok = true;

    if (!ad.value.trim()) { mark(ad, false); ok = false; } else { mark(ad, true); }
    if (!validEmail(email.value.trim())) { mark(email, false); ok = false; } else { mark(email, true); }

    if (!ok) {
      showErr("Lütfen ad soyad ve geçerli bir e-posta girin.");
      return;
    }
    if (!kvkk.checked) {
      showErr("Devam etmek için KVKK metnini onaylamanız gerekir.");
      return;
    }

    var lead = {
      ad: ad.value.trim(),
      email: email.value.trim(),
      telefon: telefon.value.trim(),
      kvkk: true,
      kaynak: "kaza-rehberi-lead",
      tarih: new Date().toISOString()
    };

    // 1) BREVO AŞAMASI: şimdilik sadece konsola yaz
    // Brevo API key geldiğinde bu blok fetch(...) ile değişecek.
    console.log("[LEAD] Brevo'ya gönderilecek kayıt:", lead);

    // 2) Test için localStorage'a biriktir
    try {
      var leads = JSON.parse(localStorage.getItem("ss_leads") || "[]");
      leads.push(lead);
      localStorage.setItem("ss_leads", JSON.stringify(leads));
      console.log("[LEAD] localStorage'a kaydedildi. Toplam kayıt:", leads.length);
    } catch (err) {
      console.warn("localStorage kullanılamadı:", err);
    }

    // 3) Teşekkür ekranını göster
    showThankYou(lead);

    // 4) PDF otomatik indir
    triggerDownload();
  });

  /* ---------- Teşekkür + indirme ---------- */
  function showThankYou(lead) {
    var app = document.getElementById("app");
    var ty = document.getElementById("thankyou");
    var name = document.getElementById("tyName");

    var ilk = lead.ad.split(" ")[0] || "";
    name.textContent = ilk ? ilk + "!" : "!";

    app.hidden = true;
    ty.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function triggerDownload() {
    try {
      var a = document.createElement("a");
      a.href = PDF_PATH;
      a.download = "Kaza_Sonrasi_Ilk_48_Saat_Rehberi.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      // Tarayıcı engellerse teşekkür ekranındaki manuel link devrede.
      console.warn("Otomatik indirme engellendi, manuel link kullanılabilir.", err);
    }
  }

  /* ---------- Başa dön ---------- */
  var reset = document.getElementById("tyReset");
  if (reset) {
    reset.addEventListener("click", function (e) {
      e.preventDefault();
      document.getElementById("thankyou").hidden = true;
      document.getElementById("app").hidden = false;
      form.reset();
      clearErr();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
})();
