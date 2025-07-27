<template>
  <div class="container mx-auto px-4 py-8">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">My Library</h1>
      <p class="mt-2 text-gray-600">
        Your reading history from Goodreads
      </p>
    </div>

    <!-- Sync Status -->
    <div v-if="!goodreadsConnected" class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
      <div class="flex">
        <svg class="h-5 w-5 text-yellow-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-yellow-800">Connect Goodreads to view your library</h3>
          <div class="mt-2">
            <router-link to="/settings" class="text-sm font-medium text-yellow-800 hover:text-yellow-700">
              Go to Settings →
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <div v-else>
      <!-- Filters -->
      <div class="bg-white rounded-lg shadow p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Shelf</label>
            <select v-model="filters.shelf" class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Shelves</option>
              <option v-for="shelf in shelves" :key="shelf.name" :value="shelf.name">
                {{ shelf.name }} ({{ shelf.book_count }})
              </option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Rating</label>
            <select v-model="filters.rating" class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
              <option value="0">Unrated</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select v-model="sortBy" class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="date_added">Date Added</option>
              <option value="date_read">Date Read</option>
              <option value="rating">Rating</option>
              <option value="title">Title</option>
              <option value="author">Author</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search books..."
              class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
          </div>
        </div>
      </div>

      <!-- Books Grid -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p class="mt-4 text-gray-600">Loading your library...</p>
      </div>

      <div v-else-if="filteredBooks.length === 0" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <p class="mt-4 text-gray-600">No books found matching your criteria</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div
          v-for="book in paginatedBooks"
          :key="book.id"
          class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
        >
          <div class="aspect-w-3 aspect-h-4">
            <img
              :src="book.cover_url || '/placeholder.jpg'"
              :alt="book.title"
              class="w-full h-64 object-cover rounded-t-lg"
            >
          </div>
          <div class="p-4">
            <h3 class="font-medium text-gray-900 line-clamp-2">{{ book.title }}</h3>
            <p class="text-sm text-gray-600 mt-1">{{ book.author_name }}</p>
            
            <div class="mt-3 flex items-center justify-between">
              <div class="flex items-center">
                <div class="flex text-yellow-400">
                  <svg
                    v-for="i in 5"
                    :key="i"
                    class="w-4 h-4"
                    :class="{ 'text-gray-300': i > book.user_rating }"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <span class="ml-1 text-xs text-gray-500">{{ book.user_rating || 0 }}</span>
              </div>
              
              <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {{ book.shelf_name }}
              </span>
            </div>
            
            <div v-if="book.date_read" class="mt-2 text-xs text-gray-500">
              Read {{ formatDate(book.date_read) }}
            </div>
            
            <div class="mt-4 flex space-x-2">
              <button
                @click="requestAgain(book)"
                class="flex-1 text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                Request
              </button>
              <router-link
                :to="`/search?q=${encodeURIComponent(book.title)}`"
                class="flex-1 text-sm text-center bg-gray-200 text-gray-800 px-3 py-1 rounded hover:bg-gray-300"
              >
                Search
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="mt-8 flex justify-center">
        <nav class="flex space-x-2">
          <button
            @click="currentPage--"
            :disabled="currentPage === 1"
            class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <span class="px-3 py-2 text-sm text-gray-700">
            Page {{ currentPage }} of {{ totalPages }}
          </span>
          
          <button
            @click="currentPage++"
            :disabled="currentPage === totalPages"
            class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </nav>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import axios from 'axios'

export default {
  name: 'Library',
  setup() {
    const authStore = useAuthStore()
    const router = useRouter()
    
    const goodreadsConnected = ref(false)
    const loading = ref(true)
    const books = ref([])
    const shelves = ref([])
    const filters = ref({
      shelf: '',
      rating: ''
    })
    const searchQuery = ref('')
    const sortBy = ref('date_added')
    const currentPage = ref(1)
    const itemsPerPage = 24

    const checkGoodreadsStatus = async () => {
      try {
        const response = await axios.get('/api/goodreads/status', {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        goodreadsConnected.value = response.data.connected
        return response.data.connected
      } catch (err) {
        console.error('Failed to check Goodreads status:', err)
        return false
      }
    }

    const fetchShelves = async () => {
      try {
        const response = await axios.get('/api/goodreads/shelves', {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        shelves.value = response.data
      } catch (err) {
        console.error('Failed to fetch shelves:', err)
      }
    }

    const fetchBooks = async () => {
      try {
        loading.value = true
        const params = new URLSearchParams()
        
        if (filters.value.shelf) params.append('shelf', filters.value.shelf)
        if (filters.value.rating) params.append('rating', filters.value.rating)
        
        const response = await axios.get(`/api/goodreads/books?${params}`, {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        
        books.value = response.data.books
      } catch (err) {
        console.error('Failed to fetch books:', err)
      } finally {
        loading.value = false
      }
    }

    const filteredBooks = computed(() => {
      let result = books.value

      // Apply search filter
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        result = result.filter(book => 
          book.title.toLowerCase().includes(query) ||
          book.author_name.toLowerCase().includes(query)
        )
      }

      // Apply sorting
      result = [...result].sort((a, b) => {
        switch (sortBy.value) {
          case 'date_added':
            return new Date(b.date_added) - new Date(a.date_added)
          case 'date_read':
            return new Date(b.date_read || 0) - new Date(a.date_read || 0)
          case 'rating':
            return (b.user_rating || 0) - (a.user_rating || 0)
          case 'title':
            return a.title.localeCompare(b.title)
          case 'author':
            return a.author_name.localeCompare(b.author_name)
          default:
            return 0
        }
      })

      return result
    })

    const totalPages = computed(() => Math.ceil(filteredBooks.value.length / itemsPerPage))

    const paginatedBooks = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage
      const end = start + itemsPerPage
      return filteredBooks.value.slice(start, end)
    })

    const formatDate = (dateString) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    }

    const requestAgain = async (book) => {
      try {
        await axios.post('/api/requests', {
          goodreadsId: book.goodreads_id,
          title: book.title,
          author: book.author_name,
          coverUrl: book.cover_url
        }, {
          headers: { Authorization: `Bearer ${authStore.token}` }
        })
        
        router.push('/requests')
      } catch (err) {
        console.error('Failed to create request:', err)
        alert('Failed to create request. Please try again.')
      }
    }

    // Watch for filter changes
    watch([filters, sortBy], () => {
      currentPage.value = 1
    })

    watch(() => filters.value.shelf, () => {
      fetchBooks()
    })

    watch(() => filters.value.rating, () => {
      fetchBooks()
    })

    onMounted(async () => {
      const connected = await checkGoodreadsStatus()
      if (connected) {
        await Promise.all([
          fetchShelves(),
          fetchBooks()
        ])
      } else {
        loading.value = false
      }
    })

    return {
      goodreadsConnected,
      loading,
      books,
      shelves,
      filters,
      searchQuery,
      sortBy,
      currentPage,
      totalPages,
      filteredBooks,
      paginatedBooks,
      formatDate,
      requestAgain
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

.aspect-w-3 {
  position: relative;
  padding-bottom: 133.33%;
}

.aspect-h-4 {
  position: absolute;
  inset: 0;
}
</style>