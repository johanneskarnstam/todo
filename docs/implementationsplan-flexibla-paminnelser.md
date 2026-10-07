# Implementationsplan: Flexibla påminnelser

> Baserad på **Alternativ A – Enhetlig modell** med union-typen `TaskReminder`.  
> Bocka av varje delsteg när det är klart.

---

## Nuläge – vad som gäller i dag

| Begränsning | Var det sitter |
|---|---|
| Exakt en påminnelse per task (`reminder?: TaskReminder \| null`) | `src/types/index.ts`, `taskStore.ts` |
| Offset-only (`offsetMinutes: 0 \| 10 \| 60 \| 1440`) | `src/types/index.ts`, `functions/src/reminderJobs.ts` |
| Kräver `dueDate` för att vara eligible | `isReminderEligible()` i `functions/src/reminderJobs.ts` |
| UI döljer påminnelse om ingen deadline finns | `TaskDetailsPanel.vue` rad 311, 335 |
| Ett enda `reminderJobs/{taskId}`-dokument per task | `functions/src/index.ts` rad 49 |

---

## Datamodell efter migrering (Alternativ A)

```ts
// src/types/index.ts  (ny)
export interface RelativeReminder {
  mode: 'relative'
  offsetMinutes: number       // 0 = vid deadline, 10 = 10 min före, osv.
}

export interface AbsoluteReminder {
  mode: 'absolute'
  at: string                  // ISO 8601 datetime, ex. "2026-10-15T09:00"
  timeZone: string            // IANA-zon, ex. "Europe/Stockholm"
}

export type TaskReminder = RelativeReminder | AbsoluteReminder

export interface Task {
  // reminder?: ... (gammalt fält – läses bakåtkompatibelt, skrivs aldrig)
  reminders?: TaskReminder[]  // ny array (0–5 poster)
}
```

```
Firestore-dokument (users/{uid}/tasks/{taskId})
  reminders: [
    { mode: "absolute", at: "2026-10-15T09:00", timeZone: "Europe/Stockholm" },
    { mode: "relative", offsetMinutes: 10 }
  ]

Firestore jobb-sökväg (users/{uid}/reminderJobs/{taskId}_{index})
  reminderIndex: 0            // vilket element i reminders-arrayen
```

---

## Git-flöde

Arbeta på feature-branchen `feature/flexibla-paminnelser` under hela implementationen.  
Commita efter varje fas med commit-meddelande på svenska. Merga till `main` när Fas 6 är avbockad.

---

## Fas 1 – TypeScript-typer

**Mål:** Alla typdefinitioner är uppdaterade och kompilerar. Ingenting annat ändras ännu.

- [x] Skapa `git checkout -b feature/flexibla-paminnelser`
- [x] **`src/types/index.ts`**
  - [x] Lägg till `RelativeReminder`-interfacet
  - [x] Lägg till `AbsoluteReminder`-interfacet
  - [x] Byt ut `TaskReminder`-interfacet mot union-typen `TaskReminder = RelativeReminder | AbsoluteReminder`
  - [x] Lägg till `reminders?: TaskReminder[]` på `Task`-interfacet (behåll `reminder?` som `unknown` för läsning bakåtkompatibelt – se Fas 2)
- [x] **`functions/src/reminderJobs.ts`**
  - [x] Uppdatera `ReminderTaskSnapshot.reminder` mot union-typen
  - [x] Lägg till `ReminderTaskSnapshot.reminders?: TaskReminder[]`
  - [x] Lägg till `reminderIndex: number` på `ReminderJob`-interfacet
- [x] Kör `npm run type-check && npm run lint` – inga fel

---

## Fas 2 – Migrationslager i taskStore (läsning)

**Mål:** Gamla Firestore-dokument med `reminder: { offsetMinutes: N }` normaliseras automatiskt vid läsning. Inga Firestore-dokument skrivs om.

- [x] **Skapa `src/utils/taskNormalization.ts`**
  - [x] Exportera `normalizeTaskReminders(raw: unknown): TaskReminder[]` som:
    - Läser `raw.reminders` om det är en array → returnerar den direkt (validerar varje element)
    - Läser `raw.reminder` om det finns → konverterar `{ offsetMinutes }` till `RelativeReminder`
    - Returnerar `[]` om varken `reminders` eller `reminder` finns
  - [x] Enhetstestar för alla tre fallen (+ ogiltiga värden) i `src/__tests__/taskNormalization.test.ts`
- [x] **`src/stores/taskStore.ts`**
  - [x] Anropa `normalizeTaskReminders()` i Firestore-snapshot-hanteraren (där tasks hydrateras från Firestore)
  - [x] Säkerställ att `task.reminders` alltid sätts (aldrig `undefined`) efter normalisering
- [x] Kör `npm run type-check && npm run lint` – inga fel

---

## Fas 3 – taskStore-skrivningar

**Mål:** Store skriver alltid det nya `reminders`-fältet. Det gamla `reminder`-fältet tas bort vid nästa sparning.

