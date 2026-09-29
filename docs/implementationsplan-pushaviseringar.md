# Implementationsplan: pushpåminnelser när appen är stängd

## Mål

Leverera uppgiftspåminnelser till en installerad PWA på Android även när Todo inte är öppet. Lösningen ska använda web push, fungera med befintliga Firestore-uppgifter och kunna stängas av utan att användardata tas bort.

Web push är beroende av att användaren har tillåtit aviseringar, att enheten har nätverk och att Chrome/Android inte har tvångsstoppat eller blockerat appen. Planen kan ge tillförlitliga bakgrundsaviseringar under normala förhållanden, men kan inte kringgå operativsystemets regler.

## Nuläge i repot

- `src/composables/useReminderNotifications.ts` använder `setTimeout` och `new Notification(...)`. Timers överlever inte att sidan stängs eller pausas.
- `src/main.ts` registrerar service workern från `vite-plugin-pwa`; den genereras för PWA/cache och hanterar inte pushmeddelanden.
- `vite.config.ts` använder pluginens genererade Workbox-worker. FCM:s bakgrundshantering måste därför integreras med samma worker eller med en uttryckligt kompatibel registrering.
- Påminnelser sparas på Firestore-uppgiften som `dueDate` och `reminder`. `dueDate` kan vara datumsträng eller Firestore-tidsstämpel.
- Inställningen `preferences.notifications` lagras bara lokalt i webbläsaren.
- `firebase.json` innehåller Firestore-regler men ingen Functions- eller emulator-konfiguration.
- Befintliga Firestore-regler tillåter användaren att läsa och skriva dokument under sin egen användarsökväg. Nya serverjobb ska inte göras skrivbara av klienten.

## Föreslagen lösning

1. Klienten frågar efter behörighet efter ett aktivt användarval, registrerar en FCM-token och sparar den som en enhetsregistrering kopplad till inloggad användare. Avstängning tar bort eller inaktiverar just den enhetens token.
2. En Firebase Cloud Function reagerar på skapade, ändrade och borttagna uppgifter. Den beräknar aktuell påminnelsetid och synkroniserar ett separat, serverhanterat jobb. Jobb ska inte ligga i klientens ändringsbara task-data.
3. En schemalagd backendfunktion söker efter förfallna jobb, läser uppgiften på nytt, verifierar att påminnelsen fortfarande gäller och skickar FCM till användarens aktiverade enheter.
4. Bakgrundsmeddelandet visas från PWA:ns service worker via `showNotification()`. Samma worker ska fortsätta stödja befintlig Workbox-cache.
5. Jobbhanteringen ska vara idempotent: ändrat datum, avstängd påminnelse, slutförd uppgift eller borttagen uppgift får inte ge en gammal avisering.

En periodisk jobbsökning väljs som första implementation eftersom uppgifter kan ligga längre fram än Cloud Tasks tillåter schemaläggning. Jobbsökningen behöver ett index och en tydlig frekvens-/kostnadsgräns. Om volymen senare motiverar det kan jobbkö bytas till Cloud Tasks i en separat ändring.

## Beslut före implementation

Följande frågor är stoppunkter, inte antaganden som ska kodas in tyst. Besvara dem i planen eller i ett separat beslut innan fas 1 startar.

### Kända beslut

- **Firebase-plan.** Projektet har uppgraderats till Blaze. Det innebär att Cloud Functions och Cloud Scheduler kan utvärderas, men det är inte ett godkännande av obegränsad användning eller produktionssättning.
- **Cloud Scheduler API.** Cloud Scheduler API är aktiverat i produktionsprojektet `todo-de1c0`. Detta bekräftar API-åtkomst, men schemalagda jobb ska inte skapas eller aktiveras förrän backend, kill switch och kostnadskontroll är verifierade.
- **Firebase Cloud Messaging API.** Firebase Cloud Messaging API (V1) är aktiverat i produktionsprojektet med Sender ID `341595834624`. Legacy Cloud Messaging API är avstängt, vilket är korrekt för den planerade integrationen. Ett Web Push key pair är genererat och den publika VAPID-nyckeln finns lokalt i `.env.local`; värdet ska inte committas.
- **Lokalt Firebase-projekt.** Den lokala klientkonfigurationen pekar på projektet `todo-de1c0`. Projektägaren har godkänt att detta produktionsprojekt används för lösningen och att kostnader uppstår enligt beslutad budget. Ingen personlig e-postadress behöver dokumenteras i repot.
- **Säkerhetsgräns.** Inga funktioner, scheman, index, tokens eller andra molnresurser ska skapas i projektet innan projektägare och kostnadsgräns är bekräftade.

