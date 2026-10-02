# Implementationsplan: Delbara list- och uppgiftslänkar

## Mål

Varje lista och uppgift ska ha en stabil, unik URL. En inloggad användare ska kunna öppna länken direkt, ladda om sidan och fortfarande se rätt lista eller uppgift. Länkarna ska kunna kopieras och skickas till användarens eget konto eller en annan behörig session.

Planen är avbockningsbar och uppdelad i fristående etapper. Etapperna kan pausas eller avbrytas efter en kontrollpunkt; oavslutade steg ska inte kräva att senare etapper påbörjas.

## Baslinje vid planstart

- Routern använder `createWebHashHistory`, så URL:er har formen `/#/...`.
- Listinställningar har redan routen `/lists/:listId/settings`.
- Vanlig listnavigering uppdaterar `listStore` och `taskStore`, men öppnar routen `home` utan list-id.
- `HomeView` väljer initial lista från `listStore.selectedListId`; aktiv uppgift kommer från Pinia-state.
- Uppgiftsdetaljer öppnas som panel utan egen route.
- Notisöppning använder query-parametern `?task=...`; den länken måste behållas eller migreras kontrollerat.
- E2E-tester för listor, uppgifter och auth finns i `e2e/lists.spec.ts`, `e2e/tasks.spec.ts` och `e2e/auth-gating.spec.ts`.

## URL-kontrakt

Fastställt kontrakt, kompatibelt med befintlig hash-router:

- Lista: `/#/lists/:listId`
- Uppgift: `/#/tasks/:taskId`
- Listinställningar fortsätter använda `/#/lists/:listId/settings`.

Uppgifts-URL:en använder bara uppgiftens id, inte list-id. Då förblir länken stabil om uppgiften flyttas till en annan lista. Listan härleds från uppgiftens aktuella data efter laddning.

## Etapper och kontrollpunkter

### 1. Fastställ routing- och fallbackkontrakt

- [x] Fastställ namngivna routes `list` och `task` samt URL-formerna ovan.
- [x] Okänt eller borttaget list-/task-id visar ett begripligt not-found-läge medan URL:en bevaras; växla aldrig tyst till standardlistan.
- [x] Om task finns men dess lista saknas, visa tasken ändå och låt stängning gå till startsidan. Arkiverade tasks fortsätter öppnas via task-URL; stängning går till Arkiverade.
- [x] Privata list- och task-routes behåller auth-guard. Login ska bevara avsedd intern route och återgå dit efter lyckad autentisering.
- [x] Öppning av task använder vanlig router-push så Back återgår till föregående vy. Stängning går till taskens aktuella lista, eller enligt arkiverings-/saknad-list-regeln ovan.
- [x] Befintlig `?task=...`-notislänk behålls som kompatibilitetsingång och ersätts med kanonisk task-route efter att auth och task-data laddats.

**Beslut:** Hash-routing behålls. Kanoniska URL:er är `/#/lists/:listId` och `/#/tasks/:taskId`; task-id är globalt och oberoende av lista. Query-parametern för notiser är endast en bakåtkompatibel ingång, inte en kanonisk task-länk.

**Kontrollpunkt:** URL-kontrakt, auth och fallbackbeteende är beslutade innan vyerna ändras. Pausa här om kontraktet behöver produktbeslut.

### 2. Gör routen till källa för aktiv lista

- [x] Lägg till namngiven route för `/lists/:listId` som återanvänder befintlig huvudvy.
- [x] Ändra listval från sidomeny, sökresultat, Alla listor och övriga listväljare till att navigera till route med `listId`.
- [x] Synka route-parametern till `listStore` och `taskStore` efter att autentisering och listladdning är klara.
- [x] Säkerställ att route-parametern har företräde framför gammalt `selectedListId` från lokal state.
- [x] Hantera route-byte mellan listor utan att komponenten behöver mountas om.
- [x] Behåll befintliga smarta vyer, taggroutes och listinställningar utan att ändra deras URL-kontrakt.
- [x] Säkerställ att reload på `/#/lists/:listId` återställer listan efter asynkron hämtning.

**Kontrollpunkt:** En direktlänk till en lista fungerar vid första öppning, navigation mellan listor och reload.

### 3. Gör routen till källa för aktiv uppgift

- [x] Lägg till namngiven route för `/tasks/:taskId` som visar uppgiftens detaljpanel.
- [x] Öppna task-route när en uppgift väljs från vanlig lista, smart vy, taggvy, sök eller Alla listor.
- [x] Ladda/återställ uppgiften efter auth och taskhämtning; härled sedan dess aktuella lista från task-data.
- [x] Visa rätt detaljpanel efter direktöppning och reload utan att kräva föregående navigation.
- [x] Synka stängning, Back/Forward och byte till en annan uppgift med route-state så att panel och URL aldrig divergerar.
- [x] Hantera task som flyttas efter att en länk kopierats; samma `/tasks/:taskId` ska fortsätta öppna uppgiften.
- [x] Bevara stöd för befintliga notisöppningar och verifiera att de leder till samma detaljvy.

**Kontrollpunkt:** En task-länk fungerar direkt och efter reload; stängning och webbläsarnavigation återställer en giltig vy.

### 4. Lägg till delningsbara länkkontroller

