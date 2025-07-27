<template>
  <div class="container mx-auto px-4 py-8">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Discover Your Next Read</h1>
      <p class="mt-2 text-gray-600">
        AI-powered book recommendations based on your Goodreads library
      </p>
    </div>

    <div class="grid lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2">
        <AIRecommendations />
      </div>

      <div class="space-y-6">
        <!-- Reading Stats -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Your Reading Profile</h3>
          
          <div v-if="stats.loading" class="space-y-3">
            <div class="h-4 bg-gray-200 rounded animate-pulse"></div>
            <div class="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
          </div>

          <div v-else-if="stats.data" class="space-y-4">
            <div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">Books Read</span>
                <span class="font-medium">{{ stats.data.total_books }}</span>
              </div>
            </div>
            
            <div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">Books Rated</span>
                <span class="font-medium">{{ stats.data.rated_books }}</span>
              </div>
            </div>

            <div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">Avg Rating Given</span>
                <span class="font-medium">{{ stats.data.avg_rating || 'N/A' }}</span>
              </div>
            </div>

            <div class="pt-4 border-t">
              <h4 class="text-sm font-medium text-gray-900 mb-2">Top Genres</h4>
              <div class="space-y-1">
                <div 
                  v-for="genre in stats.data.top_genres" 
                  :key="genre.name"
                  class="flex justify-between text-sm"
                >
                  <span class="text-gray-600">{{ genre.name }}</span>
                  <span class="text-gray-500">{{ genre.count }} books</span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="text-sm text-gray-500 text-center py-4">
            Connect Goodreads to see your reading stats
          </div>
        </div>

        <!-- Recommendation Settings -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Recommendation Settings</h3>
          
          <div class="space-y-4">
            <div>
              <label class="text-sm font-medium text-gray-700">Preferred Genres</label>
              <p class="text-xs text-gray-500 mt-1">AI will prioritize these genres</p>
              <div class="mt-2 flex flex-wrap gap-2">
                <span
                  v-for="genre in ['Fiction', 'Non-fiction', 'Mystery', 'Sci-Fi', 'Fantasy', 'Romance']"
                  :key="genre"
                  @click="toggleGenre(genre)"
                  :class="[
                    'px-3 py-1 rounded-full text-xs cursor-pointer transition-colors',
                    preferredGenres.includes(genre)
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  ]"
                >
                  {{ genre }}
                </span>
              </div>
            </div>

            <div>
              <label class="text-sm font-medium text-gray-700">Discovery Mode</label>
              <p class="text-xs text-gray-500 mt-1">How adventurous should recommendations be?</p>
              <div class="mt-2">
                <input
                  type="range"
                  v-model="discoveryLevel"
                  min="0"
                  max="100"
                  class="w-full"
                >
                <div class="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Safe picks</span>
                  <span>Hidden gems</span>
                </div>
              </div>
            </div>

            <button
              @click="saveSettings"
              class="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
            >
              Update Preferences
            </button>
          </div>
        </div>

        <!-- Export Options -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Export Recommendations</h3>
          <div class="space-y-3">
            <button
              @click="exportRecommendations('json')"
              class="w-full text-left px-4 py-2 border rounded hover:bg-gray-50 text-sm"
            >
              <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Download as JSON
            </button>
            <button
              @click="exportRecommendations('csv')"
              class="w-full text-left px-4 py-2 border rounded hover:bg-gray-50 text-sm"
            >
              <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Download as CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AIRecommendations from '@/components/AIRecommendations.vue'
import axios from 'axios'

export default {
  name: 'RecommendationsView',
  components: {
    AIRecommendations
  },
  setup() {
    const authStore = useAuthStore()
    const stats = ref({ loading: true, data: null })
    const preferredGenres = ref([])
    const discoveryLevel = ref(50)

    const fetchStats = async () => {
      try {
        // This would fetch actual stats from the API
        // For now, using mock data
        stats.value.data = {
          total_books: 147,
          rated_books: 89,
          avg_rating: 3.8,
          top_genres: [
            { name: 'Fiction', count: 45 },
            { name: 'Mystery', count: 23 },
            { name: 'Sci-Fi', count: 18 },
            { name: 'Non-fiction', count: 15 },
            { name: 'Fantasy', count: 12 }
          ]
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        stats.value.loading = false
      }
    }

    const toggleGenre = (genre) => {
      const index = preferredGenres.value.indexOf(genre)
      if (index > -1) {
        preferredGenres.value.splice(index, 1)
      } else {
        preferredGenres.value.push(genre)
      }
    }

    const saveSettings = async () => {
      // Save preference settings
      console.log('Saving preferences:', {
        genres: preferredGenres.value,
        discoveryLevel: discoveryLevel.value
      })
    }

    const exportRecommendations = async (format) => {
      try {
        const response = await axios.get('/api/recommendations/export', {
          params: { format },
          headers: { Authorization: `Bearer ${authStore.token}` },
          responseType: format === 'csv' ? 'text' : 'json'
        })

        const blob = new Blob(
          [format === 'csv' ? response.data : JSON.stringify(response.data, null, 2)],
          { type: format === 'csv' ? 'text/csv' : 'application/json' }
        )
        
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `novelarr-recommendations.${format}`
        a.click()
        window.URL.revokeObjectURL(url)
      } catch (err) {
        console.error('Failed to export recommendations:', err)
        alert('Failed to export recommendations')
      }
    }

    onMounted(() => {
      fetchStats()
    })

    return {
      stats,
      preferredGenres,
      discoveryLevel,
      toggleGenre,
      saveSettings,
      exportRecommendations
    }
  }
}
</script>