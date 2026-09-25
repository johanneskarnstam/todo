import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

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
  ],
})

// Navigation Guard
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // Wait for auth to init if not already
  if (authStore.loading) {
    await authStore.initAuth()
  }

  const isPublic = to.name === 'login' || to.name === 'register'
  const isAuthenticated = authStore.isAuthenticated

  if (!isPublic && !isAuthenticated) {
    next('/login')
  } else if (isPublic && isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

export default router
