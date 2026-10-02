<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, BookOpen, ChevronDown, Download, History, LogOut, RefreshCw, Sparkles, Trash2 } from '@lucide/vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ChangeTimelineModal from '@/components/ChangeTimelineModal.vue'
import FeatureOverviewModal from '@/components/FeatureOverviewModal.vue'
import ToggleSwitch from '@/components/ToggleSwitch.vue'
import { useAuthStore } from '@/stores/auth'
import { useListStore } from '@/stores/listStore'
import { useTaskStore } from '@/stores/taskStore'
import { useNetworkStatus } from '@/composables/useNetworkStatus'
import { usePreferences } from '@/composables/usePreferences'
import { usePushNotifications } from '@/composables/usePushNotifications'
import { useReminderNotifications } from '@/composables/useReminderNotifications'
import { useTheme } from '@/composables/useTheme'
import { useAppUpdate } from '@/composables/useAppUpdate'
import { useAiKeys } from '@/composables/useAiKeys'
import type { List, TaskReminder, TaskStatus } from '@/types'
import { normalizeTag, normalizeTags } from '@/utils/taskTags'
import { releaseNotes } from '@/releaseNotes'

interface ImportedTask {
  title: string
  sourceTaskId?: string
  sourceListId?: string
  completed?: boolean
  status?: TaskStatus
  important?: boolean
  myDay?: boolean
  dueDate?: string
  dueTimeZone?: string
  reminder?: TaskReminder | null
  note?: string
  tags?: string[]
  archived?: boolean
}

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isReminderOffset = (value: unknown): value is TaskReminder['offsetMinutes'] =>
  value === 0 || value === 10 || value === 60 || value === 1440

const isValidDueDate = (value: string) => {
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value)
  if (!match?.[1]) return false

  const date = new Date(`${match[1]}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== match[1]) return false

  return match[2] === undefined || (Number(match[2]) <= 23 && Number(match[3]) <= 59)
}

const CREATE_NEW_LIST_OPTION = '__create_new_import_list__'

const authStore = useAuthStore()
const listStore = useListStore()
const taskStore = useTaskStore()
const router = useRouter()
const { isOnline } = useNetworkStatus()
const { preferences, resetPreferences } = usePreferences()
const { enablePush, disablePush } = usePushNotifications()
const { isDark } = useTheme()
const { requestPermission } = useReminderNotifications()
const { isUpdatingApp, updateError, forceUpdateApp } = useAppUpdate()
const displayName = ref(authStore.user?.displayName ?? '')
const isRefreshing = ref(false)
const statusMessage = ref('')
const importListId = ref('')
const newImportListName = ref('')
const importJson = ref('')
const importMode = ref<'tasks' | 'backup'>('tasks')
const isImporting = ref(false)
const importError = ref('')
const isImportFormatOpen = ref(false)
const isTimelineOpen = ref(false)
const isFeatureOverviewOpen = ref(false)
const isClearLocalDataConfirmationOpen = ref(false)
const editingTag = ref<string | null>(null)
const editedTagName = ref('')
const tagError = ref('')
const availableTags = computed(() => [...new Set(taskStore.tasks.flatMap((task) => task.tags ?? []))].sort())

const { aiKeys, selectedApiKey, addKey, removeKey, maskApiKey } = useAiKeys()
const newAiKeyInput = ref('')
const aiKeyFeedback = ref('')
const aiKeyFeedbackIsError = ref(false)

const handleAddAiKey = () => {
  aiKeyFeedback.value = ''
  aiKeyFeedbackIsError.value = false
  const trimmed = newAiKeyInput.value.trim()
  const res = addKey(trimmed)
  if (!res.success) {
    aiKeyFeedback.value = res.error ?? 'Kunde inte lägga till nyckeln.'
    aiKeyFeedbackIsError.value = true
    return
  }
  newAiKeyInput.value = ''
  aiKeyFeedback.value = 'API-nyckel har lagts till.'
  selectedApiKey.value = trimmed
}

onMounted(async () => {
  await Promise.all([listStore.fetchLists(), taskStore.fetchTasks()])
  importListId.value = listStore.lists[0]?.id ?? CREATE_NEW_LIST_OPTION
})

const startEditingTag = (tag: string) => {
  editingTag.value = tag
  editedTagName.value = tag
  tagError.value = ''
}

const cancelEditingTag = () => {
  editingTag.value = null
  editedTagName.value = ''
  tagError.value = ''
}

const saveTagRename = async (tag: string) => {
  const nextTag = normalizeTag(editedTagName.value)
  if (!nextTag) {
    tagError.value = 'Taggnamnet får inte vara tomt.'
    return
  }
  if (nextTag === tag) {
    cancelEditingTag()
    return
  }

  tagError.value = ''
  let failedUpdates = 0
  const taggedTasks = taskStore.tasks.filter((task) => task.tags?.includes(tag))
  for (const task of taggedTasks) {
    const nextTags = [...new Set((task.tags ?? []).map((taskTag) => taskTag === tag ? nextTag : taskTag))]
    await taskStore.updateTask(task.id, { tags: nextTags })
    if (taskStore.error) failedUpdates += 1
  }

  if (failedUpdates) {
    tagError.value = `Taggen kunde inte uppdateras på ${failedUpdates} ${failedUpdates === 1 ? 'uppgift' : 'uppgifter'}.`
    return
  }

  editingTag.value = null
  editedTagName.value = ''
  statusMessage.value = `Taggen har bytt namn till #${nextTag}.`
}

