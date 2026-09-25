# Holistisk teststrategi för To Do

## Syfte och principer

Strategin ska ge snabb feedback på logik, användarflöden och integrationer utan att blanda ihop vad varje testnivå kan bevisa. Testerna prioriterar användarsynliga kontrakt och felvägar framför enbart hög täckningsprocent.

Testerna ska vara:

- deterministiska och oberoende av tidigare browser-state
- baserade på roller, labels, stabil text eller explicita test-id:n när semantik saknas
- fria från godtyckliga `sleep`-anrop och väntetider i millisekunder
- körbara lokalt utan riktiga Firebase-credentials
- tydliga med skillnaden mellan mock-auth, browserflöden och riktig Firebase-integration

## Testnivåer

1. **Unit- och komponenttester** (Vitest) verifierar ren logik, Pinia-state, optimistic writes och komponentkontrakt.
2. **E2E-tester** (Playwright) verifierar routing, riktig DOM, pointer-events, viewportar och användarflöden.
3. **Firebase-integrationstester** (Firebase Emulator Suite) verifierar riktig auth, Firestore-persistens och säkerhetsregler separat från PR-sviten.

## Nuläge

- 6 Vitest-filer i `src/__tests__/`.
- 7 Playwright-filer i `e2e/`.
- `npm run validate` kör lint, typkontroll, coverage, E2E och produktionsbygge.
- Coverage-gate har följande globala minimikrav:
  - Statements: 70 %
  - Branches: 55 %
  - Functions: 65 %
  - Lines: 75 %
- Senast genererade coverage-baslinje:
  - Statements: 76,84 %
  - Branches: 66,14 %
  - Functions: 73,23 %
  - Lines: 81,25 %
- Senaste fullständiga validering: 31 godkända E2E-tester och godkänt produktionsbygge.

Baslinjen är ett regressionsskydd, inte ett bevis på testkvalitet. Täckningen ska därför inte höjas eller sänkas utan motsvarande beteendetester och en dokumenterad motivering.

## Prioritering

### P0: Kritisk funktionalitet

Körs vid varje pull request:

- auth-gating och mock-auth
- navigation mellan listor och smarta vyer
- taskens viktigaste state-växlingar
- skapande, redigering och borttagning av tasks
- responsiv sidomeny och detaljpanel
- optimistic writes, rollback och användarens felmeddelande

### P1: Viktiga användarflöden

Ingår i normal validering efter P0:

- listor, mappar och listflytt
- taggar och delsteg
- teman och inställningar
- menyer, övergångar och tangentbordsinteraktion
- responsiva kontroller på mobil, tablet och desktop

### P2: Integration och release-skydd

Körs separat eller inför release:

- Firebase Emulator Suite
- riktig auth och Firestore-regler
- persistence mellan omladdningar
- flera browsermotorer
- visuell regression för särskilt känsliga layouter

## Unit- och komponenttester

### Task store

Testerna ska täcka:

- lyckad `toggleCompleted`, `toggleImportant` och `toggleMyDay`
- rollback när en state-write misslyckas
- `updateTask` för titel, anteckning, datum, påminnelse och taggar
- delete med återställning vid misslyckad write
- create med tom titel och normaliserade indata
- separering av aktiva och slutförda tasks
- planned-vyns gränser för försenat, idag, imorgon och senare
- ogiltiga eller saknade datum utan exception
- återställning av felmeddelande och `isSaving` efter lyckad och misslyckad write
- cache-fallback och delstegs-rollback

### List store

Testerna ska täcka:

- normalisering av listnamn och avvisning av tom input
- namnbyte och färgändring med rollback vid Firestore-fel
- borttagning av lista, val av ny aktiv lista och skydd av defaultlistan
- skapande, namnbyte och borttagning av mappar
- borttagning av mappar med och utan listor
- flytt mellan mapp, utan mapp och rollback vid fel
- korrekt sortering och aktiv state efter navigation

### Auth store

Testerna ska täcka:

- initiering med och utan användare
- login-, register- och logout-fel
- att loading alltid återställs
- att callback från användare till `null` rensar app-state
- konsekvent state efter lyckade och misslyckade operationer

