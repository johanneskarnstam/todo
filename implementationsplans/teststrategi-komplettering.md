# Implementationsplan: kompletterad teststrategi

## Syfte

Den här planen kompletterar [e2e-teststrategi.md](./e2e-teststrategi.md) med de testfall och den testinfrastruktur som fortfarande saknas. Målet är att refaktoreringar ska ge snabb och tydlig feedback när befintlig funktionalitet påverkas.

Planen skiljer på tre nivåer:

1. **Unit- och komponenttester** för ren logik, Pinia-state och komponentkontrakt.
2. **E2E-tester** för routing, riktig DOM, viewport, pointer-events och användarflöden.
3. **Coverage och CI-gates** för att förhindra att testskyddet gradvis försämras.

## Nuläge

- 5 Vitest-filer.
- 39 godkända unit-/komponenttester.
- 2 Playwright-filer.
- 7 godkända E2E-tester.
- `npm run validate` kör lint, type-check, coverage, E2E och produktionsbuild.
- Coverage-gate är införd med följande globala minimikrav:
  - Statements: 70 %
  - Branches: 55 %
  - Functions: 65 %
  - Lines: 75 %
- Senaste baslinje:
  - Statements: 71,95 %
  - Branches: 59,25 %
  - Functions: 67,79 %
  - Lines: 77,19 %

Coverage-gaten är ett skydd mot att täckningen sjunker, men den bevisar inte att rätt beteende testas. Nya tester ska därför fokusera på användarsynliga kontrakt och felvägar, inte bara på att öka procenttalet.

## Prioritet

### P0: Kritisk funktionalitet

Ska implementeras först och köras vid varje pull request.

- Taskens viktigaste state-växlingar.
- Navigation mellan listor och smarta vyer.
- Auth-gating.
- Responsiv sidomeny och detaljpanel.
- Optimistiska writes och rollback vid fel.

### P1: Viktiga användarflöden

Ska implementeras efter P0 och ingå i den normala valideringen.

- Listor och mappar.
- Taggar.
- Delsteg.
- Tema och inställningar.
- Menyer, övergångar och tangentbordsinteraktion.

### P2: Integration och release-skydd

Körs separat eller vid release.

- Firebase Emulator Suite.
- Riktig auth och Firestore-regler.
- Flera browsermotorer.
- Visuell regression där layouten är särskilt känslig.

## Steg 1: Stabil testinfrastruktur

### 1.1 Coverage

**Status:** Genomförd.

- Behåll `@vitest/coverage-v8` som dev dependency.
- Behåll `npm run test:coverage` för lokal mätning.
- Kör coverage via `test:ci`, så `npm run validate` stoppar vid sjunkande täckning.
- Höj trösklarna först när motsvarande beteendetester finns på plats.
- Undvik att sänka trösklarna för att få igenom en refaktorering.

### 1.2 Gemensamma testhelpers

Skapa följande filer:

```text
src/__tests__/helpers/firestore.ts
e2e/helpers/app.ts
e2e/helpers/tasks.ts
e2e/fixtures/app.ts
```

Helpers ska:

- skapa Pinia och återställa mocks mellan unit-tester
- skapa stabila Firestore-snapshots
- öppna en bestämd route i E2E
- vänta på appens färdiga state utan `sleep`
- läsa task-rader via roller och labels
- undvika selektorer baserade på Tailwind-klasser eller DOM-positioner

### 1.3 Isolering

- Varje Vitest-test ska återställa Pinia, mocks och `localStorage`.
- Varje Playwright-test ska använda ny browser context.
- Varje E2E-test ska börja med explicit route.
- Demo-data ska ha stabila titlar och id:n.
- Firebase-credentials ska inte behövas i PR-sviten.

## Steg 2: P0 unit- och komponenttester

### 2.1 Task store

Fil: `src/__tests__/taskStore.spec.ts`

Lägg till tester för:

- `toggleCompleted` lyckas och sparar nytt state.
- `toggleImportant` lyckas och rullar tillbaka vid fel.
- `toggleMyDay` lyckas och rullar tillbaka vid fel.
- `updateTask` uppdaterar titel, anteckning, datum, påminnelse och taggar.
- `deleteTask` tar bort task och återställer vid misslyckad write.
- `createTask` avvisar tom titel.
- completed tasks separeras korrekt från aktiva tasks.
- planned-vyn filtrerar datumgränser korrekt för försenat, idag, imorgon och senare.
- task med ogiltigt eller saknat datum hanteras utan exception.
- felmeddelande och `isSaving` återställs efter lyckad och misslyckad write.

### 2.2 List store

Fil: `src/__tests__/listStore.spec.ts`

Lägg till tester för:

- skapa lista med blanksteg normaliserar namnet.
- tomt listnamn skapar inte en lista.
- byta listnamn rullar tillbaka vid Firestore-fel.
- ändra listfärg sparar och rullar tillbaka korrekt.
- ta bort lista väljer ny aktiv lista.
- ta bort vald lista påverkar inte defaultlistan.
- mapp kan skapas med stabilt id.
- mappnamn kan ändras och rullas tillbaka.
- ta bort mapp med respektive utan listor ger rätt resultat.
- flytta lista mellan mapp, utan mapp och vid fel.

### 2.3 Auth store

Fil: `src/__tests__/authStore.spec.ts`

Lägg till tester för:

- auth-initiering utan användare.
- login-fel och register-fel.
- logout-fel lämnar state konsekvent.
- loading går alltid tillbaka till `false` efter lyckad eller misslyckad operation.
- auth callback som ändras från användare till `null` rensar app-state.

### 2.4 Komponenter

Fil: `src/__tests__/taskComponents.spec.ts`

Lägg till tester för:

