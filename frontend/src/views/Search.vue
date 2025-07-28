<template>
  <div class="container mx-auto p-4">
    <h1 class="text-3xl font-bold mb-6">Search {{ getContentTypeDisplay(selectedContentType) }}</h1>
    
    <div class="mb-6 space-y-4">
      <!-- Content Type Selection -->
      <ContentTypeSelector v-model="selectedContentType" />
      
      <SearchBar @search="debouncedSearch" />
      
      <!-- Source Selection -->
      <div class="flex items-center space-x-4">
        <span class="text-sm font-medium text-gray-700">Search in:</span>
        <label class="flex items-center">
          <input
            v-model="searchSource"
            type="radio"
            value="all"
            class="mr-2"
          >
          <span class="text-sm">All Sources</span>
        </label>
        <label class="flex items-center" v-if="sources.readarr">
          <input
            v-model="searchSource"
            type="radio"
            value="readarr"
            class="mr-2"
          >
          <span class="text-sm">Readarr</span>
        </label>
        <label class="flex items-center" v-if="sources.jackett">
          <input
            v-model="searchSource"
            type="radio"
            value="jackett"
            class="mr-2"
          >
          <span class="text-sm">Jackett</span>
        </label>
        <label class="flex items-center" v-if="sources.prowlarr">
          <input
            v-model="searchSource"
            type="radio"
            value="prowlarr"
            class="mr-2"
          >
          <span class="text-sm">Prowlarr</span>
        </label>
      </div>
    </div>
    
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      <p class="mt-2 text-gray-600">Searching...</p>
    </div>
    
    <div v-else-if="error" class="text-center py-12 text-red-500">
      {{ error }}
    </div>
    
    <div v-else-if="searched && results.length === 0" class="text-center py-12 text-gray-600">
      No results found
    </div>
    
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
      <BookCard
        v-for="book in results"
        :key="book.goodreadsId"
        :book="book"
        :requesting="requestingId === book.goodreadsId"
        @request="requestBook"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { debounce } from 'lodash-es'
import api from '../api'
import SearchBar from '../components/SearchBar.vue'
import BookCard from '../components/BookCard.vue'
import ContentTypeSelector from '../components/ContentTypeSelector.vue'

const results = ref([])
const loading = ref(false)
const error = ref('')
const searched = ref(false)
const requestingId = ref(null)
const searchSource = ref('all')
const selectedContentType = ref('books')
const sources = ref({
  readarr: true,
  jackett: false,
  prowlarr: false
})
const lastQuery = ref('')

const search = async (query) => {
  if (!query || query.length < 2) {
    results.value = []
    searched.value = false
    return
  }
  
  lastQuery.value = query
  loading.value = true
  error.value = ''
  
  try {
    const response = await api.get('/search', { 
      params: { 
        q: query,
        source: searchSource.value 
      } 
    })
    results.value = response.data.results
    searched.value = true
    
    // Update available sources
    if (response.data.sources) {
      sources.value = response.data.sources
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Search failed'
  } finally {
    loading.value = false
  }
}

const debouncedSearch = debounce(search, 500)

const getContentTypeDisplay = (type) => {
  const typeMap = {
    'books': 'Books',
    'audiobooks': 'Audiobooks',
    'magazines': 'Magazines',
    'comics': 'Comics',
    'manga': 'Manga'
  }
  return typeMap[type] || 'Books'
}

const requestBook = async (book) => {
  requestingId.value = book.goodreadsId
  
  try {
    await api.post('/requests', {
      goodreadsId: book.goodreadsId,
      title: book.title,
      author: book.author,
      coverUrl: book.coverUrl,
      contentType: selectedContentType.value
    })
    alert('Book requested successfully!')
  } catch (err) {
    const message = err.response?.data?.error || 'Request failed'
    alert(message)
  } finally {
    requestingId.value = null
  }
}

// Re-search when source changes
watch(searchSource, () => {
  if (lastQuery.value) {
    search(lastQuery.value)
  }
})

// Get available sources on mount
onMounted(async () => {
  try {
    const response = await api.get('/search/sources')
    sources.value = {
      readarr: response.data.readarr.enabled,
      jackett: response.data.jackett.enabled,
      prowlarr: response.data.prowlarr.enabled
    }
  } catch (error) {
    console.error('Failed to get search sources:', error)
  }
})
</script>