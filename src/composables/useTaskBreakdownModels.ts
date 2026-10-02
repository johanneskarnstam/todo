import { computed, ref } from 'vue'
import {
  DEFAULT_TASK_BREAKDOWN_MODEL_ID,
  fetchAvailableTaskBreakdownModels,
  getSelectedTaskBreakdownModelId,
  setSelectedTaskBreakdownModelId,
  TASK_BREAKDOWN_MODEL_OPTIONS,
  type TaskBreakdownModelOption,
} from '@/services/taskBreakdownService'

const models = ref<TaskBreakdownModelOption[]>([
  { id: DEFAULT_TASK_BREAKDOWN_MODEL_ID, name: `${DEFAULT_TASK_BREAKDOWN_MODEL_ID} (standard)` },
  ...TASK_BREAKDOWN_MODEL_OPTIONS,
])
const selectedModel = ref(getSelectedTaskBreakdownModelId())
const isLoadingModels = ref(false)
let modelsLoaded = false
let modelsRequest: Promise<void> | null = null

const selectedModelId = computed({
  get: () => selectedModel.value,
  set: (modelId: string) => {
    selectedModel.value = modelId
    setSelectedTaskBreakdownModelId(modelId)
  },
})

export const loadTaskBreakdownModels = async (forceRefresh = false): Promise<void> => {
  if (modelsLoaded && !forceRefresh) return
  if (modelsRequest) return modelsRequest

  isLoadingModels.value = true
  modelsRequest = (async () => {
    const available = await fetchAvailableTaskBreakdownModels(forceRefresh)
    const selectedIsAvailable = available.some((model) => model.id === selectedModel.value)
    models.value = selectedIsAvailable
      ? available
      : [{ id: selectedModel.value, name: selectedModel.value }, ...available]
    modelsLoaded = true
  })().finally(() => {
    isLoadingModels.value = false
    modelsRequest = null
  })

  return modelsRequest
}

const clearLegacyApiKeys = () => {
  try {
    localStorage.removeItem('todo-gemini-api-keys')
    localStorage.removeItem('todo-gemini-selected-key')
  } catch {
    // Legacy key cleanup must not prevent model selection from loading.
  }
}

export const useTaskBreakdownModels = () => {
  clearLegacyApiKeys()
  return {
    models,
    selectedModelId,
    isLoadingModels,
    loadModels: loadTaskBreakdownModels,
  }
}
