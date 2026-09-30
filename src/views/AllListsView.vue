<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ArrowLeft, ChevronRight, FolderOpen, ListTodo, Plus } from '@lucide/vue'
import { useRouter } from 'vue-router'
import TaskDetailsPanel from '@/components/TaskDetailsPanel.vue'
import TaskRow from '@/components/TaskRow.vue'
import TodoHeader from '@/components/TodoHeader.vue'
import { useReminderNotifications } from '@/composables/useReminderNotifications'
import { usePreferences } from '@/composables/usePreferences'
import { useListStore } from '@/stores/listStore'
import { useTaskStore } from '@/stores/taskStore'
import { useToastStore } from '@/stores/toastStore'
import { useTheme } from '@/composables/useTheme'
import type { List, Task, TaskReminder } from '@/types'
import { isTaskCompleted } from '@/utils/taskStatus'
import { sortTasksForMode } from '@/utils/taskSorting'

const router = useRouter()
const listStore = useListStore()
const taskStore = useTaskStore()
const toastStore = useToastStore()
const { requestPermission } = useReminderNotifications()
const { preferences } = usePreferences()
const { isDark, toggleTheme } = useTheme()

const ungroupedLists = computed(() => listStore.ungroupedLists)
const availableTags = computed(() => [...new Set(taskStore.tasks.flatMap((task) => task.tags ?? []))].sort())
const desktopGroups = computed(() => [
  ...listStore.foldersWithLists.map(({ folder, lists }) => ({
    id: folder.id,
    name: folder.name,
    lists,
  })),
  { id: 'ungrouped', name: 'Utan mapp', lists: ungroupedLists.value },
])
const expandedCompletedListIds = ref<string[]>([])
const isDesktopView = ref(false)
const pendingDeleteTaskId = ref<string | null>(null)
const taskTitlesByListId = ref<Record<string, string>>({})
let desktopMediaQuery: MediaQueryList | null = null

const tasksByListId = computed(() => {
  const groupedTasks = new Map<string, { active: Task[]; completed: Task[] }>()

  for (const list of listStore.lists) {
    const listTasks = taskStore.tasks.filter((task) => task.listId === list.id)
    groupedTasks.set(list.id, {
      active: sortTasksForMode(listTasks.filter((task) => !isTaskCompleted(task)), list.sortMode ?? 'manual'),
      completed: sortTasksForMode(listTasks.filter(isTaskCompleted), list.sortMode ?? 'manual'),
    })
  }

  return groupedTasks
})

const tasksForList = (list: List, completed: boolean) => {
  const listTasks = tasksByListId.value.get(list.id)
  return completed ? listTasks?.completed ?? [] : listTasks?.active ?? []
}

const isCompletedExpanded = (listId: string) => expandedCompletedListIds.value.includes(listId)

const toggleCompleted = (listId: string) => {
  expandedCompletedListIds.value = isCompletedExpanded(listId)
    ? expandedCompletedListIds.value.filter((id) => id !== listId)
    : [...expandedCompletedListIds.value, listId]
}

const addTaskToList = (listId: string) => {
  const title = taskTitlesByListId.value[listId]?.trim()
  if (!title) return

  void taskStore.createTask({ listId, title })
  taskTitlesByListId.value = { ...taskTitlesByListId.value, [listId]: '' }
}

const handleMoveTaskToList = (taskId: string, targetListId: string) => {
  const targetList = listStore.lists.find((list) => list.id === targetListId)
  void taskStore.moveTask(taskId, targetListId, targetList?.name)
}

const requestDeleteTask = (taskId: string) => {
  if (preferences.value.confirmDeletes) {
    pendingDeleteTaskId.value = taskId
    return
  }

  void taskStore.deleteTask(taskId)
}

const handleDeleteActiveTask = () => {
  if (taskStore.activeTaskId) requestDeleteTask(taskStore.activeTaskId)
}

const confirmDeleteTask = () => {
  if (!pendingDeleteTaskId.value) return
  void taskStore.deleteTask(pendingDeleteTaskId.value)
  pendingDeleteTaskId.value = null
}

const handleSaveStepTitle = (stepId: string, title: string) => {
  void taskStore.updateStep(stepId, title)
}

const handleSaveReminder = async (taskId: string, reminder: TaskReminder | null) => {
  const updatePromise = taskStore.updateTask(taskId, { reminder })
  if (reminder && !(await requestPermission())) {
    toastStore.show('Påminnelsen sparas, men aviseringar är blockerade i webbläsaren.')
  }
  await updatePromise
}

const syncDesktopView = () => {
  if (!desktopMediaQuery) return
  isDesktopView.value = desktopMediaQuery.matches
  if (isDesktopView.value && !taskStore.isLoaded) void taskStore.fetchTasks()
}

