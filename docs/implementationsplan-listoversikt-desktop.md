# Implementationsplan: Listöversikt för större skärmar

## Mål

Gör om den befintliga “Alla listor”-vyn till en responsiv ingång: under Tailwinds `lg` visas den nuvarande listöversikten, och från `lg` visas användarens listor sida vid sida i egna kolumner. Kolumnvyn ska ge överblick över uppgifter och kunna skrollas horisontellt.

## Nuläge och utgångspunkt

- Routingen använder Vue Router och har redan en separat `/all-lists`-vy.
- `AllListsView` är en grupperad navigationssida för mappar och listor; den visar inte uppgifterna som kolumner.
- `listStore` tillhandahåller listor, mappar och listor grupperade per mapp.
- `taskStore` laddar uppgifter och delsteg och exponerar uppgifter per vald vy. Listöversikten kan filtrera `taskStore.tasks` per `listId` utan att ändra datamodellen.
- `TaskRow` innehåller befintliga uppgiftsåtgärder. Återanvänd den där det fungerar och håll beteendet konsekvent med den vanliga listvyn.
- Navigering till Alla listor finns i `TodoSidebar`; samma ingång ska användas på alla skärmstorlekar.

## Beslut och avgränsningar

- Behåll `/all-lists` och den befintliga navigeringspunkten. Välj layout responsivt i samma vy.
- Visa appens `TodoHeader` även i Alla listor-vyn, utanför den skrollbara ytan, så att den ligger kvar vid vertikal och horisontell skrollning.
- Använd Tailwinds `lg` som brytpunkt: den befintliga översikten visas under `lg`, kolumnvyn visas från `lg` och uppåt.
- Gruppera listor visuellt per mapp i kolumnvyn och behåll mappgrupperingen i den befintliga översikten. Visa listor utan mapp under en egen grupp.
- Visa en kolumn per lista, med stabil bredd så att horisontell skrollning uppstår när det behövs.
- Skrolla den horisontella kolumnytan, inte hela sidans layout. Bevara vanlig vertikal skrollning inne i kolumner vid långa listor.
- Visa avslutade uppgifter i en separat expanderbar sektion i varje kolumn, alltid synlig även när den är tom och stängd som standard. Använd liten text i normal skriftform.
- Använd befintlig sortering per lista och tillåt att uppgifter läggs till och ändras från respektive kolumn.
- Lägg till uppgifter med snabb tillägg i kolumnen och redigera befintliga uppgifter via den befintliga detaljpanelen.
- Beräkna aktiva och avslutade uppgifter per lista i en gemensam computed-gruppering för att undvika upprepad sortering under rendering.
- Visa skrivfel utan att ta bort den redan laddade översikten.
- Använd befintliga stores och uppgiftsmodeller. Ingen Firestore-schemaändring eller separat hämtning per kolumn ska införas.
- Behåll appens nuvarande tema, autentiseringsskydd och interaktioner för uppgifter.
- Drag-och-släpp mellan listkolumner ingår inte i denna implementation; följ upp det som en separat förbättring i `improvements.md`.

## Genomförande

### Etapper (pausbara)

Varje etapp har ett självständigt resultat och kan pausas innan nästa påbörjas. Ingen etapp kräver schemaändring eller blockerar den befintliga mobilvyn.

1. [x] **Responsiv översikt:** samma `/all-lists`-route visar den befintliga mobilvyn under `lg` och mappgrupperade listkolumner från `lg`, med data, horisontell skrollning och infällda slutförda uppgifter.
2. [x] **Uppgiftsåtgärder:** koppla kolumnerna till befintliga uppgiftsåtgärder och detaljpanelen.
3. [x] **Snabb tillägg och finjustering:** lägg till uppgifter per lista och hantera tomma/långa kolumner samt tillgänglighet.
4. [x] **Slutvalidering:** E2E över brytpunkten, regressionstester, type-check, lint och build.

### 1. Responsiv vy och åtkomst

- [x] Behåll `/all-lists` och navigeringspunkten “Alla listor”.
- [x] Visa den nuvarande listöversikten under `lg` och kolumnöversikten från `lg` och uppåt.
- [x] Säkerställ att direktlänk och omladdning på `/all-lists` visar rätt layout för aktuell viewport.
- [x] Säkerställ att layouten växlar korrekt om viewporten ändras medan vyn är öppen.

### 2. Kolumnöversikt

