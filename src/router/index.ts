import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { safeRedirectPath } from '@/utils/authRedirect'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/all-lists',
      name: 'all-lists',
      component: () => import('../views/AllListsView.vue'),
    },
    {
      path: '/lists/:listId',
      name: 'list',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/tasks/:taskId',
      name: 'task',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/my-day',
      name: 'my-day',
      component: () => import('../views/HomeView.vue'),
      meta: { smartView: 'myDay' },
    },
    {
      path: '/important',
      name: 'important',
      component: () => import('../views/HomeView.vue'),
      meta: { smartView: 'important' },
    },
    {
      path: '/planned',
      name: 'planned',
      component: () => import('../views/HomeView.vue'),
      meta: { smartView: 'planned' },
    },
    {
      path: '/archived',
      name: 'archived',
      component: () => import('../views/HomeView.vue'),
      meta: { smartView: 'archived' },
    },
    {
      path: '/tag/:tag',
      name: 'tag',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('../views/SearchView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
    },
    {
      path: '/lists/:listId/settings',
      name: 'list-settings',
      component: () => import('../views/ListSettingsView.vue'),
    },
  ],
})

// Navigation Guard
router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  // Wait for auth to init if not already
  if (authStore.loading) {
    await authStore.initAuth()
  }

  const isPublic = to.name === 'login' || to.name === 'register'
  const isAuthenticated = authStore.isAuthenticated

  if (!isPublic && !isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }
  if (isPublic && isAuthenticated) return safeRedirectPath(to.query.redirect)
  return true
})

export default router
