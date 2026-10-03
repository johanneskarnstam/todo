import { ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

const isUpdatingApp = ref(false)
const updateError = ref<string | null>(null)

// Register SW – autoUpdate mode; SW skips waiting on install,
// so updates take effect on next page load automatically.
registerSW({ immediate: true })

const forceUpdateApp = async () => {
  isUpdatingApp.value = true
  updateError.value = null

  try {
    const cacheNames = await window.caches.keys()
    await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)))

    const registration = 'serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
      : undefined

    if (registration) {
      await registration.update()

      const installingWorker = registration.installing
      if (installingWorker) {
        await new Promise<void>((resolve) => {
          const handleStateChange = () => {
            if (['installed', 'activated', 'redundant'].includes(installingWorker.state)) {
              installingWorker.removeEventListener('statechange', handleStateChange)
              resolve()
            }
          }

          installingWorker.addEventListener('statechange', handleStateChange)
          handleStateChange()
        })
      }
    }

    window.location.reload()
  } catch {
    updateError.value = 'Det gick inte att rensa cache eller kontrollera den senaste versionen. Försök igen.'
    isUpdatingApp.value = false
  }
}

export const useAppUpdate = () => ({
  isUpdatingApp,
  updateError,
  forceUpdateApp,
})