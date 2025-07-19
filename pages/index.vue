<!-- pages/index.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import { useMaterial } from '~/composables/useMaterial'
import { useRouter, RouterLink as NuxtLink } from 'vue-router'

interface Chapter { id: string; title: string }

const { material: rawChapters, fetching, refetch } = useMaterial<Chapter>('chapters')
const chapters = computed<Chapter[]>(() =>
  Array.isArray(rawChapters.value) ? rawChapters.value : []
)

// initial load
onMounted(() => {
  if (!chapters.value.length) refetch(true)
})

// Leitner progress stores
const boxes = ref<Record<string, ReturnType<typeof useStorage>>>({})
watch(chapters, chs => {
  chs.forEach(ch => {
    if (!boxes.value[ch.id]) {
      boxes.value[ch.id] = useStorage<Record<string, any>>(`leitner:${ch.id}`, {})
    }
  })
})

// progress counts
const progressMap = computed<Record<string, number>>(() => {
  const m: Record<string, number> = {}
  chapters.value.forEach(ch => {
    const box = boxes.value[ch.id]
    m[ch.id] = box && box.value ? Object.keys(box.value).length : 0
  })
  return m
})

// --- UI state ---
const searchTerm = ref('')
const filterMode = ref<'all'|'done'|'undone'>('all')
const sortBy = ref<'alpha'|'progress'>('alpha')

// filtered + sorted
// filtered + sorted (natural sort by chapter number)
const visibleChapters = computed(() => {
  let list = chapters.value

  // search
  if (searchTerm.value.trim()) {
    const term = searchTerm.value.trim().toLowerCase()
    list = list.filter(ch => ch.title.toLowerCase().includes(term))
  }

  // filter by done/undone/all
  list = list.filter(ch => {
    const done = progressMap.value[ch.id] > 0
    if (filterMode.value === 'done') return done
    if (filterMode.value === 'undone') return !done
    return true
  })

  // sort
  const sorted = [...list]
  if (sortBy.value === 'progress') {
    sorted.sort((a, b) => progressMap.value[b.id] - progressMap.value[a.id])
  } else {
    // natural numeric sort on "ch<NUMBER>"
    sorted.sort((a, b) => {
      const na = Number(a.id.replace(/^ch/, ''))
      const nb = Number(b.id.replace(/^ch/, ''))
      return na - nb
    })
  }

  return sorted
})

</script>

<template>
  <main class="p-8 space-y-6">
    <!-- header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <h1 class="text-3xl font-extrabold">📚 Study Chapters</h1>
      <div class="flex flex-wrap items-center gap-3">
        <!-- search -->
        <div class="relative">
          <input
            v-model="searchTerm"
            type="text"
            placeholder="جستجوی فصل..."
            class="pl-10 pr-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
          />
          <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
        </div>
        <!-- filter -->
        <select v-model="filterMode" class="px-3 py-2 border rounded-full focus:ring-2 focus:ring-indigo-400">
          <option value="all">همه</option>
          <option value="done">خوانده شده</option>
          <option value="undone">نخوانده</option>
        </select>
        <!-- sort -->
        <button
          @click="sortBy = sortBy === 'alpha' ? 'progress' : 'alpha'"
          class="px-3 py-2 border rounded-full hover:bg-gray-100 transition"
        >
          {{ sortBy === 'alpha' ? 'مرتب‌سازی بر اساس پیشرفت' : 'مرتب‌سازی الفبایی' }}
        </button>
        <!-- refresh -->
        <button
          @click="refetch(true)"
          :disabled="fetching"
          class="px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {{ fetching ? 'در حال بروزرسانی…' : 'بروزرسانی' }}
        </button>
      </div>
    </div>

    <!-- grid -->
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <NuxtLink
        v-for="ch in visibleChapters"
        :key="ch.id"
        :to="`/study/${ch.id}`"
        class="group relative block border rounded-2xl p-6 bg-white hover:shadow-lg transition"
      >
        <!-- title -->
        <h2 class="text-xl font-semibold mb-4 group-hover:text-indigo-600 transition">
          {{ ch.title }}
        </h2>
        <!-- progress bar -->
        <div class="mt-auto">
          <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              class="h-full bg-indigo-500 transition-all"
              :style="{ width: Math.min(progressMap[ch.id] / 20 * 100, 100) + '%' }"
            />
          </div>
          <p class="mt-2 text-sm text-gray-600">
            {{ progressMap[ch.id] }} سؤال پاسخ داده شده
          </p>
        </div>
        <!-- badge for done -->
        <span
          v-if="filterMode==='done'"
          class="absolute top-3 right-3 bg-green-500 text-white text-xs px-2 py-1 rounded-full"
        >
          ✓
        </span>
        <span
          v-else-if="filterMode==='undone' && progressMap[ch.id]===0"
          class="absolute top-3 right-3 bg-red-500 text-white text-xs px-2 py-1 rounded-full"
        >
          !
        </span>
      </NuxtLink>
    </div>

    <!-- empty state -->
    <div v-if="!visibleChapters.length" class="text-center text-gray-500 py-16">
      هیچ فصلی یافت نشد.
    </div>
  </main>
</template>

<style scoped>
/* scrollbar for grid if overflow */
main::-webkit-scrollbar {
  width: 8px;
}
main::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}
</style>
