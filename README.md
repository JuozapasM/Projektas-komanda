# Auksinis Protas

Protmūšio vakarų rezervacijų sistema: keturi stalai, po keturias vietas, dalyvių paskyros, administratoriaus valdymas ir vieši nugalėtojų rezultatai.

## Paleidimas ir duomenų bazė

Reikalinga Node.js 24 ir Supabase projektas.

```bash
npm ci
cp .env.example .env.local
```

Į `.env.local` įrašykite tikrą `NEXT_PUBLIC_SUPABASE_URL` ir `SUPABASE_SERVICE_ROLE_KEY`. Service role raktas naudojamas tik serveryje; jam negalima suteikti `NEXT_PUBLIC_` prefikso. Naršyklės anon raktas dabartinei aplikacijai nereikalingas.

Supabase SQL Editor pritaikykite migracijas eilės tvarka:

1. `supabase/migrations/202609140001_initial_schema.sql`
2. `supabase/migrations/202609140002_enable_app_access_and_seed.sql`
3. `supabase/migrations/202609150001_secure_access_and_winners.sql`

Jei pirmos dvi jau pritaikytos, paleiskite tik trečią. Nauja migracija išsaugo esamas paskyras ir rezervacijas, uždaro naršyklės prieigą prie privačių lentelių, išjungia anksčiau viešintą pradinį administratoriaus slaptažodį ir sukuria sesijų bei nugalėtojų saugyklas. Jei yra vardų, besiskiriančių tik raidžių dydžiu ar tarpais, prieš migraciją išspręskite jų konfliktą: naujas unikalus indeksas tokių vardų nebeleidžia.

## Administratoriaus paskyra

Į vietinį `.env.local` įrašykite `ADMIN_NAME` (pagal nutylėjimą `Laima`) ir naują `ADMIN_PASSWORD` (bent 12 simbolių, daugiausiai 72 UTF-8 baitai). Tada paleiskite:

```bash
npm run setup:admin
```

Komanda nustato administratoriaus slaptažodį, išsaugo tik bcrypt maišą ir atšaukia senas administratoriaus sesijas. Ji neperkelia esamos dalyvio paskyros į administratoriaus rolę. Po komandos pašalinkite `ADMIN_PASSWORD` iš vietinio env failo; Vercel aplinkoje jo nereikia. Slaptažodis nėra rodomas aplikacijoje ar žurnaluose.

```bash
npm run dev
```

Atidarykite [http://localhost:3000](http://localhost:3000).

## Vercel

Importuokite GitHub repozitoriją `JuozapasM/Projektas-komanda` ir naudokite:

- Framework Preset: `Next.js`
- Root Directory: repozitorijos šaknis (`.`)
- Build Command: `npm run build`
- Install Command ir Output Directory: automatiniai, be Override
- Node.js Version: `24.x` (nustatyta ir `package.json`)
- Production Branch: `main`

Environment Variables skiltyje nustatykite `NEXT_PUBLIC_SUPABASE_URL` ir `SUPABASE_SERVICE_ROLE_KEY` Production ir, jei naudosite, Preview aplinkoms. Pakeitus kintamuosius reikia naujo diegimo. Migracijas ir administratoriaus paruošimą atlikite prieš diegdami naują aplikacijos versiją. Vercel automatiškai nepritaiko SQL migracijų.

## Duomenų apsauga ir išsaugojimas

Prisijungimas vardu ir slaptažodžiu tikrinamas serveryje. Naršyklėje saugomas tik atsitiktinis HttpOnly sesijos slapukas; duomenų bazėje saugoma jo SHA-256 maiša. Sesija galioja septynias dienas, o atsijungimas ją atšaukia. Vartotojo rolė ir rezervacijos savininkas kiekvieną kartą tikrinami serveryje. Prisijungimo ir registracijos bandymų limitai saugomi duomenų bazėje, kad veiktų tarp Vercel serverio procesų.

Rezervavimas, atšaukimas ir atmetimas bei jų istorijos įrašai atliekami vienoje DB transakcijoje. Vieta parenkama atsitiktinai, o unikalūs indeksai neleidžia rezervuoti vienos vietos dukart. Datos, vietos ir istorijos laikas rodomi pagal `Europe/Vilnius`.

Paskutinio žaidimo nugalėtojai išsaugomi `winner_results` lentelėje ir iš naujo įkeliami atidarius puslapį. Visų laikų lentelė skaitoma iš `all_time_winners`; pradiniai rezultatai perkelti iš ankstesnės versijos. Esamas nugalėtojų redagavimo ekranas keičia paskutinio žaidimo rezultatus. Neprijungus Supabase ar nepavykus užklausai aplikacija praneša apie klaidą ir nekuria vietinių paskyrų ar rezervacijų.

## Patikros

```bash
npm test
npm run lint
npm run build
```

Testai tikrina serverio sesijas, teisių kontrolę ir SQL migracijas izoliuotame PostgreSQL variklyje (PGlite). Jame nėra `pgcrypto`, todėl tik šios plėtinio įjungimo eilutės iš pirmų dviejų migracijų testuojant praleidžiamos; saugumo migracija vykdoma nepakeista. Bcrypt tikrinamas atskirai aplikacijos testuose. Testai nejungiasi prie gyvos Supabase duomenų bazės.
