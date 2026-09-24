<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Cloud } from '@lucide/vue'

interface Props {
  isDark: boolean
  isSidebarOpen: boolean
  isSaving: boolean
}

interface Emits {
  (event: 'toggle-menu'): void
  (event: 'toggle-theme'): void
  (event: 'go-home'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const iconUrl = `${import.meta.env.BASE_URL}img/icons/todo-icon.svg`
const isOnline = ref(true)
const showSavedIndicator = ref(false)
let savedIndicatorTimer: number | undefined

const updateNetworkStatus = () => {
  isOnline.value = navigator.onLine
}

watch(() => props.isSaving, (isSaving) => {
  if (savedIndicatorTimer !== undefined) window.clearTimeout(savedIndicatorTimer)
  showSavedIndicator.value = true
  if (!isSaving) {
    savedIndicatorTimer = window.setTimeout(() => {
      showSavedIndicator.value = false
    }, 1200)
  }
})

onMounted(() => {
  updateNetworkStatus()
  window.addEventListener('online', updateNetworkStatus)
  window.addEventListener('offline', updateNetworkStatus)
})

onUnmounted(() => {
  window.removeEventListener('online', updateNetworkStatus)
  window.removeEventListener('offline', updateNetworkStatus)
  if (savedIndicatorTimer !== undefined) window.clearTimeout(savedIndicatorTimer)
})
</script>

<template>
  <header class="flex h-14 shrink-0 items-center bg-[#2564cf] px-3 text-white shadow-sm dark:bg-slate-900 sm:px-4">
    <div class="flex min-w-0 flex-1 items-center gap-2 sm:w-52 sm:flex-none sm:gap-3">
      <button
        class="grid size-8 place-items-center rounded-lg text-white/90 transition hover:bg-white/15 pointer-events-auto"
        type="button"
        :aria-label="isSidebarOpen ? 'Stäng navigeringsmeny' : 'Öppna navigeringsmeny'"
        @click="emit('toggle-menu')"
      >
        <span class="text-xl leading-none">☰</span>
      </button>
      <RouterLink :to="{ name: 'home' }" class="flex items-center gap-2 cursor-pointer pointer-events-auto" aria-label="Till startsidan" @click.prevent="emit('go-home')">
        <img class="size-8 rounded-full shadow-sm" :src="iconUrl" alt="" aria-hidden="true" />
        <span class="text-lg font-semibold tracking-tight">To Do</span>
      </RouterLink>
    </div>

    <div class="flex shrink-0 items-center justify-end gap-2 sm:flex-1">
      <span v-if="!isOnline" class="rounded-lg bg-white/15 px-2 py-1 text-xs font-medium text-white" role="status">Offline</span>
      <span v-if="showSavedIndicator || isSaving" class="inline-flex items-center gap-1 text-xs text-white/90" role="status" aria-live="polite">
        <Cloud :size="16" class="animate-pulse" aria-hidden="true" />
        <span>{{ isSaving ? 'Sparar' : 'Sparat' }}</span>
      </span>
      <button
        class="grid size-9 place-items-center rounded-lg text-lg text-white/90 transition hover:bg-white/15"
        type="button"
        :aria-label="isDark ? 'Byt till ljust läge' : 'Byt till mörkt läge'"
        @click="emit('toggle-theme')"
      >
        <span aria-hidden="true">{{ isDark ? '☀' : '☾' }}</span>
      </button>
    </div>
  </header>
</template>