- **Tidszon för datum utan klockslag.** Beslutad modell är att spara `dueTimeZone` som IANA-tidszon på uppgiften när ett datum väljs. Datumsträngar tolkas som kl. 09:00 i den sparade tidszonen. Standard för nya uppgifter är `Europe/Stockholm`; befintliga uppgifter får samma standard endast efter granskat migreringsbeslut. Firestore-tidsstämplar fortsätter vara absoluta tidpunkter.
- **Firebase-fakturering och budget.** Blaze är redan aktiverat. Projektägaren känner inte till några andra Firebase-kostnader i projektet. Projektägaren har godkänt Functions/Scheduler och en kostnadsvarning på 50 kr per månad, med varningar vid 50 %, 75 %, 90 % och 100 %. Detta är en varningsnivå, inte ett hårt kostnadstak; kontrollera därför kostnadsöversikten i Firebase Console innan schemalagda produktionsutskick aktiveras. Aktivera eller ändra inte fakturering som del av en kodändring.
- **Enhets- eller kontoinställning.** Beslutad modell är att växeln i Inställningar gäller den aktuella installationen/enheten, eftersom token och OS-behörighet är enhetsspecifika. Ett konto kan därför ha olika pushstatus på olika enheter.
- **Försenad leverans.** Jobb som är äldre än 15 minuter ska hoppas över och loggas utan token eller känslig task-data.

### Beslutade standardval

Följande gäller för den första implementationen:

- **Tidszon:** spara `dueTimeZone` med IANA-format på nya uppgifter. Använd `Europe/Stockholm` som standard och tolka datumsträngar som kl. 09:00 i den sparade tidszonen. Använd inte serverns tidszon som implicit fallback. Befintliga uppgifter hanteras i en separat, idempotent migrering efter dry-run.
- **Pushinställning:** låt inställningen gälla den aktuella enheten/installationen. Registrera, inaktivera och återaktivera endast den aktuella enhetens token; radera inte uppgifter eller andra enheters registreringar.
- **Försenad leverans:** hoppa över jobb som är mer än 15 minuter gamla och logga endast jobb-ID, status och feltyp.
- **Miljö:** använd produktionsprojektet `todo-de1c0`; separat stagingprojekt ingår inte i den första implementationen. Kör ändå all automatisk testning i emulator/mock och håll kill switch avstängd under deploy.
- **Region och intervall:** använd Functions-regionen `europe-west1` och en schemalagd körning varje minut. Räkna med högst två minuters normal schemaläggningsfördröjning; jobb som passerat 15 minuter hoppas över.
- **Drift:** håll kill switch avstängd tills emulator-, mock- och lokala browser-tester är godkända. Test- och CI-flöden ska använda emulator/mock och aldrig skicka riktiga pushnotiser.

### Svar som krävs innan kodning

Inga ytterligare beslut behöver besvaras av projektägaren. Innan schemalagda produktionsfunktioner aktiveras ska kostnadsöversikten i Firebase Console kontrolleras som teknisk driftkontroll.

## Arbetssätt och avbrytbarhet

