# Implementationsplan: E2E-teststrategi för To Do

## Sammanfattning

Ja, E2E-tester skulle skapa tydligt mervärde i det här projektet. De viktigaste riskerna ligger i beteenden som unit-testerna inte kan verifiera fullt ut:

- navigation och auth-gating i riktig browser
- pointer-baserad drag-and-drop av tasks
- samspelet mellan Vue-komponenter, Pinia stores och router
- responsiva layouter och mobila interaktioner
- optimistic UI och felmeddelanden i användarflöden

Planen är att införa Playwright med ett deterministiskt lokalt testläge baserat på den befintliga `VITE_DEV_AUTH_BYPASS=true`-konfigurationen. Firebase ska inte behöva vara tillgängligt för huvuddelen av E2E-sviten.

## Mål

1. Verifiera de viktigaste användarflödena från browserns perspektiv.
2. Fånga regressioner som kräver riktig DOM, pointer-events, routing eller viewport.
3. Göra drag-and-drop testbart och reproducerbart utan manuella tester.
4. Hålla testerna snabba, lokala och oberoende av riktiga konton.
5. Behålla en liten separat smoke-svit för riktig Firebase-integration när den behövs.

## Föreslagen teknik

### Primärt val: Playwright

Playwright passar bättre än att bygga vidare på Vitest för dessa tester eftersom det erbjuder:

- riktiga Chromium-browserflöden
- pointer- och touch-events
- flera viewportstorlekar
- väntan på navigation och synlig UI utan manuella sleeps
- screenshots och trace-filer vid fel
- möjlighet att senare lägga till Firefox/WebKit

### Testläge

E2E-testservern ska startas med:

```text
VITE_DEV_AUTH_BYPASS=true
```

Det befintliga mockläget ger:

- automatisk lokal användare: `local-dev-user`
- bypass av login-sidan
- deterministiska demo-listor och tasks
- lokala writes utan Firebase-persistens

Detta ska användas för huvuddelen av E2E-testerna. Testerna ska inte vara beroende av den utvecklarens befintliga browser-storage eller tidigare testkörningar.

## Prioriterade testområden

### P0: Auth och navigation

Dessa tester bör implementeras först eftersom alla andra flöden kräver att användaren kan komma in i appen.

- Appen öppnar huvudvyn direkt när mock-auth är aktiverad.
- Login- och registervyerna visas inte när mock-användaren är aktiv.
- Direkt navigation till `/`, `/my-day`, `/important`, `/planned` fungerar.
- Listvy och smarta vyer visar korrekt rubrik.
- Logout återställer state och navigerar tillbaka till login i riktigt auth-läge.
- Utan mock-auth och utan Firebase-användare skyddas privata routes av router-gaten.

### P0: Task-flöden

- Demo-tasks visas i standardlistan.
- En task kan markeras som klar och återställas.
- En task kan markeras som viktig och syns i Viktigt-vyn.
- En task kan läggas till i Min dag och syns i Min dag-vyn.
- En task kan öppnas i detaljpanelen.
- Titel och anteckning kan redigeras.
- En task kan tas bort via bekräftelsedialog.
- En ny task kan skapas från listvyn.

### P0: Drag-and-drop

Detta är den viktigaste browser-specifika sviten eftersom problemet hittills inte har kunnat fångas av enbart unit-tester.

- Starta drag på en task med mus/pointer.
- Flytta pekaren över en annan task och verifiera synlig drop-indikator.
- Släpp före mål-task och verifiera den nya ordningen.
- Släpp efter mål-task och verifiera den nya ordningen.
- Dra en task till sig själv och verifiera att ordningen inte ändras.
- Kontrollera att dragning av en completed task inte blandas med aktiva tasks.
- Kontrollera att dragning inte triggar taskens detaljvy eller knappar.
- Verifiera att dragning fungerar i en listvy men inte i smarta vyer där sortering inte stöds.
- Verifiera dragning med en mobil viewport och touch/pointer-event där Playwright-miljön stödjer det.

Testet ska kontrollera användarsynlig ordning, inte bara interna store-värden.

### P1: Listor och mappar

