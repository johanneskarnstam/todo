<script setup lang="ts">
import { useI18n } from '@/i18n'

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
const { t } = useI18n()
</script>

<template>
  <header class="flex h-14 shrink-0 items-center bg-[#2564cf] px-3 text-white shadow-sm sm:px-4">
    <div class="flex w-52 shrink-0 items-center gap-3">
      <button
        class="grid size-8 place-items-center rounded-sm text-white/90 transition hover:bg-white/15"
        type="button"
        :aria-label="isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'"
        @click="emit('toggle-menu')"
      >
        <span class="text-xl leading-none">☰</span>
      </button>
      <div class="flex items-center gap-2">
        <span class="grid size-8 place-items-center rounded-lg bg-white text-lg font-bold text-[#2564cf] shadow-sm" aria-hidden="true">✓</span>
        <span class="text-lg font-semibold tracking-tight">{{ t('appName') }}</span>
      </div>
    </div>

    <div class="flex flex-1 justify-end">
      <div class="flex w-52 shrink-0 justify-end">
        <button
          class="grid size-8 place-items-center rounded-sm text-lg text-white/90 transition hover:bg-white/15"
          type="button"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="emit('toggle-theme')"
        >
          <span aria-hidden="true">{{ isDark ? '☀' : '☾' }}</span>
        </button>
      </div>
    </div>
  </header>
</template>
