# Auksinis Protas

Protmūšio vakarų rezervacijų sistema: keturi stalai, po keturias vietas, dalyvių paskyros, administratoriaus valdymas ir vieši nugalėtojų rezultatai.

Naujam programuotojui pradėti: [CONTRIBUTING.md](CONTRIBUTING.md). Bendros bazės paruošimas, komandos prieigos ir viešas paleidimas: [docs/SUPABASE.md](docs/SUPABASE.md).

## Projekto failų medis

Svarbiausi failai ir jų paskirtis. `.env.local` ir `.local-data/` sukuriami vietoje ir neįtraukiami į Git.

```text
Projektas komanda/
├── README.md                         Ši instrukcija
├── CONTRIBUTING.md                   Naujo programuotojo paleidimas ir darbo tvarka
├── .nvmrc                            Komandai bendra Node.js 24 versija
├── .github/workflows/checks.yml       Automatinės PR ir main patikros
├── docs/SUPABASE.md                   Bendra bazė, komandos prieigos ir diegimas
├── AGENTS.md                         Instrukcijos programavimo agentams
├── CLAUDE.md                         Nuoroda į AGENTS.md
├── package.json                      Priklausomybės ir npm komandos
├── package-lock.json                 Tikslios priklausomybių versijos
├── .env.example                      Aplinkos kintamųjų pavyzdys
├── .env.local                        Vietiniai kintamieji ir privatūs raktai
├── .gitignore                        Failai, neįtraukiami į Git
├── next.config.ts                    Next.js ir diegimo failų nustatymai
├── tsconfig.json                     TypeScript nustatymai
├── eslint.config.mjs                 Kodo patikros taisyklės
├── postcss.config.mjs                CSS apdorojimo nustatymai
├── src/
│   ├── app/
│   │   ├── layout.tsx                Bendras puslapio karkasas ir metaduomenys
│   │   ├── page.tsx                  Pradinis puslapis: atidaro AppShell
│   │   └── globals.css               Spalvos, šriftai ir prisitaikantis išdėstymas
│   ├── components/
│   │   ├── app-shell.tsx             Prisijungimas, registracija ir ekrano parinkimas
│   │   ├── participant-dashboard.tsx Dalyvio datos, stalai ir rezervacijos
│   │   ├── admin-view.tsx            Admin: stalai, pašalinimas, datos ir istorija
│   │   └── winners-board.tsx         Nugalėtojų lentelės
│   └── lib/
│       ├── auth.ts                   Registracija, prisijungimas ir atsijungimas
│       ├── types.ts                  Bendri duomenų tipai
│       ├── validation.ts             Įvesties tikrinimas
│       ├── mock-data.ts              Ankstesni demonstraciniai duomenys; nenaudojami
│       ├── server/
│       │   ├── database.ts           Supabase arba vietinės bazės parinkimas
│       │   ├── local-database.mjs    Vietinė PGlite bazė ir jos paruošimas
│       │   └── session.ts            Sesijos slapukas ir vartotojo teisių patikros
│       └── supabase/
│           ├── queries.ts            Datos, veiksmų istorija ir prisijungusių skaičius
│           ├── reservations.ts       Stalų duomenys, rezervavimas ir pašalinimas
│           ├── admin.ts              Naujos žaidimo datos sukūrimas
│           ├── winners.ts            Nugalėtojų skaitymas ir išsaugojimas
│           ├── client.ts             Ankstesnis naršyklės klientas; nenaudojamas
│           └── server.ts             Ankstesnis SSR klientas; nenaudojamas
├── scripts/
│   ├── setup-admin.mjs               Supabase administratoriaus paskyros paruošimas
│   └── build-supabase-bundle.mjs      Vieno SQL failo generavimas naujai bazei
├── supabase/
│   ├── config.toml                   Supabase projekto nustatymai
│   ├── verify.sql                    Bazės ir teisių patikra po migracijų
│   ├── generated/bootstrap.sql       Generuojamas SQL naujai bazei; neįtraukiamas į Git
│   └── migrations/                   SQL vykdyti šia eilės tvarka:
│       ├── 202609140001_initial_schema.sql
│       ├── 202609140002_enable_app_access_and_seed.sql
│       ├── 202609150001_secure_access_and_winners.sql
│       └── 202609170001_reservation_event_retention.sql
├── tests/
│   ├── server.test.mjs               Autentifikavimo ir serverio veiksmų testai
│   ├── database.test.mjs             SQL, teisių ir transakcijų testai
│   └── supabase-setup.test.mjs        SQL rinkinio ir diegimo patikros testas
└── .local-data/                      Tik vietinės peržiūros privatūs duomenys
    ├── postgres/                    Išsaugoma PGlite duomenų bazė
    └── admin-credentials.txt         Sugeneruoti vietinio admin prisijungimo duomenys
```

