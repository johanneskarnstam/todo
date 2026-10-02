import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { isMockAuthEnabled, MOCK_USER_ID } from '@/devMode'
import {
  classifyTaskBreakdownError,
  generateTaskBreakdown,
  type TaskBreakdownInput,
} from '@/services/taskBreakdownService'
import type { AiBreakdownMetadata, AiBreakdownSuggestion, AiBreakdownSuggestionStatus, AiSuggestionSelection, Step, TaskAiBreakdown } from '@/types'

interface StoredMockBreakdown {
  metadata: Omit<AiBreakdownMetadata, 'generatedAt'> & { generatedAt: number }
  suggestions: AiBreakdownSuggestion[]
}

const mockBreakdownStorageKey = 'todo-mock-ai-breakdowns'

const readMockBreakdown = (taskId: string): TaskAiBreakdown | null => {
  if (typeof localStorage === 'undefined') return null

  try {
    const stored = localStorage.getItem(mockBreakdownStorageKey)
    if (!stored) return null
    const breakdowns = JSON.parse(stored) as Record<string, StoredMockBreakdown>
    const breakdown = breakdowns[taskId]
    if (!breakdown) return null

    return {
      metadata: {
        ...breakdown.metadata,
        generatedAt: Timestamp.fromMillis(breakdown.metadata.generatedAt),
      },
      suggestions: breakdown.suggestions,
    }
  } catch {
    return null
  }
}

const persistMockBreakdown = (taskId: string, breakdown: TaskAiBreakdown) => {
  if (typeof localStorage === 'undefined') return

  let breakdowns: Record<string, StoredMockBreakdown> = {}
  try {
    breakdowns = JSON.parse(localStorage.getItem(mockBreakdownStorageKey) ?? '{}') as Record<string, StoredMockBreakdown>
  } catch {
    breakdowns = {}
  }

  breakdowns[taskId] = {
    metadata: {
      ...breakdown.metadata,
      generatedAt: breakdown.metadata.generatedAt.toMillis(),
    },
    suggestions: breakdown.suggestions,
  }
  localStorage.setItem(mockBreakdownStorageKey, JSON.stringify(breakdowns))
}

export const clearMockBreakdown = (taskId: string) => {
  if (typeof localStorage === 'undefined') return
  try {
    const stored = localStorage.getItem(mockBreakdownStorageKey)
    if (!stored) return
    const breakdowns = JSON.parse(stored) as Record<string, StoredMockBreakdown>
    delete breakdowns[taskId]
    localStorage.setItem(mockBreakdownStorageKey, JSON.stringify(breakdowns))
  } catch {
    // Ignore storage parse errors
  }
}

const isSuggestionStatus = (value: unknown): value is AiBreakdownSuggestionStatus =>
  value === 'available' || value === 'skipped' || value === 'added'

const parseMetadata = (data: Record<string, unknown>): AiBreakdownMetadata | null => {
  const suggestionIds = data.suggestionIds
  if (
    data.schemaVersion !== 1 ||
    typeof data.modelId !== 'string' ||
    typeof data.sourceTitle !== 'string' ||
    typeof data.sourceNote !== 'string' ||
    typeof data.sourcePrompt !== 'string' ||
    !(data.generatedAt instanceof Timestamp) ||
    typeof data.suggestionCount !== 'number' ||
    !Array.isArray(suggestionIds) ||
    suggestionIds.some((id) => typeof id !== 'string') ||
    suggestionIds.length !== data.suggestionCount ||
    suggestionIds.length > 20
  ) {
    return null
  }

  return {
    schemaVersion: 1,
    modelId: data.modelId,
    sourceTitle: data.sourceTitle,
    sourceNote: data.sourceNote,
    sourcePrompt: data.sourcePrompt,
    generatedAt: data.generatedAt,
    suggestionCount: data.suggestionCount,
    suggestionIds,
  }
}

const parseSuggestion = (id: string, data: Record<string, unknown>): AiBreakdownSuggestion | null => {
  if (
    typeof data.title !== 'string' ||
    typeof data.order !== 'number' ||
    !isSuggestionStatus(data.status) ||
    (data.stepId !== undefined && typeof data.stepId !== 'string')
  ) {
    return null
  }

  return {
    id,
    title: data.title,
    order: data.order,
    status: data.status,
    ...(typeof data.stepId === 'string' ? { stepId: data.stepId } : {}),
  }
}