- [x] Hämta listor/mappar och uppgifter via befintliga stores, med befintliga laddnings- och fellägen.
- [x] Rendera listorna i befintlig sorteringsordning, en lista per kolumn, grupperade visuellt under respektive mapp.
- [x] Behåll en egen grupp för listor utan mapp och befintlig mappgruppering i den smala layouten.
- [x] Ge varje kolumn en stabil min/max-bredd och tydlig listhuvudrad.
- [x] Skapa en horisontellt skrollbar yta med synlig fokusmarkering och fungerande tangentbordsfokus.
- [x] Säkerställ att kolumner med många uppgifter kan skrollas vertikalt utan att hindra horisontell navigering mellan kolumner.
- [x] Visa tomt läge för listor utan uppgifter och ett begripligt läge när inga listor finns.
- [x] Visa avslutade uppgifter i en separat expanderbar sektion per kolumn.
- [x] Håll sektionen med avslutade uppgifter stängd som standard.
- [x] Använd varje lists befintliga sorteringsinställning.

### 3. Uppgiftsinteraktioner

- [x] Återanvänd `TaskRow` och befintliga store-åtgärder för att markera klart, ändra status, stjärnmarkera, öppna detaljer och ta bort uppgifter.
- [x] Lägg till uppgifter med snabb tillägg i respektive kolumn och säkerställ att rätt `listId` används.
- [x] Öppna den befintliga detaljpanelen från en uppgiftsrad och koppla panelen till vald uppgift i kolumnvyn.
- [x] Se till att en ändring i en kolumn omedelbart uppdateras i översikten och i den vanliga listvyn.
- [x] Behåll befintligt stöd för listans statusläge och sortering där det är relevant.
- [x] Lämna drag-och-släpp mellan kolumner utanför denna implementation.

### 4. Tester

- [x] Verifiera uppgifter per lista, tomma listor och mappar i E2E.
- [x] Verifiera snabb tillägg via Enter och plusknappen samt rätt listtillhörighet.
- [x] Verifiera att appheadern är synlig på desktop och ligger kvar när mobilinnehållet skrollas.
- [x] Lägg till E2E-test vid `lg` och bredare som öppnar Alla listor och verifierar mappgrupper, kolumner och horisontell skrollning.
- [x] Lägg till E2E-test som verifierar att en uppgiftsåtgärd från en kolumn uppdaterar uppgiften korrekt.
- [x] Lägg till E2E-test under `lg` som verifierar att den befintliga Alla listor-layouten visas.
- [x] Verifiera att direktlänk, omladdning och viewportbyte visar rätt layout.
- [x] Använd mock-auth, stabil testdata och tillståndsbaserade väntningar; undvik fasta pauser.

### 5. Validering

- [x] Kör relevanta Vitest-tester.
- [x] Kör relevanta Playwright E2E-tester.
- [x] Kör `npm run type-check` och `npm run lint`.
- [x] Kör `npm run validate` när miljön stödjer hela valideringssviten.
- [x] Kontrollera manuellt bred desktopvy, smal desktopvy, horisontell skrollning, lång lista och mobilvy.

## Risker och hantering

| Risk | Hantering |
| --- | --- |
| Många kolumner gör det svårt att hitta en lista | Behåll tydliga rubriker och ordning; utvärdera senare om listfilter eller snabbnavigering behövs. |
| Horisontell och vertikal skrollning konkurrerar | Begränsa skrollning till kolumnytan och verifiera mus, styrplatta och tangentbord i E2E/manuell kontroll. |
| Duplicerad uppgiftslogik ger skillnader mot vanliga listvyn | Återanvänd `TaskRow` och befintliga store-mutationer i stället för att skapa en separat uppgiftsimplementation. |
| Store-hämtningen av delsteg blir kostsam med många uppgifter | Återanvänd nuvarande hämtning en gång för uppsättningen uppgifter; gör inga extra hämtningar från varje kolumn. Mät innan eventuell optimering. |
| Översikten blir trång på mindre laptopskärmar | Använd `lg` som beslutad brytpunkt, välj stabil kolumnbredd och testa precis runt brytpunkten. |

## Klart när

- [x] “Alla listor” visar befintlig layout under `lg` och kolumnvy från `lg` och uppåt.
- [x] Appheadern visas överst i båda layouterna och ligger kvar när listinnehållet skrollas.
- [x] Varje lista visas i sin egen kolumn under rätt mappgrupp med rätt uppgifter.
- [x] Användaren kan skrolla horisontellt mellan kolumner och vertikalt i långa listor.
- [x] Avslutade uppgifter finns i en separat sektion som är stängd som standard.
- [x] Uppgifter kan läggas till och ändras från respektive kolumn.
- [x] Uppgiftsåtgärder fungerar konsekvent med appens vanliga listvy.
- [x] Tester täcker båda layouterna runt `lg`, kolumninnehåll och uppgiftsinteraktioner.
- [x] Projektets obligatoriska validering passerar.