- Genomför en fas i taget. Efter varje fas redovisas ändrade filer, tester, kvarvarande risker och återställningssteg; invänta klartecken innan nästa fas.
- Alla punkter nedan börjar som `[ ]`. Markera dem först när kriteriet för fasen är verifierat.
- `Avbryt` betyder att stoppa arbetet där det är, inte att automatiskt radera data eller stänga av projektets befintliga funktioner.
- Inga produktionsresurser, fakturering, produktionshemligheter eller användartokens skapas utan separat godkännande.
- Före produktionssändning finns en serverbaserad kill switch. Avstängning ska stoppa nya pushutskick utan att radera uppgifter eller jobbdata.
- Behåll bakåtkompatibilitet tills staging- och Android-kontrollerna passerat. Ingen versionshöjning, commit eller release sker automatiskt som del av planen.

## Faser

### 0. Förkontroll och omfattning

- [x] Bekräfta att `todo-de1c0` är rätt produktionsprojekt och att projektägaren godkänner kostnader och deployer.
- [ ] Kontrollera aktuella Firebase-plan-, Cloud Functions- och FCM-krav i projektet.
- [x] Bekräfta att Cloud Scheduler API är aktiverat i produktionsprojektet.
- [x] Bekräfta att Firebase Cloud Messaging API (V1) är aktiverat i produktionsprojektet.
- [x] Bekräfta att Firebase-projektet använder Blaze-planen.
- [x] Dokumentera kostnadsägare, månadsbudget på 50 kr och varningsnivåer vid 50 %, 75 %, 90 % och 100 %.
- [x] Dokumentera att inga andra Firebase-kostnader är kända; verifiera kostnadsöversikten i Firebase Console före aktivering av schemalagda produktionsutskick.
- [x] Besluta tidszonsmodell och hur nya respektive befintliga datumsträngar ska tolkas enligt den beslutade modellen ovan.
- [x] Besluta att av/på gäller den aktuella enheten/installationen.
- [x] Besluta att jobb äldre än 15 minuter ska hoppas över.
- [x] Välja produktionsprojektet, Functions-region `europe-west1`, schemaläggningsintervall på en minut och högsta normala fördröjning på två minuter.

**Godkänd när:** projekt, godkännande, budgetvarningar, tidszon, enhetsmodell, tolerans, region och intervall är dokumenterade. Befintliga projektkostnader ska kontrolleras innan schemalagda produktionsutskick aktiveras.

**Avbryt/återställ:** ingen kod eller Firebase-resurs har ändrats. Stanna här om något beslut saknas.

### 1. Kontrakt och teknisk prototyp

- [x] Skriv ned datakontraktet för jobbstatus, taskdata, tidszon och leveransresultat i `functions/src/reminderJobs.ts`.
- [x] Välj jobbstatusar: `pending`, `processing`, `sent`, `cancelled` och `failed`. Återförsöksregler återstår att implementera.
- [x] Definiera idempotensnyckel/revision så att gamla Firestore-triggerhändelser inte kan skicka en inaktuell påminnelse.
- [x] Bygg en minimal worker-prototyp med `vite-plugin-pwa` `injectManifest`; produktionen bygger en gemensam Workbox/FCM-worker i `dist/sw.js`. Verifiering av verkligt bakgrundsmottagande återstår.
- [x] Bekräfta att FCM-token kan hämtas efter aktivt användargodkännande och kopplas till rätt inloggad användare; runtime-test med fysisk enhet återstår.
- [x] Lägg till beslut om index, funktionernas region, schemaläggningsintervall och loggning utan token/personuppgifter.

**Godkänd när:** worker-strategi och datakontrakt är verifierade utan produktionsdeploy. Föredragen strategi är en gemensam anpassad worker via `vite-plugin-pwa` `injectManifest`, men behåll genererad worker om prototypen visar en enklare konfliktfri lösning.

**Avbryt/återställ:** ta bort endast prototypkod och lokala byggartefakter. Ändra inte den aktiva worker-registreringen i distributionen.

### 2. Backendgrund i emulator/lokal miljö

