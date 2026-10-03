import { beforeEach, describe, expect, it } from 'vitest'
import { handleAiKeysSnapshot, useAiKeys } from '../composables/useAiKeys'

describe('useAiKeys', () => {
  beforeEach(() => {
    localStorage.clear()
    const { apiKeys, setSelectedKeyId } = useAiKeys()
    // Reset any shared module state
    while (apiKeys.value.length > 0) {
      const { removeKey } = useAiKeys()
      removeKey(apiKeys.value[0].id)
    }
    setSelectedKeyId('auto')
  })

  it('starts empty and with auto selected when localStorage is clear', () => {
    const { apiKeys, selectedKeyId } = useAiKeys()
    expect(apiKeys.value).toEqual([])
    expect(selectedKeyId.value).toBe('auto')
  })

  it('adds keys, auto-assigns label if empty, and auto-selects the first key', () => {
    const { apiKeys, selectedKeyId, addKey } = useAiKeys()

    addKey('  ', 'key-1')
    expect(apiKeys.value).toHaveLength(1)
    expect(apiKeys.value[0].label).toBe('Nyckel 1')
    expect(apiKeys.value[0].key).toBe('key-1')
    expect(selectedKeyId.value).toBe(apiKeys.value[0].id)

    // Second key does not overwrite selectedKeyId
    addKey('Secondary Key', 'key-2')
    expect(apiKeys.value).toHaveLength(2)
    expect(apiKeys.value[1].label).toBe('Secondary Key')
    expect(selectedKeyId.value).toBe(apiKeys.value[0].id)
  })

  it('ignores adding empty or whitespace-only keys', () => {
    const { apiKeys, addKey } = useAiKeys()
    addKey('Label', '   ')
    expect(apiKeys.value).toEqual([])
  })

  it('updates an existing key label and value', () => {
    const { apiKeys, addKey, updateKey } = useAiKeys()
    addKey('Old Label', 'old-key')
    const keyId = apiKeys.value[0].id

    updateKey(keyId, 'New Label', 'new-key')
    expect(apiKeys.value[0].label).toBe('New Label')
    expect(apiKeys.value[0].key).toBe('new-key')
  })

  it('removes a key and updates selectedKeyId if that key was selected', () => {
    const { apiKeys, selectedKeyId, addKey, removeKey, setSelectedKeyId } = useAiKeys()
    addKey('Key 1', 'val-1')
    addKey('Key 2', 'val-2')
    const [first, second] = apiKeys.value

    setSelectedKeyId(first.id)
    expect(selectedKeyId.value).toBe(first.id)

    removeKey(first.id)
    expect(apiKeys.value).toHaveLength(1)
    expect(selectedKeyId.value).toBe(second.id)

    removeKey(second.id)
    expect(apiKeys.value).toHaveLength(0)
    expect(selectedKeyId.value).toBe('auto')
  })

  it('resolves keys in auto mode with all stored keys and fallback to env key', () => {
    const { addKey, setSelectedKeyId, resolveKeysToTry } = useAiKeys()
    addKey('Key 1', 'val-1')
    addKey('Key 2', 'val-2')
    setSelectedKeyId('auto')

    const keys = resolveKeysToTry()
    expect(keys).toContain('val-1')
    expect(keys).toContain('val-2')
  })

  it('resolves only the selected key when a specific key id is chosen', () => {
    const { apiKeys, addKey, setSelectedKeyId, resolveKeysToTry } = useAiKeys()
    addKey('Key 1', 'val-1')
    addKey('Key 2', 'val-2')

    setSelectedKeyId(apiKeys.value[1].id)
    expect(resolveKeysToTry()).toEqual(['val-2'])
  })

  it('falls back if selected key id does not exist', () => {
    const { setSelectedKeyId, resolveKeysToTry } = useAiKeys()
    setSelectedKeyId('non-existent-id')
    const keys = resolveKeysToTry()
    // Returns env key if configured, or empty array
    expect(Array.isArray(keys)).toBe(true)
  })

  it('clears all keys and resets selectedKeyId to auto when clearKeys is called', () => {
    const { apiKeys, selectedKeyId, addKey, clearKeys } = useAiKeys()
    addKey('Key 1', 'val-1')
    expect(apiKeys.value).toHaveLength(1)

    clearKeys()
    expect(apiKeys.value).toHaveLength(0)
    expect(selectedKeyId.value).toBe('auto')
    expect(localStorage.getItem('todo-gemini-api-keys')).toBe('[]')
    expect(localStorage.getItem('todo-gemini-selected-key-index')).toBe('auto')
  })

  it('updates local state when Firestore snapshot arrives', () => {
    handleAiKeysSnapshot({
      exists: () => true,
      data: () => ({
        keys: [{ id: 'k-remote', label: 'Molnnyckel', key: 'remote-secret' }],
        selectedKeyId: 'k-remote',
      }),
    })

    const { apiKeys, selectedKeyId } = useAiKeys()
    expect(apiKeys.value).toEqual([{ id: 'k-remote', label: 'Molnnyckel', key: 'remote-secret' }])
    expect(selectedKeyId.value).toBe('k-remote')
    expect(localStorage.getItem('todo-gemini-selected-key-index')).toBe('k-remote')
  })
})
