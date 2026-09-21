<script setup lang="ts">
defineProps<{
  icon: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
}>();
</script>

<template>
  <button
    type="button"
    class="ls3-toolbar__btn"
    :class="{ 'is-on': active }"
    :title="title"
    :disabled="disabled"
  >
    <i
      class="iconfont-luckysheet ls3-toolbar__icon"
      :class="`luckysheet-iconfont-${icon}`"
      aria-hidden="true"
    />
  </button>
</template>
