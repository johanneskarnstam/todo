<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterView } from 'vue-router'
import ToastHost from '@/components/ToastHost.vue'
import WhatsNewModal from '@/components/WhatsNewModal.vue'
import { getUnseenReleaseNotes, markReleaseNotesSeen, type ReleaseNote } from '@/releaseNotes'
import { useAuthStore } from '@/stores/authStore'

const authStore = useAuthStore()
const unseenReleases = ref<ReleaseNote[]>([])
const isWhatsNewOpen = ref(false)

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
</script>

<template>
  <RouterView />
  <ToastHost />
  <WhatsNewModal v-if="isWhatsNewOpen" :releases="unseenReleases" @close="closeWhatsNew" />
</template>
