# Implementationsplan: Inställningar per lista

## 1. Målbild

Varje lista ska ha en egen inställningssida där listans beteende kan konfigureras. Den första inställningen är uppgiftssortering. Sidan ska även kunna ange om listan använder två uppgiftslägen eller tre uppgiftslägen.

Användaren ska kunna:

- öppna inställningar för den aktiva listan
- välja sortering för just den listan
- välja om uppgifter i listan har två lägen (`att göra` och `klart`) eller tre lägen (`att göra`, `pågående` och `klart`)
- se samma sortering efter omladdning, inloggning och på andra enheter
- använda listinställningar utan att smartvyer som Min dag, Stjärnmärkt och Planerat får fel sorteringslogik
- fortsätta använda befintliga listor och befintliga användarpreferenser utan manuell migration

### Avgränsning för första versionen

I första versionen implementeras endast listinställningar för sortering och uppgiftsstatus. Följande lämnas till senare iterationer:

- listans standardvy, exempelvis lista eller tavla
- andra inställningar för visning av slutförda uppgifter än de som krävs av statusläget
- färg och ikon, som redan delvis finns på listan
- påminnelse- och notisinställningar
- arkivering eller andra listlivscykelinställningar

## 2. Nulägesanalys

### Datamodell

- `List` i `src/types/index.ts` innehåller namn, mapp, ikon, ordning, skapelsedatum och färg.
- `Task` har redan `order?: number`, vilket används för manuell sortering.
- `Task` har i dag ett binärt statusfält, `completed: boolean`. `Step` är en separat delstegsmodell och ska inte återanvändas för uppgiftens övergripande status.
- Listor sparas som dokument i `users/{userId}/lists` och uppgifter i `users/{userId}/tasks`.
- `listStore.updateList` har redan optimistisk uppdatering, mock-persistens och Firestore-persistens.

### Nuvarande sorteringsflöde

1. `usePreferences` sparar den globala preferensen `taskSort` i `localStorage` under `todo-preferences`.
2. `SettingsView.vue` visar den globala inställningen under **Uppgifter**.
3. `HomeView.vue` läser `preferences.taskSort` och sorterar `filteredVisibleTasks`.
4. `taskStore.activeTasks` och `completedTasks` sorterar först efter `Task.order` och faller sedan tillbaka på `createdAt`.
5. Den globala sorteringen påverkar i praktiken listvyer och smartvyer genom samma computed-kedja.

### Befintlig UI-yta

`HomeView.vue` har redan menyn **Fler listalternativ** för den aktiva listan. Den innehåller namnbyte, färg och borttagning. Den kan användas som ingång till den nya inställningssidan, men sorteringsinställningen bör ligga på en egen vy för att skapa plats för fler listinställningar.

### Testyta

- Unit-tester finns för `listStore`, `taskStore`, preferenser och komponenter.
- E2E-tester finns för listor, uppgifter, inställningar, sökning, responsivitet och omsortering.
- Mock-auth använder localStorage och är lämplig för att testa migration och persistence utan Firebase-credentials.

## 3. Beslut om global sortering

### Rekommendation

Flytta sorteringsvalet från den globala användarpreferensen till varje `List`-dokument.

Behåll däremot en global `taskSort` tillfälligt som **legacy/fallback**, inte som aktiv källa för listvyer:

- nya listor får `sortMode: 'manual'` som explicit standard
- befintliga listor utan `sortMode` använder den tidigare globala `taskSort` första gången de läses in, eller `manual` om den globala preferensen saknas
- den valda fallbacken materialiseras till listan vid nästa skrivning eller genom en kontrollerad migrering
- smartvyer och taggvyer använder fortsatt sin egen sorteringslogik och ska inte läsa listans sorteringsinställning
- när migrationen är genomförd kan den globala inställningen tas bort från Settings-vyn och `usePreferences`

Detta undviker att en användare som ändrar sortering i en lista oavsiktligt ändrar alla andra listor, samtidigt som befintliga användares beteende inte bryts vid uppgradering.

### Sorteringsvärden

Återanvänd befintliga värden och typer:

