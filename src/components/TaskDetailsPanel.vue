<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Step, Task } from '@/types'

interface Props {
  task: Task
  steps: Step[]
}

interface Emits {
  (event: 'close'): void
  (event: 'save-title', title: string): void
  (event: 'add-step', title: string): void
  (event: 'toggle-step', stepId: string): void
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
</script>

<template>
  <aside class="fixed inset-0 z-50 flex flex-col bg-white shadow-2xl dark:bg-slate-900 lg:static lg:z-auto lg:w-80 lg:shrink-0 lg:border-l lg:border-slate-200 lg:shadow-none dark:lg:border-slate-700" aria-label="Task details">
    <div class="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
      <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Task details</span>
      <button class="grid size-8 place-items-center rounded text-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" type="button" aria-label="Close task details" @click="emit('close')">×</button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <input
        v-model="title"
        class="w-full border-b border-transparent bg-transparent pb-2 text-lg font-semibold text-slate-800 outline-none transition focus:border-[#2564cf] dark:text-slate-100"
        type="text"
        aria-label="Task title"
        @blur="saveTitle"
        @keydown.enter.prevent="saveTitle"
      />

      <section class="mt-6" aria-labelledby="steps-heading">
        <h2 id="steps-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Steps</h2>
        <div class="space-y-1">
          <label v-for="step in steps" :key="step.id" class="flex min-h-10 items-center gap-3 rounded px-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
            <input
              class="size-4 accent-[#2564cf]"
              type="checkbox"
              :checked="step.completed"
              :aria-label="`Complete step ${step.title}`"
              @change="emit('toggle-step', step.id)"
            />
            <span :class="{ 'text-slate-400 line-through dark:text-slate-500': step.completed }">{{ step.title }}</span>
          </label>
        </div>
        <form class="mt-2 flex items-center gap-2 border-b border-slate-200 px-2 py-2 dark:border-slate-700" @submit.prevent="addStep">
          <span class="text-lg text-[#2564cf] dark:text-blue-400" aria-hidden="true">＋</span>
          <label class="sr-only" for="new-step-title">Add step</label>
          <input id="new-step-title" v-model="stepTitle" class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500" type="text" placeholder="Add step" />
        </form>
      </section>

      <div class="mt-5 space-y-2">
        <button class="flex min-h-11 w-full items-center gap-3 rounded px-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" type="button" @click="emit('toggle-my-day')">
          <span class="text-xl" :class="task.myDay ? 'text-[#2564cf] dark:text-blue-400' : 'text-slate-500'" aria-hidden="true">☼</span>
          <span class="flex-1">{{ task.myDay ? 'Remove from My day' : 'Add to My day' }}</span>
          <span v-if="task.myDay" class="text-xs text-[#2564cf] dark:text-blue-400">Added</span>
        </button>

        <label class="flex min-h-11 items-center gap-3 rounded px-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
          <span class="text-lg text-slate-500" aria-hidden="true">▣</span>
          <span class="flex-1">Due date</span>
          <input class="w-32 bg-transparent text-right text-sm text-slate-600 outline-none dark:text-slate-300" type="date" :value="dueDate" aria-label="Task due date" @change="emit('set-due-date', ($event.target as HTMLInputElement).value)" />
        </label>
      </div>

      <label class="mt-6 block" for="task-note">
        <span class="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Notes</span>
        <textarea id="task-note" v-model="note" class="min-h-28 w-full resize-y rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 outline-none transition focus:border-[#2564cf] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" placeholder="Add a note" @blur="saveNote" />
      </label>
    </div>

    <div class="shrink-0 border-t border-slate-200 p-3 dark:border-slate-700">
      <button class="flex min-h-10 w-full items-center justify-center gap-2 rounded text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950" type="button" @click="emit('delete-task')">
        <span aria-hidden="true">♲</span>
        <span>Delete task</span>
      </button>
    </div>
  </aside>
</template>
