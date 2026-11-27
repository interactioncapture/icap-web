/* icap web davet sayfası — uygulaması olmayan öğrenci de etkinliği görür, kaydolur, QR biletini alır. */
(function () {
  'use strict';
  var CFG = window.ICAP || {};
  var ROOT = CFG.root || './';
  var URL_ = 'https://jjbhkvkrxcqxphocvzir.supabase.co';
  var KEY = 'sb_publishable_3AHz9Bo5DKvn04tE7dX9vQ_SEBPumcp';
  var sb = window.supabase && window.supabase.createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'icap-web-auth' } });
  var $app = document.getElementById('app');
  var $sticky = document.getElementById('sticky');

  var GRAD = {
    Teknoloji: ['#5B21B6', '#7C3AED', '#22D3EE'], 'Müzik': ['#FF3D8B', '#FF8A00'], Spor: ['#C6F432', '#22D3EE'],
    Kariyer: ['#FF8A00', '#FF3D8B'], Sanat: ['#15111F', '#7C3AED'],
    'Doğa': ['#065F46', '#16A34A', '#22D3EE'], Bilim: ['#1E3A8A', '#2563EB', '#22D3EE'],
    'Gönüllülük': ['#BE123C', '#F43F5E', '#FDBA74'], 'Gezi': ['#0369A1', '#0EA5E9', '#FDE047'], 'Oyun': ['#4C1D95', '#C026D3', '#22D3EE'], 'Sahne': ['#7F1D1D', '#DC2626', '#F59E0B'], 'Söyleşi': ['#134E4A', '#0D9488', '#C6F432'], 'Maneviyat': ['#1E1B4B', '#4338CA', '#FBBF24'],
  };
  var DARK = { Spor: true };
  var ICON = {
    cal: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="4"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    pin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    user: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    school: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/></svg>',
    mail: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 7l9 6 9-6"/></svg>',
    lock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    wa: '<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 13.9c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/></svg>',
  };

  // CSS içine giden değerler: yalnızca https görsel adresi ve hex renk (stil enjeksiyonuna kapalı)
  function cssUrl(u) { u = String(u || ''); if (!/^https:\/\//.test(u)) return ''; try { u = encodeURI(decodeURI(u)); } catch (e) { return ''; } return u.replace(/['"()\\\s]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); }); }
  function cssColor(c, d) { return /^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : d; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function grad(cat) { var g = GRAD[cat] || GRAD.Teknoloji; return 'linear-gradient(135deg,' + g.join(',') + ')'; }
  // Etkinlik saati kendi kampüsünün saat dilimiyle (ABD'de eyaletin saati) gösterilir
  var ABBR = { 'America/New_York': 'ET', 'America/Chicago': 'CT', 'America/Denver': 'MT', 'America/Phoenix': 'MT', 'America/Los_Angeles': 'PT', 'America/Anchorage': 'AKT', 'Pacific/Honolulu': 'HT' };
  function TZo(tz) { return { timeZone: tz || 'Europe/Istanbul' }; }
  function fmtDate(iso, tz) {
    var d = new Date(iso);
    var wd = d.toLocaleDateString('tr-TR', Object.assign({ weekday: 'long' }, TZo(tz)));
    var dm = d.toLocaleDateString('tr-TR', Object.assign({ day: 'numeric', month: 'long' }, TZo(tz)));
    return wd + ', ' + dm;
  }
  function fmtTime(iso, tz) { return new Date(iso).toLocaleTimeString('tr-TR', Object.assign({ hour: '2-digit', minute: '2-digit' }, TZo(tz))) + (ABBR[tz] ? ' ' + ABBR[tz] : ''); }
  var TZ = TZo();
  function mon(iso) { return new Date(iso).toLocaleDateString('tr-TR', Object.assign({ month: 'short' }, TZ)).toLocaleUpperCase('tr-TR').replace('.', ''); }
  function day(iso) { return new Date(iso).toLocaleDateString('tr-TR', Object.assign({ day: 'numeric' }, TZ)); }
  function price(p) { return p > 0 ? '₺' + p : 'Ücretsiz'; }
  function trErr(m) {
    m = String(m || ''); var l = m.toLowerCase();
    if (l.indexOf('invalid login') >= 0) return 'E-posta veya şifre hatalı.';
    if (l.indexOf('already registered') >= 0) return 'Bu e-posta ile zaten bir hesap var. “Giriş yap” sekmesini kullan.';
    if (l.indexOf('password should') >= 0) return 'Şifre en az 6 karakter olmalı.';
    if (l.indexOf('invalid email') >= 0 || l.indexOf('validate email') >= 0) return 'Geçerli bir e-posta adresi gir.';
    if (l.indexOf('fetch') >= 0 || l.indexOf('network') >= 0) return 'Bağlantı hatası. İnternetini kontrol et.';
    if (l.indexOf('email not confirmed') >= 0) return 'E-postanı doğrulaman gerekiyor. Gelen kutunu kontrol et.';
    if (l.indexOf('rate limit') >= 0 || l.indexOf('for security purposes') >= 0) return 'Çok sık denedin. Bir dakika bekleyip tekrar dene.';
    return m;
  }
  // Davet kaynağı (Interaction Capture · Invite): WhatsApp linki, afişteki QR ya da doğrudan web
  // Üniversiteler (YÖK listesi; build.py sayfaya gömer): [id, ad, kısaltma, tür]
  var UNIS = window.ICAP_UNIS || [];
  function fold(s) { return String(s || '').toLocaleLowerCase('tr-TR').replace(/[çğıöşüâîû]/g, function (c) { return { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' }[c]; }); }
  // "ODTÜ · ODTÜ Yapay Zekâ Kulübü" tekrarını önle: kulüp adı zaten kampüsle başlıyorsa kampüsü yazma
  function campusClub(c) {
    c = c || {};
    var short = (findUni(c.university) || [])[2] || '', name = c.name || '';
    if (!short || name.toLocaleLowerCase('tr').indexOf(short.toLocaleLowerCase('tr')) === 0) return name;
    return short + ' · ' + name;
  }
  function findUni(v) {
    if (!v) return null;
    for (var i = 0; i < UNIS.length; i++) if (UNIS[i][0] === v) return UNIS[i];
    var f = fold(v);
    for (var j = 0; j < UNIS.length; j++) if (fold(UNIS[j][2]) === f || fold(UNIS[j][1]) === f) return UNIS[j];
    return null;
  }
  // Yazdıkça tahmin (zorunlu değil)
  function searchUnis(q) {
    var f = fold(q.trim()); if (f.length < 2) return [];
    var scored = [];
    for (var i = 0; i < UNIS.length; i++) {
      var u = UNIS[i], sh = fold(u[2]), n = fold(u[1]), sc = 9;
      if (sh === f) sc = 0; else if (sh.indexOf(f) === 0 || n.indexOf(f) === 0) sc = 1;
      else if (n.split(/[\s-]/).some(function (w) { return w.indexOf(f) === 0; })) sc = 2; else if (n.indexOf(f) >= 0) sc = 3;
      if (sc < 9) scored.push([sc, u]);
    }
    return scored.sort(function (a, b) { return a[0] - b[0] || a[1][1].localeCompare(b[1][1], 'tr'); }).slice(0, 5).map(function (x) { return x[1]; });
  }
  var TYPE = { devlet: 'Devlet', vakif: 'Vakıf', kktc: 'KKTC', myo: 'Meslek YO' };
  function uniField() {
    var u = S.uni ? findUni(S.uni) : null;
    return '<label class="field">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"/></svg>' +
      '<input id="uniq" type="text" placeholder="Üniversiten (isteğe bağlı)" autocomplete="off" value="' + esc(u ? u[1] : (S.uniText || '')) + '">' +
      (u ? '<span class="ok">✓</span>' : '') + '</label><div id="unisug" class="sug"></div>';
  }
  function bindUni() {
    var inp = document.getElementById('uniq'), box = document.getElementById('unisug');
    if (!inp) return;
    inp.oninput = function () {
      S.uni = null; S.uniText = inp.value;
      var ok = inp.parentNode.querySelector('.ok'); if (ok) ok.remove();
      var list = searchUnis(inp.value);
      box.innerHTML = list.map(function (u) {
        return '<button type="button" data-u="' + u[0] + '"><b>' + esc(u[1]) + '</b><small>' + esc(TYPE[u[3]] || '') + '</small></button>';
      }).join('');
      var bs = box.querySelectorAll('button');
      for (var i = 0; i < bs.length; i++) bs[i].onclick = function (e) { S.uni = e.currentTarget.getAttribute('data-u'); S.uniText = ''; box.innerHTML = ''; inp.value = findUni(S.uni)[1]; inp.insertAdjacentHTML('afterend', '<span class="ok">✓</span>'); };
    };
  }
  function source() { var k = new URLSearchParams(location.search).get('k'); return k === 'wa' ? 'whatsapp' : k === 'qr' ? 'poster' : 'web'; }

  // ------------------------------------------------------------------ Etkinlik sayfası
  var S = { ev: null, going: 0, session: null, reg: null, tab: 'signup', busy: false, err: null, showForm: false };

  function cover(ev) {
    if (ev.cover_url) {
      var u = cssUrl(ev.cover_url);
      return '<div class="poster"><div class="poster-bg" style="background-image:url(&quot;' + u + '&quot;)"></div><img src="' + esc(u) + '" alt="' + esc(ev.title) + ' afişi"></div>';
    }
    var word = ev.title.split(':')[0].split(' ').slice(0, 2).join('<br>');
    var c = ev.clubs || (ev.kind === 'meetup' ? { name: ev.host_name || 'Bir öğrenci', short: '', color: '#7C3AED' } : {});
    return '<div class="cover' + (DARK[ev.category] ? ' dark' : '') + '" style="background:' + grad(ev.category) + '">' +
      '<div class="word">' + word.split('<br>').map(esc).join('<br>') + '</div>' +
      '<div class="club"><i style="background:' + cssColor(c.color, '#C6F432') + '">' + esc(c.short || '') + '</i>' + esc(c.name || '') + '</div></div>';
  }

  function ticketHtml() {
    var ev = S.ev, r = S.reg, ok = r.status === 'approved' || r.status === 'checked_in';
    var label = { approved: ['Bilet hazır', 'green'], checked_in: ['Giriş yapıldı', 'green'], pending: ['Onay bekleniyor', 'orange'], waitlist: ['Bekleme listesinde', 'pink'] }[r.status] || ['', ''];
    var body = ok
      ? '<div class="qr" id="qr"></div><div class="code">' + esc(r.ticket_code) + '</div>'
      : '<div class="wait">' + (r.status === 'pending'
        ? 'Kulüp kaydını onayladığında QR biletin burada görünecek. Bu sayfayı kaydet ya da sonra tekrar aç.'
        : 'Etkinlik dolu; bekleme listesindesin. Yer açılırsa biletin burada görünecek.') + '</div>';
    return '<div class="ticket"><div class="head" style="background:' + grad(ev.category) + (DARK[ev.category] ? ';color:#15111F' : '') + '">' +
      '<small>İCAP BİLETİ</small><b>' + esc(ev.title) + '</b></div>' + body +
      '<div class="foot"><span>' + esc(fmtDate(ev.starts_at, ev.tz)) + ' · ' + esc(fmtTime(ev.starts_at, ev.tz)) + '</span><span class="chip ' + label[1] + '">' + label[0] + '</span></div></div>' +
      (ok ? '<p class="note">Kapıda bu QR kodu göster. Ekran görüntüsü de olur.</p>' : '');
  }

  function formHtml() {
    var su = S.tab === 'signup';
    return '<div class="card" id="form"><h2>' + (su ? 'Hesap aç, yerini ayır' : 'Giriş yap') + '</h2>' +
      '<p class="sub">' + (su ? '30 saniye sürer. Aynı hesapla icap uygulamasına da girersin.' : 'icap hesabınla giriş yap.') + '</p>' +
      '<div class="tabs"><button data-tab="signup" class="' + (su ? 'on' : '') + '">Yeni hesap</button><button data-tab="login" class="' + (su ? '' : 'on') + '">Giriş yap</button></div>' +
      (su ? field('name', ICON.user, 'Ad Soyad', 'text', 'name') + uniField() + field('dept', ICON.school, 'Bölüm (ör. Bilgisayar Müh.)', 'text', 'organization-title') : '') +
      field('email', ICON.mail, 'E-posta', 'email', 'email') +
      field('pw', ICON.lock, su ? 'Şifre (en az 6 karakter)' : 'Şifre', 'password', su ? 'new-password' : 'current-password') +
      (su ? '<label class="consent"><input type="checkbox" id="kvkk"><span><a href="' + ROOT + 'kvkk/" target="_blank" rel="noopener">Aydınlatma Metni</a>' + esc((window.ICAP_CONSENT || '').replace('Aydınlatma Metni', '')) + '</span></label>' : '') +
      (S.err ? '<div class="err">' + esc(S.err) + '</div>' : '') +
      (S.info ? '<div class="err" style="background:var(--tint-l);color:var(--lime-d)">' + esc(S.info) + '</div>' : '') +
      '<button class="btn" id="go"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? '<span class="spin"></span>' : (su ? 'Hesap aç ve katıl' : 'Giriş yap ve katıl')) + '</button>' +
      (su ? '' : '<p class="note"><a href="#" id="forgot" style="color:var(--violet);font-weight:700">Şifremi unuttum</a></p>') + '</div>';
  }
  function field(id, icon, ph, type, ac) {
    var v = (document.getElementById(id) || {}).value || '';
    return '<label class="field">' + icon + '<input id="' + id + '" type="' + type + '" placeholder="' + esc(ph) + '" autocomplete="' + ac + '" value="' + esc(v) + '"></label>';
  }

  function renderEvent() {
    var ev = S.ev;
    if (!ev) return;
    var cap = ev.capacity || 0, left = Math.max(0, cap - S.going), pct = cap ? Math.min(100, Math.round(S.going / cap * 100)) : 0;
    var full = left <= 0;
    var over = ended(ev);
    var h = cover(ev) +
      '<h1 class="title">' + esc(ev.title) + '</h1>' +
      '<div class="info">' +
      '<div><span class="ic">' + ICON.cal + '</span><span><small>Tarih</small><strong>' + esc(fmtDate(ev.starts_at, ev.tz)) + ' · ' + esc(fmtTime(ev.starts_at, ev.tz)) + '</strong></span></div>' +
      '<div><span class="ic">' + ICON.pin + '</span><span><small>Yer</small><strong>' + esc(ev.place) + '</strong></span></div></div>' +
      (ev.lat != null ? '<a class="map" href="https://www.google.com/maps/search/?api=1&query=' + ev.lat + ',' + ev.lng + '" target="_blank" rel="noopener"><div id="evmap"></div><span>Yol tarifi al →</span></a>' : '') +
      (over
        ? '<div class="social"><span>Etkinlik sona erdi</span>' + (S.going >= 3 ? '<span class="muted">' + S.going + ' kişi katıldı</span>' : '') + '</div>'
        : '<div class="social"><span>' + (S.going >= 3 ? S.going + ' kişi geliyor' : 'Yeni açıldı, ilk gelenlerden ol') + '</span><div class="bar"><i style="width:' + pct + '%"></i></div><span class="muted">' + (full ? 'Dolu' : left + ' yer') + '</span></div>') +
      ((ev.approval_required || ev.off_campus || ev.has_food || ev.online || ev.permit_status === 'approved' || (ev.clubs && (ev.clubs.official || ev.clubs.kind === 'crew')) || ev.kind === 'meetup' || ev.venue_type === 'food') ? '<p style="margin-bottom:12px;display:flex;gap:6px;flex-wrap:wrap">' + (ev.off_campus ? '<span class="chip orange">Kampüs dışı</span>' : '') + (ev.permit_status === 'approved' ? '<span class="chip">SKS onaylı</span>' : '') + (ev.clubs && ev.clubs.official ? '<span class="chip">Resmî kulüp</span>' : '') + (ev.clubs && ev.clubs.kind === 'crew' ? '<span class="chip">Ekip</span>' : '') + (ev.kind === 'meetup' ? '<span class="chip">Buluşma</span>' : '') + (ev.venue_type === 'food' ? '<span class="chip orange">Yemekte</span>' : '') + (ev.has_food ? '<span class="chip orange">İkram var</span>' : '') + (ev.online ? '<span class="chip">Online</span>' : '') + (ev.approval_required ? '<span class="chip">Kayıtlar kulüp onayıyla kesinleşir</span>' : '') + '</p>' : '') +
      (ev.about ? '<p class="about">' + esc(ev.about) + '</p>' : '');
    if (S.reg) h += ticketHtml();
    else if (S.showForm && !S.session && !over) h += formHtml();
    else if (S.err) h += '<div class="err">' + esc(S.err) + '</div>';
    h += '<footer><a href="' + ROOT + '">icap</a> · Invite · Connect · Attend · Post · <a href="' + ROOT + 'kvkk/">KVKK</a></footer>';
    $app.innerHTML = h;

    // Mini harita (OpenStreetMap)
    var mapEl = document.getElementById('evmap');
    if (mapEl && window.L && ev.lat != null) {
      var mm = window.L.map(mapEl, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, attributionControl: true }).setView([ev.lat, ev.lng], 16);
      window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mm);
      var g = GRAD[ev.category] || GRAD.Teknoloji;
      window.L.marker([ev.lat, ev.lng], { icon: window.L.divIcon({ className: '', iconSize: [0, 0], html: '<svg style="width:30px;height:40px;transform:translate(-15px,-40px)" viewBox="0 0 24 32"><path fill="' + g[1] + '" fill-rule="evenodd" d="M12 0C5.37 0 0 5.2 0 11.62 0 20.33 12 32 12 32s12-11.67 12-20.38C24 5.2 18.63 0 12 0Zm0 16.6a4.9 4.9 0 1 1 0-9.8 4.9 4.9 0 0 1 0 9.8Z"/><circle cx="12" cy="11.7" r="4.9" fill="#fff"/></svg>' }) }).addTo(mm);
    }
    // QR
    if (S.reg && (S.reg.status === 'approved' || S.reg.status === 'checked_in') && window.qrcode) {
      var q = window.qrcode(0, 'M'); q.addData(S.reg.ticket_code); q.make();
      document.getElementById('qr').innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    }
    // Form olayları
    var tabs = $app.querySelectorAll('[data-tab]');
    for (var i = 0; i < tabs.length; i++) tabs[i].onclick = function (e) { S.tab = e.currentTarget.getAttribute('data-tab'); S.err = null; S.info = null; renderEvent(); };
    var fg = document.getElementById('forgot'); if (fg) fg.onclick = function (e) { e.preventDefault(); forgot(); };
    var go = document.getElementById('go'); if (go) go.onclick = submit;
    bindUni();
    var pw = document.getElementById('pw'); if (pw) pw.onkeydown = function (e) { if (e.key === 'Enter') submit(); };

    // Alt bar
    var cta;
    if (over) cta = '<button class="btn" disabled>Sona erdi</button>';
    else if (S.reg) cta = '<button class="btn wa" id="share">' + ICON.wa + ' Arkadaşına gönder</button>';
    else if (S.busy) cta = '<button class="btn" disabled><span class="spin"></span></button>';
    else cta = '<button class="btn" id="join">' + (full ? 'Bekleme listesine gir' : ev.approval_required ? 'Katılım iste' : 'Katıl') + '</button>';
    $sticky.innerHTML = '<div class="in"><div class="price"><small>Fiyat</small><b>' + price(ev.price) + '</b></div>' + cta + '</div>';
    $sticky.classList.toggle('hide', !!(S.showForm && !S.session && !S.reg && !over));
    var j = document.getElementById('join'); if (j) j.onclick = join;
    var sh = document.getElementById('share'); if (sh) sh.onclick = share;
  }

  function share() {
    var link = location.origin + location.pathname + '?k=wa';
    var text = S.ev.title + '\n' + fmtDate(S.ev.starts_at, S.ev.tz) + ' · ' + fmtTime(S.ev.starts_at, S.ev.tz) + '\n' + S.ev.place + '\nicap\'te yerini ayır 👉 ' + link;
    location.href = 'https://wa.me/?text=' + encodeURIComponent(text);
  }

  // Sunucudaki kuralla aynı: başlangıçtan 6 saat sonra kayıt kapanır (register_event "Bu etkinlik sona erdi")
  function ended(ev) { return Date.parse(ev.starts_at) < Date.now() - 6 * 3600e3; }

  function join() {
    if (ended(S.ev)) return;
    S.err = null;
    if (!S.session) { S.showForm = true; renderEvent(); var f = document.getElementById('form'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    register();
  }

  function submit() {
    var su = S.tab === 'signup';
    var email = (document.getElementById('email').value || '').trim();
    var pw = document.getElementById('pw').value || '';
    var name = su ? (document.getElementById('name').value || '').trim() : '';
    var dept = su ? (document.getElementById('dept').value || '').trim() : '';
    var uni = su ? (S.uni || '') : '';
    if (su && name.length < 3) { S.err = 'Adını ve soyadını yaz.'; return renderEvent(); }
    if (!/\S+@\S+\.\S+/.test(email)) { S.err = 'Geçerli bir e-posta adresi gir.'; return renderEvent(); }
    if (pw.length < 6) { S.err = 'Şifre en az 6 karakter olmalı.'; return renderEvent(); }
    if (su && !document.getElementById('kvkk').checked) { S.err = 'Devam etmek için Aydınlatma Metni onayını işaretle.'; return renderEvent(); }
    S.busy = true; S.err = null; S.info = null; renderEvent();
    var p = su
      // Doğrulama bağlantısı bu etkinlik sayfasına döner: kişi girişli olarak geri gelir ve kaydını tamamlar
      ? sb.auth.signUp({ email: email, password: pw, options: { emailRedirectTo: location.origin + location.pathname, data: { full_name: name, department: dept, university: uni || undefined, kvkk_accepted_at: new Date().toISOString() } } })
      : sb.auth.signInWithPassword({ email: email, password: pw });
    p.then(function (res) {
      if (res.error) throw res.error;
      if (!res.data.session) throw new Error('E-postanı doğrulaman gerekiyor. Gelen kutunu kontrol et.');
      S.session = res.data.session; S.showForm = false;
      return register();
    }).catch(function (e) { S.busy = false; S.err = trErr(e.message); renderEvent(); });
  }

  // Şifre sıfırlama bağlantısı /hesap/ sayfasını açar; yeni şifre orada belirlenir
  function forgot() {
    var email = ((document.getElementById('email') || {}).value || '').trim();
    S.err = null; S.info = null;
    if (!/\S+@\S+\.\S+/.test(email)) { S.err = 'Önce e-posta adresini yaz, sıfırlama bağlantısını oraya gönderelim.'; return renderEvent(); }
    S.busy = true; renderEvent();
    sb.auth.resetPasswordForEmail(email, { redirectTo: new URL(ROOT + 'hesap/', location.href).href }).then(function (r) {
      if (r.error) throw r.error;
      S.busy = false; S.info = 'Bu e-postayla bir hesap varsa şifre sıfırlama bağlantısı gönderdik. Gelen kutunu kontrol et.'; renderEvent();
    }).catch(function (e) { S.busy = false; S.err = trErr(e.message); renderEvent(); });
  }

  function register() {
    S.busy = true; renderEvent();
    // Uygulamayla aynı tek kapı: yeni kayıt ya da iptal edilmiş kaydı yeniden açar
    return sb.rpc('register_event', { p_event: S.ev.id, p_source: source() })
      .then(function (res) {
        if (res.error) throw res.error;
        var row = Array.isArray(res.data) ? res.data[0] : res.data;
        S.reg = row ? { status: row.status, ticket_code: row.ticket_code } : null; S.busy = false; return refreshGoing();
      })
      .then(renderEvent)
      .catch(function (e) { S.busy = false; S.err = trErr(e.message); renderEvent(); });
  }

  function refreshGoing() {
    return sb.from('event_stats').select('going').eq('event_id', S.ev.id).maybeSingle().then(function (r) { S.going = (r.data && r.data.going) || 0; });
  }

  function loadEvent(id) {
    if (!sb) { $app.innerHTML = '<div class="err">Sayfa yüklenemedi. Bağlantını kontrol edip yenile.</div>'; return; }
    Promise.all([
      sb.from('events').select('id,title,place,starts_at,price,capacity,category,about,approval_required,cover_url,off_campus,has_food,online,permit_status,lat,lng,clubs(name,short,color,university,official,kind),kind,host_name,venue_type,tz').eq('id', id).maybeSingle(),
      sb.from('event_stats').select('going').eq('event_id', id).maybeSingle(),
      sb.auth.getSession(),
    ]).then(function (r) {
      // Kulübü görünmeyen (reddedilmiş/onay bekleyen) etkinlik: bulunamadı say
      if (r[0].data && !r[0].data.clubs && r[0].data.kind === 'meetup') r[0].data.clubs = { name: r[0].data.host_name || 'Bir öğrenci', short: '', color: '#7C3AED', university: '' };
      if (!r[0].data || !r[0].data.clubs) { $app.innerHTML = notFound(); $sticky.classList.add('hide'); return; }
      S.ev = r[0].data; S.going = (r[1].data && r[1].data.going) || 0; S.session = r[2].data.session;
      document.title = S.ev.title + ' · icap';
      if (!S.session) return renderEvent();
      return sb.from('registrations').select('status,ticket_code').eq('event_id', id).eq('user_id', S.session.user.id).neq('status', 'cancelled').maybeSingle()
        .then(function (x) { S.reg = x.data; renderEvent(); });
    }).catch(function () { $app.innerHTML = '<div class="err">Etkinlik yüklenemedi. Bağlantını kontrol edip sayfayı yenile.</div>'; });
  }

  function notFound() {
    return '<div class="card center" style="margin-top:30px"><h2>Etkinlik bulunamadı</h2><p class="sub">Etkinlik kaldırılmış ya da link hatalı olabilir.</p><a class="btn" href="' + ROOT + '" style="text-decoration:none">Yaklaşan etkinlikler</a></div>';
  }

  // ------------------------------------------------------------------ Ana sayfa: yaklaşan etkinlikler
  function loadList() {
    var $list = document.getElementById('list'); if (!$list || !sb) return;
    sb.from('events').select('id,title,place,starts_at,price,category,cover_url,tz,clubs(name,university)').gte('starts_at', new Date(Date.now() - 6 * 3600e3).toISOString()).order('starts_at').limit(40)
      .then(function (r) {
        var evs = (r.data || []).filter(function (e) { return e.clubs; }); // kulübü görünmeyen etkinlikleri gösterme
        if (!evs.length) { $list.innerHTML = '<div class="card center muted">Şu an yaklaşan etkinlik yok.</div>'; return; }
        $list.innerHTML = evs.map(function (e) {
          var cu = cssUrl(e.cover_url);
          var bg = cu ? 'url(&quot;' + cu + '&quot;) center/cover' : grad(e.category);
          return '<a class="row" href="' + ROOT + 'e/' + e.id + '/"><div class="thumb' + (e.cover_url ? ' img' : '') + '" style="background:' + bg + (DARK[e.category] ? ';color:#15111F' : '') + '"><small>' + esc(mon(e.starts_at)) + '</small><b>' + esc(day(e.starts_at)) + '</b></div>' +
            '<div style="flex:1;min-width:0"><h3>' + esc(e.title) + '</h3><p>' + esc(campusClub(e.clubs)) + ' · ' + esc(fmtTime(e.starts_at, e.tz)) + ' · ' + price(e.price) + '</p></div></a>';
        }).join('');
      });
  }

  // Yönlendirme: /e/<id>/ (oluşturulmuş sayfa) ya da 404 üzerinden gelen bilinmeyen id
  var id = CFG.eventId;
  if (!id) { var m = location.pathname.match(/\/e\/([0-9a-f-]{36})/i); if (m) id = m[1]; }
  // Davet linki: /d/?k=KOD — girişliyse davet kaydedilir ve buluşma açılır; girişsizse özet ve kod gösterilir
  var invite = /\/d\/?$/.test(location.pathname) ? (new URLSearchParams(location.search).get('k') || '').toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
  if (invite && sb) {
    sb.auth.getSession().then(function (r) {
      return sb.rpc('open_invite', { p_code: invite }).then(function (x) {
        if (x.error || !x.data) { $app.innerHTML = '<div class="err">Davet kodu bulunamadı ya da buluşma sona erdi.</div>'; return; }
        if (r.data.session) return loadEvent(x.data.id);
        var d = x.data;
        $app.innerHTML = '<div class="card" style="padding:20px"><p class="muted">' + esc(d.host_name || 'Bir arkadaşın') + ' seni davet etti</p>' +
          '<h1 style="margin:6px 0">' + esc(d.title) + '</h1><p>' + esc(fmtDate(d.starts_at, d.tz)) + ' · ' + esc(fmtTime(d.starts_at, d.tz)) + ' · ' + esc(d.place) + (d.venue_type === 'food' ? ' · Yemekte' : '') + '</p>' +
          '<p style="margin-top:14px">Katılmak için icap uygulamasında <b>Bildirimler → Davet kodun mu var?</b> kısmına bu kodu gir:</p>' +
          '<p style="font-size:28px;font-weight:800;letter-spacing:4px;margin:8px 0">' + esc(invite) + '</p></div>';
      });
    });
  } else if (id) loadEvent(id); else loadList();
})();
