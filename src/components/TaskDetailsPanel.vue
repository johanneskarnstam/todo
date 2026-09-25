<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ArrowLeft } from '@lucide/vue'
import type { List, Step, Task, TaskReminder } from '@/types'

interface Props {
  task: Task
  steps: Step[]
  availableLists?: List[]
}

interface Emits {
  (event: 'close'): void
  (event: 'save-title', title: string): void
  (event: 'add-step', title: string): void
  (event: 'save-step-title', stepId: string, title: string): void
  (event: 'toggle-step', stepId: string): void
  (event: 'delete-step', stepId: string): void
  (event: 'toggle-my-day'): void
  (event: 'set-due-date', dueDate: string): void
  (event: 'save-reminder', reminder: TaskReminder | null): void
  (event: 'save-note', note: string): void
  (event: 'save-tags', tags: string[]): void
  (event: 'move-to-list', listId: string): void
  (event: 'delete-task'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const title = ref(props.task.title)
const note = ref(props.task.note ?? '')
const tagTitle = ref('')
const stepTitle = ref('')
const editingStepId = ref<string | null>(null)
const editingStepTitle = ref('')
const titleInput = ref<HTMLInputElement | null>(null)
const reminderOffset = ref(String(props.task.reminder?.offsetMinutes ?? ''))

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
    tags.value = [...(props.task.tags ?? [])]
    reminderOffset.value = String(props.task.reminder?.offsetMinutes ?? '')
  },
)

onMounted(() => {
  void nextTick(() => titleInput.value?.focus())
})

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

const tags = ref<string[]>([...(props.task.tags ?? [])])

const saveTags = (nextTags: string[]) => {
  tags.value = [...new Set(nextTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))]
  emit('save-tags', tags.value)
}

