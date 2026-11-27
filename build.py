#!/usr/bin/env python3
"""icap web davet sitesi üreticisi.

Supabase'den yaklaşan etkinlikleri çeker; her etkinlik için WhatsApp/Instagram önizlemesi (Open Graph)
olan bir sayfa ve 1200x630 kapak görseli üretir. Henüz üretilmemiş yeni etkinlikler 404.html üzerinden
tarayıcıda yüklenir, yani link anında çalışır; önizleme kartı bir sonraki üretimde gelir (Supabase sinyaliyle
birkaç dakika, sinyal yoksa saatlik üretimde).

Kullanım:
  python3 build.py --out dist --base /icap-web/ --site https://interactioncapture.github.io/icap-web
  python3 build.py --out dist --sample        # ağ olmadan örnek veriyle (yerel test)
"""
import argparse, html, json, os, shutil, sys, urllib.request
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
SUPABASE_URL = 'https://jjbhkvkrxcqxphocvzir.supabase.co'
ANON_KEY = 'sb_publishable_3AHz9Bo5DKvn04tE7dX9vQ_SEBPumcp'  # herkese açık anahtar; veriyi RLS korur
TR = timezone(timedelta(hours=3))
MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
GRAD = {'Teknoloji': ['#5B21B6', '#7C3AED', '#22D3EE'], 'Müzik': ['#FF3D8B', '#FF8A00'], 'Spor': ['#C6F432', '#22D3EE'],
        'Kariyer': ['#FF8A00', '#FF3D8B'], 'Sanat': ['#15111F', '#7C3AED'],
        'Doğa': ['#065F46', '#16A34A', '#22D3EE'], 'Bilim': ['#1E3A8A', '#2563EB', '#22D3EE'],
        'Gönüllülük': ['#BE123C', '#F43F5E', '#FDBA74'], 'Gezi': ['#0369A1', '#0EA5E9', '#FDE047'], 'Oyun': ['#4C1D95', '#C026D3', '#22D3EE'], 'Sahne': ['#7F1D1D', '#DC2626', '#F59E0B'], 'Söyleşi': ['#134E4A', '#0D9488', '#C6F432'], 'Maneviyat': ['#1E1B4B', '#4338CA', '#FBBF24']}
esc = lambda s: html.escape(str(s or ''), quote=True)