- [x] **`src/stores/taskStore.ts`**
  - [x] Uppdatera `NewTaskInput`-interfacet: byt `reminder?: TaskReminder | null` mot `reminders?: TaskReminder[]`
  - [x] Uppdatera `createTask()`: skicka `reminders` till Firestore (inte `reminder`)
  - [x] Uppdatera `updateTask()`-signaturen: byt `{ reminder?: TaskReminder | null }` mot `{ reminders?: TaskReminder[] }`
  - [x] Uppdatera `updateTask()`: vid `reminders` i updates, lägg till `reminder: deleteField()` i Firestore-anropet (rensar gammalt fält)
  - [x] Uppdatera `setDueDate()` (rad 444–458): ta bort `task.reminder = null` och rensa `reminders` där mode = 'relative' om deadline tas bort
  - [x] Optimistisk uppdatering: `task.reminders` uppdateras lokalt innan Firestore-svar
- [x] Kör `npm run type-check && npm run lint` – inga fel
- [x] Commita: `feat: uppdatera taskStore för reminders-array och migrationslager`

---

## Fas 4 – Cloud Functions

**Mål:** Functions skapar ett `reminderJob`-dokument per påminnelse, hanterar absoluta tidpunkter och kräver inte `dueDate`.

- [x] **`functions/src/reminderJobs.ts`**
  - [x] Uppdatera `isReminderEligible(task, reminderIndex)`:
    - Absolut påminnelse: kräver inte `dueDate`, bara att `at` är i framtiden
    - Relativ påminnelse: kräver fortfarande `dueDate` + `dueTimeZone`
    - Avsluta tidigt om `task.completed` eller `status === 'completed'`
  - [x] Uppdatera `getReminderAt(task, reminderIndex)`: returnerar ISO-sträng för den specifika påminnelsen
  - [x] Uppdatera `getReminderJobId()` att inkludera `reminderIndex` i ID:t (`{userId}_{taskId}_{reminderIndex}`)
  - [x] Lägg till `getNextReminderIndex(task)`: returnerar index för nästa väntande påminnelse (valfritt hjälpfunktion)
- [x] **`functions/src/index.ts`** – `syncReminderJob`-triggern
  - [x] Iterera alla index i `task.reminders` (0 till max 4)
  - [x] Skapa/uppdatera jobb för varje eligible påminnelse med rätt jobb-ID
  - [x] Avbryt jobb vars index inte längre finns i arrayen
  - [x] Använd Firestore-batch för att skriva alla jobb atomärt
- [x] **`functions/src/delivery.ts`** – `processReminderJob`
  - [x] Läs `reminderIndex` från jobbet
  - [x] Validera mot `task.reminders[reminderIndex]` (inte `task.reminder`)
  - [x] Anropa `getReminderAt(task, reminderIndex)` vid jämförelse med `initialJob.reminderAt`
- [x] **`functions/test/reminderJobs.test.mjs`** – uppdatera/lägg till tester:
  - [x] `isReminderEligible` med absolut påminnelse utan `dueDate` → true
  - [x] `isReminderEligible` med relativ påminnelse utan `dueDate` → false
  - [x] `getReminderAt` med absolut påminnelse → returnerar `at`-värdet direkt
  - [x] `getReminderAt` med gammalt `reminder`-fält (bakåtkompatibilitet) → konverteras korrekt
  - [x] Bakåtkompatibilitet: task med `reminder: { offsetMinutes: 10 }` (utan `mode`) → hanteras
- [x] Kör `npm run type-check && npm run lint` i `/functions`
- [x] Kör `npm test` i `/functions` – alla tester gröna
- [x] Commita: `feat: uppdatera Cloud Functions för multipla och absoluta påminnelser`

---

## Fas 5 – UI-komponenter

**Mål:** Användaren kan lägga till, se och ta bort flera påminnelser av båda typerna, utan krav på deadline.

### 5a – Ny komponent `ReminderEditor.vue`

- [ ] **Skapa `src/components/ReminderEditor.vue`**
  - [ ] Props: `modelValue: TaskReminder | null`, `dueDate: string`
  - [ ] Emit: `update:modelValue`, `cancel`
  - [ ] Lägesval: Om `dueDate` saknas är endast "Absolut" tillgängligt (relativt alternativ är inaktiverat/dolts). Om `dueDate` finns kan användaren växla mellan "Relativ" och "Absolut".
  - [ ] **Relativt läge (endast tillgängligt om deadline finns):**
    - Dropdown med alternativen: Vid förfallotid (0), 10 min före, 1 timme före, 2 timmar före, 1 dag före
  - [ ] **Absolut läge (alltid tillgängligt):**
    - `<input type="date" id="reminder-date">` + `<input type="time" id="reminder-time">`
    - Visa IANA-zon (hämta med `Intl.DateTimeFormat().resolvedOptions().timeZone`)
    - Validering: tidpunkten måste vara i framtiden
  - [ ] Spara-knapp disabled om ogiltigt val
  - [ ] `data-testid="reminder-editor"`

### 5b – Uppdatera `TaskDetailsPanel.vue`