- sidomenyn visar och döljer taggar med korrekt `aria-expanded`.
- aktiv tagg får aktiv stil och rätt event.
- mappsektioner öppnas och stängs.
- flyttmeny visar tillgängliga mappar och emitterar rätt id.
- ny lista och ny mapp validerar tom input.
- `Escape`/close-event stänger relevanta paneler.
- TaskDetailsPanel sparar ändringar av titel, anteckning, datum, reminder och taggar.
- TaskDetailsPanel visar rätt state när task-prop byts.
- TaskRow keyboard-events fungerar med Enter och Space.
- task actions stoppar inte radens övriga beteende.

Övergångar ska i första hand testas genom state och DOM-kontrakt, inte genom exakta millisekunder. Visuell timing hör hemma i browser- eller visuell regressionstestning.

## Steg 3: P0 E2E-flöden

Filer:

```text
e2e/auth.spec.ts
e2e/tasks.spec.ts
e2e/navigation.spec.ts
```

Implementera:

1. mock-auth öppnar huvudvyn.
2. smart views `/my-day`, `/important` och `/planned` visar rätt rubrik.
3. task kan skapas.
4. task kan markeras klar och återställas.
5. task kan markeras viktig och hittas i Viktigt.
6. task kan läggas till i Min dag och hittas där.
7. taskdetaljer kan öppnas, redigeras och stängas.
8. task kan tas bort via dialog.
9. tagg kan skapas från detaljer och väljas i sidomenyn.
10. listbyte uppdaterar URL, rubrik och synliga tasks.
11. inställningar kan öppnas och stängas.
12. privat route utan mock-auth skickar till login i separat kontrollerat testläge.

Alla tester ska använda `getByRole`, `getByLabel` eller stabil text där det är möjligt.

## Steg 4: Responsiva E2E-tester

Skapa `e2e/responsive.spec.ts` med separata test cases för:

- mobil `390x844`
- tablet `768x1024`
- desktop `1440x900`

Verifiera:

- sidomenyn öppnas från headern.
- sidomenyn stängs via close-knapp, overlay och val av vy.
- sidomenyn glider ut utan att lämna klickbar overlay eller synligt innehåll efter transitionen.
- taggpills radbryts utan horisontell overflow.
- taskdetaljer visas som mobil panel och kan stängas.
- inga primära knappar eller rubriker hamnar utanför viewporten.
- dropdown- och context-menyer ligger inom viewporten.
- mörkt läge behåller kontrast och interaktion.

Testa funktionell synlighet och overflow. Använd screenshots endast för stabila, viktiga visuella kontrakt.

## Steg 5: Listor, mappar och taggar i E2E

Skapa `e2e/lists.spec.ts` och komplettera `e2e/tasks.spec.ts` med:

- skapa lista.
- byta namn på lista.
- ändra listfärg.
- skapa mapp.
- byta namn på mapp.
- flytta lista till mapp.
- flytta lista utan mapp.
- ta bort mapp med och utan listor.
- aktiv mapp/lista behåller korrekt state efter navigation.
- taggmeny öppnas med transition utan att testet behöver vänta godtyckligt.
- vald tagg får korrekt route och innehåll.

## Steg 6: Fel, offline och rollback

### Unitnivå

Mocka Firestore reject explicit och verifiera:

- optimistic task/list ändras omedelbart.
- state återställs när write misslyckas.
- användaren får ett begripligt error/toast.
- `isSaving` återställs.
- efterföljande operationer fungerar efter ett fel.

### E2E-nivå

Lägg till en explicit testflagga eller kontrollerad Playwright-route för write-fel. Använd inte slumpmässiga nätverksfel och inga fasta väntetider.

Verifiera minst:

- task-create rollback.
- task-update rollback.
- list-create/list-update rollback.
- cache-fallback vid läsning offline.
- användaren kan fortsätta navigera efter fel.

## Steg 7: P2 Firebase-integration

När Firebase Emulator Suite är tillgänglig:

- skapa separat config för emulatorer.
- testa auth login/logout.
- testa Firestore security rules.
- testa persistence mellan reloads.
- testa flera användare och isolering av data.
- kör denna svit separat från snabb PR-svit.
- använd aldrig personlig produktionsdatabas eller riktiga tokens.

## CI-körning

PR-kedjan ska vara:

```text
npm run lint
npm run type-check
npm run test:ci
npm run test:e2e
npm run build-only
```

Detta finns samlat i:

```sh
npm run validate
```

CI ska:

- använda Node-versionen från `package.json`.
- installera Playwright Chromium deterministiskt.
- köra med `CI=true` och en worker för stabilitet.
- spara trace, screenshot och video vid testfel.
- inte kräva Firebase-credentials för mock-auth-sviten.
- misslyckas vid coverage under thresholds.

## Definition of Done

Planen är genomförd när:

- alla P0-testfall är implementerade.
- minst ett kritiskt flöde körs på mobil, tablet och desktop.
- listor, mappar och taggar har både store- och E2E-skydd.
- minst en lyckad och en misslyckad väg testas för varje optimistisk write.
- coverage thresholds passerar utan undantag eller exkluderingar som döljer ny kod.
- `npm run validate` passerar i ren miljö.
- varje testfel ger tillräcklig trace/screenshot-information för felsökning.
- dokumentationen beskriver lokala testkommandon och skillnaden mellan mock-auth och emulator-svit.

## Rekommenderad ordning

1. Lägg till task- och list-store-fallen för rollback och state-gränser.
2. Lägg till P0-E2E för completion, important, My Day och listbyte.
3. Lägg till mobiltest för sidomeny och detaljpanel.
4. Lägg till list-/mappflöden.
5. Lägg till kontrollerade felvägar.
6. Höj coverage thresholds stegvis när luckorna är täckta.
7. Inför Firebase Emulator Suite som separat releasekontroll.
