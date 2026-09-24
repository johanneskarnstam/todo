# Förbättringar och nya funktioner

Det här är en prioriterad lista över funktioner som kan göra appen mer användbar i vardagen. Rangordningen väger in hur ofta funktionen behövs, hur mycket tid den sparar och hur väl den passar appens nuvarande struktur.

## Prioritet 1: Högst nytta

### 1. Påminnelser och aviseringar

**Status:** Implementerad

**Nytta:** Mycket hög

Låt användaren ange datum och klockslag för en påminnelse och skicka en webbläsar- eller PWA-avisering när det är dags. Påminnelser är ett av de viktigaste komplementen till förfallodatum eftersom de gör att appen aktivt hjälper användaren att komma ihåg uppgifter.

**Förslag på omfattning:**
- Lägg till tid utöver dagens nuvarande förfallodatum.
- Stöd för påminnelse före förfallodatum, till exempel 10 minuter, 1 timme eller 1 dag.
- Visa tydligt om en uppgift har en aktiv påminnelse.
- Hantera nekad aviseringstillgång och offline-läge utan att förlora inställningen.

### 2. Återkommande uppgifter

**Nytta:** Mycket hög

Stöd för uppgifter som återkommer dagligen, veckovis, månadsvis eller enligt ett eget intervall. Det passar särskilt bra för hushåll, träning, rutiner och arbetsuppgifter.

**Förslag på omfattning:**
- Välj upprepning: varje dag, vardagar, vecka, månad eller eget intervall.
- Välj eventuell veckodag eller dag i månaden.
- Skapa nästa förekomst automatiskt när uppgiften markeras som klar.
- Behåll historik så att tidigare förekomster inte skrivs över.

### 3. Sökning och filtrering

**Nytta:** Mycket hög

Lägg till global sökning efter titel, anteckning och delsteg. När antalet listor och uppgifter växer blir sökning snabbare än att öppna flera listor.

**Förslag på omfattning:**
- Sök med kortkommando och från appens toppfält.
- Filtrera på lista, mapp, status, viktighet, Min dag och förfallodatum.
- Visa resultat grupperade per lista.
- Ge möjlighet att rensa filter med ett klick.

### 4. Bättre datumhantering och kalenderöversikt

**Status:** Implementerad

**Nytta:** Hög

Gör det enklare att välja datum och förstå vad som behöver göras över tid. Den befintliga vyn Planerat är en bra grund för detta.

**Förslag på omfattning:**
- Snabbval för idag, imorgon, nästa vecka och inget datum.
- Kalenderläge med dag-, vecko- eller månadsöversikt.
- Markera försenade uppgifter tydligare.
- Stöd för att flytta ett förfallodatum direkt från kalendern.

### 5. Ångra och återställning

**Status:** Implementerad för uppgifter, delsteg och listor

**Nytta:** Hög

Visa en ångra-åtgärd efter att användaren har tagit bort eller ändrat en uppgift, ett delsteg eller en lista. Optimistisk UI gör appen snabb, men ökar värdet av en tydlig återställningsmöjlighet.

**Förslag på omfattning:**
- Ångra senaste borttagningen via toast-meddelande.
- Papperskorg med möjlighet att återställa eller radera permanent.
- Behåll ändringar lokalt tills synkronisering är bekräftad.

## Prioritet 2: Stor vardagsnytta

### 6. Dra-och-släpp mellan listor

**Nytta:** Hög

Utöka den befintliga sorteringen så att en uppgift kan flyttas från en lista till en annan utan att öppna detaljpanelen. Det gör omorganisering snabbare, särskilt vid planering.

### 7. Taggar eller etiketter

**Status:** Implementerad

**Nytta:** Hög

Låt användaren märka uppgifter med etiketter som `jobb`, `hem`, `ärenden` eller `personligt`. Taggar kompletterar mappar eftersom samma uppgift kan tillhöra flera sammanhang.

**Förslag på omfattning:**
- Skapa, byt namn på och ta bort taggar.
- Filtrera och sök på en eller flera taggar.
- Visa taggar diskret i uppgiftsraden.

### 8. Prioritetsnivåer utöver Viktig

**Nytta:** Hög

Ersätt eller komplettera den binära markeringen Viktig med exempelvis låg, normal, hög och brådskande. Det ger bättre stöd när många uppgifter konkurrerar om uppmärksamheten.

### 9. Produktivitetsstatistik

**Nytta:** Medelhög

Visa enkel statistik över slutförda uppgifter, försenade uppgifter och vanor över tid. Informationen bör vara fokuserad och frivillig, inte utformad som ett prestationskrav.

