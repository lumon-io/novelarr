<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100">
    <div class="bg-white p-8 rounded-lg shadow-md w-96">
      <h2 class="text-2xl font-bold mb-6 text-center">
        {{ isRegistering ? 'Register' : 'Login' }}
      </h2>
      
      <form @submit.prevent="handleSubmit">
        <div class="mb-4">
          <label class="block text-gray-700 text-sm font-bold mb-2">
            Username
          </label>
          <input
            v-model="username"
            type="text"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
        </div>
        
        <div class="mb-6">
          <label class="block text-gray-700 text-sm font-bold mb-2">
            Password
          </label>
          <input
            v-model="password"
            type="password"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
        </div>
        
        <div v-if="error" class="mb-4 text-red-500 text-sm">
          {{ error }}
        </div>
        
        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {{ loading ? 'Please wait...' : (isRegistering ? 'Register' : 'Login') }}
        </button>
      </form>
      
      <p class="mt-4 text-center text-sm">
        {{ isRegistering ? 'Already have an account?' : "Don't have an account?" }}
        <button
          @click="isRegistering = !isRegistering"
          class="text-blue-500 hover:underline"
        >
          {{ isRegistering ? 'Login' : 'Register' }}
        </button>
      </p>
      
      <p class="mt-4 text-center text-xs text-gray-500">
        Default: admin / admin
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const username = ref('')
const password = ref('')
const isRegistering = ref(false)
const loading = ref(false)
const error = ref('')

const handleSubmit = async () => {
  error.value = ''
  loading.value = true
  
  try {
    if (isRegistering.value) {
      await authStore.register(username.value, password.value)
    } else {
      await authStore.login(username.value, password.value)
    }
    router.push('/search')
  } catch (err) {
    error.value = err.response?.data?.error || 'An error occurred'
  } finally {
    loading.value = false
  }
}
</script>