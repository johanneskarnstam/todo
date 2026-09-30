<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ArrowDownUp, ChevronDown, Ellipsis, Plus } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import TodoHeader from '@/components/TodoHeader.vue'
import TodoSidebar from '@/components/TodoSidebar.vue'
import TaskRow from '@/components/TaskRow.vue'
import TaskDetailsPanel from '@/components/TaskDetailsPanel.vue'
import { useTheme } from '@/composables/useTheme'
import { DEFAULT_LIST_ID, useListStore } from '@/stores/listStore'
import { useTaskStore } from '@/stores/taskStore'
import { useToastStore } from '@/stores/toastStore'
import { useReminderNotifications } from '@/composables/useReminderNotifications'
import { useDragReorder } from '@/composables/useDragReorder'
import { usePreferences } from '@/composables/usePreferences'
import { sortTasksForMode } from '@/utils/taskSorting'
import { isTaskCompleted } from '@/utils/taskStatus'
import type { ListSortMode, SmartView, TaskReminder } from '@/types'

const isSidebarOpen = ref(typeof window === 'undefined' ? true : window.innerWidth >= 1024)
const isSearchOpen = ref(false)
const taskTitle = ref('')
const pendingDeleteTaskId = ref<string | null>(null)
const pendingDeleteListId = ref<string | null>(null)
const deleteListTasks = ref(false)
const isListOptionsOpen = ref(false)
const listRenameTitle = ref('')
const isRenamingList = ref(false)
const listStore = useListStore()
const taskStore = useTaskStore()
const toastStore = useToastStore()
const { requestPermission, scheduleTaskReminder, cancelTaskReminder } = useReminderNotifications()
const { isDark, toggleTheme } = useTheme()
const { preferences } = usePreferences()
const route = useRoute()
const router = useRouter()

interface PlannedGroup {
  key: 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'nextWeek' | 'later'
  tasks: typeof taskStore.visibleTasks
}

const routeSmartView = computed(() => route.meta.smartView as SmartView | undefined)
const routeTag = computed(() => typeof route.params.tag === 'string' ? route.params.tag : undefined)
const notificationTaskId = computed(() => typeof route.query.task === 'string' ? route.query.task : null)
const isPlannedView = computed(() => routeSmartView.value === 'planned')

const currentTitle = computed(() => {
  if (routeTag.value) return `#${routeTag.value}`

  const view = taskStore.activeView
  if (view?.type === 'smart') {
    if (view.smartView === 'important') return 'Stjärnmärkt'
    if (view.smartView === 'planned') return 'Planerat'
    return 'Min dag'
  }

  return listStore.selectedList?.name ?? (view?.type === 'list' ? 'Att göra' : 'Min dag')
})

