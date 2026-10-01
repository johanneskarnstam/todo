<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowLeft, Check, Settings2 } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import ToggleSwitch from '@/components/ToggleSwitch.vue'
import { useTheme } from '@/composables/useTheme'
import { useListStore } from '@/stores/listStore'
import { useTaskStore } from '@/stores/taskStore'
import { getTaskStatus } from '@/utils/taskStatus'
import type { ListSortMode, TaskStatusMode } from '@/types'

const route = useRoute()
const router = useRouter()
const listStore = useListStore()
const taskStore = useTaskStore()
const { isDark } = useTheme()
const sortMode = ref<ListSortMode>('manual')
const newTasksFirst = ref(true)
const taskStatusMode = ref<TaskStatusMode>('binary')
const statusMessage = ref('')
const isInitialized = ref(false)
const sortMenuOpen = ref(false)
const taskStatusMenuOpen = ref(false)
const themeColors = ['#2564cf', '#107c10', '#d83b01', '#8764b8', '#038387', '#ca5010']
const sortOptions: Array<{ value: ListSortMode; label: string }> = [
  { value: 'manual', label: 'Min ordning' },
  { value: 'created', label: 'Skapade först' },
  { value: 'dueDate', label: 'Förfallodatum' },
  { value: 'priority', label: 'Prioritet' },
]
const taskStatusOptions: Array<{ value: TaskStatusMode; label: string }> = [
  { value: 'binary', label: 'Att göra eller klart' },
  { value: 'threeStep', label: 'Att göra, pågående eller klart' },
]

const listId = computed(() => typeof route.params.listId === 'string' ? route.params.listId : '')
const currentList = computed(() => listStore.lists.find((list) => list.id === listId.value) ?? null)
const inProgressTasks = computed(() => taskStore.tasks.filter((task) => task.listId === listId.value && getTaskStatus(task) === 'inProgress'))

const initialize = async () => {
  await listStore.fetchLists()
  const list = currentList.value
  if (!list) return

  sortMode.value = list.sortMode ?? 'manual'
  newTasksFirst.value = list.newTasksFirst ?? true
  taskStatusMode.value = list.taskStatusMode ?? 'binary'
  isInitialized.value = true
}

const saveSortMode = async (nextSortMode: ListSortMode) => {
  sortMode.value = nextSortMode
  sortMenuOpen.value = false
  statusMessage.value = ''
  await listStore.updateList(listId.value, { sortMode: nextSortMode })
  if (!listStore.error) statusMessage.value = 'Sorteringen har sparats.'
}

const handleSortMenuKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    sortMenuOpen.value = false
    return
  }

  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    sortMenuOpen.value = true
  }
}

const handleTaskStatusMenuKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    taskStatusMenuOpen.value = false
    return
  }

  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    taskStatusMenuOpen.value = true
  }
}

const saveThemeColor = async (themeColor: string) => {
  statusMessage.value = ''
  await listStore.updateList(listId.value, { themeColor })
  if (!listStore.error) statusMessage.value = 'Listfärgen har sparats.'
}

const saveNewTasksFirst = async (nextValue: boolean) => {
  newTasksFirst.value = nextValue
  statusMessage.value = ''
  await listStore.updateList(listId.value, { newTasksFirst: nextValue })
  if (!listStore.error) statusMessage.value = 'Inställningen har sparats.'
}

const saveTaskStatusMode = async (nextMode: TaskStatusMode) => {
  if (nextMode === 'binary' && inProgressTasks.value.length > 0) {
    const confirmed = window.confirm('Pågående uppgifter ändras till Att göra när listan använder två lägen. Fortsätta?')
    if (!confirmed) {
      taskStatusMode.value = 'threeStep'
      return
    }
  }

  taskStatusMode.value = nextMode
  taskStatusMenuOpen.value = false
  statusMessage.value = ''
  if (nextMode === 'binary') {
    for (const task of inProgressTasks.value) taskStore.setTaskStatus(task.id, 'todo', 'binary')
  }
  await listStore.updateList(listId.value, { taskStatusMode: nextMode })
  if (!listStore.error) statusMessage.value = 'Arbetsflödet har sparats.'
}

onMounted(() => void initialize())
</script>

