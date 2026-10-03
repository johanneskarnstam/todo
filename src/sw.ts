/// <reference lib="webworker" />

import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ revision: string | null; url: string }>
}

precacheAndRoute(self.__WB_MANIFEST)
clientsClaim()

self.addEventListener('install', () => {
  void self.skipWaiting()
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'mock-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'localhost',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'todo-app',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'todo-app.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:mock-app-id',
})

const messaging = getMessaging(firebaseApp)

onBackgroundMessage(messaging, (payload) => {
  const title = payload.data?.title ?? payload.notification?.title ?? 'Todo'
  const body = payload.data?.body ?? payload.notification?.body ?? payload.notification?.title
  const taskId = payload.data?.taskId

  void self.registration.showNotification(title, {
    body,
    tag: taskId ? `todo-task-${taskId}` : 'todo-reminder',
    data: { taskId },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const appUrl = new URL('/todo/#/', self.location.origin)
  const taskId = event.notification.data?.taskId
  if (taskId) appUrl.hash = `/?task=${encodeURIComponent(taskId)}`

  event.waitUntil((async () => {
    const openClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })
    const existingClient = openClients[0]
    if (existingClient) {
      await existingClient.focus()
      await existingClient.navigate(appUrl.href)
      return
    }

    await self.clients.openWindow(appUrl.href)
  })())
})
