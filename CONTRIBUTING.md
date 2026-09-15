# Prisijungimas prie projekto programuotojui

Projektas naudoja Node.js 24, Next.js ir Supabase PostgreSQL. Kodas laikomas GitHub, bendri duomenys – Supabase, vieša aplikacija paleidžiama Vercel. Norint taisyti kodą, produkcijos raktų nereikia.

## Pirmas paleidimas

Gaukite GitHub repozitorijos prieigą iš projekto savininko. Tada terminale:

```bash
git clone https://github.com/JuozapasM/Projektas-komanda.git
cd Projektas-komanda
nvm use
npm ci
npm run dev
```

Jei nenaudojate `nvm`, įdiekite Node.js 24 kitu būdu. Atidarykite `http://localhost:3000`. Be Supabase kintamųjų automatiškai sukuriama privati vietinė PGlite bazė; ji neprijungta prie kitų komandos narių duomenų. Dalyvio paskyrą susikurkite registracijos lange, administratoriaus duomenis rasite `.local-data/admin-credentials.txt`.

## Darbas su bendra kūrimo baze

Savininkas turi pakviesti jus į Supabase organizaciją ir nurodyti kūrimo projekto nuorodą. Produkcijos ir kūrimo aplinkoms naudokite atskirus Supabase projektus. Kvietimo priėmimas nesukuria administratoriaus paskyros aplikacijoje.

```bash
cp .env.example .env.local
```

Įrašykite kūrimo projekto `NEXT_PUBLIC_SUPABASE_URL` ir `SUPABASE_SERVICE_ROLE_KEY`. Raktą gaukite per komandos privatų slaptažodžių tvarkytuvą. `ADMIN_NAME` ir `ADMIN_PASSWORD` reikalingi tik žmogui, kuris paruošia aplikacijos administratorių; kitais atvejais šias eilutes pašalinkite. Perkraukite `npm run dev`.

Jei reikia dirbti su migracijomis:

```bash
npm run supabase:login
npm run supabase:link -- --project-ref YOUR_DEV_PROJECT_REF
npm run supabase:status
```

`YOUR_DEV_PROJECT_REF` pakeiskite tikru kūrimo projekto identifikatoriumi. CLI prašomą duomenų bazės slaptažodį įveskite interaktyviai. Supabase CLI įdiegiamas kartu su `npm ci`, jo versija vienoda visai komandai. [Oficialus CLI diegimo aprašymas](https://supabase.com/docs/guides/local-development/cli/getting-started).

## Pakeitimo pateikimas

```text
Atnaujinti main → sukurti savo šaką → pakeisti kodą
  → npm run lint → npm test → npm run build
  → commit → push savo šaką → Pull Request → peržiūra → sujungimas
```

Prieš pradėdami naują darbą, tvarkingoje darbo kopijoje:

```bash
git switch main
git pull --ff-only
git switch -c feature/trumpas-pavadinimas
```

Pull Request aprašykite pakeistą elgesį ir atliktas patikras. `.github/workflows/checks.yml` automatiškai tikrina PR ir `main` pakeitimus. Testai naudoja izoliuotą PGlite, todėl nereikalauja Supabase raktų ir nekeičia bendros bazės.

## Duomenų bazės pakeitimai

Sukurkite naują migraciją, o jau pritaikytų failų nekeiskite:

```bash
npm run supabase:new -- trumpas_pakeitimo_pavadinimas
```

Įrašykite SQL į sukurtą `supabase/migrations/` failą. `npm test` duomenų bazės testas vykdo visas šio aplanko migracijas eilės tvarka. Naują elgesį patikrinkite prasmingu testu ir kūrimo Supabase projekte. PR turi apimti SQL ir nuo jo priklausantį kodą. Produkcijos migracijas vykdo sutartas atsakingas komandos narys pagal [Supabase paruošimo instrukciją](docs/SUPABASE.md).

Privačių `.env.local`, `.local-data/`, CLI prisijungimo duomenų ir duomenų bazės eksportų nekelkite į Git ar PR. PGlite vietiniai vartotojai ir rezervacijos automatiškai neperkeliami į bendrą Supabase bazę.
