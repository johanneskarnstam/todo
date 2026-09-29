# Förbättringar och nya funktioner

Det här är en prioriterad lista över funktioner som kan göra appen mer användbar i vardagen. Rangordningen väger in hur ofta funktionen behövs, hur mycket tid den sparar och hur väl den passar appens nuvarande struktur.

## Prioritet 1: Högst nytta

### 1. Återkommande uppgifter

**Nytta:** Mycket hög

Stöd för uppgifter som återkommer dagligen, veckovis, månadsvis eller enligt ett eget intervall. Det passar särskilt bra för hushåll, träning, rutiner och arbetsuppgifter.

**Förslag på omfattning:**
- Välj upprepning: varje dag, vardagar, vecka, månad eller eget intervall.
- Välj eventuell veckodag eller dag i månaden.
- Skapa nästa förekomst automatiskt när uppgiften markeras som klar.
- Behåll historik så att tidigare förekomster inte skrivs över.

### 2. Sökning och filtrering

**Nytta:** Mycket hög

Global sökning finns redan för uppgiftstitlar, anteckningar, taggar och listnamn. Komplettera den med delsteg och filter så att det blir lättare att hitta rätt när antalet listor och uppgifter växer.

**Förslag på omfattning:**
- Sök även i delsteg och lägg till en tangentbordsgenväg.
- Filtrera på lista, mapp, status, viktighet, Min dag och förfallodatum.
- Gruppera uppgifter per lista i sökresultaten.
- Ge möjlighet att rensa sökning och filter med ett klick.

## Prioritet 2: Stor vardagsnytta

### 3. Dra-och-släpp mellan listor

**Nytta:** Hög

Utöka den befintliga sorteringen så att en uppgift kan flyttas från en lista till en annan utan att öppna detaljpanelen. Det gör omorganisering snabbare, särskilt vid planering.

**Förslag på omfattning:**
- Dra en uppgift mellan listkolumner i vyn Alla listor för att flytta den till en annan lista.

### 4. Prioritetsnivåer utöver Viktig

**Nytta:** Hög

Ersätt eller komplettera den binära markeringen Viktig med exempelvis låg, normal, hög och brådskande. Det ger bättre stöd när många uppgifter konkurrerar om uppmärksamheten.

### 5. Produktivitetsstatistik

**Nytta:** Medelhög

Visa enkel statistik över slutförda uppgifter, försenade uppgifter och vanor över tid. Informationen bör vara fokuserad och frivillig, inte utformad som ett prestationskrav.

**Förslag på omfattning:**
- Slutförda uppgifter per dag eller vecka.
- Antal försenade uppgifter.
- Enkel översikt per lista.
- Filtrering på tidsperiod.

### 6. Snabbtillägg via naturligt språk

**Nytta:** Medelhög

Tillåt att en uppgift skapas med text som `Ring banken imorgon kl 10 #ekonomi`. Appen kan tolka datum, tid, prioritet och taggar utan att användaren behöver öppna detaljpanelen.

**Förslag på omfattning:**
- Börja med ett litet och förutsägbart format.
- Visa alltid vad som tolkades innan uppgiften sparas.
- Låt användaren redigera resultatet manuellt.

## Prioritet 3: Samarbete och flexibilitet

### 7. Delade listor och samarbete

**Nytta:** Medelhög till hög

Låt användaren dela en lista med andra Firebase-användare och tilldela uppgifter. Det är en vanlig funktion i större todo-appar och skulle göra appen användbar för hushåll och mindre team.

**Förslag på omfattning:**
- Roller för läsning och redigering.
- Inbjudan via e-post eller användar-id.
- Synkronisering av ändringar mellan användare.
- Tydlig ägare och möjlighet att sluta dela.

### 8. Kommentarer och aktivitetslogg

**Nytta:** Medelhög

För delade listor kan användare kommentera uppgifter och se vem som ändrade vad. En aktivitetslogg kan även hjälpa vid felsökning av oavsiktliga ändringar.

### 9. Import och export

**Nytta:** Medelhög

Gör det möjligt att exportera uppgifter som JSON eller CSV och importera dem igen. Det ger användaren kontroll över sina data och förenklar flytt från andra appar.

**Förslag på omfattning:**
- Exportera listor, mappar, uppgifter, delsteg och datum.
- Importera en validerad JSON-fil.
- Visa en sammanfattning innan importen genomförs.
- Hantera dubbletter på ett förutsägbart sätt.

### 10. Anpassade kortkommandon

**Nytta:** Medelhög

Lägg till kortkommandon för att skapa en uppgift, söka, byta vy, markera som klar och flytta mellan listor. Det passar särskilt bra för användare som arbetar mycket vid tangentbord.

### 11. Anpassade teman och fler listikoner

**Nytta:** Medel

Utöka de befintliga färgtemana med fler ikoner och möjlighet att välja accentfärg. Funktionen gör listor lättare att skilja åt, men bör komma efter funktioner som påverkar arbetsflödet direkt.

## Prioritet 4: Kvalitet och långsiktig robusthet

### 12. Synkroniseringsstatus och konflikthantering

**Nytta:** Hög för förtroende, medelhög för daglig användning

Visa om ändringar är lokala, synkroniserade eller väntar på nätverk. Vid ändringar från flera enheter bör användaren få en begriplig hantering av konflikter i stället för att en version tyst skrivs över.

### 13. Tillgänglighetsförbättringar

**Nytta:** Hög

Gör hela appen användbar med tangentbord och skärmläsare och säkerställ tillräckliga kontraster.

**Förslag på omfattning:**
- Korrekt fokusordning och synlig fokusmarkering.
- ARIA-labels för ikonknappar.
- Fullt tangentbordsstöd för drag-and-drop-alternativ.
- Respekt för inställningen för minskad rörelse.

### 14. Prestanda för stora datamängder

**Nytta:** Medelhög nu, hög när appen växer

Optimera läsning och rendering när användaren har många uppgifter och delsteg. Möjliga åtgärder är paginering, inkrementell laddning och att undvika separata läsningar för varje delsteg när det går.

### 15. Utökade tester för kritiska användarflöden

**Nytta:** Hög för fortsatt utveckling

Bygg ut testerna kring offline-läge, optimistiska ändringar, återställning efter skrivfel, datumgruppering och behörigheter för delade listor. Detta minskar risken att nya funktioner bryter den befintliga kärnan.

## Rekommenderad genomförandeordning

1. Återkommande uppgifter
2. Sökning och filtrering
3. Dra-och-släpp mellan listor
4. Delade listor och samarbete
5. Import och export
6. Synkroniseringsstatus, tillgänglighet och utökade tester

Den ordningen ger först funktioner som förbättrar den dagliga användningen för en enskild användare. Därefter kan samarbete och mer avancerad organisering byggas ovanpå en stabilare uppgiftsmodell.