- [ ] Ta bort villkoret `!props.task.dueDate` som blockerar påminnelsesektionen (rad 311, 335)
- [ ] Ersätt befintlig reminder-dropdown med en lista av aktiva påminnelser:
  - [ ] `v-for="(reminder, index) in task.reminders"` med ta-bort-knapp per rad
  - [ ] Visa beräknad tidpunkt för relativa påminnelser (befintlig `reminderDateText`-logik, anpassad)
  - [ ] Visa `at`-värdet formaterat för absoluta påminnelser
- [ ] "Lägg till påminnelse"-knapp som öppnar `ReminderEditor` inline (dold om `reminders.length >= 5`)
- [ ] Spara ny påminnelse: emit `'save-reminders'` med uppdaterad array
- [ ] Ta bort påminnelse: emit `'save-reminders'` med filtrerad array
- [ ] Uppdatera `emit`-definitionen: ta bort `'save-reminder'`, lägg till `'save-reminders'`

### 5c – Uppdatera `TaskRow.vue`

- [ ] Visa den närmaste påminnelsen som chip/ikon (befintlig logik anpassad)
- [ ] Om `reminders.length > 1` visa `+N` brevid ikonen
- [ ] Uppdatera `reminderDateText` computed: iterera `reminders` och returnera närmaste

### 5d – Uppdatera vyn/föräldern som hanterar emits

- [ ] Hitta var `'save-reminder'`-eventet tas emot (troligen `TaskView.vue` eller liknande)
- [ ] Byt till `'save-reminders'` och anropa `taskStore.updateTask(taskId, { reminders })`

- [ ] Kör `npm run type-check && npm run lint` – inga fel

---

## Fas 6 – Tester

**Mål:** Täckningsgaten bibehålls (Statements ≥70%, Branches ≥55%, Functions ≥65%, Lines ≥75%).

### Enhetstester (Vitest)

- [ ] **`src/__tests__/taskNormalization.test.ts`** (skapades i Fas 2, komplettera):
  - [ ] Gammalt dokument med `reminder: { offsetMinutes: 60 }` → `reminders: [{ mode: 'relative', offsetMinutes: 60 }]`
  - [ ] Dokument med `reminders: [...]` → passeras igenom oförändrat
  - [ ] Dokument utan vare sig fält → `reminders: []`
  - [ ] Ogiltiga värden i `reminders`-arrayen → filtreras bort
- [ ] **`src/__tests__/ReminderEditor.test.ts`**:
  - [ ] Renderas utan `dueDate` → endast absolut läge är valbart (relativt är inaktiverat/dolts)
  - [ ] Renderas med `dueDate` → både relativt och absolut läge kan väljas
  - [ ] Välj datum i det förflutna → spara-knapp disabled
  - [ ] Giltigt val → `update:modelValue` emitteras korrekt

### E2E-tester (Playwright)

- [ ] **`e2e/reminders.spec.ts`** (ny fil eller utöka befintlig):
  - [ ] Öppna en task utan deadline → påminnelsesektionen är synlig och tillåter absolut påminnelse
  - [ ] Lägg till absolut påminnelse → visas i listan med korrekt datum/tid
  - [ ] Uppgift utan deadline → relativt alternativ kan inte väljas
  - [ ] Lägg till deadline och därefter relativ påminnelse → beräknad tid visas
  - [ ] Ta bort deadline från uppgift med relativ och absolut påminnelse → relativ rensas, absolut finns kvar
  - [ ] Lägg till två påminnelser → båda visas i `TaskDetailsPanel`
  - [ ] Ta bort en påminnelse → listan uppdateras optimistiskt
  - [ ] Task med gammalt `reminder`-format (mockas via mock-auth-data) → normaliseras och visas korrekt
  - [ ] Kan inte lägga till fler än 5 påminnelser ("Lägg till"-knapp dold vid 5 påminnelser)

- [ ] Kör `npm run validate` – alla kontroller gröna
- [ ] Commita: `feat: lägg till flexibla och multipla påminnelser`

---

## Fas 7 – Versionsuppdatering och merge

- [ ] Öka version i `package.json` (MINOR – ny bakåtkompatibel funktion): `x.Y.0`
- [ ] Kör `npm run validate` en sista gång
- [ ] `git checkout main && git merge feature/flexibla-paminnelser`
- [ ] `git branch -d feature/flexibla-paminnelser`

---

## Fastställda beslut (klara)

| # | Fråga | Beslut |
|---|---|---|
| 1 | Relativ påminnelse utan deadline | **Kan inte väljas alls.** Saknas deadline är endast absolut påminnelse valbar i gränssnittet. |
| 2 | Max antal påminnelser per task | **Max 5 stycken.** "Lägg till"-knappen döljs när gränsen nås. |
| 3 | Notifikationstext | **Bara uppgiftens titel** (t.ex. `"Handla mat"`). Ingen extra text eller tidsangivelse läggs till. |
| 4 | Rensa relativa påminnelser när deadline tas bort | **Rensas automatiskt.** Tas deadlinen bort raderas relativa påminnelser (eftersom de inte längre kan beräknas), medan absoluta påminnelser bevaras. |
