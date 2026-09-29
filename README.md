# Todo App

En modern, responsiv och offline-first att-göra-app inspirerad av Microsoft To Do. Appen erbjuder en ren, intuitiv användarupplevelse för att hantera uppgifter, listor, mappar och delsteg.

![Vue 3](https://img.shields.io/badge/Vue-3-brightgreen) ![Firebase](https://img.shields.io/badge/Firebase-12.13.0-orange) ![Pinia](https://img.shields.io/badge/Pinia-3.0.4-yellow) ![TypeScript](https://img.shields.io/badge/TypeScript-6.0.3-blue)

## 📌 Funktioner

### 🔐 Autentisering
- **Google-inloggning**: Säker autentisering via Firebase Authentication
- **Sessionhantering**: Automatisk inloggningsstatus med offline-stöd

### 📁 Organisationsstruktur
- **Mappar (Folders)**: Skapa och hantera mappar för att gruppera listor
- **Listor (Lists)**: Skapa obegränsade antalet listor, antingen i mappar eller som fristående
- **Färgteman**: Anpassa listor med olika färgteman (blå, grön, röd, lila, turkos, orange)

### 📝 Uppgiftshantering
- **Skapa, redigera och ta bort uppgifter**: Fullständig CRUD-funktionalitet
- **Markera som slutförd**: Enkelt klicka för att markera uppgifter som klara
- **Viktiga uppgifter**: Markera uppgifter som viktiga med stjärnikon
- **Min dag (My Day)**: Lägg till uppgifter i "Min dag" för att fokusera på dagens prioriteringar
- **Förfallodatum och tid**: Planera uppgifter med datum och valfri tid
- **Påminnelser**: Välj notis vid förfallotid eller 10 minuter, 1 timme eller 1 dag före
- **Anteckningar**: Lägg till detaljerade anteckningar till uppgifter
- **Sortering**: Drag-and-drop-funktionalitet för att ordna om uppgifter och listor

### 📋 Delsteg (Steps)
- **Skapa delsteg**: Bryt ner uppgifter i mindre, hanterbara steg
- **Markera delsteg som klara**: Spåra framsteg på delsteg
- **Redigera och ta bort delsteg**: Full kontroll över delsteg

### 🎯 Smarta vyer
- **Min dag**: Visa alla uppgifter markerade för "Min dag"
- **Viktigt**: Visa alla uppgifter markerade som viktiga
- **Planerat**: Visa alla uppgifter med förfallodatum, grupperade efter:
  - Försenade (över förfallodatum)
  - Idag
  - Imorgon
  - Senare

### 🔔 Notiser
- **Pushpåminnelser**: Få uppgiftsnotiser även när PWA:n inte är öppen, i webbläsare och på enheter som stöder Web Push
- **Enhetsbaserat samtycke**: Aktivera eller stäng av notiser separat för varje installation under Inställningar
- **Öppna uppgiften**: Tryck på en notis för att gå till den tillhörande uppgiften
- **Tidszoner**: Datum utan klockslag tolkas som 09:00 i Europe/Stockholm

Push kräver att användaren tillåter notiser och att enheten/webbläsaren kan ta emot Web Push. Leverans kan påverkas av nätverk, operativsystem och batteriinställningar.

### 🌐 Internationell support
- **Flerspråkig**: Stöd för Svenska och Engelska
- **Språkinställningar**: Välj språk i inställningar

### 🎨 Design & Användarupplevelse
- **Responsiv design**: Optimerad för mobil, surfplatta och desktop
- **Mörkt läge**: Automatisk eller manuell växling mellan ljust och mörkt läge
- **Offline-first**: Arbeta offline med lokal cache, synkronisering sker automatiskt när anslutning återställs
- **Optimistisk UI**: Omedelbar feedback vid åtgärder, ingen väntan på server-svar
- **Microsoft To Do-inspirerad**: Bekant layout med sidomeny och huvudområde

### ⚙️ Inställningar
- **Profilhantering**: Visa användarinformation
- **Språkinställningar**: Välj mellan Svenska och Engelska
- **Notiser för påminnelser**: Hantera pushbehörighet och registrering för den aktuella enheten
- **Utloggning**: Säker utloggning

### 🔧 Tekniska funktioner
- **PWA (Progressive Web App)**: Installera som app på din enhet
- **Formulärvalidering**: Klient-sida validering
- **Felhantering**: Robust felhantering med användarvänliga meddelanden
- **Lokal lagring**: Sparar inställningar som sidomeny-status och språkval

---

## 🛠 Teknisk Stack

### Frontend
- **Ramverk**: [Vue 3](https://vuejs.org/) (Composition API)
- **Byggverktyg**: [Vite](https://vitejs.dev/)
- **Språk**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (Mobile-first, Dark mode)

### State Management
- **Pinia**: Global state management för autentisering, listor, uppgifter och steg

### Backend & Databas
- **Firebase v12.13.0**:
  - **Authentication**: Google-inloggning
  - **Firestore**: NoSQL-databas med offline-stöd
- **Cloud Functions for Firebase**: Synkroniserar serverhanterade påminnelsejobb och levererar förfallna notiser
- **Cloud Scheduler**: Söker efter förfallna jobb varje minut
- **Firebase Cloud Messaging**: Web Push till registrerade enheter

### Routing, Testning & Övrigt
- **Vue Router v5**: Klient-sida routing med navigation guards
- **Vitest**: Enhetstestning
- **Playwright**: E2E-testning i riktig browser
- **ESLint & Prettier**: Kodlintering och formatering
- **PWA**: vite-plugin-pwa

---

## 📁 Projektstruktur

```
todo/
├── src/
│   ├── assets/              # Statiska tillgångar
│   ├── components/          # Återanvändbara UI-komponenter
│   │   ├── TaskDetailsPanel.vue
│   │   ├── TaskRow.vue
│   │   ├── TodoHeader.vue
│   │   └── TodoSidebar.vue
│   ├── firebase.ts          # Firebase-konfiguration
│   ├── i18n/                # Internationella översättningar
│   │   └── index.ts
│   ├── main.ts              # Appens ingångspunkt
│   ├── router/              # Vue Router-konfiguration
│   │   └── index.ts
│   ├── stores/              # Pinia-stores
│   │   ├── auth.ts
│   │   ├── listStore.ts
│   │   └── taskStore.ts
│   ├── types/               # TypeScript-typer
│   │   └── index.ts
│   ├── App.vue
│   └── views/
│       ├── HomeView.vue
│       ├── LoginView.vue
│       └── SettingsView.vue
├── package.json
├── e2e/                     # Browserbaserade Playwright-tester
├── playwright.config.ts
└── README.md
```

---

## 🚀 Snabbstart

### Förutsättningar
- Node.js v20.19.0 eller högre
- npm eller yarn
- Firebase-projekt

### Installation
1. **Installera beroenden:**
   ```sh
   npm install
   ```

2. **Konfigurera Firebase:**
   ```sh
   # Klistra in firebaseConfig i scripts/pasted_secret_config.js
   npm run generate-env
   ```

3. **Aktivera Firebase-tjänster:**
   - Authentication (Google-provider)
   - Firestore Database

4. **Starta utvecklingsservern:**
   ```sh
   npm run dev
   ```
   Appen är tillgänglig på `http://localhost:5173`

---

## 📦 Bygg och distribution

### Bygg för produktion
```sh
npm run build
```

### Förhandsgranska bygg
```sh
npm run preview
```

### Kör enhetstester
```sh
npm run test:unit
```

### Mät kodtäckning

Coverage körs med V8 och har minimikrav för statements, branches, functions och lines. Körningen misslyckas om täckningen sjunker under kraven.

```sh
npm run test:coverage
```

HTML-rapporten skapas i `coverage/`.

### Kör E2E-tester

E2E-testerna använder lokalt mock-auth och demo-data. Ingen Firebase-inloggning krävs.

```sh
npm run test:e2e
```

På macOS används installerad Google Chrome automatiskt. För headed mode eller Playwright UI mode:

```sh
npm run test:e2e:headed
npm run test:e2e:ui
```

I CI används Playwright Chromium. Installera browsern en gång i CI med `npx playwright install --with-deps chromium`.

### Kör alla valideringar
```sh
npm run validate
```

`npm run validate` kör lint, type-check, unit tests, E2E-tester och production build.

### Testa Functions och Firestore-regler

Functions har ett separat Node.js-paket och separata tester:

```sh
npm --prefix functions ci
npm --prefix functions test
firebase emulators:exec --only firestore,functions 'npm --prefix functions run test:integration && npm --prefix functions run test:rules && npm --prefix functions run test:delivery'
```

---

## 🎯 Användningsguide

### Inloggning
1. Navigera till `/login`
2. Klicka på "Continue with Google"
3. Autentisera med ditt Google-konto

### Skapa en ny lista
1. Klicka på "+ Ny lista" i sidomenyn
2. Ange listans namn
3. Tryck på Enter

### Skapa en ny uppgift
1. Navigera till önskad lista
2. Klicka i fältet "Lägg till en uppgift"
3. Ange uppgiftens titel
4. Tryck på Enter

### Hantera uppgiftsdetaljer
Klicka på en uppgift för att öppna detaljpanelen där du kan:
- Redigera titel
- Lägga till delsteg
- Markera som "Min dag"
- Ställa in förfallodatum, tid och påminnelse
- Lägga till anteckningar

### Aktivera pushnotiser
1. Öppna **Inställningar** på enheten där du vill få notiser.
2. Slå på **Tillåt aviseringar för påminnelser** och godkänn webbläsarens notisfråga.
3. Lägg till ett förfallodatum och välj påminnelse i uppgiftens detaljpanel.

Inställningen gäller bara den aktuella enheten. Push fungerar på produktionswebbplatsens HTTPS-origin och kan inte garanteras om webbläsaren eller operativsystemet begränsar bakgrundsaktivitet.

### Använda smarta vyer
- Klicka på "Min dag", "Viktigt" eller "Planerat" i sidomenyn
- "Planerat" visar uppgifter grupperade efter förfallodatum

---

## 🔧 Konfiguration

### Miljövariabler
Skapa en `.env`-fil med Firebase-konfiguration:
```sh
npm run generate-env
```

Lägg även till `VITE_FIREBASE_VAPID_KEY` med projektets publika Web Push-nyckel i `.env.local`. GitHub Pages-bygget hämtar Firebase- och VAPID-värden från repositoryts Actions-secrets.

Serverns `PUSH_REMINDERS_ENABLED` är en kill switch. Den ska bara sättas till `true` i Functions-miljön när produktionens utskick är godkända; den aktiverar leverans för alla förfallna jobb, inte bara en testenhet. Lägg aldrig FCM-enhetstoken i källkod eller loggar.

Firestore-reglerna finns i [`firestore.rules`](firestore.rules), och indexdefinitionerna finns i [`firestore.indexes.json`](firestore.indexes.json). Klienter kan inte läsa eller skriva serverhanterade `reminderJobs`.

---

## 📊 Datamodell

### Firestore Struktur
```
/users/{userId}/
  ├── folders/
  │   └── {folderId}
  │       ├── name: string
  │       └── order: number
  ├── lists/
  │   └── {listId}
  │       ├── name: string
  │       ├── folderId?: string
  │       ├── icon: string
  │       ├── order: number
  │       ├── createdAt: Timestamp
  │       └── themeColor?: string
  ├── tasks/
  │   └── {taskId}
  │       ├── listId: string
  │       ├── title: string
  │       ├── completed: boolean
  │       ├── important: boolean
  │       ├── myDay: boolean
  │       ├── dueDate?: string | Timestamp
  │       ├── dueTimeZone?: string
  │       ├── reminder?: {offsetMinutes: 0 | 10 | 60 | 1440}
  │       ├── note?: string
  │       ├── createdAt: Timestamp
  │       ├── order?: number
  │       └── steps/{stepId}
  │           ├── taskId: string
  │           ├── title: string
  │           ├── completed: boolean
  │           └── createdAt: Timestamp
  ├── devices/{deviceId}
  │   ├── userId: string
  │   ├── token: string
  │   ├── enabled: boolean
  │   └── updatedAt: string
  └── reminderJobs/{taskId} # serverhanterad; klientåtkomst nekas
     ├── taskId: string
     ├── revision: string
     ├── reminderAt: string
     ├── status: pending | processing | sent | cancelled | failed
     └── attempts: number
```

---

## 🤝 Bidrag & Licens

### Git Workflow
1. Skapa feature-branch: `git checkout -b feature/beskrivning-på-svenska`
2. Validera: `npm run validate`
3. Commit (på svenska): `git commit -m "feat: beskrivning på svenska"`
4. Merge till main

### Kodstandarder
- Använd `<script setup lang="ts">`
- Undvik `any`-typer
- Följ befintliga kodmönster

---

**Version:** 0.23.0 | **Licens:** Privat

*Made with Vue 3, TypeScript, and Firebase ❤️*
