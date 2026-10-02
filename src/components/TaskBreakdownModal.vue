<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  AlertCircle,
  Check,
  ChevronDown,
  Key,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from '@lucide/vue'
import { useTaskBreakdown } from '@/composables/useTaskBreakdown'
import { maskApiKey, useAiKeys } from '@/composables/useAiKeys'
import {
  DEFAULT_TASK_BREAKDOWN_MODEL_ID,
  TASK_BREAKDOWN_MODEL_OPTIONS,
  type TaskBreakdownModelId,
} from '@/services/taskBreakdownService'
import type { Task } from '@/types'

interface Props {
  isOpen: boolean
  task: Task
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (event: 'close'): void
}>()

const {
  latest,
  suggestions,
  isLoading,
  isGenerating,
  error,
  confirmError,
  loadLatest,
  generate,
  confirmSelection,
  isContextStale,
  clear,
} = useTaskBreakdown()

const { aiKeys, addKey, removeKey } = useAiKeys()

const additionalPrompt = ref('')
const selectedSuggestionIds = ref<string[]>([])
const selectedModelId = ref<TaskBreakdownModelId>(DEFAULT_TASK_BREAKDOWN_MODEL_ID)
const isSaving = ref(false)
const isAiSettingsOpen = ref(false)
const newKeyInput = ref('')
const keyFeedback = ref('')
const keyFeedbackIsError = ref(false)

const allModelOptions = computed(() => [
  { id: DEFAULT_TASK_BREAKDOWN_MODEL_ID, name: 'Gemini 3.8 Flash (standard)' },
  ...TASK_BREAKDOWN_MODEL_OPTIONS,
])

const selectedNewSuggestionIds = computed(() => selectedSuggestionIds.value.filter((id) =>
  suggestions.value.some((suggestion) => suggestion.id === id && suggestion.status !== 'added'),
))
const contextIsStale = computed(() => Boolean(latest.value && isContextStale(props.task)))
const hasSuggestions = computed(() => suggestions.value.length > 0)
const canGenerate = computed(() => Boolean(props.task.title.trim()) && !isGenerating.value)

const syncSelectedSuggestions = () => {
  selectedSuggestionIds.value = suggestions.value
    .filter((suggestion) => suggestion.status !== 'skipped')
    .map((suggestion) => suggestion.id)
  additionalPrompt.value = latest.value?.metadata.sourcePrompt ?? ''
}

const openModal = async () => {
  try {
    await loadLatest(props.task)
    syncSelectedSuggestions()
  } catch {
    selectedSuggestionIds.value = []
  }
}

watch(
  () => [props.isOpen, props.task?.id] as const,
  async ([isOpen]) => {
    if (isOpen) {
      await openModal()
      return
    }
    clear()
    isAiSettingsOpen.value = false
    newKeyInput.value = ''
    keyFeedback.value = ''
  },
  { immediate: true },
)

watch(suggestions, syncSelectedSuggestions)

const generateSuggestions = async () => {
  const modelId = selectedModelId.value === DEFAULT_TASK_BREAKDOWN_MODEL_ID
    ? undefined
    : selectedModelId.value
  try {
    await generate(props.task, additionalPrompt.value, modelId)
    syncSelectedSuggestions()
  } catch {
    // The composable keeps a categorized, user-safe error for the modal.
  }
}

const toggleSuggestion = (suggestionId: string) => {
  if (selectedSuggestionIds.value.includes(suggestionId)) {
    selectedSuggestionIds.value = selectedSuggestionIds.value.filter((id) => id !== suggestionId)
  } else {
    selectedSuggestionIds.value = [...selectedSuggestionIds.value, suggestionId]
  }
}

const handleConfirm = async () => {
  if (!selectedNewSuggestionIds.value.length || isSaving.value) return
  isSaving.value = true
  try {
    const selections = suggestions.value.map((suggestion) => ({
      suggestionId: suggestion.id,
      selected: selectedSuggestionIds.value.includes(suggestion.id),
    }))
    const createdSteps = await confirmSelection(props.task.id, selections)
    if (createdSteps.length) emit('close')
  } finally {
    isSaving.value = false
  }
}

const handleAddKey = () => {
  keyFeedback.value = ''
  keyFeedbackIsError.value = false
  const res = addKey(newKeyInput.value)
  if (!res.success) {
    keyFeedback.value = res.error ?? 'Kunde inte lägga till nyckeln.'
    keyFeedbackIsError.value = true
    return
  }
  newKeyInput.value = ''
  keyFeedback.value = 'API-nyckel tillagd.'
}

const closeModal = () => emit('close')

