<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { StepCount, Task } from '@/types'

interface Props {
  task: Task
  stepCount?: StepCount | null
  listName?: string | null
  draggable?: boolean
}

interface Emits {
  (event: 'select'): void
  (event: 'toggle-completed'): void
  (event: 'toggle-important'): void
  (event: 'toggle-my-day'): void
  (event: 'delete'): void
  (event: 'drag-start'): void
  (event: 'drag-over'): void
  (event: 'drop'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const isMenuOpen = ref(false)
const menuPlacement = ref<'above' | 'below'>('below')
const swipeOffset = ref(0)
const swipeStartX = ref<number | null>(null)
const suppressClick = ref(false)

const updateMenuPlacement = (event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement
  const spaceBelow = window.innerHeight - target.getBoundingClientRect().bottom
  menuPlacement.value = spaceBelow < 180 ? 'above' : 'below'
  isMenuOpen.value = !isMenuOpen.value
}

const closeMenu = () => {
  isMenuOpen.value = false
}

const handleTouchStart = (event: TouchEvent) => {
  swipeStartX.value = event.touches[0]?.clientX ?? null
}

const handleTouchMove = (event: TouchEvent) => {
  if (swipeStartX.value === null) return

  const currentX = event.touches[0]?.clientX ?? swipeStartX.value
  const distance = Math.max(-112, Math.min(112, currentX - swipeStartX.value))
  if (Math.abs(distance) > 8) event.preventDefault()
  swipeOffset.value = distance
}

const handleTouchEnd = () => {
  if (Math.abs(swipeOffset.value) >= 64) {
    swipeOffset.value = swipeOffset.value < 0 ? -96 : 96
    suppressClick.value = true
  } else {
    swipeOffset.value = 0
  }
  swipeStartX.value = null
}

const resetSwipe = () => {
  swipeOffset.value = 0
}

const handleRowClick = () => {
  if (suppressClick.value) {
    suppressClick.value = false
    return
  }
  emit('select')
}

const handleDragStart = (event: DragEvent) => {
  if (!props.draggable || !event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/task-id', props.task.id)
  emit('drag-start')
}

onMounted(() => window.addEventListener('click', closeMenu))
onUnmounted(() => window.removeEventListener('click', closeMenu))

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    emit('select')
  } else if (event.key === ' ') {
    event.preventDefault()
    emit('toggle-completed')
  }
}
</script>

<template>
  <article
    class="group relative min-h-14 overflow-visible rounded-lg border-b border-slate-200 bg-white transition focus-within:ring-2 focus-within:ring-inset focus-within:ring-[#2564cf] dark:border-slate-700 dark:bg-slate-900"
    role="group"
    tabindex="0"
    :draggable="draggable"
    :data-task-id="task.id"
    :aria-label="`Task: ${task.title}`"
    @click="handleRowClick"
    @keydown="handleKeydown"
    @dragstart="handleDragStart"
    @dragover.prevent="draggable && emit('drag-over')"
    @drop.prevent="draggable && emit('drop')"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <div class="absolute inset-0 flex items-stretch justify-between overflow-hidden rounded-lg text-white" aria-hidden="true">
      <button class="w-24 bg-red-600 text-sm font-medium" type="button" @click.stop="emit('delete'); resetSwipe()">Delete</button>
      <button class="w-24 bg-[#2564cf] text-sm font-medium" type="button" @click.stop="emit('toggle-important'); resetSwipe()">{{ task.important ? 'Unstar' : 'Star' }}</button>
    </div>

    <div class="relative flex min-h-14 w-full items-center gap-3 rounded-lg bg-white px-4 py-2 transition-transform dark:bg-slate-900" :style="{ transform: `translateX(${swipeOffset}px)` }">
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
        <span v-if="stepCount && stepCount.total > 0" class="ml-2 text-xs text-slate-500 dark:text-slate-400" :aria-label="`${stepCount.completed} of ${stepCount.total} subtasks completed`">({{ stepCount.completed }}/{{ stepCount.total }})</span>
        <span v-if="listName" class="ml-2 text-xs text-slate-500 dark:text-slate-400">{{ listName }}</span>
      </span>

      <div class="relative shrink-0">
        <button class="grid size-9 place-items-center rounded-full text-xl text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700" type="button" aria-label="Task actions" :aria-expanded="isMenuOpen" @click.stop="updateMenuPlacement">
          <span aria-hidden="true">⋯</span>
        </button>
        <div v-if="isMenuOpen" class="absolute right-0 z-30 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800" :class="menuPlacement === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'" @click.stop>
          <button class="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" @click="emit('toggle-important'); closeMenu()">{{ task.important ? 'Remove star' : 'Star task' }}</button>
          <button class="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" @click="emit('toggle-my-day'); closeMenu()">{{ task.myDay ? 'Remove from My day' : 'Add to My day' }}</button>
          <button class="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950" type="button" @click="emit('delete'); closeMenu()">Delete task</button>
        </div>
      </div>
    </div>
  </article>
</template>
