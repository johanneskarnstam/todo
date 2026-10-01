import packageJson from '../package.json'

export interface ReleaseNote {
  version: string
  date: string
  title: string
  summary: string
  items: string[]
}

export const appVersion = packageJson.version

// Keep newest releases first. Add a new entry when the app version changes.
// IMPORTANT: Always hardcode the version string for each release note entry.
// Using `appVersion` here would break localStorage "seen" tracking because the
// version changes on every bump, making previously-seen entries appear new again.
export const releaseNotes: ReleaseNote[] = [
  {
    version: '0.26.0',
    date: '2026-10-01',
    title: 'Enklare appuppdateringar',
    summary: 'Appen visar när en ny version finns och samlar uppdateringsinformationen med de senaste funktionerna.',
    items: [
      'Uppdatera från nyhetsmodalen eller när som helst via Inställningar.',
      'Cache rensas och appen laddas om utan att listor och inställningar påverkas.',
    ],
  },
  {
    version: '0.25.3',
    date: '2026-09-30',
    title: 'Tydligare markeringar på desktop',
    summary: 'Stjärnmärkning, Min dag och förfallodatum visas med text från desktopbredd.',
    items: [
      'På små skärmar visas markeringarna fortfarande som ikoner.',
      'Påminnelsens korta datum- och tidsformat behålls på vanliga desktopbredder.',
    ],
  },
  {
    version: '0.25.2',
    date: '2026-09-30',
    title: 'Kortare påminnelseinformation på mobil',
    summary: 'Metadataraden är vänsterställd och aktiva påminnelser visar datum och tid även på små skärmar.',
    items: [
      'Påminnelsens faktiska datum och klockslag visas i ett kompakt format.',
      'Markeringar och taggar börjar nu i linje med uppgiftens titel.',
    ],
  },
  {
    version: '0.25.1',
    date: '2026-09-30',
    title: 'Tydligare information i uppgiftsrader',
    summary: 'Taggar och uppgiftsmarkeringar har fått en egen rad med mer information på breda skärmar.',
    items: [
      'Påminnelser visar när de skickas, och förfallodatum visas intill kalenderikonen.',
      'Stjärnmarkering och Min dag får text på breda skärmar; på små skärmar visas ikonerna.',
    ],
  },
  {
    version: '0.25.0',
    date: '2026-09-30',
    title: 'Ändringshistorik och funktionsöversikt',
    summary: 'Inställningarna visar appens utveckling över tid och samlar funktionerna på ett ställe.',
    items: [
      'Följ versionshistoriken med datum och beskrivningar av ändringarna.',
      'Se appens funktioner samlade i en kategoriserad översikt.',
    ],
  },
  {
    version: '0.23.1',
    date: '2026-09-29',
    title: 'Enhetliga ikoner och sidomeny',
    summary: 'Lucide-ikoner och jämnare textstorlekar gör gränssnittet mer konsekvent.',
    items: [
      'Teckensymboler har ersatts med Lucide-ikoner.',
      'Texten i sidomenyn har fått enhetlig storlek.',
    ],
  },
  {
    version: '0.23.0',
    date: '2026-09-29',
    title: 'Påminnelser med push',
    summary: 'Påminnelser kan levereras till aktiverade enheter även när appen inte är öppen.',
    items: [
      'Aviseringar aktiveras per enhet i inställningarna.',
      'Tryck på en påminnelse för att öppna uppgiften.',
    ],
  },
  {
    version: '0.22.0',
    date: '2026-09-28',
    title: 'Delsteg före taggar',
    summary: 'Delsteg ligger nu först i uppgiftsdetaljerna och kan sorteras med drag och släpp.',
    items: [
      'Dra delsteg upp eller ner för att ändra ordning.',
      'Ändringar av delstegens ordning sparas automatiskt.',
    ],
  },
  {
    version: '0.21.0',
    date: '2026-09-28',
    title: 'Uppgifter till Google Kalender',
    summary: 'Skapa ett förifyllt kalenderutkast direkt från uppgiftens detaljer.',
    items: [
      'Titel och anteckning följer med till Google Kalender.',
      'Förfallodatum och tid används för att fylla i eventets datum.',
      'Granska och spara eventet i Google Kalender.',
    ],
  },
  {
    version: '0.20.2',
    date: '2026-09-28',
    title: 'Tydligare listinställningar',
    summary: 'Listans utseende och sortering är enklare att hitta och förstå.',
    items: [
      'Byt namn genom att klicka på listans titel.',
      'Ställ in listfärgen på listans inställningssida.',
      'Sorteringsläget visar när drag och släpp är avstängt.',
    ],
  },
  {
    version: '0.20.1',
    date: '2026-09-28',
    title: 'Snabbare statusväxling',
    summary: 'Trestegsflödet har fått en kompakt checkbox med tydlig pågående-status.',
    items: [
      'Klicka för att växla mellan Att göra, Pågående och Klart.',
      'Pågående uppgifter visas med orange playmarkering.',
    ],
  },
  {
    version: '0.20.0',
    date: '2026-09-28',
    title: 'Inställningar per lista',
    summary: 'Listor kan nu ha egen sortering och ett valfritt trestegsarbetsflöde.',
    items: [
      'Sortering ställs in separat för varje lista.',
      'Listor kan använda Att göra, Pågående och Klart.',
      'Äldre uppgifter behåller sitt tidigare statusbeteende.',
    ],
  },
  {
    version: '0.19.0',
    date: '2026-09-25',
    title: 'Ny lista-hantering och sidomenyn',
    summary: 'Sidomenyn har fått finputsade namn, kompaktare knappar och dynamisk versionsinformation.',
    items: [
      '"Alla mappar och listor" heter nu "Alla listor".',
      '"Viktigt" har bytt namn till "Stjärnmärkt".',
      '"Ny lista +"-knappen har fått en mer kompakt stil.',
      'Sidomenyn visar nu senast uppdaterat och version längst ner.',
    ],
  },
]

const seenVersionKey = (userId: string) => `todo-whats-new-seen:${userId}`

const readSeenVersion = (userId: string) => {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(seenVersionKey(userId))
}

export const getUnseenReleaseNotes = (userId: string): ReleaseNote[] => {
  const seenVersion = readSeenVersion(userId)
  if (!seenVersion) return releaseNotes.slice(0, 1)

  const seenIndex = releaseNotes.findIndex((release) => release.version === seenVersion)
  if (seenIndex < 0) return releaseNotes.slice(0, 1)

  return releaseNotes.slice(0, seenIndex)
}

export const markReleaseNotesSeen = (userId: string, version: string) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(seenVersionKey(userId), version)
}
