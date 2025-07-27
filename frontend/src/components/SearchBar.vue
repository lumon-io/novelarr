<template>
  <div class="relative">
    <input
      v-model="query"
      @input="onInput"
      type="text"
      placeholder="Search by title, author, or ISBN..."
      class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
    <div v-if="query.length > 0 && query.length < 2" class="absolute text-sm text-gray-500 mt-1">
      Type at least 2 characters to search
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const query = ref('')

const emit = defineEmits(['search'])

const onInput = () => {
  emit('search', query.value)
}
</script>