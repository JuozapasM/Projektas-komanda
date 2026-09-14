# Auksinis Protas

Protmūšio vakarų rezervacijų sistema: keturi stalai, po keturias vietas, dalyvių paskyros, administratoriaus valdymas ir vieša nugalėtojų istorija.

## Paleidimas

Reikalinga Node.js 20 arba naujesnė versija.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Atidarykite [http://localhost:3000](http://localhost:3000). Prieš naudojant Supabase funkcijas, `.env.local` faile įrašykite savo projekto reikšmes iš Supabase nustatymų.

## Komandos

```bash
npm run dev      # paleidžia kūrimo serverį
npm run lint     # tikrina kodą
npm run build    # paruošia produkcinį buildą
npm run start    # paleidžia produkcinį buildą
```

## Demonstracinė versija

Šiuo metu registracija, vietų rezervacija, žaidimų laikų kūrimas ir nugalėtojų redagavimas veikia naršyklės būsenoje. Perkrovus puslapį demonstraciniai pakeitimai grįžta į pradinius duomenis.

Administratorius: prisijungimo lange naudokite projekto administratoriaus duomenis. README jų neskelbia.

Supabase duomenų bazės schema paruošta faile `supabase/migrations/202609140001_initial_schema.sql`.