export const useTaskBreakdownStore = defineStore('taskBreakdowns', () => {
  const currentTaskId = ref<string | null>(null)
  const latest = ref<TaskAiBreakdown | null>(null)
  const isLoading = ref(false)
  const isGenerating = ref(false)
  const error = ref<ReturnType<typeof classifyTaskBreakdownError> | null>(null)
  const suggestions = computed(() => latest.value?.suggestions ?? [])

  const userId = () => {
    const id = isMockAuthEnabled ? MOCK_USER_ID : auth.currentUser?.uid
    if (!id) throw new Error('En inloggad användare krävs för att hantera AI-förslag.')
    return id
  }

  const latestReference = (taskId: string) =>
    doc(db, 'users', userId(), 'tasks', taskId, 'aiBreakdowns', 'latest')

  const suggestionsCollection = (taskId: string) =>
    collection(db, 'users', userId(), 'tasks', taskId, 'aiBreakdowns', 'latest', 'suggestions')

  const loadLatest = async (taskId: string): Promise<TaskAiBreakdown | null> => {
    currentTaskId.value = taskId
    error.value = null

    if (isMockAuthEnabled) {
      latest.value = readMockBreakdown(taskId)
      return latest.value
    }

    isLoading.value = true
    try {
      let metadataSnapshot
      try {
        metadataSnapshot = await getDoc(latestReference(taskId))
      } catch (readError) {
        try {
          metadataSnapshot = await getDocFromCache(latestReference(taskId))
        } catch {
          throw readError
        }
      }

      if (!metadataSnapshot.exists()) {
        latest.value = null
        return null
      }

      const metadata = parseMetadata(metadataSnapshot.data())
      if (!metadata) throw new Error('Den sparade AI-förslagsuppsättningen har ett ogiltigt format.')

      let suggestionsSnapshot
      const orderedSuggestions = query(suggestionsCollection(taskId), orderBy('order'))
      try {
        suggestionsSnapshot = await getDocs(orderedSuggestions)
      } catch (readError) {
        try {
          suggestionsSnapshot = await getDocsFromCache(orderedSuggestions)
        } catch {
          throw readError
        }
      }

      const loadedSuggestions = suggestionsSnapshot.docs.map((suggestion) =>
        parseSuggestion(suggestion.id, suggestion.data()),
      )
      if (loadedSuggestions.some((suggestion) => suggestion === null)) {
        throw new Error('De sparade AI-förslagen stämmer inte med uppgiftens metadata.')
      }
      const validSuggestions = loadedSuggestions.filter(
        (suggestion): suggestion is AiBreakdownSuggestion => suggestion !== null,
      )
      if (
        validSuggestions.length !== metadata.suggestionCount ||
        validSuggestions.some((suggestion) => !metadata.suggestionIds.includes(suggestion.id))
      ) throw new Error('De sparade AI-förslagen stämmer inte med uppgiftens metadata.')

      latest.value = {
        metadata,
        suggestions: validSuggestions,
      }
      return latest.value
    } catch (loadError) {
      const classifiedError = classifyTaskBreakdownError(loadError)
      error.value = classifiedError
      throw classifiedError
    } finally {
      isLoading.value = false
    }
  }

  const generateLatest = async (taskId: string, input: TaskBreakdownInput) => {
    if (currentTaskId.value !== taskId) await loadLatest(taskId)

    const previousSuggestions = latest.value?.suggestions ?? []
    isGenerating.value = true
    error.value = null
    try {
      const result = await generateTaskBreakdown(input)
      const generatedAt = Timestamp.now()
      const newSuggestions: AiBreakdownSuggestion[] = result.steps.map((title, order) => ({
        id: crypto.randomUUID(),
        title,
        order,
        status: 'available',
      }))
      const metadata: AiBreakdownMetadata = {
        schemaVersion: 1,
        modelId: result.modelId,
        sourceTitle: input.title.trim(),
        sourceNote: input.note?.trim() ?? '',
        sourcePrompt: input.additionalPrompt?.trim() ?? '',
        generatedAt,
        suggestionCount: newSuggestions.length,
        suggestionIds: newSuggestions.map((suggestion) => suggestion.id),
      }
      const nextBreakdown = { metadata, suggestions: newSuggestions }

      if (isMockAuthEnabled) {
        persistMockBreakdown(taskId, nextBreakdown)
        latest.value = nextBreakdown
        return nextBreakdown
      }

      const batch = writeBatch(db)
      for (const oldSuggestion of previousSuggestions) {
        batch.delete(doc(suggestionsCollection(taskId), oldSuggestion.id))
      }
      batch.set(latestReference(taskId), {
        ...metadata,
        generatedAt: serverTimestamp(),
      })
      for (const suggestion of newSuggestions) {
        const { id, ...suggestionData } = suggestion
        batch.set(doc(suggestionsCollection(taskId), id), suggestionData)
      }

      await batch.commit()
      latest.value = nextBreakdown
      return nextBreakdown
    } catch (generationError) {
      const classifiedError = classifyTaskBreakdownError(generationError)
      error.value = classifiedError
      throw classifiedError
    } finally {
      isGenerating.value = false
    }
  }

  const persistMockSelection = (taskId: string, selections: AiSuggestionSelection[], createdSteps: Step[]) => {
    if (!isMockAuthEnabled) return
    const breakdown = readMockBreakdown(taskId)
    if (!breakdown) return

    const createdBySuggestion = new Map(
      createdSteps.flatMap((step) => step.aiSuggestionId ? [[step.aiSuggestionId, step.id] as const] : []),
    )
    const selectedIds = new Set(selections.filter((selection) => selection.selected).map((selection) => selection.suggestionId))
    const selectionIds = new Set(selections.map((selection) => selection.suggestionId))
    const nextBreakdown: TaskAiBreakdown = {
      ...breakdown,
      suggestions: breakdown.suggestions.map((suggestion) => {
        const createdStepId = createdBySuggestion.get(suggestion.id)
        if (createdStepId) return { ...suggestion, status: 'added', stepId: createdStepId }
        if (selectionIds.has(suggestion.id) && !selectedIds.has(suggestion.id) && suggestion.status === 'available') {
          return { ...suggestion, status: 'skipped' }
        }
        return suggestion
      }),
    }

    persistMockBreakdown(taskId, nextBreakdown)
    if (currentTaskId.value === taskId) latest.value = nextBreakdown
  }

  const releaseMockStep = (taskId: string, suggestionId: string) => {
    if (!isMockAuthEnabled) return
    const breakdown = readMockBreakdown(taskId)
    if (!breakdown) return

    const nextBreakdown: TaskAiBreakdown = {
      ...breakdown,
      suggestions: breakdown.suggestions.map((suggestion) => {
        if (suggestion.id === suggestionId) {
          const { stepId: _stepId, ...rest } = suggestion
          return { ...rest, status: 'available' as const }
        }
        return suggestion
      }),
    }

    persistMockBreakdown(taskId, nextBreakdown)
    if (currentTaskId.value === taskId) latest.value = nextBreakdown
  }

  const reattachMockStep = (taskId: string, suggestionId: string, stepId: string) => {
    if (!isMockAuthEnabled) return
    const breakdown = readMockBreakdown(taskId)
    if (!breakdown) return

    const nextBreakdown: TaskAiBreakdown = {
      ...breakdown,
      suggestions: breakdown.suggestions.map((suggestion) => {
        if (suggestion.id === suggestionId) {
          return { ...suggestion, status: 'added' as const, stepId }
        }
        return suggestion
      }),
    }

    persistMockBreakdown(taskId, nextBreakdown)
    if (currentTaskId.value === taskId) latest.value = nextBreakdown
  }

  const clearState = () => {
    currentTaskId.value = null
    latest.value = null
    isLoading.value = false
    isGenerating.value = false
    error.value = null
  }

  return {
    currentTaskId,
    latest,
    suggestions,
    isLoading,
    isGenerating,
    error,
    loadLatest,
    generateLatest,
    persistMockSelection,
    releaseMockStep,
    reattachMockStep,
    clearState,
  }
})
