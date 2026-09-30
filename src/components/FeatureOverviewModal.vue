<script setup lang="ts">
import { X } from '@lucide/vue'

const emit = defineEmits<{ (event: 'close'): void }>()

const featureGroups = [
  {
    title: 'Listor och planering',
    features: [
      'Skapa, byt namn på, flytta och ta bort listor och mappar.',
      'Växla mellan Min dag, Stjärnmärkt, Planerat och Alla listor.',
      'Gruppera listor i mappar och anpassa färg, sortering och arbetsflöde per lista.',
      'Sök bland uppgifter och filtrera med taggar.',
    ],
  },
  {
    title: 'Uppgifter',
    features: [
      'Skapa, redigera, slutföra, stjärnmarkera och sortera uppgifter.',
      'Välj Att göra, Pågående eller Klart där listans arbetsflöde stöder det.',
      'Lägg till anteckningar, taggar och delsteg; ändra ordning på delsteg.',
      'Planera med förfallodatum, tid, snabbval och påminnelser.',
      'Skapa kalenderutkast i Google Kalender från uppgiftsdetaljer.',
    ],
  },
  {
    title: 'Inställningar och data',
    features: [
      'Välj ljust, mörkt eller systemstyrt tema och hantera aviseringar.',
      'Importera uppgifter från JSON och exportera dina listor och uppgifter.',
      'Synka data manuellt, arbeta med lokal cache offline och rensa lokala data.',
      'Ändra visningsnamn och hantera konto och utloggning.',
    ],
  },
]
</script>

<template>
  <div class="fixed inset-0 z-[110] grid place-items-center bg-slate-950/45 px-4 py-6" role="presentation" @click.self="emit('close')">
    <section class="flex max-h-[min(720px,calc(100vh-3rem))] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="feature-overview-title">
      <header class="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700 sm:px-6">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-[#2564cf] dark:text-blue-400">To Do · översikt</p>
          <h2 id="feature-overview-title" class="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Appens funktioner</h2>
        </div>
        <button class="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800" type="button" aria-label="Stäng funktionsöversikten" @click="emit('close')">
          <X :size="20" aria-hidden="true" />
        </button>
      </header>

      <div class="min-h-0 flex-1 divide-y divide-slate-200 overflow-y-auto px-5 dark:divide-slate-700 sm:px-6">
        <section v-for="group in featureGroups" :key="group.title" class="py-4" :aria-labelledby="`feature-group-${group.title}`">
          <h3 :id="`feature-group-${group.title}`" class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ group.title }}</h3>
          <ul class="mt-2 space-y-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
            <li v-for="feature in group.features" :key="feature" class="flex gap-2.5">
              <span class="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
              <span>{{ feature }}</span>
            </li>
          </ul>
        </section>
      </div>
    </section>
  </div>
</template>