- [x] Lägg till Firebase Functions-struktur och TypeScript-konfiguration enligt projektets befintliga standarder.
- [x] Lägg till enhetstester och emulatorbaserade integrationstester utan credentials i repot.
- [x] Lägg till serverfunktioner för task create/update/delete och separat schemalagd jobbbearbetning; scheduler körs med kill switch avstängd.
- [x] Skapa serverhanterade påminnelsejobb separat från klientens task-dokument.
- [x] Verifiera med Firestore Rules-emulator att klienten inte kan läsa eller skriva serverjobb.
- [ ] Implementera normalisering av datumsträng/tidsstämpel och tidszon med uttryckliga fel för ogiltiga värden.
- [x] Lägg till Firestore-index för jobbfrågan i `firestore.indexes.json` och verifiera att indexdefinitionen versionshanteras.
- [x] Lägg till loggar för jobb-ID och status utan råa FCM-token eller känsliga payloads.
- [x] Lägg till en server-side kill switch som är avstängd som standard i `functions/src/reminderJobs.ts`; den ska kopplas till schemalagd leverans innan utskick aktiveras.

**Godkänd när:** funktionerna kan köras och testas lokalt, skapar/uppdaterar/avbokar jobb deterministiskt och går inte att utlösa till riktig FCM-sändning.

**Avbryt/återställ:** ta bort lokala emulatordata och inaktivera lokal funktion. Inga molnresurser eller användardata påverkas.

### 3. Säker enhetsregistrering och klientinställning

- [x] Skapa klientflöde i `usePushNotifications.ts` som begär notisbehörighet endast från ett uttryckligt användarklick.
- [x] Hämta FCM-token med Firebase Messaging och `VITE_FIREBASE_VAPID_KEY` via miljökonfiguration; runtime-flöde med den genererade nyckeln behöver fortfarande verifieras i webbläsare.
- [x] Skapa/uppdatera enhetsregistrering efter autentiserad användare och lyckad tokenhämtning.
- [x] Lägg till regler som låter en inloggad användare hantera enbart sina egna enhetsregistreringar och hindrar ägarbyte; verifierat med Rules-emulator.
- [ ] Uppdatera token vid förändring och ta bort/inaktivera token vid avstängning eller utloggning enligt beslutad policy.
- [ ] Gör inställningsvyns status begriplig för behörighet nekad, token saknas, offline och aktiv registrering.
- [ ] Behåll nuvarande lokala inställningsbeteende som fallback tills serverregistrering är verifierad.

**Godkänd när:** tester visar att token aldrig registreras för fel användare, avstängning tar bort enhetens mottagning och behörighetsnekad väg inte kastar fel.

**Avbryt/återställ:** dölj/avaktivera nya inställningsflödet med feature flag, behåll befintlig settings-växel och ta bort endast testtoken från emulatorn. Ändra inte användarens OS-behörighet.

### 4. Service worker och mottagning

- [x] Integrera Firebase Messaging background handler med den befintliga PWA/Workbox-workern i `src/sw.ts`.
- [ ] Säkerställ att endast en avsedd service worker kontrollerar PWA:ns scope; verifiera uppdatering från nuvarande installerade worker.
- [ ] Visa notisen med `ServiceWorkerRegistration.showNotification()` och stabilt `tag` så dubbletter kan ersättas.
- [ ] Hantera klick på notisen: öppna/återanvänd appfönster och navigera till relevant uppgift om sådan route finns.
- [ ] Lägg till fallback för browsers/enheter som saknar FCM-stöd utan att appen kraschar.
- [ ] Kontrollera cache/offline-beteende efter att worker-strategin ändrats.

**Godkänd när:** lokala browser-tester visar mottagning, notis och klickflöde, samtidigt som befintlig offline-cache fortfarande fungerar.

**Avbryt/återställ:** återställ föregående worker-konfiguration i klientkoden och deploya den bara efter godkännande. Rensa inte aktiv worker/cache automatiskt; testa uppdateringsvägen på staging först.

### 5. Leveranslogik och felhantering