- `manual`: `Task.order`, med `createdAt` som tie-breaker
- `created`: äldsta skapade först
- `dueDate`: tidigaste förfallodatum först, uppgifter utan datum sist
- `priority`: viktiga uppgifter först, därefter befintlig stabil ordning

Namnet på fältet bör vara `sortMode` på `List`, inte `taskSort`, eftersom inställningen tillhör listan och kan utökas med fler listinställningar senare.

## 4. Beslut om uppgiftsstatus

### Rekommendation

Lägg till en listinställning `taskStatusMode` med värdena `binary` och `threeStep`.

- `binary`: uppgiften kan vara `todo` eller `completed` och motsvarar dagens beteende.
- `threeStep`: uppgiften kan vara `todo`, `inProgress` eller `completed`.
- nya listor börjar med `binary` för att inte ändra befintligt beteende utan ett aktivt val.
- listans läge styr vilka statuskontroller som visas, men statusen sparas på uppgiften.

Inför `Task.status?: TaskStatus` stegvis och behåll `completed` under migrationen. Vid läsning utan `status` tolkas `completed: false` som `todo` och `completed: true` som `completed`. Under övergången ska skrivningar uppdatera både `status` och `completed`, där `completed` är `true` endast när status är `completed`.

På så sätt kan gamla dokument läsas, nya UI-flöden testas isolerat och befintliga smartvyer fortsätta fungera medan statuslogiken flyttas.

## 5. Föreslagen datamodell och API

### 4.1 Typer

Lägg till en central typ i `src/types/index.ts`:

```ts
export type ListSortMode = 'manual' | 'created' | 'dueDate' | 'priority'

export type TaskStatus = 'todo' | 'inProgress' | 'completed'

export type TaskStatusMode = 'binary' | 'threeStep'
```

Utöka `List`:

```ts
sortMode?: ListSortMode
```

Fältet är initialt valfritt för bakåtkompatibilitet med befintliga Firestore-dokument. När migrationen är färdig kan det göras obligatoriskt i typerna om all data garanteras ha fältet.

Utöka `List` med:

```ts
sortMode?: ListSortMode
taskStatusMode?: TaskStatusMode
```

Utöka `Task` med:

```ts
status?: TaskStatus
```

`status` är initialt valfritt av samma bakåtkompatibilitetsskäl. Lägg till små centrala hjälpfunktioner, exempelvis `getTaskStatus(task)` och `isTaskCompleted(task)`, så att fallbacken inte implementeras olika i `HomeView`, stores och komponenter.

### 5.2 List-store

Utöka `ListUpdate` i `src/stores/listStore.ts` så att `sortMode` kan uppdateras.

Lägg till en explicit action, exempelvis:

```ts
const updateListSortMode = (listId: string, sortMode: ListSortMode) => {
  void updateList(listId, { sortMode })
}
```

Alternativt kan vyerna anropa `updateList` direkt, men en namngiven action gör ägarskapet tydligare och ger en stabil testyta för framtida listinställningar.

Säkerställ att följande inkluderar `sortMode`:

- optimistic create i `createList`
- Firestore-data i `setDoc` vid skapande och återställning efter borttagning
- mock-persistens
- eventuell export/import av data
- fetch-mappning, utan att skriva över ett värde som redan finns

Nya listor ska sätta `sortMode: 'manual'`.

Lägg även till `taskStatusMode` i `ListUpdate`, nya listor och alla listskrivningar. Nya listor ska sätta `taskStatusMode: 'binary'`.

Lägg till en namngiven action, exempelvis `updateListTaskStatusMode(listId, mode)`, med samma optimistiska rollback som övriga listinställningar.

### 5.3 Sorteringsfunktion

Flytta den delade sorteringslogiken från `HomeView.vue` till en liten testbar funktion, exempelvis i `src/stores/taskStore.ts` eller en ny `src/utils/taskSorting.ts`.

Funktionen ska ta emot uppgifter och sorteringsläge:

```ts
sortTasksForMode(tasks, sortMode)
```

Regler:

