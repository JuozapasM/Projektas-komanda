# Bendra Supabase bazė ir viešas paleidimas

Supabase saugo bendrus duomenis; Next.js aplikacija veikia Vercel; GitHub saugo kodą ir pakeitimų istoriją. Vieša Vercel nuoroda leidžia dalyviams registruotis ir rezervuoti vietas iš savo įrenginių. Programuotojai prisijungia prie GitHub ir Supabase savo paskyromis.

## Komandos prieigos

Savininkas užpildo ir perduoda komandai šią informaciją. Nuorodos nėra paslaptys, API raktai ir slaptažodžiai čia nerašomi.

| Informacija | Reikšmė |
| --- | --- |
| GitHub kodas | `https://github.com/JuozapasM/Projektas-komanda` |
| Supabase kūrimo projektas | Savininkas įrašo projekto nuorodą |
| Supabase produkcijos projektas | Savininkas įrašo projekto nuorodą |
| Vieša aplikacija | Savininkas įrašo Vercel arba domeno nuorodą |
| Migracijas vykdantis asmuo | Savininkas nurodo atsakingą komandos narį |
| Privatūs kūrimo aplinkos duomenys | Komandos slaptažodžių tvarkytuvas |

GitHub savininkas suteikia programuotojams repozitorijos prieigą. Supabase organizacijos komandos nustatymuose savininkas kviečia narius, paprastai su `Developer` role. Ji leidžia dirbti su projekto turiniu, bet nekeisti projekto nustatymų. Organizacijos rolė galioja jos projektams; konkrečiam projektui apribotos rolės prieinamos Team ir Enterprise planuose. [Oficialios Supabase prieigos taisyklės](https://supabase.com/docs/guides/platform/access-control).

Vercel projekto prieigą suteikite diegimus prižiūrintiems žmonėms. Visi komandos nariai gali pradėti programuoti vietoje pagal [CONTRIBUTING.md](../CONTRIBUTING.md), neturėdami produkcijos raktų.

## 1. Paruošti pasirinktą Supabase projektą

Jei projektas jau sukurtas, naudokite jo identifikatorių iš Dashboard projekto nuorodos: `https://supabase.com/dashboard/project/PROJECT_REF`. Jei reikia naujo kūrimo projekto, sukurkite jį komandos organizacijoje ir DB slaptažodį išsaugokite privačiame slaptažodžių tvarkytuve.

Projekto terminale:

```bash
npm ci
npm run supabase:login
npm run supabase:link -- --project-ref YOUR_PROJECT_REF
npm run supabase:status
npm run supabase:plan
```

`YOUR_PROJECT_REF` pakeiskite pasirinkto projekto identifikatoriumi. CLI naudoja jūsų Supabase paskyrą; DB slaptažodį įveskite į CLI užklausą. `supabase/config.toml` aprašo vietinį Supabase; jo `project_id` nėra nuotolinio projekto susiejimas.

`supabase:status` palygina vietinę ir nuotolinę migracijų istoriją. `supabase:plan` parodo laukiančias migracijas; mūsų komanda naudoja `--dry-run --skip-vault`, todėl SQL netaikomas ir Vault paslaptys neatnaujinamos. Prieš keisdami naudojamą bazę, pasirūpinkite jos atsargine kopija.

## 2. Pritaikyti migracijas

Jei bazė nauja arba jos CLI migracijų istorija jau sutvarkyta:

```bash
npm run supabase:push
npm run supabase:status
```

CLI pritaiko tik dar nepritaikytas migracijas. Istorija išsaugoma nuotolinėje bazėje; pakartotinis paleidimas tų pačių migracijų nekartoja. [Oficialus migracijų darbo procesas](https://supabase.com/docs/guides/local-development/cli-workflows).

### Jei SQL anksčiau vykdytas rankomis

Jei lentelės jau yra, tačiau `supabase:status` rodo migracijas tik vietinėje pusėje, nevykdykite pirmos migracijos pakartotinai. Patikrinkite, kurie SQL failai iš tikrųjų buvo pritaikyti. `migration repair` tik pataiso istoriją – pačių lentelių ar funkcijų nesukuria. [CLI migracijų istorijos taisymas](https://supabase.com/docs/reference/cli/su).

Tik patvirtinus, kad visos trys esamos migracijos jau pritaikytos:

```bash
npx --no-install supabase migration repair 202609140001 202609140002 202609150001 --status applied
npm run supabase:status
npm run supabase:plan
```

Jei pritaikytos tik pirmos dvi, istorijoje pažymėkite tik `202609140001` ir `202609140002`, tada planuokite bei pritaikykite likusias migracijas. Taip išsaugosite paskyras ir rezervacijas. Jeigu nuotolinė schema skiriasi nuo failų, pirmiausia ją peržiūrėkite su atsakingu programuotoju; istorijos žymėjimas neatitaiso schemos skirtumų.

### Alternatyva naujai bazei: vienas SQL failas

Jei norite pirmą kartą paruošti naują bazę per SQL Editor:

```bash
npm run supabase:bundle
```

Atidarykite `supabase/generated/bootstrap.sql`, nukopijuokite visą jo turinį į pasirinkto projekto SQL Editor ir vykdykite. Tai visų migracijų rinkinys vienoje transakcijoje: nepavykus pakeitimai atšaukiami, o tarp pradinių migracijų nelieka dalinai paruoštos prieigos. Jis atsisako veikti aptikęs esamas aplikacijos lenteles ar vartotojo rolės tipą. Šis failas generuojamas iš migracijų ir rankiniu būdu neredaguojamas.

Po sėkmingo vykdymo susiekite CLI ir pažymėkite pritaikytas migracijų versijas pagal ankstesnį skyrių. Naujesnių migracijų versijos taip pat pateikiamos sugeneruoto SQL pradžioje. Tolesnius pakeitimus vykdykite per CLI.

## 3. Patikrinti bazę ir paruošti administratorių

SQL Editor vykdykite `supabase/verify.sql`. Patikra nekeičia įrašų ir nerodo prisijungimo duomenų. Ji patikrina lenteles, RLS, privačių lentelių teises, serverio funkcijų prieigą ir po 16 vietų kiekvienam žaidimui. Sėkmės rezultatas prasideda `OK`; ši patikra nepakeičia prisijungimo ir rezervavimo patikros aplikacijoje.

```bash
cp .env.example .env.local
```

Į `.env.local` įrašykite to paties projekto URL ir serverio raktą. Vartotojai registruojami aplikacijos `public.users` lentelėje; dabartinis prisijungimas nenaudoja Supabase Auth vartotojų ar el. pašto patvirtinimo.

| Kintamasis | Kur naudojamas |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` ir Vercel; pasirinkto projekto URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Tik serverio aplinkoje; to paties projekto `service_role` arba serverio secret raktas |
| `ADMIN_NAME` | Tik administratoriaus paruošimui vietoje |
| `ADMIN_PASSWORD` | Tik administratoriaus paruošimui vietoje; bent 4 simboliai, iki 72 UTF-8 baitų |

Serverio raktas turi plačias DB teises, todėl perduodamas privačiai ir neturi `NEXT_PUBLIC_` prefikso. [Supabase API raktų paskirtys](https://supabase.com/docs/guides/getting-started/api-keys).

```bash
npm run setup:admin
```

Ši komanda gali pakeisti jau esamo administratoriaus slaptažodį ir atšaukia jo senas sesijas. Vykdo paskyrą prižiūrintis žmogus; kiekvienas naujas programuotojas jos nekartoja. Pasirinktas vardas negali priklausyti dalyviui. Baigę pašalinkite `ADMIN_PASSWORD` iš `.env.local`.

Istorinės migracijos įkelia pradines žaidimo datas ir pavyzdinius nugalėtojų rezultatus, o senas pradinis admin slaptažodis išjungiamas. Prieš viešą paleidimą administratorius turi peržiūrėti datas ir įrašyti tikrus paskutinio žaidimo nugalėtojus. `.local-data/` duomenys į Supabase automatiškai neperkeliami.

## 4. Viešai paleisti per Vercel

```bash
npm run lint
npm test
npm run build
```

Į GitHub įkelkite kodą ir migracijas. Vercel importuokite repozitoriją pagal [README diegimo nustatymus](../README.md#vercel). Production aplinkoje nustatykite produkcijos Supabase URL ir serverio raktą. Preview aplinkoje naudokite atskirą kūrimo projektą, nes jo registracijos ir rezervacijos yra tikri DB įrašai. `ADMIN_PASSWORD` ir DB slaptažodžio Vercel aplikacijai nereikia.

Paleidę per viešą nuorodą patikrinkite nugalėtojus, naujo dalyvio registraciją, rezervavimą ir atšaukimą, administratoriaus stalus bei žaidėjo pašalinimą. Atnaujinkite puslapį ir patikrinkite duomenų išsaugojimą. Vercel nuoroda skirta dalyviams; Supabase Dashboard prieiga skirta komandai.

## Tolesnio pakeitimo seka

```text
Nauja Git šaka → naujas SQL migracijos failas → testai ir PR
  → migracija kūrimo Supabase projekte → peržiūra
  → produkcijos migracijų planas → atsakingo žmogaus db push
  → aplikacijos diegimas → bazės ir viešų veiksmų patikra
```

GitHub patikros automatiškai testuoja ir surenka aplikaciją, tačiau nediegia migracijų į bendrą bazę. Produkcijoje nenaudokite `supabase db reset --linked`: ši komanda ištrina nuotolinius duomenis. Jau pritaikytų migracijų netaisykite; pakeitimus dėkite į naują failą.
