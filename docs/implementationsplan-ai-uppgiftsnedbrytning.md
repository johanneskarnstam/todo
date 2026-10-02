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
- Spara senaste förslagsuppsättningen som metadata i `users/{userId}/tasks/{taskId}/aiBreakdowns/latest` och ett dokument per förslag i dess `suggestions`-subcollection. Varje förslagsdokument har stabilt dokument-ID, titel, status (`available`, `skipped` eller `added`) och vid accepterande en referens till skapat `stepId`. Kryssruteval är tillfälligt UI-state; en lyckad bekräftelse sparar statusen. En lyckad ny generering ersätter metadata och förslagsdokument; historiska genereringar sparas inte.
- Metadata innehåller listan med högst 20 tillåtna förslags-ID:n; varje förslagsdokument måste matcha listan så en klient inte kan överskrida maxgränsen med extra dokument.
- Spara en enda snapshot av kontexten som skapade de aktuella förslagen, så UI kan visa om titel, anteckning eller extra prompt har ändrats. Snapshoten skyddas av samma ägarregler, skrivs över vid ny lyckad generering och raderas när uppgiften tas bort.
- Börja med standardmodellen. Vid modellrelaterad överbelastning eller tillfälligt otillgänglig modell ska användaren få ett begripligt fel och en dropdown med tre verifierade alternativa modeller. Användaren väljer alternativ och startar ett uttryckligt nytt försök; byt inte modell tyst.
- Visa inte modellväljaren för fel där modellbyte inte hjälper. Skilj på nätverk, App Check/autentisering, projektkvot, ogiltigt modellresultat och modellöverbelastning; ge ett konkret felmeddelande och nästa steg för varje kategori.
- Definiera och verkställ gränser för titel, anteckning, extra prompt och svar, inklusive ett maxantal föreslagna delsteg, så att promptstorlek och atomära Firestore-batcher är begränsade.
- Lägg till uttryckliga Firestore-regler för `aiBreakdowns/latest` och dess `suggestions`-subcollection. Reglerna för task-dokumentet är inte automatiskt ärvda av underliggande subcollections. Separata förslagsdokument låter reglerna validera varje titel/status/stepId utan att försöka loopa över en lista i Rules.
- Skapa accepterade delsteg och uppdatera den aktuella förslagsuppsättningens valstatus i en Firestore-batch. Endast användarens uttryckliga val ska skapa `Step`-dokument.
- Använd strukturerat utdata med ett typat kontrakt, exempelvis `{ steps: string[] }`. Validera svaret i appen även om modellen ombeds följa ett schema. Trimma tomma titlar, begränsa antal och längd och filtrera uppenbara dubbletter före förhandsgranskning.

## Genomförande

### 1. Firebase och säkerhet

- [x] Verifiera Firebase CLI-projektet `todo-de1c0` och dess enda registrerade webbapp (`1:341595834624:web:d45ffb423c7feff91d8be5`).
- [x] Aktivera/provisionera Firebase AI Logic för projektet och webbappen med `firebase init ailogic --project todo-de1c0 --interactive`; CLI bekräftade att AI Logic aktiverats.
- [ ] Verifiera faktisk modellåtkomst, kvoter, autentisering och eventuell fakturering i Firebase-projektet innan produktionsanrop.
- [x] Verifiera modellkandidater mot Firebase AI Logic-dokumentationen den 2026-10-02: standard `gemini-3.8-flash`; alternativ `gemini-3.7-flash`, `gemini-3.6-flash` och `gemini-3.5-flash-lite`. De första tre anges som stable men short-term availability; kontrollera projektåtkomst och livscykel igen innan produktionssättning.
- [x] Initiera App Check före Auth/Firestore: debug-token endast i lokal utveckling med riktig Firebase-konfiguration, inget App Check-anrop i testläge eller E2E mock-auth, och reCAPTCHA Enterprise-provider i produktion när site-key finns. Deploy- och release-builds läser `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` från GitHub Actions variable.
- [ ] Kör webbappen lokalt, registrera den genererade App Check-debug-token i Firebase Console och verifiera att Firebase AI Logic har baseline enforcement aktiverad. CLI-kontroll 2026-10-02 hittade inga registrerade debug-token för webbappen. Token ska inte checkas in eller delas.
- [ ] Skapa/registrera reCAPTCHA Enterprise-provider för produktionsdomäner och sätt GitHub Actions variable `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`; verifiera produktionsbygge och App Check-token innan release.
- [ ] Informera användaren att uppgiftens titel, eventuell anteckning och extra prompt skickas till AI-tjänsten när en ny generering begärs.
- [x] Lägg till Firestore-regler för `aiBreakdowns/latest` och `aiBreakdowns/latest/suggestions/{suggestionId}` med ägarkontroll och validering av tillåtna fält, statusar, längder, maxantal och `stepId`-koppling till ett delsteg i samma task.
- [x] Lägg till emulatorbaserade regler-tester för ägaråtkomst och nekad åtkomst för andra användare, inklusive gränsvärden, ogiltiga fält, statusövergångar, stepId-koppling och parent-task.

