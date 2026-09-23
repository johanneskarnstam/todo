<script setup lang="ts">
import { useI18n, type Locale } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const { t, locale, setLocale } = useI18n()
const authStore = useAuthStore()
const router = useRouter()

const selectLocale = (nextLocale: Locale) => {
  setLocale(nextLocale)
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
        ← {{ t('appName') }}
      </RouterLink>
      <h1 class="text-3xl font-semibold text-[#2564cf] dark:text-blue-400">{{ t('settingsTitle') }}</h1>

      <section class="mt-8 border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="language-heading">
        <h2 id="language-heading" class="text-lg font-semibold">{{ t('language') }}</h2>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ t('languageDescription') }}</p>
        <div class="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" :aria-label="t('language')">
          <button
            class="min-h-12 rounded border px-4 text-left text-sm transition hover:border-[#2564cf]"
            :class="locale === 'sv' ? 'border-[#2564cf] bg-blue-50 text-[#2564cf] dark:bg-slate-800 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700'"
            type="button"
            role="radio"
            :aria-checked="locale === 'sv'"
            @click="selectLocale('sv')"
          >
            {{ t('swedish') }}
          </button>
          <button
            class="min-h-12 rounded border px-4 text-left text-sm transition hover:border-[#2564cf]"
            :class="locale === 'en' ? 'border-[#2564cf] bg-blue-50 text-[#2564cf] dark:bg-slate-800 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700'"
            type="button"
            role="radio"
            :aria-checked="locale === 'en'"
            @click="selectLocale('en')"
          >
            {{ t('english') }}
          </button>
        </div>
      </section>
      <section class="mt-8 border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="account-heading">
        <h2 id="account-heading" class="text-lg font-semibold">{{ t('account') }}</h2>
        <div class="mt-5 flex items-center gap-4">
          <img
            v-if="authStore.user?.photoURL"
            :src="authStore.user.photoURL"
            alt="Profile"
            class="h-14 w-14 rounded-full object-cover"
          />
          <div v-else class="h-14 w-14 rounded-full bg-slate-300 dark:bg-slate-600" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
              {{ authStore.user?.displayName || t('user') }}
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
          <span>{{ t('logout') }}</span>
        </button>
      </section>
    </div>
  </main>
</template>