- sorteringen ska inte mutera den inkommande arrayen
- `manual` ska använda `order` och därefter `createdAt`
- `created` ska ha en stabil tie-breaker
- `dueDate` ska sortera saknade datum sist och tåla både sträng och `Timestamp`
- `priority` ska behålla deterministisk ordning när `important` är lika
- sorteringen ska vara gemensam för aktiva och slutförda uppgifter, med samma avgränsningar som idag

Undvik att lägga listans sorteringsläge i `TaskView`. Det är en egenskap hos listan, inte hos den tillfälligt valda vyn.

## 5. Detaljerad implementation

Varje fas ska avslutas med en körbar kontroll innan nästa fas påbörjas. På så sätt kan sorteringsändringen och statusändringen utvecklas separat och fel lokaliseras nära den ändring som orsakade dem.

### Genomföranderegel för varje fas

- [ ] Implementera endast den fasens datamodell eller beteende.
- [ ] Lägg till eller uppdatera ett fokuserat unit-test.
- [ ] Kör testet tillsammans med `npm run type-check`.
- [ ] Kontrollera mock-auth-flödet manuellt eller med ett fokuserat E2E-test när fasen ändrar UI eller routing.
- [ ] Fortsätt först när befintliga tester och den nya fasens test passerar.

### Fas 1: Datamodell och migration

- [ ] Lägg till `ListSortMode` och `List.sortMode` i `src/types/index.ts`.
- [ ] Lägg till `TaskStatus`, `TaskStatusMode`, `Task.status` och `List.taskStatusMode` i `src/types/index.ts`.
- [ ] Utöka `ListUpdate` med `sortMode`.
- [ ] Utöka `ListUpdate` med `taskStatusMode` och lägg till explicit update-action.
- [ ] Sätt `sortMode: 'manual'` när en ny lista skapas.
- [ ] Sätt `taskStatusMode: 'binary'` när en ny lista skapas.
- [ ] Bevara `sortMode` vid Firestore-skrivning, återställning av borttagen lista och mock-persistens.
- [ ] Bevara `taskStatusMode` vid Firestore-skrivning, återställning av borttagen lista och mock-persistens.
- [ ] Lägg till `status` vid skapande av nya uppgifter och skriv även kompatibla `completed`-värden.
- [ ] Lägg till `getTaskStatus(task)` och `isTaskCompleted(task)` och ersätt gradvis direkta statusantaganden i store-logiken.
- [ ] Definiera en migreringsfunktion som väljer listans initiala sortering:
  - befintligt `list.sortMode` vinner
  - annars används giltigt `preferences.taskSort`
  - annars används `manual`
- [ ] Bestäm om migrationen ska vara lazy vid läsning eller köras explicit en gång. Rekommendation: lazy fallback vid läsning och skrivning först när användaren öppnar/sparar listinställningen, eftersom det minimerar samtidiga Firestore-skrivningar.
- [ ] Dokumentera att global `taskSort` är legacy under övergången.
- [ ] Kör fasens fokuserade store- och typkontroller innan UI-arbetet fortsätter.

### Fas 2: Flytta sorteringsansvaret

- [ ] Skapa eller extrahera en ren sorteringsfunktion med tester för alla fyra lägen.
- [ ] Ändra `HomeView.vue` så att listvyer läser `activeList.sortMode`.
- [ ] Låt smartvyer och taggvyer använda en explicit sorteringsstrategi som inte kräver en aktiv lista.
- [ ] Kontrollera att `filteredActiveTasks` och `filteredCompletedTasks` fortfarande använder samma filtrering som idag efter att sorteringskällan flyttats.
- [ ] Kontrollera att manuell drag-and-drop endast används när listans effektiva sortering är `manual`. Vid andra lägen ska drag-handtag och keyboard-reorder döljas eller vara avaktiverade.
- [ ] Säkerställ att byte till `manual` inte skriver om befintliga `Task.order` i onödan. Den befintliga ordningen ska visas direkt.
- [ ] Ta bort aktiv användning av `preferences.taskSort` i listvyer.
- [ ] Ändra `activeTasks`, `completedTasks`, antal och completed-sektioner så att de använder `isTaskCompleted` i stället för att läsa `completed` direkt.
- [ ] Lägg till `setTaskStatus(taskId, status)` i `taskStore` med optimistic update, rollback och skrivning av både `status` och `completed` under migrationen.
- [ ] Säkerställ att `binary`-listor endast kan växla mellan `todo` och `completed`.
- [ ] Säkerställ att `threeStep`-listor kan växla mellan `todo`, `inProgress` och `completed`.
- [ ] Definiera hur `inProgress` visas i aktiva listor, smartvyer, sökresultat och completed-sektionen: den ska räknas som aktiv och inte som slutförd.
- [ ] Kör statusmigreringstester innan statuskontrollerna läggs till i komponenterna.

