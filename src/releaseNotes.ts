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
export const releaseNotes: ReleaseNote[] = [
  {
    version: appVersion,
    date: '2026-09-24',
    title: 'Mjukare och tydligare To Do',
    summary: 'Sidomenyn har fått bättre övergångar och en mer sammanhållen visning av taggar.',
    items: [
      'Utfällbara menyer, mappar och sektioner öppnas mjukare.',
      'Taggar visas som mindre färgkodade pills.',
      'Alla chevrons i sidomenyn använder samma ikon.',
      'Appen har fått bättre testskydd för nya förändringar.',
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
