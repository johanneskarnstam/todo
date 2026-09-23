# Implementationsplan: Subtask-indikator (X/Y)

## Mål

Visa `(X/Y)` intill taskens titel i listvyn när tasken har subtasks, där `X` är antalet klara subtasks och `Y` är det totala antalet.

Indikatorn ska fungera för både aktiva och avslutade tasks, uppdateras efter lokala ändringar och kunna läsas från Firestores lokala cache.

## Beslut och avgränsningar

- Alla hämtade steps lagras i en separat `allSteps`-state. Den får inte blandas ihop med aktiv task.
- `activeSteps` härleds genom att filtrera `allSteps` på `activeTaskId`.
- `taskStepCounts` härleds reaktivt från `allSteps` och returnerar en `Map` med `{ completed, total }` per `taskId`.
- Eftersom steps ligger i en subcollection under varje task hämtas de per task med `getDocs`. Vid nätverksfel används `getDocsFromCache` för samma subcollection.
- Lokala create/toggle/update/delete-operationer uppdaterar `allSteps` optimistiskt. Full Firestore-lyssning med `onSnapshot` ingår inte i denna version.
- Tasks utan steps får ingen indikator. Tasks med steps visar även `(0/Y)`.

## Genomförande

### 1. Store: gemensam step-state

- [x] Byt intern state från en aktiv-task-bunden `steps`-lista till `allSteps`.
- [x] Behåll publika `steps`-API:t som alias för befintliga komponenter.
- [x] Gör `activeSteps` till en computed-filtrering av `allSteps`.
- [x] Säkerställ att byte eller stängning av aktiv task inte tömmer `allSteps`.

### 2. Store: hämtning och offline-stöd

- [x] Implementera per-task-hämtning för alla laddade tasks.
- [x] Använd `getDocs` först och `getDocsFromCache` per task som fallback.
- [x] Samla resultaten utan att ersätta lokala optimistiska ändringar med en tom lista.
- [x] Anropa hämtningen både efter vanlig task-hämtning och efter task-cache-fallback.
- [x] Hantera fel utan att förlora redan tillgängliga tasks eller steps.

### 3. Store: räknare och mutationer

- [x] Lägg till `taskStepCounts` som computed `Map<string, StepCount>`.
- [x] Exponera `taskStepCounts` från store-returen.
- [x] Uppdatera create, toggle, update och delete för steps så att de ändrar `allSteps`.
- [x] Säkerställ att optimistisk rollback återställer rätt step och att räknaren ändras direkt.

### 4. UI: indikator

- [x] Lägg till valfri `stepCount`-prop i `TaskRow`.
- [x] Visa indikatorn endast när `stepCount.total > 0`, intill titeln.
- [x] Lägg till tillgängligt namn för räknaren.
- [x] Skicka rätt räknare från `HomeView` till både aktiva och avslutade taskrader.

### 5. Tester

- [x] Testa `taskStepCounts` för flera tasks med 0, delvis och helt klara steps.
- [x] Testa att aktiv task-växling inte tar bort räknare för andra tasks.
- [x] Testa att create, toggle och delete uppdaterar räknaren optimistiskt.
- [x] Testa `TaskRow` med och utan indikator.
- [x] Testa cache-fallback för steps.

### 6. Validering

- [x] Kör `npm run test:ci`.
- [x] Kör `npm run type-check`.
- [x] Kör `npm run lint`.
- [x] Kör `npm run build-only`.
- [ ] Kontrollera manuellt både aktiva och avslutade tasks med steps.

## Risker och hantering

| Risk | Hantering |
| --- | --- |
| Många tasks ger många Firestore-läsningar | Begränsa hämtningen till laddade tasks och använd cache-fallback; överväg senare en denormaliserad räknare eller collection group-query. |
| Aktiv task raderar data för andra indikatorer | Separera `allSteps` från `activeSteps`. |
| Cache saknar en task eller dess steps | Behåll befintlig state och rapportera felet utan att tömma listan. |
| Externa ändringar syns inte omedelbart | Dokumenterat som avgränsning; `onSnapshot` kan läggas till i en separat ändring. |

## Klart när

- [ ] Indikatorn visas korrekt för alla taskrader.
- [x] Alla automatiska tester passerar.
- [x] Type-check, lint och build passerar.
- [ ] Manuell offline-kontroll är genomförd.