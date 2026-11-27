/* icap · Katılım sertifikası doğrulama (girişsiz). /sertifika/?c=C-XXXXXXXXXX
   Sunucu: verify_certificate (migration 024). Ad yalnızca sertifika sahibi paylaştıysa döner. */
(function () {
  'use strict';
  var sb = window.supabase && window.supabase.createClient('https://jjbhkvkrxcqxphocvzir.supabase.co', 'sb_publishable_3AHz9Bo5DKvn04tE7dX9vQ_SEBPumcp', { auth: { persistSession: false } });
  var $app = document.getElementById('app');
  var MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  var UNIS = {}; (window.ICAP_UNIS || []).forEach(function (u) { UNIS[u[0]] = u[1]; });
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function date(iso, tz) {
    try { return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz || 'Europe/Istanbul' }); }
    catch (e) { var d = new Date(iso); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  }
  function card(h) { $app.innerHTML = h + '<footer><a href="../">icap</a> · Invite · Connect · Attend · Post · <a href="../kvkk/">KVKK</a></footer>'; }
  function form(msg) {
    card((msg ? '<div class="ok bad">' + esc(msg) + '</div>' : '') +
      '<div class="card"><h2>Sertifika doğrula</h2><p class="sub">Sertifikanın altındaki kodu yaz (ör. C-1A2B3C4D5E).</p>' +
      '<label class="field"><input id="code" placeholder="C-XXXXXXXXXX" autocomplete="off" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:2px"></label>' +
      '<button class="btn" id="go">Doğrula</button></div>');
    var go = function () { var v = (document.getElementById('code').value || '').trim(); if (v) location.search = '?c=' + encodeURIComponent(v.toUpperCase()); };
    document.getElementById('go').onclick = go;
    document.getElementById('code').onkeydown = function (e) { if (e.key === 'Enter') go(); };
  }

  var code = (new URLSearchParams(location.search).get('c') || '').trim().toUpperCase();
  if (!code) return form();
  if (!/^C-[0-9A-F]{10}$/.test(code)) return form('Kod biçimi geçersiz. Sertifikadaki kodu olduğu gibi yaz.');
  if (!sb) return card('<div class="err">Sayfa yüklenemedi. Bağlantını kontrol edip yenile.</div>');

  sb.rpc('verify_certificate', { p_code: code }).then(function (r) {
    if (r.error) throw r.error;
    var c = Array.isArray(r.data) ? r.data[0] : r.data;
    if (!c) return form('Bu kodla geçerli bir sertifika bulunamadı.');
    document.title = 'Sertifika · ' + c.title + ' · icap';
    var who = c.shared && c.full_name ? esc(c.full_name) : 'Bu sertifikanın sahibi';
    card('<div class="ok"><span>✓</span><span>Geçerli sertifika · ' + esc(code) + '</span></div>' +
      '<div class="cert"><div class="kind">KATILIM SERTİFİKASI</div>' +
      '<div><h2>' + who + '</h2><p>' + esc(date(c.starts_at, c.tz)) + ' tarihinde ' + esc(c.club) + ' tarafından düzenlenen “' + esc(c.title) + '” etkinliğine katılmıştır.</p></div>' +
      '<small>' + esc(UNIS[c.university] || 'Interaction Capture') + ' · icap ile kapıda doğrulandı</small></div>' +
      (c.shared ? '' : '<p class="note">Sertifika sahibi adının bu sayfada görünmesini seçmedi.</p>'));
  }).catch(function () { card('<div class="err">Doğrulama şu an yapılamadı. Biraz sonra tekrar dene.</div>'); });
})();
