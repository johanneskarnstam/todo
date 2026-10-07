<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft, Bell, CalendarDays, Check, ChevronDown, Clock, Copy, Expand, Plus, Shrink, Sun, Trash2 } from '@lucide/vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ReminderEditor from '@/components/ReminderEditor.vue'
import type { Step, Task, TaskPriority, TaskReminder } from '@/types'
import { normalizeTag, normalizeTags } from '@/utils/taskTags'
import { getTaskPriority, isTaskPriority } from '@/utils/taskPriority'
import { useDragReorder } from '@/composables/useDragReorder'

interface Props {
  task: Task
  steps: Step[]
  expanded?: boolean
  availableTags?: string[]
}

interface Emits {
  (event: 'close'): void
  (event: 'copy-link'): void
  (event: 'update:expanded', expanded: boolean): void
  (event: 'save-title', title: string): void
  (event: 'add-step', title: string): void
  (event: 'save-step-title', stepId: string, title: string): void
  (event: 'toggle-step', stepId: string): void
  (event: 'toggle-task-completed'): void
  (event: 'delete-step', stepId: string): void
  (event: 'toggle-my-day'): void
  (event: 'set-priority', priority: TaskPriority): void
  (event: 'set-due-date', dueDate: string): void
  (event: 'save-reminders', reminders: TaskReminder[]): void
  (event: 'save-note', note: string): void
  (event: 'save-tags', tags: string[]): void
  (event: 'select-tag', tag: string): void
  (event: 'delete-task'): void
  (event: 'reorder-steps', orderedIds: string[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const localIsExpanded = ref(false)
const isExpanded = computed(() => props.expanded ?? localIsExpanded.value)
const setExpanded = (expanded: boolean) => {
  if (props.expanded === undefined) localIsExpanded.value = expanded
  emit('update:expanded', expanded)
}

const title = ref(props.task.title)
const note = ref(props.task.note ?? '')
const tagTitle = ref('')
const stepTitle = ref('')
const isStepToolsExpanded = ref(false)
const stepImportJson = ref('')
const stepImportError = ref('')
const stepImportStatus = ref('')
const isImportingSteps = ref(false)
const editingStepId = ref<string | null>(null)
const editingStepTitle = ref('')
const stepsContainerRef = ref<HTMLElement | null>(null)

const { isDragging: isDraggingStep, dragIndex: dragStepIndex } = useDragReorder({
  containerRef: stepsContainerRef,
  items: computed(() => props.steps),
  onReorder: (orderedIds) => emit('reorder-steps', orderedIds),
  enabled: computed(() => props.steps.length > 1),
  itemSelector: '[data-step-id]',
  handleSelector: '[data-step-id]',
})
const isParentCompletionConfirmationOpen = ref(false)
const showReminderEditor = ref(false)
const MAX_REMINDERS = 5
const stepImportExample = computed(() => JSON.stringify({
  steps: ['Delsteg 1', 'Delsteg 2'],
}, null, 2))
const taskContextJson = computed(() => {
  const context = JSON.stringify({
    title: props.task.title,
    note: note.value,
    expectedResponseFormat: { steps: ['Delsteg 1', 'Delsteg 2'] },
  }, null, 2)

  return [
    'Skapa konkreta delsteg för uppgiften nedan. Använd anteckningen som stöd och formulera varje steg som en tydlig åtgärd. Låt mig kunna kopiera ut resultaten direkt. Skriv endast JSON, inga förklaringar eller kommentarer.',
    'Förväntat svarsformat är JSON. Returnera endast giltig JSON enligt noden expectedResponseFormat. Inget annat får returneras.',
    '',
    context,
  ].join('\n')
})

const dueDate = computed(() => {
  if (typeof props.task.dueDate === 'string') return props.task.dueDate.slice(0, 10)
  return props.task.dueDate?.toDate().toISOString().slice(0, 10) ?? ''
})

const dueTime = computed(() => {
  if (typeof props.task.dueDate === 'string' && props.task.dueDate.length >= 16) return props.task.dueDate.slice(11, 16)
  return ''
})

watch(
  () => props.task.id,
  () => {
    title.value = props.task.title
    note.value = props.task.note ?? ''
    tags.value = normalizeTags(props.task.tags ?? [])
    showReminderEditor.value = false
    setExpanded(false)
    isStepToolsExpanded.value = false
    stepImportJson.value = ''
    stepImportError.value = ''
    stepImportStatus.value = ''
  },
)

const saveTitle = () => {
  const nextTitle = title.value.trim()
  if (nextTitle && nextTitle !== props.task.title) emit('save-title', nextTitle)
  title.value = nextTitle || props.task.title
}

const addStep = () => {
  const nextTitle = stepTitle.value.trim()
  if (!nextTitle) return

  emit('add-step', nextTitle)
  stepTitle.value = ''
}

const handleToggleStep = (stepId: string) => {
  const step = props.steps.find((item) => item.id === stepId)
  const completesAllSteps = Boolean(step && !step.completed && props.steps.every((item) => item.id === stepId || item.completed))

  emit('toggle-step', stepId)

  if (!completesAllSteps || props.task.completed) return
  isParentCompletionConfirmationOpen.value = true
}

const confirmParentTaskCompletion = () => {
  isParentCompletionConfirmationOpen.value = false
  emit('toggle-task-completed')
}

const tags = ref<string[]>(normalizeTags(props.task.tags ?? []))
const tagSuggestions = computed(() => {
  const query = normalizeTag(tagTitle.value)
  if (!query) return []

  return [...new Set(props.availableTags ?? [])]
    .filter((tag) => tag.startsWith(query) && !tags.value.includes(tag))
})

const saveTags = (nextTags: string[]) => {
  tags.value = normalizeTags(nextTags)
  emit('save-tags', tags.value)
}

const addTag = (suggestedTag?: string) => {
  const nextTag = normalizeTag(suggestedTag ?? tagTitle.value)
  if (!nextTag) return
  saveTags([...tags.value, nextTag])
  tagTitle.value = ''
}

const removeTag = (tag: string) => {
  saveTags(tags.value.filter((item) => item !== tag))
}

const saveNote = () => {
  if (note.value !== (props.task.note ?? '')) emit('save-note', note.value)
}

const loadStepImportFile = async (event: Event) => {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  stepImportError.value = ''
  stepImportStatus.value = ''
  if (file.size > 1_000_000) {
    stepImportError.value = 'Filen får vara högst 1 MB.'
    return
  }

  try {
    stepImportJson.value = await file.text()
  } catch {
    stepImportError.value = 'Filen kunde inte läsas.'
  }
}

const copyTaskContext = async () => {
  try {
    await navigator.clipboard.writeText(taskContextJson.value)
    stepImportStatus.value = 'Uppgiftskontext kopierad.'
    stepImportError.value = ''
  } catch {
    stepImportError.value = 'Uppgiftskontexten kunde inte kopieras.'
    stepImportStatus.value = ''
  }
}

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const importSteps = async () => {
  stepImportError.value = ''
  stepImportStatus.value = ''
  if (new TextEncoder().encode(stepImportJson.value).length > 1_000_000) {
    stepImportError.value = 'JSON-texten får vara högst 1 MB.'
    return
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stepImportJson.value)
  } catch {
    stepImportError.value = 'Fältet innehåller inte giltig JSON.'
    return
  }

  if (!isJsonObject(parsed) || !Array.isArray(parsed.steps)) {
    stepImportError.value = 'JSON måste innehålla ett objekt med en lista i steps.'
    return
  }

  const stepTitles = parsed.steps.map((step) => typeof step === 'string' ? step.trim() : '')
  if (!stepTitles.length || stepTitles.some((step) => !step)) {
    stepImportError.value = 'JSON måste innehålla minst ett delsteg med text.'
    return
  }
  if (stepTitles.length > 500) {
    stepImportError.value = 'Du kan importera högst 500 delsteg åt gången.'
    return
  }

  isImportingSteps.value = true
  try {
    for (const stepTitle of [...stepTitles].reverse()) emit('add-step', stepTitle)
    stepImportJson.value = ''
    stepImportStatus.value = `${stepTitles.length} delsteg importerade.`
  } finally {
    isImportingSteps.value = false
  }
}

const priorityOptions: Array<{ value: TaskPriority; label: string }> = [
  { value: 'low', label: 'Låg' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Hög' },
  { value: 'urgent', label: 'Brådskande' },
]

const handlePriorityChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  if (isTaskPriority(value)) emit('set-priority', value)
}

const formatDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const selectQuickDate = (daysFromToday: number | null) => {
  if (daysFromToday === null) {
    emit('set-due-date', '')
    return
  }
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + daysFromToday)
  emit('set-due-date', formatDate(date))
}

const saveDueTime = (time: string) => {
  if (dueDate.value && time) emit('set-due-date', `${dueDate.value}T${time}`)
}

const dateInputRef = ref<HTMLInputElement | null>(null)
const timeInputRef = ref<HTMLInputElement | null>(null)

const openDatePicker = () => {
  try {
    dateInputRef.value?.showPicker?.()
  } catch {
    // Ignore if showPicker is unsupported or unavailable
  }
}

const openTimePicker = () => {
  if (!dueDate.value) return
  try {
    timeInputRef.value?.showPicker?.()
  } catch {
    // Ignore if showPicker is unsupported or unavailable
  }
}

const formatReminderLabel = (reminder: TaskReminder): string => {
  if (reminder.mode === 'absolute') {
    const d = new Date(reminder.at)
    if (Number.isNaN(d.getTime())) return reminder.at
    return d.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
  }
  if (reminder.offsetMinutes === 0) return 'Vid förfallotid'
  if (reminder.offsetMinutes === 10) return '10 minuter före deadline'
  if (reminder.offsetMinutes === 60) return '1 timme före deadline'
  if (reminder.offsetMinutes === 120) return '2 timmar före deadline'
  if (reminder.offsetMinutes === 1440) return '1 dag före deadline'
  return `${reminder.offsetMinutes} min före deadline`
}

const addReminder = (reminder: TaskReminder) => {
  const current = props.task.reminders ?? []
  emit('save-reminders', [...current, reminder])
  showReminderEditor.value = false
}

const removeReminder = (index: number) => {
  const current = props.task.reminders ?? []
  emit('save-reminders', current.filter((_, i) => i !== index))
}

const startEditingStep = (step: Step) => {
  editingStepId.value = step.id
  editingStepTitle.value = step.title
}

const saveStepTitle = () => {
  const stepId = editingStepId.value
  const nextTitle = editingStepTitle.value.trim()
  if (stepId && nextTitle) emit('save-step-title', stepId, nextTitle)
  editingStepId.value = null
}
</script>

<template>
  <aside
    class="fixed inset-x-0 bottom-0 top-14 z-50 flex flex-col bg-white shadow-2xl dark:bg-slate-900"
    :class="isExpanded ? 'lg:static lg:z-auto lg:h-full lg:min-h-0 lg:w-[50vw] lg:shrink-0 lg:rounded-l-xl lg:border-l lg:border-slate-200 lg:shadow-none 2xl:w-[33vw] dark:lg:border-slate-700' : 'lg:static lg:z-auto lg:h-full lg:min-h-0 lg:w-80 lg:shrink-0 lg:rounded-l-xl lg:border-l lg:border-slate-200 lg:shadow-none dark:lg:border-slate-700'"
    role="dialog"
    :aria-modal="isExpanded ? 'false' : 'true'"
    aria-labelledby="task-details-heading"
    @keydown.esc="setExpanded(false)"
  >
    <div class="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
      <span id="task-details-heading" class="text-sm font-semibold text-slate-700 dark:text-slate-200">Uppgiftsdetaljer</span>
      <div class="flex items-center gap-1">
        <button
          class="hidden size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:grid"
          type="button"
          :aria-label="isExpanded ? 'Minimera uppgiftsdetaljer' : 'Expandera uppgiftsdetaljer'"
          :aria-pressed="isExpanded"
          @click="setExpanded(!isExpanded)"
        >
          <Shrink v-if="isExpanded" :size="17" aria-hidden="true" />
          <Expand v-else :size="17" aria-hidden="true" />
        </button>
        <button class="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" type="button" aria-label="Kopiera uppgiftslänk" @click="emit('copy-link')">
          <Copy :size="17" aria-hidden="true" />
        </button>
        <button class="grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700" type="button" aria-label="Stäng uppgiftsdetaljer" @click="emit('close')">
          <ArrowLeft :size="19" :stroke-width="1.8" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div class="min-h-0 flex flex-1 flex-col gap-3 overflow-y-auto bg-slate-100 p-3 dark:bg-slate-950">
      <section class="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="title-heading">
        <label id="title-heading" class="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" for="task-title">Titel</label>
        <input
          id="task-title"
          v-model="title"
          class="w-full border-b border-transparent bg-transparent pb-2 text-lg font-semibold text-slate-800 outline-none transition focus:border-[#2564cf] dark:text-slate-100"
          type="text"
          aria-label="Uppgiftens titel"
          @blur="saveTitle"
          @keydown.enter.prevent="saveTitle"
        />
      </section>

