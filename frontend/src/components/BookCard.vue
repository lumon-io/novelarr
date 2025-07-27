<template>
  <div class="bg-white rounded-lg shadow-md overflow-hidden">
    <img 
      :src="book.coverUrl || '/placeholder.jpg'" 
      :alt="book.title"
      class="w-full h-64 object-cover"
    >
    <div class="p-4">
      <h3 class="font-bold text-lg mb-1">{{ book.title }}</h3>
      <p class="text-gray-600 mb-2">{{ book.author }}</p>
      <div class="flex items-center justify-between mb-3">
        <p v-if="book.year" class="text-sm text-gray-500">{{ book.year }}</p>
        <span v-if="book.source" class="text-xs px-2 py-1 rounded-full" :class="getSourceClass(book.source)">
          {{ book.source }}
        </span>
      </div>
      <div v-if="book.size || book.seeders !== undefined || book.leechers !== undefined" class="text-xs text-gray-500 mb-3">
        <span v-if="book.size">Size: {{ book.size }}</span>
        <span v-if="book.seeders !== undefined" class="ml-2">S: {{ book.seeders }}</span>
        <span v-if="book.leechers !== undefined" class="ml-1">L: {{ book.leechers }}</span>
        <span v-if="book.indexer" class="ml-2">[{{ book.indexer }}]</span>
      </div>
      
      <!-- Kavita status badge -->
      <div v-if="book.inKavita" class="mb-3">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          <svg class="mr-1.5 h-2 w-2 text-purple-400" fill="currentColor" viewBox="0 0 8 8">
            <circle cx="4" cy="4" r="3" />
          </svg>
          Available in Kavita
        </span>
      </div>
      
      <div class="space-y-2">
        <!-- Request/Download button -->
        <button 
          v-if="!book.inKavita"
          @click="$emit('request', book)"
          :disabled="requesting || book.source !== 'Readarr'"
          class="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {{ book.source !== 'Readarr' ? 'Manual Download Only' : (requesting ? 'Requesting...' : 'Request') }}
        </button>
        
        <!-- Open in Kavita button -->
        <button
          v-if="book.inKavita && book.kavitaUrl"
          @click="openInKavita"
          class="w-full bg-purple-500 text-white py-2 px-4 rounded hover:bg-purple-600"
        >
          Open in Kavita
        </button>
        
        <!-- Read now button (for books in Kavita) -->
        <button
          v-else-if="book.inKavita"
          @click="$emit('read', book)"
          class="w-full bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600"
        >
          Read Now
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  book: {
    type: Object,
    required: true
  },
  requesting: {
    type: Boolean,
    default: false
  }
})

defineEmits(['request', 'read'])

const getSourceClass = (source) => {
  switch (source) {
    case 'Readarr':
      return 'bg-green-100 text-green-800'
    case 'Jackett':
      return 'bg-blue-100 text-blue-800'
    case 'Prowlarr':
      return 'bg-purple-100 text-purple-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const openInKavita = () => {
  if (props.book.kavitaUrl) {
    window.open(props.book.kavitaUrl, '_blank')
  }
}
</script>