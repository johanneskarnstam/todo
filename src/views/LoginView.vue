<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const handleLogin = async () => {
  try {
    await authStore.loginWithGoogle()
    router.push('/')
  } catch (error) {
    console.error('Login failed:', error)
  }
}
</script>

<template>
  <main class="center-content">
    <div class="glass-container">
      <h1>Boilerplate App</h1>
      <p>
        This is a minimal boilerplate application using Vue 3 and Firebase Authentication. It
        contains no complex UI frameworks, just clean CSS and functional structure.
      </p>

      <ul>
        <li><strong>Vue 3</strong> (Composition API)</li>
        <li><strong>Vite</strong> (Build Tool)</li>
        <li><strong>Pinia</strong> (State Management)</li>
        <li><strong>Firebase</strong> (Auth & Hosting)</li>
      </ul>

      <button @click="handleLogin" class="btn btn-primary">Sign in with Google</button>
    </div>
  </main>
</template>
