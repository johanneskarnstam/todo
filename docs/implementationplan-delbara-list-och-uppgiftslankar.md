# Implementationsplan: Delbara list- och uppgiftslänkar

## Mål

Varje lista och uppgift ska ha en stabil, unik URL. En inloggad användare ska kunna öppna länken direkt, ladda om sidan och fortfarande se rätt lista eller uppgift. Länkarna ska kunna kopieras och skickas till användarens eget konto eller en annan behörig session.

Planen är avbockningsbar och uppdelad i fristående etapper. Etapperna kan pausas eller avbrytas efter en kontrollpunkt; oavslutade steg ska inte kräva att senare etapper påbörjas.

## Nuläge

- Routern använder `createWebHashHistory`, så URL:er har formen `/#/...`.
- Listinställningar har redan routen `/lists/:listId/settings`.
- Vanlig listnavigering uppdaterar `listStore` och `taskStore`, men öppnar routen `home` utan list-id.
- `HomeView` väljer initial lista från `listStore.selectedListId`; aktiv uppgift kommer från Pinia-state.
- Uppgiftsdetaljer öppnas som panel utan egen route.
- Notisöppning använder query-parametern `?task=...`; den länken måste behållas eller migreras kontrollerat.
- E2E-tester för listor, uppgifter och auth finns i `e2e/lists.spec.ts`, `e2e/tasks.spec.ts` och `e2e/auth-gating.spec.ts`.

## URL-kontrakt

Föreslagen form, kompatibel med befintlig hash-router:

- Lista: `/#/lists/:listId`
- Uppgift: `/#/tasks/:taskId`
- Listinställningar fortsätter använda `/#/lists/:listId/settings`.

Uppgifts-URL:en använder bara uppgiftens id, inte list-id. Då förblir länken stabil om uppgiften flyttas till en annan lista. Listan härleds från uppgiftens aktuella data efter laddning.

## Etapper och kontrollpunkter

### 1. Fastställ routing- och fallbackkontrakt

- [ ] Bekräfta de kanoniska route-namnen `list` och `task` samt URL-formerna ovan.
- [ ] Bestäm visning för okänt eller borttaget list-id respektive task-id: begripligt tomt/fel-läge och säker navigering, aldrig en tyst växling till vald standardlista.
- [ ] Bestäm beteende när task-länken pekar på en uppgift vars lista tagits bort eller som arkiverats.
- [ ] Behåll auth-guard: privata list- och task-länkar ska leda till login när användaren saknar session.
- [ ] Bestäm återgång: webbläsarens Back ska återgå till föregående vy; stängning av detaljpanelen från en direktlänk ska gå till uppgiftens aktuella lista.
- [ ] Bestäm migrering av befintliga notislänkar med `?task=...`: omdirigera till kanonisk task-route eller fortsätt stödja formatet med test.

**Kontrollpunkt:** URL-kontrakt, auth och fallbackbeteende är beslutade innan vyerna ändras. Pausa här om kontraktet behöver produktbeslut.

### 2. Gör routen till källa för aktiv lista

- [ ] Lägg till namngiven route för `/lists/:listId` som återanvänder befintlig huvudvy.
- [ ] Ändra listval från sidomeny, sökresultat, Alla listor och övriga listväljare till att navigera till route med `listId`.
- [ ] Synka route-parametern till `listStore` och `taskStore` efter att autentisering och listladdning är klara.
- [ ] Säkerställ att route-parametern har företräde framför gammalt `selectedListId` från lokal state.
- [ ] Hantera route-byte mellan listor utan att komponenten behöver mountas om.
- [ ] Behåll befintliga smarta vyer, taggroutes och listinställningar utan att ändra deras URL-kontrakt.
- [ ] Säkerställ att reload på `/#/lists/:listId` återställer listan efter asynkron hämtning.

**Kontrollpunkt:** En direktlänk till en lista fungerar vid första öppning, navigation mellan listor och reload.

### 3. Gör routen till källa för aktiv uppgift

- [ ] Lägg till namngiven route för `/tasks/:taskId` som visar uppgiftens detaljpanel.
- [ ] Öppna task-route när en uppgift väljs från vanlig lista, smart vy, taggvy, sök eller Alla listor.
- [ ] Ladda/återställ uppgiften efter auth och taskhämtning; härled sedan dess aktuella lista från task-data.
- [ ] Visa rätt detaljpanel efter direktöppning och reload utan att kräva föregående navigation.
- [ ] Synka stängning, Back/Forward och byte till en annan uppgift med route-state så att panel och URL aldrig divergerar.
- [ ] Hantera task som flyttas efter att en länk kopierats; samma `/tasks/:taskId` ska fortsätta öppna uppgiften.
- [ ] Bevara stöd för befintliga notisöppningar och verifiera att de leder till samma detaljvy.

**Kontrollpunkt:** En task-länk fungerar direkt och efter reload; stängning och webbläsarnavigation återställer en giltig vy.

