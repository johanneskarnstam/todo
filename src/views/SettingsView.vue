<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Download, RefreshCw, Trash2 } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useListStore } from '@/stores/listStore'
import { useTaskStore } from '@/stores/taskStore'
import { useNetworkStatus } from '@/composables/useNetworkStatus'
import { usePreferences } from '@/composables/usePreferences'
import { useReminderNotifications } from '@/composables/useReminderNotifications'
import { useTheme } from '@/composables/useTheme'

const authStore = useAuthStore()
const listStore = useListStore()
const taskStore = useTaskStore()
const router = useRouter()
const { isOnline } = useNetworkStatus()
const { preferences, resetPreferences } = usePreferences()
const { isDark } = useTheme()
const { requestPermission } = useReminderNotifications()
const displayName = ref(authStore.user?.displayName ?? '')
const isRefreshing = ref(false)
const statusMessage = ref('')

onMounted(() => void listStore.fetchLists())

const saveDisplayName = async () => {
  const name = displayName.value.trim()
  if (!name) return
  await authStore.updateDisplayName(name)
  statusMessage.value = 'Visningsnamnet har sparats.'
}

const setNotifications = async (enabled: boolean) => {
  preferences.value.notifications = enabled
  if (enabled) await requestPermission()
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
        ← To Do
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
          <span class="text-lg" aria-hidden="true">↩</span>
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
        <label class="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm text-slate-700 dark:text-slate-200" for="task-sort">
          <span class="flex-1">Sortering</span>
          <select id="task-sort" v-model="preferences.taskSort" class="max-w-44 bg-transparent text-right text-sm text-slate-600 outline-none dark:text-slate-300">
          <option value="manual">Min ordning</option>
          <option value="created">Skapade först</option>
          <option value="dueDate">Förfallodatum</option>
          <option value="priority">Prioritet</option>
          </select>
        </label>
        <label class="mt-1 flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm text-slate-700 dark:text-slate-200">
          <input v-model="preferences.confirmDeletes" class="h-4 w-4" type="checkbox" />
          Bekräfta innan uppgifter och listor tas bort
        </label>
        <label class="mt-1 flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm text-slate-700 dark:text-slate-200">
          <input :checked="preferences.notifications" class="h-4 w-4" type="checkbox" @change="setNotifications(($event.target as HTMLInputElement).checked)" />
          Tillåt aviseringar för påminnelser
        </label>
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
