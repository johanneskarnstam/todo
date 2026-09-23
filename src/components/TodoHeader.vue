<script setup lang="ts">
interface Props {
  isDark: boolean
}

interface Emits {
  (event: 'toggle-menu'): void
  (event: 'toggle-theme'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<template>
  <header class="flex h-14 shrink-0 items-center bg-[#2564cf] px-3 text-white shadow-sm sm:px-4">
    <div class="flex w-52 shrink-0 items-center gap-3">
      <button
        class="grid size-8 place-items-center rounded-sm text-white/90 transition hover:bg-white/15 lg:hidden"
        type="button"
        aria-label="Open navigation menu"
        @click="emit('toggle-menu')"
      >
        <span class="text-xl leading-none">☰</span>
      </button>
      <span class="hidden text-lg font-semibold tracking-tight sm:inline">To Do</span>
    </div>

    <label class="relative mx-auto flex w-full max-w-xl items-center">
      <span class="sr-only">Search tasks</span>
      <span class="pointer-events-none absolute left-3 text-[#2564cf]" aria-hidden="true">⌕</span>
      <input
        class="h-9 w-full rounded border-0 bg-white px-10 text-sm text-slate-700 outline-none ring-2 ring-transparent transition placeholder:text-slate-400 focus:ring-white/70"
        type="search"
        placeholder="Search"
      />
    </label>

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
  </header>
</template>