### Komponenter

Komponenttesterna ska täcka:

- sidomenyns taggvisning och `aria-expanded`
- aktiv tagg, mappsektioner och flyttmeny
- validering av ny lista och ny mapp
- Escape- och close-events för paneler och dialoger
- TaskDetailsPanel för prop-byte, titel, anteckning, datum, reminder, taggar och delsteg
- TaskRow med Enter, Space och separata task actions
- state och DOM-kontrakt snarare än exakta transitionstider

Varje test ska återställa Pinia, mocks och `localStorage` där de används.

## E2E-strategi

### Teknik och testläge

Playwright används för Chromium i den snabba sviten. Konfigurationen har:

- `baseURL` mot den lokala Vite-servern
- `VITE_DEV_AUTH_BYPASS=true`
- ny browser context per test
- `trace: 'on-first-retry'`
- screenshot vid testfel
- video vid testfel
- en worker i CI och retries i CI

Mockläget ger användaren `local-dev-user`, kringgår login och använder deterministiska lokala listor och tasks. Det får inte bero på utvecklarens befintliga browser-storage eller riktiga Firebase-hemligheter.

### P0-flöden

E2E-sviten ska verifiera:

1. Mock-auth öppnar huvudvyn utan login.
2. Privata routes utan auth skickar till login i ett separat auth-testläge.
3. `/`, `/my-day`, `/important` och `/planned` visar rätt rubrik och innehåll.
4. En task kan skapas, öppnas, redigeras och stängas.
5. En task kan markeras klar och återställas.
6. En task kan markeras viktig och hittas i Viktigt.
7. En task kan läggas till i Min dag och hittas där.
8. En task kan tas bort via bekräftelsedialog.
9. Listbyte uppdaterar URL, rubrik och synliga tasks.
10. Inställningar kan öppnas och stängas.

### Listor, mappar och taggar

Verifiera skapa, namnbyte, färgändring, borttagning och aktiv state för listor. Verifiera även skapande, namnbyte, flytt och borttagning av mappar med och utan listor. Taggar ska kunna skapas från detaljer, väljas och visas med korrekt route och innehåll.

### Drag-and-drop och gester

Drag-and-drop är en aktiv, testad funktion i nuvarande implementation och ska verifieras genom riktig pointer-interaktion:

1. lokalisera källans task-rad
2. hämta bounding box
3. trycka på en stabil yta i raden
4. flytta pointer stegvis över mål-raden
5. verifiera drop-indikator
6. släppa och verifiera synlig DOM-ordning

Täcka både drag före och efter mål, samma task, aktiva och slutförda tasks samt att detaljer eller knappar inte aktiveras av misstag. Swipe ska testas först när den är specificerad som aktiv interaktion.

### Responsivitet

Kör representativa flöden på:

- mobil: `390x844`
- tablet: `768x1024`
- desktop: `1440x900`

Verifiera sidomeny, overlay och close-knapp, mobil detaljpanel, taggradbrytning, dropdowns, kontextmenyer, mörkt läge och horisontellt overflow. Kontrollera att rubriker, task-titlar och primära knappar ryms i viewporten. Screenshots används endast för stabila visuella kontrakt; funktionell synlighet och interaktion är huvudkontrollerna.

## Fel, offline och rollback

### Unitnivå

Mocka Firestore-reject explicit och verifiera att:

- optimistic task- och liständring syns omedelbart
- state återställs vid misslyckad write
- ett begripligt error/toast visas
- `isSaving` återställs
- efterföljande operationer fungerar efter felet

### E2E-nivå

Bygg ut mockläget med en explicit testflagga eller kontrollerad Playwright-route. Använd inte slumpmässiga nätverksfel. Lägg till browsertester för task-create rollback, task-update rollback, list-create/list-update rollback, cache-fallback vid läsning offline och fortsatt navigation efter fel.

## Testinfrastruktur och testdesign

Gemensamma helpers kan införas när duplicering motiverar det. Följande struktur är avsedd för stabila helpers:

```text
src/__tests__/helpers/firestore.ts
e2e/helpers/app.ts
e2e/helpers/tasks.ts
e2e/fixtures/app.ts
```

