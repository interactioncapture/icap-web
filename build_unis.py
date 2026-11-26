"""Üniversite listesini (web/universities.json) zenginleştirir.

  python3 web/build_unis.py --scorecard <US_College.csv> --domains <world_universities_and_domains.json>

Kaynaklar
  • Türkiye: YÖK listesi (dosyada zaten var) + alan adları (elle girilenler korunur, Hipo listesinden yüksek güvenle eşleşenler eklenir)
  • ABD: College Scorecard / IPEDS (U.S. Dept. of Education) — kamu ve kâr amacı gütmeyen özel, kampüslü, yükseköğretim kurumları
         alan adları: Hipo university-domains-list (MIT lisansı)
"""
import argparse, collections, csv, json, os, re, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'universities.json')

def fold(s: str) -> str:
    s = s.replace('ı', 'i').replace('İ', 'i').lower()
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', ' ', s.replace('&', ' and '))).strip()

def slug(s: str) -> str:
    return fold(s).replace(' ', '-')

# ---------------- Türkiye: alan adları ----------------
TR_STOP = set('university universitesi universities of the and ve technical teknik institute enstitusu yuksek teknoloji technology high fine arts guzel sanatlar vakif foundation college meslek yuksekokulu turkish turk turkiye'.split())
def tr_key(s): return [w for w in fold(s).split() if w not in TR_STOP and len(w) > 1]

def tr_domains(tr, hipo):
    H = [h for h in hipo if h['alpha_two_code'] in ('TR', 'CY')]
    manual = {u['id']: list(u.get('domains') or []) for u in tr}
    found = {}
    for u in tr:
        k = tr_key(u['name'])
        if not k: continue
        c = [h for h in H if tr_key(h['name']) == k] or ([h for h in H if tr_key(h['name'])[:len(k)] == k] if len(k) >= 2 else [])
        if not c and len(k) == 1:
            c = [h for h in H if any(d.split('.')[0] == k[0] for d in h['domains'])]
        if len(c) == 1:
            found[u['id']] = [d.lower() for d in c[0]['domains'] if d.lower().endswith('.tr') or d.lower().endswith('.edu')]
    # Birden fazla üniversiteye düşen (şüpheli) alan adlarını at; elle girilenler her zaman kalır
    owners = collections.Counter(d for ds in found.values() for d in set(ds))
    for u in tr:
        ds = list(manual[u['id']])
        for d in found.get(u['id'], []):
            if d not in ds and owners[d] == 1 and not any(d in m for k, m in manual.items() if k != u['id']):
                ds.append(d)
        if ds: u['domains'] = ds
        else: u.pop('domains', None)
    return sum(1 for u in tr if u.get('domains'))

# ---------------- ABD ----------------
KEEP = re.compile(r'universit|college|institute|seminary|conservatory|polytechnic|academy|school of|\bschool$|\bunion\b', re.I)
DROP = re.compile(r'high school|school district|\bboces\b|beauty|cosmetolog|barber|hair|nail|esthetic|massage|truck|driving|hospital$', re.I)
STATES = {'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','PR','GU','VI','AS','MP'}

def title_city(c):
    return ' '.join(w if w.isupper() and len(w) <= 3 else w.capitalize() for w in c.strip().split()) if c.isupper() or c.islower() else c.strip()

def acronym(alias: str):
    for part in re.split(r'\s{2,}|[,;|/]', alias or ''):
        p = part.strip()
        if 3 <= len(p) <= 7 and re.fullmatch(r'[A-Z][A-Z&\-]+', p): return p
    return None

def us_list(path, hipo):
    rows = list(csv.DictReader(open(path, encoding='utf-8')))
    H = {}
    for h in hipo:
        if h['alpha_two_code'] == 'US':
            H.setdefault(fold(re.sub(r'^the ', '', h['name'], flags=re.I)), []).extend(d.lower() for d in h['domains'])
    out, seen, dup = [], collections.Counter(), set()
    for r in rows:
        own = r['peps_ownership']
        if own not in ('Public', 'Private Nonprofit') or r['online_only'] == '1.0' or r['state'] not in STATES: continue
        name = re.sub(r'\s+', ' ', r['name']).strip()
        name = re.sub(r'\s*-\s*Main Campus$|\s+Main Campus$', '', name)  # "Ohio State University-Main Campus" → "Ohio State University"
        if not KEEP.search(name) or DROP.search(name): continue
        key = fold(re.sub(r'^the ', '', name, flags=re.I))
        if (key, r['city'].lower(), r['state']) in dup: continue  # veri setindeki tekrar satırlar
        dup.add((key, r['city'].lower(), r['state']))
        doms = list(dict.fromkeys(H.get(key, []) + [d for a in re.split(r'\s{2,}|[,;|]', r['alias'] or '') if a.strip() for d in H.get(fold(a.strip()), [])]))
        doms = [d for d in doms if d.endswith('.edu')]
        acr = acronym(r['alias'])
        base = 'us-' + slug(name)
        u = {'id': base, 'name': name, 'short': acr or re.sub(r'^The ', '', name), 'city': f"{title_city(r['city'])}, {r['state']}",
             'type': 'public' if own == 'Public' else 'private', 'country': 'US'}
        if acr: u['alias'] = acr.lower()
        if doms: u['domains'] = doms
        out.append(u); seen[base] += 1
    # aynı adlı kampüsler: kimliğe eyalet/şehir ekle
    for u in out:
        if seen[u['id']] > 1:
            u['id'] = f"{u['id']}-{slug(u['city'])}"
    ids = collections.Counter(u['id'] for u in out)
    assert all(v == 1 for v in ids.values()), [k for k, v in ids.items() if v > 1][:5]
    # bir alan adı birden fazla kuruma düşüyorsa (ör. şube kampüsleri) ana kurumda bırak: en kısa ad
    owner = {}
    for u in sorted(out, key=lambda x: len(x['name'])):
        for d in u.get('domains', []): owner.setdefault(d, u['id'])
    for u in out:
        if 'domains' in u:
            u['domains'] = [d for d in u['domains'] if owner[d] == u['id']]
            if not u['domains']: del u['domains']
    out.sort(key=lambda u: u['name'])
    return out

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--scorecard', required=True)
    ap.add_argument('--domains', required=True)
    a = ap.parse_args()
    data = json.load(open(OUT, encoding='utf-8'))
    hipo = json.load(open(a.domains, encoding='utf-8'))
    tr = [u for u in data['universities'] if u.get('country', 'TR') == 'TR']
    nd = tr_domains(tr, hipo)
    us = us_list(a.scorecard, hipo)
    data['universities'] = tr + us
    data['count'] = len(data['universities'])
    data['source'] = 'TR: YÖK — yok.gov.tr/tr/university (Devlet, Vakıf, Vakıf MYO, KKTC) · US: College Scorecard / IPEDS (U.S. Dept. of Education) · alan adları: Hipo university-domains-list'
    json.dump(data, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'TR {len(tr)} (alan adlı {nd}) · US {len(us)} (alan adlı {sum(1 for u in us if u.get("domains"))}) · {os.path.getsize(OUT)//1024} KB')