### Fas 3: Listans inställningssida

- [ ] Skapa `src/views/ListSettingsView.vue` med `<script setup lang="ts">`.
- [ ] Lägg till en route som innehåller listans id, exempelvis `/lists/:listId/settings`.
- [ ] Lägg till en tydlig tillbaka-navigering till den aktuella listan.
- [ ] Visa listans namn och befintlig listfärg/ikon där det passar, men duplicera inte redan färdig funktionalitet i onödan.
- [ ] Lägg till sektionen **Uppgifter** med en select eller radiogrupp för sorteringsläge.
- [ ] Lägg till sektionen **Arbetsflöde** med valet **Två lägen** eller **Tre lägen**.
- [ ] Beskriv trelägesvalet konkret: uppgiften kan vara **Att göra**, **Pågående** eller **Klart**.
- [ ] Använd tillgängliga etiketter och beskrivningar för:
  - Min ordning
  - Skapade först
  - Förfallodatum
  - Prioritet
- [ ] Använd tydliga statusetiketter och kontrollera att statusväljaren är användbar med tangentbord och skärmläsare.
- [ ] Spara ändringen optimistiskt genom `listStore.updateListSortMode`.
- [ ] Spara arbetsflödesvalet genom `listStore.updateListTaskStatusMode`.
- [ ] Visa fel från store och återställ värdet om skrivningen misslyckas.
- [ ] Lägg till loading/empty-state om listan saknas eller ännu inte är laddad.
- [ ] Se till att sidan fungerar på mobil och desktop och använder projektets befintliga mörka tema.
- [ ] Visa en varning eller tydlig konsekvens om en lista byter från `threeStep` till `binary` medan uppgifter är `inProgress`; rekommendation: konvertera dem till `todo` och bekräfta innan ändringen sparas.

### Fas 4: Navigering och befintlig meny

- [ ] Lägg till **Listinställningar** i menyn **Fler listalternativ** i `HomeView.vue`.
- [ ] Stäng menyn innan navigering.
- [ ] För över korrekt list-id från den aktiva listvyn.
- [ ] Hantera default-listan `__default__` på samma sätt som andra listor; den ska få inställningar även om den inte kan tas bort.
- [ ] Behåll namnbyte, färg och borttagning fungerande under den nya navigeringen.
- [ ] Lägg till route-gating så att smartvyer och taggvyer inte visar listinställningar.
- [ ] Lägg till statuskontroll i `TaskRow.vue`: visa en enkel completed-kontroll i `binary`-läge och en statusmeny/segmenterad kontroll i `threeStep`-läge.
- [ ] Visa statusen **Pågående** tydligt utan att använda samma visuella signal som **Klart**.
- [ ] Säkerställ att statusbyte inte öppnar uppgiftens detaljpanel oavsiktligt och fungerar med touch, mus och tangentbord.

### Fas 5: Global Settings-migrering

- [ ] Ändra texten och beteendet i `SettingsView.vue` så att `taskSort` inte längre presenteras som en aktiv global inställning.
- [ ] Under övergångsperioden kan inställningen visas som migrerad eller tas bort, men den får inte längre ändra sorteringen i alla listor.
- [ ] Uppdatera `usePreferences.ts`:
  - behåll läsning av `taskSort` tills migrationen är säker
  - lägg till validering för legacy-data
  - ta bort fältet först när ingen kod längre behöver det
- [ ] Uppdatera eventuell reset-funktion så att den inte återställer listors egna inställningar.
- [ ] Kontrollera att rensning av lokala data inte lämnar en blandning där global sortering återigen tar över listans värde.
- [ ] Kontrollera att `taskStatusMode` och `Task.status` inte återställs av den globala preferensens reset-funktion.