`node_modules/` sukuriamas diegiant priklausomybes, `.next/` – paleidžiant arba surenkant aplikaciją. Šių aplankų rankiniu būdu redaguoti nereikia.

## Veiksmų medis

Pasirinkite šaką pagal tai, ką norite atlikti. Išsamūs nustatymai pateikti tolesniuose skyriuose.

```text
Darbas su projektu
├── 1. Paleisti vietinę peržiūrą be Supabase
│   ├── Turėti Node.js 24 ir atidaryti projekto aplanką terminale
│   ├── npm ci
│   ├── Palikti abu Supabase kintamuosius nenustatytus
│   ├── npm run dev → http://localhost:3000
│   └── Atidarius aplikaciją automatiškai paruošiama .local-data/ bazė
│       ├── Dalyvis → užsiregistruoti prisijungimo lange
│       └── Admin → naudoti .local-data/admin-credentials.txt duomenis
├── 2. Paruošti Supabase ir produkciją
│   ├── npm ci
│   ├── cp .env.example .env.local
│   ├── Įrašyti NEXT_PUBLIC_SUPABASE_URL ir SUPABASE_SERVICE_ROLE_KEY
│   ├── Supabase CLI → prisijungti ir susieti pasirinktą projektą
│   ├── supabase:status → supabase:plan → supabase:push
│   ├── SQL Editor → supabase/verify.sql → patikrinti bazę
│   ├── .env.local → nustatyti ADMIN_NAME ir ADMIN_PASSWORD
│   ├── npm run setup:admin → paruošti administratoriaus paskyrą
│   ├── Pašalinti ADMIN_PASSWORD iš .env.local
│   └── npm run dev → patikrinti prisijungimą ir rezervacijas
├── 3. Naudotis aplikacija
│   ├── Viešas ekranas → nugalėtojai, registracija arba prisijungimas
│   ├── Dalyvis
│   │   ├── Pasirinkti datą → peržiūrėti stalus ir laisvas vietas
│   │   ├── Rezervuoti → serveris atsitiktinai parenka laisvą vietą
│   │   ├── Atšaukti savo rezervaciją → vieta atlaisvinama
│   │   └── Atsijungti → sesija atšaukiama
│   └── Administratorius
│       ├── Pasirinkti datą → matyti 4 stalus ir jų žaidėjus
│       ├── Pašalinti žaidėją → atmesti rezervaciją ir atlaisvinti vietą
│       │   └── Veiksmas įrašomas į istoriją; žaidėjo paskyra išlieka
│       ├── Nauja žaidimo data → įrašyti datą ir pradžios laiką
│       ├── Nugalėtojai → įrašyti TOP 3 žaidėjus ir taškus → išsaugoti
│       ├── Veiksmų istorija → peržiūrėti rezervacijas ir atšaukimus
│       └── Atsijungti → sesija atšaukiama
├── 4. Patikrinti pakeitimus
│   ├── npm test → serverio ir duomenų bazės testai
│   ├── npm run lint → kodo patikra
│   └── npm run build → produkcinis surinkimas
│       └── Su Supabase: npm start → vietoje paleisti surinktą versiją
└── 5. Įkelti į Vercel
    ├── Pirmiausia atlikti Supabase paruošimą ir visas patikras
    ├── Įrašyti pakeitimus į Git ir išsiųsti į GitHub
    ├── Vercel → importuoti repozitoriją → Next.js, Node.js 24.x
    ├── Vercel → nustatyti abu Supabase aplinkos kintamuosius
    ├── Deploy → patikrinti viešą puslapį, dalyvio ir admin prisijungimą
    └── Vėlesni main šakos pakeitimai → automatinis naujas diegimas
```

## Vietinė peržiūra be Supabase

Reikalinga Node.js 24.

```bash
npm ci
npm run dev
```

Kai Supabase URL ir serverio raktas nenustatyti, `next dev` automatiškai naudoja vietinę PostgreSQL duomenų bazę (PGlite). Paskyros, sesijos, rezervacijos ir nugalėtojai saugomi projekto `.local-data/` aplanke ir išlieka perkrovus puslapį ar serverį. Registracija ir teisių patikros veikia serveryje, kaip ir su Supabase.

Vietinės peržiūros administratoriaus vardas ir atsitiktinai sugeneruotas slaptažodis yra `.local-data/admin-credentials.txt`. Šis failas turi privačias prieigos teises ir kartu su duomenų baze neįtraukiamas į Git. Prisijungimo duomenys niekur neskelbiami aplikacijoje. Senos vien naršyklėje laikytos demonstracinės paskyros nenaudojamos; vietinius dalyvius užregistruokite registracijos lange.