const saveDisplayName = async () => {
  const name = displayName.value.trim()
  if (!name) return
  await authStore.updateDisplayName(name)
  statusMessage.value = 'Visningsnamnet har sparats.'
}

const setNotifications = async (enabled: boolean) => {
  preferences.value.notifications = enabled
  if (enabled) {
    await requestPermission()
    const registered = await enablePush()
    if (!registered) {
      preferences.value.notifications = false
      statusMessage.value = 'Pushaviseringar kunde inte aktiveras på den här enheten.'
    }
  } else {
    await disablePush()
  }
}

const refreshData = async () => {
  isRefreshing.value = true
  statusMessage.value = ''
  try {
    await listStore.fetchLists()
    await taskStore.fetchTasks()
    statusMessage.value = 'Data uppdaterad.'
  } finally {
    isRefreshing.value = false
  }
}

const exportData = () => {
  const payload = JSON.stringify({
    formatVersion: 2,
    exportedAt: new Date().toISOString(),
    preferences: preferences.value,
    folders: listStore.folders,
    lists: listStore.lists,
    tasks: taskStore.tasks,
    steps: taskStore.allSteps,
  }, null, 2)
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `todo-export-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
  statusMessage.value = 'Data exporterad.'
}

const loadImportFile = async (event: Event) => {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  importError.value = ''
  statusMessage.value = ''
  if (file.size > 1_000_000) {
    importError.value = 'Filen får vara högst 1 MB.'
    return
  }

  try {
    importJson.value = await file.text()
  } catch {
    importError.value = 'Filen kunde inte läsas.'
  }
}

const importTasks = async () => {
  statusMessage.value = ''
  importError.value = ''

  const createNewList = importListId.value === CREATE_NEW_LIST_OPTION
  const requestedListName = newImportListName.value.trim()
  if (createNewList && !requestedListName) {
    importError.value = 'Ange ett namn på den nya listan.'
    return
  }
  if (!createNewList && (!importListId.value || !listStore.lists.some((list) => list.id === importListId.value))) {
    importError.value = 'Välj en lista att importera uppgifterna till.'
    return
  }
  if (new TextEncoder().encode(importJson.value).length > 1_000_000) {
    importError.value = 'JSON-texten får vara högst 1 MB.'
    return
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(importJson.value)
  } catch {
    importError.value = 'Filen innehåller inte giltig JSON.'
    return
  }

  const backup = !Array.isArray(parsed) && isJsonObject(parsed) && Array.isArray(parsed.tasks)
  const backupPayload = backup
    ? parsed as { tasks: unknown[]; lists?: unknown[]; folders?: unknown[]; steps?: unknown[] }
    : null
  if (importMode.value === 'backup' && (!backupPayload || !Array.isArray(backupPayload.lists))) {
    importError.value = 'Säkerhetskopian måste innehålla listor och uppgifter.'
    return
  }

  const backupListIds = new Map<string, string>()
  if (importMode.value === 'backup' && backupPayload) {
    if (backupPayload && 'preferences' in backupPayload && isJsonObject((backupPayload as { preferences?: unknown }).preferences)) {
      const importedPreferences = (backupPayload as { preferences: Record<string, unknown> }).preferences
      preferences.value = {
        ...preferences.value,
        theme: importedPreferences.theme === 'dark' || importedPreferences.theme === 'system' ? importedPreferences.theme : 'light',
        notifications: typeof importedPreferences.notifications === 'boolean' ? importedPreferences.notifications : preferences.value.notifications,
        taskSort: importedPreferences.taskSort === 'created' || importedPreferences.taskSort === 'dueDate' || importedPreferences.taskSort === 'priority'
          ? importedPreferences.taskSort
          : 'manual',
        confirmDeletes: typeof importedPreferences.confirmDeletes === 'boolean' ? importedPreferences.confirmDeletes : preferences.value.confirmDeletes,
      }
    }
    const backupFolders = Array.isArray(backupPayload.folders) ? backupPayload.folders : []
    const folderIds = new Map<string, string>()
    for (const row of backupFolders) {
      if (!isJsonObject(row) || typeof row.id !== 'string' || typeof row.name !== 'string') continue
      const folder = await listStore.createFolder({ name: row.name })
      if (folder) folderIds.set(row.id, folder.id)
    }

    for (const row of backupPayload.lists ?? []) {
      if (!isJsonObject(row) || typeof row.id !== 'string' || typeof row.name !== 'string') continue
      if (row.id === '__default__') {
        backupListIds.set(row.id, '__default__')
        continue
      }
      const createdList = await listStore.createList({
        name: row.name,
        icon: typeof row.icon === 'string' ? row.icon : 'list',
        folderId: typeof row.folderId === 'string' ? folderIds.get(row.folderId) : undefined,
      })
      if (!createdList) continue
      backupListIds.set(row.id, createdList.id)
      const listSettings: Partial<Pick<List, 'themeColor' | 'sortMode' | 'newTasksFirst' | 'showCompletedTasks' | 'archiveCompletedTasks' | 'confirmDeletes' | 'showStepsByDefault' | 'viewMode' | 'taskStatusMode'>> = {}
      for (const key of ['themeColor', 'sortMode', 'newTasksFirst', 'showCompletedTasks', 'archiveCompletedTasks', 'confirmDeletes', 'showStepsByDefault', 'viewMode', 'taskStatusMode'] as const) {
        if (key in row) listSettings[key] = row[key] as never
      }
      if (Object.keys(listSettings).length) await listStore.updateList(createdList.id, listSettings)
    }
  }

  const rows = Array.isArray(parsed)
    ? parsed
    : backup
      ? backupPayload?.tasks ?? null
      : null

  if (!rows?.length) {
    importError.value = 'JSON-filen måste innehålla en lista med uppgifter.'
    return
  }
  if (rows.length > 500) {
    importError.value = 'Du kan importera högst 500 uppgifter åt gången.'
    return
  }

  const importedTasks: ImportedTask[] = []
  for (const [index, row] of rows.entries()) {
    if (!isJsonObject(row)) {
      importError.value = `Uppgift ${index + 1} måste vara ett JSON-objekt.`
      return
    }

    const title = typeof row.title === 'string' ? row.title.trim() : ''
    if (!title) {
      importError.value = `Uppgift ${index + 1} saknar en titel.`
      return
    }
    if (importMode.value === 'backup' && (typeof row.listId !== 'string' || !backupListIds.has(row.listId))) {
      importError.value = `Uppgift ${index + 1} hänvisar till en okänd lista.`
      return
    }

    for (const field of ['completed', 'important', 'myDay'] as const) {
      if (field in row && typeof row[field] !== 'boolean') {
        importError.value = `Fältet ${field} i uppgift ${index + 1} måste vara true eller false.`
        return
      }
    }
    if ('status' in row && row.status !== 'todo' && row.status !== 'inProgress' && row.status !== 'completed') {
      importError.value = `Fältet status i uppgift ${index + 1} måste vara todo, inProgress eller completed.`
      return
    }
    if (typeof row.status === 'string' && typeof row.completed === 'boolean' && (row.status === 'completed') !== row.completed) {
      importError.value = `Fältet completed stämmer inte med status i uppgift ${index + 1}.`
      return
    }
    if ('dueDate' in row && (typeof row.dueDate !== 'string' || !isValidDueDate(row.dueDate))) {
      importError.value = `Fältet dueDate i uppgift ${index + 1} måste ha formatet ÅÅÅÅ-MM-DD eller ÅÅÅÅ-MM-DDTHH:mm.`
      return
    }
    if ('dueTimeZone' in row && typeof row.dueTimeZone !== 'string') {
      importError.value = `Fältet dueTimeZone i uppgift ${index + 1} måste vara text.`
      return
    }
    if ('note' in row && typeof row.note !== 'string') {
      importError.value = `Fältet note i uppgift ${index + 1} måste vara text.`
      return
    }
    if ('tags' in row && (!Array.isArray(row.tags) || !row.tags.every((tag) => typeof tag === 'string'))) {
      importError.value = `Fältet tags i uppgift ${index + 1} måste vara en lista med texter.`
      return
    }

    let reminder: TaskReminder | null | undefined
    if ('reminder' in row) {
      if (row.reminder === null) {
        reminder = null
      } else if (isJsonObject(row.reminder) && isReminderOffset(row.reminder.offsetMinutes)) {
        reminder = { offsetMinutes: row.reminder.offsetMinutes }
      } else {
        importError.value = `Fältet reminder i uppgift ${index + 1} måste ha offsetMinutes 0, 10, 60 eller 1440.`
        return
      }
    }

    importedTasks.push({
      title,
      ...(typeof row.id === 'string' ? { sourceTaskId: row.id } : {}),
      ...(typeof row.listId === 'string' && backupListIds.has(row.listId) ? { sourceListId: backupListIds.get(row.listId) } : {}),
      ...(typeof row.completed === 'boolean' ? { completed: row.completed } : {}),
      ...(row.status === 'todo' || row.status === 'inProgress' || row.status === 'completed' ? { status: row.status } : {}),
      ...(typeof row.important === 'boolean' ? { important: row.important } : {}),
      ...(typeof row.myDay === 'boolean' ? { myDay: row.myDay } : {}),
      ...(typeof row.dueDate === 'string' ? { dueDate: row.dueDate } : {}),
      ...(typeof row.dueTimeZone === 'string' ? { dueTimeZone: row.dueTimeZone } : {}),
      ...(reminder !== undefined ? { reminder } : {}),
      ...(typeof row.note === 'string' ? { note: row.note } : {}),
      ...(Array.isArray(row.tags) ? { tags: normalizeTags(row.tags as string[]) } : {}),
      ...(typeof row.archived === 'boolean' ? { archived: row.archived } : {}),
    })
  }

  isImporting.value = true
  try {
    if (!taskStore.isLoaded) await taskStore.fetchTasks()
    if (!taskStore.isLoaded) {
      importError.value = taskStore.error ?? 'Uppgifterna kunde inte läsas in inför importen.'
      return
    }

    let targetListId = importListId.value
    let targetListName = listStore.lists.find((list) => list.id === targetListId)?.name ?? 'listan'
    if (importMode.value === 'backup') targetListName = 'säkerhetskopian'
    if (createNewList) {
      const createdList = await listStore.createList({ name: requestedListName })
      if (!createdList || listStore.error) {
        importError.value = listStore.error ?? 'Den nya listan kunde inte skapas.'
        return
      }
      targetListId = createdList.id
      targetListName = createdList.name
    }

    let importedCount = 0
    const importedTaskIds = new Map<string, string>()
    for (let index = 0; index < importedTasks.length; index += 20) {
      const batch = importedTasks.slice(index, index + 20)
      const results = await Promise.all(batch.map((task) => taskStore.createTask({
        listId: task.sourceListId ?? targetListId,
        title: task.title,
        completed: task.completed,
        status: task.status,
        important: task.important,
        myDay: task.myDay,
        dueDate: task.dueDate,
        dueTimeZone: task.dueTimeZone,
        reminder: task.reminder,
        note: task.note,
        tags: task.tags,
        archived: task.archived,
      })))
      results.forEach((result, index) => {
        const sourceTaskId = batch[index]?.sourceTaskId
        if (sourceTaskId && result?.id) importedTaskIds.set(sourceTaskId, result.id)
      })
      importedCount += results.filter(Boolean).length
    }

    if (importMode.value === 'backup' && backupPayload && Array.isArray(backupPayload.steps)) {
      for (const row of backupPayload.steps) {
        if (!isJsonObject(row) || typeof row.taskId !== 'string' || typeof row.title !== 'string') continue
        const taskId = importedTaskIds.get(row.taskId)
        if (taskId) await taskStore.createStep({ taskId, title: row.title, completed: row.completed === true })
      }
    }

    if (importedCount) {
      statusMessage.value = `${importedCount} ${importedCount === 1 ? 'uppgift importerad' : 'uppgifter importerade'} till ${targetListName}.`
    }
    if (importedCount < importedTasks.length) {
      importError.value = `${importedTasks.length - importedCount} uppgifter kunde inte sparas.`
    }
  } finally {
    isImporting.value = false
  }
}

const clearLocalData = () => {
  isClearLocalDataConfirmationOpen.value = false
  localStorage.removeItem('todo-mock-tasks')
  localStorage.removeItem('todo-preferences')
  resetPreferences()
  taskStore.clearState()
  listStore.clearState()
  statusMessage.value = 'Lokala data har rensats.'
}

const handleLogout = async () => {
  await authStore.logout()
  await router.push('/login')
}
</script>

<template>
  <main class="min-h-screen bg-slate-100 px-3 py-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:px-6 sm:py-8" :class="{ dark: isDark }">
    <div class="mx-auto max-w-3xl">
      <header class="mb-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <RouterLink class="inline-flex min-h-9 items-center rounded-lg px-3 text-sm text-[#2564cf] hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800" to="/">
        <ArrowLeft :size="16" aria-hidden="true" />
        <span>To Do</span>
        </RouterLink>
        <h1 class="text-lg font-semibold text-slate-700 dark:text-slate-200">Inställningar</h1>
      </header>

      <p v-if="statusMessage" class="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">
        {{ statusMessage }}
      </p>

      <div class="flex flex-col gap-3">
      <section class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/40 sm:px-5" aria-labelledby="account-heading">
        <h2 id="account-heading" class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Konto</h2>
        <div class="flex items-center gap-4">
          <img v-if="authStore.user?.photoURL" :src="authStore.user.photoURL" alt="Profilbild" class="h-14 w-14 rounded-full object-cover" />
          <div v-else class="h-14 w-14 rounded-full bg-slate-300 dark:bg-slate-600" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm text-slate-500 dark:text-slate-400">{{ authStore.user?.email || '' }}</p>
          </div>
        </div>
        <label class="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" for="display-name">Visningsnamn</label>
        <input id="display-name" v-model="displayName" class="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#2564cf] dark:border-slate-700 dark:bg-slate-900" type="text" @keyup.enter="saveDisplayName" />
        <div class="mt-3 flex flex-wrap gap-2">
        <button class="h-10 rounded-lg bg-[#2564cf] px-4 text-sm font-medium text-white hover:bg-blue-700" type="button" @click="saveDisplayName">Spara namn</button>
        <button class="flex h-10 flex-1 items-center justify-center gap-3 rounded-lg border border-red-200 bg-white px-4 text-sm text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-slate-800" type="button" @click="handleLogout">
          <LogOut :size="18" aria-hidden="true" />
          <span>Logga ut</span>
        </button>
        </div>
      </section>

      <section class="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:px-5" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Utseende</h2>
        <label class="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm text-slate-700 dark:text-slate-200" for="theme">
          <span class="flex-1">Tema</span>
          <select id="theme" v-model="preferences.theme" class="max-w-44 bg-transparent text-right text-sm text-slate-600 outline-none dark:text-slate-300">
          <option value="light">Ljust</option>
          <option value="dark">Mörkt</option>
          <option value="system">Följ systemet</option>
          </select>
        </label>
      </section>

      <section class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/40 sm:px-5" aria-labelledby="tasks-heading">
        <h2 id="tasks-heading" class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Uppgifter</h2>
        <p class="rounded-lg px-2 py-2 text-sm text-slate-600 dark:text-slate-300">Sortering och arbetsflöde ställs in per lista.</p>
        <label class="mt-1 flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm text-slate-700 dark:text-slate-200">
          <ToggleSwitch id="confirm-deletes" :checked="preferences.confirmDeletes" aria-label="Bekräfta innan uppgifter och listor tas bort" @change="preferences.confirmDeletes = $event" />
          Bekräfta innan uppgifter och listor tas bort
        </label>
        <label class="mt-1 flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm text-slate-700 dark:text-slate-200">
          <ToggleSwitch id="notifications" :checked="preferences.notifications" aria-label="Tillåt aviseringar för påminnelser" @change="setNotifications" />
          Tillåt aviseringar för påminnelser
        </label>
      </section>

      <section class="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:px-5" aria-labelledby="tags-settings-heading">
        <h2 id="tags-settings-heading" class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Taggar</h2>
        <p class="mb-2 text-sm text-slate-500 dark:text-slate-400">Små bokstäver används; mellanslag blir bindestreck.</p>
        <ul v-if="availableTags.length" class="divide-y divide-slate-200 dark:divide-slate-700">
          <li v-for="tag in availableTags" :key="tag" class="flex min-h-12 items-center gap-2 py-2">
            <form v-if="editingTag === tag" class="flex min-w-0 flex-1 items-center gap-2" @submit.prevent="saveTagRename(tag)">
              <label class="sr-only" :for="`rename-tag-${tag}`">Namn på taggen #{{ tag }}</label>
              <input :id="`rename-tag-${tag}`" v-model="editedTagName" class="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#2564cf] dark:border-slate-600 dark:bg-slate-800" type="text" />
              <button class="min-h-9 rounded-md bg-[#2564cf] px-3 text-sm font-medium text-white" type="submit" :aria-label="`Spara taggnamn #${tag}`">Spara</button>
              <button class="min-h-9 rounded-md px-3 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" type="button" @click="cancelEditingTag">Avbryt</button>
            </form>
            <template v-else>
              <span class="min-w-0 flex-1 truncate text-sm font-medium text-[#2564cf] dark:text-blue-300">#{{ tag }}</span>
              <button class="min-h-9 rounded-md px-3 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" type="button" :aria-label="`Redigera taggen #${tag}`" @click="startEditingTag(tag)">Redigera</button>
            </template>
          </li>
        </ul>
        <p v-else class="px-2 py-2 text-sm text-slate-500 dark:text-slate-400">Inga taggar ännu.</p>
        <p v-if="tagError" class="mt-2 text-sm text-red-700 dark:text-red-300" role="alert">{{ tagError }}</p>
      </section>

      <section id="ai-keys" class="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:px-5" aria-labelledby="ai-settings-heading">
        <div class="mb-2 flex items-center gap-2">
          <Sparkles :size="18" class="text-[#2564cf] dark:text-blue-400" aria-hidden="true" />
          <h2 id="ai-settings-heading" class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">AI-uppdelning & API-nycklar</h2>
        </div>
        <p class="mb-3 text-sm text-slate-600 dark:text-slate-300">
          Lägg till en eller flera personliga Gemini API-nycklar från Google AI Studio. Om kvoten tar slut för en nyckel testar appen automatiskt nästa i listan.
        </p>

        <form class="mb-3 flex flex-col gap-2 sm:flex-row" @submit.prevent="handleAddAiKey">
          <label class="sr-only" for="new-ai-key">Ny Gemini API-nyckel</label>
          <input
            id="new-ai-key"
            v-model="newAiKeyInput"
            type="password"
            autocomplete="off"
            placeholder="Klistra in Gemini API-nyckel (AIzaSy...)"
            class="min-h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#2564cf] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            class="min-h-10 rounded-lg bg-[#2564cf] px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            :disabled="!newAiKeyInput.trim()"
          >
            Lägg till nyckel
          </button>
        </form>
        <p v-if="aiKeyFeedback" class="mb-3 text-xs" :class="aiKeyFeedbackIsError ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-400'" role="status">
          {{ aiKeyFeedback }}
        </p>

        <div v-if="aiKeys.length" class="space-y-3">
          <div class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <label for="settings-key-select" class="text-xs font-medium text-slate-700 dark:text-slate-300">Vald API-nyckel:</label>
            <select
              id="settings-key-select"
              v-model="selectedApiKey"
              class="min-h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-[#2564cf] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option v-if="aiKeys.length > 1" value="auto">
                Automatiskt (testa alla {{ aiKeys.length }})
              </option>
              <option v-for="(key, index) in aiKeys" :key="index" :value="key">
                Nyckel {{ index + 1 }} ({{ maskApiKey(key) }})
              </option>
              <option value="standard">
                Projektets standard (ingen nyckel)
              </option>
            </select>
          </div>

          <h3 class="text-xs font-medium text-slate-500 dark:text-slate-400">Sparade nycklar (används i turordning vid automatiskt läge):</h3>
          <ul class="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
            <li v-for="(key, index) in aiKeys" :key="index" class="flex items-center justify-between gap-3 p-3">
              <div class="flex min-w-0 items-center gap-2">
                <span class="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {{ index + 1 }}
                </span>
                <span class="truncate font-mono text-xs text-slate-800 dark:text-slate-200">
                  {{ maskApiKey(key) }}
                </span>
                <span v-if="selectedApiKey === key" class="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                  Vald
                </span>
                <span v-else-if="index === 0 && selectedApiKey === 'auto'" class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  Första i tur
                </span>
              </div>
              <div class="flex items-center gap-2">
                <button
                  v-if="selectedApiKey !== key"
                  type="button"
                  class="rounded px-2 py-1 text-xs font-medium text-[#2564cf] hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                  @click="selectedApiKey = key"
                >
                  Välj
                </button>
                <button
                  type="button"
                  class="p-1 text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  :aria-label="`Ta bort nyckel ${index + 1}`"
                  @click="removeKey(index)"
                >
                  Ta bort
                </button>
              </div>
            </li>
          </ul>
        </div>
        <p v-else class="text-xs text-slate-500 dark:text-slate-400">
          Inga egna nycklar tillagda. Appen använder projektets standardkvot.
        </p>
      </section>

      <section class="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:px-5" aria-labelledby="import-heading">
        <h2 id="import-heading" class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Importera uppgifter</h2>
        <label class="block text-sm text-slate-700 dark:text-slate-200" for="import-mode">Importtyp</label>
        <select id="import-mode" v-model="importMode" class="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" :disabled="isImporting">
          <option value="tasks">Uppgifter till vald lista</option>
          <option value="backup">Full säkerhetskopia</option>
        </select>
        <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">En full säkerhetskopia återställer mappar, listor, listinställningar, uppgifter och delsteg utan att skriva över befintliga poster.</p>
        <label class="block text-sm text-slate-700 dark:text-slate-200" for="import-list">Importera till</label>
        <select id="import-list" v-model="importListId" class="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" :disabled="isImporting || importMode === 'backup'">
          <option v-for="list in listStore.lists" :key="list.id" :value="list.id">{{ list.name }}</option>
          <option :value="CREATE_NEW_LIST_OPTION">Skapa ny lista</option>
        </select>
        <div v-if="importListId === CREATE_NEW_LIST_OPTION" class="mt-3">
          <label class="block text-sm text-slate-700 dark:text-slate-200" for="new-import-list-name">Namn på ny lista</label>
          <input id="new-import-list-name" v-model="newImportListName" class="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" type="text" placeholder="Listnamn" :disabled="isImporting" />
        </div>
        <label class="mt-3 block text-sm text-slate-700 dark:text-slate-200" for="import-json">Klistra in JSON</label>
        <textarea id="import-json" v-model="importJson" class="mt-1 min-h-40 w-full resize-y rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-700 outline-none focus:border-[#2564cf] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" placeholder='[{ "title": "Handla mjölk" }]' :disabled="isImporting" />
        <label class="mt-3 block text-sm text-slate-700 dark:text-slate-200" for="import-file">Eller fyll textfältet från JSON-fil</label>
        <input id="import-file" class="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:min-h-9 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 dark:text-slate-300 dark:file:bg-slate-800 dark:file:text-slate-200 dark:hover:file:bg-slate-700" type="file" accept=".json,application/json" :disabled="isImporting" @change="loadImportFile" />
        <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Titel är obligatorisk. Anteckning, datum, påminnelse, taggar, status och arkiveringsläge kan importeras. Högst 500 uppgifter per fil.</p>
        <button class="mt-3 min-h-10 rounded-lg bg-[#2564cf] px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50" type="button" :disabled="isImporting || !importJson.trim()" @click="importTasks">
          {{ isImporting ? 'Importerar...' : 'Importera uppgifter' }}
        </button>
        <p v-if="isImporting" class="mt-2 text-sm text-slate-500 dark:text-slate-400" role="status">Importerar uppgifter...</p>
        <p v-if="importError" class="mt-2 text-sm text-red-700 dark:text-red-300" role="alert">{{ importError }}</p>
        <div class="mt-3 border-t border-slate-200 dark:border-slate-700">
          <h3>
            <button id="import-format-heading" class="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2564cf] dark:text-slate-200 dark:hover:text-white" type="button" aria-controls="import-format-panel" :aria-expanded="isImportFormatOpen" @click="isImportFormatOpen = !isImportFormatOpen">
              <span>Visa exempel på JSON-format och fält</span>
              <ChevronDown :size="18" class="shrink-0 transition-transform" :class="{ 'rotate-180': isImportFormatOpen }" aria-hidden="true" />
            </button>
          </h3>
          <div v-if="isImportFormatOpen" id="import-format-panel" class="border-t border-slate-200 pb-1 pt-3 dark:border-slate-700" role="region" aria-labelledby="import-format-heading">
          <pre class="overflow-x-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">[
  {
    "title": "Förbered rapport",
    "note": "Ta med de senaste siffrorna",
    "dueDate": "2026-10-01T14:30",
    "dueTimeZone": "Europe/Stockholm",
    "reminder": { "offsetMinutes": 60 },
    "tags": ["arbete", "rapport"],
    "important": true,
    "myDay": false,
    "completed": false,
    "status": "todo"
  },
  { "title": "Boka möte" }
]</pre>
          <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Förfallodatum skrivs ÅÅÅÅ-MM-DD eller med tid som ÅÅÅÅ-MM-DDTHH:mm. Påminnelse väljer minuter före förfallodatum: 0, 10, 60 eller 1440. Status är todo, inProgress eller completed; completed ska stämma med status.</p>
          </div>
        </div>
      </section>

      <section class="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:px-5" aria-labelledby="sync-heading">
        <h2 id="sync-heading" class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Synkning och data</h2>
        <div class="flex min-h-11 items-center rounded-lg px-2 text-sm text-slate-700 dark:text-slate-200">
          <span class="flex-1">Status</span>
          <span :class="isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'">{{ isOnline ? 'Online' : 'Offline' }}</span>
        </div>
        <div class="mt-2 space-y-1">
          <button class="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800" type="button" :disabled="isRefreshing || !isOnline" @click="refreshData">
            <RefreshCw :size="18" :class="{ 'animate-spin': isRefreshing }" class="shrink-0 text-slate-500" aria-hidden="true" />
            <span class="flex-1">{{ isRefreshing ? 'Uppdaterar...' : 'Uppdatera data' }}</span>
            <span class="text-xs text-slate-400">{{ isOnline ? 'Synka nu' : 'Offline' }}</span>
          </button>
          <button class="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" type="button" @click="exportData">
            <Download :size="18" class="shrink-0 text-slate-500" aria-hidden="true" />
            <span class="flex-1">Exportera data</span>
            <span class="text-xs text-slate-400">JSON</span>
          </button>
          <button class="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60 dark:text-slate-200 dark:hover:bg-slate-800" type="button" :disabled="isUpdatingApp" @click="forceUpdateApp">
            <RefreshCw :size="18" :class="{ 'animate-spin': isUpdatingApp }" class="shrink-0 text-slate-500" aria-hidden="true" />
            <span class="flex-1">{{ isUpdatingApp ? 'Rensar cache och uppdaterar...' : 'Rensa cache och uppdatera appen' }}</span>
          </button>
          <button class="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40" type="button" @click="isClearLocalDataConfirmationOpen = true">
            <Trash2 :size="18" class="shrink-0" aria-hidden="true" />
            <span class="flex-1">Rensa lokala data</span>
          </button>
          <p v-if="updateError" class="px-2 text-sm text-red-700 dark:text-red-300" role="alert">{{ updateError }}</p>
          <p class="px-2 text-xs text-slate-500 dark:text-slate-400">Listor och inställningar påverkas inte.</p>
        </div>
      </section>

      <section class="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:px-5" aria-labelledby="about-heading">
        <h2 id="about-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Om appen</h2>
        <div class="divide-y divide-slate-200 dark:divide-slate-700">
          <button class="flex min-h-12 w-full items-center gap-3 px-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800" type="button" @click="isTimelineOpen = true">
            <History :size="18" class="shrink-0 text-slate-500" aria-hidden="true" />
            <span class="flex-1">Förändringshistorik</span>
            <span class="text-xs text-slate-400">{{ releaseNotes.length }} versioner</span>
          </button>
          <button class="flex min-h-12 w-full items-center gap-3 px-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800" type="button" @click="isFeatureOverviewOpen = true">
            <BookOpen :size="18" class="shrink-0 text-slate-500" aria-hidden="true" />
            <span class="flex-1">Appens funktioner</span>
          </button>
        </div>
      </section>
      </div>
    </div>
    <ChangeTimelineModal v-if="isTimelineOpen" :releases="releaseNotes" @close="isTimelineOpen = false" />
    <FeatureOverviewModal v-if="isFeatureOverviewOpen" @close="isFeatureOverviewOpen = false" />
    <ConfirmDialog
      v-if="isClearLocalDataConfirmationOpen"
      title="Rensa lokala data?"
      message="Lokala uppgifter och sparade inställningar tas bort från den här enheten."
      confirm-label="Rensa data"
      destructive
      @confirm="clearLocalData"
      @cancel="isClearLocalDataConfirmationOpen = false"
    />
  </main>
</template>
