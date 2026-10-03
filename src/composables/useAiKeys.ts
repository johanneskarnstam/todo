import { computed, ref } from 'vue'
import { auth, db } from '@/firebase'
import { isMockAuthEnabled } from '@/devMode'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from 'firebase/firestore'

const STORAGE_KEY = 'todo-gemini-api-keys'
const SELECTED_KEY_STORAGE = 'todo-gemini-selected-key-index'

export interface AiApiKey {
  id: string
  label: string
  key: string
}

// Module-level shared state
const apiKeys = ref<AiApiKey[]>(readApiKeys())
const selectedKeyId = ref<string>(readSelectedKeyId())
const isSyncing = ref(false)

let unsubscribeSnapshot: Unsubscribe | null = null
let currentSyncUserId: string | null = null
let isAuthListenerAttached = false

function readApiKeys(): AiApiKey[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is AiApiKey =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as AiApiKey).id === 'string' &&
        typeof (item as AiApiKey).label === 'string' &&
        typeof (item as AiApiKey).key === 'string',
    )
  } catch {
    return []
  }
}

function readSelectedKeyId(): string {
  try {
    return localStorage.getItem(SELECTED_KEY_STORAGE) ?? 'auto'
  } catch {
    return 'auto'
  }
}

function persistKeys(keys: AiApiKey[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
  } catch {
    // Ignore storage errors
  }
}

function persistSelectedKeyId(id: string) {
  try {
    localStorage.setItem(SELECTED_KEY_STORAGE, id)
  } catch {
    // Ignore storage errors
  }
}

async function persistToFirestore(userId: string, keys: AiApiKey[], selectedId: string): Promise<void> {
  if (isMockAuthEnabled || !userId) return
  try {
    isSyncing.value = true
    const settingsDocRef = doc(db, 'users', userId, 'settings', 'aiKeys')
    await setDoc(settingsDocRef, {
      keys,
      selectedKeyId: selectedId,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    // Local persistence is already active; errors should not crash the app
    console.warn('Misslyckades med att synkronisera AI-nycklar till Firestore:', error)
  } finally {
    isSyncing.value = false
  }
}

export function handleAiKeysSnapshot(snapshot: { exists: () => boolean; data: () => unknown }): void {
  if (snapshot.exists()) {
    const data = snapshot.data() as { keys?: unknown; selectedKeyId?: unknown } | undefined
    if (Array.isArray(data?.keys)) {
      const validKeys = data.keys.filter(
        (item): item is AiApiKey =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as AiApiKey).id === 'string' &&
          typeof (item as AiApiKey).label === 'string' &&
          typeof (item as AiApiKey).key === 'string',
      )
      apiKeys.value = validKeys
      persistKeys(validKeys)
    }
    if (typeof data?.selectedKeyId === 'string') {
      selectedKeyId.value = data.selectedKeyId
      persistSelectedKeyId(data.selectedKeyId)
    }
  } else if (currentSyncUserId && apiKeys.value.length > 0) {
    void persistToFirestore(currentSyncUserId, apiKeys.value, selectedKeyId.value)
  }
}

export function startAiKeysSync(userId: string): void {
  if (isMockAuthEnabled || !userId) return
  if (currentSyncUserId === userId && unsubscribeSnapshot) return

  stopAiKeysSync()
  currentSyncUserId = userId

  try {
    const settingsDocRef = doc(db, 'users', userId, 'settings', 'aiKeys')
    unsubscribeSnapshot = onSnapshot(
      settingsDocRef,
      (snapshot) => {
        handleAiKeysSnapshot(snapshot)
      },
      (error) => {
        console.warn('AI-nycklar Firestore-lyssnare fel:', error)
      },
    )
  } catch (error) {
    console.warn('Kunde inte starta synk av AI-nycklar:', error)
  }
}

export function stopAiKeysSync(): void {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot()
    unsubscribeSnapshot = null
  }
  currentSyncUserId = null
}