const openList = (listId: string) => {
  listStore.selectList(listId)
  taskStore.setListView(listId)
  void router.push({ name: 'home' })
}

const goHome = () => {
  void router.push({ name: 'home' })
}

const handleSelectTag = (tag: string) => {
  taskStore.setActiveTask(null)
  taskStore.setTagView(tag)
  void router.push({ name: 'tag', params: { tag } })
}

const openSearch = () => {
  void router.push({ name: 'search' })
}

onMounted(() => {
  desktopMediaQuery = window.matchMedia('(min-width: 64rem)')
  syncDesktopView()
  desktopMediaQuery.addEventListener('change', syncDesktopView)
  if (!listStore.isLoaded) void listStore.fetchLists()
})

onUnmounted(() => desktopMediaQuery?.removeEventListener('change', syncDesktopView))
</script>

<template>
  <div class="flex h-screen flex-col bg-[#faf9f8] text-slate-800 dark:bg-slate-950 dark:text-slate-100" :class="{ dark: isDark }">
  <TodoHeader
    :is-dark="isDark"
    :is-sidebar-open="false"
    :is-saving="taskStore.isSaving || listStore.isSaving"
    :show-menu="false"
    @toggle-theme="toggleTheme"
    @go-home="goHome"
    @open-search="openSearch"
    @close-search="goHome"
  />

  <main class="min-h-0 flex-1 overflow-y-auto bg-[#faf9f8] px-3 py-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:px-6 sm:py-8 lg:hidden" :class="{ dark: isDark }">
    <div class="mx-auto max-w-3xl">
      <header class="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <RouterLink class="grid size-9 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" to="/" aria-label="Tillbaka till uppgifter">
          <ArrowLeft :size="19" :stroke-width="1.8" aria-hidden="true" />
        </RouterLink>
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Organisering</p>
          <h1 class="truncate text-xl font-semibold tracking-tight">Alla listor</h1>
        </div>
      </header>

      <div v-if="!listStore.isLoaded" class="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        Läser in listor...
      </div>

      <div v-else class="space-y-4">
        <section v-for="section in listStore.foldersWithLists" :key="section.folder.id" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900" :aria-labelledby="`folder-${section.folder.id}`">
          <div class="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <FolderOpen :size="19" :stroke-width="1.8" class="shrink-0 text-[#2564cf] dark:text-blue-400" aria-hidden="true" />
            <h2 :id="`folder-${section.folder.id}`" class="min-w-0 flex-1 truncate text-sm font-semibold">{{ section.folder.name }}</h2>
            <span class="text-xs text-slate-500 dark:text-slate-400">{{ section.lists.length }} {{ section.lists.length === 1 ? 'lista' : 'listor' }}</span>
          </div>
          <div v-if="section.lists.length" class="divide-y divide-slate-100 dark:divide-slate-800">
            <button v-for="list in section.lists" :key="list.id" class="flex min-h-14 w-full items-center gap-3 px-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/70" type="button" @click="openList(list.id)">
              <ListTodo :size="19" :stroke-width="1.8" class="shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ list.name }}</span>
              <span v-if="taskStore.listTaskCounts[list.id]" class="text-xs text-slate-500 dark:text-slate-400">{{ taskStore.listTaskCounts[list.id] }}</span>
              <ChevronRight :size="18" :stroke-width="1.8" class="shrink-0 text-slate-400" aria-hidden="true" />
            </button>
          </div>
          <p v-else class="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">Inga listor i mappen ännu.</p>
        </section>

        <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="ungrouped-heading">
          <div class="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <FolderOpen :size="19" :stroke-width="1.8" class="shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
            <h2 id="ungrouped-heading" class="min-w-0 flex-1 text-sm font-semibold">Utan mapp</h2>
            <span class="text-xs text-slate-500 dark:text-slate-400">{{ ungroupedLists.length }} {{ ungroupedLists.length === 1 ? 'lista' : 'listor' }}</span>
          </div>
          <div v-if="ungroupedLists.length" class="divide-y divide-slate-100 dark:divide-slate-800">
            <button v-for="list in ungroupedLists" :key="list.id" class="flex min-h-14 w-full items-center gap-3 px-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/70" type="button" @click="openList(list.id)">
              <ListTodo :size="19" :stroke-width="1.8" class="shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ list.name }}</span>
              <span v-if="taskStore.listTaskCounts[list.id]" class="text-xs text-slate-500 dark:text-slate-400">{{ taskStore.listTaskCounts[list.id] }}</span>
              <ChevronRight :size="18" :stroke-width="1.8" class="shrink-0 text-slate-400" aria-hidden="true" />
            </button>
          </div>
        </section>

        <p v-if="!listStore.foldersWithLists.length && !ungroupedLists.length" class="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Inga mappar eller listor ännu.</p>
      </div>
    </div>
  </main>

  <main class="relative hidden min-h-0 flex-1 overflow-hidden bg-[#faf9f8] text-slate-800 dark:bg-slate-950 dark:text-slate-100 lg:flex" :class="{ dark: isDark }">
    <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    <header class="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-900">
      <RouterLink class="grid size-9 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" to="/" aria-label="Tillbaka till uppgifter">
        <ArrowLeft :size="19" :stroke-width="1.8" aria-hidden="true" />
      </RouterLink>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Översikt</p>
        <h1 class="truncate text-xl font-semibold tracking-tight">Alla listor</h1>
      </div>
      <span class="text-sm text-slate-500 dark:text-slate-400">{{ listStore.lists.length }} listor</span>
    </header>

    <p v-if="(listStore.error || taskStore.error) && (!listStore.isLoaded || !taskStore.isLoaded)" class="m-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200" role="alert">
      {{ listStore.error ?? taskStore.error }}
    </p>
    <div v-else-if="!listStore.isLoaded || !taskStore.isLoaded" class="grid min-h-0 flex-1 place-items-center px-6 text-sm text-slate-500 dark:text-slate-400" role="status">
      Läser in översikten...
    </div>
    <p v-else-if="!listStore.lists.length" class="grid min-h-0 flex-1 place-items-center text-sm text-slate-500 dark:text-slate-400">
      Inga listor ännu.
    </p>
    <div v-else class="flex min-h-0 flex-1 flex-col">
      <p v-if="listStore.error || taskStore.error" class="mx-5 mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200" role="alert">
        {{ listStore.error ?? taskStore.error }}
      </p>
      <div class="min-h-0 flex-1 overflow-x-auto overflow-y-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2564cf]" role="region" aria-label="Listöversikt" tabindex="0">
      <div class="flex h-full w-max items-stretch gap-6 p-5">
        <section v-for="group in desktopGroups" :key="group.id" class="flex h-full shrink-0 flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" role="group" :aria-labelledby="`overview-group-${group.id}`">
          <h2 :id="`overview-group-${group.id}`" class="mb-3 flex min-h-8 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            <FolderOpen :size="16" aria-hidden="true" />{{ group.name }}
          </h2>
          <div v-if="group.lists.length" class="flex min-h-0 flex-1 items-stretch gap-4">
            <section v-for="list in group.lists" :key="list.id" class="flex h-full w-72 shrink-0 flex-col overflow-hidden border-r border-slate-200 pr-4 last:border-r-0 dark:border-slate-800" :aria-labelledby="`overview-list-${list.id}`">
              <h3 :id="`overview-list-${list.id}`" class="mb-3 truncate text-base font-semibold">{{ list.name }}</h3>
              <form class="mb-2 flex h-10 shrink-0 items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-700" @submit.prevent="addTaskToList(list.id)">
                <label class="sr-only" :for="`new-task-${list.id}`">Lägg till uppgift i {{ list.name }}</label>
                <input :id="`new-task-${list.id}`" v-model="taskTitlesByListId[list.id]" class="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-[#2564cf] dark:text-slate-100 dark:placeholder:text-slate-400" type="text" placeholder="Lägg till uppgift" />
                <button class="grid size-8 shrink-0 place-items-center rounded-md text-[#2564cf] transition hover:bg-blue-50 disabled:cursor-default disabled:text-slate-400 disabled:hover:bg-transparent dark:text-blue-400 dark:hover:bg-slate-800 dark:disabled:text-slate-600" type="submit" :aria-label="`Lägg till uppgift i ${list.name}`" :disabled="!taskTitlesByListId[list.id]?.trim()">
                  <Plus :size="18" aria-hidden="true" />
                </button>
              </form>
              <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <ul v-if="tasksForList(list, false).length" class="divide-y divide-slate-200 dark:divide-slate-700" :aria-label="`Uppgifter i ${list.name}`">
                  <li v-for="task in tasksForList(list, false)" :key="task.id">
                    <TaskRow
                      :task="task"
                      :step-count="taskStore.taskStepCounts.get(task.id) ?? null"
                      :task-status-mode="list.taskStatusMode ?? 'binary'"
                      :available-lists="listStore.lists"
                      @select="taskStore.setActiveTask(task.id)"
                      @toggle-completed="taskStore.toggleCompleted(task.id)"
                      @set-status="taskStore.setTaskStatus(task.id, $event, list.taskStatusMode ?? 'binary')"
                      @toggle-important="taskStore.toggleImportant(task.id)"
                      @toggle-my-day="taskStore.toggleMyDay(task.id)"
                      @delete="requestDeleteTask(task.id)"
                      @move-to-list="handleMoveTaskToList(task.id, $event)"
                      @select-tag="handleSelectTag"
                    />
                  </li>
                </ul>
                <p v-else class="py-3 text-sm text-slate-500 dark:text-slate-400">Inga aktiva uppgifter</p>

                <section class="mt-3 border-t border-slate-200 pt-2 dark:border-slate-700">
                  <h4>
                    <button class="flex min-h-9 w-full items-center justify-between gap-2 text-left text-xs font-medium text-slate-500 hover:text-slate-800 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2564cf] dark:text-slate-400 dark:hover:text-slate-100" style="font-size: 0.75rem" type="button" :aria-expanded="isCompletedExpanded(list.id)" :aria-label="`${isCompletedExpanded(list.id) ? 'Dölj' : 'Visa'} slutförda uppgifter i ${list.name}`" @click="toggleCompleted(list.id)">
                      <span>Slutförda ({{ tasksForList(list, true).length }})</span>
                      <ChevronRight :size="16" :class="{ 'rotate-90': isCompletedExpanded(list.id) }" aria-hidden="true" />
                    </button>
                  </h4>
                  <div v-if="isCompletedExpanded(list.id)" class="mt-1">
                    <ul v-if="tasksForList(list, true).length" class="divide-y divide-slate-200 dark:divide-slate-700" :aria-label="`Slutförda uppgifter i ${list.name}`">
                      <li v-for="task in tasksForList(list, true)" :key="task.id">
                        <TaskRow
                          :task="task"
                          :step-count="taskStore.taskStepCounts.get(task.id) ?? null"
                          :task-status-mode="list.taskStatusMode ?? 'binary'"
                          :available-lists="listStore.lists"
                          @select="taskStore.setActiveTask(task.id)"
                          @toggle-completed="taskStore.toggleCompleted(task.id)"
                          @set-status="taskStore.setTaskStatus(task.id, $event, list.taskStatusMode ?? 'binary')"
                          @toggle-important="taskStore.toggleImportant(task.id)"
                          @toggle-my-day="taskStore.toggleMyDay(task.id)"
                          @delete="requestDeleteTask(task.id)"
                          @move-to-list="handleMoveTaskToList(task.id, $event)"
                          @select-tag="handleSelectTag"
                        />
                      </li>
                    </ul>
                    <p v-else class="py-3 text-xs text-slate-500 dark:text-slate-400">Inga slutförda uppgifter</p>
                  </div>
                </section>
              </div>
            </section>
          </div>
          <p v-else class="w-72 py-3 text-sm text-slate-500 dark:text-slate-400">Inga listor i mappen ännu.</p>
        </section>
      </div>
      </div>
    </div>
    </div>

    <TaskDetailsPanel
      v-if="taskStore.activeTask"
      :task="taskStore.activeTask"
      :steps="taskStore.activeSteps"
      :available-tags="availableTags"
      :available-lists="listStore.lists"
      @close="taskStore.setActiveTask(null)"
      @save-title="taskStore.updateTask(taskStore.activeTaskId!, { title: $event })"
      @add-step="taskStore.createStep({ taskId: taskStore.activeTaskId!, title: $event })"
      @reorder-steps="taskStore.reorderSteps(taskStore.activeTaskId!, $event)"
      @save-step-title="handleSaveStepTitle"
      @toggle-step="taskStore.toggleStep($event)"
      @delete-step="taskStore.deleteStep($event)"
      @toggle-my-day="taskStore.toggleMyDay(taskStore.activeTaskId!)"
      @set-due-date="taskStore.setDueDate(taskStore.activeTaskId!, $event)"
      @save-reminder="handleSaveReminder(taskStore.activeTaskId!, $event)"
      @save-note="taskStore.saveNote(taskStore.activeTaskId!, $event)"
      @save-tags="taskStore.updateTask(taskStore.activeTaskId!, { tags: $event })"
      @select-tag="handleSelectTag"
      @move-to-list="handleMoveTaskToList(taskStore.activeTaskId!, $event)"
      @delete-task="handleDeleteActiveTask"
    />

    <div v-if="pendingDeleteTaskId" class="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 px-4" role="presentation" @click.self="pendingDeleteTaskId = null">
      <section class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="overview-delete-task-title">
        <h2 id="overview-delete-task-title" class="text-lg font-semibold text-slate-800 dark:text-slate-100">Ta bort uppgiften?</h2>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Är du säker på att du vill ta bort den här uppgiften? Den går inte att återställa.</p>
        <div class="mt-6 flex justify-end gap-3">
          <button class="min-h-10 rounded-lg px-4 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" type="button" @click="pendingDeleteTaskId = null">Avbryt</button>
          <button class="min-h-10 rounded-lg bg-red-600 px-4 text-sm text-white hover:bg-red-700" type="button" @click="confirmDeleteTask">Ta bort</button>
        </div>
      </section>
    </div>
  </main>
  </div>
</template>