- Skapa en lista.
- Byt namn på en lista.
- Ändra listfärg.
- Skapa en mapp.
- Flytta en lista till en mapp.
- Ändra ordningen på listor i sidomenyn.
- Ta bort en mapp utan tasks.
- Ta bort en lista och verifiera bekräftelsedialogen.
- Kontrollera att vald lista och aktiv vy uppdateras efter ändringar.

### P1: Responsivitet och interaktion

Kör kritiska flöden på minst dessa viewportar:

- Mobil: `390x844`
- Tablet: `768x1024`
- Desktop: `1440x900`

Verifiera bland annat:

- sidomenyn kan öppnas och stängas på mobil
- task-detaljer öppnas som panel/dialog på mobil
- inga knappar eller task-titlar hamnar utanför viewporten
- sidomenyn påverkar inte task-listans klickyta
- swipe-actions och dropdown-menyer fungerar utan att öppna task-detaljer av misstag
- mörkt/ljust tema ändrar layouten utan visuella eller funktionella fel

### P1: Fel och offline-liknande beteende

Mockläget ska utökas med kontrollerbara fel endast om vanliga flöden behöver det. Därefter kan E2E verifiera:

- feltoast visas när en write misslyckas
- optimistic ändring rullas tillbaka vid skrivfel
- appen visar användbar fallback när data inte kan läsas
- loading-state blockerar inte onödigt användarflöde

Detta bör inte simuleras genom slumpmässiga nätverksfel. Använd i stället en explicit testflagga eller en kontrollerad Playwright-route.

## Föreslagen mappstruktur

```text
playwright.config.ts
e2e/
  fixtures/
    app.ts
  helpers/
    selectors.ts
  auth.spec.ts
  tasks.spec.ts
  task-drag-drop.spec.ts
  lists.spec.ts
  responsive.spec.ts
```

## Implementationssteg

### Steg 1: Testinfrastruktur

- [x] Installera `@playwright/test`.
- [ ] Installera Chromium för lokal CI-körning.
- [ ] Skapa `playwright.config.ts`.
- [ ] Konfigurera `webServer` så Vite startas med `VITE_DEV_AUTH_BYPASS=true`.
- [ ] Sätt `baseURL` till lokal Vite-server.
- [ ] Konfigurera trace, screenshot och video endast vid testfel.
- [ ] Lägg till `e2e` och Playwright-artifacts i `.gitignore`.
- [ ] Lägg till npm-script: `test:e2e` och `test:e2e:ui`.

### Steg 2: Stabil testmiljö

- [ ] Lägg till semantiska `data-testid` endast där tillgängliga roller och labels inte räcker.
- [ ] Se till att demo-data har stabila id:n och titlar.
- [ ] Skapa en fixture som väntar på appens färdiga state.
- [ ] Säkerställ att varje test börjar från en ren route och inte ärver browser-state.
- [ ] Lägg till helper för att öppna en specifik listvy.
- [ ] Lägg till helper för att läsa task-ordning från synliga DOM-rader.

### Steg 3: P0-tester

- [ ] Implementera auth/navigation-test.
- [ ] Implementera task CRUD-test.
- [ ] Implementera task-drag-drop-test med mus/pointer.
- [ ] Verifiera aktiv och completed-sektion separat.
- [ ] Köra testen på desktop och mobil viewport.

### Steg 4: P1-tester

- [ ] Implementera list- och mappflöden.
- [ ] Implementera responsiva interaktionstester.
- [ ] Implementera tema- och dropdown-regressionstester.
- [ ] Lägg till kontrollerad write-failure-testning om mockläget byggs ut.

### Steg 5: CI och utvecklarflöde

- [ ] Kör E2E i CI efter unit tests och type-check.
- [ ] Kör en Chromium-svit på varje pull request.
- [ ] Kör bredare browser-matris vid release eller manuellt workflow.
- [ ] Spara Playwright trace och screenshots endast vid fel.
- [ ] Dokumentera lokal körning i `README.md`.
- [ ] Lägg till tydliga kommandon för headed mode och UI mode.

## Exempel på scripts

```json
{
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:headed": "playwright test --headed"
}
```

De exakta scriptnamnen kan anpassas efter projektets övriga npm-konventioner.

## Testdesign och stabilitet

### Använd synliga kontrakt

Prioritera:

- `getByRole`
- `getByLabel`
- `getByText` för stabila användartexter
- `data-testid` endast när ett visuellt element saknar bra semantiskt kontrakt

