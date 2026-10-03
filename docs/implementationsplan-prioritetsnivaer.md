# Implementationsplan: Prioritetsnivåer utöver Viktig

## Mål

Erätta eller komplettera den binära markeringen för viktiga uppgifter med ett tydligt prioritetssystem som stödjer låg, normal, hög och brådskande. Målet är att användaren enklare ska kunna prioritera uppgifter när många är konkurrerande om uppmärksamheten, utan att det blir ett extra steg i varje användarflöde.

Planen ska passa den befintliga appmodellen där uppgifter idag har ett enkelt `important`-fält, och samtidigt hålla det möjligt att fortsätta sortera, filtrera och visa uppgifter på ett konsekvent sätt.

## Beslut och avgränsningar

- Den nuvarande booleska `important`-flaggan ersätts inte direkt i ett svepande migreringssteg för alla användare; den hanteras via en kompatibilitetsfas.
- Nya prioriteringar ska stödja minst: `low`, `normal`, `high`, `urgent`.
- Prioriteten används både för visuell indikation, sortering och filtrering i listor och smarta vyer.
- Ett tidigare `important`-flaggat läge kan mappas till `high` för att undvika stora förändringar i användarnas nuvarande arbetsflöde.
- Implementeringen ska vara bakåtkompatibel med aktuella Firestore-dokument och lokala state-samlingar.
- Appen ska fortsätta använda optimistiska uppdateringar och lokal cache som i övriga task-flöden.

## Genomförande

### 1. Datamodell och migrering

- Lägg till en prioritetstyp i den centrala typen för task i `src/types/index.ts`, exempelvis:
  - `priority: 'low' | 'normal' | 'high' | 'urgent'`
- Behåll `important` som ett kompatibilitetsfält under en övergångsperiod, och mappa det till prioritet enligt:
  - `true` -> `high`
  - `false` -> `normal`
- Sätt `normal` som default för nya uppgifter om användaren inte väljer en annan nivå.
- När task läses från Firestore ska en äldre dokumentstruktur omvandlas till den nya modellen i store-lagret innan den skickas till UI.
- Dokumentera migreringsregeln så att gamla tasks fortfarande visas korrekt i befintliga vyer.

### 2. Store- och task-API

- Utöka `Task`-operationerna i `taskStore` så att `setPriority`, `toggleImportant` eller `updateTask` kan acceptera både gamla och nya värden.
- Ta bort eller deprecera den gamla "stjärna som enda prioritet"-logiken så att den förvandlas till en enda prioritetssignal.
- Lägg till beräknade värden för:
  - `task.priority`
  - `task.important` som kompatibilitetsalias
  - `priorityCounts` för smarta vyer eller listinställningar.
- Säkerställ att optimistiska ändringar återställs korrekt om Firestore-uppdateringen felar.

### 3. UI: visuell representation

- Ersätt eller komplettera stjärnmarkeringen med en enkel färg- och textbaserad indikator:
  - låg = grå / neutral
  - normal = blå / standard
  - hög = orange / viktigt
  - brådskande = röd / högsta prioritet
- Visa prioriteten i listvyn intill taskens titel eller exempelvis i en liten etikett.
- Behåll stjärnmarkeringen som en snabbåtkomst för "viktigt" om den fortfarande behövs, men koppla den till `high` som standard.
- Se till att tillgängliga etiketter har tydliga namn för skärmläsare, exempel: "Hög prioritet" och "Brådskande".

### 4. Sortering och filtrering

- Utvidga `src/utils/taskSorting.ts` så att sorteringen för prioritet använder en ordningslista istället för ett booleskt värde:
  - urgent > high > normal > low
- Den nuvarande `priority`-sortering bör inte bara sortera "viktiga före övriga"; den ska kunna visa samtliga nivåer i en stabil ordning.
- Lägg till filter i sök- och listvyer för att visa:
  - alla
  - låg
  - normal
  - hög
  - brådskande
- Se till att filtrering fungerar både i listvyer och med smarta vyer, inklusive "Viktigt" som förkortning för hög/urgent.

### 5. Smarta vyer och visuell hierarki

- Utvidga den smarta vyn "Viktigt" så att den visar både `high` och `urgent`.
- Möjliggör senare en egen smart vy för "Brådskande" om det behövs, men håll initial version enkel.
- Om applikationen har en lista för "Min dag" eller "Planerad" ska prioritet påverka visuell makt utan att ändra den underliggande tasklogiken.
- Prioriteten bör kunna användas vid sortering i "Alla listor" och i detaljvyn utan att skapa extra användarflöden.

