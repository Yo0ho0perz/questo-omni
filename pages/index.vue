<!-- pages/index.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import { useMaterial } from '~/composables/useMaterial'
import { useRouter, RouterLink as NuxtLink } from 'vue-router'

interface Chapter {
  id: string
  title: string
  desc?: string
  coverage_items?: string[]
}

const { material: rawChapters, fetching, refetch, timeAgo } = useMaterial<Chapter>('chapters')

const chapters = computed<Chapter[]>(() =>
  Array.isArray(rawChapters.value) ? rawChapters.value.map(ch => ({
    ...ch,
    coverage_items: Array.isArray(ch.coverage_items) ? ch.coverage_items : []
  })) : []
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

// coverage counts
const coverageCount = computed<Record<string, number>>(() => {
  const m: Record<string, number> = {}
  chapters.value.forEach(ch => {
    m[ch.id] = ch.coverage_items?.length ?? 0
  })
  return m
})

// --- UI state ---
const searchTerm = ref('')
const filterMode = ref<'all'|'done'|'undone'>('all')
const sortBy = ref<'alpha'|'progress'|'coverage'>('alpha')

// filtered + sorted (natural sort by chapter number)
const visibleChapters = computed(() => {
  let list = chapters.value

  // search (title + desc + coverage_items)
  if (searchTerm.value.trim()) {
    const term = searchTerm.value.trim().toLowerCase()
    list = list.filter(ch => {
      const inTitle = ch.title.toLowerCase().includes(term)
      const inDesc = (ch.desc || '').toLowerCase().includes(term)
      const inCoverage = (ch.coverage_items || []).some(i => i.toLowerCase().includes(term))
      return inTitle || inDesc || inCoverage
    })
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
  } else if (sortBy.value === 'coverage') {
    sorted.sort((a, b) => (coverageCount.value[b.id] - coverageCount.value[a.id]) || (Number(a.id.replace(/^ch/, '')) - Number(b.id.replace(/^ch/, ''))))
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

// progress bar width helper (still uses your current heuristic)
// optionally, you could divide by coverageCount for a relative bar if you prefer.
// function progressWidth(ch: Chapter) {
//   return Math.min((progressMap.value[ch.id] / 20) * 100, 100) + '%'
// }

function progressWidth(ch: Chapter) {
  const total = Math.max(coverageCount.value[ch.id], 1)
  return Math.min((progressMap.value[ch.id] / total) * 100, 100) + '%'
}

</script>

<template>
  <main class="p-8 space-y-6">
    <!-- header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-3xl font-extrabold">📚 Study Chapters</h1>
        <p class="text-xs text-gray-500 mt-1">آخرین بروزرسانیِ فهرست: {{ timeAgo }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <!-- search -->
        <div class="relative">
          <input
            v-model="searchTerm"
            type="text"
            placeholder="جستجوی فصل، توضیح یا کلیدواژه پوشش…"
            class="pl-10 pr-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 transition w-72"
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
          @click="sortBy = sortBy === 'alpha' ? 'progress' : sortBy === 'progress' ? 'coverage' : 'alpha'"
          class="px-3 py-2 border rounded-full hover:bg-gray-100 transition"
        >
          {{
            sortBy === 'alpha'
              ? 'مرتب‌سازی بر اساس پیشرفت'
              : sortBy === 'progress'
                ? 'مرتب‌سازی بر اساس پوشش'
                : 'مرتب‌سازی الفبایی'
          }}
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
        class="group relative flex flex-col border rounded-2xl p-6 bg-white hover:shadow-lg transition"
      >
        <!-- title -->
        <h2 class="text-xl font-semibold mb-2 group-hover:text-indigo-600 transition">
          {{ ch.title }}
        </h2>

        <!-- desc (clamped) -->
        <p v-if="ch.desc" class="text-sm text-gray-600 line-clamp-2 mb-3">
          {{ ch.desc }}
        </p>

        <!-- coverage chips -->
        <div v-if="ch.coverage_items?.length" class="flex flex-wrap gap-2 mb-4">
          <span
            v-for="(item, i) in ch.coverage_items.slice(0, 6)"
            :key="i"
            class="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200"
            :title="item"
          >
            {{ item }}
          </span>
          <span
            v-if="ch.coverage_items.length > 6"
            class="text-[11px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100"
            :title="ch.coverage_items.slice(6).join(' • ')"
          >
            +{{ ch.coverage_items.length - 6 }}
          </span>
        </div>

        <!-- grow spacer -->
        <div class="flex-1"></div>

        <!-- progress bar -->
        <div>
          <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div class="h-full bg-indigo-500 transition-all" :style="{ width: progressWidth(ch) }" />
          </div>
          <div class="mt-2 text-xs flex items-center justify-between text-gray-600">
            <span>{{ progressMap[ch.id] }} سؤال پاسخ داده شده</span>
            <span v-if="coverageCount[ch.id]">پوشش: {{ coverageCount[ch.id] }}</span>
          </div>
        </div>

        <!-- badge for state -->
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
/* clamp for desc */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* minimal scrollbar */
main::-webkit-scrollbar {
  width: 8px;
}
main::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}
</style>
