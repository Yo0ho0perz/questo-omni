<template>
        {{ q.question }}

  <details :open="reveal">
    <summary class="py2 cursor-pointer select-none">
      <span class="mr2 text-gray-400">#{{ idx + 1 }}</span>
      
    </summary>
    <div class="pl6 pb2">
      <p class="font-semibold">{{ answer }}</p>
      <p v-if="q.hint" class="text-sm text-gray-500">{{ q.hint }}</p>
      <p class="text-sm">{{ q.extra }}</p>
      <a :href="`/pdf#page=${q.page}`" target="_blank" class="text-xs underline">
        PDF p.{{ q.page }}
      </a>
    </div>
  </details>
</template>

<script setup lang="ts">
const props = defineProps<{ q: any; idx: number; reveal: boolean }>()
const answer = computed(() =>
  props.q.type === 'mcq' ? props.q.options?.[props.q.answer] : props.q.answer,
)
</script>

<style scoped>
details[open] summary{ --at-apply: text-blue-600; }
summary::-webkit-details-marker{ display:none; }
</style>
