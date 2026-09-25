<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
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
  <main class="min-h-screen bg-[#faf9f8] px-4 py-8 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:px-8 lg:px-12" :class="{ dark: isDark }">
    <div class="mx-auto max-w-2xl">
      <RouterLink class="mb-8 inline-flex min-h-10 items-center rounded px-3 text-sm text-[#2564cf] hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800" to="/">
        ← To Do
      </RouterLink>
      <h1 class="text-3xl font-semibold text-[#2564cf] dark:text-blue-400">Inställningar</h1>

      <p v-if="statusMessage" class="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">
        {{ statusMessage }}
      </p>

      <section class="mt-8 border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="account-heading">
        <h2 id="account-heading" class="text-lg font-semibold">Konto</h2>
        <div class="mt-5 flex items-center gap-4">
          <img v-if="authStore.user?.photoURL" :src="authStore.user.photoURL" alt="Profilbild" class="h-14 w-14 rounded-full object-cover" />
          <div v-else class="h-14 w-14 rounded-full bg-slate-300 dark:bg-slate-600" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm text-slate-500 dark:text-slate-400">{{ authStore.user?.email || '' }}</p>
            <label class="mt-2 block text-xs text-slate-500 dark:text-slate-400" for="display-name">Visningsnamn</label>
            <input id="display-name" v-model="displayName" class="mt-1 h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-800" type="text" @keyup.enter="saveDisplayName" />
          </div>
        </div>
        <button class="mt-4 h-10 rounded bg-[#2564cf] px-4 text-sm font-medium text-white hover:bg-blue-700" type="button" @click="saveDisplayName">Spara namn</button>
        <button class="mt-5 flex h-10 w-full items-center gap-3 rounded border border-red-200 bg-white px-4 text-sm text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-slate-800" type="button" @click="handleLogout">
          <span class="text-lg" aria-hidden="true">↩</span>
          <span>Logga ut</span>
        </button>
      </section>

      <section class="mt-5 border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" class="text-lg font-semibold">Utseende</h2>
        <label class="mt-4 block text-sm" for="theme">Tema</label>
        <select id="theme" v-model="preferences.theme" class="mt-2 h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-800">
          <option value="light">Ljust</option>
          <option value="dark">Mörkt</option>
          <option value="system">Följ systemet</option>
        </select>
      </section>

      <section class="mt-5 border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="tasks-heading">
        <h2 id="tasks-heading" class="text-lg font-semibold">Uppgifter</h2>
        <label class="mt-4 block text-sm" for="task-sort">Sortering</label>
        <select id="task-sort" v-model="preferences.taskSort" class="mt-2 h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-800">
          <option value="manual">Min ordning</option>
          <option value="created">Skapade först</option>
          <option value="dueDate">Förfallodatum</option>
          <option value="priority">Prioritet</option>
        </select>
        <label class="mt-5 flex items-center gap-3 text-sm">
          <input v-model="preferences.confirmDeletes" class="h-4 w-4" type="checkbox" />
          Bekräfta innan uppgifter och listor tas bort
        </label>
        <label class="mt-4 flex items-center gap-3 text-sm">
          <input :checked="preferences.notifications" class="h-4 w-4" type="checkbox" @change="setNotifications(($event.target as HTMLInputElement).checked)" />
          Tillåt aviseringar för påminnelser
        </label>
      </section>

      <section class="mt-5 border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="sync-heading">
        <h2 id="sync-heading" class="text-lg font-semibold">Synkning och data</h2>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Status: {{ isOnline ? 'Online' : 'Offline' }}</p>
        <div class="mt-4 flex flex-wrap gap-3">
          <button class="h-10 rounded border border-slate-300 px-4 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800" type="button" :disabled="isRefreshing || !isOnline" @click="refreshData">{{ isRefreshing ? 'Uppdaterar...' : 'Uppdatera data' }}</button>
          <button class="h-10 rounded border border-slate-300 px-4 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800" type="button" @click="exportData">Exportera data</button>
          <button class="h-10 rounded border border-red-200 px-4 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-slate-800" type="button" @click="clearLocalData">Rensa lokala data</button>
        </div>
      </section>
    </div>
  </main>
</template>
