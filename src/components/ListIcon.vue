<script setup lang="ts">
import { BriefcaseBusiness, CalendarDays, CircleCheck, Folder, Heart, ListTodo, Star, UserRound } from '@lucide/vue'
import { computed } from 'vue'

const icons = {
  list: ListTodo,
  briefcase: BriefcaseBusiness,
  calendar: CalendarDays,
  check: CircleCheck,
  folder: Folder,
  heart: Heart,
  star: Star,
  person: UserRound,
} as const

type ListIconName = keyof typeof icons

const props = withDefaults(defineProps<{ name?: string; size?: number }>(), {
  name: 'list',
  size: 18,
})

const icon = computed(() => icons[props.name as ListIconName] ?? ListTodo)
</script>

<template>
  <component :is="icon" :size="props.size" :stroke-width="1.8" aria-hidden="true" />
</template>
