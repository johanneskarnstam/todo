<script setup lang="ts">
import { useToastStore } from '@/stores/toastStore'

const toastStore = useToastStore()
</script>

<template>
  <div class="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:left-auto sm:w-96" aria-live="polite" aria-atomic="true">
    <div
      v-for="toast in toastStore.toasts"
      :key="toast.id"
      class="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700 shadow-lg dark:border-red-900 dark:bg-slate-900 dark:text-red-300"
      role="alert"
    >
      <span class="min-w-0 flex-1">{{ toast.message }}</span>
      <button v-if="toast.action && toast.actionLabel" class="shrink-0 font-semibold text-red-600 hover:text-red-800 dark:text-red-300 dark:hover:text-red-100" type="button" @click="toast.action(); toastStore.dismiss(toast.id)">{{ toast.actionLabel }}</button>
      <button class="shrink-0 text-lg leading-none text-red-500 hover:text-red-700" type="button" aria-label="Stäng meddelande" @click="toastStore.dismiss(toast.id)">×</button>
    </div>
  </div>
</template>
