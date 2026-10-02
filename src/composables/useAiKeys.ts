import { ref, watch } from 'vue'

export const AI_KEYS_STORAGE_KEY = 'todo-gemini-api-keys'
export const AI_SELECTED_KEY_STORAGE_KEY = 'todo-gemini-selected-key'

export const maskApiKey = (key: string): string => {
  const trimmed = key.trim()
  if (trimmed.length <= 8) return '••••••••'
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`
}

export const readAiKeys = (): string[] => {
  if (typeof localStorage === 'undefined') return []
  try {
    const stored = JSON.parse(localStorage.getItem(AI_KEYS_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(stored)) return []
    return stored
      .filter((k): k is string => typeof k === 'string')
      .map((k) => k.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

export const readSelectedAiKey = (): string => {
  if (typeof localStorage === 'undefined') return 'auto'
  try {
    const stored = localStorage.getItem(AI_SELECTED_KEY_STORAGE_KEY)
    if (stored) return stored
  } catch {
    // fallback
  }
  return 'auto'
}

const persistAiKeys = (keys: string[]) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(AI_KEYS_STORAGE_KEY, JSON.stringify(keys))
  }
}

const persistSelectedAiKey = (key: string) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(AI_SELECTED_KEY_STORAGE_KEY, key)
  }
}

const aiKeys = ref<string[]>(readAiKeys())
const selectedApiKey = ref<string>(readSelectedAiKey())

watch(
  aiKeys,
  (value) => {
    persistAiKeys(value)
    if (
      selectedApiKey.value !== 'auto' &&
      selectedApiKey.value !== 'standard' &&
      !value.includes(selectedApiKey.value)
    ) {
      selectedApiKey.value = 'auto'
      persistSelectedAiKey('auto')
    }
  },
  { deep: true },
)

watch(
  selectedApiKey,
  (value) => {
    persistSelectedAiKey(value)
  },
)

export const useAiKeys = () => {
  const setSelectedKey = (key: string) => {
    selectedApiKey.value = key
    persistSelectedAiKey(key)
  }

  const addKey = (key: string): { success: boolean; error?: string } => {
    const trimmed = key.trim()
    if (!trimmed) {
      return { success: false, error: 'API-nyckeln får inte vara tom.' }
    }
    if (aiKeys.value.includes(trimmed)) {
      return { success: false, error: 'API-nyckeln finns redan i listan.' }
    }
    aiKeys.value = [...aiKeys.value, trimmed]
    persistAiKeys(aiKeys.value)
    return { success: true }
  }

  const removeKey = (index: number) => {
    const keyToRemove = aiKeys.value[index]
    aiKeys.value = aiKeys.value.filter((_, i) => i !== index)
    persistAiKeys(aiKeys.value)
    if (selectedApiKey.value === keyToRemove) {
      selectedApiKey.value = 'auto'
      persistSelectedAiKey('auto')
    }
  }

  const clearKeys = () => {
    aiKeys.value = []
    selectedApiKey.value = 'auto'
    persistAiKeys(aiKeys.value)
    persistSelectedAiKey('auto')
  }

  return {
    aiKeys,
    selectedApiKey,
    setSelectedKey,
    addKey,
    removeKey,
    clearKeys,
    maskApiKey,
  }
}

