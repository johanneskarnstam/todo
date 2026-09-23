import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { auth } from '@/firebase'
import { useListStore } from '@/stores/listStore'
import { useTaskStore } from '@/stores/taskStore'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(true)
  let initialization: Promise<void> | null = null
  let previousUserId: string | null = null

  const isAuthenticated = computed(() => user.value !== null)

  const initAuth = (): Promise<void> => {
    if (initialization) return initialization

    initialization = new Promise<void>((resolve) => {
      onAuthStateChanged(auth, (currentUser) => {
        if (previousUserId !== null && previousUserId !== currentUser?.uid) {
          clearUserData()
        }
        user.value = currentUser
        previousUserId = currentUser?.uid ?? null
        loading.value = false
        resolve()
      })
    })

    return initialization
  }

  const loginWithEmail = (email: string, password: string) =>
    signInWithEmailAndPassword(auth, email.trim(), password)

  const registerWithEmail = (email: string, password: string) =>
    createUserWithEmailAndPassword(auth, email.trim(), password)

  const loginWithGoogle = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider())
  }

  const clearUserData = () => {
    useListStore().clearState()
    useTaskStore().clearState()
  }

  const logout = async () => {
    clearUserData()
    await signOut(auth)
  }

  return {
    user,
    loading,
    isAuthenticated,
    initAuth,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    logout,
  }
})