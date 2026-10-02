import { beforeEach, describe, expect, it } from 'vitest'
import { AI_KEYS_STORAGE_KEY, maskApiKey, readAiKeys, useAiKeys } from '@/composables/useAiKeys'

describe('useAiKeys', () => {
  beforeEach(() => {
    localStorage.clear()
    const { clearKeys } = useAiKeys()
    clearKeys()
  })

  it('masks API keys correctly', () => {
    expect(maskApiKey('')).toBe('••••••••')
    expect(maskApiKey('short')).toBe('••••••••')
    expect(maskApiKey('12345678')).toBe('••••••••')
    expect(maskApiKey('AIzaSyD-1234567890-AbCdEfGh')).toBe('AIza••••EfGh')
  })

  it('reads empty list when localStorage has no data or corrupt data', () => {
    expect(readAiKeys()).toEqual([])

    localStorage.setItem(AI_KEYS_STORAGE_KEY, 'not-json')
    expect(readAiKeys()).toEqual([])

    localStorage.setItem(AI_KEYS_STORAGE_KEY, '{"not":"array"}')
    expect(readAiKeys()).toEqual([])
  })

  it('reads saved keys from localStorage', () => {
    localStorage.setItem(AI_KEYS_STORAGE_KEY, JSON.stringify(['key-1', '  key-2  ']))
    expect(readAiKeys()).toEqual(['key-1', 'key-2'])
  })

  it('validates and adds new API keys', () => {
    const { aiKeys, addKey } = useAiKeys()

    // Rejects empty or whitespace
    const emptyRes = addKey('   ')
    expect(emptyRes.success).toBe(false)
    expect(emptyRes.error).toBe('API-nyckeln får inte vara tom.')
    expect(aiKeys.value).toEqual([])

    // Adds first valid key
    const addRes1 = addKey('AIzaSyKey1')
    expect(addRes1.success).toBe(true)
    expect(aiKeys.value).toEqual(['AIzaSyKey1'])

    // Rejects duplicates
    const dupRes = addKey('  AIzaSyKey1  ')
    expect(dupRes.success).toBe(false)
    expect(dupRes.error).toBe('API-nyckeln finns redan i listan.')
    expect(aiKeys.value).toEqual(['AIzaSyKey1'])

    // Adds second key
    const addRes2 = addKey('AIzaSyKey2')
    expect(addRes2.success).toBe(true)
    expect(aiKeys.value).toEqual(['AIzaSyKey1', 'AIzaSyKey2'])
  })

  it('removes keys by index and updates storage', () => {
    const { aiKeys, addKey, removeKey } = useAiKeys()
    addKey('key-1')
    addKey('key-2')
    addKey('key-3')

    expect(aiKeys.value).toHaveLength(3)

    removeKey(1) // remove key-2
    expect(aiKeys.value).toEqual(['key-1', 'key-3'])
    expect(JSON.parse(localStorage.getItem(AI_KEYS_STORAGE_KEY)!)).toEqual(['key-1', 'key-3'])
  })

  it('manages selectedApiKey and resets to auto when selected key is removed', () => {
    const { aiKeys, selectedApiKey, setSelectedKey, addKey, removeKey } = useAiKeys()
    addKey('key-1')
    addKey('key-2')

    expect(selectedApiKey.value).toBe('auto')

    setSelectedKey('key-2')
    expect(selectedApiKey.value).toBe('key-2')

    // Removing an unselected key keeps the selected key
    removeKey(0) // removes key-1
    expect(aiKeys.value).toEqual(['key-2'])
    expect(selectedApiKey.value).toBe('key-2')

    // Removing the selected key resets to auto
    removeKey(0) // removes key-2
    expect(aiKeys.value).toEqual([])
    expect(selectedApiKey.value).toBe('auto')
  })
})

