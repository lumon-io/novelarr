<template>
  <div class="flex space-x-2 mb-4">
    <button
      v-for="type in contentTypes"
      :key="type.name"
      @click="selectType(type.name)"
      :class="[
        'px-4 py-2 rounded-lg font-medium transition-colors',
        selectedType === type.name
          ? 'bg-blue-600 text-white'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
      ]"
    >
      <div class="flex items-center space-x-2">
        <span v-if="type.icon" class="text-lg">
          <i :class="getIconClass(type.icon)"></i>
        </span>
        <span>{{ type.display_name }}</span>
      </div>
    </button>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import api from '../api';

export default {
  name: 'ContentTypeSelector',
  props: {
    modelValue: {
      type: String,
      default: 'books'
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const contentTypes = ref([]);
    const selectedType = ref(props.modelValue);

    const getIconClass = (icon) => {
      const iconMap = {
        'book': 'fas fa-book',
        'headphones': 'fas fa-headphones',
        'newspaper': 'fas fa-newspaper',
        'image': 'fas fa-image',
        'book-open': 'fas fa-book-open'
      };
      return iconMap[icon] || 'fas fa-file';
    };

    const selectType = (type) => {
      selectedType.value = type;
      emit('update:modelValue', type);
    };

    const fetchContentTypes = async () => {
      try {
        const response = await api.get('/content-types');
        contentTypes.value = response.data;
      } catch (error) {
        console.error('Failed to fetch content types:', error);
        // Fallback to default types
        contentTypes.value = [
          { name: 'books', display_name: 'Books', icon: 'book' },
          { name: 'audiobooks', display_name: 'Audiobooks', icon: 'headphones' }
        ];
      }
    };

    onMounted(() => {
      fetchContentTypes();
    });

    return {
      contentTypes,
      selectedType,
      getIconClass,
      selectType
    };
  }
};
</script>