### 4. Lägg till delningsbara länkkontroller

- [ ] Lägg till en tillgänglig åtgärd för att kopiera listans kanoniska URL från listmenyn.
- [ ] Lägg till en tillgänglig åtgärd för att kopiera uppgiftens kanoniska URL från uppgiftens åtgärdsmeny eller detaljpanel.
- [ ] Bygg kopierad URL från routerns resolved route och aktuell origin/base, aldrig genom manuell strängkonkatenering.
- [ ] Visa ett tydligt statusmeddelande vid lyckad kopiering och begripligt fel vid nekad clipboard-behörighet.
- [ ] Använd Clipboard API i säker kontext; besluta om fallback behövs för webbläsare utan API-stöd.

**Kontrollpunkt:** Kopierade länkar är absoluta, pekar på rätt id och kan öppnas i en ny flik.

### 5. Tester att lägga till eller justera

#### Playwright E2E

- [ ] `e2e/lists.spec.ts`: uppdatera testet för listskapande/listval så URL innehåller listans id.
- [ ] `e2e/lists.spec.ts`: lägg till direktöppning av en list-URL med deterministisk mockdata och verifiera rubrik och uppgifter.
- [ ] `e2e/lists.spec.ts`: ladda om direkt på list-URL och verifiera att samma lista och innehåll visas.
- [ ] `e2e/lists.spec.ts`: verifiera att byte mellan två listor byter URL och inte visar föregående lists uppgifter.
- [ ] `e2e/tasks.spec.ts`: uppdatera testet som öppnar uppgiftsdetaljer så URL innehåller task-id.
- [ ] `e2e/tasks.spec.ts`: öppna `/#/tasks/:taskId` direkt och verifiera rätt titel, lista och detaljpanel.
- [ ] `e2e/tasks.spec.ts`: ladda om task-URL och verifiera att samma uppgift fortfarande visas.
- [ ] `e2e/tasks.spec.ts`: flytta uppgift till annan lista och verifiera att task-URL:en fortfarande fungerar.
- [ ] `e2e/tasks.spec.ts`: verifiera öppna/stänga, Back och Forward samt att URL och synlig panel hålls synkroniserade.
- [ ] `e2e/tasks.spec.ts`: testa kopiera länk med mockad Clipboard API och verifiera exakt route-id.
- [ ] `e2e/auth-gating.spec.ts`: lägg till privata list- och task-URL:er; verifiera redirect till login och återgång till avsedd URL efter inloggning om det är nuvarande auth-kontrakt.
- [ ] Lägg till deterministiska fall för okända/borttagna id:n och för saknad eller borttagen föräldralista.

#### Vitest

- [ ] Lägg till `src/__tests__/router.spec.ts` endast om route-/URL-hjälpare kan testas isolerat utan att duplicera E2E-kontrakt.
- [ ] Om route-parametrar parsas eller valideras i en ny composable/helper: testa giltigt id, saknat id och fallback där.
- [ ] Utöka vid behov `src/__tests__/listStore.spec.ts` och `src/__tests__/taskStore.spec.ts` för laddnings- och lookup-fall som routen använder; testa inte Vue Router genom store-mockar.
- [ ] Behåll befintliga komponenttester för detaljpanelens props/events; lägg bara till route-relaterade assertions där ett faktiskt komponentkontrakt ändras.

#### Testkvalitet

- [ ] Använd `getByRole`, `getByLabel` och synlig text; inga Tailwind-klasser eller DOM-positioner som beteendeselektorer.
- [ ] Använd fasta mock-id:n och isolerade browser contexts; inga personliga Firebase-data.
- [ ] Vänta på URL, rubrik eller panelens synlighet i stället för fasta sleeps.
- [ ] Behåll auth-gating i dess deterministiska testläge och mock-auth för normal E2E.

### 6. Validera och manuellt kontrollera

- [ ] Kör berörda Vitest-filer och nya router-/helpertester.
- [ ] Kör berörda Playwright-filer: listor, uppgifter och auth-gating.
- [ ] Kör `npm run type-check` och `npm run lint`.
- [ ] Kontrollera coverage-gates utan att sänka trösklar eller lägga till undantag.
- [ ] Kör `npm run validate` före merge/release.
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

- [ ] Varje lista har en unik och stabil URL.
- [ ] Varje uppgift har en unik och stabil URL som överlever listflytt.
- [ ] Direktöppning och reload visar rätt objekt efter auth och dataladdning.
- [ ] URL, aktiv vy och synlig detaljpanel hålls synkroniserade vid klick, stängning och Back/Forward.
- [ ] Användaren kan kopiera och dela list- och uppgiftslänkar.
- [ ] Okända id:n, borttagna objekt, auth-redirects och äldre notislänkar har definierat beteende och tester.
- [ ] Samtliga relevanta Vitest-, E2E-, lint-, type-check- och build-gates passerar.