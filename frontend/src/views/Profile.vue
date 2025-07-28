<template>
  <div class="container mx-auto p-4">
    <UserProfile />
  </div>
</template>

<script>
import UserProfile from '../components/UserProfile.vue';

export default {
  name: 'Profile',
  components: {
    UserProfile
  }
};
</script>