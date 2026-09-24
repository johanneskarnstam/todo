import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { User } from 'firebase/auth'
import { useAuthStore } from '@/stores/authStore'
import { useListStore } from '@/stores/listStore'
import { useTaskStore } from '@/stores/taskStore'

const authMocks = vi.hoisted(() => ({
  auth: { currentUser: null },
  createUserWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/firebase', () => ({
  auth: authMocks.auth,
  db: {},
}))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class GoogleAuthProvider {},
  createUserWithEmailAndPassword: authMocks.createUserWithEmailAndPassword,
  onAuthStateChanged: authMocks.onAuthStateChanged,
  signInWithEmailAndPassword: authMocks.signInWithEmailAndPassword,
  signInWithPopup: authMocks.signInWithPopup,
  signOut: authMocks.signOut,
}))

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    authMocks.auth.currentUser = null
    authMocks.signInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'user-1' } })
    authMocks.createUserWithEmailAndPassword.mockResolvedValue({ user: { uid: 'user-1' } })
    authMocks.signOut.mockResolvedValue(undefined)
    authMocks.onAuthStateChanged.mockImplementation(
      (_auth: unknown, callback: (user: User | null) => void) => {
        callback({ uid: 'user-1' } as User)
        return () => undefined
      },
    )
  })

  it('initializes authenticated state from Firebase', async () => {
    const store = useAuthStore()

    await store.initAuth()

    expect(store.user?.uid).toBe('user-1')
    expect(store.isAuthenticated).toBe(true)
    expect(store.loading).toBe(false)
  })

  it('initializes unauthenticated state when Firebase has no user', async () => {
    authMocks.onAuthStateChanged.mockImplementationOnce(
      (_auth: unknown, callback: (user: User | null) => void) => {
        callback(null)
        return () => undefined
      },
    )
    const store = useAuthStore()

    await store.initAuth()

    expect(store.user).toBeNull()
    expect(store.isAuthenticated).toBe(false)
    expect(store.loading).toBe(false)
  })

  it('supports trimmed email login and registration', async () => {
    const store = useAuthStore()

    await store.loginWithEmail(' user@example.com ', 'secret')
    await store.registerWithEmail(' new@example.com ', 'secret')

    expect(authMocks.signInWithEmailAndPassword).toHaveBeenCalledWith(
      authMocks.auth,
      'user@example.com',
      'secret',
    )
    expect(authMocks.createUserWithEmailAndPassword).toHaveBeenCalledWith(
      authMocks.auth,
      'new@example.com',
      'secret',
    )
  })

  it('propagates login and registration errors to the caller', async () => {
    authMocks.signInWithEmailAndPassword.mockRejectedValueOnce(new Error('login failed'))
    authMocks.createUserWithEmailAndPassword.mockRejectedValueOnce(new Error('register failed'))
    const store = useAuthStore()

    await expect(store.loginWithEmail('user@example.com', 'secret')).rejects.toThrow('login failed')
    await expect(store.registerWithEmail('new@example.com', 'secret')).rejects.toThrow('register failed')
  })

  it('clears app state when the authenticated user changes to null', async () => {
    let authCallback: ((user: User | null) => void) | undefined
    authMocks.onAuthStateChanged.mockImplementationOnce(
      (_auth: unknown, callback: (user: User | null) => void) => {
        authCallback = callback
        callback({ uid: 'user-1' } as User)
        return () => undefined
      },
    )
    const listStore = useListStore()
    const taskStore = useTaskStore()
    listStore.lists.push({ id: 'list-1', name: 'Work', order: 0, icon: 'list', createdAt: { toMillis: () => 1 } as never })
    taskStore.tasks.push({ id: 'task-1', listId: 'list-1', title: 'Task', completed: false, important: false, myDay: false, createdAt: { toMillis: () => 1 } as never })
    const store = useAuthStore()

    await store.initAuth()
    authCallback?.(null)

    expect(store.user).toBeNull()
    expect(listStore.lists).toEqual([])
    expect(taskStore.tasks).toEqual([])
  })

  it('clears list and task state before signing out', async () => {
    const listStore = useListStore()
    const taskStore = useTaskStore()
    listStore.lists.push({ id: 'list-1', name: 'Work', order: 0, icon: '☷', createdAt: { toMillis: () => 1 } as never })
    taskStore.tasks.push({
      id: 'task-1', listId: 'list-1', title: 'Task', completed: false, important: false,
      myDay: false, createdAt: { toMillis: () => 1 } as never,
    })

    await useAuthStore().logout()

    expect(listStore.lists).toEqual([])
    expect(taskStore.tasks).toEqual([])
    expect(authMocks.signOut).toHaveBeenCalledWith(authMocks.auth)
  })
})
