import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { doc, deleteDoc, setDoc } from 'firebase/firestore'
import { ref } from 'vue'
import { app, auth, db } from '@/firebase'
import { isMockAuthEnabled, isUnauthenticatedTestMode } from '@/devMode'

const deviceIdStorageKey = 'todo-push-device-id'

export type PushRegistrationStatus = 'inactive' | 'active' | 'unavailable' | 'denied' | 'error'

const getDeviceId = (): string => {
  const storedDeviceId = localStorage.getItem(deviceIdStorageKey)
  if (storedDeviceId) return storedDeviceId

  const deviceId = crypto.randomUUID()
  localStorage.setItem(deviceIdStorageKey, deviceId)
  return deviceId
}

const getAppServiceWorkerRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  const registrations = await navigator.serviceWorker.getRegistrations()
  return registrations.find((registration) => {
    const scopePath = new URL(registration.scope).pathname
    return scopePath.endsWith(import.meta.env.BASE_URL) && registration.active !== null
  }) ?? null
}

export const usePushNotifications = () => {
  const status = ref<PushRegistrationStatus>('inactive')

  const enablePush = async (): Promise<boolean> => {
    if (isMockAuthEnabled || isUnauthenticatedTestMode || !auth.currentUser) {
      status.value = 'unavailable'
      return false
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
    if (!vapidKey || typeof window === 'undefined' || !('Notification' in window)) {
      status.value = 'unavailable'
      return false
    }

    try {
      const supported = await isSupported()
      if (!supported) {
        status.value = 'unavailable'
        return false
      }

      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()
      if (permission !== 'granted') {
        status.value = 'denied'
        return false
      }

      const registration = await getAppServiceWorkerRegistration()
      if (!registration) {
        status.value = 'unavailable'
        return false
      }

      const messaging = getMessaging(app)
      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      })
      if (!token) {
        status.value = 'unavailable'
        return false
      }

      const deviceId = getDeviceId()
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'devices', deviceId), {
        userId: auth.currentUser.uid,
        token,
        enabled: true,
        updatedAt: new Date().toISOString(),
      }, { merge: true })
      status.value = 'active'
      return true
    } catch {
      status.value = 'error'
      return false
    }
  }

  const disablePush = async (): Promise<void> => {
    status.value = 'inactive'
    if (!auth.currentUser || typeof window === 'undefined') return

    try {
      const deviceId = localStorage.getItem(deviceIdStorageKey)
      if (deviceId) {
        await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'devices', deviceId))
      }

    } catch {
      status.value = 'error'
    }
  }

  return {status, enablePush, disablePush}
}