### 6. Tester

- Lägg till unit-tester för prioritetens mappning:
  - `important: true` -> `high`
  - `important: false` -> `normal`
  - `low`, `normal`, `high`, `urgent` behålls korrekt i state.
- Testa sortering:
  - `urgent` visas först, sedan `high`, därefter `normal` och `low`.
  - avslutade tasks förblir under aktiva tasks i samma prioritet.
- Testa filtrering och smart-vyer:
  - "Viktigt" visar `high`+`urgent`
  - filter för en enskild prioritet visar bara rätt uppgifter.
- Testa UI-beteende:
  - korrekta etiketter
  - tillgänglig text
  - rätt färgklass

### 7. Validering

- Kör `npm run type-check`
- Kör `npm run lint`
- Kör relevanta Vitest-sviter för task-sorting, taskStore och UI-komponenter
- Kontrollera manuell visning i listvyerna för att verifiera att prioritet visas korrekt i både mobil och desktop

## Förslag på hur det kan implementeras

### Alternativ A: Minimal, låg risk

Det mest konservativa alternativet är att bygga vidare på den nuvarande `important`-logik utan att bryta data.

- `Task` får ett nytt `priority`-fält.
- `important` finns kvar som kompatibilitetsfält.
- `toggleImportant()` konverteras till att sätta `priority = task.priority === 'high' ? 'normal' : 'high'`.
- UI visar både star och etikett, där stjärnan bara är en genväg för "hög".

Fördelar:
- Låg risk
- Snabb implementering
- Minimal UI-ändring

Nackdelar:
- Begränsar användaren till ett "viktigt"-synsätt i praktiken
- Kräver fortsatt kompatibilitetslogik under lång tid

### Alternativ B: Nyckel för prioritet, starkare modell

Här ersätts `important` helt med en prioritetsstruktur i Task-modelen.

- `priority` är den enda källan till sanning.
- `important` tas bort från objektet efter migrering och från store-API.
- Appen visar ordnade nivåer i listvyer, sortera på prioritet och filtrera via drop-down eller chip-list.

Fördelar:
- Renare modell
- Bättre för framtida funktioner
- Lättare att utöka med exempelvis `urgent` och `low`

Nackdelar:
- Större ändring i state, UI och tests
- Kräver migration för befintliga data

### Alternativ C: Tackla prioritet som ett separerat koncept

Prioritet och "stjärnmarkering" behandlas som två olika idéer:

- `important` används för personlig snabbmarkering eller favorit
- `priority` används för arbetsprioritering

Detta gör det möjligt att ha en uppgift som är viktig för användaren men inte nödvändigtvis högsta prioritet i arbetet.

Fördelar:
- Mer flexibel
- Bättre för riktigt stora listor och arbetsflöden

Nackdelar:
- Mer komplex logik
- Risk för förvirring om användaren inte förstår skillnaden

### Rekommenderad riktning

Det mest realistiska alternativet för denna app är Alternativ A som första steg, med en tydlig plan för att senare gå mot Alternativ B.

Det ger:
- snabb nytta
- liten risk för regressionsfel
- tydlig path från nuvarande booleska `important` till ett mer komplett prioritetssystem
- förutsättningar för att senare lägga till filter, sortering och bättre prioritering i den dagliga användningen

## Risker och hantering

| Risk | Hantering |
| --- | --- |
| Äldre data saknar prioritet | Sätt default `normal` och mappa `important` till `high` i migreringen. |
| UI blir för rörig med flera färger | Håll en tydlig palett med 4 nivåer och en konsekvent ikon/etikett. |
| Sortering och filter blir felaktiga | Definiera en tydlig prioriteringsordning och centralisera den i en helper-funktion. |
| Stjärnmarkering försvinner plötsligt | Låt stjärnan vara kompatibilitetsväg för `high` under övergångsperioden. |
| Förvirring mellan "viktigt" och "brådskande" | Använd tydliga etiketter i UI och validera med användartester. |

## Klart när

- [ ] Prioritetsnivåer finns i Task-datan och migrationslogiken är på plats.
- [ ] Sortering och filtrering använder en tydlig nivåordning.
- [ ] Listvyn visar prioriteten på ett förståeligt sätt.
- [ ] Smarta vyer och kompatibilitetsflaggor fungerar som förväntat.
- [ ] Testsviten täcker omvandling, sortering, filter och UI.
- [ ] Manuell validering i appen är genomförd för både mobil och desktop.
