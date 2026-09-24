<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterView } from 'vue-router'
import ToastHost from '@/components/ToastHost.vue'
import WhatsNewModal from '@/components/WhatsNewModal.vue'
import { getUnseenReleaseNotes, markReleaseNotesSeen, type ReleaseNote } from '@/releaseNotes'
import { useAuthStore } from '@/stores/authStore'
import { useListStore } from '@/stores/listStore'
import { useTaskStore } from '@/stores/taskStore'
import { useNetworkStatus } from '@/composables/useNetworkStatus'

const authStore = useAuthStore()
const listStore = useListStore()
const taskStore = useTaskStore()
const { isOnline } = useNetworkStatus()
const unseenReleases = ref<ReleaseNote[]>([])
const isWhatsNewOpen = ref(false)

const refreshAfterReconnect = async () => {
  if (!authStore.isAuthenticated) return

  await listStore.fetchLists()
  await taskStore.fetchTasks()
}

watch(
  () => authStore.user?.uid,
  (userId) => {
    if (!userId) {
      unseenReleases.value = []
      isWhatsNewOpen.value = false
      return
    }

    unseenReleases.value = getUnseenReleaseNotes(userId)
    isWhatsNewOpen.value = unseenReleases.value.length > 0
  },
  { immediate: true },
)

const closeWhatsNew = () => {
  const userId = authStore.user?.uid
  const latestRelease = unseenReleases.value[0]
  if (userId && latestRelease) markReleaseNotesSeen(userId, latestRelease.version)
  unseenReleases.value = []
  isWhatsNewOpen.value = false
}

onMounted(() => window.addEventListener('online', refreshAfterReconnect))
onUnmounted(() => window.removeEventListener('online', refreshAfterReconnect))
</script>

<template>
  <div
    v-if="!isOnline"
    class="fixed inset-x-0 top-0 z-[100] border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950 shadow-sm dark:border-orange-700 dark:bg-orange-950 dark:text-orange-100"
    role="status"
    aria-live="polite"
  >
    Du är offline. Ändringar sparas lokalt och synkas när anslutningen är tillbaka.
  </div>
  <RouterView />
  <ToastHost />
  <WhatsNewModal v-if="isWhatsNewOpen" :releases="unseenReleases" @close="closeWhatsNew" />
</template>
