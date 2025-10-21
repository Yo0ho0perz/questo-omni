<!-- pages/index.vue -->
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { RouterLink as NuxtLink } from 'vue-router'
import { useMaterialStore } from '~/stores/material'
import { useProgressStore } from '~/stores/progress'
import type { Chapter } from '~/stores/material' // <-- typed Chapter

/* ---------- stores ---------- */
const mat = useMaterialStore()
const prog = useProgressStore()
const { chapters, totals, idIndex, timeAgo, loading } = storeToRefs(mat)

/* ---------- lifecycle ---------- */
onMounted(async () => {
  await mat.fetchChapters(true)
  await nextTick()
  const firstIds = (chapters.value || []).slice(0, 16).map(c => c.id)
  await mat.ensureMany(firstIds)
})

/* ---------- ui state ---------- */
const searchTerm = ref<string>('')
const filterMode = ref<'all' | 'done' | 'undone'>('all')
const sortBy = ref<'alpha' | 'progress' | 'coverage' | 'recent'>('alpha')

/* ---------- helpers ---------- */
function shortTimeAgo(ts: number): string {
  if (!ts) return '—'
  const d = Date.now() - ts
  const m = Math.floor(d / 60000), h = Math.floor(m / 60), days = Math.floor(h / 24)
  if (days >= 1) return `${days} روز قبل`
  if (h >= 1) return `${h} ساعت قبل`
  if (m >= 1) return `${m} دقیقه قبل`
  return 'لحظاتی پیش'
}

const coverageCount = (chId: string) =>
  (chapters.value.find(c => c.id === chId)?.coverage_items?.length ?? 0)

/** cache stats per chapter to avoid recomputing in template */
const statsCache = computed<Record<string, { done: number; due: number; wrong: number; star: number; last: number }>>(() => {
  const out: Record<string, any> = {}
  for (const ch of chapters.value) {
    const ids = idIndex.value[ch.id] || []
    out[ch.id] = prog.statsFor(ch.id, ids)
  }
  return out
})

const progressPctFor = (chId: string) => {
  const total = totals.value[chId] ?? 0
  const done = statsCache.value[chId]?.done ?? 0
  return total > 0 ? Math.round((done / total) * 100) : 0
}

/* ---------- visible list (typed) ---------- */
const visibleChapters = computed<Chapter[]>(() => {
  let list: Chapter[] = chapters.value || []

  const term = searchTerm.value.trim().toLowerCase()
  if (term) {
    list = list.filter(ch => {
      const inTitle = ch.title.toLowerCase().includes(term)
      const inDesc = (ch.desc || '').toLowerCase().includes(term)
      const inCoverage = (ch.coverage_items || []).some(i => i.toLowerCase().includes(term))
      return inTitle || inDesc || inCoverage
    })
  }

  if (filterMode.value !== 'all') {
    list = list.filter(ch => {
      const hasProgress = (statsCache.value[ch.id]?.done ?? 0) > 0
      return filterMode.value === 'done' ? hasProgress : !hasProgress
    })
  }

  const sorted = [...list]
  if (sortBy.value === 'progress') {
    sorted.sort((a, b) => progressPctFor(b.id) - progressPctFor(a.id))
  } else if (sortBy.value === 'coverage') {
    sorted.sort((a, b) =>
      (coverageCount(b.id) - coverageCount(a.id)) ||
      (Number(a.id.replace(/^ch/, '')) - Number(b.id.replace(/^ch/, '')))
    )
  } else if (sortBy.value === 'recent') {
    sorted.sort((a, b) => {
      const la = statsCache.value[a.id]?.last ?? 0
      const lb = statsCache.value[b.id]?.last ?? 0
      return (lb - la) ||
        (Number(a.id.replace(/^ch/, '')) - Number(b.id.replace(/^ch/, '')))
    })
  } else {
    sorted.sort((a, b) => Number(a.id.replace(/^ch/, '')) - Number(b.id.replace(/^ch/, '')))
  }

  // gentle prefetch for first screen
  queueMicrotask(() => mat.ensureMany(sorted.slice(0, 16).map(c => c.id)))
  return sorted
})

