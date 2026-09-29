<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, ChevronDown, Download, LogOut, RefreshCw, Trash2 } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useListStore } from '@/stores/listStore'
import { useTaskStore } from '@/stores/taskStore'
import { useNetworkStatus } from '@/composables/useNetworkStatus'
import { usePreferences } from '@/composables/usePreferences'
import { usePushNotifications } from '@/composables/usePushNotifications'
import { useReminderNotifications } from '@/composables/useReminderNotifications'
import { useTheme } from '@/composables/useTheme'
import type { TaskReminder, TaskStatus } from '@/types'

interface ImportedTask {
  title: string
  completed?: boolean
  status?: TaskStatus
  important?: boolean
  myDay?: boolean
  dueDate?: string
  dueTimeZone?: string
  reminder?: TaskReminder | null
  note?: string
  tags?: string[]
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

const authStore = useAuthStore()
const listStore = useListStore()
const taskStore = useTaskStore()
const router = useRouter()
const { isOnline } = useNetworkStatus()
const { preferences, resetPreferences } = usePreferences()
const { enablePush, disablePush } = usePushNotifications()
const { isDark } = useTheme()
const { requestPermission } = useReminderNotifications()
const displayName = ref(authStore.user?.displayName ?? '')
const isRefreshing = ref(false)
const statusMessage = ref('')
const importListId = ref('')
const isImporting = ref(false)
const importError = ref('')
const isImportFormatOpen = ref(false)

onMounted(async () => {
  await listStore.fetchLists()
  importListId.value = listStore.lists[0]?.id ?? ''
})

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
    exportedAt: new Date().toISOString(),
    lists: listStore.lists,
    tasks: taskStore.tasks,
  }, null, 2)
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `todo-export-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
  statusMessage.value = 'Data exporterad.'
}

const importTasks = async (event: Event) => {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  statusMessage.value = ''
  importError.value = ''

  if (!importListId.value || !listStore.lists.some((list) => list.id === importListId.value)) {
    importError.value = 'Välj en lista att importera uppgifterna till.'
    return
  }

  if (file.size > 1_000_000) {
    importError.value = 'Filen får vara högst 1 MB.'
    return
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    importError.value = 'Filen innehåller inte giltig JSON.'
    return
  }

  const rows = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null && 'tasks' in parsed && Array.isArray(parsed.tasks)
      ? parsed.tasks
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
      ...(typeof row.completed === 'boolean' ? { completed: row.completed } : {}),
      ...(row.status === 'todo' || row.status === 'inProgress' || row.status === 'completed' ? { status: row.status } : {}),
      ...(typeof row.important === 'boolean' ? { important: row.important } : {}),
      ...(typeof row.myDay === 'boolean' ? { myDay: row.myDay } : {}),
      ...(typeof row.dueDate === 'string' ? { dueDate: row.dueDate } : {}),
      ...(typeof row.dueTimeZone === 'string' ? { dueTimeZone: row.dueTimeZone } : {}),
      ...(reminder !== undefined ? { reminder } : {}),
      ...(typeof row.note === 'string' ? { note: row.note } : {}),
      ...(Array.isArray(row.tags) ? { tags: row.tags.map((tag) => (tag as string).trim()).filter(Boolean) } : {}),
    })
  }

  const targetListId = importListId.value
  const targetListName = listStore.lists.find((list) => list.id === targetListId)?.name ?? 'listan'
  isImporting.value = true
  try {
    if (!taskStore.isLoaded) await taskStore.fetchTasks()
    if (!taskStore.isLoaded) {
      importError.value = taskStore.error ?? 'Uppgifterna kunde inte läsas in inför importen.'
      return
    }

    let importedCount = 0
    for (let index = 0; index < importedTasks.length; index += 20) {
      const batch = importedTasks.slice(index, index + 20)
      const results = await Promise.all(batch.map((task) => taskStore.createTask({ listId: targetListId, ...task })))
      importedCount += results.filter(Boolean).length
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
  if (!window.confirm('Rensa lokala uppgifter och sparade inställningar?')) return
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
          <input v-model="preferences.confirmDeletes" class="h-4 w-4" type="checkbox" />
          Bekräfta innan uppgifter och listor tas bort
        </label>
        <label class="mt-1 flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm text-slate-700 dark:text-slate-200">
          <input :checked="preferences.notifications" class="h-4 w-4" type="checkbox" @change="setNotifications(($event.target as HTMLInputElement).checked)" />
          Tillåt aviseringar för påminnelser
        </label>
      </section>

      <section class="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:px-5" aria-labelledby="import-heading">
        <h2 id="import-heading" class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Importera uppgifter</h2>
        <label class="block text-sm text-slate-700 dark:text-slate-200" for="import-list">Lista</label>
        <select id="import-list" v-model="importListId" class="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" :disabled="!listStore.lists.length || isImporting">
          <option v-for="list in listStore.lists" :key="list.id" :value="list.id">{{ list.name }}</option>
        </select>
        <label class="mt-3 block text-sm text-slate-700 dark:text-slate-200" for="import-file">JSON-fil</label>
        <input id="import-file" class="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:min-h-9 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 dark:text-slate-300 dark:file:bg-slate-800 dark:file:text-slate-200 dark:hover:file:bg-slate-700" type="file" accept=".json,application/json" :disabled="!listStore.lists.length || isImporting" @change="importTasks" />
        <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Titel är obligatorisk. Anteckning, datum, påminnelse, taggar och status är valfria. En fullständig export från appen fungerar också. Högst 500 uppgifter per fil.</p>
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
          <button class="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40" type="button" @click="clearLocalData">
            <Trash2 :size="18" class="shrink-0" aria-hidden="true" />
            <span class="flex-1">Rensa lokala data</span>
          </button>
        </div>
      </section>
      </div>
    </div>
  </main>
</template>
