# icap · web davet sitesi

Uygulaması olmayan öğrencinin WhatsApp linkinden etkinliği görüp **kaydolabildiği ve QR biletini alabildiği** sayfalar.

- `/e/<etkinlik-id>/` — etkinlik sayfası (Open Graph önizleme + 1200×630 kapak görseli)
- `/` — yaklaşan etkinlikler
- `/kvkk/` — KVKK aydınlatma metni (uygulamayla aynı kaynak: `kvkk.json`)

Statik site; veriler tarayıcıda Supabase'den okunur, yetkiyi RLS kuralları korur.
`build.py` her 15 dakikada bir etkinlik sayfalarını ve önizleme görsellerini üretir.

Yerel deneme (ağ olmadan): `python3 build.py --out dist --sample`

Yazı tipi: Inter Display (SIL Open Font License 1.1).