### 2. AI-service och kontrakt

- [x] Skapa `src/services/taskBreakdownService.ts` som tar titel, valfri anteckning, valfritt extra prompt och ett tillåtet modell-ID och returnerar validerade stegförslag via Firebase AI Logic.
- [x] Skriv en svensk instruktion för små, konkreta och handlingsbara delsteg i logisk ordning.
- [x] Använd strukturerat utdata/schema där SDK-stödet tillåter det och validera alltid svaret i appen.
- [x] Sätt explicita maxgränser för indata och förslagsantal, inledningsvis högst 20 förslag; trimma tomma titlar och hantera dubbletter, feltypade värden och tomma/ogiltiga svar.
- [x] Använd en central allowlist med standardmodellen och tre verifierade alternativ; acceptera inte godtyckliga modellnamn från UI eller lagrade data.
- [x] Klassificera fel i återhämtningsbara modellfel och icke-modellfel. Returnera maskinläsbar feltyp så UI kan visa rätt fel och rätt åtgärd.
- [x] Skapa tydliga svenska felmeddelanden för överbelastning, nätverk/offline, projektkvot, App Check/autentisering, konfiguration/behörighet och ogiltigt svar. Dölj råa providerfel och känslig prompttext från användarens felvy.

### 3. Senaste AI-förslag

- [x] Definiera typade modeller för metadata i `aiBreakdowns/latest` och förslagsdokument i `suggestions`. Varje förslag har stabilt dokument-ID, titel, status (`available`, `skipped` eller `added`) och valfri koppling till skapat `stepId`.
- [x] Spara en enda aktuell metadatauppsättning i `aiBreakdowns/latest` och ett dokument per förslag i dess `suggestions`-subcollection. Spara den lyckade genereringen så att förslag och valstatus finns kvar när modalen stängs eller appen laddas om.
- [x] Spara en snapshot av titel, anteckning och extra prompt som användes, enbart för den senaste uppsättningen. En lyckad ny generering ersätter snapshoten.
- [x] Jämför snapshoten med uppgiftens aktuella titel och anteckning när modalen öppnas. Markera förslagen som skapade från äldre kontext om värdena har ändrats; låt användaren öppna dem ändå eller generera nya.
- [x] Vid en ny lyckad generering ersätts metadata och alla föregående förslagsdokument i samma batch. Behåll befintliga `Step`-dokument; den nya genereringen rör dem inte.
- [x] Läs den aktuella uppsättningen när användaren öppnar AI-modalen, inte för varje taskrad.
- [x] Lägg till idempotent rensning av metadata och förslagsdokument när en task tas bort. Firestore raderar inte subcollections automatiskt; välj en tillförlitlig cleanup-väg, exempelvis en Cloud Function-trigger, och testa den rekursiva rensningen.

### 4. Composable och request-state

- [x] Skapa `src/composables/useTaskBreakdown.ts` för att läsa senaste förslagen, begära ny generering och hålla aktuell uppsättning, laddning och fel.
- [x] Förhindra dubbla samtidiga anrop och ignorera sena svar om användaren har bytt uppgift eller stängt modalen.
- [x] Skicka visad titel, eventuell anteckning och frivilligt extra prompt vid generering. Anropa inte AI automatiskt när uppgiften öppnas eller ändras.
- [x] Börja varje ny generering med standardmodellen. Vid klassificerat modellöverbelastnings-/otillgänglighetsfel exponeras de tre alternativen; ett modellbyte ska följas av ett uttryckligt nytt försök.
- [x] Behåll valt alternativ bara för den aktuella modal-/retry-sessionen; återgå till standardmodellen för en ny generering om inte en permanent inställning beslutas senare.
- [x] Öppna senaste sparade förslag när de finns. Erbjud en separat åtgärd för att generera om med aktuell kontext.
- [x] Behåll aktuell förslagsuppsättning efter ett misslyckat sparförsök så att användaren kan försöka igen.

### 5. UI i uppgiftsdetaljer

