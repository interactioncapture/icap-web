// icap · web yönetim paneli. Veriye yalnızca icap yöneticisi (platform_admins) erişir:
// admin_overview / admin_clubs fonksiyonları yetkiyi sunucuda kontrol eder.
(function () {
  var URL = 'https://jjbhkvkrxcqxphocvzir.supabase.co';
  var KEY = 'sb_publishable_3AHz9Bo5DKvn04tE7dX9vQ_SEBPumcp';
  var sb = window.supabase.createClient(URL, KEY);
  var $app = document.getElementById('app'), $who = document.getElementById('who');
  var S = { tab: 'pending', ov: null, clubs: [], busy: null, unis: null };
  var SRC = { app: ['Uygulama', '#7C3AED'], web: ['Web', '#22D3EE'], whatsapp: ['WhatsApp', '#16A34A'], poster: ['Afiş (QR)', '#FF8A00'] };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function color(c) { return /^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : '#7C3AED'; }
  function n(x) { return Number(x || 0).toLocaleString('tr-TR'); }
  function date(s, withTime) {
    if (!s) return '';
    var d = new Date(s);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + (withTime ? ' · ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '');
  }
  function ago(s) {
    var m = (Date.now() - new Date(s).getTime()) / 60000;
    if (m < 1) return 'az önce'; if (m < 60) return Math.floor(m) + ' dk önce';
    if (m < 1440) return Math.floor(m / 60) + ' sa önce'; return date(s);
  }
  function uniName(id) {
    if (!S.unis) { try { S.unis = {}; (window.ICAP_UNIS || []).forEach(function (u) { S.unis[u[0]] = u[2]; }); } catch (e) { S.unis = {}; } }
    return S.unis[id] || id || '';
  }
  function toast(t) {
    var el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }

  // ---------- Giriş ----------
  function loginView(err) {
    $who.innerHTML = '';
    $app.innerHTML = '<div class="center"><form class="login" id="lf">' +
      '<h1>Yönetim paneli</h1><p>icap yönetici hesabınla giriş yap.</p>' +
      '<input class="in" id="em" type="email" placeholder="E-posta" autocomplete="username" required>' +
      '<input class="in" id="pw" type="password" placeholder="Şifre" autocomplete="current-password" required>' +
      (err ? '<div class="err">' + esc(err) + '</div>' : '') +
      '<button class="btn" id="go">Giriş yap</button></form></div>';
    document.getElementById('lf').onsubmit = function (e) {
      e.preventDefault();
      var b = document.getElementById('go'); b.disabled = true; b.textContent = 'Giriş yapılıyor…';
      sb.auth.signInWithPassword({ email: document.getElementById('em').value.trim(), password: document.getElementById('pw').value })
        .then(function (r) { if (r.error) throw r.error; return load(); })
        .catch(function (e) { loginView(/invalid login/i.test(e.message) ? 'E-posta veya şifre hatalı.' : e.message); });
    };
  }

  // ---------- Veri ----------
  function load() {
    return sb.auth.getSession().then(function (r) {
      var sess = r.data.session;
      if (!sess) return loginView();
      $who.innerHTML = '<span>' + esc(sess.user.email) + '</span><button id="out">Çıkış</button>';
      document.getElementById('out').onclick = function () { sb.auth.signOut().then(function () { loginView(); }); };
      return Promise.all([sb.rpc('admin_overview'), sb.rpc('admin_clubs'), sb.rpc('list_campus_admins')]).then(function (res) {
        var bad = res.slice(0, 2).find(function (x) { return x.error; });
        if (bad) {
          var m = bad.error.message || '';
          if (/yönetici/i.test(m)) { $app.innerHTML = '<div class="center"><div class="login"><h1>Erişim yok</h1><p>Bu hesap icap yöneticisi değil.</p></div></div>'; return; }
          if (/could not find|does not exist/i.test(m)) { $app.innerHTML = '<div class="center"><div class="login"><h1>Güncelleme gerekli</h1><p>Veritabanına 010_admin_panel.sql uygulanmamış.</p></div></div>'; return; }
          throw bad.error;
        }
        S.ov = res[0].data; S.clubs = res[1].data || []; S.sks = (res[2] && !res[2].error && res[2].data) || [];
        render();
      });
    }).catch(function (e) { $app.innerHTML = '<div class="center"><div class="login"><h1>Yüklenemedi</h1><p class="err">' + esc(e.message) + '</p><button class="btn" onclick="location.reload()">Tekrar dene</button></div></div>'; });
  }

  // ---------- Görünüm ----------
  function kpi(l, v, d, hot) { return '<div class="kpi' + (hot ? ' hot' : '') + '"><div class="l">' + l + '</div><div class="v">' + v + '</div>' + (d ? '<div class="d">' + d + '</div>' : '') + '</div>'; }

  function chart(daily) {
    var max = 1; daily.forEach(function (d) { max = Math.max(max, d.registrations, d.users); });
    return '<div class="bars">' + daily.map(function (d) {
      var day = new Date(d.day + 'T12:00:00');
      return '<div class="bar" title="' + esc(date(d.day + 'T12:00:00') + ': ' + d.registrations + ' kayıt, ' + d.users + ' yeni kullanıcı') + '"><div class="pair">' +
        '<i style="height:' + (d.registrations / max * 100) + '%"></i><i class="u" style="height:' + (d.users / max * 100) + '%"></i></div>' +
        '<span>' + day.getDate() + '</span></div>';
    }).join('') + '</div><div class="legend"><span><b style="background:var(--violet)"></b>Etkinlik kaydı</span><span><b style="background:var(--lime)"></b>Yeni kullanıcı</span></div>';
  }

  function sources(by) {
    var total = 0; Object.keys(by || {}).forEach(function (k) { total += by[k]; });
    if (!total) return '<div class="empty">Henüz kayıt yok</div>';
    return '<div class="src">' + Object.keys(SRC).map(function (k) {
      var v = (by || {})[k] || 0, p = Math.round(v / total * 100);
      return '<div class="row"><span>' + SRC[k][0] + '</span><div class="track"><div class="fill" style="width:' + p + '%;background:' + SRC[k][1] + '"></div></div><span class="n">%' + p + '</span></div>';
    }).join('') + '</div><p class="legend" style="margin-top:12px">Toplam ' + n(total) + ' kayıt · davetin hangi kanaldan geldiği (Interaction Capture)</p>';
  }

  function clubRow(c) {
    var fg = ['#C6F432', '#22D3EE'].indexOf(c.color) >= 0 ? '#15111F' : '#fff';
    var v = c.founder_domain
      ? '<span class="chip ok">✓ ' + esc(c.founder_domain) + ' ile doğrulandı</span>'
      : c.kind === 'crew' ? '<span class="chip">Ekip · okul e-postası gerekmez</span>'
      : '<span class="chip warn">Okul e-postası doğrulanmadı</span>';
    if (c.kind === 'crew') v = '<span class="chip">Ekip' + (c.university ? '' : ' · kampüsler arası') + '</span>' + (c.founder_domain ? v : '');
    var acts = '';
    if (c.status === 'pending') acts = '<button class="a ok" data-a="active" data-id="' + c.id + '">Onayla</button><button class="a no" data-a="rejected" data-id="' + c.id + '">Reddet</button>';
    else if (c.status === 'active') acts = '<button class="a tick" data-a="tick" data-id="' + c.id + '">' + (c.verified ? 'Tiki kaldır' : 'Mavi tik ver') + '</button>';
    else acts = '<button class="a ok" data-a="active" data-id="' + c.id + '">Yeniden onayla</button>';
    return '<div class="club"><div class="logo" style="background:' + color(c.color) + ';color:' + fg + '">' + esc(c.short) + '</div>' +
      '<div><h3>' + esc(c.name) + (c.verified ? ' <span style="color:var(--violet)">✓</span>' : '') + '</h3><p>' + esc(c.about) + '</p>' +
      '<div class="meta">' + v + '<span class="chip v">' + esc(uniName(c.university)) + '</span>' +
      '<span class="chip">Kurucu: ' + esc(c.founder_name || '—') + (c.founder_email ? ' · ' + esc(c.founder_email) : '') + '</span>' +
      '<span class="chip">' + n(c.members) + ' üye · ' + n(c.events) + ' etkinlik</span><span class="chip">' + date(c.created_at) + '</span></div></div>' +
      '<div class="acts">' + acts + '</div></div>';
  }

  function render() {
    var o = S.ov || {}, cl = o.clubs || {};
    var groups = { pending: [], active: [], rejected: [] };
    S.clubs.forEach(function (c) { (groups[c.status] || groups.pending).push(c); });
    var list = groups[S.tab];
    var top = (o.top_events || []).map(function (e) {
      var p = e.capacity ? Math.min(100, Math.round(e.going / e.capacity * 100)) : 0;
      return '<tr><td><b>' + esc(e.title) + '</b><div class="s">' + esc(e.club) + ' · ' + date(e.starts_at, true) + '</div><div class="prog"><i style="width:' + p + '%"></i></div></td>' +
        '<td class="num">' + n(e.going) + '<div class="s">/ ' + n(e.capacity) + '</div></td><td class="num">' + n(e.checked_in) + '</td></tr>';
    }).join('');
    var regs = (o.recent_registrations || []).map(function (r) {
      return '<tr><td><b>' + esc(r.full_name || 'İsimsiz') + '</b><div class="s">' + esc(r.title) + '</div></td><td><span class="pill ' + esc(r.source) + '">' + esc((SRC[r.source] || [r.source])[0]) + '</span></td><td class="num s">' + ago(r.created_at) + '</td></tr>';
    }).join('');
    var users = (o.recent_users || []).map(function (u) {
      return '<tr><td><b>' + esc(u.full_name || 'İsimsiz') + '</b><div class="s">' + esc([uniName(u.university), u.department].filter(Boolean).join(' · ')) + '</div></td><td>' +
        (u.edu_domain ? '<span class="pill app">✓ ' + esc(u.edu_domain) + '</span>' : '') + '</td><td class="num s">' + ago(u.created_at) + '</td></tr>';
    }).join('');
    var conv = o.registrations ? Math.round(o.checkins / o.registrations * 100) : 0;

    $app.innerHTML =
      '<div class="head"><div><h1>Genel bakış</h1><div class="sub">Son güncelleme ' + date(o.generated_at, true) + '</div></div>' +
      '<button class="ghost" id="ref">↻ Yenile</button></div>' +
      '<div class="kpis">' +
        kpi('Onay bekleyen kulüp', n(cl.pending), cl.pending ? 'İncelemen gerekiyor' : 'Hepsi güncel', !!cl.pending) +
        kpi('Kullanıcı', n(o.users), '+' + n(o.users_7d) + ' son 7 gün') +
        kpi('Yayındaki kulüp', n(cl.active), n(o.verified_founders) + ' doğrulanmış kurucu') +
        kpi('Yaklaşan etkinlik', n(o.events_upcoming), n(o.events_total) + ' toplam') +
        kpi('Etkinlik kaydı', n(o.registrations), '+' + n(o.registrations_7d) + ' son 7 gün') +
        kpi('Kapıda giriş', n(o.checkins), 'kayıtların %' + conv + '\'i') +
      '</div>' +
      '<div class="grid"><div class="card"><h2>Son 14 gün <small>günlük</small></h2>' + chart(o.daily || []) + '</div>' +
      '<div class="card"><h2>Kayıt kaynağı</h2>' + sources(o.by_source) + '</div></div>' +
      '<div class="card" style="margin-bottom:16px"><h2>Kulüpler</h2><div class="tabs">' +
        tab('pending', 'Onay bekleyen', groups.pending.length) + tab('active', 'Yayında', groups.active.length) + tab('rejected', 'Reddedilen', groups.rejected.length) +
      '</div>' + (list.length ? list.map(clubRow).join('') : '<div class="empty">Bu listede kulüp yok</div>') + '</div>' +
      '<div class="grid"><div class="card"><h2>Öne çıkan etkinlikler <small>son 30 gün ve yaklaşan</small></h2>' +
        (top ? '<table><tr><th>Etkinlik</th><th style="text-align:right">Kayıt</th><th style="text-align:right">Giriş</th></tr>' + top + '</table>' : '<div class="empty">Etkinlik yok</div>') + '</div>' +
      '<div class="card"><h2>Son kayıtlar</h2>' + (regs ? '<table>' + regs + '</table>' : '<div class="empty">Henüz kayıt yok</div>') + '</div></div>' +
      '<div class="card" style="margin-bottom:16px"><h2>Yeni kullanıcılar</h2>' + (users ? '<table>' + users + '</table>' : '<div class="empty">Henüz kullanıcı yok</div>') + '</div>' + sksCard();

    document.getElementById('ref').onclick = function () { this.textContent = 'Yenileniyor…'; load(); };
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) { b.onclick = function () { S.tab = b.getAttribute('data-t'); render(); }; });
    Array.prototype.forEach.call(document.querySelectorAll('.a'), function (b) { b.onclick = function () { act(b); }; });
    bindSks(); // SKS düğmeleri kendi işleyicilerini alır (yukarıdaki genel .a işleyicisinin üzerine yazar)
  }
  // ---------- SKS yöneticileri ----------
  function sksCard() {
    var opts = (window.ICAP_UNIS || []).map(function (u) { return '<option value="' + esc(u[0]) + '">' + esc(u[1]) + '</option>'; }).join('');
    var rows = (S.sks || []).map(function (r) {
      return '<tr><td><b>' + esc(r.full_name || r.email) + '</b><div class="s">' + esc(r.email) + '</div></td><td>' + esc(uniName(r.university)) + '<div class="s">' + esc(r.title) + '</div></td>' +
        '<td class="num"><button class="a no" data-rv="' + esc(r.user_id) + '" data-u="' + esc(r.university) + '">Kaldır</button></td></tr>';
    }).join('');
    return '<div class="card"><h2>SKS yöneticileri <small>kampüs kulüplerini ve etkinlik izinlerini yönetir</small></h2>' +
      '<p class="legend" style="margin:0 0 12px">Kişi önce uygulamada hesap açar. Kurumsal personel e-postasını kontrol edip yetkiyi buradan ver. SKS paneli: <a href="../sks/" target="_blank">/sks/</a></p>' +
      '<div style="display:grid;grid-template-columns:1.2fr 1.2fr 1fr auto;gap:8px;margin-bottom:12px">' +
      '<input class="in" id="sksEm" type="email" placeholder="personel@universite.edu.tr">' +
      '<select class="in" id="sksUni"><option value="">Üniversite seç</option>' + opts + '</select>' +
      '<input class="in" id="sksTi" value="SKS Daire Başkanlığı" maxlength="60">' +
      '<button class="btn" id="sksGo" style="padding:0 16px">Yetki ver</button></div>' +
      (rows ? '<table>' + rows + '</table>' : '<div class="empty">Henüz SKS yöneticisi yok</div>') + '</div>';
  }
  function bindSks() {
    var go = document.getElementById('sksGo'); if (!go) return;
    go.onclick = function () {
      var em = document.getElementById('sksEm').value.trim(), u = document.getElementById('sksUni').value, ti = document.getElementById('sksTi').value.trim();
      if (!em || !u) { toast('E-posta ve üniversite gir'); return; }
      var dom = em.split('@')[1] || '';
      if (!/\.edu\.tr$/.test(dom) || /^(ogr|std|stu|student|ug)\./.test(dom)) { if (!confirm(dom + ' kurumsal personel adresi gibi görünmüyor. Yine de yetki verilsin mi?')) return; }
      go.disabled = true;
      sb.rpc('grant_campus_admin', { p_email: em, p_university: u, p_title: ti }).then(function (r) { if (r.error) throw r.error; toast(em + ' artık ' + uniName(u) + ' SKS yöneticisi'); return load(); })
        .catch(function (e) { go.disabled = false; toast(e.message); });
    };
    Array.prototype.forEach.call(document.querySelectorAll('[data-rv]'), function (b) {
      b.onclick = function () {
        if (!confirm('SKS yetkisi kaldırılsın mı?')) return;
        sb.rpc('revoke_campus_admin', { p_user: b.getAttribute('data-rv'), p_university: b.getAttribute('data-u') }).then(function (r) { if (r.error) throw r.error; toast('Yetki kaldırıldı'); return load(); })
          .catch(function (e) { toast(e.message); });
      };
    });
  }

  function tab(k, l, c) { return '<button class="tab' + (S.tab === k ? ' on' : '') + '" data-t="' + k + '">' + l + (k === 'pending' && c ? '<em>' + c + '</em>' : ' · ' + c) + '</button>'; }

  function act(b) {
    var id = b.getAttribute('data-id'), a = b.getAttribute('data-a');
    var c = S.clubs.find(function (x) { return x.id === id; }); if (!c) return;
    if (a === 'rejected' && !confirm(c.name + ' reddedilsin mi?')) return;
    b.disabled = true;
    var p = a === 'tick' ? { p_club: id, p_status: 'active', p_verified: !c.verified } : { p_club: id, p_status: a };
    sb.rpc('set_club_status', p).then(function (r) {
      if (r.error) throw r.error;
      toast(a === 'tick' ? (c.verified ? 'Tik kaldırıldı' : 'Mavi tik verildi') : a === 'active' ? c.name + ' onaylandı' : c.name + ' reddedildi');
      return load();
    }).catch(function (e) { b.disabled = false; toast(e.message); });
  }

  load();
})();