const canAddTask = computed(() => taskStore.activeView?.type === 'list')
const activeList = computed(() => taskStore.activeView?.type === 'list' ? listStore.selectedList : null)
const canRenameActiveList = computed(() => Boolean(activeList.value && activeList.value.id !== DEFAULT_LIST_ID))
const activeListColor = computed(() => activeList.value?.themeColor ?? '#2564cf')
const activeListSortMode = computed<ListSortMode>(() => activeList.value?.sortMode ?? preferences.value.taskSort)
const activeListSortLabel = computed(() => ({
  manual: 'Min ordning',
  created: 'Skapade först',
  dueDate: 'Förfallodatum',
  priority: 'Prioritet',
}[activeListSortMode.value]))
const activeListTaskStatusMode = computed(() => activeList.value?.taskStatusMode ?? 'binary')
const readCollapsedCompletedLists = (): Record<string, boolean> => {
  if (typeof localStorage === 'undefined') return {}

  try {
    return JSON.parse(localStorage.getItem('todo-collapsed-completed-lists') ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}
const collapsedCompletedLists = ref<Record<string, boolean>>(readCollapsedCompletedLists())
const areCompletedTasksVisible = computed(() => {
  const listId = activeList.value?.id
  return !listId || !collapsedCompletedLists.value[listId]
})

watch(collapsedCompletedLists, (value) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('todo-collapsed-completed-lists', JSON.stringify(value))
}, { deep: true })

const toggleCompletedTasks = () => {
  const listId = activeList.value?.id
  if (listId) collapsedCompletedLists.value[listId] = !collapsedCompletedLists.value[listId]
}

const availableTags = computed(() => [...new Set(taskStore.tasks.flatMap((task) => task.tags ?? []))].sort())
const filteredVisibleTasks = computed(() => {
  const sortMode = taskStore.activeView?.type === 'list' ? activeListSortMode.value : preferences.value.taskSort
  return sortTasksForMode(taskStore.visibleTasks, sortMode)
})
const filteredActiveTasks = computed(() => filteredVisibleTasks.value.filter((task) => !isTaskCompleted(task)))
const filteredCompletedTasks = computed(() => filteredVisibleTasks.value.filter((task) => isTaskCompleted(task)))

const taskListContainer = ref<HTMLElement | null>(null)
const canDrag = computed(() => taskStore.activeView?.type === 'list' && activeListSortMode.value === 'manual')

useDragReorder({
  containerRef: taskListContainer,
  items: filteredActiveTasks,
  onReorder: (orderedIds) => {
    const listId = taskStore.activeView?.type === 'list' ? taskStore.activeView.listId : null
    if (listId) void taskStore.reorderTasks(listId, orderedIds)
  },
  enabled: canDrag,
})

const handleMoveTask = (taskId: string, direction: -1 | 1) => {
  const ids = filteredActiveTasks.value.map((t) => t.id)
  const index = ids.indexOf(taskId)
  if (index < 0) return
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= ids.length) return
  const [removed] = ids.splice(index, 1)
  ids.splice(targetIndex, 0, removed)
  const listId = taskStore.activeView?.type === 'list' ? taskStore.activeView.listId : null
  if (listId && canDrag.value) void taskStore.reorderTasks(listId, ids)
}
const dueDateKey = (task: (typeof taskStore.tasks)[number]) => {
  if (!task.dueDate) return ''
  if (typeof task.dueDate === 'string') return task.dueDate.slice(0, 10)
  const date = task.dueDate.toDate()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const taskListName = (listId: string) => listStore.lists.find((list) => list.id === listId)?.name ?? null

const plannedGroups = computed<PlannedGroup[]>(() => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const dayOfWeek = today.getDay()
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
  const thisWeekEnd = new Date(today)
  thisWeekEnd.setDate(today.getDate() + daysUntilSunday)

  const nextWeekStart = new Date(thisWeekEnd)
  nextWeekStart.setDate(thisWeekEnd.getDate() + 1)
  const nextWeekEnd = new Date(nextWeekStart)
  nextWeekEnd.setDate(nextWeekStart.getDate() + 6)

  const formatDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const todayKey = formatDate(today)
  const tomorrowKey = formatDate(tomorrow)
  const thisWeekEndKey = formatDate(thisWeekEnd)
  const nextWeekStartKey = formatDate(nextWeekStart)
  const nextWeekEndKey = formatDate(nextWeekEnd)

  const groups: Record<PlannedGroup['key'], PlannedGroup['tasks']> = {
    overdue: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
    nextWeek: [],
    later: [],
  }

  for (const task of filteredVisibleTasks.value) {
    const key = dueDateKey(task)
    if (!key) continue

    if (key < todayKey) {
      groups.overdue.push(task)
      continue
    }

    if (key === todayKey) {
      groups.today.push(task)
      continue
    }

    if (key === tomorrowKey) {
      groups.tomorrow.push(task)
      continue
    }

    if (key > tomorrowKey && key <= thisWeekEndKey) {
      groups.thisWeek.push(task)
      continue
    }

    if (key >= nextWeekStartKey && key <= nextWeekEndKey) {
      groups.nextWeek.push(task)
      continue
    }

    groups.later.push(task)
  }

  return (Object.keys(groups) as PlannedGroup['key'][])
    .map((key) => ({ key, tasks: groups[key].sort((first, second) => dueDateKey(first).localeCompare(dueDateKey(second))) }))
    .filter((group) => group.tasks.length > 0)
})

const handleSelectList = (listId: string) => {
  listStore.selectList(listId)
  taskStore.setListView(listId)
  void router.push('/')
  isSidebarOpen.value = false
}