- [x] Vid taskändring beräknar backend aktuell `reminderAt` utifrån due date, offset, status och beslutad tidszon.
- [x] Avboka jobb när uppgiften tas bort, slutförs, datum tas bort eller påminnelse nollställs; full livscykeltestning återstår.
- [x] Schemalagd funktion hämtar endast jobb som förfallit och har status `pending`.
- [x] Gör claim/övergång till `processing` atomisk så samtidiga körningar normalt inte skickar samma jobb parallellt.
- [x] Läs task och enhetsregistreringar på nytt precis före sändning; hoppa över inaktuella, avstängda och försenade jobb enligt policy.
- [x] Skicka notis med minimal information: uppgiftstitel och task-ID som destination; riktig FCM-leverans är inte aktiverad.
- [x] Markera lyckade leveranser och hantera permanent ogiltiga tokens genom att rensa dem; mockad delivery är verifierad, riktig FCM-leverans återstår.
- [ ] Lägg till begränsade återförsök för tillfälliga FCM-/Firestore-fel och dokumentera möjligheten till enstaka dubblett vid krasch mellan sändning och statusuppdatering.
- [x] Skydda mot trigger-loopar och händelser som kommer i fel ordning genom att jämföra jobbets revision med uppgiftens aktuella data; äldre event är verifierat med Firestore-emulator.

**Godkänd när:** tester täcker skapa, ändra, avboka, slutföra, ta bort, omleverans, parallell körning, ogiltig token, tidszon/DST och försenat jobb.

**Avbryt/återställ:** stäng av kill switch och schemalagd sändning. Behåll jobbdokument för felsökning tills beslut fattats om rensning.

### 6. Migrering och bakfyllnad av befintliga påminnelser

- [ ] Skapa idempotent backfill-kommando som hittar befintliga aktiva tasks med `reminder` och `dueDate`.
- [ ] Kör först i dry-run och rapportera antal giltiga, ogiltiga och tidszonsberoende dokument utan att ändra dem.
- [ ] Verifiera hur datumsträngar, gamla `Timestamp`-värden, saknade fält och slutförda tasks hanteras.
- [ ] Kör backfill i emulator och verifiera att upprepad körning inte skapar dubbla jobb.
- [ ] Skapa en kontrollerad rollbackrapport med vilka jobb som skapats, så dessa kan avbrytas utan att ändra tasks.
- [ ] Vänta på separat godkännande innan backfill körs mot staging eller produktion.

**Godkänd när:** dry-run-resultat är granskat, tidszon för befintliga datum är accepterad och backfill kan köras om säkert.

**Avbryt/återställ:** avbryt innan skrivläge eller radera endast jobb som backfillen själv skapat. Ändra inte taskdokument vid rollback.

### 7. Testning i staging

- [ ] Skapa/separera ett staging-Firebase-projekt och registrera web app/VAPID-nyckel där.
- [ ] Deploya regler, index, Functions och worker-konfiguration till staging först.
- [ ] Kör `npm run type-check`, `npm run lint`, relevanta unit-/Functions-tester och full `npm run validate`.
- [ ] Kör Firebase Emulator Suite-test för tasktrigger, jobbkö, regler och leveransadapter.
- [ ] Använd FCM-sändningsadapter/mock i CI; automatiserade tester får inte skicka riktiga pushnotiser.
- [ ] Testa på installerad PWA på Samsung Galaxy S23/Chrome: app öppen, i bakgrunden, stängd, offline vid schemalagd tid, återansluten, notis klickad, behörighet nekad och notiser av/på.
- [ ] Kontrollera Chrome/Android batteri- och notisinställningar och dokumentera OS-begränsningar.
- [ ] Kontrollera att gammal installerad PWA uppdaterar service worker utan att behöva ominstallation.
- [ ] Mät kostnad/antal körningar i staging och kontrollera att loggar inte innehåller tokens eller onödiga personuppgifter.

**Godkänd när:** alla automatiska kontroller är gröna och manuella Android-scenarier ger förväntat resultat. Dokumentera avvikelser i stället för att maskera OS-begränsningar.

**Avbryt/återställ:** inaktivera staging-kill switch och avregistrera staging-testenheter. Behåll staging-jobb/loggar tills verifieringen är dokumenterad; produktionsprojektet påverkas inte.

