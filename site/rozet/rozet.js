// icap · Yaka kartı paneli (web). Organizatör, katılımcılar için yaka kartı yazıcısına uygun kart basar.
// Yetki sunucuda: kayıtları ve profilleri yalnızca etkinliğin yöneticisi (kulüp yöneticisi ya da buluşma sahibi) görür,
// tasarımı (events.badge) yalnızca o kaydeder. QR, uygulamadaki biletle aynı kodu taşır; kapıda "QR okut" ile okunur.
(function () {
  var URL_ = 'https://jjbhkvkrxcqxphocvzir.supabase.co';
  var KEY = 'sb_publishable_3AHz9Bo5DKvn04tE7dX9vQ_SEBPumcp';
  var sb = window.supabase.createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'icap-web-auth' } });
  var $app = document.getElementById('app'), $who = document.getElementById('who'), $print = document.getElementById('print');
  var UNIS = {}; (window.ICAP_UNIS || []).forEach(function (u) { UNIS[u[0]] = { name: u[1], short: u[2] }; });

  // Yaka kartı yazıcılarının yaygın ölçüleri (mm)
  var SIZES = {
    p34: { w: 76.2, h: 101.6, l: '3×4 inç dikey · Zebra, Brother, Epson, Dymo' },
    l43: { w: 101.6, h: 76.2, l: '4×3 inç yatay' },
    ql62: { w: 62, h: 100, l: 'Brother QL · 62 mm rulo' },
    cr80: { w: 53.98, h: 85.6, l: 'PVC kart CR80 · kart yazıcı' },
    a6: { w: 105, h: 148, l: 'A6 dikey' },
    a4x8: { w: 90, h: 65, l: 'A4 kâğıda 8 kart · ofis yazıcısı (kesme çizgili)', sheet: true },
  };
  var COLORS = ['#7C3AED', '#15111F', '#FF3D8B', '#FF8A00', '#0EA5E9', '#16A34A', '#B91C1C', '#FFFFFF'];
  var STATUS = { approved: 'Onaylı', checked_in: 'İçeride', pending: 'Onay bekliyor', waitlist: 'Bekleme listesi', walkin: 'Kapıda kayıt' };
  // Kişiye özel rol seçenekleri (boş = tasarımdaki varsayılan rol)
  var ROLES = ['Katılımcı', 'Konuşmacı', 'Jüri', 'Mentor', 'Gönüllü', 'Organizatör', 'Basın', 'Misafir', 'Sponsor'];
  var DEF = { size: 'p34', mode: 'text', title: '', sub: '', color: '#7C3AED', image: '', fit: 'contain', head: 30, mono: false, role: 'Katılımcı', dept: true, qr: true, hole: false };
  var S = { uid: null, events: [], ev: null, people: [], sel: {}, q: '', f: 'ok', D: null, dirty: false, busy: false, walk: false };
  function hm(iso) { try { return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function light(c) { return ['#FFFFFF', '#C6F432', '#22D3EE'].indexOf(String(c).toUpperCase()) >= 0; }
  function toast(t) { var el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el); setTimeout(function () { el.remove(); }, 2800); }
  function msgBox(h, p) { $app.innerHTML = '<div class="center"><div class="login"><h1>' + h + '</h1><p>' + p + '</p></div></div>'; }
  function when(e) {
    try { return new Date(e.starts_at).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: e.tz || 'Europe/Istanbul' }); }
    catch (_) { return new Date(e.starts_at).toLocaleString('tr-TR'); }
  }
  function owner(e) { return e.kind === 'meetup' ? (e.host_name || 'Buluşma') : ((e.clubs && e.clubs.name) || 'Kulüp'); }
  function param(k) { return new URLSearchParams(location.search).get(k); }

  // ---------- Giriş ----------
  function loginView(err) {
    $who.innerHTML = '';
    $app.innerHTML = '<div class="center"><form class="login" id="lf"><h1>Yaka kartı bas</h1><p>icap hesabınla giriş yap. Yalnızca yönettiğin etkinliklerin katılımcılarını görürsün.</p>' +
      '<input class="in" id="em" type="email" placeholder="E-posta" autocomplete="username" required>' +
      '<input class="in" id="pw" type="password" placeholder="Şifre" autocomplete="current-password" required>' +
      (err ? '<div class="err">' + esc(err) + '</div>' : '') + '<button class="btn" id="go">Giriş yap</button></form></div>';
    document.getElementById('lf').onsubmit = function (e) {
      e.preventDefault(); var b = document.getElementById('go'); b.disabled = true; b.textContent = 'Giriş yapılıyor…';
      sb.auth.signInWithPassword({ email: document.getElementById('em').value.trim(), password: document.getElementById('pw').value })
        .then(function (r) { if (r.error) throw r.error; return start(); })
        .catch(function (e) { loginView(/invalid login/i.test(e.message) ? 'E-posta veya şifre hatalı.' : e.message); });
    };
  }

  function start() {
    return sb.auth.getSession().then(function (r) {
      var sess = r.data.session; if (!sess) return loginView();
      S.uid = sess.user.id;
      $who.innerHTML = '<span>' + esc(sess.user.email) + '</span><button id="out">Çıkış</button>';
      document.getElementById('out').onclick = function () { sb.auth.signOut().then(function () { loginView(); }); };
      return loadEvents();
    }).catch(function (e) { msgBox('Yüklenemedi', '<span class="err">' + esc(e.message) + '</span>'); });
  }

  // ---------- Etkinlikler ----------
  // icap yönetimi (platform_admins) bütün etkinlikleri görür; diğerleri yönettiği kulüplerin etkinliklerini ve kendi buluşmalarını
  function loadEvents() {
    return Promise.all([
      sb.from('club_members').select('club_id').eq('user_id', S.uid).eq('role', 'admin'),
      sb.from('platform_admins').select('user_id').eq('user_id', S.uid).maybeSingle(),
    ]).then(function (res) {
      var m = res[0];
      if (m.error) throw m.error;
      S.platform = !!(res[1] && res[1].data);
      var ids = (m.data || []).map(function (x) { return x.club_id; });
      var qy = sb.from('events').select('id,title,starts_at,place,tz,club_id,kind,host_id,host_name,badge,clubs(name,short,color)')
        .gte('starts_at', new Date(Date.now() - 7 * 864e5).toISOString()).order('starts_at').limit(S.platform ? 300 : 100);
      if (!S.platform) qy = qy.or('host_id.eq.' + S.uid + (ids.length ? ',club_id.in.(' + ids.join(',') + ')' : ''));
      return qy;
    }).then(function (r) {
      if (r.error) throw r.error;
      S.events = r.data || [];
      var want = param('e');
      var ev = want && S.events.filter(function (e) { return e.id === want; })[0];
      if (ev) return openEvent(ev);
      if (want && !ev) toast('Bu etkinliği yönetmiyorsun ya da etkinlik bulunamadı');
      renderEvents();
    }).catch(function (e) { msgBox('Yüklenemedi', '<span class="err">' + esc(e.message) + '</span>'); });
  }

  function renderEvents() {
    $app.innerHTML = '<div class="head"><div><h1>Yaka kartı bas</h1><div class="sub">' + (S.platform ? 'icap yönetimi · tüm yaklaşan etkinlikler' : 'Yönettiğin yaklaşan etkinlikler') + '</div></div></div>' +
      (S.events.length ? '<div class="events">' + S.events.map(function (e) {
        return '<button class="ev" data-id="' + e.id + '"><h3>' + esc(e.title) + '</h3><p>' + esc(owner(e)) + '</p><p>' + esc(when(e)) + ' · ' + esc(e.place) + '</p></button>';
      }).join('') + '</div>' : '<div class="empty">Yönettiğin yaklaşan bir etkinlik yok. Kulübünün yöneticisiysen ya da bir buluşma açtıysan burada görünür.</div>');
    Array.prototype.forEach.call(document.querySelectorAll('.ev[data-id]'), function (b) {
      b.onclick = function () { openEvent(S.events.filter(function (e) { return e.id === b.getAttribute('data-id'); })[0]); };
    });
  }

  function openEvent(ev) {
    S.ev = ev; S.sel = {}; S.q = '';
    var saved = ev.badge && typeof ev.badge === 'object' ? ev.badge : {};
    S.D = Object.assign({}, DEF, { title: owner(ev) }, saved);
    if (!SIZES[S.D.size]) S.D.size = 'p34';
    S.dirty = !Object.keys(saved).length;
    history.replaceState(null, '', '?e=' + ev.id);
    $app.innerHTML = '<div class="center"><div class="spin"></div></div>';
    // Rol ve basıldı alanları (025) yoksa eski sorguyla devam: panel hiçbir durumda kapıda durmaz
    var full = 'id,user_id,status,ticket_code,badge_role,badge_printed_at';
    var regs = function (cols) { return sb.from('registrations').select(cols).eq('event_id', ev.id).neq('status', 'cancelled').order('created_at'); };
    return regs(full).then(function (r) { S.v25 = !r.error; return r.error ? regs('id,user_id,status,ticket_code') : r; }).then(function (r) {
      if (r.error) throw r.error;
      var rows = r.data || [];
      var ids = rows.map(function (x) { return x.user_id; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
      return Promise.all([
        ids.length ? sb.from('profiles').select('id,full_name,department,university').in('id', ids) : Promise.resolve({ data: [] }),
        S.v25 ? sb.from('badge_walkins').select('id,name,dept,role,printed_at').eq('event_id', ev.id).order('created_at') : Promise.resolve({ data: [] }),
      ]).then(function (res) {
        var by = {}; (res[0].data || []).forEach(function (x) { by[x.id] = x; });
        var list = rows.map(function (x) {
          var pr = by[x.user_id] || {};
          var uni = UNIS[pr.university] || null;
          return { id: x.id, kind: 'reg', name: pr.full_name || 'İsimsiz katılımcı', dept: [pr.department, uni ? uni.short : ''].filter(Boolean).join(' · '), code: x.ticket_code, status: x.status, role: x.badge_role || '', printedAt: x.badge_printed_at || null };
        });
        (res[1].data || []).forEach(function (w) { list.push({ id: w.id, kind: 'walk', name: w.name, dept: w.dept || '', code: '', status: 'walkin', role: w.role || '', printedAt: w.printed_at || null }); });
        S.people = list.sort(function (a, b) { return a.name.localeCompare(b.name, 'tr'); });
        render();
      });
    }).catch(function (e) { msgBox('Yüklenemedi', '<span class="err">' + esc(e.message) + '</span>'); });
  }

  // ---------- Kart ----------
  function qrSvg(code) {
    try { return window.icapQr(code, 'Q', 3); } catch (_) { return ''; }
  }

  function badgeHTML(p, D) {
    var z = SIZES[D.size], w = z.w, h = z.h, land = w > h, base = Math.min(w, h);
    var hdH = Math.max(20, Math.min(50, +D.head || 30)) / 100 * h * (land ? 1.12 : 1), ftH = D.qr ? Math.min(base * 0.42, h * 0.32) : base * 0.12;
    var mono = !!D.mono, img = D.mode === 'image' && D.image;
    var fg = mono ? '#000000' : light(D.color) ? '#15111F' : '#FFFFFF';
    var head = D.mode === 'image' && D.image
      ? '<img src="' + esc(D.image) + '" alt="" style="' + (D.fit === 'cover' ? 'width:100%;height:100%;max-width:none;max-height:none;object-fit:cover' : '') + '">'
      : '<div class="t" style="font-size:' + (base * 0.105).toFixed(2) + 'mm">' + esc(D.title || '') + '</div>' + (D.sub ? '<div class="s" style="font-size:' + (base * 0.06).toFixed(2) + 'mm">' + esc(D.sub) + '</div>' : '');
    var hdBg = mono || img ? '#FFFFFF' : D.color;
    var name = p ? p.name : '';
    var role = (p && p.role) || D.role; // kişiye özel rol tasarımdaki varsayılanı ezer
    return '<div class="badge' + (mono ? ' mono' : '') + '" style="width:' + w + 'mm;height:' + h + 'mm">' +
      (D.hole ? '<div class="hole"></div>' : '') +
      '<div class="hd' + (D.mode === 'image' && D.image && D.fit === 'cover' ? ' bleed' : '') + '" style="height:' + hdH.toFixed(2) + 'mm;background:' + hdBg + ';color:' + fg + (D.hole ? ';padding-top:6mm' : '') + '">' + head + '</div>' +
      '<div class="bd">' +
        '<div class="nm" data-fit="' + (base * 0.16).toFixed(2) + '" style="height:' + (base * 0.36).toFixed(2) + 'mm">' + (name ? esc(name) : '&nbsp;') + '</div>' +
        (D.dept && p && p.dept ? '<div class="dp" style="font-size:' + (base * 0.058).toFixed(2) + 'mm">' + esc(p.dept) + '</div>' : '') +
        (role ? '<div class="role" style="font-size:' + (base * 0.05).toFixed(2) + 'mm;' + (mono ? 'background:#fff;color:#000;border:.45mm solid #000' : 'background:' + (light(D.color) ? '#15111F' : D.color) + ';color:#fff') + '">' + esc(role) + '</div>' : '') +
      '</div>' +
      '<div class="ft" style="height:' + ftH.toFixed(2) + 'mm">' +
        (D.qr && p && p.code ? '<div class="qr" style="width:' + (ftH - 3).toFixed(2) + 'mm;height:' + (ftH - 3).toFixed(2) + 'mm">' + qrSvg(p.code) + '</div>' : '') +
        '<div class="ev" style="font-size:' + (base * 0.042).toFixed(2) + 'mm">' + esc(S.ev.title) + '<br>' + esc(when(S.ev)) +
          (D.qr && p && p.code ? '<br><span class="code">' + esc(p.code) + '</span>' : '') + '</div>' +
        '<div class="ic" style="font-size:' + (base * 0.07).toFixed(2) + 'mm">icap</div>' +
      '</div></div>';
  }

  // İsmi kutuya sığdır: 2 satırı geçmeyecek, kelime bölünmeyecek şekilde küçült
  function fit(root) {
    Array.prototype.forEach.call(root.querySelectorAll('.nm[data-fit]'), function (el) {
      var fs = parseFloat(el.getAttribute('data-fit')), min = fs * 0.35;
      el.style.fontSize = fs + 'mm';
      el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.justifyContent = 'center';
      var inner = el.firstChild && el.firstChild.nodeType === 1 ? el.firstChild : null;
      for (var i = 0; i < 40 && fs > min && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1); i++) {
        fs *= 0.93; el.style.fontSize = fs.toFixed(2) + 'mm';
      }
      return inner;
    });
  }

  // ---------- Panel ----------
  function people() {
    var t = S.q.trim().toLocaleLowerCase('tr');
    return S.people.filter(function (p) {
      var okF = S.f === 'all' ? true
        : S.f === 'ok' ? (p.status === 'approved' || p.status === 'checked_in' || p.status === 'walkin')
        : S.f === 'unprinted' ? (!p.printedAt && (p.status === 'approved' || p.status === 'checked_in' || p.status === 'walkin'))
        : p.status === S.f;
      return okF && (!t || p.name.toLocaleLowerCase('tr').indexOf(t) >= 0 || (p.code || '').toLowerCase().indexOf(t) >= 0);
    });
  }

  function sampleP() { return people()[0] || S.people[0] || { name: 'Ayşe Yılmaz', dept: 'Bilgisayar Mühendisliği · ODTÜ', code: 'ICAP-ORNEK1' }; }

  function render() {
    var D = S.D, list = people(), nsel = Object.keys(S.sel).length;
    var sample = sampleP();
    $app.innerHTML =
      '<div class="head"><div><h1>' + esc(S.ev.title) + '</h1><div class="sub">' + esc(owner(S.ev)) + ' · ' + esc(when(S.ev)) + ' · ' + S.people.length + ' kayıt</div></div>' +
      '<button class="ghost" id="back">← Etkinlikler</button></div>' +
      '<div class="layout"><div class="panel">' +
        '<h2>Kart tasarımı</h2>' +
        '<div class="lbl">Yazıcı / kart ölçüsü</div><select class="in" id="size">' + Object.keys(SIZES).map(function (k) { return '<option value="' + k + '"' + (k === D.size ? ' selected' : '') + '>' + SIZES[k].l + '</option>'; }).join('') + '</select>' +
        '<div class="hint">Yazdırma penceresinde kâğıt boyutunu aynı ölçüye, kenar boşluğunu "Yok", ölçeği %100 seç.</div>' +
        '<label class="check mono-row"><input type="checkbox" id="mono"' + (D.mono ? ' checked' : '') + '> <span><b>Siyah-beyaz yazıcı</b><br><span class="hint">Termal yazıcılar (Zebra, Brother QL, Dymo) için: renkler siyaha, görsel yüksek kontrastlı griye çevrilir</span></span></label>' +
        '<div class="lbl">Üst bölüm</div><div class="seg"><button data-m="text" class="' + (D.mode === 'text' ? 'on' : '') + '">Yazı</button><button data-m="image" class="' + (D.mode === 'image' ? 'on' : '') + '">Kurumsal görsel</button></div>' +
        (D.mode === 'text'
          ? '<input class="in" id="title" maxlength="60" placeholder="Başlık (ör. ODTÜ Fotoğrafçılık Kulübü)" value="' + esc(D.title) + '">' +
            '<input class="in" id="sub" maxlength="60" placeholder="Alt satır (ör. Bahar Şenliği 2026)" value="' + esc(D.sub) + '">' +
            '<button class="pbtn" id="toImg">＋ Bunun yerine logo / afiş yükle</button>' +
            (D.mono ? '' : '<div class="lbl">Renk</div>') + '<div class="swatches"' + (D.mono ? ' hidden' : '') + '>' + COLORS.map(function (c) { return '<button class="sw' + (c === D.color ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + (c === '#FFFFFF' ? ';border-color:#ddd' : '') + '" title="' + c + '"></button>'; }).join('') + '</div>'
          : '<label class="drop" id="drop">' + (D.image ? '<img src="' + esc(D.image) + '" alt="">Değiştirmek için tıkla ya da sürükle' : '<b>Logo ya da afiş yükle</b><br>Tıkla ya da dosyayı buraya sürükle<br><span class="hint">PNG, JPG ya da WEBP · en fazla 3 MB</span>') +
            '<input type="file" id="file" accept="image/png,image/jpeg,image/webp" hidden></label>' +
            (D.image ? '<div class="seg"><button data-fit="contain" class="' + (D.fit !== 'cover' ? 'on' : '') + '">Logo · sığdır</button><button data-fit="cover" class="' + (D.fit === 'cover' ? 'on' : '') + '">Afiş · alanı kapla</button></div>' +
              '<button class="pbtn" id="rmImg">Görseli kaldır</button>' : '')) +
        '<div class="lbl">Üst bölüm yüksekliği · %' + D.head + '</div><input type="range" id="head" min="20" max="50" step="1" value="' + D.head + '">' +
        '<div class="lbl">Kartta</div>' +
        '<input class="in" id="role" maxlength="24" placeholder="Rol yazısı (boş bırakılabilir)" value="' + esc(D.role) + '">' +
        '<label class="check"><input type="checkbox" id="dept"' + (D.dept ? ' checked' : '') + '> Bölüm ve üniversite</label>' +
        '<label class="check"><input type="checkbox" id="qr"' + (D.qr ? ' checked' : '') + '> Bilet QR kodu (kapıda okutulur)</label>' +
        '<label class="check"><input type="checkbox" id="hole"' + (D.hole ? ' checked' : '') + '> Askı deliği payı bırak</label>' +
        '<button class="btn" id="save"' + (S.busy ? ' disabled' : '') + '>' + (S.dirty ? 'Tasarımı kaydet' : 'Tasarım kayıtlı ✓') + '</button>' +
        '<div class="hint">Kaydedilen tasarımı etkinliğin diğer yöneticileri de kullanır.</div>' +
      '</div><div>' +
        '<div class="preview" id="pv">' + badgeHTML(sample, D) + '</div>' +
        '<div class="list"><div class="tools">' +
          '<input class="in" id="q" placeholder="İsim ya da bilet kodu ara" value="' + esc(S.q) + '">' +
          '<select class="in" id="f" style="flex:none;width:auto"><option value="ok"' + (S.f === 'ok' ? ' selected' : '') + '>Onaylı ve içeride</option>' +
            (S.v25 ? '<option value="unprinted"' + (S.f === 'unprinted' ? ' selected' : '') + '>Henüz basılmamış</option><option value="walkin"' + (S.f === 'walkin' ? ' selected' : '') + '>Kapıda kayıt</option>' : '') +
            '<option value="all"' + (S.f === 'all' ? ' selected' : '') + '>Herkes</option><option value="pending"' + (S.f === 'pending' ? ' selected' : '') + '>Onay bekleyen</option><option value="waitlist"' + (S.f === 'waitlist' ? ' selected' : '') + '>Bekleme listesi</option></select>' +
          '<button class="btn sm" id="pSel"' + (nsel ? '' : ' disabled') + '>Seçilileri bas (' + nsel + ')</button>' +
          '<button class="ghost" id="pAll"' + (list.length ? '' : ' disabled') + '>Listedekileri bas (' + list.length + ')</button>' +
          (S.v25 ? '<button class="ghost" id="walkBtn" title="Hesabı olmayan ya da biletini açamayan kişi için">＋ Kapıda kayıt</button>' : '') +
          '<button class="ghost" id="pBlank" title="Kapıda elle yazmak için">Boş kart</button>' +
        '</div>' +
        (S.walk ? '<div class="walk"><b>Kapıda kayıt</b><span class="hint">Adı yaz, kartı hemen bas. Kayıt bu etkinliğe bağlı tutulur; etkinlik silinince silinir.</span>' +
          '<input class="in" id="wName" maxlength="80" placeholder="Ad Soyad" autocomplete="off">' +
          '<input class="in" id="wDept" maxlength="80" placeholder="Bölüm / kurum (isteğe bağlı)" autocomplete="off">' +
          '<select class="in" id="wRole"><option value="">Rol: tasarımdaki varsayılan</option>' + ROLES.map(function (r) { return '<option>' + r + '</option>'; }).join('') + '</select>' +
          '<div class="tools"><button class="btn sm" id="wGo">Kaydet ve bas</button><button class="ghost" id="wX">Vazgeç</button></div></div>' : '') +
        (S.v25 ? '<div class="hint" style="margin:2px 0 6px">' + S.people.filter(function (p) { return p.printedAt; }).length + ' / ' + S.people.filter(function (p) { return p.status === 'approved' || p.status === 'checked_in' || p.status === 'walkin'; }).length + ' kart basıldı</div>' : '') +
        '<label class="check" style="margin:4px 0 6px"><input type="checkbox" id="all"' + (list.length && list.every(function (p) { return S.sel[p.id]; }) ? ' checked' : '') + '> Listedekilerin hepsini seç</label>' +
        (list.length ? list.map(function (p) {
          var roleSel = S.v25 ? '<select class="rsel" data-r="' + p.id + '" title="Bu kişinin kartındaki rol"><option value="">' + esc(S.D.role ? 'Rol: ' + S.D.role : 'Rol yok') + '</option>' +
            ROLES.concat(p.role && ROLES.indexOf(p.role) < 0 ? [p.role] : []).map(function (r) { return '<option' + (r === p.role ? ' selected' : '') + '>' + esc(r) + '</option>'; }).join('') + '</select>' : '';
          return '<div class="person"><input type="checkbox" data-s="' + p.id + '"' + (S.sel[p.id] ? ' checked' : '') + '>' +
            '<div><div class="nm">' + esc(p.name) + '</div><div class="dt">' + esc(p.dept || '—') + (p.code ? ' · ' + esc(p.code) : '') +
              (p.printedAt ? ' · <span class="printed">Basıldı ✓ ' + esc(hm(p.printedAt)) + '</span>' : '') + '</div></div>' +
            roleSel +
            '<span class="st' + (p.status === 'checked_in' ? ' inside' : p.status === 'walkin' ? ' walkin' : '') + '">' + (STATUS[p.status] || p.status) + '</span>' +
            '<button class="pbtn" data-p="' + p.id + '">' + (p.printedAt ? 'Yeniden bas' : 'Bas') + '</button></div>';
        }).join('') : '<div class="empty">Bu listede kimse yok</div>') +
      '</div></div></div>';
    fit(document.getElementById('pv'));
    bind();
  }

  function setD(patch) { Object.assign(S.D, patch); S.dirty = true; render(); }

  function bind() {
    var $ = function (id) { return document.getElementById(id); };
    $('back').onclick = function () { history.replaceState(null, '', location.pathname); S.ev = null; renderEvents(); };
    $('size').onchange = function () { setD({ size: this.value }); };
    Array.prototype.forEach.call(document.querySelectorAll('[data-m]'), function (b) { b.onclick = function () { setD({ mode: b.getAttribute('data-m') }); }; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-c]'), function (b) { b.onclick = function () { setD({ color: b.getAttribute('data-c') }); }; });
    // Yazarken odak kaybolmasın: yalnızca önizlemeyi tazele
    ['title', 'sub', 'role'].forEach(function (k) {
      var el = $(k); if (!el) return;
      el.oninput = function () { S.D[k] = el.value; S.dirty = true; $('pv').innerHTML = badgeHTML(sampleP(), S.D); fit($('pv')); $('save').textContent = 'Tasarımı kaydet'; };
    });
    ['dept', 'qr', 'hole', 'mono'].forEach(function (k) { $(k).onchange = function () { var o = {}; o[k] = this.checked; setD(o); }; });
    if ($('file')) $('file').onchange = function () { if (this.files && this.files[0]) upload(this.files[0]); };
    Array.prototype.forEach.call(document.querySelectorAll('[data-fit]'), function (b) { b.onclick = function () { setD({ fit: b.getAttribute('data-fit') }); }; });
    if ($('toImg')) $('toImg').onclick = function () { setD({ mode: 'image' }); };
    if ($('rmImg')) $('rmImg').onclick = function () { setD({ image: '', mode: 'text' }); };
    $('head').oninput = function () { S.D.head = +this.value; S.dirty = true; $('pv').innerHTML = badgeHTML(sampleP(), S.D); fit($('pv')); $('save').textContent = 'Tasarımı kaydet'; this.previousElementSibling.textContent = 'Üst bölüm yüksekliği · %' + this.value; };
    $('head').onchange = function () { render(); };
    var drop = $('drop');
    if (drop) {
      drop.ondragover = function (e) { e.preventDefault(); drop.classList.add('over'); };
      drop.ondragleave = function () { drop.classList.remove('over'); };
      drop.ondrop = function (e) { e.preventDefault(); drop.classList.remove('over'); var f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) upload(f); };
    }
    // Önizlemedeki üst bölüme tıklayınca da görsel seçilir
    var hd = document.querySelector('#pv .hd'), pick = document.createElement('input');
    pick.type = 'file'; pick.accept = 'image/png,image/jpeg,image/webp';
    pick.onchange = function () { if (pick.files && pick.files[0]) upload(pick.files[0]); };
    if (hd) { hd.title = 'Logo ya da afiş yüklemek için tıkla'; hd.classList.add('pickable'); hd.onclick = function () { pick.click(); }; }
    $('save').onclick = save;
    $('q').oninput = function () { S.q = this.value; var pos = this.selectionStart; render(); var q = $('q'); q.focus(); q.setSelectionRange(pos, pos); };
    $('f').onchange = function () { S.f = this.value; render(); };
    $('all').onchange = function () { var on = this.checked; people().forEach(function (p) { if (on) S.sel[p.id] = true; else delete S.sel[p.id]; }); render(); };
    Array.prototype.forEach.call(document.querySelectorAll('[data-s]'), function (c) { c.onchange = function () { var id = c.getAttribute('data-s'); if (c.checked) S.sel[id] = true; else delete S.sel[id]; render(); }; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-p]'), function (b) { b.onclick = function () { var id = b.getAttribute('data-p'); printCards(S.people.filter(function (p) { return p.id === id; })); }; });
    $('pSel').onclick = function () { printCards(S.people.filter(function (p) { return S.sel[p.id]; })); };
    $('pAll').onclick = function () { printCards(people()); };
    $('pBlank').onclick = function () { var n = parseInt(prompt('Kaç boş kart?', '4') || '0', 10); if (n > 0 && n <= 100) printCards(Array.apply(null, Array(n)).map(function () { return null; })); };
    // Kişiye özel rol
    Array.prototype.forEach.call(document.querySelectorAll('[data-r]'), function (sel) {
      sel.onchange = function () {
        var id = sel.getAttribute('data-r'), p = S.people.filter(function (x) { return x.id === id; })[0]; if (!p) return;
        var role = sel.value, prev = p.role; p.role = role; render();
        var req = p.kind === 'walk' ? sb.from('badge_walkins').update({ role: role || null }).eq('id', id).select('id') : sb.rpc('set_badge_role', { p_reg: id, p_role: role });
        req.then(function (r) { if (r.error) { p.role = prev; render(); toast('Rol kaydedilemedi: ' + r.error.message); } });
      };
    });
    // Kapıda kayıt
    if ($('walkBtn')) $('walkBtn').onclick = function () { S.walk = true; render(); var n = $('wName'); if (n) n.focus(); };
    if ($('wX')) $('wX').onclick = function () { S.walk = false; render(); };
    if ($('wGo')) {
      var go = function () {
        var name = ($('wName').value || '').trim(), dept = ($('wDept').value || '').trim(), role = $('wRole').value;
        if (name.length < 2) { toast('Adı yaz'); $('wName').focus(); return; }
        $('wGo').disabled = true;
        sb.from('badge_walkins').insert({ event_id: S.ev.id, name: name, dept: dept, role: role || null }).select('id,name,dept,role,printed_at').single().then(function (r) {
          if (r.error) throw r.error;
          var p = { id: r.data.id, kind: 'walk', name: r.data.name, dept: r.data.dept || '', code: '', status: 'walkin', role: r.data.role || '', printedAt: null };
          S.people.push(p); S.people.sort(function (a, b) { return a.name.localeCompare(b.name, 'tr'); });
          S.walk = false; render(); printCards([p]);
        }).catch(function (e) { $('wGo').disabled = false; toast('Kaydedilemedi: ' + e.message); });
      };
      $('wGo').onclick = go;
      ['wName', 'wDept'].forEach(function (k) { $(k).onkeydown = function (e) { if (e.key === 'Enter') go(); }; });
    }
  }

  // Basıldı işareti: yazdırma penceresi açıldığında (gerçekten basılıp basılmadığını tarayıcı bildirmez; yeniden basmak her zaman serbest)
  function markPrinted(list) {
    if (!S.v25) return;
    var regs = [], walks = [];
    list.forEach(function (p) { if (!p) return; (p.kind === 'walk' ? walks : regs).push(p.id); });
    if (!regs.length && !walks.length) return;
    var now = new Date().toISOString();
    sb.rpc('mark_badges_printed', { p_event: S.ev.id, p_regs: regs, p_walkins: walks }).then(function (r) {
      if (r.error) return toast('Basıldı işareti kaydedilemedi: ' + r.error.message);
      list.forEach(function (p) { if (p) p.printedAt = now; });
      render();
    });
  }

  function upload(file) {
    if (file.size > 3 * 1024 * 1024) return toast('Görsel en fazla 3 MB olabilir');
    if (['image/png', 'image/jpeg', 'image/webp'].indexOf(file.type) < 0) return toast('PNG, JPG ya da WEBP yükle');
    var ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    // Görsel etkinliğin klasörüne: kulüp etkinliğinde kulübün, buluşmada sahibinin (yönetim de bu klasöre yükler)
    var folder = S.ev.club_id || S.ev.host_id || S.uid;
    var path = folder + '/badge-' + S.ev.id + '-' + Date.now() + '.' + ext;
    toast('Yükleniyor…');
    sb.storage.from('event-covers').upload(path, file, { contentType: file.type, upsert: false }).then(function (r) {
      if (r.error) throw r.error;
      setD({ image: sb.storage.from('event-covers').getPublicUrl(path).data.publicUrl, mode: 'image' });
      toast('Görsel eklendi · kaydetmeyi unutma');
    }).catch(function (e) { toast('Yüklenemedi: ' + e.message); });
  }

  function save() {
    if (S.busy) return;
    S.busy = true; render();
    var D = {}; Object.keys(DEF).forEach(function (k) { D[k] = S.D[k]; });
    sb.from('events').update({ badge: D }).eq('id', S.ev.id).select('id').then(function (r) {
      S.busy = false;
      if (r.error) { toast('Kaydedilemedi: ' + r.error.message); return render(); }
      if (!r.data || !r.data.length) { toast('Bu etkinliğin tasarımını değiştirme yetkin yok'); return render(); }
      S.ev.badge = D; S.dirty = false; toast('Tasarım kaydedildi'); render();
    });
  }

  // ---------- Baskı ----------
  function printCards(list) {
    if (!list.length) return toast('Basılacak kart yok');
    var D = S.D, z = SIZES[D.size];
    var css = z.sheet ? '@page{size:A4 portrait;margin:8mm}' : '@page{size:' + z.w + 'mm ' + z.h + 'mm;margin:0}';
    var html = '<style>' + css + '</style>';
    if (z.sheet) {
      for (var i = 0; i < list.length; i += 8) {
        html += '<div class="pg sheet" style="grid-template-columns:repeat(2,' + z.w + 'mm);grid-auto-rows:' + z.h + 'mm;gap:0">' +
          list.slice(i, i + 8).map(function (p) { return badgeHTML(p, D); }).join('') + '</div>';
      }
    } else {
      html += list.map(function (p) { return '<div class="pg" style="width:' + z.w + 'mm;height:' + z.h + 'mm">' + badgeHTML(p, D) + '</div>'; }).join('');
    }
    $print.innerHTML = html;
    // Ölçüm için ekranda görünmeden yerleştir, isimleri sığdır, sonra yazdır
    $print.style.cssText = 'display:block;position:fixed;left:-10000px;top:0';
    var imgs = Array.prototype.slice.call($print.querySelectorAll('img'));
    Promise.all(imgs.map(function (im) { return im.complete ? 0 : new Promise(function (res) { im.onload = im.onerror = res; }); }))
      .then(function () { return document.fonts && document.fonts.ready; })
      .then(function () {
        fit($print);
        $print.style.cssText = '';
        setTimeout(function () { window.print(); markPrinted(list); }, 50);
      });
  }

  start();
})();