const handleGoHome = () => {
  taskStore.setActiveTask(null)
  taskStore.setListView(DEFAULT_LIST_ID)
  void router.push({ name: 'home' })
}

const openSearch = () => {
  isSearchOpen.value = true
}

const updateSearch = (value: string) => {
  void router.push({ name: 'search', query: value ? { q: value } : {} })
}

const closeSearch = () => {
  isSearchOpen.value = false
}

const startRenameList = () => {
  if (!canRenameActiveList.value || !activeList.value) return
  listRenameTitle.value = activeList.value.name
  isRenamingList.value = true
}

const saveListRename = () => {
  const listId = activeList.value?.id
  const name = listRenameTitle.value.trim()
  if (!listId || listId === DEFAULT_LIST_ID) return
  if (!name) {
    isRenamingList.value = false
    return
  }

  void listStore.updateList(listId, { name })
  listRenameTitle.value = ''
  isRenamingList.value = false
}

const cancelRenameList = () => {
  isRenamingList.value = false
  listRenameTitle.value = ''
}

watch(() => activeList.value?.id, (listId, previousListId) => {
  if (listId !== previousListId) cancelRenameList()
})

const openListSettings = () => {
  const listId = activeList.value?.id
  if (!listId) return
  isListOptionsOpen.value = false
  void router.push({ name: 'list-settings', params: { listId } })
}

const requestDeleteList = (listId = activeList.value?.id) => {
  if (!listId) return
  pendingDeleteListId.value = listId
  deleteListTasks.value = false
  isListOptionsOpen.value = false
  if (!preferences.value.confirmDeletes) void confirmDeleteList()
}

const confirmDeleteList = async () => {
  const listId = pendingDeleteListId.value
  if (!listId) return

  pendingDeleteListId.value = null
  const deleted = await listStore.deleteList(listId)
  if (deleted && deleteListTasks.value) await taskStore.deleteTasksForLists([listId])
  if (listStore.selectedListId) taskStore.setListView(listStore.selectedListId)
}

const handleCreateList = (name: string, folderId?: string | null) => {
  void listStore.createList({ name, folderId: folderId ?? undefined }).then((createdList) => {
    if (createdList) taskStore.setListView(createdList.id)
  })
}

const handleCreateFolder = (name: string) => {
  void listStore.createFolder({ name })
}

const handleMoveList = (listId: string, folderId: string | null) => {
  void listStore.moveList(listId, folderId)
}

const handleMoveTaskToList = (taskId: string, targetListId: string) => {
  const targetList = listStore.lists.find((list) => list.id === targetListId)
  void taskStore.moveTask(taskId, targetListId, targetList?.name)
}

const handleRenameFolder = (folderId: string, name: string) => {
  void listStore.updateFolder(folderId, { name })
}

const handleDeleteFolder = async (folderId: string, deleteLists: boolean) => {
  const deletedListIds = await listStore.deleteFolder(folderId, deleteLists)
  if (deletedListIds?.length) await taskStore.deleteTasksForLists(deletedListIds)
  if (listStore.selectedListId) taskStore.setListView(listStore.selectedListId)
}

const handleSelectSmartView = (view: SmartView) => {
  taskStore.setSmartView(view)
  void router.push({ name: view === 'myDay' ? 'my-day' : view })
  isSidebarOpen.value = false
}

const handleSelectTag = (tag: string) => {
  if (!tag) {
    taskStore.setListView(listStore.selectedListId ?? DEFAULT_LIST_ID)
    void router.push({ name: 'home' })
    return
  }

  taskStore.setActiveTask(null)
  taskStore.setTagView(tag)
  void router.push({ name: 'tag', params: { tag } })
  isSidebarOpen.value = false
}

const handleAddTask = () => {
  const listId = taskStore.activeView?.type === 'list' ? taskStore.activeView.listId : null
  if (!listId || !taskTitle.value.trim()) return

  void taskStore.createTask({ listId, title: taskTitle.value })
  taskTitle.value = ''
}

