# Implementationsplan: flytta listor in och ut ur mappar

## Mål

Användaren ska kunna flytta en lista till en mapp eller ta bort listans mappkoppling på både desktop och mobil. Flytten ska kännas omedelbar i gränssnittet, sparas i Firestore och återställas om sparningen misslyckas.

## Beslutad UX

- Desktop: varje lista får en åtgärdsmeny med `Flytta till` och undermeny/lista över mappar.
- Desktop: drag-and-drop till en mapp kan läggas till som snabbväg, men ska inte vara enda sättet att flytta en lista.
- Mobil: listans åtgärdsmeny öppnar en bottom sheet/modal med mappar som enkelval.
- Både desktop och mobil visar alternativet `Utan mapp`.
- Flytt till en mapp eller `Utan mapp` sker med ett tryck och ger en kort möjlighet att ångra.
- Flytt ska vara tillgänglig med tangentbord och ha tydliga ARIA-labels.

## Steg

### 1. Förbered datalagret

- [x] Lägg till en tydlig store-metod, exempelvis `moveList(listId, folderId)`.
- [x] Acceptera `null` som betydelse för `Utan mapp`.
- [x] Uppdatera listan optimistiskt i Pinia så att den flyttas direkt mellan sektionerna.
- [x] Använd Firestores `deleteField()` när `folderId` ska tas bort, inte `folderId: undefined`.
- [x] Spara tidigare listvärde och återställ det om Firestore-uppdateringen misslyckas.
- [x] Behåll befintlig felhantering och offline-first-beteende.

### 2. Lägg till store-tester

- [x] Testa flytt från en mapp till en annan mapp.
- [x] Testa flytt från mapp till `Utan mapp`.
- [x] Testa att `deleteField()` skickas till Firestore när mappkopplingen tas bort.
- [x] Testa att UI-state återställs när `updateDoc` misslyckas.
- [x] Testa att `foldersWithLists` och `ungroupedLists` uppdateras direkt efter en optimistisk flytt.

### 3. Implementera desktop-menyn

- [x] Lägg till en liståtgärdsknapp i `TodoSidebar.vue` som syns vid hover och fokus.
- [x] Lägg till menyalternativet `Flytta till`.
- [x] Visa alla mappar samt `Utan mapp` som mål.
- [x] Markera listans nuvarande mapp.
- [x] Stäng menyn efter genomförd flytt och behåll aktiv lista.
- [ ] Stäng menyn vid klick utanför och Escape.
- [x] Säkerställ att menyn inte flyttar eller ändrar listvalet när användaren bara öppnar den.

### 4. Implementera mobilflödet

- [x] Använd samma liståtgärdsknapp i den öppna navigationspanelen.
- [x] Visa flyttalternativen i en mobilanpassad bottom sheet eller dialog.
- [x] Gör alternativen till enkelval med tydlig markering av aktuell mapp.
- [x] Gör `Utan mapp` lika lätt att välja som en namngiven mapp.
- [x] Stäng sheet/dialog efter valet och stäng navigationspanelen enligt befintligt mobilflöde.
- [ ] Hantera fokus, Escape och klick på bakgrund korrekt.

### 5. Lägg till desktop-drag-and-drop

- [ ] Gör listor dragbara på desktop.
- [ ] Gör mapprubriker till drop-zoner.
- [ ] Visa en tydlig visuell markering när en lista kan släppas i en mapp.
- [ ] Stöd dragning till en särskild `Utan mapp`-yta.
- [ ] Anropa samma `moveList`-metod som menyerna använder.
- [ ] Begränsa eller stäng av drag-and-drop på touch-enheter.
- [ ] Säkerställ att drag-and-drop inte ersätter meny- och tangentbordsflödet.

### 6. Lägg till ångra-feedback

- [ ] Visa en kort statusnotis efter lyckad flytt, exempelvis `Listan flyttades till Arbete`.
- [ ] Lägg till `Ångra` som återställer föregående `folderId`.
- [ ] Låt notisen försvinna automatiskt efter en kort timeout.
- [ ] Visa ett begripligt felmeddelande om Firestore-uppdateringen misslyckas.

### 7. Validera hela ändringen

- [x] Kör relevanta Vitest-tester för list store och komponenter.
- [x] Kör `npm run type-check`.
- [x] Kör `npm run lint`.
- [ ] Kontrollera desktop-layout med mus, tangentbord och drag-and-drop.
- [ ] Kontrollera mobil-layout med stängd och öppen sidomeny.
- [ ] Kontrollera dark mode och att långa mappnamn/listnamn inte orsakar överlappning.
- [ ] Kontrollera att befintliga, orelaterade ändringar i arbetsytan inte påverkas.

## Berörda filer

- `src/stores/listStore.ts`
- `src/components/TodoSidebar.vue`
- `src/views/HomeView.vue` om ångra-notis eller delad åtgärdsmeny behöver kopplas där
- `src/__tests__/listStore.spec.ts`
- `src/__tests__/taskComponents.spec.ts` eller ny komponenttestfil om menyflödet kräver det

## Klar när

- [ ] En lista kan flyttas till valfri befintlig mapp på desktop och mobil.
- [ ] En lista kan flyttas till `Utan mapp` på desktop och mobil.
- [ ] Flytten syns direkt utan blockerande laddningsindikator.
- [ ] Firestore använder `deleteField()` när mappkopplingen tas bort.
- [ ] Misslyckade uppdateringar återställs korrekt.
- [ ] Menyflödet fungerar med tangentbord och touch.
- [ ] `npm run type-check && npm run lint` passerar utan fel.
