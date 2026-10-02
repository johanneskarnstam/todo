import { computed, ref } from 'vue'
import { isMockAuthEnabled } from '@/devMode'
import { useTaskBreakdownStore } from '@/stores/taskBreakdownStore'
import { useTaskStore } from '@/stores/taskStore'
import type { AiSuggestionSelection, Step, Task } from '@/types'
import type { TaskBreakdownModelId } from '@/services/taskBreakdownService'

export const useTaskBreakdown = () => {
  const breakdownStore = useTaskBreakdownStore()
  const taskStore = useTaskStore()
  const requestId = ref(0)
  const activeTaskId = ref<string | null>(null)
  const confirmError = ref<string | null>(null)

  const loadLatest = async (task: Task) => {
    const request = ++requestId.value
    activeTaskId.value = task.id
    if (breakdownStore.currentTaskId !== task.id) breakdownStore.clearState()
    confirmError.value = null
    try {
      const result = await breakdownStore.loadLatest(task.id)
      if (request !== requestId.value || activeTaskId.value !== task.id) return null
      return result
    } catch (err) {
      if (request !== requestId.value || activeTaskId.value !== task.id) return null
      throw err
    }
  }

  const generate = async (task: Task, additionalPrompt: string, modelId?: TaskBreakdownModelId, apiKey?: string) => {
    if (breakdownStore.isGenerating) return null

    const request = ++requestId.value
    activeTaskId.value = task.id
    confirmError.value = null
    const result = await breakdownStore.generateLatest(task.id, {
      title: task.title,
      note: task.note,
      additionalPrompt,
      ...(modelId ? { modelId } : {}),
      ...(apiKey ? { apiKey } : {}),
    })
    if (request !== requestId.value || activeTaskId.value !== task.id) return null
    return result
  }

  const confirmSelection = async (taskId: string, selections: AiSuggestionSelection[]): Promise<Step[]> => {
    const breakdown = breakdownStore.latest
    if (activeTaskId.value !== taskId || !breakdown) return []

    confirmError.value = null
    const selectionsWithTitles = selections.map((selection) => ({
      ...selection,
      title: breakdown.suggestions.find((suggestion) => suggestion.id === selection.suggestionId)?.title,
    }))

    let createdSteps: Step[]
    try {
      createdSteps = await taskStore.createStepsFromAi(taskId, selectionsWithTitles)
    } catch {
      confirmError.value = 'Delstegen kunde inte sparas. Försök igen.'
      return []
    }

    if (!createdSteps.length) {
      confirmError.value = 'Delstegen kunde inte sparas. Försök igen.'
      return []
    }

    if (isMockAuthEnabled) {
      breakdownStore.persistMockSelection(taskId, selectionsWithTitles, createdSteps)
    } else {
      await breakdownStore.loadLatest(taskId)
    }

    return createdSteps
  }

  const clear = () => {
    requestId.value += 1
    activeTaskId.value = null
    confirmError.value = null
    breakdownStore.clearState()
  }

  const isContextStale = (task: Task) => {
    const metadata = breakdownStore.latest?.metadata
    return Boolean(metadata && (
      metadata.sourceTitle !== task.title.trim() ||
      metadata.sourceNote !== (task.note?.trim() ?? '')
    ))
  }

  return {
    latest: computed(() => breakdownStore.latest),
    suggestions: computed(() => breakdownStore.suggestions),
    isLoading: computed(() => breakdownStore.isLoading),
    isGenerating: computed(() => breakdownStore.isGenerating),
    error: computed(() => breakdownStore.error),
    confirmError: computed(() => confirmError.value),
    activeTaskId,
    loadLatest,
    generate,
    confirmSelection,
    isContextStale,
    clear,
  }
}
