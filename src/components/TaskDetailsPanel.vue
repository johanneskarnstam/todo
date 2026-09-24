<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { Step, Task } from '@/types'

interface Props {
  task: Task
  steps: Step[]
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
  (event: 'save-note', note: string): void
  (event: 'delete-task'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const title = ref(props.task.title)
const note = ref(props.task.note ?? '')
const stepTitle = ref('')
const editingStepId = ref<string | null>(null)
const editingStepTitle = ref('')
const titleInput = ref<HTMLInputElement | null>(null)

const dueDate = computed(() => {
  if (typeof props.task.dueDate === 'string') return props.task.dueDate
  return props.task.dueDate?.toDate().toISOString().slice(0, 10) ?? ''
})

watch(
  () => props.task.id,
  () => {
    title.value = props.task.title
    note.value = props.task.note ?? ''
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

const saveNote = () => {
  if (note.value !== (props.task.note ?? '')) emit('save-note', note.value)
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
  <aside class="fixed inset-0 z-50 flex flex-col bg-white shadow-2xl dark:bg-slate-900 lg:static lg:z-auto lg:w-80 lg:shrink-0 lg:rounded-l-xl lg:border-l lg:border-slate-200 lg:shadow-none dark:lg:border-slate-700" role="dialog" aria-modal="true" aria-labelledby="task-details-heading">
    <div class="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
      <span id="task-details-heading" class="text-sm font-semibold text-slate-700 dark:text-slate-200">Uppgiftsdetaljer</span>
      <button class="grid size-8 place-items-center rounded-lg text-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" type="button" aria-label="Stäng" @click="emit('close')">×</button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <input
        ref="titleInput"
        v-model="title"
        class="w-full border-b border-transparent bg-transparent pb-2 text-lg font-semibold text-slate-800 outline-none transition focus:border-[#2564cf] dark:text-slate-100"
        type="text"
        aria-label="Uppgiftens titel"
        @blur="saveTitle"
        @keydown.enter.prevent="saveTitle"
      />

      <section class="mt-6" aria-labelledby="steps-heading">
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

      <div class="mt-5 space-y-2">
        <button class="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" type="button" @click="emit('toggle-my-day')">
          <span class="text-xl" :class="task.myDay ? 'text-[#2564cf] dark:text-blue-400' : 'text-slate-500'" aria-hidden="true">☼</span>
          <span class="flex-1">{{ task.myDay ? 'Ta bort från Min dag' : 'Lägg till i Min dag' }}</span>
          <span v-if="task.myDay" class="text-xs text-[#2564cf] dark:text-blue-400">Added</span>
        </button>

        <label class="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
          <span class="text-lg text-slate-500" aria-hidden="true">▣</span>
          <span class="flex-1">Förfallodatum</span>
          <input class="w-32 bg-transparent text-right text-sm text-slate-600 outline-none dark:text-slate-300" type="date" :value="dueDate" aria-label="Uppgiftens förfallodatum" @change="emit('set-due-date', ($event.target as HTMLInputElement).value)" />
        </label>
      </div>

      <label class="mt-6 block" for="task-note">
        <span class="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Anteckningar</span>
        <textarea id="task-note" v-model="note" class="min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 outline-none transition focus:border-[#2564cf] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" placeholder="Lägg till en anteckning" @blur="saveNote" />
      </label>
    </div>

    <div class="shrink-0 border-t border-slate-200 p-3 dark:border-slate-700">
      <button class="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950" type="button" @click="emit('delete-task')">
        <span aria-hidden="true">♲</span>
        <span>Ta bort uppgift</span>
      </button>
    </div>
  </aside>
</template>
