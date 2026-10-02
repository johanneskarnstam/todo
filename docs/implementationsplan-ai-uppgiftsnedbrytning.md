# Implementationsplan: AI-stöd för uppgiftsnedbrytning

## Mål

Användaren ska kunna be AI föreslå konkreta delsteg utifrån uppgiftens titel, eventuell anteckning och ett frivilligt extra prompt. Förslagen visas i en modal och är valda som standard. Användaren kan välja bort irrelevanta förslag och bekräfta valda steg, eller stänga modalen utan att lägga till något. Den senaste förslagsuppsättningen och valstatusen ska visas när modalen öppnas igen. En ny generering ersätter den tidigare förslagsuppsättningen men tar inte bort redan skapade delsteg. Funktionen är tillgänglig för alla inloggade användare och använder Todo-appens befintliga `Step`-modell.

## Undersökningsresultat

- Todo-appen är Vue 3 med TypeScript och använder Firebase JS SDK 12.13.0. Firebase-appen initieras i `src/firebase.ts`; någon App Check-initiering hittades inte.
- `Task` och `Step` finns redan i `src/types/index.ts`. Delsteg sparas i `users/{userId}/tasks/{taskId}/steps`, och Firestore-reglerna begränsar läsning och skrivning till den inloggade ägaren.
- `src/stores/taskStore.ts` har redan `createStep`, `updateStep`, `deleteStep` och optimistisk state. `src/components/TaskDetailsPanel.vue` visar delsteg, och `src/views/HomeView.vue` kopplar panelens händelser till task-storen.
- Befintliga unit- och komponenttester för delsteg finns i `src/__tests__/taskStore.spec.ts` och `src/__tests__/taskComponents.spec.ts`. E2E-flödet för delsteg finns i `e2e/tasks.spec.ts`.
- `src_foodhero` är en separat React-källkodsmapp och är uttryckligen undantagen i `.gitignore`; dess filer och beroenden ingår inte i Todo-appens normala build. FoodHero-exemplet har användbara mönster: avskild AI-service, typade resultat, laddnings-/felstate och tester med mockad modell.
- FoodHeros `src_foodhero/services/aiService.ts` anropar Gemini direkt med `@google/generative-ai` och en `VITE_GEMINI_KEY`. En Vite-miljövariabel är inte en hemlighet i klienten: nyckeln kan hamna i den publika bundle:n. Den lösningen och dess modellista ska därför inte kopieras.
- Användaren har valt att inkludera uppgiftens anteckning när den finns, erbjuda ett frivilligt extra prompt och exponera funktionen för alla inloggade användare. Endast den senaste förslagsuppsättningen sparas; en ny generering ersätter den, medan befintliga delsteg lämnas kvar.

## Rekommenderad teknisk inriktning

- Använd Firebase AI Logic via den redan installerade Firebase Web SDK:n, i stället för en direkt Gemini-API-nyckel i klientkoden. Provisionera AI Logic för Firebase-projektet och kontrollera aktuellt modellstöd och modellnamn när implementationen börjar; kopiera inte modellnamn från FoodHero.
- Initiera och konfigurera Firebase App Check för webbappen. Använd debug-token lokalt och i CI, och en riktig provider i produktion. App Check kompletterar autentisering och Firestore-regler, men ersätter inte kvot- och kostnadskontroll.
- AI-servicen ska endast generera och validera förslag; den skapar aldrig delsteg direkt. Spara en enda aktuell förslagsuppsättning under uppgiften med status för varje förslag.
- Visa före generering den exakta kontext som ska skickas: titel, eventuell anteckning och det frivilliga extra promptet. Informera användaren att texten skickas till Firebase AI Logic/Gemini. Begränsa indata och antal utdata för att hålla svarstid och kostnad under kontroll.
- Spara senaste förslagsuppsättningen i ett fast dokument, exempelvis `users/{userId}/tasks/{taskId}/aiBreakdowns/latest`. Varje förslag behöver stabilt ID, titel, status (`available`, `skipped` eller `added`) och vid accepterande en referens till skapat `stepId`. Kryssruteval är tillfälligt UI-state; en lyckad bekräftelse sparar statusen. En lyckad ny generering skriver över dokumentet; historiska genereringar sparas inte.
- Spara en enda snapshot av kontexten som skapade de aktuella förslagen, så UI kan visa om titel, anteckning eller extra prompt har ändrats. Snapshoten skyddas av samma ägarregler, skrivs över vid ny lyckad generering och raderas när uppgiften tas bort.
- Börja med standardmodellen. Vid modellrelaterad överbelastning eller tillfälligt otillgänglig modell ska användaren få ett begripligt fel och en dropdown med tre verifierade alternativa modeller. Användaren väljer alternativ och startar ett uttryckligt nytt försök; byt inte modell tyst.
- Visa inte modellväljaren för fel där modellbyte inte hjälper. Skilj på nätverk, App Check/autentisering, projektkvot, ogiltigt modellresultat och modellöverbelastning; ge ett konkret felmeddelande och nästa steg för varje kategori.
- Definiera och verkställ gränser för titel, anteckning, extra prompt och svar, inklusive ett maxantal föreslagna delsteg, så att promptstorlek och atomära Firestore-batcher är begränsade.
- Lägg till uttryckliga Firestore-regler för `aiBreakdowns`-subcollectionen. Reglerna för task-dokumentet är inte automatiskt ärvda av underliggande subcollections.
- Skapa accepterade delsteg och uppdatera den aktuella förslagsuppsättningens valstatus i en Firestore-batch. Endast användarens uttryckliga val ska skapa `Step`-dokument.
- Använd strukturerat utdata med ett typat kontrakt, exempelvis `{ steps: string[] }`. Validera svaret i appen även om modellen ombeds följa ett schema. Trimma tomma titlar, begränsa antal och längd och filtrera uppenbara dubbletter före förhandsgranskning.