Undvik CSS-selektorer som bygger på Tailwind-klasser eller DOM-positioner.

### Undvik godtyckliga väntetider

Använd väntan på:

- URL
- synlighet
- förväntad text
- ändrad task-ordning
- försvunnen dialog

Använd inte fasta `sleep`-anrop för att kompensera för race conditions.

### Drag-and-drop-strategi

Eftersom implementationen använder pointer-events bör testet:

1. lokalisera källans task-rad
2. hämta dess bounding box
3. trycka med pointer på en stabil yta i raden
4. flytta pointer stegvis över mål-raden
5. verifiera drop-indikatorn
6. släppa pointer
7. verifiera ordningen i DOM

Ett test som enbart anropar intern store-logik ger inte tillräckligt skydd för den här funktionen.

## Avgränsning mot Firebase

### Lokal E2E-svit

Den lokala sviten implementeras i följande ordning. Varje steg ska vara klart innan nästa steg påbörjas.

#### Steg 1: Grundläggande testkörning

- [ ] Installera `@playwright/test`.
- [ ] Installera Chromium lokalt med Playwright.
- [x] Skapa `playwright.config.ts` med `baseURL` för Vite.
- [x] Lägg till ett npm-script för `test:e2e`.
- [x] Starta Vite automatiskt via Playwrights `webServer`.
- [x] Kör ett första smoke-test som öppnar appen.

**Klart när:** `npm run test:e2e` kan starta appen och köra ett grönt test utan manuell serverstart.

#### Steg 2: Mock-auth och isolerad testdata

- [x] Starta E2E-servern med `VITE_DEV_AUTH_BYPASS=true`.
- [x] Verifiera att appen öppnar huvudvyn utan login-interaktion.
- [x] Verifiera att demo-listor och demo-tasks laddas deterministiskt.
- [x] Säkerställ att mockläget inte använder riktiga Firebase-hemligheter.
- [x] Skapa en ny browser context för varje test.
- [x] Säkerställ att testerna börjar från en explicit route.

**Klart när:** varje test kan köras isolerat och alltid får samma användare, listor och tasks.

#### Steg 3: Stabil test-API

- [x] Lägg till semantiska selectors där roller och labels inte räcker.
- [ ] Skapa fixture/helper för att öppna en listvy.
- [ ] Skapa helper för att läsa synlig task-ordning från DOM.
- [ ] Skapa helper för att vänta på att huvudvyn är färdigladdad.
- [ ] Undvik selectors baserade på Tailwind-klasser och DOM-positioner.
- [ ] Undvik fasta `sleep`-anrop.

**Klart när:** testfallen kan uttrycka användarflöden utan upprepad låg-nivå-DOM-kod.

#### Steg 4: P0-testfall

- [x] Testa att mock-auth öppnar huvudvyn.
- [ ] Testa att privata routes utan auth skickar till login i ett separat auth-testläge.
- [x] Testa att en ny task kan skapas.
- [ ] Testa att en task kan markeras som klar och återställas.
- [x] Testa att task-detaljer kan öppnas och redigeras.
- [ ] Testa att en task kan tas bort via bekräftelsedialog.
- [ ] Testa att en task kan markeras som viktig och visas i Viktigt-vyn.
- [ ] Testa att en task kan läggas till i Min dag.

**Klart när:** de viktigaste task- och navigationsflödena fungerar i Chromium på desktop viewport.

#### Steg 5: Drag-and-drop i riktig browser

- [x] Starta drag med pointer på en task-rad.
- [x] Flytta pointer stegvis över en mål-task.
- [x] Verifiera att drop-indikatorn syns.
- [x] Släpp före mål-task och verifiera synlig DOM-ordning.
- [ ] Släpp efter mål-task och verifiera synlig DOM-ordning.
- [ ] Verifiera att dragning till samma task inte ändrar ordningen.
- [ ] Verifiera att dragning inte öppnar task-detaljer eller aktiverar knappar.
- [ ] Verifiera aktiv och completed-sektion separat.
- [x] Kör samma kärntest på mobil viewport.

**Klart när:** drag-and-drop är verifierat genom riktig pointer-interaktion och användarsynlig ordning, inte bara genom store-anrop.

#### Steg 6: Responsiva regressionstester