- [x] Lägg till en tillgänglig åtgärd för att kopiera listans kanoniska URL från listmenyn och Alla listor-kolumner.
- [x] Lägg till en tillgänglig åtgärd för att kopiera uppgiftens kanoniska URL från detaljpanelen.
- [x] Bygg kopierad URL från routerns resolved route och aktuell origin/base, aldrig genom manuell strängkonkatenering.
- [x] Visa tydligt meddelande vid lyckad kopiering och begripligt fel när clipboard saknas eller nekar åtkomst.
- [x] Använd Clipboard API i säker kontext. Ingen alternativ kopieringsfallback införs; adressfältet finns kvar om API:t nekas.

**Kontrollpunkt:** Kopierade länkar är absoluta, pekar på rätt id och kan öppnas i en ny flik.

### 5. Tester att lägga till eller justera

#### Playwright E2E

- [x] `e2e/lists.spec.ts`: uppdatera testet för listskapande/listval så URL innehåller listans id.
- [x] `e2e/lists.spec.ts`: lägg till direktöppning av en list-URL med deterministisk mockdata och verifiera rubrik och uppgifter.
- [x] `e2e/lists.spec.ts`: ladda om direkt på list-URL och verifiera att samma lista och innehåll visas.
- [x] `e2e/lists.spec.ts`: verifiera att byte mellan två listor byter URL och inte visar föregående lists uppgifter.
- [x] `e2e/tasks.spec.ts`: uppdatera testet som öppnar uppgiftsdetaljer så URL innehåller task-id.
- [x] `e2e/tasks.spec.ts`: öppna `/#/tasks/:taskId` direkt och verifiera rätt titel, lista och detaljpanel.
- [x] `e2e/tasks.spec.ts`: ladda om task-URL och verifiera att samma uppgift fortfarande visas.
- [x] `e2e/tasks.spec.ts`: flytta uppgift till annan lista och verifiera att task-URL:en fortfarande fungerar.
- [x] `e2e/tasks.spec.ts` och `e2e/lists.spec.ts`: verifiera öppna/stänga, Back och Forward samt att URL och synlig panel hålls synkroniserade.
- [x] `e2e/lists.spec.ts` och `e2e/tasks.spec.ts`: verifiera exakt kopierad route-URL med tillåten respektive nekad clipboard.
- [x] `e2e/auth-gating.spec.ts`: lägg till privata list- och task-URL:er; verifiera redirect till login med bevarad avsedd URL.
- [x] Lägg till deterministiska fall för okända list- och task-id:n.
- [x] Lägg till test för en befintlig task vars föräldralista har tagits bort.

#### Vitest

- [x] Testa auth-redirectens interna destinationsval isolerat i `src/__tests__/authRedirect.spec.ts`.
- [ ] Lägg till unit-tester om route-parametrar senare flyttas till en särskild parser/helper.
- [ ] Utöka vid behov `src/__tests__/listStore.spec.ts` och `src/__tests__/taskStore.spec.ts` för laddnings- och lookup-fall som routen använder; testa inte Vue Router genom store-mockar.
- [ ] Behåll befintliga komponenttester för detaljpanelens props/events; lägg bara till route-relaterade assertions där ett faktiskt komponentkontrakt ändras.

#### Testkvalitet

- [x] Använd `getByRole`, `getByLabel` och synlig text; inga Tailwind-klasser eller DOM-positioner som beteendeselektorer.
- [x] Använd fasta mock-id:n och isolerade browser contexts; inga personliga Firebase-data.
- [x] Vänta på URL, rubrik eller panelens synlighet i stället för fasta sleeps.
- [x] Behåll auth-gating i dess deterministiska testläge och mock-auth för normal E2E.

### 6. Validera och manuellt kontrollera

- [x] Kör berörda Vitest-filer och nya router-/helpertester.
- [x] Kör berörda Playwright-filer: listor, uppgifter och auth-gating.
- [x] Kör `npm run type-check` och `npm run lint`.
- [x] Kontrollera coverage-gates utan att sänka trösklar eller lägga till undantag.
- [x] Kör `npm run validate` före merge/release.
- [ ] Kontrollera manuellt direktöppning/reload för lista och task i desktop, mobil, PWA och publicerad Hosting-bas-URL.
- [ ] Kontrollera att delade länkar inte exponerar data för annan användare; auth och Firestore-regler är fortsatt auktoritativa.

## Risker och hantering

| Risk | Hantering |
| --- | --- |
| Store-state skriver över direktlänk efter asynkron laddning | Gör route-parametern auktoritativ och testa med fördröjd deterministisk datahämtning. |
| Task länk innehåller gammalt list-id efter flytt | Använd global task-route `/tasks/:taskId` och härled listan från task-data. |
| Auth-redirect tappar målrouten | Bevara avsedd privat URL genom login och verifiera auth-gating E2E. |
| Okända id:n lämnar panel eller spinner öppen | Definiera explicit not-found/fallback och täck det med E2E. |
| Notisflödet använder äldre `?task=`-format | Migrera med redirect eller behåll kompatibilitet tills notislänkar uppdaterats. |
| Clipboard blockeras av webbläsaren | Visa felstatus och tillåt kopiering från adressfältet; testa permission-fel deterministiskt. |

## Klart när

- [x] Varje lista har en unik och stabil URL.
- [x] Varje uppgift har en unik och stabil URL som överlever listflytt.
- [x] Direktöppning och reload visar rätt objekt efter auth och dataladdning.
- [x] URL, aktiv vy och synlig detaljpanel hålls synkroniserade vid klick, stängning och Back/Forward.
- [x] Användaren kan kopiera och dela list- och uppgiftslänkar.
- [x] Okända id:n, borttagna objekt, auth-redirects och äldre notislänkar har definierat beteende och tester.
- [x] Samtliga relevanta Vitest-, E2E-, lint-, type-check- och build-gates passerar.