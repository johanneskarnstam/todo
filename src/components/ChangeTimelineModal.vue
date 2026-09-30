<script setup lang="ts">
import { X } from '@lucide/vue'
import type { ReleaseNote } from '@/releaseNotes'

interface Props {
  releases: ReleaseNote[]
}

const props = defineProps<Props>()
const emit = defineEmits<{ (event: 'close'): void }>()
</script>

<template>
  <div class="fixed inset-0 z-[110] grid place-items-center bg-slate-950/45 px-4 py-6" role="presentation" @click.self="emit('close')">
    <section class="flex max-h-[min(720px,calc(100vh-3rem))] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="change-timeline-title">
      <header class="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700 sm:px-6">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-[#2564cf] dark:text-blue-400">To Do · ändringslogg</p>
          <h2 id="change-timeline-title" class="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Förändringar över tid</h2>
        </div>
        <button class="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800" type="button" aria-label="Stäng ändringshistoriken" @click="emit('close')">
          <X :size="20" aria-hidden="true" />
        </button>
      </header>

      <ol class="min-h-0 flex-1 space-y-0 overflow-y-auto px-5 py-5 sm:px-6">
        <li v-for="(release, index) in props.releases" :key="release.version" class="relative pb-7 pl-8 last:pb-0">
          <span class="absolute bottom-0 left-[7px] top-2 w-px bg-slate-200 dark:bg-slate-700" :class="{ 'hidden': index === props.releases.length - 1 }" aria-hidden="true" />
          <span class="absolute left-0 top-1.5 size-4 rounded-full border-[3px] border-[#2564cf] bg-white dark:border-blue-400 dark:bg-slate-900" aria-hidden="true" />
          <article>
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ release.title }}</h3>
              <span class="text-xs font-medium text-[#2564cf] dark:text-blue-300">v{{ release.version }}</span>
              <time class="text-xs text-slate-500 dark:text-slate-400" :datetime="release.date">{{ release.date }}</time>
            </div>
            <p class="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{{ release.summary }}</p>
            <ul class="mt-2 space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
              <li v-for="item in release.items" :key="item" class="flex gap-2">
                <span class="mt-2 size-1.5 shrink-0 rounded-full bg-[#2564cf] dark:bg-blue-400" aria-hidden="true" />
                <span>{{ item }}</span>
              </li>
            </ul>
          </article>
        </li>
      </ol>
    </section>
  </div>
</template>