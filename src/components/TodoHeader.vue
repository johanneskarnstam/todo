<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

interface Props {
  isDark: boolean
  isSidebarOpen: boolean
}

interface Emits {
  (event: 'toggle-menu'): void
  (event: 'toggle-theme'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
const iconUrl = `${import.meta.env.BASE_URL}img/icons/todo-icon.svg`
const isOnline = ref(true)

const updateNetworkStatus = () => {
  isOnline.value = navigator.onLine
}

onMounted(() => {
  updateNetworkStatus()
  window.addEventListener('online', updateNetworkStatus)
  window.addEventListener('offline', updateNetworkStatus)
})

onUnmounted(() => {
  window.removeEventListener('online', updateNetworkStatus)
  window.removeEventListener('offline', updateNetworkStatus)
})
</script>

<template>
  <header class="flex h-14 shrink-0 items-center bg-[#2564cf] px-3 text-white shadow-sm dark:bg-slate-900 sm:px-4">
    <div class="flex min-w-0 flex-1 items-center gap-2 sm:w-52 sm:flex-none sm:gap-3">
      <button
        class="grid size-8 place-items-center rounded-lg text-white/90 transition hover:bg-white/15"
        type="button"
        :aria-label="isSidebarOpen ? 'Stäng navigeringsmeny' : 'Öppna navigeringsmeny'"
        @click="emit('toggle-menu')"
      >
        <span class="text-xl leading-none">☰</span>
      </button>
      <div class="flex items-center gap-2">
        <img class="size-8 rounded-full shadow-sm" :src="iconUrl" alt="" aria-hidden="true" />
        <span class="text-lg font-semibold tracking-tight">Att göra</span>
      </div>
    </div>

    <div class="flex shrink-0 items-center justify-end gap-2 sm:flex-1">
      <span v-if="!isOnline" class="rounded-lg bg-white/15 px-2 py-1 text-xs font-medium text-white" role="status">Offline</span>
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
