<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { CalendarDays, CalendarPlus, CheckCircle2, GripVertical, ListTodo, MoreVertical, Star, Trash2 } from '@lucide/vue'
import type { List, StepCount, Task } from '@/types'

const rowInteractionResets = new Set<() => void>()

interface Props {
  task: Task
  stepCount?: StepCount | null
  listName?: string | null
  showDueDate?: boolean
  draggable?: boolean
  availableLists?: List[]
}

interface Emits {
  (event: 'select'): void
  (event: 'toggle-completed'): void
  (event: 'toggle-important'): void
  (event: 'toggle-my-day'): void
  (event: 'delete'): void
  (event: 'move', direction: -1 | 1): void
  (event: 'move-to-list', listId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const isMenuOpen = ref(false)
const isMoveMenuOpen = ref(false)
const actionsButton = ref<HTMLButtonElement | null>(null)
const actionsMenu = ref<HTMLDivElement | null>(null)
const menuStyle = ref<Record<string, string>>({})
const swipeOffset = ref(0)
const swipeStartX = ref<number | null>(null)
const suppressClick = ref(false)

const resetRowInteraction = () => {
  isMenuOpen.value = false
  isMoveMenuOpen.value = false
  menuStyle.value = {}
  swipeOffset.value = 0
  swipeStartX.value = null
  suppressClick.value = false
}

rowInteractionResets.add(resetRowInteraction)

const positionMenu = () => {
  const trigger = actionsButton.value
  const menu = actionsMenu.value
  if (!trigger || !menu) return

  const triggerRect = trigger.getBoundingClientRect()
  const menuRect = menu.getBoundingClientRect()
  const gap = 8
  const horizontalPadding = 12
  const left = Math.min(
    Math.max(horizontalPadding, triggerRect.right - menuRect.width),
    window.innerWidth - menuRect.width - horizontalPadding,
  )
  const opensAbove = triggerRect.bottom + menuRect.height + gap > window.innerHeight && triggerRect.top - menuRect.height - gap >= horizontalPadding
  const top = opensAbove ? triggerRect.top - menuRect.height - gap : triggerRect.bottom + gap

  menuStyle.value = {
    left: `${left}px`,
    top: `${Math.max(horizontalPadding, top)}px`,
  }
}

const updateMenuPlacement = () => {
  rowInteractionResets.forEach((reset) => {
    if (reset !== resetRowInteraction) reset()
  })
  isMenuOpen.value = !isMenuOpen.value
  if (isMenuOpen.value) void nextTick(positionMenu)
}

const closeMenu = () => {
  isMenuOpen.value = false
  isMoveMenuOpen.value = false
  menuStyle.value = {}
}

const toggleMoveMenu = () => {
  isMoveMenuOpen.value = !isMoveMenuOpen.value
  void nextTick(positionMenu)
}

const handleWindowKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') closeMenu()
}

const handleGlobalTouchStart = (event: TouchEvent) => {
  const target = event.target as HTMLElement | null
  if (target?.closest('[data-task-menu-id]')) return
  rowInteractionResets.forEach((reset) => reset())
}

const handleTouchStart = (event: TouchEvent) => {
  const target = event.target as HTMLElement | null
  if (target?.closest('[data-drag-handle]')) return
  rowInteractionResets.forEach((reset) => {
    if (reset !== resetRowInteraction) reset()
  })
  closeMenu()
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

const handleRowClick = () => {
  if (suppressClick.value) {
    suppressClick.value = false
    return
  }
  emit('select')
}

onMounted(() => {
  window.addEventListener('click', closeMenu)
  window.addEventListener('keydown', handleWindowKeydown)
  window.addEventListener('touchstart', handleGlobalTouchStart, true)
  window.addEventListener('resize', positionMenu)
  window.addEventListener('scroll', positionMenu, true)
})
onUnmounted(() => {
  window.removeEventListener('click', closeMenu)
  window.removeEventListener('keydown', handleWindowKeydown)
  window.removeEventListener('touchstart', handleGlobalTouchStart, true)
  window.removeEventListener('resize', positionMenu)
  window.removeEventListener('scroll', positionMenu, true)
  rowInteractionResets.delete(resetRowInteraction)
})

const handleKeydown = (event: KeyboardEvent) => {
  if (event.altKey && props.draggable && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault()
    emit('move', event.key === 'ArrowUp' ? -1 : 1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    emit('select')
  } else if (event.key === ' ') {
    event.preventDefault()
    emit('toggle-completed')
  }
}

const dueDateText = computed(() => {
  if (!props.task.dueDate) return ''

  const dueDate = typeof props.task.dueDate === 'string'
    ? new Date(`${props.task.dueDate}T00:00:00`)
    : props.task.dueDate.toDate()

  return dueDate.toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
})
</script>

<template>
  <article
    class="group relative min-h-14 overflow-visible rounded-lg border-b border-slate-200 bg-white transition focus-within:ring-2 focus-within:ring-inset focus-within:ring-[#2564cf] dark:border-slate-700 dark:bg-slate-900"
    role="group"
    tabindex="0"
    :data-task-id="task.id"
    :aria-label="`Uppgift: ${task.title}`"
    :aria-roledescription="draggable ? 'Sorterbar uppgift' : undefined"
    @click="handleRowClick"
    @keydown="handleKeydown"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <div class="absolute inset-0 flex items-stretch justify-between overflow-hidden rounded-lg text-white">
      <button class="grid w-24 place-items-center bg-red-600" type="button" aria-label="Ta bort uppgift" title="Ta bort uppgift" @click.stop="emit('delete'); resetRowInteraction()">
        <Trash2 :size="20" aria-hidden="true" />
      </button>
      <button class="grid w-24 place-items-center bg-[#2564cf]" type="button" :aria-label="task.important ? 'Ta bort stjärnmarkering' : 'Stjärnmarkera uppgift'" :title="task.important ? 'Ta bort stjärnmarkering' : 'Stjärnmarkera uppgift'" @click.stop="emit('toggle-important'); resetRowInteraction()">
        <Star :size="20" :fill="task.important ? 'currentColor' : 'none'" aria-hidden="true" />
      </button>
    </div>

    <div class="relative flex min-h-14 w-full items-center gap-3 rounded-lg bg-white px-4 py-2 transition-transform dark:bg-slate-900" :style="{ transform: `translateX(${swipeOffset}px)` }">
      <span
        v-if="draggable"
        class="inline-flex shrink-0 cursor-grab touch-none text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
        aria-hidden="true"
        data-drag-handle
        title="Dra för att ändra ordning"
        @click.stop
      >
        <GripVertical :size="18" />
      </span>

      <button
        class="grid size-6 shrink-0 place-items-center rounded-full border border-slate-400 text-xs text-white transition hover:border-[#2564cf] dark:border-slate-500"
        :class="{ 'border-[#2564cf] bg-[#2564cf] dark:border-blue-400 dark:bg-blue-400': task.completed }"
        type="button"
        :aria-label="task.completed ? 'Markera uppgift som aktiv' : 'Markera uppgift som slutförd'"
        @click.stop="emit('toggle-completed')"
      >
        <span v-if="task.completed" aria-hidden="true">✓</span>
      </button>

      <span class="min-w-0 flex-1 text-sm text-black dark:text-slate-100" :class="{ 'text-slate-400 line-through dark:text-slate-500': task.completed }">
        {{ task.title }}
        <span v-if="stepCount && stepCount.total > 0" class="ml-2 text-xs text-slate-500 dark:text-slate-400" :aria-label="`${stepCount.completed} av ${stepCount.total} delsteg klara`">({{ stepCount.completed }}/{{ stepCount.total }})</span>
        <span v-if="listName" class="ml-2 text-xs text-slate-500 dark:text-slate-400">{{ listName }}</span>
        <span v-if="task.tags?.length" class="ml-2 text-xs text-[#2564cf] dark:text-blue-300">#{{ task.tags.join(' #') }}</span>
        <span v-if="showDueDate && dueDateText" class="ml-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-200">
          <CalendarDays :size="12" aria-hidden="true" />
          {{ dueDateText }}
        </span>
      </span>

      <div class="flex items-center gap-2">
        <div v-if="task.dueDate && !showDueDate" class="grid size-6 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-200" aria-label="Uppgiften har ett planerat datum">
          <CalendarDays :size="14" aria-hidden="true" />
        </div>
        <div class="relative shrink-0">
          <button ref="actionsButton" class="grid size-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700" type="button" aria-label="Uppgiftsåtgärder" :aria-expanded="isMenuOpen" @click.stop="updateMenuPlacement">
            <MoreVertical :size="20" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="isMenuOpen" ref="actionsMenu" class="fixed z-[75] w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800" :data-task-menu-id="task.id" :style="menuStyle" @click.stop>
        <button class="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" @click="emit('select'); closeMenu()"><ListTodo :size="17" aria-hidden="true" />Visa detaljer</button>
        <button class="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" @click="emit('toggle-completed'); closeMenu()"><CheckCircle2 :size="17" aria-hidden="true" />{{ task.completed ? 'Markera som aktiv' : 'Markera som slutförd' }}</button>
        <button class="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" @click="emit('toggle-important'); closeMenu()"><Star :size="17" :fill="task.important ? 'currentColor' : 'none'" aria-hidden="true" />{{ task.important ? 'Ta bort stjärnmarkering' : 'Stjärnmarkera' }}</button>
        <button class="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" @click="emit('toggle-my-day'); closeMenu()"><CalendarPlus :size="17" aria-hidden="true" />{{ task.myDay ? 'Ta bort från Min dag' : 'Lägg till i Min dag' }}</button>
        <template v-if="availableLists && availableLists.length > 1">
          <button class="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" :aria-expanded="isMoveMenuOpen" @click="toggleMoveMenu"><span>Flytta till lista</span><span aria-hidden="true">›</span></button>
          <div v-if="isMoveMenuOpen" class="max-h-48 overflow-y-auto border-t border-slate-200 py-1 dark:border-slate-700" role="menu" aria-label="Flytta uppgiften till lista">
            <button
              v-for="list in availableLists"
              :key="list.id"
              class="flex min-h-9 w-full items-center justify-between px-3 text-left text-sm hover:bg-slate-100 disabled:cursor-default disabled:text-slate-400 dark:hover:bg-slate-700 dark:disabled:text-slate-500"
              type="button"
              role="menuitem"
              :disabled="list.id === task.listId"
              @click="emit('move-to-list', list.id); closeMenu()"
            >
              <span class="truncate">{{ list.name }}</span>
              <span v-if="list.id === task.listId" class="ml-2 text-xs">Aktuell</span>
            </button>
          </div>
        </template>
        <button class="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950" type="button" @click="emit('delete'); closeMenu()"><Trash2 :size="17" aria-hidden="true" />Ta bort uppgift</button>
      </div>
    </Teleport>
  </article>
</template>