Vietinė bazė neįjungiama production ar Vercel aplinkoje. Jei nurodytas tik vienas Supabase kintamasis, aplikacija praneša apie neteisingą konfigūraciją, o ne pakeičia bazę vietine.

## Supabase duomenų bazė ir produkcija

Reikalinga Node.js 24 ir Supabase projektas.

```bash
npm ci
cp .env.example .env.local
```

Į `.env.local` įrašykite tikrą `NEXT_PUBLIC_SUPABASE_URL` ir `SUPABASE_SERVICE_ROLE_KEY`. Service role raktas naudojamas tik serveryje; jam negalima suteikti `NEXT_PUBLIC_` prefikso. Naršyklės anon raktas dabartinei aplikacijai nereikalingas.

Rekomenduojamas bendras komandos migracijų paleidimas:

```bash
npm run supabase:login
npm run supabase:link -- --project-ref YOUR_PROJECT_REF
npm run supabase:status
npm run supabase:plan
npm run supabase:push
```

Pakeiskite `YOUR_PROJECT_REF` tikru projekto identifikatoriumi. Jei SQL jau vykdytas rankomis, prieš `supabase:push` sutvarkykite istoriją pagal [Supabase instrukciją](docs/SUPABASE.md#jei-sql-anksčiau-vykdytas-rankomis). Naujos bazės SQL Editor alternatyva: `npm run supabase:bundle` → `supabase/generated/bootstrap.sql`. Po migracijų SQL Editor vykdykite `supabase/verify.sql`.

Migracijų eilės tvarka:

1. `supabase/migrations/202609140001_initial_schema.sql`
2. `supabase/migrations/202609140002_enable_app_access_and_seed.sql`
3. `supabase/migrations/202609150001_secure_access_and_winners.sql`
4. `supabase/migrations/202609170001_reservation_event_retention.sql`

Jei pirmos dvi jau pritaikytos, pritaikykite likusias migracijas eilės tvarka. Trečia migracija išsaugo esamas paskyras ir rezervacijas, uždaro naršyklės prieigą prie privačių lentelių, išjungia anksčiau viešintą pradinį administratoriaus slaptažodį ir sukuria sesijų bei nugalėtojų saugyklas. Jei yra vardų, besiskiriančių tik raidžių dydžiu ar tarpais, prieš ją išspręskite jų konfliktą: naujas unikalus indeksas tokių vardų nebeleidžia. Ketvirta migracija pašalina senesnę nei trijų mėnesių veiksmų istoriją ir prideda jos datos indeksą.

## Administratoriaus paskyra

Į vietinį `.env.local` įrašykite `ADMIN_NAME` (pagal nutylėjimą `Laima`) ir naują `ADMIN_PASSWORD` (bent 4 simboliai, daugiausiai 72 UTF-8 baitai). Tada paleiskite:

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

Administratoriaus ekrane pasirinkite žaidimo datą, kad matytumėte keturis stalus ir jų žaidėjus. Prie užimtos vietos esantis mygtukas „Pašalinti“ atmeta rezervaciją, atlaisvina vietą ir įrašo veiksmą į istoriją. Žaidėjo paskyra išlieka. Istorijoje rodoma iki 100 naujausių veiksmų po 25 viename puslapyje; atidarius istoriją iš bazės pašalinami senesni nei trijų mėnesių įrašai.

Paskutinio žaidimo nugalėtojai išsaugomi `winner_results` lentelėje ir iš naujo įkeliami atidarius puslapį. Visų laikų lentelė skaitoma iš `all_time_winners`; pradiniai rezultatai perkelti iš ankstesnės versijos. Esamas nugalėtojų redagavimo ekranas keičia paskutinio žaidimo rezultatus. Produkcijoje neprijungus Supabase ar nepavykus užklausai aplikacija praneša apie klaidą. Vietinėje kūrimo peržiūroje be Supabase naudojama tik serverio duomenų bazė; naršyklės localStorage autentifikavimui nenaudojamas.

## Patikros

```bash
npm test
npm run lint
npm run build
```

Testai tikrina serverio sesijas, teisių kontrolę ir SQL migracijas izoliuotame PostgreSQL variklyje (PGlite). Jame nėra `pgcrypto`, todėl tik šios plėtinio įjungimo eilutės iš pirmų dviejų migracijų testuojant praleidžiamos; saugumo migracija vykdoma nepakeista. Bcrypt tikrinamas atskirai aplikacijos testuose. Testai nejungiasi prie gyvos Supabase duomenų bazės.
