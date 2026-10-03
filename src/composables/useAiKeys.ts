import { computed, ref } from 'vue'

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

export const useAiKeys = () => {
  const addKey = (label: string, key: string) => {
    const trimmedKey = key.trim()
    const trimmedLabel = label.trim() || `Nyckel ${apiKeys.value.length + 1}`
    if (!trimmedKey) return
    const newKey: AiApiKey = {
      id: crypto.randomUUID(),
      label: trimmedLabel,
      key: trimmedKey,
    }
    apiKeys.value = [...apiKeys.value, newKey]
    persistKeys(apiKeys.value)
    // Auto-select if first key
    if (apiKeys.value.length === 1) {
      selectedKeyId.value = newKey.id
      persistSelectedKeyId(newKey.id)
    }
  }

  const removeKey = (id: string) => {
    apiKeys.value = apiKeys.value.filter((k) => k.id !== id)
    persistKeys(apiKeys.value)
    if (selectedKeyId.value === id) {
      selectedKeyId.value = apiKeys.value[0]?.id ?? 'auto'
      persistSelectedKeyId(selectedKeyId.value)
    }
  }

  const updateKey = (id: string, label: string, key: string) => {
    apiKeys.value = apiKeys.value.map((k) =>
      k.id === id ? { ...k, label: label.trim() || k.label, key: key.trim() || k.key } : k,
    )
    persistKeys(apiKeys.value)
  }

  const setSelectedKeyId = (id: string) => {
    selectedKeyId.value = id
    persistSelectedKeyId(id)
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
    addKey,
    removeKey,
    updateKey,
    setSelectedKeyId,
    resolveKeysToTry,
  }
}