/* ---------- details modal (typed) ---------- */
const detailsOpen = ref<boolean>(false)
const detailsFor = ref<Chapter | null>(null)

function openDetails(ch: Chapter) { detailsFor.value = ch; detailsOpen.value = true }
function closeDetails() { detailsOpen.value = false; detailsFor.value = null }

const detailsStats = computed(() => {
  const ch = detailsFor.value
  if (!ch) return { done: 0, due: 0, wrong: 0, star: 0, last: 0, progressPct: 0, total: 0 }
  const st = statsCache.value[ch.id] || { done: 0, due: 0, wrong: 0, star: 0, last: 0 }
  const total = totals.value[ch.id] ?? 0
  const progressPct = total > 0 ? Math.round((st.done / total) * 100) : 0
  return { ...st, progressPct, total }
})
</script>

<template>
  <main class="p-8 space-y-6 max-w-7xl mx-auto">
    <!-- header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-3xl font-extrabold">📚 Study Chapters</h1>
        <p class="text-xs text-gray-500 mt-1">آخرین بروزرسانیِ فهرست: {{ timeAgo }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative">
          <input v-model="searchTerm" type="text" placeholder="جستجوی فصل، توضیح یا کلیدواژه پوشش…" class="pl-10 pr-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 transition w-72" />
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        </div>
        <select v-model="filterMode" class="px-3 py-2 border rounded-full focus:ring-2 focus:ring-indigo-400">
          <option value="all">همه</option>
          <option value="done">دارای پیشرفت</option>
          <option value="undone">بدون پیشرفت</option>
        </select>
        <button
          @click="sortBy = sortBy === 'alpha' ? 'progress' : sortBy === 'progress' ? 'coverage' : sortBy === 'coverage' ? 'recent' : 'alpha'"
          class="px-3 py-2 border rounded-full hover:bg-gray-100 transition"
        >
          {{
            sortBy === 'alpha'
              ? 'مرتب‌سازی: پیشرفت'
              : sortBy === 'progress'
                ? 'مرتب‌سازی: پوشش'
                : sortBy === 'coverage'
                  ? 'مرتب‌سازی: آخرین فعالیت'
                  : 'مرتب‌سازی: عدد فصل'
          }}
        </button>
        <button @click="mat.fetchChapters(true)" :disabled="loading" class="px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition disabled:opacity-50">
          {{ loading ? 'در حال بروزرسانی…' : 'بروزرسانی' }}
        </button>
      </div>
    </div>

    <!-- grid -->
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      <div v-for="ch in visibleChapters" :key="ch.id" class="group relative flex flex-col border rounded-2xl p-6 bg-white hover:shadow-lg transition">
        <NuxtLink :to="`/study/${ch.id}`" class="block">
          <h2 class="text-xl font-semibold mb-2 group-hover:text-indigo-600 transition">
            {{ ch.title }}
          </h2>
        </NuxtLink>

        <p v-if="ch.desc" class="text-sm text-gray-600 line-clamp-2 mb-3">{{ ch.desc }}</p>

        <!-- coverage chips -->
        <div v-if="ch.coverage_items?.length" class="flex flex-wrap gap-2 mb-4">
          <span v-for="(item, i) in ch.coverage_items.slice(0,6)" :key="i" class="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200" :title="item">
            {{ item }}
          </span>
          <span v-if="ch.coverage_items.length > 6" class="text-[11px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100" :title="ch.coverage_items.slice(6).join(' • ')">
            +{{ ch.coverage_items.length - 6 }}
          </span>
        </div>

        <div class="grid grid-cols-4 gap-2 text-[11px] mb-4">
          <div class="px-2 py-1 rounded-lg bg-gray-50 border text-gray-700 text-center">
            پیشرفت<br>
            <span class="font-semibold">
              {{ (statsCache[ch.id]?.done ?? 0) }}/{{ totals[ch.id] ?? '—' }}
            </span>
          </div>
          <div class="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-center">
            Due<br><span class="font-semibold">{{ statsCache[ch.id]?.due ?? 0 }}</span>
          </div>
          <div class="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-center">
            غلط اخیر<br><span class="font-semibold">{{ statsCache[ch.id]?.wrong ?? 0 }}</span>
          </div>
          <div class="px-2 py-1 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-center">
            ★<br><span class="font-semibold">{{ statsCache[ch.id]?.star ?? 0 }}</span>
          </div>
        </div>

        <!-- progress bar + last touched -->
        <div class="mt-2 text-xs flex items-center justify-between text-gray-600">
          <span>{{ progressPctFor(ch.id) }}%</span>
          <span class="text-gray-400">آخرین فعالیت: {{ shortTimeAgo(statsCache[ch.id]?.last || 0) }}</span>
        </div>

        <!-- actions -->
        <div class="mt-2 flex items-center gap-2">
          <NuxtLink :to="`/study/${ch.id}`" class="px-3 py-2 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-sm">
            ادامهٔ مطالعه
          </NuxtLink>
          <button class="px-3 py-2 rounded-lg border text-sm hover:bg-gray-50" @click.stop.prevent="openDetails(ch)">
            نمایش جزئیات
          </button>
        </div>
      </div>
    </div>

    <div v-if="!visibleChapters.length" class="text-center text-gray-500 py-16">
      هیچ فصلی یافت نشد.
    </div>

    <!-- Details Modal -->
    <div v-if="detailsOpen" class="fixed inset-0 z-50 flex items-center justify-center" @keydown.esc="closeDetails">
      <div class="absolute inset-0 bg-black/40" @click="closeDetails"></div>
      <div class="relative z-10 w-[min(90vw,800px)] max-h-[85vh] overflow-auto bg-white rounded-2xl shadow-xl p-6" role="dialog" aria-modal="true">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h3 class="text-2xl font-bold truncate">{{ detailsFor?.title }}</h3>
            <p class="text-xs text-gray-500 mt-1">آخرین فعالیت: {{ shortTimeAgo(detailsStats.last) }}</p>
          </div>
          <button class="p-2 rounded-lg hover:bg-gray-100" @click="closeDetails" aria-label="بستن">✕</button>
        </div>

        <p v-if="detailsFor?.desc" class="mt-3 text-sm text-gray-700">{{ detailsFor.desc }}</p>

        <div class="mt-4 grid grid-cols-5 gap-2 text-[11px]">
          <div class="px-2 py-1 rounded-lg bg-gray-50 border text-gray-700 text-center">
            پیشرفت<br><span class="font-semibold">{{ detailsStats.done }}/{{ detailsStats.total || '—' }}</span>
          </div>
          <div class="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-center">
            Due<br><span class="font-semibold">{{ detailsStats.due }}</span>
          </div>
          <div class="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-center">
            غلط اخیر<br><span class="font-semibold">{{ detailsStats.wrong }}</span>
          </div>
          <div class="px-2 py-1 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-center">
            ★<br><span class="font-semibold">{{ detailsStats.star }}</span>
          </div>
          <div class="px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-center">
            درصد<br><span class="font-semibold">{{ detailsStats.progressPct }}%</span>
          </div>
        </div>

        <div class="mt-3">
          <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div class="h-full bg-indigo-500 transition-all" :style="{ width: detailsStats.progressPct + '%' }" />
          </div>
        </div>

        <div class="mt-6 flex items-center justify-end gap-2">
          <NuxtLink
            v-if="detailsFor"
            :to="`/study/${detailsFor.id}`"
            class="px-3 py-2 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-sm"
            @click="closeDetails"
          >
            ادامهٔ مطالعه
          </NuxtLink>
          <button class="px-3 py-2 rounded-lg border text-sm hover:bg-gray-50" @click="closeDetails">بستن</button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.line-clamp-2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
main::-webkit-scrollbar{width:8px}
main::-webkit-scrollbar-thumb{background:rgba(0,0,0,.2);border-radius:4px}
</style>
