<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterView } from 'vue-router'
import ToastHost from '@/components/ToastHost.vue'
import FeatureOverviewModal from '@/components/FeatureOverviewModal.vue'
import WhatsNewModal from '@/components/WhatsNewModal.vue'
import { getUnseenReleaseNotes, markReleaseNotesSeen, type ReleaseNote } from '@/releaseNotes'
import { hasPendingFeatureOverview, markFeatureOverviewComplete } from '@/utils/featureOverview'
import { useAuthStore } from '@/stores/authStore'
import { useListStore } from '@/stores/listStore'
import { useTaskStore } from '@/stores/taskStore'
import { useNetworkStatus } from '@/composables/useNetworkStatus'
import { useAppUpdate } from '@/composables/useAppUpdate'

const authStore = useAuthStore()
const listStore = useListStore()
const taskStore = useTaskStore()
const { isOnline } = useNetworkStatus()
const { isUpdateAvailable, isUpdatePromptDismissed, isUpdatingApp, updateError, forceUpdateApp } = useAppUpdate()
const unseenReleases = ref<ReleaseNote[]>([])
const isWhatsNewOpen = ref(false)
const isFeatureOverviewOpen = ref(false)

const refreshAfterReconnect = async () => {
  if (!authStore.isAuthenticated) return

  await listStore.fetchLists()
  await taskStore.fetchTasks()
}

watch(
  () => [authStore.user?.uid, authStore.isNewAccount] as const,
  ([userId]) => {
    if (!userId) {
      unseenReleases.value = []
      isWhatsNewOpen.value = false
      isFeatureOverviewOpen.value = false
      return
    }

    isFeatureOverviewOpen.value = hasPendingFeatureOverview(userId)
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
  isUpdatePromptDismissed.value = true
}

const closeFeatureOverview = () => {
  const userId = authStore.user?.uid
  if (userId) markFeatureOverviewComplete(userId)
  isFeatureOverviewOpen.value = false
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
  <FeatureOverviewModal v-if="isFeatureOverviewOpen" @close="closeFeatureOverview" />
  <WhatsNewModal
    v-if="!isFeatureOverviewOpen && (isWhatsNewOpen || (isUpdateAvailable && !isUpdatePromptDismissed))"
    :releases="unseenReleases"
    :update-available="isUpdateAvailable"
    :is-updating="isUpdatingApp"
    :update-error="updateError"
    @close="closeWhatsNew"
    @update="forceUpdateApp"
  />
</template>
