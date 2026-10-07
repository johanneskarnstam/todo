<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Bell, Calendar, Clock } from '@lucide/vue'
import type { AbsoluteReminder, RelativeReminder, ReminderOffset, TaskReminder } from '@/types'

const props = defineProps<{
  modelValue?: TaskReminder | null
  dueDate?: string
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: TaskReminder): void
  (event: 'cancel'): void
}>()

const hasDueDate = computed(() => Boolean(props.dueDate && props.dueDate.trim().length > 0))

const initialMode = computed<'relative' | 'absolute'>(() => {
  if (props.modelValue) {
    if (props.modelValue.mode === 'relative' && !hasDueDate.value) return 'absolute'
    return props.modelValue.mode
  }
  return hasDueDate.value ? 'relative' : 'absolute'
})

const mode = ref<'relative' | 'absolute'>(initialMode.value)

watch(
  hasDueDate,
  (canBeRelative) => {
    if (!canBeRelative && mode.value === 'relative') {
      mode.value = 'absolute'
    }
  },
)

const relativeOptions: { value: ReminderOffset; label: string }[] = [
  { value: 0, label: 'Vid förfallotid' },
  { value: 10, label: '10 minuter före' },
  { value: 60, label: '1 timme före' },
  { value: 120, label: '2 timmar före' },
  { value: 1440, label: '1 dag före' },
]

const selectedOffset = ref<ReminderOffset>(
  props.modelValue?.mode === 'relative'
    ? (props.modelValue.offsetMinutes as ReminderOffset)
    : 10,
)

const defaultDateStr = computed(() => {
  if (props.modelValue?.mode === 'absolute' && props.modelValue.at) {
    return props.modelValue.at.slice(0, 10)
  }
  // Default to tomorrow
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return tomorrow.toISOString().slice(0, 10)
})

const defaultTimeStr = computed(() => {
  if (props.modelValue?.mode === 'absolute' && props.modelValue.at && props.modelValue.at.length >= 16) {
    return props.modelValue.at.slice(11, 16)
  }
  return '09:00'
})

const absoluteDate = ref(defaultDateStr.value)
const absoluteTime = ref(defaultTimeStr.value)
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Stockholm'

const isAbsoluteValid = computed(() => {
  if (!absoluteDate.value || !absoluteTime.value) return false
  const isoCandidate = `${absoluteDate.value}T${absoluteTime.value}`
  const parsed = Date.parse(isoCandidate)
  if (Number.isNaN(parsed)) return false
  return parsed > Date.now()
})

const isValid = computed(() => {
  if (mode.value === 'relative') {
    return hasDueDate.value
  }
  return isAbsoluteValid.value
})

const handleSave = () => {
  if (!isValid.value) return

  if (mode.value === 'relative') {
    const reminder: RelativeReminder = {
      mode: 'relative',
      offsetMinutes: selectedOffset.value,
    }
    emit('update:modelValue', reminder)
    return
  }

  const reminder: AbsoluteReminder = {
    mode: 'absolute',
    at: `${absoluteDate.value}T${absoluteTime.value}`,
    timeZone,
  }
  emit('update:modelValue', reminder)
}
</script>

<template>
  <div
    class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/80"
    data-testid="reminder-editor"
  >
    <div class="flex items-center justify-between">
      <span class="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
        <Bell :size="16" class="text-[#2564cf] dark:text-blue-400" aria-hidden="true" />
        Ny påminnelse
      </span>
      <span v-if="!hasDueDate" class="text-xs text-slate-500 dark:text-slate-400">
        Ingen deadline – absolut tidpunkt
      </span>
    </div>

    <!-- Mode switch -->
    <div v-if="hasDueDate" class="grid grid-cols-2 rounded-lg bg-slate-200 p-0.5 dark:bg-slate-700" role="tablist">
      <button
        type="button"
        role="tab"
        :aria-selected="mode === 'relative'"
        class="rounded-md py-1 text-xs font-medium transition"
        :class="mode === 'relative' ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'"
        @click="mode = 'relative'"
      >
        Relativ till deadline
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="mode === 'absolute'"
        class="rounded-md py-1 text-xs font-medium transition"
        :class="mode === 'absolute' ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'"
        @click="mode = 'absolute'"
      >
        Fast tidpunkt
      </button>
    </div>

    <!-- Relative controls -->
    <div v-if="mode === 'relative'" class="flex flex-col gap-1.5">
      <label for="relative-reminder-offset" class="text-xs text-slate-600 dark:text-slate-300">
        När ska du påminnas?
      </label>
      <select
        id="relative-reminder-offset"
        v-model="selectedOffset"
        class="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-[#2564cf] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      >
        <option v-for="opt in relativeOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <!-- Absolute controls -->
    <div v-else class="flex flex-col gap-2">
      <div class="grid grid-cols-2 gap-2">
        <div class="flex flex-col gap-1">
          <label for="reminder-date" class="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
            <Calendar :size="13" class="text-slate-400" aria-hidden="true" />
            Datum
          </label>
          <input
            id="reminder-date"
            v-model="absoluteDate"
            type="date"
            aria-label="Påminnelsedatum"
            class="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-[#2564cf] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label for="reminder-time" class="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
            <Clock :size="13" class="text-slate-400" aria-hidden="true" />
            Tid
          </label>
          <input
            id="reminder-time"
            v-model="absoluteTime"
            type="time"
            aria-label="Påminnelsetid"
            class="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-[#2564cf] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>
      <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>Tidszon: {{ timeZone }}</span>
        <span v-if="!isAbsoluteValid && absoluteDate && absoluteTime" class="text-red-500">
          Måste vara i framtiden
        </span>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="flex items-center justify-end gap-2 pt-1">
      <button
        type="button"
        class="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        @click="emit('cancel')"
      >
        Avbryt
      </button>
      <button
        type="button"
        :disabled="!isValid"
        class="rounded-md bg-[#2564cf] px-3 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-[#1b4fa0] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
        @click="handleSave"
      >
        Spara påminnelse
      </button>
    </div>
  </div>
</template>
