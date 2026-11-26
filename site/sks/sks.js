// icap · SKS paneli (web). Yetki sunucuda: sks_overview / sks_set_club / sks_decide_permit yalnızca
// kendi kampüsünün SKS yöneticisine (ya da icap yönetimine) çalışır.
(function () {
  var URL = 'https://jjbhkvkrxcqxphocvzir.supabase.co';
  var KEY = 'sb_publishable_3AHz9Bo5DKvn04tE7dX9vQ_SEBPumcp';
  var sb = window.supabase.createClient(URL, KEY);
  var $app = document.getElementById('app'), $who = document.getElementById('who');
  var S = { tab: 'permits', d: null, uni: new URLSearchParams(location.search).get('u') || null, rejecting: null };
  var PS = { none: 'İzin istenmedi', requested: 'İzin bekliyor', approved: 'SKS onaylı', rejected: 'Reddedildi' };
  var UNIS = {}; (window.ICAP_UNIS || []).forEach(function (u) { UNIS[u[0]] = { name: u[1], short: u[2] }; });

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function color(c) { return /^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : '#7C3AED'; }
  function fg(c) { return ['#C6F432', '#22D3EE'].indexOf(c) >= 0 ? '#15111F' : '#fff'; }
  function n(x) { return Number(x || 0).toLocaleString('tr-TR'); }
  function when(s) { var d = new Date(s); return d.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'long' }) + ' · ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); }
  function toast(t) { var el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el); setTimeout(function () { el.remove(); }, 2800); }
  function msgBox(h, p) { $app.innerHTML = '<div class="center"><div class="login"><h1>' + h + '</h1><p>' + p + '</p></div></div>'; }

  function loginView(err) {
    $who.innerHTML = '';
    $app.innerHTML = '<div class="center"><form class="login" id="lf"><h1>SKS paneli</h1><p>icap hesabınla giriş yap. Yetki, kurumsal e-postan doğrulanarak icap ekibince verilir.</p>' +
      '<input class="in" id="em" type="email" placeholder="E-posta" autocomplete="username" required>' +
      '<input class="in" id="pw" type="password" placeholder="Şifre" autocomplete="current-password" required>' +
      (err ? '<div class="err">' + esc(err) + '</div>' : '') + '<button class="btn" id="go">Giriş yap</button></form></div>';
    document.getElementById('lf').onsubmit = function (e) {
      e.preventDefault(); var b = document.getElementById('go'); b.disabled = true; b.textContent = 'Giriş yapılıyor…';
      sb.auth.signInWithPassword({ email: document.getElementById('em').value.trim(), password: document.getElementById('pw').value })
        .then(function (r) { if (r.error) throw r.error; return load(); })
        .catch(function (e) { loginView(/invalid login/i.test(e.message) ? 'E-posta veya şifre hatalı.' : e.message); });
    };
  }

  function load() {
    return sb.auth.getSession().then(function (r) {
      var sess = r.data.session; if (!sess) return loginView();
      $who.innerHTML = '<span>' + esc(sess.user.email) + '</span><button id="out">Çıkış</button>';
      document.getElementById('out').onclick = function () { sb.auth.signOut().then(function () { loginView(); }); };
      return sb.rpc('sks_overview', S.uni ? { p_university: S.uni } : {}).then(function (res) {
        if (res.error) {
          if (/yetkin yok/i.test(res.error.message)) return msgBox('Erişim yok', 'Bu hesabın SKS yetkisi yok. Yetki için icap ekibine kurumsal e-postanla yaz.');
          throw res.error;
        }
        S.d = res.data; render();
      });
    }).catch(function (e) { msgBox('Yüklenemedi', '<span class="err">' + esc(e.message) + '</span>'); });
  }

  function kpi(l, v, d, hot) { return '<div class="kpi' + (hot ? ' hot' : '') + '"><div class="l">' + l + '</div><div class="v">' + v + '</div>' + (d ? '<div class="d">' + d + '</div>' : '') + '</div>'; }
  function tab(k, l, c) { return '<button class="tab' + (S.tab === k ? ' on' : '') + '" data-t="' + k + '">' + l + (c ? '<em>' + c + '</em>' : '') + '</button>'; }

  function permitRow(e, actions) {
    var rej = S.rejecting === e.id;
    return '<div class="permit"><div><h3>' + esc(e.title) + '</h3>' +
      '<div class="s">' + esc(e.club) + (e.official ? ' · <b style="color:var(--ld)">Resmî kulüp</b>' : '') + '</div>' +
      '<div class="s">' + when(e.starts_at) + ' · ' + esc(e.place) + (e.off_campus ? ' · Kampüs dışı' : '') + '</div>' +
      '<div class="s">' + n(e.going) + ' / ' + n(e.capacity) + ' kayıt · ' + n(e.checked_in) + ' giriş · <span class="chip ps-' + esc(e.permit_status) + '">' + PS[e.permit_status] + '</span></div>' +
      (e.permit_note ? '<div class="note">' + esc(e.permit_note) + '</div>' : '') +
      (rej ? '<textarea class="reason" id="why" placeholder="Gerekçe (kulüp yöneticisi görür) — ör. Salon o tarihte dolu; 12 Aralık önerilir."></textarea>' : '') +
      '</div>' + (actions ? '<div class="acts">' + (rej
        ? '<button class="a no" data-a="send-reject" data-id="' + e.id + '">Gerekçeyle reddet</button><button class="a" data-a="cancel" data-id="' + e.id + '">Vazgeç</button>'
        : '<button class="a ok" data-a="permit-ok" data-id="' + e.id + '">İzni onayla</button><button class="a no" data-a="permit-no" data-id="' + e.id + '">Reddet</button>') + '</div>' : '<div></div>') + '</div>';
  }

  function clubRow(c) {
    var v = c.founder_domain ? '<span class="chip ok">✓ ' + esc(c.founder_domain) + ' ile doğrulandı</span>' : '<span class="chip warn">Okul e-postası doğrulanmadı</span>';
    var acts = c.status === 'pending'
      ? '<button class="a ok" data-a="approve" data-id="' + c.id + '">Resmî kulüp olarak onayla</button><button class="a no" data-a="reject" data-id="' + c.id + '">Reddet</button>'
      : c.status === 'active' ? '<button class="a tick" data-a="' + (c.official ? 'unofficial' : 'official') + '" data-id="' + c.id + '">' + (c.official ? 'Resmîliği kaldır' : 'Resmî kulüp yap') + '</button>' : '';
    return '<div class="club"><div class="logo" style="background:' + color(c.color) + ';color:' + fg(c.color) + '">' + esc(c.short) + '</div>' +
      '<div><h3>' + esc(c.name) + (c.official ? ' <span style="color:var(--ld)">🎗</span>' : '') + '</h3><p>' + esc(c.about) + '</p>' +
      '<div class="meta">' + v + (c.official ? '<span class="chip ok">SKS onaylı</span>' : '') +
      '<span class="chip">Kurucu: ' + esc(c.founder_name || '—') + '</span><span class="chip">' + n(c.members) + ' üye · ' + n(c.events) + ' etkinlik</span></div></div>' +
      '<div class="acts">' + acts + '</div></div>';
  }

  function render() {
    var d = S.d, st = d.stats || {};
    var unis = d.universities || [];
    var permits = (d.events || []).filter(function (e) { return e.permit_status === 'requested'; });
    var pending = (d.clubs || []).filter(function (c) { return c.status === 'pending'; });
    var active = (d.clubs || []).filter(function (c) { return c.status === 'active'; });
    var upcoming = (d.events || []).filter(function (e) { return new Date(e.starts_at).getTime() > Date.now() - 864e5; });
    var title = unis.map(function (u) { return (UNIS[u] || {}).name || u; }).join(' · ');
    var body = '';
    if (S.tab === 'permits') body = permits.length ? permits.map(function (e) { return permitRow(e, true); }).join('') : '<div class="empty">Bekleyen izin başvurusu yok. Kulüpler etkinliklerini SKS onayına gönderdiğinde burada görünür.</div>';
    else if (S.tab === 'clubs') body = (pending.length ? '<h2 style="margin:4px 0 6px">Onay bekleyenler</h2>' + pending.map(clubRow).join('') : '') +
      '<h2 style="margin:14px 0 6px">Yayındaki kulüpler</h2>' + (active.length ? active.map(clubRow).join('') : '<div class="empty">Henüz kulüp yok</div>');
    else body = upcoming.length ? upcoming.map(function (e) { return permitRow(e, false); }).join('') : '<div class="empty">Yaklaşan etkinlik yok</div>';

    $app.innerHTML = '<div class="head"><div><h1>SKS paneli</h1><div class="sub">' + esc(title) + '</div></div><button class="ghost" id="ref">↻ Yenile</button></div>' +
      '<div class="kpis">' + kpi('İzin bekleyen', n(st.permits_pending), st.permits_pending ? 'Değerlendirmen gerekiyor' : 'Hepsi güncel', !!st.permits_pending) +
        kpi('Onay bekleyen kulüp', n(st.clubs_pending), '', false) + kpi('Yayındaki kulüp', n(st.clubs_active), n(st.clubs_official) + ' resmî', false) +
        kpi('Son 30 gün kayıt', n(st.registrations_30d), '', false) + kpi('Son 30 gün giriş', n(st.checkins_30d), '', false) +
        kpi('Yaklaşan etkinlik', n(upcoming.length), '', false) + '</div>' +
      '<div class="card"><div class="tabs">' + tab('permits', 'Etkinlik izinleri', permits.length) + tab('clubs', 'Kulüpler', pending.length) + tab('events', 'Yaklaşan etkinlikler', 0) + '</div>' + body + '</div>';

    document.getElementById('ref').onclick = function () { this.textContent = 'Yenileniyor…'; load(); };
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) { b.onclick = function () { S.tab = b.getAttribute('data-t'); S.rejecting = null; render(); }; });
    Array.prototype.forEach.call(document.querySelectorAll('.a'), function (b) { b.onclick = function () { act(b); }; });
  }

  function act(b) {
    var a = b.getAttribute('data-a'), id = b.getAttribute('data-id'), p;
    if (a === 'permit-no') { S.rejecting = id; render(); var w = document.getElementById('why'); if (w) w.focus(); return; }
    if (a === 'cancel') { S.rejecting = null; render(); return; }
    if (a === 'send-reject') {
      var why = (document.getElementById('why') || {}).value || '';
      if (why.trim().length < 5) { toast('Reddetme gerekçesi yaz'); return; }
      p = sb.rpc('sks_decide_permit', { p_event: id, p_approve: false, p_note: why.trim() });
    } else if (a === 'permit-ok') p = sb.rpc('sks_decide_permit', { p_event: id, p_approve: true, p_note: '' });
    else { if (a === 'reject' && !confirm('Bu kulüp başvurusu reddedilsin mi?')) return; p = sb.rpc('sks_set_club', { p_club: id, p_action: a }); }
    b.disabled = true;
    p.then(function (r) {
      if (r.error) throw r.error;
      S.rejecting = null;
      toast({ 'permit-ok': 'Etkinlik izni onaylandı', 'send-reject': 'İzin reddedildi, gerekçe kulübe iletildi', approve: 'Kulüp resmî olarak onaylandı', reject: 'Kulüp başvurusu reddedildi', official: 'Kulüp artık resmî', unofficial: 'Resmî rozet kaldırıldı' }[a] || 'Kaydedildi');
      return load();
    }).catch(function (e) { b.disabled = false; toast(e.message); });
  }

  load();
})();