Helpers ska kunna skapa stabila Firestore-snapshots, öppna bestämda routes, vänta på färdigt app-state och läsa task-rader via roller och labels. Selektorer baserade på Tailwind-klasser eller DOM-positioner ska undvikas.

Demo-data ska ha stabila titlar och id:n. Varje E2E-test ska börja från en explicit route och en isolerad context. Vänta på URL, synlighet, text, ändrad ordning eller försvunnen dialog i stället för fasta tidsintervall.

## CI och lokala kommandon

PR-kedjan är:

```text
npm run lint
npm run type-check
npm run test:ci
npm run test:e2e
npm run build-only
```

Samma kedja finns samlad i:

```sh
npm run validate
```

CI ska använda Node-versionen från `package.json`, installera Chromium deterministiskt, köra `CI=true`, använda en worker, spara felsökningsartefakter och inte kräva Firebase-credentials. Lokalt finns även `npm run test:e2e:headed` och `npm run test:e2e:ui`.

## Firebase-integration

När Firebase Emulator Suite införs ska den separata sviten:

- testa auth login och logout
- testa Firestore security rules och auth claims
- testa persistence mellan reloads
- testa flera användare och dataisolering
- köras separat från den snabba mock-auth-sviten
- aldrig använda personlig produktionsdatabas, riktiga tokens eller riktiga användarkonton

## Återstående arbete

Följande är de viktigaste dokumenterade luckorna:

- privat route-gating utan mock-auth
- kontrollerade E2E-write-fel och browserbaserad cache-fallback
- gemensamma testhelpers när dupliceringen blir märkbar
- kompletterande dragfall för samma task, drag efter mål och separata completed-sektioner
- full CI-dokumentation och verifiering av Chromium-installation i ren miljö
- Firebase Emulator Suite för auth, regler och persistence
- eventuell bredare browser- eller visuell regression vid release

## Definition of Done

Strategin är genomförd när:

- P0-flödena är implementerade och gröna
- minst ett kritiskt flöde körs på mobil, tablet och desktop
- listor, mappar och taggar har både store- och E2E-skydd
- varje optimistic write har minst en lyckad och en misslyckad väg
- coverage-gaten passerar utan dolda undantag
- `npm run validate` passerar i ren miljö
- testfel ger tillräcklig trace, screenshot eller video för felsökning
- dokumentationen beskriver mock-auth, lokala kommandon och integrationssviten

## Prioriterad ordning

1. Slutför privat auth-gating i separat testläge.
2. Lägg till kontrollerade E2E-felvägar och cache-fallback.
3. Komplettera drag-and-drop med återstående gränsfall.
4. Inför helpers när testduplicering motiverar det.
5. Dokumentera och kör Firebase Emulator Suite separat.
6. Lägg till bredare browser- och visuell regression vid behov.

## Implementeringssteg för återstående arbete

### Steg 1: Isolera privat auth-gating

**Mål:** verifiera att privata routes skyddas utan att påverka mock-auth-sviten.

- Lägg till ett separat Playwright-testläge utan `VITE_DEV_AUTH_BYPASS`.
- Mocka eller ersätt Firebase-auth-initieringen deterministiskt så testet inte kräver ett riktigt konto.
- Lägg till test i `e2e/auth.spec.ts` för direkt navigation till `/`, `/my-day`, `/important` och `/planned` utan användare.
- Verifiera redirect till login, att login/register-vyerna visas och att ingen privat data läcker före redirect.
- Kör mock-auth-sviten och auth-gating-testet separat om de behöver olika serverkonfiguration.

**Klart när:** auth-testet passerar isolerat och i CI utan Firebase-credentials, medan befintliga mock-auth-tester fortfarande passerar.

### Steg 2: Bygg kontrollerade write-fel

**Mål:** verifiera optimistic UI, rollback och återhämtning i riktig browser.

