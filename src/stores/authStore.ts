import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { auth } from '@/firebase'
import { isMockAuthEnabled, isUnauthenticatedTestMode, MOCK_USER_ID } from '@/devMode'
import { useListStore } from '@/stores/listStore'
import { useTaskStore } from '@/stores/taskStore'
import { usePushNotifications } from '@/composables/usePushNotifications'
import { markFeatureOverviewPending } from '@/utils/featureOverview'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
  type UserCredential,
} from 'firebase/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(true)
  const isNewAccount = ref(false)
  let initialization: Promise<void> | null = null
  let previousUserId: string | null = null

  const isAuthenticated = computed(() => user.value !== null)

  const initAuth = (): Promise<void> => {
    if (initialization) return initialization

    if (isUnauthenticatedTestMode) {
      user.value = null
      previousUserId = null
      loading.value = false
      initialization = Promise.resolve()
      return initialization
    }

    if (isMockAuthEnabled) {
      user.value = { uid: MOCK_USER_ID, email: 'local@example.test', displayName: 'Lokal användare' } as User
      previousUserId = MOCK_USER_ID
      loading.value = false
      initialization = Promise.resolve()
      return initialization
    }

    initialization = new Promise<void>((resolve) => {
      onAuthStateChanged(auth, (currentUser) => {
        if (previousUserId !== null && previousUserId !== currentUser?.uid) {
          clearUserData()
        }
        if (!currentUser) isNewAccount.value = false
        user.value = currentUser
        previousUserId = currentUser?.uid ?? null
        loading.value = false
        resolve()
      })
    })

    return initialization
  }

  const trackNewAccount = (credential: UserCredential) => {
    isNewAccount.value = getAdditionalUserInfo(credential)?.isNewUser ?? false
    if (isNewAccount.value) markFeatureOverviewPending(credential.user.uid)
    return credential
  }

  const loginWithEmail = async (email: string, password: string) =>
    trackNewAccount(await signInWithEmailAndPassword(auth, email.trim(), password))

  const registerWithEmail = async (email: string, password: string) =>
    trackNewAccount(await createUserWithEmailAndPassword(auth, email.trim(), password))

  const loginWithGoogle = async () =>
    trackNewAccount(await signInWithPopup(auth, new GoogleAuthProvider()))

  const clearUserData = () => {
    useListStore().clearState()
    useTaskStore().clearState()
  }

  const logout = async () => {
    clearUserData()
    isNewAccount.value = false
    if (!isMockAuthEnabled) {
      await usePushNotifications().disablePush()
      await signOut(auth)
    }
  }

  const updateDisplayName = async (displayName: string) => {
    if (!auth.currentUser || isMockAuthEnabled) {
      if (user.value) user.value = { ...user.value, displayName }
      return
    }

    await updateProfile(auth.currentUser, { displayName })
    user.value = { ...auth.currentUser }
  }

  return {
    user,
    loading,
    isAuthenticated,
    isNewAccount,
    initAuth,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    logout,
    updateDisplayName,
  }
})
