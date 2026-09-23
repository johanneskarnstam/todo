<script setup lang="ts">
import type { Task } from '@/types'

interface Props {
  task: Task
}

interface Emits {
  (event: 'select'): void
  (event: 'toggle-completed'): void
  (event: 'toggle-important'): void
  (event: 'delete'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<template>
  <article class="group flex min-h-14 cursor-pointer items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800" @click="emit('select')">
    <button
      class="grid size-6 shrink-0 place-items-center rounded-full border border-slate-400 text-xs text-white transition hover:border-[#2564cf] dark:border-slate-500"
      :class="{ 'border-[#2564cf] bg-[#2564cf] dark:border-blue-400 dark:bg-blue-400': task.completed }"
      type="button"
      :aria-label="task.completed ? 'Mark task active' : 'Mark task completed'"
      @click.stop="emit('toggle-completed')"
    >
      <span v-if="task.completed" aria-hidden="true">✓</span>
    </button>

    <span class="min-w-0 flex-1 text-sm text-slate-800 dark:text-slate-100" :class="{ 'text-slate-400 line-through dark:text-slate-500': task.completed }">
      {{ task.title }}
    </span>

    <button
      class="grid size-8 shrink-0 place-items-center rounded text-xl leading-none transition hover:bg-slate-100 dark:hover:bg-slate-700"
      :class="task.important ? 'text-[#2564cf] dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'"
      type="button"
      :aria-label="task.important ? 'Remove importance' : 'Mark task important'"
      @click.stop="emit('toggle-important')"
    >
      <span aria-hidden="true">{{ task.important ? '★' : '☆' }}</span>
    </button>

    <button
      class="grid size-8 shrink-0 place-items-center rounded text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-red-950 dark:hover:text-red-400"
      type="button"
      aria-label="Delete task"
      @click.stop="emit('delete')"
    >
      <span aria-hidden="true">×</span>
    </button>
  </article>
</template>
