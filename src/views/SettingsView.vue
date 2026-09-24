<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { DEFAULT_LIST_ID, useListStore } from '@/stores/listStore'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const listStore = useListStore()
const router = useRouter()

onMounted(() => void listStore.fetchLists())

const selectDefaultList = (event: Event) => {
  listStore.setDefaultList((event.target as HTMLSelectElement).value || null)
}

const handleLogout = async () => {
  try {
    await authStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}
</script>

<template>
  <main class="min-h-screen bg-[#faf9f8] px-4 py-8 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:px-8 lg:px-12">
    <div class="mx-auto max-w-2xl">
      <RouterLink class="mb-8 inline-flex min-h-10 items-center rounded px-3 text-sm text-[#2564cf] hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800" to="/">
        ← To Do
      </RouterLink>
      <h1 class="text-3xl font-semibold text-[#2564cf] dark:text-blue-400">Inställningar</h1>

      <section class="mt-8 border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="default-list-heading">
        <h2 id="default-list-heading" class="text-lg font-semibold">Standardlista</h2>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Välj vilken lista som ska öppnas automatiskt när appen laddas.</p>
        <label class="mt-5 block" for="default-list">
          <span class="sr-only">Standardlista</span>
          <select id="default-list" class="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#2564cf] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" :value="listStore.defaultListId ?? DEFAULT_LIST_ID" @change="selectDefaultList">
            <option v-for="list in listStore.lists" :key="list.id" :value="list.id">{{ list.name }}</option>
          </select>
        </label>
      </section>
      <section class="mt-8 border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="account-heading">
        <h2 id="account-heading" class="text-lg font-semibold">Konto</h2>
        <div class="mt-5 flex items-center gap-4">
          <img
            v-if="authStore.user?.photoURL"
            :src="authStore.user.photoURL"
            alt="Profilbild"
            class="h-14 w-14 rounded-full object-cover"
          />
          <div v-else class="h-14 w-14 rounded-full bg-slate-300 dark:bg-slate-600" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
              {{ authStore.user?.displayName || 'Användare' }}
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400 truncate">
              {{ authStore.user?.email || '' }}
            </p>
          </div>
        </div>
        <button
          class="mt-5 flex h-10 w-full items-center gap-3 rounded border border-red-200 bg-white px-4 text-sm text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-slate-800"
          type="button"
          @click="handleLogout"
        >
          <span class="text-lg" aria-hidden="true">↩</span>
          <span>Logga ut</span>
        </button>
      </section>
    </div>
  </main>
</template>