const addTag = () => {
  const nextTag = tagTitle.value.trim()
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

const saveReminder = () => {
  if (!reminderOffset.value || !props.task.dueDate) {
    emit('save-reminder', null)
    return
  }

  const offset = Number(reminderOffset.value)
  if (![0, 10, 60, 1440].includes(offset)) return
  emit('save-reminder', { offsetMinutes: offset as TaskReminder['offsetMinutes'] })
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
  <aside class="fixed inset-x-0 bottom-0 top-14 z-50 flex flex-col bg-white shadow-2xl dark:bg-slate-900 lg:static lg:z-auto lg:w-80 lg:shrink-0 lg:rounded-l-xl lg:border-l lg:border-slate-200 lg:shadow-none dark:lg:border-slate-700" role="dialog" aria-modal="true" aria-labelledby="task-details-heading">
    <div class="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
      <span id="task-details-heading" class="text-sm font-semibold text-slate-700 dark:text-slate-200">Uppgiftsdetaljer</span>
      <button class="grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700" type="button" aria-label="Stäng uppgiftsdetaljer" @click="emit('close')">
        <ArrowLeft :size="19" :stroke-width="1.8" aria-hidden="true" />
      </button>
    </div>

    <div class="min-h-0 flex flex-1 flex-col gap-3 overflow-y-auto bg-slate-100 p-3 dark:bg-slate-950">
      <section class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/40" aria-labelledby="title-heading">
        <label id="title-heading" class="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" for="task-title">Titel</label>
        <input
          id="task-title"
          ref="titleInput"
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
            #{{ tag }}
            <button type="button" :aria-label="`Ta bort taggen ${tag}`" @click="removeTag(tag)">×</button>
          </span>
        </div>
        <form class="mt-2 flex gap-2" @submit.prevent="addTag">
          <label class="sr-only" for="new-task-tag">Ny tagg</label>
          <input id="new-task-tag" v-model="tagTitle" class="min-w-0 flex-1 rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#2564cf] dark:border-slate-700" type="text" placeholder="Lägg till tagg" />
          <button class="rounded-lg bg-[#2564cf] px-3 text-sm text-white" type="submit">Lägg till</button>
        </form>
      </section>

      <section class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/40" aria-labelledby="steps-heading">
        <h2 id="steps-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Delsteg</h2>
        <div class="space-y-1">
          <label v-for="step in steps" :key="step.id" class="flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
            <input
              class="size-4 accent-[#2564cf]"
              type="checkbox"
              :checked="step.completed"
              :aria-label="`Markera delsteg som klart: ${step.title}`"
              @change="emit('toggle-step', step.id)"
            />
            <input
              v-if="editingStepId === step.id"
              v-model="editingStepTitle"
              class="min-w-0 flex-1 border-b border-[#2564cf] bg-transparent outline-none dark:text-slate-100"
              type="text"
              :aria-label="`Redigera delsteg: ${step.title}`"
              autofocus
              @blur="saveStepTitle"
              @keydown.enter.prevent="saveStepTitle"
              @keydown.escape="editingStepId = null"
            />
            <button
              v-else
              class="min-w-0 flex-1 truncate text-left"
              type="button"
              :class="{ 'text-slate-400 line-through dark:text-slate-500': step.completed }"
              @click="startEditingStep(step)"
            >
              {{ step.title }}
            </button>
            <button
              class="grid size-8 shrink-0 place-items-center rounded-full text-base text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
              type="button"
              :aria-label="`Ta bort delsteg: ${step.title}`"
              @click="emit('delete-step', step.id)"
            >
              ×
            </button>
          </label>
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
          <span class="text-xl" :class="task.myDay ? 'text-[#2564cf] dark:text-blue-400' : 'text-slate-500'" aria-hidden="true">☼</span>
          <span class="flex-1">{{ task.myDay ? 'Ta bort från Min dag' : 'Lägg till i Min dag' }}</span>
          <span v-if="task.myDay" class="text-xs text-[#2564cf] dark:text-blue-400">Added</span>
        </button>

        <label v-if="availableLists && availableLists.length > 1" class="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
          <span class="text-lg text-slate-500" aria-hidden="true">▤</span>
          <span class="flex-1">Lista</span>
          <select class="max-w-44 bg-transparent text-right text-sm text-slate-600 outline-none dark:text-slate-300" :value="task.listId" aria-label="Uppgiftens lista" @change="emit('move-to-list', ($event.target as HTMLSelectElement).value)">
            <option v-for="list in availableLists" :key="list.id" :value="list.id">{{ list.name }}</option>
          </select>
        </label>

        <label class="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
          <span class="text-lg text-slate-500" aria-hidden="true">▣</span>
          <span class="flex-1">Förfallodatum</span>
          <input class="w-32 bg-transparent text-right text-sm text-slate-600 outline-none dark:text-slate-300" type="date" :value="dueDate" aria-label="Uppgiftens förfallodatum" @change="emit('set-due-date', ($event.target as HTMLInputElement).value)" />
        </label>
        <label class="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
          <span class="text-lg text-slate-500" aria-hidden="true">◷</span>
          <span class="flex-1">Förfallotid</span>
          <input class="w-24 bg-transparent text-right text-sm text-slate-600 outline-none disabled:opacity-50 dark:text-slate-300" type="time" :value="dueTime" :disabled="!dueDate" aria-label="Uppgiftens förfallotid" @change="saveDueTime(($event.target as HTMLInputElement).value)" />
        </label>
        <div class="flex flex-wrap gap-2 px-2" aria-label="Snabbval för förfallodatum">
          <button class="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-[#2564cf] hover:text-[#2564cf] dark:border-slate-700 dark:text-slate-300" type="button" @click="selectQuickDate(0)">Idag</button>
          <button class="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-[#2564cf] hover:text-[#2564cf] dark:border-slate-700 dark:text-slate-300" type="button" @click="selectQuickDate(1)">Imorgon</button>
          <button class="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-[#2564cf] hover:text-[#2564cf] dark:border-slate-700 dark:text-slate-300" type="button" @click="selectQuickDate(7)">Nästa vecka</button>
          <button class="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-[#2564cf] hover:text-[#2564cf] dark:border-slate-700 dark:text-slate-300" type="button" @click="selectQuickDate(null)">Rensa</button>
        </div>
        <label class="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
          <span class="text-lg text-slate-500" aria-hidden="true">◉</span>
          <span class="flex-1">Påminnelse</span>
          <select v-model="reminderOffset" class="max-w-44 bg-transparent text-right text-sm text-slate-600 outline-none disabled:opacity-50 dark:text-slate-300" :disabled="!dueDate" aria-label="Påminnelse" @change="saveReminder">
            <option value="">Ingen</option>
            <option value="0">Vid förfallotid</option>
            <option value="10">10 minuter före</option>
            <option value="60">1 timme före</option>
            <option value="1440">1 dag före</option>
          </select>
        </label>
        <p v-if="task.reminder && dueDate" class="px-2 text-xs text-[#2564cf] dark:text-blue-400">Påminnelse aktiv</p>
        <p v-else class="px-2 text-xs text-slate-500 dark:text-slate-400">Välj datum först för att aktivera en påminnelse.</p>
        </div>
      </section>

      <section class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/40" aria-labelledby="notes-heading">
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
  </aside>
</template>
