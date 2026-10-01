<script setup lang="ts">
interface ToggleSwitchProps {
  id?: string
  checked: boolean
  disabled?: boolean
  ariaLabel?: string
}

const props = defineProps<ToggleSwitchProps>()
const emit = defineEmits<{ change: [checked: boolean] }>()

const handleChange = (event: Event) => {
  emit('change', (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <span class="inline-flex shrink-0 items-center">
    <input
      :id="props.id"
      class="peer sr-only"
      type="checkbox"
      :checked="props.checked"
      :disabled="props.disabled"
      :aria-label="props.ariaLabel"
      @change="handleChange"
    />
    <span
      aria-hidden="true"
      class="relative h-5 w-9 rounded-full bg-slate-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:size-4 after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:bg-[#2564cf] peer-checked:after:translate-x-4 peer-focus-visible:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-blue-200 dark:bg-slate-600 dark:peer-checked:bg-blue-400 dark:peer-focus-visible:ring-blue-900 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
    />
  </span>
</template>