## Genomförande

### 1. Firebase och säkerhet

- [ ] Aktivera/provisionera Firebase AI Logic för rätt Firebase-projekt och kontrollera aktuell modell, kvoter, autentisering och eventuell fakturering.
- [ ] Välj och verifiera tre alternativa modell-ID:n som Firebase AI Logic stöder vid implementationstillfället. Dokumentera standardmodellen och vilka tillfälliga modellfel som motiverar alternativväljaren.
- [ ] Lägg till App Check i webbappens initiering med debug-token lokalt/CI och en produktionsprovider. Dokumentera Firebase Console- och miljökonfiguration utan att checka in hemligheter.
- [ ] Informera användaren att uppgiftens titel, eventuell anteckning och extra prompt skickas till AI-tjänsten när en ny generering begärs.
- [ ] Lägg till Firestore-regler för `users/{userId}/tasks/{taskId}/aiBreakdowns/latest` så att endast uppgiftens ägare kan läsa och skriva den aktuella förslagsuppsättningen.
- [ ] Lägg till emulatorbaserade regler-tester för ägaråtkomst och nekad åtkomst för andra användare.

### 2. AI-service och kontrakt

- [ ] Skapa `src/services/taskBreakdownService.ts` som tar titel, valfri anteckning, valfritt extra prompt och ett tillåtet modell-ID och returnerar validerade stegförslag via Firebase AI Logic.
- [ ] Skriv en svensk instruktion för små, konkreta och handlingsbara delsteg i logisk ordning.
- [ ] Använd strukturerat utdata/schema där SDK-stödet tillåter det och validera alltid svaret i appen.
- [ ] Sätt explicita maxgränser för indata och förslagsantal, inledningsvis högst 20 förslag; trimma tomma titlar och hantera dubbletter, feltypade värden och tomma/ogiltiga svar.
- [ ] Använd en central allowlist med standardmodellen och tre verifierade alternativ; acceptera inte godtyckliga modellnamn från UI eller lagrade data.
- [ ] Klassificera fel i återhämtningsbara modellfel och icke-modellfel. Returnera maskinläsbar feltyp så UI kan visa rätt fel och rätt åtgärd.
- [ ] Skapa tydliga svenska felmeddelanden för överbelastning, nätverk/offline, projektkvot, App Check/autentisering, konfiguration/behörighet och ogiltigt svar. Dölj råa providerfel och känslig prompttext från användarens felvy.

### 3. Senaste AI-förslag

- [ ] Definiera typade modeller för den aktuella förslagsuppsättningen och dess förslag. Förslag ska ha stabilt ID, titel, status (`available`, `skipped` eller `added`) och valfri koppling till skapat `stepId`.
- [ ] Spara en enda aktuell uppsättning i `aiBreakdowns/latest` under uppgiften. Spara den lyckade genereringen så att förslag och valstatus finns kvar när modalen stängs eller appen laddas om.
- [ ] Spara en snapshot av titel, anteckning och extra prompt som användes, enbart för den senaste uppsättningen. Rensa eller ersätt snapshoten vid borttagning respektive ny lyckad generering.
- [ ] Jämför snapshoten med uppgiftens aktuella titel och anteckning när modalen öppnas. Markera förslagen som skapade från äldre kontext om värdena har ändrats; låt användaren öppna dem ändå eller generera nya.
- [ ] Vid en ny lyckad generering ersätts den tidigare uppsättningen helt. Behåll befintliga `Step`-dokument; den nya genereringen får aldrig radera delsteg.
- [ ] Läs den aktuella uppsättningen när användaren öppnar AI-modalen, inte för varje taskrad.
- [ ] Lägg till idempotent rensning av dokumentet när en task tas bort. Firestore raderar inte subcollections automatiskt; välj en tillförlitlig cleanup-väg, exempelvis en Cloud Function-trigger, och testa den.

