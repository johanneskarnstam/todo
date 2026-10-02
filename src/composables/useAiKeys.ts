import { ref, watch } from 'vue'

export const AI_KEYS_STORAGE_KEY = 'todo-gemini-api-keys'

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

const persistAiKeys = (keys: string[]) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(AI_KEYS_STORAGE_KEY, JSON.stringify(keys))
  }
}

const aiKeys = ref<string[]>(readAiKeys())

watch(
  aiKeys,
  (value) => {
    persistAiKeys(value)
  },
  { deep: true },
)

export const useAiKeys = () => {
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
    aiKeys.value = aiKeys.value.filter((_, i) => i !== index)
    persistAiKeys(aiKeys.value)
  }

  const clearKeys = () => {
    aiKeys.value = []
    persistAiKeys(aiKeys.value)
  }

  return {
    aiKeys,
    addKey,
    removeKey,
    clearKeys,
    maskApiKey,
  }
}
