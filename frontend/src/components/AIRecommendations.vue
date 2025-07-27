<template>
  <div class="bg-white rounded-lg shadow">
    <div class="p-6 border-b">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold text-gray-900">AI Recommendations</h2>
        <button
          @click="refreshRecommendations"
          :disabled="loading"
          class="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          <svg class="w-4 h-4 inline mr-1" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
      <p class="mt-2 text-sm text-gray-600">
        Personalized book recommendations based on your reading history
      </p>
    </div>

    <div v-if="!hasGoodreads" class="p-8 text-center">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">Connect Goodreads to Get Started</h3>
      <p class="mt-1 text-sm text-gray-500">
        AI recommendations require your reading history from Goodreads.
      </p>
      <router-link
        to="/settings"
        class="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
      >
        Go to Settings
      </router-link>
    </div>

    <div v-else-if="loading && !recommendations.length" class="p-8">
      <div class="flex justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
      <p class="mt-4 text-center text-sm text-gray-500">Analyzing your reading preferences...</p>
    </div>

    <div v-else-if="error" class="p-8 text-center">
      <div class="text-red-600 mb-4">
        <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p class="text-sm text-gray-900">{{ error }}</p>
      <button
        @click="fetchRecommendations"
        class="mt-4 text-sm text-blue-600 hover:text-blue-800"
      >
        Try Again
      </button>
    </div>

    <div v-else-if="recommendations.length > 0" class="divide-y">
      <div
        v-for="book in recommendations"
        :key="book.goodreadsId || book.title"
        class="p-6 hover:bg-gray-50 transition-colors"
      >
        <div class="flex space-x-4">
          <img
            :src="book.coverUrl || '/placeholder.jpg'"
            :alt="book.title"
            class="h-32 w-24 object-cover rounded"
          >
          <div class="flex-1">
            <div class="flex items-start justify-between">
              <div>
                <h3 class="text-lg font-medium text-gray-900">{{ book.title }}</h3>
                <p class="text-sm text-gray-600">by {{ book.author }}</p>
                <p v-if="book.publicationYear" class="text-xs text-gray-500 mt-1">
                  Published {{ book.publicationYear }}
                </p>
              </div>
              <div class="flex items-center space-x-1">
                <span class="text-sm font-medium text-gray-900">{{ (book.score * 100).toFixed(0) }}%</span>
                <span class="text-xs text-gray-500">match</span>
              </div>
            </div>
            
            <p class="mt-2 text-sm text-gray-700 line-clamp-2">{{ book.description }}</p>
            
            <div class="mt-2 p-3 bg-blue-50 rounded">
              <p class="text-sm text-blue-800">
                <svg class="w-4 h-4 inline mr-1 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {{ book.reasoning }}
              </p>
            </div>

            <div class="mt-3 flex items-center space-x-3">
              <button
                @click="requestBook(book)"
                class="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Request Book
              </button>
              <router-link
                :to="`/search?q=${encodeURIComponent(book.title + ' ' + book.author)}`"
                class="text-sm text-gray-600 hover:text-gray-900"
              >
                Search Library
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <div class="p-4 text-center">
        <button
          @click="loadMore"
          :disabled="loading"
          class="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          Load More Recommendations
        </button>
      </div>
    </div>

    <div v-else class="p-8 text-center text-gray-500">
      <p>No recommendations available yet.</p>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import axios from 'axios'

export default {
  name: 'AIRecommendations',
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    const recommendations = ref([])
    const loading = ref(false)
    const error = ref('')
    const hasGoodreads = ref(false)
    const limit = ref(10)

    const checkGoodreadsStatus = async () => {
      try {
        const response = await axios.get('/api/goodreads/status', {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        hasGoodreads.value = response.data.connected
      } catch (err) {
        console.error('Failed to check Goodreads status:', err)
      }
    }

    const fetchRecommendations = async (refresh = false) => {
      if (!hasGoodreads.value) return

      try {
        loading.value = true
        error.value = ''
        
        const response = await axios.get('/api/recommendations', {
          params: { limit: limit.value, refresh },
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        
        recommendations.value = response.data
      } catch (err) {
        error.value = err.response?.data?.error || 'Failed to fetch recommendations'
      } finally {
        loading.value = false
      }
    }

    const refreshRecommendations = () => {
      fetchRecommendations(true)
    }

    const loadMore = () => {
      limit.value += 10
      fetchRecommendations()
    }

    const requestBook = async (book) => {
      try {
        await axios.post('/api/requests', {
          goodreadsId: book.goodreadsId,
          title: book.title,
          author: book.author,
          coverUrl: book.coverUrl
        }, {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        
        router.push('/requests')
      } catch (err) {
        console.error('Failed to request book:', err)
        alert('Failed to create request. Please try again.')
      }
    }

    onMounted(async () => {
      await checkGoodreadsStatus()
      if (hasGoodreads.value) {
        fetchRecommendations()
      }
    })

    return {
      recommendations,
      loading,
      error,
      hasGoodreads,
      fetchRecommendations,
      refreshRecommendations,
      loadMore,
      requestBook
    }
  }
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>