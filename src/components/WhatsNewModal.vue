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
  <Transition name="whats-new">
    <div v-if="props.releases.length" class="fixed inset-0 z-[110] grid place-items-center bg-slate-950/45 px-4 py-6" role="presentation">
      <section class="max-h-[min(720px,calc(100vh-3rem))] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="whats-new-title">
        <div class="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-700">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-[#2564cf] dark:text-blue-400">Nytt i To Do</p>
            <h2 id="whats-new-title" class="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Senaste förändringarna</h2>
          </div>
          <button class="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800" type="button" aria-label="Stäng senaste förändringarna" @click="emit('close')">
            <X :size="20" :stroke-width="1.8" aria-hidden="true" />
          </button>
        </div>

        <div class="space-y-6 px-6 py-5">
          <article v-for="release in props.releases" :key="release.version">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ release.title }}</h3>
              <span class="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-[#2564cf] dark:bg-blue-950/40 dark:text-blue-300">v{{ release.version }}</span>
              <time class="text-xs text-slate-500 dark:text-slate-400" :datetime="release.date">{{ release.date }}</time>
            </div>
            <p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{{ release.summary }}</p>
            <ul class="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <li v-for="item in release.items" :key="item" class="flex gap-2">
                <span class="mt-2 size-1.5 shrink-0 rounded-full bg-[#2564cf] dark:bg-blue-400" aria-hidden="true" />
                <span>{{ item }}</span>
              </li>
            </ul>
          </article>
        </div>

        <div class="flex justify-end border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <button class="min-h-10 rounded-lg bg-[#2564cf] px-4 text-sm font-semibold text-white transition hover:bg-blue-700" type="button" @click="emit('close')">Jag har sett detta</button>
        </div>
      </section>
    </div>
  </Transition>
</template>