### 4. Composable och request-state

- [ ] Skapa `src/composables/useTaskBreakdown.ts` för att läsa senaste förslagen, begära ny generering och hålla aktuell uppsättning, laddning och fel.
- [ ] Förhindra dubbla samtidiga anrop och ignorera sena svar om användaren har bytt uppgift eller stängt modalen.
- [ ] Skicka visad titel, eventuell anteckning och frivilligt extra prompt vid generering. Anropa inte AI automatiskt när uppgiften öppnas eller ändras.
- [ ] Börja varje ny generering med standardmodellen. Vid klassificerat modellöverbelastnings-/otillgänglighetsfel exponeras de tre alternativen; ett modellbyte ska följas av ett uttryckligt nytt försök.
- [ ] Behåll valt alternativ bara för den aktuella modal-/retry-sessionen; återgå till standardmodellen för en ny generering om inte en permanent inställning beslutas senare.
- [ ] Öppna senaste sparade förslag när de finns. Erbjud en separat åtgärd för att generera om med aktuell kontext.
- [ ] Behåll aktuell förslagsuppsättning efter ett misslyckat sparförsök så att användaren kan försöka igen.

### 5. UI i uppgiftsdetaljer

- [ ] Lägg till en AI-knapp i **Delsteg** på `TaskDetailsPanel.vue`. Den ska alltid vara tillgänglig för inloggade användare.
- [ ] Knappen öppnar en modal. Visa titel och eventuell anteckning som den kontext som skickas, samt ett frivilligt textfält för ytterligare prompt.
- [ ] Om sparade förslag finns öppnas de med sina tidigare valstatusar. Erbjud **Generera nya förslag** som använder den aktuella titeln, anteckningen och promptfältet; när nya förslag lyckas ersätts den tidigare förslagsuppsättningen.
- [ ] Visa förslag som kryssrutor, markerade som valda från början vid ny generering. Användaren kan avmarkera irrelevanta förslag.
- [ ] Erbjud **Lägg till valda** för ett eller flera valda förslag. Om alla är avmarkerade ska användaren kunna stänga modalen utan att något delsteg skapas.
- [ ] Vid återöppning ska `added` visas som redan tillagda och inte kunna skapa dubbletter; `skipped` visas omarkerade men kan väljas igen; `available` visas valda som standard.
- [ ] Om kontext-snapshoten inte längre matchar titel/anteckning ska UI visa att förslagen bygger på äldre kontext och erbjuda generering på nytt.
- [ ] Vid modellrelaterad överbelastning visa ett tydligt fel, en dropdown med exakt tre verifierade alternativa modeller och en **Försök igen**-åtgärd. Visa vilket alternativ som valts.
- [ ] Vid nätverks-, kvot-, App Check-, behörighets- eller svarformatfel visa kategorispecifikt felmeddelande och rekommenderad åtgärd; erbjud inte modellbyte om det inte kan lösa felet.
- [ ] När användaren bekräftat och öppnar modalen igen visas både valda och bortvalda förslag från senaste genereringen. Redan tillagda delsteg ska visas som tillagda och får inte skapas dubbelt.
- [ ] Visa laddning, fel, tomma resultat och offline-status utan att blockera manuell delstegshantering. Säkerställ tillgängliga namn och mobil layout.

### 6. Persistens och koppling till delsteg

- [ ] Lägg till en store-operation för batchskapande av flera delsteg med optimistisk state, stabil ordning och `completed: false`.
- [ ] Skapa valda `Step`-dokument och uppdatera aktuell förslagsstatus/`stepId` i samma Firestore-batch.
- [ ] Spara avmarkerade förslag som `skipped`. Om alla förslag är avmarkerade och användaren stänger modalen ska inga `Step`-dokument skapas.
- [ ] När ett kopplat delsteg raderas ska förslaget bli möjligt att lägga till igen; rensningen av `stepId`/status ska vara atomär eller återställbar.
- [ ] Håll antalet förslag så lågt att skapande av delsteg och uppdatering av senaste förslagsdokumentet ryms i en Firestore-batch.
- [ ] Återställ alla optimistiska steg och behåll förslagen tillgängliga om batchen misslyckas.
- [ ] Stöd mock-auth-läget utan riktiga Firebase-anrop och visa befintligt fel-/toastmeddelande vid lagringsfel.

### 7. Tester