- [x] Lägg till en AI-knapp i **Delsteg** på `TaskDetailsPanel.vue`. Den ska alltid vara tillgänglig för inloggade användare.
- [x] Knappen öppnar en modal. Visa titel och eventuell anteckning som den kontext som skickas, samt ett frivilligt textfält för ytterligare prompt.
- [x] Om sparade förslag finns öppnas de med sina tidigare valstatusar. Erbjud **Generera nya förslag** som använder den aktuella titeln, anteckningen och promptfältet; när nya förslag lyckas ersätts den tidigare förslagsuppsättningen.
- [x] Visa förslag som kryssrutor, markerade som valda från början vid ny generering. Användaren kan avmarkera irrelevanta förslag.
- [x] Erbjud **Lägg till valda** för ett eller flera valda förslag. Om alla är avmarkerade ska användaren kunna stänga modalen utan att något delsteg skapas.
- [x] Vid återöppning ska `added` visas som redan tillagda och inte kunna skapa dubbletter; `skipped` visas omarkerade men kan väljas igen; `available` visas valda som standard.
- [x] Om kontext-snapshoten inte längre matchar titel/anteckning ska UI visa att förslagen bygger på äldre kontext och erbjuda generering på nytt.
- [x] Vid modellrelaterad överbelastning visa ett tydligt fel, en dropdown med exakt tre verifierade alternativa modeller och en **Försök igen**-åtgärd. Visa vilket alternativ som valts.
- [x] Vid nätverks-, kvot-, App Check-, behörighets- eller svarformatfel visa kategorispecifikt felmeddelande och rekommenderad åtgärd; erbjud inte modellbyte om det inte kan lösa felet.
- [x] När användaren bekräftat och öppnar modalen igen visas både valda och bortvalda förslag från senaste genereringen. Redan tillagda delsteg ska visas som tillagda och får inte skapas dubbelt.
- [x] Visa laddning, fel, tomma resultat och offline-status utan att blockera manuell delstegshantering. Säkerställ tillgängliga namn och mobil layout.

### 6. Persistens och koppling till delsteg

- [x] Lägg till en store-operation för batchskapande av flera delsteg med optimistisk state, stabil ordning och `completed: false`.
- [x] Skapa valda `Step`-dokument och uppdatera aktuell förslagsstatus/`stepId` i samma Firestore-batch.
- [x] Spara avmarkerade förslag som `skipped`. Om alla förslag är avmarkerade och användaren stänger modalen ska inga `Step`-dokument skapas.
- [x] När ett kopplat delsteg raderas ska förslaget bli möjligt att lägga till igen; rensningen av `stepId`/status ska vara atomär eller återställbar.
- [x] Håll antalet förslag så lågt att skapande av delsteg och uppdatering av senaste förslagsdokumentet ryms i en Firestore-batch.
- [x] Återställ alla optimistiska steg och behåll förslagen tillgängliga om batchen misslyckas.
- [x] Stöd mock-auth-läget utan riktiga Firebase-anrop och visa befintligt fel-/toastmeddelande vid lagringsfel.

### 7. Tester

- [x] Service-unit-tester med mockad Firebase AI Logic: indata, tre tillåtna alternativ, giltigt/ogiltigt svar, gränsvärden, dubbletter, nätverk, kvot och klassificering av modellöverbelastning.
- [x] Composable-/komponenttester för laddning, sena svar, byte av uppgift, senaste förslag, kontext-snapshot/stale-status och generering med aktuell titel/anteckning/extra prompt.
- [x] UI-tester för kontextvisning, extra prompt, avmarkering, lägg till valda, stängning när alla är avmarkerade, återöppning av valstatus, modell-dropdown och tydliga kategoriserade fel.
- [x] Verifiera att modell-dropdown endast visas för återhämtningsbara modellfel, att val av alternativ skickar nytt anrop med rätt modell och att projektkvot-/App Check-fel inte triggar modellbyte.
- [x] Testa att misslyckad AI-generering behåller den tidigare sparade förslagsuppsättningen och kontext-snapshoten.
- [x] Store-tester för atomär batch, status/`stepId`, ordning, rollback, dubbelinläggningsskydd och mock-auth.
- [x] E2E-tester i `e2e/tasks.spec.ts` med deterministiskt AI-mock: visa kontext, val/avval, bekräfta, återöppna valda och bortvalda, stäng utan delsteg och generera om efter titel-/anteckningsändring utan att radera redan skapade steg.
- [x] Utöka Firestore Rules Emulator-testerna för den aktuella AI-förslagsuppsättningens ägarisolering. Inga tester får använda riktiga modell- eller Firebase-anrop.

### 8. Validering och leverans

- [x] Kör relevanta Vitest-tester för service, composable, komponent och task-store.
- [x] Kör Firestore Rules Emulator-tester och relevanta E2E-tester med mock-auth.
- [x] Kör obligatoriska kontroller: `npm run type-check` och `npm run lint`.
- [x] Kör `npm run validate` när emulator-/Playwright-förutsättningarna tillåter det och kontrollera produktionsbygget.
- [x] Verifiera manuellt att funktionen är synlig för inloggade användare, att förslag inte skapar delsteg utan bekräftelse, att senaste valstatus överlever omladdning, att generera om endast ersätter förslagen och att offlinefel är begripliga.
- [x] Höj paketversionen enligt repoets SemVer-regel när implementationen är färdig och validerad, före eventuell commit.

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