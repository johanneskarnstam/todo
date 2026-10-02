import { initializeApp } from 'firebase/app'
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from 'firebase/app-check'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'mock-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'localhost',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'todo-app',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'todo-app.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:mock-app-id',
}

export const app = initializeApp(firebaseConfig)

const appCheckSiteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY
const initializeFirebaseAppCheck = () => {
  if (
    import.meta.env.MODE === 'test' ||
    (import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_BYPASS === 'true')
  ) {
    return null
  }

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    window.FIREBASE_APPCHECK_DEBUG_TOKEN = true
  }

  if (import.meta.env.DEV || appCheckSiteKey) {
    return initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey ?? ''),
      isTokenAutoRefreshEnabled: true,
    })
  }

  console.warn('Firebase App Check is not initialized because its production site key is missing.')
  return null
}

export const appCheck = initializeFirebaseAppCheck()
export const auth = getAuth(app)

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})