def fetch(path):
    req = urllib.request.Request(f'{SUPABASE_URL}/rest/v1/{path}', headers={'apikey': ANON_KEY, 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def sample():
    now = datetime.now(TR)
    mk = lambda i, t, cat, club, short, col, place, price, cap: {
        'id': f'00000000-0000-4000-8000-00000000000{i}', 'title': t, 'category': cat, 'place': place, 'price': price, 'capacity': cap,
        'starts_at': (now + timedelta(days=i * 3, hours=2)).isoformat(), 'about': 'Örnek açıklama: takımını kur ya da yerinde bul. Yemek ve mentorluk kulüpten.',
        'approval_required': i == 2, 'clubs': {'name': club, 'short': short, 'color': col}}
    evs = [mk(1, 'Yapay Zekâ Hackathonu 2026', 'Teknoloji', 'ODTÜ Yapay Zekâ Kulübü', 'YZ', '#C6F432', 'Mühendislik Fakültesi, B Amfi', 0, 186),
           mk(2, 'Bahar Konseri: Kampüs Sahnesi', 'Müzik', 'ODTÜ Müzik Kulübü', 'MK', '#FF3D8B', 'Vişnelik Amfi', 150, 300),
           mk(3, 'Pazar Sabahı 5K Koşusu', 'Spor', 'Koşu Topluluğu', 'KT', '#22D3EE', 'Eymir Gölü', 0, 120)]
    return evs, {evs[0]['id']: 128, evs[1]['id']: 2}


ABBR = {'America/New_York': 'ET', 'America/Chicago': 'CT', 'America/Denver': 'MT', 'America/Phoenix': 'MT', 'America/Los_Angeles': 'PT', 'America/Anchorage': 'AKT', 'Pacific/Honolulu': 'HT'}


def when(iso, tz=None):
    """Etkinliğin kendi saat dilimiyle (varsayılan Türkiye) tarih ve saat"""
    try:
        from zoneinfo import ZoneInfo
        zone = ZoneInfo(tz) if tz else TR
    except Exception:  # noqa: BLE001
        zone = TR
    d = datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone(zone)
    return d, f'{DAYS[d.weekday()]}, {d.day} {MONTHS[d.month - 1]}', f'{d:%H:%M}' + (f' {ABBR[tz]}' if tz in ABBR else '')


# ----------------------------------------------------------------------------- Yazı tipi + logo
def font(weight, size):
    """Uygulamayla aynı yazı tipi (Plus Jakarta Sans; CI indirir). Yoksa Inter Display."""
    from PIL import ImageFont
    pj = os.path.join(HERE, 'fonts', f'PlusJakartaSans-{weight}.ttf')
    if os.path.exists(pj):
        return ImageFont.truetype(pj, size)
    return ImageFont.truetype(os.path.join(HERE, 'fonts', f'InterDisplay-{weight}.otf'), size)


def wordmark(d, x, y, size, fill, accent=None):
    """'ıcap' + noktasız ı'nın üstünde konum iğnesi (uygulamadaki logo)."""
    f = font('ExtraBold', size)
    pin_h = int(size * 0.5)
    d.text((x, y + pin_h), 'ıcap', font=f, fill=fill)
    x0, y0, x1, _ = f.getbbox('ı')
    cx = x + (x0 + x1) / 2
    tip = y + pin_h + y0 - size * 0.035
    w = size * 0.36; r = w / 2; cy = tip - pin_h + r
    col = accent or ((198, 244, 50) if fill in ((255, 255, 255), '#fff') else (124, 58, 237))
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=col)
    d.polygon([(cx - r * 0.93, cy + r * 0.38), (cx + r * 0.93, cy + r * 0.38), (cx, tip)], fill=col)
    hr = r * 0.41
    hole = d.im.getpixel((int(cx + r * 1.6), int(cy))) if hasattr(d, 'im') else (0, 0, 0)
    d.ellipse((cx - hr, cy - hr, cx + hr, cy + hr), fill=hole)


# ----------------------------------------------------------------------------- Kapak görseli (Open Graph)
def og_photo(ev, path):
    """Kulübün yüklediği afiş varsa önizleme kartı onunla yapılır: afiş tam, arka plan bulanık."""
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
    import io
    req = urllib.request.Request(ev['cover_url'], headers={'User-Agent': 'icap-web-build'})
    with urllib.request.urlopen(req, timeout=30) as r:
        src = Image.open(io.BytesIO(r.read())).convert('RGB')
    W, H = 1200, 630
    bg = src.copy(); bg_ratio = max(W / bg.width, H / bg.height)
    bg = bg.resize((int(bg.width * bg_ratio) + 1, int(bg.height * bg_ratio) + 1)).crop((0, 0, W, H)).filter(ImageFilter.GaussianBlur(28))
    bg = Image.eval(bg, lambda v: int(v * 0.6))
    fit = min((W - 520) / src.width, (H - 60) / src.height)
    poster = src.resize((max(1, int(src.width * fit)), max(1, int(src.height * fit))))
    px = 60; py = (H - poster.height) // 2
    bg.paste(poster, (px, py))
    d = ImageDraw.Draw(bg, 'RGBA')
    F = font
    x = px + poster.width + 50; maxw = W - x - 50
    wordmark(d, x, 56, 46, (255, 255, 255))
    title = ev['title']; size = 56
    while size > 34:
        f = F('ExtraBold', size); words = title.split(); lines, cur = [], ''
        for w in words:
            t = (cur + ' ' + w).strip()
            if d.textlength(t, font=f) <= maxw: cur = t
            else: lines.append(cur); cur = w
        lines.append(cur)
        if len(lines) <= 4: break
        size -= 4
    y = 170
    for ln in lines[:4]:
        d.text((x, y), ln, font=f, fill=(255, 255, 255)); y += int(size * 1.1)
    _, date, time = when(ev['starts_at'], ev.get('tz'))
    d.text((x, y + 24), f'{date} · {time}', font=F('SemiBold', 30), fill=(198, 244, 50))
    d.text((x, y + 66), ev['place'][:40], font=F('SemiBold', 26), fill=(255, 255, 255, 220))
    bg.save(path, 'PNG', optimize=True)


def og_image(ev, path):
    if ev.get('cover_url'):
        try:
            return og_photo(ev, path)
        except Exception as er:  # afiş indirilemezse şablon kart
            print(f'uyarı: afiş önizlemesi üretilemedi ({ev["id"]}): {er}')
    from PIL import Image, ImageDraw, ImageFont
    W, H = 1200, 630
    cols = [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in GRAD.get(ev['category'], GRAD['Teknoloji'])]
    img = Image.new('RGB', (W, H))
    px = img.load()
    for x in range(W):
        for y in range(0, H, 2):
            t = (x / W) * 0.75 + (y / H) * 0.25
            seg = min(int(t * (len(cols) - 1)), len(cols) - 2); lt = t * (len(cols) - 1) - seg
            c = tuple(int(cols[seg][k] + (cols[seg + 1][k] - cols[seg][k]) * lt) for k in range(3))
            px[x, y] = c
            if y + 1 < H: px[x, y + 1] = c
    d = ImageDraw.Draw(img, 'RGBA')
    d.ellipse((860, -160, 1360, 340), fill=(255, 255, 255, 38))
    d.ellipse((-90, 430, 170, 690), outline=(255, 255, 255, 40), width=34)
    dark = ev['category'] == 'Spor'
    fg = (21, 17, 31) if dark else (255, 255, 255)
    F = font
    # marka (keplı ıcap — uygulamadaki logo)
    wordmark(d, 70, 52, 54, fg)
    # başlık (en fazla 3 satır)
    title = ev['title']; size = 82
    while size > 50:
        f = F('ExtraBold', size); words = title.split(); lines, cur = [], ''
        for w in words:
            t = (cur + ' ' + w).strip()
            if d.textlength(t, font=f) <= 1040: cur = t
            else: lines.append(cur); cur = w
        lines.append(cur)
        if len(lines) <= 3: break
        size -= 6
    lines = lines[:3]
    y = 210 if len(lines) < 3 else 175
    for ln in lines:
        d.text((70, y), ln, font=f, fill=fg); y += int(size * 1.08)
    _, date, time = when(ev['starts_at'], ev.get('tz'))
    club = (ev.get('clubs') or {}).get('name', '')
    d.text((70, 488), f'{date} · {time}', font=F('SemiBold', 36), fill=fg)
    d.text((70, 540), f'{club} · {ev["place"]}'[:70], font=F('SemiBold', 30), fill=fg + (215,) if len(fg) == 3 else fg)
    # rozet
    pill = 'Ücretsiz' if not ev['price'] else f'₺{ev["price"]}'
    pf = F('ExtraBold', 34); pw = d.textlength(pill, font=pf) + 56
    d.rounded_rectangle((W - 70 - pw, 52, W - 70, 120), radius=34, fill=(21, 17, 31, 235) if not dark else (255, 255, 255, 235))
    d.text((W - 70 - pw + 28, 62), pill, font=pf, fill=(198, 244, 50) if not dark else (21, 17, 31))
    img.save(path, 'PNG', optimize=True)


# ----------------------------------------------------------------------------- Sayfalar
def head(title, desc, base, url='', image='', extra=''):
    og = (f'<meta property="og:type" content="website"><meta property="og:site_name" content="icap">'
          f'<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}">'
          + (f'<meta property="og:url" content="{esc(url)}">' if url else '')
          + (f'<meta property="og:image" content="{esc(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
             f'<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="{esc(image)}">' if image else ''))
    return f'''<!DOCTYPE html>
<html lang="tr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{esc(title)}</title><meta name="description" content="{esc(desc)}">{og}
<meta name="theme-color" content="#7C3AED"><link rel="icon" href="{base}favicon.png"><link rel="apple-touch-icon" href="{base}icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{base}style.css">{extra}
</head><body>'''


WORDMARK = '<b class="wm"><span class="i">ı<svg viewBox="0 0 24 32" aria-hidden="true"><path fill-rule="evenodd" d="M12 0C5.37 0 0 5.2 0 11.62 0 20.33 12 32 12 32s12-11.67 12-20.38C24 5.2 18.63 0 12 0Zm0 16.6a4.9 4.9 0 1 1 0-9.8 4.9 4.9 0 0 1 0 9.8Z"/></svg></span>cap</b>'
TOP = lambda base: f'<div class="top"><a class="brand" href="{base}" aria-label="icap"><img src="{base}icon.png" alt="">{WORDMARK}</a><span class="chip lime">Interaction Capture</span></div>'
UNIS = [[u['id'], u['name'], u['short'], u['type']] for u in json.load(open(os.path.join(HERE, 'universities.json'), encoding='utf-8'))['universities']]
SCRIPTS = lambda base, cfg, consent: (
    f'<script>window.ICAP={json.dumps(cfg)};window.ICAP_CONSENT={json.dumps(consent, ensure_ascii=False)};</script>'
    f'<script src="{base}unis.js"></script>'  # ~3.800 üniversite: sayfaya gömülmez, tek dosya olarak önbelleğe alınır
    '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/dist/umd/supabase.js"></script>'
    '<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"></script>'
    f'<script src="{base}app.js"></script></body></html>')


def event_page(ev, going, base, site, consent):
    _, date, time = when(ev['starts_at'], ev.get('tz'))
    club = (ev.get('clubs') or {}).get('name', '')
    left = max(0, ev['capacity'] - going)
    desc = f'{date} · {time} · {ev["place"]} — {club}. ' + (f'{going} kişi geliyor, {left} yer kaldı.' if going >= 3 else 'Yerini ayır, QR biletin hemen gelsin.')
    url = f'{site}/e/{ev["id"]}/'
    pre = (f'<div class="cover" style="background:linear-gradient(135deg,{",".join(GRAD.get(ev["category"], GRAD["Teknoloji"]))})">'
           f'<div class="word">{esc(ev["title"].split(":")[0])}</div></div><h1 class="title">{esc(ev["title"])}</h1>'
           f'<p class="muted">{esc(date)} · {esc(time)} · {esc(ev["place"])}</p><div class="skeleton" style="height:120px;margin-top:16px"></div>')
    leaflet = '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>'
    return (head(f'{ev["title"]} · icap', desc, base, url, f'{site}/og/{ev["id"]}.png', leaflet)
            + f'<div class="wrap">{TOP(base)}<main id="app">{pre}</main></div><div class="sticky" id="sticky"></div>'
            + SCRIPTS(base, {'root': base, 'eventId': ev['id']}, consent))


def index_page(base, site, consent):
    return (head('icap · Kampüs etkinlikleri', 'Kulüp etkinliklerine tek dokunuşla katıl, QR biletin anında gelsin.', base, site + '/', f'{site}/og/site.png')
            + f'<div class="wrap">{TOP(base)}<div class="hero"><h1>Kampüste bu hafta ne var?</h1><p>Kulüp etkinliklerine tek dokunuşla katıl. QR biletin anında gelir, kapıda okutursun.</p></div>'
            + '<div class="sec">Yaklaşan etkinlikler</div><div class="list" id="list">' + '<div class="skeleton" style="height:86px"></div>' * 3 + '</div>'
            + f'<footer>icap · Invite · Connect · Attend · Post · Interaction Capture · <a href="{base}kvkk/">KVKK</a></footer></div>'
            + SCRIPTS(base, {'root': base}, consent))


def notfound_page(base, consent):
    # Henüz üretilmemiş /e/<id>/ linkleri buraya düşer; app.js id'yi adresten okuyup etkinliği yükler.
    return (head('icap', 'Kampüs etkinlikleri', base, extra='<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>') + f'<div class="wrap">{TOP(base)}<main id="app"><div class="skeleton" style="height:240px"></div></main></div>'
            + '<div class="sticky" id="sticky"></div>' + SCRIPTS(base, {'root': base}, consent))


def kvkk_page(k, base, site):
    secs = ''.join(f'<h2>{esc(s["h"])}</h2>' + ''.join(f'<p>{esc(p)}</p>' for p in s['p']) for s in k['sections'])
    L = k['legal']
    return (head(f'KVKK Aydınlatma Metni · icap', k['title'], base, site + '/kvkk/')
            + f'<div class="wrap legal">{TOP(base)}<h1>KVKK ve gizlilik</h1><p class="muted">{esc(k["title"])} · Sürüm {esc(L["version"])} · {esc(L["updated"])}</p>'
            + '<div class="box">Kısaca: verilerini yalnızca etkinliklere kaydolman ve kapıda giriş yapabilmen için kullanıyoruz. Satmıyoruz, reklam için paylaşmıyoruz.</div>'
            + secs + f'<footer><a href="{base}">icap</a></footer></div></body></html>')


def site_image(path):
    from PIL import Image, ImageDraw, ImageFont
    og_image({'title': 'Kampüste bu hafta ne var?', 'category': 'Teknoloji', 'starts_at': datetime.now(TR).isoformat(),
              'place': 'Kulüp etkinliklerine tek dokunuşla katıl', 'price': 0, 'clubs': {'name': 'Kulüp etkinlikleri'}}, path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='dist'); ap.add_argument('--base', default='/')
    ap.add_argument('--site', default=''); ap.add_argument('--sample', action='store_true')
    a = ap.parse_args()
    base = a.base if a.base.endswith('/') else a.base + '/'
    site = (a.site or '').rstrip('/')
    out = a.out
    if os.path.exists(out): shutil.rmtree(out)
    shutil.copytree(os.path.join(HERE, 'site'), out)
    os.makedirs(os.path.join(out, 'og'), exist_ok=True)
    k = json.load(open(os.path.join(HERE, 'kvkk.json'), encoding='utf-8'))

    if a.sample:
        events, going = sample()
    else:
        since = (datetime.now(timezone.utc) - timedelta(days=2)).strftime('%Y-%m-%dT%H:%M:%SZ')
        events = fetch(f'events?select=id,title,place,starts_at,price,capacity,category,about,approval_required,cover_url,kind,host_name,venue_type,tz,clubs(name,short,color,university)&starts_at=gte.{since}&order=starts_at&limit=500')
        going = {r['event_id']: r['going'] for r in fetch('event_stats?select=event_id,going')}
        # Kulübü görünmeyen (reddedilmiş) etkinliklerin sayfası üretilmez; buluşmalar açanın adıyla gösterilir
        events = [e for e in events if e.get('clubs') or e.get('kind') == 'meetup']
        for e in events:
            if not e.get('clubs'): e['clubs'] = {'name': e.get('host_name') or 'Bir öğrenci', 'short': '', 'color': '#7C3AED', 'university': ''}

    for ev in events:
        d = os.path.join(out, 'e', ev['id']); os.makedirs(d, exist_ok=True)
        open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(event_page(ev, going.get(ev['id'], 0), base, site, k['consent']))
        og_image(ev, os.path.join(out, 'og', f'{ev["id"]}.png'))
    site_image(os.path.join(out, 'og', 'site.png'))
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(index_page(base, site, k['consent']))
    open(os.path.join(out, '404.html'), 'w', encoding='utf-8').write(notfound_page(base, k['consent']))
    os.makedirs(os.path.join(out, 'kvkk'), exist_ok=True)
    open(os.path.join(out, 'kvkk', 'index.html'), 'w', encoding='utf-8').write(kvkk_page(k, base, site))
    # Üniversite listesi: site sayfaları (unis.js) ve yönetim/SKS panelleri (admin/unis.js) ortak okur
    unis_js = 'window.ICAP_UNIS=' + json.dumps(UNIS, ensure_ascii=False, separators=(',', ':')) + ';'
    for f in ('unis.js', os.path.join('admin', 'unis.js')):
        open(os.path.join(out, f), 'w', encoding='utf-8').write(unis_js)
    open(os.path.join(out, '.nojekyll'), 'w').close()
    print(f'{len(events)} etkinlik sayfası üretildi → {out}')


if __name__ == '__main__':
    sys.exit(main())