const handleDeleteActiveTask = () => {
  const taskId = taskStore.activeTaskId
  if (!taskId) return

  if (preferences.value.confirmDeletes) pendingDeleteTaskId.value = taskId
  else deleteTaskImmediately(taskId)
}

const requestDeleteTask = (taskId: string) => {
  if (preferences.value.confirmDeletes) pendingDeleteTaskId.value = taskId
  else deleteTaskImmediately(taskId)
}

const cancelDeleteTask = () => {
  pendingDeleteTaskId.value = null
}

const deleteTaskImmediately = (taskId: string) => {
  if (!taskId) return

  if (taskStore.activeTaskId === taskId) taskStore.setActiveTask(null)
  void taskStore.deleteTask(taskId)
}

const confirmDeleteTask = () => {
  const taskId = pendingDeleteTaskId.value
  if (!taskId) return

  pendingDeleteTaskId.value = null
  deleteTaskImmediately(taskId)
}

const handleSaveStepTitle = (stepId: string, title: string) => {
  void taskStore.updateStep(stepId, title)
}

const handleSetDueDate = async (taskId: string, dueDate: string) => {
  taskStore.setDueDate(taskId, dueDate)
}

const handleSaveReminder = async (taskId: string, reminder: TaskReminder | null) => {
  if (reminder) {
    const granted = await requestPermission()
    if (!granted) toastStore.show('Påminnelsen sparas, men aviseringar är blockerade i webbläsaren.')
  }
  await taskStore.updateTask(taskId, { reminder })
}

const handleGlobalKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return

  if (pendingDeleteTaskId.value) {
    cancelDeleteTask()
    return
  }

  if (pendingDeleteListId.value) {
    pendingDeleteListId.value = null
    return
  }

  if (!taskStore.activeTaskId) return

  const taskId = taskStore.activeTaskId
  taskStore.setActiveTask(null)
  void nextTick(() => document.querySelector<HTMLElement>(`[data-task-id="${taskId}"]`)?.focus())
}

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown)
  if (!notificationTaskId.value) {
    if (routeTag.value) {
      taskStore.setTagView(routeTag.value)
    } else if (routeSmartView.value) {
      taskStore.setSmartView(routeSmartView.value)
    } else {
      taskStore.setListView(listStore.selectedListId ?? DEFAULT_LIST_ID)
    }
  }
  await listStore.fetchLists()
  if (notificationTaskId.value) {
    await taskStore.fetchTasks()
    const task = taskStore.tasks.find((candidate) => candidate.id === notificationTaskId.value)
    taskStore.setListView(task?.listId ?? listStore.selectedListId ?? DEFAULT_LIST_ID)
    if (task) taskStore.setActiveTask(task.id)
  } else if (routeTag.value) {
    taskStore.setTagView(routeTag.value)
  } else if (routeSmartView.value) {
    taskStore.setSmartView(routeSmartView.value)
  } else {
    taskStore.setListView(listStore.selectedListId ?? DEFAULT_LIST_ID)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

watch([routeSmartView, routeTag], ([view, tag]) => {
  taskStore.setActiveTask(null)
  if (tag) {
    taskStore.setTagView(tag)
  } else if (view) {
    taskStore.setSmartView(view)
  } else {
    taskStore.setListView(listStore.selectedListId ?? DEFAULT_LIST_ID)
  }
})

watch(
  () => taskStore.tasks,
  (tasks) => {
    for (const task of tasks) {
      if (isTaskCompleted(task) || !task.dueDate) {
        cancelTaskReminder(task.id)
      } else {
        scheduleTaskReminder(task)
      }
    }
  },
  { deep: true, immediate: true },
)

</script>

<template>
  <div class="flex h-screen flex-col bg-[#faf9f8] text-slate-800 dark:bg-slate-950 dark:text-slate-100" :class="{ dark: isDark }">
    <TodoHeader
      :is-dark="isDark"
      :is-sidebar-open="isSidebarOpen"
      :is-saving="taskStore.isSaving || listStore.isSaving"
      :search-open="isSearchOpen"
      @toggle-menu="isSidebarOpen = !isSidebarOpen"
      @toggle-theme="toggleTheme"
      @go-home="handleGoHome"
      @open-search="openSearch"
      @close-search="closeSearch"
      @update-search="updateSearch"
    />

    <div class="flex min-h-0 flex-1">
      <TodoSidebar
        :open="isSidebarOpen"
        :active-list-id="listStore.selectedListId"
        :active-smart-view="taskStore.activeView?.type === 'smart' ? taskStore.activeView.smartView : null"
        :available-tags="availableTags"
        :selected-tag="routeTag ?? ''"
        :folders="listStore.foldersWithLists"
        :ungrouped-lists="listStore.ungroupedLists"
        :smart-view-counts="taskStore.smartViewCounts"
        :list-task-counts="taskStore.listTaskCounts"
        @close="isSidebarOpen = false"
        @select-list="handleSelectList"
        @select-smart-view="handleSelectSmartView"
        @select-tag="handleSelectTag"
        @create-list="handleCreateList"
        @create-folder="handleCreateFolder"
        @move-list="handleMoveList"
        @delete-list="requestDeleteList"
        @rename-folder="handleRenameFolder"
        @delete-folder="handleDeleteFolder"
      />

      <main class="min-w-0 flex-1 overflow-y-auto rounded-t-2xl bg-[#faf9f8] dark:bg-slate-950 sm:rounded-t-none">
        <div class="mx-auto w-full max-w-5xl px-4 pb-12 pt-7 sm:px-8 lg:px-12">
          <div class="flex items-center gap-4">
            <div class="min-w-0 flex-1">
              <form v-if="isRenamingList && canRenameActiveList" class="flex min-w-0 items-center gap-2" @submit.prevent="saveListRename">
                <label class="sr-only" for="rename-list-title">Listnamn</label>
                <input id="rename-list-title" v-model="listRenameTitle" class="min-w-0 flex-1 rounded-md border border-blue-400 bg-white px-2 py-1 text-xl font-semibold outline-none focus:ring-2 focus:ring-blue-200 dark:bg-slate-900 sm:text-2xl" type="text" autofocus @keydown.esc.prevent="cancelRenameList" />
                <button class="min-h-9 rounded-md bg-[#2564cf] px-3 text-sm text-white" type="submit">Spara</button>
                <button class="min-h-9 rounded-md px-3 text-sm text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800" type="button" @click="cancelRenameList">Avbryt</button>
              </form>
              <h1 v-else class="truncate text-2xl font-semibold tracking-tight sm:text-3xl" :style="{ color: activeListColor }">
                <button v-if="canRenameActiveList" class="max-w-full truncate text-left hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2564cf]" type="button" :aria-label="`Byt namn på listan ${currentTitle}`" @click="startRenameList">{{ currentTitle }}</button>
                <span v-else>{{ currentTitle }}</span>
              </h1>
              <p v-if="activeList && activeListSortMode !== 'manual'" class="mt-1 text-xs text-slate-600 dark:text-slate-400" role="note">
                Sorterad efter {{ activeListSortLabel }}. Dra och släpp är avstängt.
              </p>
            </div>
            <div v-if="activeList" class="relative">
              <button class="grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-200 dark:hover:bg-slate-800" type="button" aria-label="Fler listalternativ" :aria-expanded="isListOptionsOpen" @click="isListOptionsOpen = !isListOptionsOpen"><Ellipsis :size="20" aria-hidden="true" /></button>
              <div v-if="isListOptionsOpen" class="absolute right-0 top-10 z-20 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                <button class="flex min-h-9 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" type="button" @click="openListSettings">Listinställningar</button>
                <button v-if="activeList.id !== DEFAULT_LIST_ID" class="mt-1 flex min-h-9 w-full items-center rounded-lg px-3 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950" type="button" @click="requestDeleteList()">Ta bort lista</button>
              </div>
            </div>
            <div v-else class="size-9" aria-hidden="true" />
            <button class="hidden size-9 place-items-center rounded text-[#2564cf] transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800 sm:grid" type="button" aria-label="Sortera uppgifter"><ArrowDownUp :size="18" aria-hidden="true" /></button>
          </div>

          <p v-if="listStore.error" class="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200" role="alert">
            {{ listStore.error }}
          </p>

          <form v-if="canAddTask" class="mt-7 flex h-14 w-full items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 text-left text-sm text-[#2564cf] shadow-sm transition focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400 dark:focus-within:ring-blue-900" @submit.prevent="handleAddTask">
            <Plus :size="20" aria-hidden="true" />
            <label class="sr-only" for="new-task-title">Lägg till en uppgift</label>
            <input id="new-task-title" v-model="taskTitle" class="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-[#2564cf] dark:text-slate-100 dark:placeholder:text-blue-400" type="text" placeholder="Lägg till en uppgift" />
          </form>

          <template v-if="isPlannedView">
            <section v-for="group in plannedGroups" :key="group.key" class="mt-6" :aria-labelledby="`${group.key}-tasks-heading`">
              <h2 :id="`${group.key}-tasks-heading`" class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ { overdue: 'Försenat', today: 'Idag', tomorrow: 'Imorgon', thisWeek: 'Denna veckan', nextWeek: 'Nästa vecka', later: 'Senare' }[group.key] }}</h2>
              <div class="overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-700">
                <TaskRow
                  v-for="task in group.tasks"
                  :key="task.id"
                  :task="task"
                  :step-count="taskStore.taskStepCounts.get(task.id) ?? null"
                  :list-name="taskListName(task.listId)"
                  :show-due-date="true"
                  task-status-mode="binary"
                  :available-lists="listStore.lists"
                  @select="taskStore.setActiveTask(task.id)"
                  @toggle-completed="taskStore.toggleCompleted(task.id)"
                  @toggle-important="taskStore.toggleImportant(task.id)"
                  @toggle-my-day="taskStore.toggleMyDay(task.id)"
                  @delete="requestDeleteTask(task.id)"
                  @move-to-list="handleMoveTaskToList(task.id, $event)"
                  @select-tag="handleSelectTag"
                />
              </div>
            </section>
          </template>

          <section v-else-if="filteredActiveTasks.length" class="mt-6" aria-labelledby="active-tasks-heading">
            <h2 id="active-tasks-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Uppgifter</h2>
            <div ref="taskListContainer" class="overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-700">
              <TaskRow
                v-for="task in filteredActiveTasks"
                :key="task.id"
                :task="task"
                :step-count="taskStore.taskStepCounts.get(task.id) ?? null"
                :list-name="routeTag ? taskListName(task.listId) : (taskStore.activeView?.type === 'smart' && taskStore.activeView.smartView === 'important' ? taskListName(task.listId) : null)"
                :draggable="canDrag"
                :task-status-mode="activeListTaskStatusMode"
                :available-lists="listStore.lists"
                @select="taskStore.setActiveTask(task.id)"
                @toggle-completed="taskStore.toggleCompleted(task.id)"
                @set-status="taskStore.setTaskStatus(task.id, $event, activeListTaskStatusMode)"
                @toggle-important="taskStore.toggleImportant(task.id)"
                @toggle-my-day="taskStore.toggleMyDay(task.id)"
                @delete="requestDeleteTask(task.id)"
                @move="(direction) => handleMoveTask(task.id, direction)"
                @move-to-list="handleMoveTaskToList(task.id, $event)"
                @select-tag="handleSelectTag"
              />
            </div>
          </section>

          <section v-if="!isPlannedView && filteredCompletedTasks.length" class="mt-7" aria-labelledby="completed-tasks-heading">
            <h2 id="completed-tasks-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <button
                v-if="activeList"
                class="inline-flex min-h-8 items-center gap-1 rounded text-left transition hover:text-slate-800 dark:hover:text-slate-100"
                type="button"
                :aria-label="areCompletedTasksVisible ? 'Dölj slutförda uppgifter' : 'Visa slutförda uppgifter'"
                :aria-expanded="areCompletedTasksVisible"
                @click="toggleCompletedTasks"
              >
                Slutförda
                <ChevronDown :size="16" :class="{ '-rotate-90': !areCompletedTasksVisible }" aria-hidden="true" />
              </button>
              <span v-else>Slutförda</span>
            </h2>
            <div v-if="areCompletedTasksVisible" class="overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-700">
              <TaskRow
                  v-for="task in filteredCompletedTasks"
                :key="task.id"
                :task="task"
                :step-count="taskStore.taskStepCounts.get(task.id) ?? null"
                :list-name="routeTag ? taskListName(task.listId) : (taskStore.activeView?.type === 'smart' && taskStore.activeView.smartView === 'important' ? taskListName(task.listId) : null)"
                :task-status-mode="activeListTaskStatusMode"
                :available-lists="listStore.lists"
                @select="taskStore.setActiveTask(task.id)"
                @toggle-completed="taskStore.toggleCompleted(task.id)"
                @set-status="taskStore.setTaskStatus(task.id, $event, activeListTaskStatusMode)"
                @toggle-important="taskStore.toggleImportant(task.id)"
                @toggle-my-day="taskStore.toggleMyDay(task.id)"
                @delete="requestDeleteTask(task.id)"
                @move-to-list="handleMoveTaskToList(task.id, $event)"
                @select-tag="handleSelectTag"
              />
            </div>
          </section>

          <p v-if="taskStore.isLoaded && !filteredVisibleTasks.length" class="mt-16 text-center text-sm text-slate-500 dark:text-slate-400">Inga uppgifter ännu</p>
        </div>
      </main>

      <TaskDetailsPanel
        v-if="taskStore.activeTask"
        :task="taskStore.activeTask"
        :steps="taskStore.activeSteps"
        :available-lists="listStore.lists"
        @close="taskStore.setActiveTask(null)"
        @save-title="taskStore.updateTask(taskStore.activeTaskId!, { title: $event })"
        @add-step="taskStore.createStep({ taskId: taskStore.activeTaskId!, title: $event })"
        @reorder-steps="taskStore.reorderSteps(taskStore.activeTaskId!, $event)"
        @save-step-title="handleSaveStepTitle"
        @toggle-step="taskStore.toggleStep($event)"
        @delete-step="taskStore.deleteStep($event)"
        @toggle-my-day="taskStore.toggleMyDay(taskStore.activeTaskId!)"
        @set-due-date="handleSetDueDate(taskStore.activeTaskId!, $event)"
        @save-reminder="handleSaveReminder(taskStore.activeTaskId!, $event)"
        @save-note="taskStore.saveNote(taskStore.activeTaskId!, $event)"
        @save-tags="taskStore.updateTask(taskStore.activeTaskId!, { tags: $event })"
        @select-tag="handleSelectTag"
        @move-to-list="handleMoveTaskToList(taskStore.activeTaskId!, $event)"
        @delete-task="handleDeleteActiveTask"
      />

      <div v-if="pendingDeleteTaskId" class="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 px-4" role="presentation" @click.self="cancelDeleteTask">
        <section class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="delete-task-title">
          <h2 id="delete-task-title" class="text-lg font-semibold text-slate-800 dark:text-slate-100">Ta bort uppgiften?</h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Är du säker på att du vill ta bort den här uppgiften? Den går inte att återställa.</p>
          <div class="mt-6 flex justify-end gap-3">
            <button class="min-h-10 rounded-lg px-4 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" type="button" @click="cancelDeleteTask">Avbryt</button>
            <button class="min-h-10 rounded-lg bg-red-600 px-4 text-sm text-white hover:bg-red-700" type="button" @click="confirmDeleteTask">Ta bort</button>
          </div>
        </section>
      </div>

      <div v-if="pendingDeleteListId" class="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 px-4" role="presentation" @click.self="pendingDeleteListId = null">
        <section class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="delete-list-title">
          <h2 id="delete-list-title" class="text-lg font-semibold text-slate-800 dark:text-slate-100">Ta bort lista?</h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Välj om uppgifterna också ska tas bort eller behållas utan lista.</p>
          <label class="mt-4 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input v-model="deleteListTasks" type="checkbox" />
            Ta bort uppgifter i listan
          </label>
          <div class="mt-6 flex justify-end gap-3">
            <button class="min-h-10 rounded-lg px-4 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" type="button" @click="pendingDeleteListId = null">Avbryt</button>
            <button class="min-h-10 rounded-lg bg-red-600 px-4 text-sm text-white hover:bg-red-700" type="button" @click="confirmDeleteList">Ta bort lista</button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