### 8. Produktionssättning med stoppknapp

- [ ] Bekräfta uttryckligen produktionsprojekt, budgetgräns, VAPID-konfiguration och tidpunkt för release.
- [ ] Sätt serverns kill switch till avstängt läge före deploy.
- [ ] Deploya regler, index och funktioner utan att skicka push.
- [ ] Kör produktions-backfill i dry-run och granska antal jobb/tidszoner.
- [ ] Aktivera klientregistrering stegvis; kontrollera tokenregistrering och felmätare.
- [ ] Kör godkänd backfill och jämför jobbantal mot dry-run.
- [ ] Aktivera serverutskick för intern testenhet först; kontrollera loggar, kostnad och leveranstid.
- [ ] Aktivera utskick för användare först efter uttryckligt klartecken.
- [ ] Övervaka fel, gamla jobb, ogiltiga tokens, jobbkölängd och uppskattad kostnad.

**Godkänd när:** intern kontroll fungerar, inga feltrender syns och utskick kan pausas utan dataförlust.

**Avbryt/återställ:** slå av kill switch omedelbart. Vid klientproblem, stäng av registreringsflödet och återställ föregående frontendversion efter godkännande. Ta inte bort tokens, jobb eller Firestore-data som första åtgärd.

### 9. Stabilisering och städning

- [ ] Följ upp leveransfel, försenade jobb, dubbletter, tokenförnyelse och användarens av/på-beteende.
- [ ] Ta bort den gamla `setTimeout`-schemaläggningen först när serverleveransen är verifierad och fallback-beslutet är dokumenterat.
- [ ] Lägg till rutin för att rensa gamla `sent`, `cancelled` och permanent `failed` jobb efter beslutad retentionstid.
- [ ] Dokumentera driftinstruktioner: pausa utskick, kontrollera kö, återställa funktion och rotera VAPID-konfiguration.
- [ ] Uppdatera användar-/utvecklardokumentation och release notes.
- [ ] Kör full `npm run validate` och backendens test/build-kommandon inför release.

**Godkänd när:** larm, kostnadsgränser, supportväg och retention är dokumenterade; lokal timer används inte längre som om den vore bakgrundssäker.

**Avbryt/återställ:** behåll servern avstängd via kill switch och återgå till tidigare klientflöde om det behövs. Radera resurser först efter separat beslut och export av nödvändiga felsökningsdata.

## Testmatris

| Område | Bevis som krävs |
| --- | --- |
| Datum och tidszon | Kl. 09:00 lokal datumsträng, offset 0/10/60/1440 min, tidszonbyte, DST-start/slut, ogiltigt datum och Firestore-tidsstämpel |
| Tasklivscykel | Skapa, ändra datum/offset, slutföra, återöppna, ta bort datum, avboka och radera task |
| Enheter | Två aktiva tokens, en utloggad enhet, tokenrotation, nekad behörighet och avstängd enhet |
| Leverans | App öppen/stängd, worker-klick, offline/återanslutning, försenad körning, tillfälligt/permanent FCM-fel |
| Säkerhet | Användare kan bara hantera egna enhetsregistreringar; klienten kan inte läsa eller skriva serverjobb |
| Drift | Kill switch, återförsök, idempotens, loggning utan tokens, index och kostnadsgräns |

## Klart när

- [ ] Installerad PWA på Galaxy S23 får en godkänd testpåminnelse när appen är stängd under normala Android-/Chrome-förhållanden.
- [ ] Påminnelser ändras eller avbokas korrekt när tasken ändras, slutförs eller tas bort.
- [ ] Push kan stängas av per beslutad inställningsmodell utan att användarens tasks raderas.
- [ ] Serverjobb är skyddade från klientskrivning, idempotenta och observerbara.
- [ ] Befintliga tasks har migrerats först efter granskat dry-run och uttryckligt godkännande.
- [ ] Automatiska tester, type-check, lint, build och E2E passerar; manuella Android-resultat är dokumenterade.
- [ ] Produktionssättning och eventuell kostnad är uttryckligen godkända.