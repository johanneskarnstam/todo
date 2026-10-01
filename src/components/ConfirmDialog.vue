<script setup lang="ts">
import { onMounted, ref } from 'vue'

interface Props {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  cancelLabel: 'Avbryt',
  destructive: false,
})

const emit = defineEmits<{
  (event: 'confirm'): void
  (event: 'cancel'): void
}>()

const confirmButton = ref<HTMLButtonElement | null>(null)

onMounted(() => confirmButton.value?.focus())
</script>

<template>
  <div class="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 px-4 py-6" role="presentation" @click.self="emit('cancel')">
    <section class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message" @keydown.esc.stop.prevent="emit('cancel')">
      <h2 id="confirm-dialog-title" class="text-lg font-semibold text-slate-800 dark:text-slate-100">{{ props.title }}</h2>
      <p id="confirm-dialog-message" class="mt-2 text-sm text-slate-600 dark:text-slate-300">{{ props.message }}</p>
      <div class="mt-6 flex justify-end gap-3">
        <button class="min-h-10 rounded-lg px-4 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" type="button" @click="emit('cancel')">
          {{ props.cancelLabel }}
        </button>
        <button
          ref="confirmButton"
          class="min-h-10 rounded-lg px-4 text-sm font-medium text-white"
          :class="props.destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-[#2564cf] hover:bg-blue-700'"
          type="button"
          @click="emit('confirm')"
        >
          {{ props.confirmLabel }}
        </button>
      </div>
    </section>
  </div>
</template>
