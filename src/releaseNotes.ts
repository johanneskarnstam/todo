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