- [ ] Service-unit-tester med mockad Firebase AI Logic: indata, tre tillåtna alternativ, giltigt/ogiltigt svar, gränsvärden, dubbletter, nätverk, kvot och klassificering av modellöverbelastning.
- [ ] Composable-/komponenttester för laddning, sena svar, byte av uppgift, senaste förslag, kontext-snapshot/stale-status och generering med aktuell titel/anteckning/extra prompt.
- [ ] UI-tester för kontextvisning, extra prompt, avmarkering, lägg till valda, stängning när alla är avmarkerade, återöppning av valstatus, modell-dropdown och tydliga kategoriserade fel.
- [ ] Verifiera att modell-dropdown endast visas för återhämtningsbara modellfel, att val av alternativ skickar nytt anrop med rätt modell och att projektkvot-/App Check-fel inte triggar modellbyte.
- [ ] Testa att misslyckad omgenerering behåller den tidigare sparade förslagsuppsättningen och kontext-snapshoten.
- [ ] Store-tester för atomär batch, status/`stepId`, ordning, rollback, dubbelinläggningsskydd och mock-auth.
- [ ] E2E-tester i `e2e/tasks.spec.ts` med deterministiskt AI-mock: visa kontext, val/avval, bekräfta, återöppna valda och bortvalda, stäng utan delsteg och generera om efter titel-/anteckningsändring utan att radera redan skapade steg.
- [ ] Utöka Firestore Rules Emulator-testerna för den aktuella AI-förslagsuppsättningens ägarisolering. Inga tester får använda riktiga modell- eller Firebase-anrop.

### 8. Validering och leverans

- [ ] Kör relevanta Vitest-tester för service, composable, komponent och task-store.
- [ ] Kör Firestore Rules Emulator-tester och relevanta E2E-tester med mock-auth.
- [ ] Kör obligatoriska kontroller: `npm run type-check` och `npm run lint`.
- [ ] Kör `npm run validate` när emulator-/Playwright-förutsättningarna tillåter det och kontrollera produktionsbygget.
- [ ] Verifiera manuellt att funktionen är synlig för inloggade användare, att förslag inte skapar delsteg utan bekräftelse, att senaste valstatus överlever omladdning, att generera om endast ersätter förslagen och att offlinefel är begripliga.
- [ ] Höj paketversionen enligt repoets SemVer-regel när implementationen är färdig och validerad, före eventuell commit.

## Risker och avgränsningar

| Risk | Hantering |
| --- | --- |
| Klientanrop kan missbrukas eller ge oväntad kostnad | App Check, autentisering, kvoter och uppföljning; utvärdera callable Cloud Function om strikt hastighetsbegränsning per användare eller serverstyrda policyer krävs. |
| Uppgiftstext kan innehålla privat information | Skicka titel och anteckning enligt användarens val, informera före AI-användning och begränsa indata. |
| Modellen returnerar ofullständiga eller irrelevanta förslag | Strukturerat schema, validering, förhandsgranskning och användarens val per förslag. |
| Tillfällig modellöverbelastning hindrar generering | Visa fel och tre verifierade alternativa modeller; byt bara efter användarens val och retry. |
| Felmeddelandet leder till fel åtgärd | Klassificera fel och skilj modellöverbelastning från nätverk, projektkvot, App Check och ogiltiga svar. |
| Förslag bygger på gammal titel/anteckning | Spara bara senaste kontext-snapshoten och markera den som inaktuell när taskens titel/anteckning ändras. |
| AI-anrop fungerar inte offline | Generering kräver nätverk; behåll senast sparade förslag och manuell delstegsinmatning tillgängliga. |
| Senaste förslag eller valstatus tappas bort | Spara aktuell förslagsuppsättning under uppgiften och testa omladdning samt Firestore-regler. |
| AI-förslag blir kvar efter att tasken raderats | Radera subcollectionen explicit; Firestore kaskadraderar inte underliggande dokument. Gör cleanup idempotent och testa den. |
| Batchskrivning misslyckas efter att förslag accepterats | Rulla tillbaka alla optimistiska steg och behåll körningen tillgänglig för ett nytt lagringsförsök. |
| Ett accepterat förslag kan skapas igen från den sparade uppsättningen | Koppla accepterat förslag till skapat `stepId` och blockera duplicerade skapanden. |
| FoodHero-exemplet verkar återanvändbart men tillhör en annan app | Återanvänd endast arkitekturidéer; kopiera inte dess React-kod, API-nyckelmönster, modellista eller receptspecifika promptar. |

## Frågor att besvara

1. Inga öppna frågor just nu. Planen utgår från att endast den senaste förslagsuppsättningen sparas, att generera om ersätter den och att redan skapade delsteg lämnas kvar.