import { onMounted, onUnmounted, ref } from 'vue'

const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine)

const updateNetworkStatus = () => {
  isOnline.value = navigator.onLine
}

export const useNetworkStatus = () => {
  onMounted(() => {
    updateNetworkStatus()
    window.addEventListener('online', updateNetworkStatus)
    window.addEventListener('offline', updateNetworkStatus)
  })

  onUnmounted(() => {
    window.removeEventListener('online', updateNetworkStatus)
    window.removeEventListener('offline', updateNetworkStatus)
  })

  return { isOnline }
}

export const isBrowserOffline = () => typeof navigator !== 'undefined' && !navigator.onLine