## 6. Testplan

### Unit-tester

- [ ] Testa att varje `ListSortMode` ger rätt ordning.
- [ ] Testa att `TaskStatus` accepterar `todo`, `inProgress` och `completed`.
- [ ] Testa att gamla uppgifter utan `status` mappas från `completed: false` till `todo` och från `completed: true` till `completed`.
- [ ] Testa att `isTaskCompleted` endast returnerar `true` för `completed`.
- [ ] Testa att `inProgress` ligger bland aktiva uppgifter och inte bland slutförda.
- [ ] Testa att `binary`-läge inte tillåter eller sparar `inProgress`.
- [ ] Testa att `threeStep`-läge sparar alla tre statusvärdena.
- [ ] Testa tie-breakers för lika skapelsedatum, lika prioritet och lika/missing förfallodatum.
- [ ] Testa att sorteringsfunktionen inte muterar input.
- [ ] Testa `listStore.createList` med `sortMode: 'manual'`.
- [ ] Testa `updateListSortMode` i mock-läge och att värdet återfinns efter re-initialisering.
- [ ] Testa att ett befintligt listdokument utan `sortMode` får rätt fallback från legacy `taskSort`.
- [ ] Testa att ett explicit listvärde alltid vinner över global legacy-preferens.
- [ ] Testa rollback när uppdatering av listans sorteringsläge misslyckas.
- [ ] Testa `updateListTaskStatusMode` i mock-läge och rollback vid skrivfel.
- [ ] Testa att byte från `threeStep` till `binary` hanterar `inProgress` enligt den valda regeln.
- [ ] Uppdatera berörda komponenttester för att kontrollera att drag-and-drop är tillgängligt endast vid `manual`.
- [ ] Uppdatera komponenttester för att kontrollera rätt statuskontroll i två- respektive trelägeslistor.

### E2E-tester

Lägg till eller utöka en spec, exempelvis `e2e/list-settings.spec.ts`:

- [ ] Öppna listinställningar från en aktiv lista.
- [ ] Byt sortering till **Skapade först** och verifiera uppgiftsordningen.
- [ ] Byt sortering till **Förfallodatum** och verifiera att uppgifter utan datum hamnar sist.
- [ ] Byt sortering till **Prioritet** och verifiera viktiga uppgifter först.
- [ ] Byt till **Min ordning**, använd keyboard- eller pointer-reorder och verifiera att ordningen bevaras.
- [ ] Öppna listinställningar och välj **Tre lägen**.
- [ ] Ändra en uppgift från **Att göra** till **Pågående** och verifiera att den ligger kvar bland aktiva uppgifter.
- [ ] Ändra samma uppgift till **Klart** och verifiera att den flyttas till slutförda uppgifter.
- [ ] Ladda om sidan och verifiera att **Pågående** eller **Klart** bevaras.
- [ ] Byt till en annan lista med **Två lägen** och verifiera att trestatuskontrollen inte visas där.
- [ ] Verifiera att växling från tre lägen till två lägen hanterar befintliga **Pågående**-uppgifter enligt den dokumenterade regeln.
- [ ] Ladda om sidan och verifiera att listans val finns kvar.
- [ ] Byt till en annan lista och verifiera att den har eget sorteringsläge.
- [ ] Verifiera att smartvyer inte visar eller påverkas av listans inställning.
- [ ] Verifiera migration från en gammal global `taskSort` i mock-auth-läge.
- [ ] Verifiera mobil layout och tillbaka-navigering.

## 7. Berörda filer

