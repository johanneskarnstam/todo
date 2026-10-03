<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import type { TaskPriorityFilterValue } from '@/types'
import type { TaskPriorityCounts } from '@/utils/taskPriority'

interface Props {
  modelValue: TaskPriorityFilterValue
  counts?: Partial<TaskPriorityCounts>
  total?: number
}

const props = defineProps<Props>()
const emit = defineEmits<{ (event: 'update:modelValue', value: TaskPriorityFilterValue): void }>()

const options: Array<{ value: TaskPriorityFilterValue; label: string }> = [
  { value: 'all', label: 'Alla' },
  { value: 'low', label: 'Låg' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Hög' },
  { value: 'urgent', label: 'Brådskande' },
]

const optionCount = (value: TaskPriorityFilterValue): number | undefined =>
  value === 'all' ? props.total : props.counts?.[value]

const updateFilter = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value as TaskPriorityFilterValue
  if (options.some((option) => option.value === value)) emit('update:modelValue', value)
}
</script>

<template>
  <label class="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
    <span>Prioritet</span>
    <span class="relative inline-flex items-center">
      <select
        class="min-h-9 max-w-52 appearance-none rounded-md border border-slate-200 bg-white py-1 pl-2.5 pr-8 text-sm text-slate-800 outline-none focus:border-[#2564cf] focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-900"
        aria-label="Filtrera uppgifter efter prioritet"
        :value="modelValue"
        @change="updateFilter"
      >
        <option v-for="option in options" :key="option.value" :value="option.value">
          {{ option.label }}<template v-if="optionCount(option.value) !== undefined"> ({{ optionCount(option.value) }})</template>
        </option>
      </select>
      <ChevronDown class="pointer-events-none absolute right-2.5 text-slate-500 dark:text-slate-400" :size="16" aria-hidden="true" />
    </span>
  </label>
</template>
