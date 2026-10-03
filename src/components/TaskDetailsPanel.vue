<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft, Bell, CalendarDays, Check, ChevronDown, Clock, Copy, Sun } from '@lucide/vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import type { Step, Task, TaskReminder } from '@/types'
import { normalizeTag, normalizeTags } from '@/utils/taskTags'
import { useDragReorder } from '@/composables/useDragReorder'

interface Props {
  task: Task
  steps: Step[]
  availableTags?: string[]
}

interface Emits {
  (event: 'close'): void
  (event: 'copy-link'): void
  (event: 'save-title', title: string): void
  (event: 'add-step', title: string): void
  (event: 'save-step-title', stepId: string, title: string): void
  (event: 'toggle-step', stepId: string): void
  (event: 'toggle-task-completed'): void
  (event: 'delete-step', stepId: string): void
  (event: 'toggle-my-day'): void
  (event: 'set-due-date', dueDate: string): void
  (event: 'save-reminder', reminder: TaskReminder | null): void
  (event: 'save-note', note: string): void
  (event: 'save-tags', tags: string[]): void
  (event: 'select-tag', tag: string): void
  (event: 'delete-task'): void
  (event: 'reorder-steps', orderedIds: string[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const title = ref(props.task.title)
const note = ref(props.task.note ?? '')
const tagTitle = ref('')
const stepTitle = ref('')
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
const reminderOffset = ref(String(props.task.reminder?.offsetMinutes ?? ''))
const isParentCompletionConfirmationOpen = ref(false)
const reminderMenuOpen = ref(false)
const reminderOptions = [
  { value: '', label: 'Ingen' },
  { value: '0', label: 'Vid förfallotid' },
  { value: '10', label: '10 minuter före' },
  { value: '60', label: '1 timme före' },
  { value: '120', label: '2 timmar före' },
  { value: '1440', label: '1 dag före' },
]

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
    reminderOffset.value = String(props.task.reminder?.offsetMinutes ?? '')
    reminderMenuOpen.value = false
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

const saveReminder = () => {
  if (!reminderOffset.value || !props.task.dueDate) {
    emit('save-reminder', null)
    return
  }

  const offset = Number(reminderOffset.value)
  if (![0, 10, 60, 120, 1440].includes(offset)) return
  emit('save-reminder', { offsetMinutes: offset as TaskReminder['offsetMinutes'] })
}

const selectReminder = (value: string) => {
  reminderOffset.value = value
  reminderMenuOpen.value = false
  saveReminder()
}

const handleReminderMenuKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    reminderMenuOpen.value = false
    return
  }

  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (!dueDate.value) return
    reminderMenuOpen.value = true
  }
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
  <aside class="fixed inset-x-0 bottom-0 top-14 z-50 flex flex-col bg-white shadow-2xl dark:bg-slate-900 lg:static lg:z-auto lg:w-80 lg:shrink-0 lg:rounded-l-xl lg:border-l lg:border-slate-200 lg:shadow-none dark:lg:border-slate-700" role="dialog" aria-modal="true" aria-labelledby="task-details-heading" @click="reminderMenuOpen = false">
    <div class="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
      <span id="task-details-heading" class="text-sm font-semibold text-slate-700 dark:text-slate-200">Uppgiftsdetaljer</span>
      <div class="flex items-center gap-1">
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
        <div class="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
          <Bell :size="18" class="text-slate-500" aria-hidden="true" />
          <span class="flex-1 text-sm">Påminnelse</span>
          <div class="relative max-w-44" @click.stop>
            <button
              id="reminder-selector"
              class="flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-2 text-right text-sm text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-[#2564cf] disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300"
              type="button"
              role="combobox"
              aria-label="Påminnelse"
              aria-controls="reminder-options"
              :aria-expanded="reminderMenuOpen"
              aria-haspopup="listbox"
              :disabled="!dueDate"
              @click="reminderMenuOpen = !reminderMenuOpen"
              @keydown="handleReminderMenuKeydown"
            >
              <span>{{ reminderOptions.find((option) => option.value === reminderOffset)?.label }}</span>
              <ChevronDown :size="16" :stroke-width="2" class="shrink-0 text-slate-500" aria-hidden="true" />
            </button>
            <div v-if="reminderMenuOpen" id="reminder-options" class="absolute right-0 top-full z-20 mt-1 w-full min-w-44 overflow-hidden rounded-md border border-slate-200 bg-white p-1 text-left shadow-lg dark:border-slate-600 dark:bg-slate-800" role="listbox" aria-label="Påminnelsealternativ">
              <button
                v-for="option in reminderOptions"
                :key="option.value || 'none'"
                class="flex min-h-9 w-full items-center rounded px-2 text-sm hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none dark:hover:bg-slate-700 dark:focus-visible:bg-slate-700"
                :class="{ 'bg-[#eef5fc] font-medium text-[#2564cf] dark:bg-slate-700 dark:text-blue-300': reminderOffset === option.value }"
                type="button"
                role="option"
                :aria-selected="reminderOffset === option.value"
                @click="selectReminder(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </div>
        <p v-if="task.reminder && dueDate" class="px-2 text-xs text-[#2564cf] dark:text-blue-400">Påminnelse aktiv</p>
        <p v-else class="px-2 text-xs text-slate-500 dark:text-slate-400">Välj datum först för att aktivera en påminnelse.</p>
        </div>
      </section>

      <section class="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="notes-heading">
        <h2 id="notes-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Anteckningar</h2>
        <label class="sr-only" for="task-note">Anteckningar</label>
        <textarea id="task-note" v-model="note" class="min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none transition focus:border-[#2564cf] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" placeholder="Lägg till en anteckning" @blur="saveNote" />
      </section>
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