<template>
  <main class="min-h-screen bg-slate-100 px-3 py-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:px-6 sm:py-8" :class="{ dark: isDark }" @click="sortMenuOpen = false; taskStatusMenuOpen = false">
    <div class="mx-auto max-w-3xl">
      <header class="mb-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <button class="grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" type="button" aria-label="Tillbaka till listan" @click="router.push({ name: 'home' })">
          <ArrowLeft :size="18" aria-hidden="true" />
        </button>
        <Settings2 :size="20" class="text-[#2564cf]" aria-hidden="true" />
        <h1 class="min-w-0 flex-1 truncate text-lg font-semibold text-slate-700 dark:text-slate-200">{{ currentList?.name ?? 'Listinställningar' }}</h1>
      </header>

      <p v-if="listStore.error" class="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200" role="alert">{{ listStore.error }}</p>
      <p v-if="statusMessage" class="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">
        <Check :size="16" aria-hidden="true" />{{ statusMessage }}
      </p>

      <template v-if="isInitialized && currentList">
        <section class="mb-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5" aria-labelledby="list-appearance-heading">
          <h2 id="list-appearance-heading" class="text-base font-semibold">Utseende</h2>
          <fieldset class="mt-4">
            <legend class="text-sm font-medium">Listfärg</legend>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Färgen används på listans rubrik.</p>
            <div class="mt-3 flex flex-wrap gap-3">
              <button
                v-for="color in themeColors"
                :key="color"
                class="grid size-9 place-items-center rounded-full border-2 border-white shadow-sm ring-1 ring-slate-300 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:border-slate-900 dark:ring-slate-600"
                :style="{ backgroundColor: color }"
                type="button"
                :aria-label="`Använd listfärg ${color}`"
                :aria-pressed="(currentList.themeColor ?? '#2564cf') === color"
                @click="saveThemeColor(color)"
              >
                <Check v-if="(currentList.themeColor ?? '#2564cf') === color" :size="17" class="text-white drop-shadow" aria-hidden="true" />
              </button>
            </div>
          </fieldset>
        </section>

        <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5" aria-labelledby="list-tasks-heading">
          <h2 id="list-tasks-heading" class="text-base font-semibold">Uppgifter</h2>
          <div class="mt-4 divide-y divide-slate-200 dark:divide-slate-700">
          <div class="flex min-h-14 items-center gap-4 py-2 text-sm">
            <span class="flex-1">
              <span class="block font-medium">Sortering</span>
              <span class="block text-xs text-slate-500 dark:text-slate-400">Gäller bara uppgifter i den här listan.</span>
            </span>
            <div class="relative max-w-44" @click.stop>
              <button
                id="list-sort-mode"
                class="flex min-h-9 w-full items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2564cf] dark:border-slate-600 dark:bg-slate-800"
                type="button"
                role="combobox"
                aria-label="Sortering"
                aria-controls="list-sort-options"
                :aria-expanded="sortMenuOpen"
                aria-haspopup="listbox"
                @click="sortMenuOpen = !sortMenuOpen"
                @keydown="handleSortMenuKeydown"
              >
                <span>{{ sortOptions.find((option) => option.value === sortMode)?.label ?? 'Nya uppgifter först' }}</span>
                <span aria-hidden="true" class="text-slate-500">⌄</span>
              </button>
              <div v-if="sortMenuOpen" id="list-sort-options" class="absolute right-0 top-full z-20 mt-1 w-full min-w-44 overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-800" role="listbox" aria-label="Sorteringsalternativ">
                <button
                  v-for="option in sortOptions"
                  :key="option.value"
                  class="flex min-h-9 w-full items-center rounded px-2 text-left text-sm hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none dark:hover:bg-slate-700 dark:focus-visible:bg-slate-700"
                  :class="{ 'bg-[#eef5fc] font-medium text-[#2564cf] dark:bg-slate-700 dark:text-blue-300': sortMode === option.value }"
                  type="button"
                  role="option"
                  :aria-selected="sortMode === option.value"
                  @click="saveSortMode(option.value)"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
          </div>

          <label class="flex min-h-14 items-center gap-4 py-2 text-sm" :class="{ 'opacity-50': sortMode !== 'manual' }" for="new-tasks-first">
            <span class="flex-1">
              <span class="block font-medium">Nya uppgifter överst</span>
              <span class="block text-xs text-slate-500 dark:text-slate-400">Gäller när sorteringen är Min ordning.</span>
            </span>
            <ToggleSwitch id="new-tasks-first" :checked="newTasksFirst" :disabled="sortMode !== 'manual'" aria-label="Nya uppgifter överst" @change="saveNewTasksFirst" />
          </label>

          <div class="flex min-h-14 items-center gap-4 py-2 text-sm">
            <span class="flex-1">
              <span class="block font-medium">Arbetsflöde</span>
              <span class="block text-xs text-slate-500 dark:text-slate-400">Välj om uppgifter kan vara pågående.</span>
            </span>
            <div class="relative max-w-44" @click.stop>
              <button
                id="task-status-mode"
                class="flex min-h-9 w-full items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2564cf] dark:border-slate-600 dark:bg-slate-800"
                type="button"
                role="combobox"
                aria-label="Arbetsflöde"
                aria-controls="task-status-options"
                :aria-expanded="taskStatusMenuOpen"
                aria-haspopup="listbox"
                @click="taskStatusMenuOpen = !taskStatusMenuOpen"
                @keydown="handleTaskStatusMenuKeydown"
              >
                <span>{{ taskStatusOptions.find((option) => option.value === taskStatusMode)?.label }}</span>
                <span aria-hidden="true" class="text-slate-500">⌄</span>
              </button>
              <div v-if="taskStatusMenuOpen" id="task-status-options" class="absolute right-0 top-full z-20 mt-1 w-full min-w-56 overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-800" role="listbox" aria-label="Arbetsflödesalternativ">
                <button
                  v-for="option in taskStatusOptions"
                  :key="option.value"
                  class="flex min-h-9 w-full items-center rounded px-2 text-left text-sm hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none dark:hover:bg-slate-700 dark:focus-visible:bg-slate-700"
                  :class="{ 'bg-[#eef5fc] font-medium text-[#2564cf] dark:bg-slate-700 dark:text-blue-300': taskStatusMode === option.value }"
                  type="button"
                  role="option"
                  :aria-selected="taskStatusMode === option.value"
                  @click="saveTaskStatusMode(option.value)"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
          </div>
          </div>
        </section>
      </template>

      <section v-else-if="isInitialized" class="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" role="alert">
        Listan kunde inte hittas.
      </section>
    </div>
  </main>
</template>
