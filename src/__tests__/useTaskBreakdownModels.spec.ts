import { beforeEach, describe, expect, it } from 'vitest'
import { useTaskBreakdownModels } from '@/composables/useTaskBreakdownModels'
import { TASK_BREAKDOWN_MODEL_STORAGE_KEY } from '@/services/taskBreakdownService'

describe('useTaskBreakdownModels', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shares and persists the selected model', () => {
    const { selectedModelId } = useTaskBreakdownModels()
    selectedModelId.value = 'gemini-3.6-flash'

    expect(localStorage.getItem(TASK_BREAKDOWN_MODEL_STORAGE_KEY)).toBe('gemini-3.6-flash')
    expect(useTaskBreakdownModels().selectedModelId.value).toBe('gemini-3.6-flash')
  })

  it('clears legacy personal API keys when the AI model settings are used', () => {
    localStorage.setItem('todo-gemini-api-keys', JSON.stringify(['personal-key']))
    localStorage.setItem('todo-gemini-selected-key', 'personal-key')

    useTaskBreakdownModels()

    expect(localStorage.getItem('todo-gemini-api-keys')).toBeNull()
    expect(localStorage.getItem('todo-gemini-selected-key')).toBeNull()
  })
})