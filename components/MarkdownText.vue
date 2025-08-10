<!-- components/MarkdownText.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const props = defineProps<{ content: string }>()

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true
})

const rendered = computed(() => {
  const raw = md.render(props.content || '')
  return DOMPurify.sanitize(raw)
})
</script>

<template>
  <div class="prose prose-sm max-w-none" v-html="rendered"></div>
</template>

<style scoped>
.prose :where(pre, code) {
  direction: ltr;
}
</style>