      <section class="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="priority-heading">
        <h2 id="priority-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Prioritet</h2>
        <label class="flex min-h-10 items-center justify-between gap-3 text-sm text-slate-700 dark:text-slate-200">
          <span>Uppgiftens nivå</span>
          <span class="relative inline-flex items-center">
            <select class="max-w-40 appearance-none rounded-md border border-slate-200 bg-white py-1.5 pl-2 pr-8 dark:border-slate-700 dark:bg-slate-900" aria-label="Uppgiftens prioritet" :value="getTaskPriority(task)" @change="handlePriorityChange">
              <option v-for="option in priorityOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-2.5 text-slate-500 dark:text-slate-400" :size="16" aria-hidden="true" />
          </span>
        </label>
      </section>

      <section class="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="tags-heading">
        <h2 id="tags-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Taggar</h2>
        <div class="flex flex-wrap gap-2">
          <span v-for="tag in tags" :key="tag" class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs text-[#2564cf] dark:bg-blue-950/40 dark:text-blue-300">
            <button type="button" :aria-label="`Visa uppgifter med taggen #${tag}`" @click="emit('select-tag', tag)">#{{ tag }}</button>
            <button type="button" :aria-label="`Ta bort taggen ${tag}`" @click="removeTag(tag)">×</button>
          </span>
        </div>
        <form class="mt-2 flex flex-col gap-2" @submit.prevent="addTag()">
          <label class="sr-only" for="new-task-tag">Ny tagg</label>
          <div class="flex gap-2">
            <input id="new-task-tag" v-model="tagTitle" autocomplete="off" class="min-w-0 flex-1 rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#2564cf] dark:border-slate-700" type="text" placeholder="Lägg till tagg" />
            <button class="rounded-lg bg-[#2564cf] px-3 text-sm text-white" type="submit">Lägg till</button>
          </div>
          <ul v-if="tagSuggestions.length" class="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" aria-label="Taggförslag">
            <li v-for="tag in tagSuggestions" :key="tag">
              <button class="w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" type="button" :aria-label="`Lägg till befintlig tagg #${tag}`" @click="addTag(tag)">#{{ tag }}</button>
            </li>
          </ul>
        </form>
        <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Små bokstäver används; mellanslag blir bindestreck.</p>
      </section>

      <section class="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="steps-heading">
        <h2 id="steps-heading" class="mb-2 flex min-h-8 items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <span>Delsteg</span>
          <span v-if="steps.length" class="font-normal normal-case tracking-normal">{{ steps.length }}</span>
        </h2>
        <div ref="stepsContainerRef" class="space-y-1">
          <div
            v-for="(step, index) in steps"
            :key="step.id"
            :data-step-id="step.id"
            class="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm text-slate-700 select-none hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            :class="[
              steps.length > 1 ? 'cursor-grab active:cursor-grabbing' : '',
              dragStepIndex === index ? 'opacity-50' : '',
            ]"
          >
            <span
              class="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-slate-400 dark:text-slate-500"
              aria-hidden="true"
            >{{ index + 1 }}</span>
            <button
              class="grid size-6 shrink-0 place-items-center rounded-full border border-slate-400 text-xs text-white transition hover:border-[#2564cf] dark:border-slate-500"
              :class="{ 'border-[#2564cf] bg-[#2564cf] dark:border-blue-400 dark:bg-blue-400': step.completed }"
              type="button"
              role="checkbox"
              :aria-checked="step.completed"
              :aria-label="`Markera delsteg som klart: ${step.title}`"
              @pointerdown.stop
              @click="handleToggleStep(step.id)"
            >
              <Check v-if="step.completed" :size="14" aria-hidden="true" />
            </button>
            <input
              v-if="editingStepId === step.id"
              v-model="editingStepTitle"
              class="min-w-0 flex-1 border-b border-[#2564cf] bg-transparent outline-none dark:text-slate-100"
              type="text"
              :aria-label="`Redigera delsteg: ${step.title}`"
              autofocus
              @pointerdown.stop
              @blur="saveStepTitle"
              @keydown.enter.prevent="saveStepTitle"
              @keydown.escape="editingStepId = null"
            />
            <button
              v-else
              class="min-w-0 flex-1 truncate text-left"
              :class="{ 'text-slate-400 line-through dark:text-slate-500': step.completed, 'cursor-grab active:cursor-grabbing': steps.length > 1 }"
              type="button"
              :aria-label="`Redigera delsteg: ${step.title}`"
              @click="!isDraggingStep && startEditingStep(step)"
            >
              {{ step.title }}
            </button>
            <button
              class="grid size-8 shrink-0 place-items-center rounded-full text-base text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
              type="button"
              :aria-label="`Ta bort delsteg: ${step.title}`"
              @pointerdown.stop
              @click="emit('delete-step', step.id)"
            >
              ×
            </button>
          </div>
        </div>
        <form class="mt-2 flex items-center gap-2 border-b border-slate-200 px-2 py-2 dark:border-slate-700" @submit.prevent="addStep">
          <span class="text-lg text-[#2564cf] dark:text-blue-400" aria-hidden="true">＋</span>
          <label class="sr-only" for="new-step-title">Lägg till delsteg</label>
          <input id="new-step-title" v-model="stepTitle" class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500" type="text" placeholder="Lägg till delsteg" />
        </form>
      </section>

      <section class="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="planning-heading">
        <h2 id="planning-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Planering</h2>
        <div class="space-y-2">
        <button class="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" type="button" @click="emit('toggle-my-day')">
          <Sun :size="18" :class="task.myDay ? 'text-[#2564cf] dark:text-blue-400' : 'text-slate-500'" aria-hidden="true" />
          <span class="flex-1 text-sm">{{ task.myDay ? 'Ta bort från Min dag' : 'Lägg till i Min dag' }}</span>
          <span v-if="task.myDay" class="text-xs text-[#2564cf] dark:text-blue-400">Added</span>
        </button>

        <label class="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
          <CalendarDays :size="18" class="text-slate-500" aria-hidden="true" />
          <span class="flex-1 text-sm">Förfallodatum</span>
          <input
            ref="dateInputRef"
            class="planning-picker w-32 cursor-pointer bg-transparent text-right text-sm text-slate-600 outline-none dark:text-slate-300"
            type="date"
            :value="dueDate"
            aria-label="Uppgiftens förfallodatum"
            @click="openDatePicker"
            @change="emit('set-due-date', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label
          class="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          :class="!dueDate ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'"
        >
          <Clock :size="18" class="text-slate-500" aria-hidden="true" />
          <span class="flex-1 text-sm">Förfallotid</span>
          <input
            ref="timeInputRef"
            class="planning-picker w-24 bg-transparent text-right text-sm text-slate-600 outline-none disabled:opacity-50 dark:text-slate-300"
            :class="!dueDate ? 'cursor-not-allowed' : 'cursor-pointer'"
            type="time"
            :value="dueTime"
            :disabled="!dueDate"
            aria-label="Uppgiftens förfallotid"
            @click="openTimePicker"
            @change="saveDueTime(($event.target as HTMLInputElement).value)"
          />
        </label>
        <div class="flex flex-wrap gap-2 px-2" aria-label="Snabbval för förfallodatum">
          <button class="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:border-[#2564cf] hover:text-[#2564cf] dark:border-slate-700 dark:text-slate-300" type="button" @click="selectQuickDate(0)">Idag</button>
          <button class="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:border-[#2564cf] hover:text-[#2564cf] dark:border-slate-700 dark:text-slate-300" type="button" @click="selectQuickDate(1)">Imorgon</button>
          <button class="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:border-[#2564cf] hover:text-[#2564cf] dark:border-slate-700 dark:text-slate-300" type="button" @click="selectQuickDate(7)">Nästa vecka</button>
          <button class="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:border-[#2564cf] hover:text-[#2564cf] dark:border-slate-700 dark:text-slate-300" type="button" @click="selectQuickDate(null)">Rensa</button>
        </div>
        <!-- Reminders section -->
        <div class="flex items-center gap-3 px-2 pt-1 text-sm text-slate-700 dark:text-slate-200">
          <Bell :size="18" class="shrink-0 text-slate-500" aria-hidden="true" />
          <span class="font-medium">Påminnelser</span>
        </div>
        <ul v-if="task.reminders?.length" class="mx-2 flex flex-col gap-1" aria-label="Aktiva påminnelser">
          <li
            v-for="(reminder, index) in task.reminders"
            :key="index"
            class="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800/60"
          >
            <span class="text-slate-700 dark:text-slate-200">{{ formatReminderLabel(reminder) }}</span>
            <button
              type="button"
              class="ml-2 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
              :aria-label="`Ta bort påminnelse: ${formatReminderLabel(reminder)}`"
              @click="removeReminder(index)"
            >
              <Trash2 :size="14" aria-hidden="true" />
            </button>
          </li>
        </ul>
        <div class="px-2">
          <ReminderEditor
            v-if="showReminderEditor"
            :due-date="dueDate"
            @update:model-value="addReminder"
            @cancel="showReminderEditor = false"
          />
          <button
            v-else-if="(task.reminders?.length ?? 0) < MAX_REMINDERS"
            type="button"
            class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            @click="showReminderEditor = true"
          >
            <Plus :size="15" aria-hidden="true" />
            Lägg till påminnelse
          </button>
        </div>
        </div>
      </section>

      <section class="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="notes-heading">
        <h2 id="notes-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Anteckningar</h2>
        <label class="sr-only" for="task-note">Anteckningar</label>
        <textarea id="task-note" v-model="note" class="min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none transition focus:border-[#2564cf] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" placeholder="Lägg till en anteckning" @blur="saveNote" />
      </section>

      <div class="shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <button
          id="step-tools-toggle"
          class="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          type="button"
          aria-controls="step-tools-panel"
          :aria-expanded="isStepToolsExpanded"
          @click="isStepToolsExpanded = !isStepToolsExpanded"
        >
          <span>Förbered och importera delsteg</span>
          <ChevronDown :size="17" class="shrink-0 transition-transform" :class="{ 'rotate-180': isStepToolsExpanded }" aria-hidden="true" />
        </button>
        <div v-if="isStepToolsExpanded" id="step-tools-panel" class="border-t border-slate-200 p-4 dark:border-slate-700">
          <p class="text-sm text-slate-500 dark:text-slate-400">Kopiera kontexten till en extern AI och importera dess JSON-svar.</p>
          <label class="mt-3 block text-sm font-medium" for="task-context-json">Uppgiftskontext</label>
          <textarea id="task-context-json" aria-label="Uppgiftskontext" class="mt-1 min-h-32 w-full resize-y rounded-md border border-slate-300 bg-slate-50 p-3 font-mono text-xs outline-none dark:border-slate-600 dark:bg-slate-800" :value="taskContextJson" readonly />
          <button class="mt-2 inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800" type="button" @click="copyTaskContext">
            <Copy :size="15" aria-hidden="true" />Kopiera kontext
          </button>

          <label class="mt-4 block text-sm font-medium" for="step-import-json">JSON med delsteg</label>
          <textarea id="step-import-json" v-model="stepImportJson" aria-label="JSON för delsteg" class="mt-1 min-h-28 w-full resize-y rounded-md border border-slate-300 bg-white p-3 font-mono text-xs outline-none focus:border-[#2564cf] dark:border-slate-600 dark:bg-slate-800" :placeholder="stepImportExample" :disabled="isImportingSteps" />
          <label class="mt-3 block text-sm font-medium" for="step-import-file">Eller välj en JSON-fil</label>
          <input id="step-import-file" class="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:min-h-9 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:text-sm file:font-medium dark:text-slate-300 dark:file:bg-slate-800" type="file" accept=".json,application/json" :disabled="isImportingSteps" @change="loadStepImportFile" />
          <button class="mt-3 min-h-10 rounded-md bg-[#2564cf] px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" type="button" :disabled="isImportingSteps || !stepImportJson.trim()" @click="importSteps">
            {{ isImportingSteps ? 'Importerar...' : 'Importera delsteg' }}
          </button>
          <p v-if="stepImportStatus" class="mt-2 text-sm text-emerald-700 dark:text-emerald-300" role="status">{{ stepImportStatus }}</p>
          <p v-if="stepImportError" class="mt-2 text-sm text-red-700 dark:text-red-300" role="alert">{{ stepImportError }}</p>
          <pre class="mt-3 overflow-x-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">{{ stepImportExample }}</pre>
        </div>
      </div>
    </div>

    <div class="shrink-0 border-t border-slate-200 p-3 dark:border-slate-700">
      <button class="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950" type="button" @click="emit('delete-task')">
        <span aria-hidden="true">♲</span>
        <span>Ta bort uppgift</span>
      </button>
    </div>
    <ConfirmDialog
      v-if="isParentCompletionConfirmationOpen"
      title="Hela uppgiften klar?"
      message="Alla deluppgifter är klara. Vill du markera huvuduppgiften som slutförd?"
      confirm-label="Markera huvuduppgiften"
      @confirm="confirmParentTaskCompletion"
      @cancel="isParentCompletionConfirmationOpen = false"
    />
  </aside>
</template>

