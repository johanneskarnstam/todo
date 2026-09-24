<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Cloud, Search, X } from '@lucide/vue'

interface Props {
  isDark: boolean
  isSidebarOpen: boolean
  isSaving: boolean
  searchOpen?: boolean
  searchQuery?: string
  showMenu?: boolean
}

interface Emits {
  (event: 'toggle-menu'): void
  (event: 'toggle-theme'): void
  (event: 'go-home'): void
  (event: 'open-search'): void
  (event: 'close-search'): void
  (event: 'update-search', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  showMenu: true,
})
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
    <div class="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
      <button
      v-if="props.showMenu !== false"
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
      <div v-if="props.searchOpen" class="flex min-w-0 flex-1 items-center gap-2 sm:max-w-xl">
        <Search :size="18" :stroke-width="2" aria-hidden="true" />
        <input
          class="min-w-0 flex-1 border-b border-white/50 bg-transparent px-1 py-1 text-sm text-white outline-none placeholder:text-white/70"
          type="search"
          placeholder="Sök uppgifter, taggar eller listor"
          aria-label="Sök uppgifter, taggar eller listor"
          :value="props.searchQuery ?? ''"
          autofocus
          @input="emit('update-search', ($event.target as HTMLInputElement).value)"
          @keydown.escape="emit('close-search')"
        />
        <button class="grid size-8 shrink-0 place-items-center rounded-lg text-white/90 transition hover:bg-white/15" type="button" aria-label="Stäng sök" @click="emit('close-search')">
          <X :size="18" aria-hidden="true" />
        </button>
      </div>
      <button
        v-else
        class="grid size-8 shrink-0 place-items-center rounded-lg text-white/90 transition hover:bg-white/15"
        type="button"
        aria-label="Öppna sök"
        @click="emit('open-search')"
      >
        <Search :size="19" :stroke-width="2" aria-hidden="true" />
      </button>
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