**Förslag på omfattning:**
- Slutförda uppgifter per dag eller vecka.
- Antal försenade uppgifter.
- Enkel översikt per lista.
- Filtrering på tidsperiod.

### 10. Snabbtillägg via naturligt språk

**Nytta:** Medelhög

Tillåt att en uppgift skapas med text som `Ring banken imorgon kl 10 #ekonomi`. Appen kan tolka datum, tid, prioritet och taggar utan att användaren behöver öppna detaljpanelen.

**Förslag på omfattning:**
- Börja med ett litet och förutsägbart format.
- Visa alltid vad som tolkades innan uppgiften sparas.
- Låt användaren redigera resultatet manuellt.

## Prioritet 3: Samarbete och flexibilitet

### 11. Delade listor och samarbete

**Nytta:** Medelhög till hög

Låt användaren dela en lista med andra Firebase-användare och tilldela uppgifter. Det är en vanlig funktion i större todo-appar och skulle göra appen användbar för hushåll och mindre team.

**Förslag på omfattning:**
- Roller för läsning och redigering.
- Inbjudan via e-post eller användar-id.
- Synkronisering av ändringar mellan användare.
- Tydlig ägare och möjlighet att sluta dela.

### 12. Kommentarer och aktivitetslogg

**Nytta:** Medelhög

För delade listor kan användare kommentera uppgifter och se vem som ändrade vad. En aktivitetslogg kan även hjälpa vid felsökning av oavsiktliga ändringar.

### 13. Import och export

**Nytta:** Medelhög

Gör det möjligt att exportera uppgifter som JSON eller CSV och importera dem igen. Det ger användaren kontroll över sina data och förenklar flytt från andra appar.

**Förslag på omfattning:**
- Exportera listor, mappar, uppgifter, delsteg och datum.
- Importera en validerad JSON-fil.
- Visa en sammanfattning innan importen genomförs.
- Hantera dubbletter på ett förutsägbart sätt.

### 14. Anpassade kortkommandon

**Nytta:** Medelhög

Lägg till kortkommandon för att skapa en uppgift, söka, byta vy, markera som klar och flytta mellan listor. Det passar särskilt bra för användare som arbetar mycket vid tangentbord.

### 15. Anpassade teman och fler listikoner

**Nytta:** Medel

Utöka de befintliga färgtemana med fler ikoner och möjlighet att välja accentfärg. Funktionen gör listor lättare att skilja åt, men bör komma efter funktioner som påverkar arbetsflödet direkt.

## Prioritet 4: Kvalitet och långsiktig robusthet

### 16. Synkroniseringsstatus och konflikthantering

**Nytta:** Hög för förtroende, medelhög för daglig användning

Visa om ändringar är lokala, synkroniserade eller väntar på nätverk. Vid ändringar från flera enheter bör användaren få en begriplig hantering av konflikter i stället för att en version tyst skrivs över.

### 17. Tillgänglighetsförbättringar

**Nytta:** Hög

Gör hela appen användbar med tangentbord och skärmläsare och säkerställ tillräckliga kontraster.

**Förslag på omfattning:**
- Korrekt fokusordning och synlig fokusmarkering.
- ARIA-labels för ikonknappar.
- Fullt tangentbordsstöd för drag-and-drop-alternativ.
- Respekt för inställningen för minskad rörelse.

### 18. Prestanda för stora datamängder

**Nytta:** Medelhög nu, hög när appen växer

Optimera läsning och rendering när användaren har många uppgifter och delsteg. Möjliga åtgärder är paginering, inkrementell laddning och att undvika separata läsningar för varje delsteg när det går.

### 19. Utökade tester för kritiska användarflöden

**Nytta:** Hög för fortsatt utveckling

Bygg ut testerna kring offline-läge, optimistiska ändringar, återställning efter skrivfel, datumgruppering och behörigheter för delade listor. Detta minskar risken att nya funktioner bryter den befintliga kärnan.

## Rekommenderad genomförandeordning

1. Påminnelser och aviseringar
2. Återkommande uppgifter
3. Sökning och filtrering
4. Bättre datumhantering och kalenderöversikt
5. Ångra och återställning
6. Dra-och-släpp mellan listor
7. Taggar eller etiketter
8. Delade listor och samarbete
9. Import och export
10. Synkroniseringsstatus, tillgänglighet och utökade tester

Den ordningen ger först funktioner som förbättrar den dagliga användningen för en enskild användare. Därefter kan samarbete och mer avancerad organisering byggas ovanpå en stabilare uppgiftsmodell.