- [ ] Kör auth- och task-smoke-test på `390x844`.
- [ ] Verifiera att sidomenyn kan öppnas och stängas på mobil.
- [ ] Verifiera att task-detaljer fungerar som mobil panel.
- [x] Kör drag-and-drop-test på `390x844`.
- [ ] Kör ett representativt flöde på `768x1024`.
- [ ] Kör ett representativt flöde på `1440x900`.
- [ ] Kontrollera att ingen viktig text eller knapp hamnar utanför viewporten.

**Klart när:** P0-flödena fungerar på mobil, tablet och desktop utan layout- eller klickproblem.

#### Steg 7: Felsökning och CI

- [ ] Konfigurera trace vid första retry eller testfel.
- [ ] Spara screenshot vid testfel.
- [ ] Lägg till Playwright-artifacts i `.gitignore`.
- [ ] Kör den lokala Chromium-sviten på varje pull request.
- [ ] Kör unit tests, type-check, lint och E2E i dokumenterad ordning.
- [ ] Dokumentera `npm run test:e2e`, headed mode och UI mode i `README.md`.
- [ ] Kontrollera att CI inte kräver Firebase-credentials.

**Klart när:** samma E2E-svit kan köras lokalt och i CI med felsökningsartefakter vid regressioner.

#### Slutkontroll

- [ ] Alla steg ovan är avbockade.
- [ ] P0-sviten passerar i Chromium.
- [x] Drag-and-drop passerar på desktop och mobil viewport.
- [ ] Inga riktiga konton, tokens eller Firebase-hemligheter används.
- [ ] Testerna är oberoende av tidigare browser-state.
- [ ] Playwright trace kan öppnas när ett test fallerar.

### Separat integrations-/smoke-svit

- använder Firebase Emulator Suite om projektet inför den
- testar riktiga auth- och Firestore-regler
- körs separat från den snabba PR-sviten
- ska aldrig använda en personlig produktionsdatabas eller riktiga användarkonton

Firebase Emulator Suite är nästa steg om regler, auth claims eller persistence behöver verifieras på riktigt. Playwright med lokal mock-auth ersätter inte sådana tester, men kompletterar dem.

## Prioriterad första leverans

Första implementationen bör innehålla ungefär 8-12 tester:

1. mock-auth öppnar huvudvyn
2. privat route utan auth skickar till login
3. skapa task
4. markera task som klar
5. öppna och redigera task-detaljer
6. ta bort task
7. drag före annan task
8. drag efter annan task
9. dragning bland completed tasks
10. mobil sidomeny
11. listbyte
12. viktig task i Viktigt-vyn

Det ger hög täckning av projektets största regressionsrisker utan att bygga en långsam och svårskött testsvit direkt.

## Definition of Done

- [ ] Playwright kör lokalt med ett kommando.
- [ ] E2E-servern använder mock-auth utan manuell login.
- [ ] P0-sviten passerar i Chromium.
- [ ] Drag-and-drop verifieras genom synlig DOM-ordning.
- [ ] Mobil viewport täcks av minst ett kritiskt flöde.
- [ ] Testfel ger trace eller screenshot som kan felsökas.
- [ ] Unit, type-check, lint och E2E körs i dokumenterad ordning.
- [ ] CI kör den snabba E2E-sviten utan Firebase-hemligheter.

## Risker och motåtgärder

| Risk | Motåtgärd |
|---|---|
| Testerna blir beroende av demo-text | Stabil testdata och semantiska selectors |
| Drag-testet blir flakigt | Pointer-events, stegvis rörelse, DOM-verifiering och trace vid fel |
| Mockläget skiljer sig för mycket från Firebase | Separat Emulator Suite-svit för integration |
| Testerna blir långsamma | Chromium först, begränsad P0-svit per PR |
| Responsive-testen blir visuellt subjektiva | Fokusera på overflow, synlighet och interaktion; använd screenshots endast där det ger signal |
| Lokalt browser-state läcker mellan tester | Ny context per test och explicit start-route |

## Förväntat mervärde

Den största vinsten är snabb feedback på användarflöden som tidigare behövt verifieras manuellt. Framför allt ger E2E-sviten ett konkret skydd mot att drag-and-drop ser korrekt ut i unit-test men inte fungerar i riktig browser, samtidigt som auth-bypass gör körningen tillräckligt enkel för lokal utveckling och CI.