| Fil | Ändring |
|-----|---------|
| `src/types/index.ts` | Ny `ListSortMode` och `List.sortMode` |
| `src/stores/listStore.ts` | Persistens, defaultvärden, update-actions och migration/fallback |
| `src/stores/taskStore.ts` eller `src/utils/taskSorting.ts` | Statusnormalisering, `setTaskStatus`, aktiv/slutförd-filtrering, kompatibla skrivningar och delad sorteringslogik |
| `src/views/HomeView.vue` | Läs listans sortering, separera smartvyer och villkora reorder |
| `src/views/ListSettingsView.vue` | Ny inställningssida |
| `src/components/TaskRow.vue` | Två- och trelägeskontroll för uppgiftsstatus |
| `src/router/index.ts` | Ny route för listinställningar |
| `src/views/SettingsView.vue` | Ta bort eller märka global sortering som legacy |
| `src/composables/usePreferences.ts` | Legacy-läsning och slutlig borttagning av `taskSort` |
| `src/components/TodoSidebar.vue` | Endast om en direkt länk till listinställningar behövs |
| `src/__tests__/listStore.spec.ts` | Datamodell, migration och persistens |
| `src/__tests__/taskStore.spec.ts` | Sorteringsregler och reorder-regressioner |
| `src/__tests__/taskComponents.spec.ts` | UI-state för sortering och två-/trelägesstatus |
| `e2e/list-settings.spec.ts` | Nytt användarflöde och persistence |
| `e2e/tasks.spec.ts` eller `e2e/task-reorder.spec.ts` | Reorder-regressioner med listans sorteringsläge |

## 8. Risker och beslutspunkter

| Risk | Mitigering |
|------|-----------|
| Befintliga listor saknar `sortMode` | Läs legacy global sortering som fallback och skriv inte massvis av dokument vid första deploy |
| Global sortering fortsätter påverka vissa listvyer | Sök efter alla `preferences.taskSort`-referenser och testa listbyte i E2E |
| Drag-and-drop blandas med datum- eller prioritetssortering | Aktivera reorder endast när effektivt läge är `manual` |
| Smartvyer saknar aktiv lista | Ge smartvyer en egen explicit sorteringsstrategi och undvik `activeList!` |
| Offline-ändring syns men sparas inte | Återanvänd `listStore` optimistic rollback och visa befintligt toast/error-flöde |
| Flera enheter skriver olika listinställningar | Låt Firestore vara källa efter fetch; dokumentera last-write-wins för denna första version |
| Fältet behöver utökas senare | Använd `sortMode` på `List` och håll listinställningar samlade i samma dokument |
| `completed` och `status` hamnar ur synk | Använd centrala statushelpers och skriv båda fälten i övergångsfasen; lägg regressionstest för alla statusbyten |
| Statusändring till `inProgress` försvinner ur aktiva vyer | Definiera `isTaskCompleted` som enda väg till completed-filtrering och testa smartvyer/sökning |
| Byte till två lägen lämnar ogiltiga `inProgress`-uppgifter | Kräv bekräftelse och konvertera deterministiskt till `todo` innan listinställningen ändras |
| Trestatus blandas ihop med delsteg | Behåll `Step` som separat modell och använd namnet `TaskStatus` för uppgiftens övergripande status |

## 9. Leveransordning

1. [ ] Lägg till typer, listfält och list-store-persistens för sortering och statusläge.
2. [ ] Lägg till statushelpers och kompatibel `Task.status`-läsning utan att ändra UI.
3. [ ] Lägg till `setTaskStatus` och testa två-/trestatuslogiken i store.
4. [ ] Extrahera och testa sorteringsfunktionen.
5. [ ] Flytta listvyer från global sortering till `activeList.sortMode`.
6. [ ] Lägg till route och `ListSettingsView.vue` med båda inställningarna.
7. [ ] Länka från listans alternativmeny och verifiera routing.
8. [ ] Lägg till statuskontroller i `TaskRow.vue` och verifiera aktiv/slutförd rendering.
9. [ ] Begränsa drag-and-drop och keyboard-reorder till manuell sortering.
10. [ ] Migrera eller ta bort den globala inställningen i Settings.
11. [ ] Lägg till och uppdatera unit- och E2E-tester för migration, listisolering och trestatusflödet.
12. [ ] Kör `npm run type-check && npm run lint`.
13. [ ] Kör `npm run validate` när hela flödet är klart och miljön stödjer det.

## 10. Versionering

Detta är bakåtkompatibel ny funktionalitet och bör normalt ge en minor-version, exempelvis `0.14.x` till `0.15.0`, enligt projektets versionspolicy.
