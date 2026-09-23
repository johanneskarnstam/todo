<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const authStore = useAuthStore()
const router = useRouter()
const email = ref('')
const password = ref('')
const confirmation = ref('')
const isRegistering = ref(false)
const registerError = ref('')

const handleRegister = async () => {
  if (isRegistering.value) return

  if (password.value.length < 6) {
    registerError.value = 'Password must be at least 6 characters.'
    return
  }

  if (password.value !== confirmation.value) {
    registerError.value = 'Passwords do not match.'
    return
  }

  isRegistering.value = true
  registerError.value = ''
  try {
    await authStore.registerWithEmail(email.value, password.value)
    await router.push('/')
  } catch {
    registerError.value = 'This email could not be registered. Please try another one.'
  } finally {
    isRegistering.value = false
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-[#f4f7fb] px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
    <section class="w-full max-w-md rounded-2xl border border-white/80 bg-white/95 p-7 shadow-[0_24px_80px_rgba(15,46,88,0.14)] dark:border-slate-800 dark:bg-slate-900 sm:p-10" aria-labelledby="register-title">
      <div class="flex items-center gap-3">
        <span class="grid size-10 place-items-center rounded-xl bg-[#2564cf] text-lg font-bold text-white" aria-hidden="true">✓</span>
        <span class="text-lg font-semibold tracking-tight">Todo</span>
      </div>

      <p class="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-[#2564cf] dark:text-blue-400">Get started</p>
      <h1 id="register-title" class="mt-3 text-3xl font-semibold tracking-tight">Create your account</h1>
      <p class="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">Your lists and tasks stay private to your account.</p>

      <p v-if="registerError" class="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-5 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" role="alert">
        {{ registerError }}
      </p>

      <form class="mt-8 space-y-3" @submit.prevent="handleRegister">
        <label class="sr-only" for="register-email">Email</label>
        <input id="register-email" v-model="email" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm outline-none ring-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-800" type="email" autocomplete="email" placeholder="Email" required />
        <label class="sr-only" for="register-password">Password</label>
        <input id="register-password" v-model="password" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm outline-none ring-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-800" type="password" autocomplete="new-password" placeholder="Password" required />
        <label class="sr-only" for="register-confirmation">Confirm password</label>
        <input id="register-confirmation" v-model="confirmation" class="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm outline-none ring-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-800" type="password" autocomplete="new-password" placeholder="Confirm password" required />
        <button class="h-12 w-full rounded-lg bg-[#2564cf] px-4 text-sm font-semibold text-white transition hover:bg-[#1d56b5] disabled:cursor-wait disabled:opacity-60" type="submit" :disabled="isRegistering">
          {{ isRegistering ? 'Creating account...' : 'Create account' }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?
        <RouterLink class="font-semibold text-[#2564cf] hover:underline dark:text-blue-400" to="/login">Sign in</RouterLink>
      </p>
    </section>
  </main>
</template>
