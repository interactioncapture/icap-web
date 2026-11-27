/* icap · Hesap bağlantıları: e-posta doğrulama ve şifre sıfırlama.
   Uygulama ve web, Supabase'e bu sayfayı yönlendirme adresi olarak verir (emailRedirectTo / redirectTo).
   Bağlantı #access_token=…&type=signup|recovery ya da #error=… taşır; supabase-js oturumu adresten kendisi kurar. */
(function () {
  'use strict';
  var URL_ = 'https://jjbhkvkrxcqxphocvzir.supabase.co';
  var KEY = 'sb_publishable_3AHz9Bo5DKvn04tE7dX9vQ_SEBPumcp';
  var $app = document.getElementById('app');

  function params(s) { var p = {}; new URLSearchParams(String(s || '').replace(/^[#?]/, '')).forEach(function (v, k) { p[k] = v; }); return p; }
  var hash = params(window.ICAP_AUTH_HASH), query = params(window.ICAP_AUTH_QUERY);
  var type = hash.type || query.type || '';
  var errCode = hash.error_code || query.error_code || '';
  var hasError = !!(hash.error || query.error || errCode);

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function card(title, body, extra) {
    $app.innerHTML = '<div class="card" style="margin-top:12px"><h2>' + esc(title) + '</h2><p class="sub">' + esc(body) + '</p>' + (extra || '') + '</div>' +
      '<footer><a href="../">icap</a> · <a href="../kvkk/">KVKK</a></footer>';
  }
  var APP_BTN = '<a class="btn" href="icap://" style="text-decoration:none">icap uygulamasını aç</a>' +
    '<a class="btn white" href="../" style="text-decoration:none;margin-top:10px">Yaklaşan etkinlikler</a>';

  if (!window.supabase) { card('Sayfa yüklenemedi', 'Bağlantını kontrol edip sayfayı yenile.'); return; }

  if (hasError) {
    var expired = errCode === 'otp_expired' || /expired|invalid/i.test(hash.error_description || query.error_description || '');
    card(expired ? 'Bağlantının süresi dolmuş' : 'Bağlantı açılamadı',
      expired
        ? 'Bu bağlantı daha önce kullanılmış ya da süresi geçmiş. Uygulamada giriş ekranından yenisini iste (şifre için "Şifremi unuttum").'
        : 'Bağlantı geçersiz görünüyor. Uygulamada giriş ekranından yeni bir bağlantı iste.', APP_BTN);
    return;
  }

  var sb = window.supabase.createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'icap-web-auth' } });

  sb.auth.getSession().then(function (r) {
    var session = r.data && r.data.session;
    if (type === 'recovery') {
      if (!session) { card('Bağlantının süresi dolmuş', 'Uygulamada "Şifremi unuttum" ile yeni bir bağlantı iste.', APP_BTN); return; }
      return recoveryForm(session);
    }
    if (type === 'signup' || type === 'email' || type === 'invite' || type === 'magiclink') {
      card('E-postan doğrulandı 🎉', 'Hesabın hazır. icap uygulamasına dönüp e-posta ve şifrenle giriş yapabilirsin.', APP_BTN);
      return;
    }
    if (type === 'email_change') { card('E-posta adresin güncellendi', 'Bundan sonra yeni adresinle giriş yap.', APP_BTN); return; }
    card('icap hesabı', 'Bu sayfa doğrulama ve şifre sıfırlama e-postalarındaki bağlantılarla açılır.', APP_BTN);
  }).catch(function () { card('Bir sorun oluştu', 'Bağlantını kontrol edip sayfayı yenile.', APP_BTN); });

  function recoveryForm(session) {
    var lock = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
    card('Yeni şifre belirle', (session.user && session.user.email ? session.user.email + ' hesabı için' : 'Hesabın için') + ' yeni bir şifre yaz.',
      '<label class="field">' + lock + '<input id="pw1" type="password" placeholder="Yeni şifre (en az 6 karakter)" autocomplete="new-password"></label>' +
      '<label class="field">' + lock + '<input id="pw2" type="password" placeholder="Yeni şifre (tekrar)" autocomplete="new-password"></label>' +
      '<div id="msg"></div><button class="btn" id="save">Şifreyi kaydet</button>');
    var $save = document.getElementById('save'), $msg = document.getElementById('msg');
    function fail(t) { $msg.innerHTML = '<div class="err">' + esc(t) + '</div>'; }
    function save() {
      var a = document.getElementById('pw1').value || '', b = document.getElementById('pw2').value || '';
      if (a.length < 6) return fail('Şifre en az 6 karakter olmalı.');
      if (a !== b) return fail('İki şifre aynı değil.');
      $save.disabled = true; $save.innerHTML = '<span class="spin"></span>'; $msg.innerHTML = '';
      sb.auth.updateUser({ password: a }).then(function (r) {
        if (r.error) throw r.error;
        card('Şifren güncellendi', 'icap uygulamasına dönüp yeni şifrenle giriş yapabilirsin.', APP_BTN);
      }).catch(function (e) {
        var m = String((e && e.message) || '').toLowerCase();
        $save.disabled = false; $save.textContent = 'Şifreyi kaydet';
        if (m.indexOf('different from the old') >= 0 || m.indexOf('same') >= 0) return fail('Yeni şifre eskisinden farklı olmalı.');
        if (m.indexOf('weak') >= 0 || m.indexOf('at least') >= 0) return fail('Bu şifre çok zayıf. Daha uzun ya da karmaşık bir şifre dene.');
        if (m.indexOf('session') >= 0 || m.indexOf('jwt') >= 0 || m.indexOf('expired') >= 0) return fail('Bağlantının süresi doldu. Uygulamadan yeni bağlantı iste.');
        fail('Şifre kaydedilemedi. Bağlantını kontrol edip tekrar dene.');
      });
    }
    $save.onclick = save;
    document.getElementById('pw2').onkeydown = function (e) { if (e.key === 'Enter') save(); };
  }
})();