- Inför en explicit testflagga eller en kontrollerad Playwright-route för valda Firestore-writes.
- Använd stabila operationer, till exempel `create-task`, `update-task`, `create-list` och `update-list`, så varje test kan styra exakt vilket anrop som fallerar.
- Lägg tester i `e2e/tasks.spec.ts` och `e2e/lists.spec.ts` för feltoast, återställt state och fortsatt navigation.
- Lägg till separat läsfel/cache-fallback när appens mockläge kan simulera det deterministiskt.
- Kontrollera att `isSaving` eller motsvarande loading-state återställs och att nästa write fungerar efter felet.

**Klart när:** varje kritisk optimistic write har en grön väg och en kontrollerad felväg i både store- och E2E-test.

### Steg 3: Komplettera drag-and-drop

**Mål:** täcka gränsfall som inte ingår i nuvarande pointer-tester.

- Utöka `e2e/task-reorder.spec.ts` med drag efter mål-task, drag till samma task och drag i completed-sektionen.
- Verifiera ordningen via synliga task-rader efter drop och efter omladdning.
- Verifiera att dragning inte öppnar detaljpanelen, aktiverar en task action eller lämnar en drop-indikator kvar.
- Kör åtminstone samma kritiska fall på desktop och mobil viewport.
- Undersök flakighet via trace vid retry i stället för fasta väntetider.

**Klart när:** alla gränsfall har stabila DOM-verifieringar och inga dragtester kräver godtyckliga sleeps.

### Steg 4: Extrahera gemensamma testhelpers vid behov

**Mål:** minska duplicering utan att dölja testens användarsynliga beteende.

- Mät först faktisk duplicering i `e2e/*.spec.ts` och `src/__tests__/*.spec.ts`.
- Extrahera endast stabila operationer till `e2e/helpers/app.ts`, `e2e/helpers/tasks.ts` och vid behov `e2e/fixtures/app.ts`.
- Lägg Firestore-snapshot- och mockfabriker i `src/__tests__/helpers/firestore.ts` om unit-testerna upprepar samma setup.
- Behåll selectors och förväntningar nära testet när de beskriver själva beteendekontraktet.
- Kör hela unit- och E2E-sviten efter varje helperrefaktorering.

**Klart när:** helpers minskar upprepning, testerna fortfarande är läsbara och ingen helper använder Tailwind-klasser eller DOM-positioner som kontrakt.

### Steg 5: Inför Firebase Emulator Suite

**Mål:** täcka beteenden som lokal mock-auth inte kan bevisa.

- Lägg till separat emulator-konfiguration för Auth och Firestore utan att ändra PR-svitens mockläge.
- Skapa isolerade testdata per test eller användare och verifiera dataisolering mellan användare.
- Testa login/logout, Firestore security rules, auth claims och persistence mellan reloads.
- Lägg emulator-testerna i ett separat npm-script och kör dem inte som krav för snabba lokala mock-auth-tester.
- Dokumentera emulator-start, miljövariabler, seedning och cleanup.

**Klart när:** integrationssviten kan köras mot emulatorer med ett eget kommando och aldrig använder produktionsdatabas, riktiga tokens eller personliga konton.

### Steg 6: Utöka release-regression

**Mål:** fånga browser- och layoutskillnader som Chromium-only-sviten inte täcker.

- Lägg till Firefox och WebKit endast för de mest kritiska P0-flödena först.
- Välj ett litet antal stabila visuella kontrakt, till exempel mobil sidomeny och detaljpanel, i stället för full screenshot-täckning.
- Kör bredare browser- och visuell regression vid release eller manuellt workflow, inte nödvändigtvis vid varje PR.
- Spara trace och screenshots vid fel och dokumentera hur baslinjer uppdateras.

**Klart när:** release-sviten har definierat scope, reproducerbara artefakter och en dokumenterad rutin för godkända visuella förändringar.

### Validering efter varje steg

Efter varje steg ska följande köras i ordning:

1. Det nya eller ändrade fokustestet.
2. `npm run type-check` och `npm run lint`.
3. `npm run test:ci`.
4. `npm run test:e2e`.
5. `npm run build-only`.

När flera steg är samlade ska hela `npm run validate` köras i ren miljö. Uppdatera därefter nuläge, coverage-baslinje och listan över återstående arbete i detta dokument.