<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { Bell, CalendarDays, CalendarPlus, Check, CheckCircle2, ChevronRight, GripVertical, ListTodo, MoreVertical, Play, Star, Trash2 } from '@lucide/vue'
import type { List, StepCount, Task, TaskStatus, TaskStatusMode } from '@/types'
import { getTaskStatus } from '@/utils/taskStatus'

const rowInteractionResets = new Set<() => void>()

interface Props {
  task: Task
  stepCount?: StepCount | null
  listName?: string | null
  showDueDate?: boolean
  draggable?: boolean
  taskStatusMode?: TaskStatusMode
  availableLists?: List[]
}

interface Emits {
  (event: 'select'): void
  (event: 'toggle-completed'): void
  (event: 'set-status', status: TaskStatus): void
  (event: 'toggle-important'): void
  (event: 'toggle-my-day'): void
  (event: 'delete'): void
  (event: 'move', direction: -1 | 1): void
  (event: 'move-to-list', listId: string): void
  (event: 'select-tag', tag: string): void
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
  if (event.target !== event.currentTarget) return

  if (event.altKey && props.draggable && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault()
    emit('move', event.key === 'ArrowUp' ? -1 : 1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    emit('select')
  } else if (event.key === ' ') {
    event.preventDefault()
    if (props.taskStatusMode === 'threeStep') {
      advanceTaskStatus()
    } else {
      emit('toggle-completed')
    }
  }
}

const advanceTaskStatus = () => {
  const currentStatus = getTaskStatus(props.task)
  const nextStatus: TaskStatus = currentStatus === 'todo'
    ? 'inProgress'
    : currentStatus === 'inProgress'
      ? 'completed'
      : 'todo'
  emit('set-status', nextStatus)
}

const dueDateText = computed(() => {
  if (!props.task.dueDate) return ''

  const dueDate = typeof props.task.dueDate === 'string'
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(props.task.dueDate) ? `${props.task.dueDate}T00:00:00` : props.task.dueDate)
    : props.task.dueDate.toDate()

  return dueDate.toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
})
const reminderDateText = computed(() => {
  if (!props.task.dueDate || !props.task.reminder) return ''

  const dueDate = typeof props.task.dueDate === 'string'
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(props.task.dueDate) ? `${props.task.dueDate}T09:00:00` : props.task.dueDate)
    : props.task.dueDate.toDate()
  if (Number.isNaN(dueDate.getTime())) return ''

  const reminderDate = new Date(dueDate.getTime() - props.task.reminder.offsetMinutes * 60_000)
  return reminderDate.toLocaleString('sv-SE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
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

    <div class="relative flex min-h-14 w-full items-start gap-3 rounded-lg bg-white px-4 py-2 transition-transform dark:bg-slate-900" :style="{ transform: `translateX(${swipeOffset}px)` }">
      <span
        v-if="draggable"
        class="mt-1 inline-flex shrink-0 cursor-grab touch-none text-slate-400 transition-opacity hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 sm:opacity-0 sm:group-hover:opacity-100"
        aria-hidden="true"
        data-drag-handle
        title="Dra för att ändra ordning"
        @click.stop
      >
        <GripVertical :size="18" />
      </span>

      <div class="flex min-w-0 flex-1 items-start gap-3">
        <button
          v-if="taskStatusMode === 'threeStep'"
          class="mt-1 grid size-6 shrink-0 place-items-center rounded-md border text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2564cf] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          :class="{
            'border-slate-400 bg-transparent hover:border-orange-500 dark:border-slate-500': getTaskStatus(task) === 'todo',
            'border-orange-500 bg-orange-500 hover:bg-orange-600': getTaskStatus(task) === 'inProgress',
            'border-[#2564cf] bg-[#2564cf] hover:bg-blue-700 dark:border-blue-400 dark:bg-blue-400': getTaskStatus(task) === 'completed',
          }"
          role="checkbox"
          :aria-checked="getTaskStatus(task) === 'inProgress' ? 'mixed' : getTaskStatus(task) === 'completed'"
          :aria-label="{
            todo: 'Markera uppgift som pågående',
            inProgress: 'Markera uppgift som klar',
            completed: 'Återställ uppgift till att göra',
          }[getTaskStatus(task)]"
          :title="{
            todo: 'Att göra',
            inProgress: 'Pågående',
            completed: 'Klart',
          }[getTaskStatus(task)]"
          type="button"
          @click.stop="advanceTaskStatus"
        >
          <Play v-if="getTaskStatus(task) === 'inProgress'" :size="12" fill="currentColor" aria-hidden="true" />
          <Check v-else-if="getTaskStatus(task) === 'completed'" :size="14" aria-hidden="true" />
        </button>
        <button
          v-else
          class="mt-1 grid size-6 shrink-0 place-items-center rounded-full border border-slate-400 text-xs text-white transition hover:border-[#2564cf] dark:border-slate-500"
          :class="{ 'border-[#2564cf] bg-[#2564cf] dark:border-blue-400 dark:bg-blue-400': getTaskStatus(task) === 'completed' }"
          type="button"
          :aria-label="getTaskStatus(task) === 'completed' ? 'Markera uppgift som aktiv' : 'Markera uppgift som slutförd'"
          @click.stop="emit('toggle-completed')"
        >
          <Check v-if="getTaskStatus(task) === 'completed'" :size="14" aria-hidden="true" />
        </button>

        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 items-start">
            <span class="min-w-0 flex-1 text-sm text-black dark:text-slate-100" :class="{ 'text-slate-400 line-through dark:text-slate-500': getTaskStatus(task) === 'completed' }">
              {{ task.title }}
              <span v-if="stepCount && stepCount.total > 0" class="ml-2 text-xs text-slate-500 dark:text-slate-400" :aria-label="`${stepCount.completed} av ${stepCount.total} delsteg klara`">({{ stepCount.completed }}/{{ stepCount.total }})</span>
              <span v-if="listName" class="ml-2 text-xs text-slate-500 dark:text-slate-400">{{ listName }}</span>
            </span>
          </div>

          <div
            v-if="task.tags?.length || task.important || task.myDay || task.dueDate || (task.reminder && getTaskStatus(task) !== 'completed')"
            class="mt-1 flex min-h-6 min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pl-9 text-xs"
            role="group"
            aria-label="Taggar och uppgiftsmarkeringar"
          >
            <span v-for="tag in task.tags" :key="tag" class="inline-flex text-[#2564cf] dark:text-blue-300">
              <button class="hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2564cf]" type="button" :aria-label="`Visa uppgifter med taggen #${tag}`" @click.stop="emit('select-tag', tag)">#{{ tag }}</button>
            </span>
            <span v-if="task.important" class="inline-flex items-center gap-1.5 whitespace-nowrap text-amber-600 dark:text-amber-400" role="img" aria-label="Stjärnmärkt" title="Stjärnmärkt">
              <Star :size="14" fill="none" aria-hidden="true" />
              <span class="hidden xl:inline">Stjärnmärkt</span>
            </span>
            <span v-if="task.myDay" class="inline-flex items-center gap-1.5 whitespace-nowrap text-slate-600 dark:text-slate-300" role="img" aria-label="Tillagd i Min dag" title="Min dag">
              <CalendarPlus :size="14" aria-hidden="true" />
              <span class="hidden xl:inline">Min dag</span>
            </span>
            <span v-if="task.dueDate" class="inline-flex items-center gap-1.5 whitespace-nowrap text-slate-600 dark:text-slate-300" role="img" :aria-label="`Förfallodatum: ${dueDateText}`" :title="`Förfallodatum: ${dueDateText}`">
              <CalendarDays :size="14" aria-hidden="true" />
              <span class="hidden xl:inline">{{ dueDateText }}</span>
            </span>
            <span v-if="task.reminder && getTaskStatus(task) !== 'completed'" class="inline-flex items-center gap-1.5 whitespace-nowrap text-slate-600 dark:text-slate-300" role="img" :aria-label="reminderDateText ? `Påminnelse: ${reminderDateText}` : 'Påminnelse inställd'" :title="reminderDateText ? `Påminnelse: ${reminderDateText}` : 'Påminnelse inställd'">
              <Bell :size="14" aria-hidden="true" />
              <span class="hidden xl:inline">{{ reminderDateText ? `Påminnelse ${reminderDateText}` : 'Påminnelse inställd' }}</span>
            </span>
          </div>
        </div>
      </div>

      <div class="relative mt-1 shrink-0">
        <button ref="actionsButton" class="grid size-6 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700" type="button" aria-label="Uppgiftsåtgärder" :aria-expanded="isMenuOpen" @click.stop="updateMenuPlacement">
          <MoreVertical :size="16" aria-hidden="true" />
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="isMenuOpen" ref="actionsMenu" class="fixed z-[75] w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800" :data-task-menu-id="task.id" :style="menuStyle" @click.stop>
        <button class="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" @click="emit('select'); closeMenu()"><ListTodo :size="17" aria-hidden="true" />Visa detaljer</button>
        <button class="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" @click="emit('toggle-completed'); closeMenu()"><CheckCircle2 :size="17" aria-hidden="true" />{{ getTaskStatus(task) === 'completed' ? 'Markera som aktiv' : 'Markera som slutförd' }}</button>
        <button class="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" @click="emit('toggle-important'); closeMenu()"><Star :size="17" :fill="task.important ? 'currentColor' : 'none'" aria-hidden="true" />{{ task.important ? 'Ta bort stjärnmarkering' : 'Stjärnmarkera' }}</button>
        <button class="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" @click="emit('toggle-my-day'); closeMenu()"><CalendarPlus :size="17" aria-hidden="true" />{{ task.myDay ? 'Ta bort från Min dag' : 'Lägg till i Min dag' }}</button>
        <template v-if="availableLists && availableLists.length > 1">
          <button class="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" :aria-expanded="isMoveMenuOpen" @click="toggleMoveMenu"><span>Flytta till lista</span><ChevronRight :size="17" aria-hidden="true" /></button>
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