const errorTitle = computed(() => {
  switch (error.value?.kind) {
    case 'network': return 'Nätverksproblem'
    case 'quota': return 'AI-kvoten är nådd'
    case 'app-check': return 'App Check kunde inte verifiera appen'
    case 'configuration': return 'AI-tjänsten är inte tillgänglig'
    case 'invalid-input': return 'Kontrollera texten'
    case 'invalid-response': return 'AI-svaret kunde inte användas'
    case 'overloaded': return 'Modellen är tillfälligt överbelastad'
    default: return 'Det gick inte att skapa förslag'
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 px-3 py-4 sm:px-6"
      role="presentation"
      @click.self="closeModal"
      @keydown.esc.stop.prevent="closeModal"
    >
      <section
        class="flex max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-breakdown-title"
        aria-describedby="task-breakdown-description"
      >
        <header class="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div class="flex min-w-0 items-center gap-3">
            <Sparkles :size="20" class="shrink-0 text-[#2564cf] dark:text-blue-400" aria-hidden="true" />
            <div class="min-w-0">
              <h2 id="task-breakdown-title" class="text-base font-semibold text-slate-900 dark:text-slate-100">Bryt ner uppgiften</h2>
              <p class="truncate text-sm text-slate-500 dark:text-slate-400">{{ task.title }}</p>
            </div>
          </div>
          <button
            class="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            type="button"
            aria-label="Stäng AI-förslag"
            @click="closeModal"
          >
            <X :size="18" aria-hidden="true" />
          </button>
        </header>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <p id="task-breakdown-description" class="text-sm text-slate-600 dark:text-slate-300">
            Granska vilken uppgiftstext som skickas till AI. Du väljer vilka förslag som blir delsteg.
          </p>

          <section class="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950" aria-label="Kontext som skickas till AI">
            <div>
              <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Titel</h3>
              <p class="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-100">{{ task.title }}</p>
            </div>
            <div>
              <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Anteckning</h3>
              <p class="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">{{ task.note?.trim() || 'Ingen anteckning' }}</p>
            </div>
            <p class="border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Titel, anteckning och eventuell extratext skickas till Firebase AI Logic/Gemini när du genererar.
            </p>
          </section>

          <label class="block">
            <span class="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-100">Extra instruktion <span class="font-normal text-slate-500">(valfritt)</span></span>
            <textarea
              v-model="additionalPrompt"
              class="min-h-20 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#2564cf] focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              maxlength="1000"
              placeholder="Till exempel: Dela upp arbetet i korta pass"
              :disabled="isGenerating"
            />
            <span class="mt-1 block text-right text-xs text-slate-500">{{ additionalPrompt.length }}/1000</span>
          </label>

          <!-- AI Model & Key Settings -->
          <section class="rounded-lg border border-slate-200 dark:border-slate-700" aria-labelledby="modal-ai-settings-heading">
            <div class="flex items-center gap-3 px-4 py-3">
              <label for="modal-model-select" class="shrink-0 text-sm font-medium text-slate-800 dark:text-slate-100">Modell</label>
              <select
                id="modal-model-select"
                v-model="selectedModelId"
                class="min-h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-[#2564cf] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                :disabled="isGenerating"
              >
                <option v-for="model in allModelOptions" :key="model.id" :value="model.id">
                  {{ model.name }}
                </option>
              </select>
              <button
                type="button"
                class="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                :aria-expanded="isAiSettingsOpen"
                aria-controls="modal-ai-key-panel"
                @click="isAiSettingsOpen = !isAiSettingsOpen"
              >
                <Key :size="14" aria-hidden="true" />
                <span>{{ aiKeys.length ? `${aiKeys.length} ${aiKeys.length === 1 ? 'nyckel' : 'nycklar'}` : 'API-nycklar' }}</span>
                <ChevronDown :size="14" class="transition-transform" :class="{ 'rotate-180': isAiSettingsOpen }" aria-hidden="true" />
              </button>
            </div>

            <div v-if="isAiSettingsOpen" id="modal-ai-key-panel" class="border-t border-slate-200 px-4 py-3 dark:border-slate-700" role="region" aria-label="API-nyckelhantering">
              <p class="mb-2 text-xs text-slate-500 dark:text-slate-400">
                Egna Gemini API-nycklar testas i turordning. Om kvoten tar slut används nästa nyckel automatiskt.
              </p>

              <form class="mb-2 flex gap-2" @submit.prevent="handleAddKey">
                <label class="sr-only" for="modal-new-ai-key">Ny Gemini API-nyckel</label>
                <input
                  id="modal-new-ai-key"
                  v-model="newKeyInput"
                  type="password"
                  autocomplete="off"
                  placeholder="Klistra in API-nyckel (AIzaSy...)"
                  class="min-h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#2564cf] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="submit"
                  class="min-h-9 shrink-0 rounded-md bg-[#2564cf] px-3 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                  :disabled="!newKeyInput.trim()"
                >
                  Lägg till
                </button>
              </form>
              <p v-if="keyFeedback" class="mb-2 text-xs" :class="keyFeedbackIsError ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-400'" role="status">
                {{ keyFeedback }}
              </p>

              <ul v-if="aiKeys.length" class="divide-y divide-slate-200 rounded-md border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                <li v-for="(key, index) in aiKeys" :key="index" class="flex items-center justify-between gap-2 px-3 py-2">
                  <div class="flex min-w-0 items-center gap-2">
                    <span class="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {{ index + 1 }}
                    </span>
                    <span class="truncate font-mono text-xs text-slate-700 dark:text-slate-200">
                      {{ maskApiKey(key) }}
                    </span>
                    <span v-if="index === 0" class="rounded bg-blue-100 px-1 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                      Primär
                    </span>
                  </div>
                  <button
                    type="button"
                    class="grid size-7 shrink-0 place-items-center rounded text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    :aria-label="`Ta bort nyckel ${index + 1}`"
                    @click="removeKey(index)"
                  >
                    <Trash2 :size="14" aria-hidden="true" />
                  </button>
                </li>
              </ul>
              <p v-else class="text-xs text-slate-500 dark:text-slate-400">
                Inga egna nycklar. Appen använder projektets standardkvot.
              </p>
            </div>
          </section>

          <p v-if="contextIsStale" class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200" role="status">
            Förslagen skapades från en äldre titel eller anteckning.
          </p>

          <div v-if="error" class="space-y-3 rounded-lg border border-red-300 bg-red-50 p-3 text-red-900 dark:border-red-900 dark:bg-red-950/35 dark:text-red-200" role="alert">
            <div class="flex items-start gap-2">
              <AlertCircle :size="18" class="mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <h3 class="text-sm font-semibold">{{ errorTitle }}</h3>
                <p class="mt-1 text-sm">{{ error.message }}</p>
                <button
                  v-if="error.kind === 'quota' || error.kind === 'overloaded'"
                  type="button"
                  class="mt-2 inline-block text-xs font-medium text-[#2564cf] underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  @click="isAiSettingsOpen = true"
                >
                  Hantera API-nycklar och modell ↑
                </button>
              </div>
            </div>
            <button
              v-if="error.kind === 'overloaded' || error.kind === 'network'"
              class="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              type="button"
              :disabled="isGenerating"
              @click="generateSuggestions"
            >
              <RefreshCw :size="15" :class="{ 'animate-spin': isGenerating }" aria-hidden="true" />
              Försök igen
            </button>
          </div>

          <section v-if="hasSuggestions" aria-labelledby="task-breakdown-suggestions-heading">
            <div class="mb-2 flex items-center justify-between gap-3">
              <h3 id="task-breakdown-suggestions-heading" class="text-sm font-semibold text-slate-900 dark:text-slate-100">Föreslagna delsteg</h3>
              <button
                class="text-sm font-medium text-[#2564cf] hover:underline dark:text-blue-400"
                type="button"
                :disabled="isGenerating"
                @click="generateSuggestions()"
              >
                Generera nya förslag
              </button>
            </div>
            <ul class="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
              <li v-for="suggestion in suggestions" :key="suggestion.id" class="p-2">
                <label class="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input
                    class="size-4 shrink-0 accent-[#2564cf]"
                    type="checkbox"
                    :checked="selectedSuggestionIds.includes(suggestion.id)"
                    :disabled="suggestion.status === 'added' || isGenerating || isSaving"
                    @change="toggleSuggestion(suggestion.id)"
                  />
                  <span class="min-w-0 flex-1 text-sm text-slate-800 dark:text-slate-100" :class="{ 'line-through opacity-60': suggestion.status === 'added' }">
                    {{ suggestion.title }}
                  </span>
                  <span v-if="suggestion.status === 'added'" class="text-xs font-medium text-emerald-700 dark:text-emerald-400">Tillagt</span>
                  <Check v-else-if="selectedSuggestionIds.includes(suggestion.id)" :size="15" class="text-[#2564cf] dark:text-blue-400" aria-hidden="true" />
                </label>
              </li>
            </ul>
          </section>

          <div v-if="isLoading" class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300" role="status">
            <Loader2 :size="16" class="animate-spin" aria-hidden="true" />
            Läser in sparade förslag…
          </div>
          <div v-else-if="isGenerating" class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300" role="status">
            <Loader2 :size="16" class="animate-spin" aria-hidden="true" />
            Skapar förslag…
          </div>
          <button
            v-else-if="!hasSuggestions"
            class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#2564cf] px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            type="button"
            :disabled="!canGenerate"
            @click="generateSuggestions()"
          >
            <Sparkles :size="16" aria-hidden="true" />
            Generera förslag
          </button>
        </div>

        <footer class="flex flex-col-reverse gap-2 border-t border-slate-200 p-4 sm:flex-row sm:justify-end dark:border-slate-700">
          <button
            class="min-h-10 rounded-lg px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            type="button"
            @click="closeModal"
          >
            Stäng
          </button>
          <div v-if="hasSuggestions" class="flex flex-col items-end gap-1.5">
            <p v-if="confirmError" class="text-xs text-red-600 dark:text-red-400" role="alert">{{ confirmError }}</p>
            <button
              class="min-h-10 rounded-lg bg-[#2564cf] px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              :disabled="!selectedNewSuggestionIds.length || isGenerating || isSaving"
              @click="handleConfirm"
            >
              {{ isSaving ? 'Sparar…' : `Lägg till valda (${selectedNewSuggestionIds.length})` }}
            </button>
          </div>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