function initAuthListener(): void {
  if (isAuthListenerAttached || isMockAuthEnabled) return
  isAuthListenerAttached = true

  try {
    if (auth && typeof onAuthStateChanged === 'function') {
      onAuthStateChanged(auth, (currentUser) => {
        if (currentUser?.uid) {
          startAiKeysSync(currentUser.uid)
        } else {
          stopAiKeysSync()
        }
      })
    }
  } catch {
    // In test environments or when auth is mocked without onAuthStateChanged
  }
}

// Automatically attach auth listener
initAuthListener()

export const useAiKeys = () => {
  const currentUserId = (): string | null => {
    if (isMockAuthEnabled) return null
    return auth?.currentUser?.uid ?? null
  }

  const addKey = (label: string, key: string) => {
    const trimmedKey = key.trim()
    const trimmedLabel = label.trim() || `Nyckel ${apiKeys.value.length + 1}`
    if (!trimmedKey) return
    const newKey: AiApiKey = {
      id: crypto.randomUUID(),
      label: trimmedLabel,
      key: trimmedKey,
    }
    const nextKeys = [...apiKeys.value, newKey]
    apiKeys.value = nextKeys
    persistKeys(nextKeys)

    let nextSelectedId = selectedKeyId.value
    // Auto-select if first key
    if (nextKeys.length === 1) {
      nextSelectedId = newKey.id
      selectedKeyId.value = newKey.id
      persistSelectedKeyId(newKey.id)
    }

    const uid = currentUserId()
    if (uid) void persistToFirestore(uid, nextKeys, nextSelectedId)
  }

  const removeKey = (id: string) => {
    const nextKeys = apiKeys.value.filter((k) => k.id !== id)
    apiKeys.value = nextKeys
    persistKeys(nextKeys)

    let nextSelectedId = selectedKeyId.value
    if (selectedKeyId.value === id) {
      nextSelectedId = nextKeys[0]?.id ?? 'auto'
      selectedKeyId.value = nextSelectedId
      persistSelectedKeyId(nextSelectedId)
    }

    const uid = currentUserId()
    if (uid) void persistToFirestore(uid, nextKeys, nextSelectedId)
  }

  const updateKey = (id: string, label: string, key: string) => {
    const nextKeys = apiKeys.value.map((k) =>
      k.id === id ? { ...k, label: label.trim() || k.label, key: key.trim() || k.key } : k,
    )
    apiKeys.value = nextKeys
    persistKeys(nextKeys)

    const uid = currentUserId()
    if (uid) void persistToFirestore(uid, nextKeys, selectedKeyId.value)
  }

  const setSelectedKeyId = (id: string) => {
    selectedKeyId.value = id
    persistSelectedKeyId(id)

    const uid = currentUserId()
    if (uid) void persistToFirestore(uid, apiKeys.value, id)
  }

  const clearKeys = () => {
    apiKeys.value = []
    selectedKeyId.value = 'auto'
    persistKeys([])
    persistSelectedKeyId('auto')
    stopAiKeysSync()
  }

  /**
   * Returns keys to try in order. 'auto' means try them all sequentially
   * (then fall back to the env key). A specific key ID means try only that key.
   */
  const resolveKeysToTry = (): string[] => {
    const envKey = import.meta.env.VITE_GEMINI_KEY?.trim() || import.meta.env.VITE_GEMINI_API_KEY?.trim() || ''
    if (selectedKeyId.value === 'auto') {
      // All stored keys, then the env key as final fallback
      const storedKeys = apiKeys.value.map((k) => k.key).filter(Boolean)
      return envKey ? [...storedKeys, envKey] : storedKeys
    }
    const found = apiKeys.value.find((k) => k.id === selectedKeyId.value)
    if (found) return [found.key]
    // ID not found — fallback to env key
    return envKey ? [envKey] : []
  }

  return {
    apiKeys: computed(() => apiKeys.value),
    selectedKeyId: computed({
      get: () => selectedKeyId.value,
      set: setSelectedKeyId,
    }),
    isSyncing: computed(() => isSyncing.value),
    addKey,
    removeKey,
    updateKey,
    setSelectedKeyId,
    clearKeys,
    resolveKeysToTry,
  }
}
