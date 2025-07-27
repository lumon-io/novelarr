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
      <button 
        @click="$emit('request', book)"
        :disabled="requesting || book.source !== 'Readarr'"
        class="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {{ book.source !== 'Readarr' ? 'Manual Download Only' : (requesting ? 'Requesting...' : 'Request') }}
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  book: {
    type: Object,
    required: true
  },
  requesting: {
    type: Boolean,
    default: false
  }
})

defineEmits(['request'])

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
</script>