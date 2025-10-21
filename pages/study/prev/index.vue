<!-- pages/index.vue -->
<script setup lang="ts">
// import { ref, computed, onMounted, watch, reactive, nextTick } from 'vue'
import { onMounted, onUnmounted, onActivated, nextTick } from 'vue'

import { useStorage } from '@vueuse/core'
import { useMaterial } from '~/composables/useMaterial'
import { RouterLink as NuxtLink } from 'vue-router'
import { useChapterProgress } from '~/composables/useChapterProgress'



/* -------------------- Types -------------------- */
interface Chapter { id: string; title: string; desc?: string; coverage_items?: string[] }
interface QuestionState {
  box: number; next: number; highlight?: boolean; revealed?: boolean; revealedAt?: number;
  lastText?: string; log: { t: number; ok: boolean }[]; lastChosen?: number
}
type LeitnerRef = ReturnType<typeof useStorage<Record<string, QuestionState>>>

  const { ensureIndex, ensureMany, totals, statsFor, idIndex } = useChapterProgress()

  let ensureTimer: any = null
function scheduleEnsureMany(ids: string[]) {
  if (ensureTimer) clearTimeout(ensureTimer)
  ensureTimer = setTimeout(() => ensureMany(ids), 50)
}

/* -------------------- Chapters data -------------------- */
const { material: rawChapters, fetching, refetch, timeAgo } = useMaterial<Chapter>('chapters')
const chapters = computed<Chapter[]>(() =>
  Array.isArray(rawChapters.value)
    ? rawChapters.value.map(ch => ({ ...ch, coverage_items: Array.isArray(ch.coverage_items) ? ch.coverage_items : [] }))
    : []
)

/* -------------------- Client guard & prewarm -------------------- */
const isClient = ref(false)

async function prewarmAll(reason: string) {
  if (!isClient.value) return
  console.info(`[index] prewarmAll (${reason})`)
  chapters.value.forEach(ch => {
    const ref = getState(ch.id)
    console.info(`[index]  ↳ ${ch.id} has ${Object.keys(ref.value || {}).length} items`)
  })
  await Promise.all(chapters.value.map(ch => ensureTotal(ch.id)))
  await nextTick()
  console.info('[index] snapshot after prewarm:', snapshotProgress())
}

onMounted(async () => {
  isClient.value = true
  if (!chapters.value.length) await refetch(true)
  // await prewarmAll('onMounted')
  // await hardReloadAll('onMounted')

  // const onFocus = () => hardReloadAll('window focus')
  // const onVisible = () => { if (!document.hidden) hardReloadAll('visibilitychange') }
  // window.addEventListener('focus', onFocus)
  // document.addEventListener('visibilitychange', onVisible)
  // save to remove later
  // ;(window as any).__idx_onFocus = onFocus
  // ;(window as any).__idx_onVisible = onVisible
})

// nuxt keep-alive / return from other pages
// onActivated(async () => {
//   await hardReloadAll('onActivated')
// })

onUnmounted(() => {
  const onFocus = (window as any).__idx_onFocus
  const onVisible = (window as any).__idx_onVisible
  if (onFocus) window.removeEventListener('focus', onFocus)
  if (onVisible) document.removeEventListener('visibilitychange', onVisible)
})


watch(chapters, async () => {
  await prewarmAll('chapters watch')
  await hardReloadAll('chapters watch')
})


// // when chapters list changes (e.g., refetch), prewarm again
// watch(chapters, async (chs, old) => {
//   console.info('[index] chapters changed:', chs.map(c=>c.id))
//   await prewarmAll('chapters watch')
// }, { immediate: false })

/* -------------------- Leitner state per chapter -------------------- */
const states = reactive<Record<string, LeitnerRef>>({})

function getState(chId: string): LeitnerRef {
  if (!states[chId]) {
    const key = `leitner:${chId}`
    console.info(`[index] create useStorage for ${key}`)

    // IMPORTANT: writeDefaults:false so we don't overwrite existing localStorage with {}
    states[chId] = useStorage<Record<string, QuestionState>>(
      key,
      {},
      undefined,
      { mergeDefaults: true, listenToStorageChanges: true, writeDefaults: false }
    )

    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object' && !Object.keys(states[chId].value || {}).length) {
          // postpone assignment to next tick to avoid sync reactivity loops during mount
          nextTick(() => {
            try {
              console.info(`[index] hydrating ${key} from localStorage with ${Object.keys(parsed).length} items`)
              states[chId].value = parsed
            } catch (err) {
              console.warn(`[index] hydrate assign failed for ${key}`, err)
            }
          })
        }
      }
    } catch (e) {
      console.warn(`[index] hydrate failed for ${key}`, e)
    }


    // deep watch for diagnostics
    // replace deep watch with a debounced logger
    let _logTimer: any = null
    watch(states[chId], (val) => {
      if (_logTimer) clearTimeout(_logTimer)
      _logTimer = setTimeout(() => {
        console.info(`[index] state changed for ${chId}: size=${Object.keys(val || {}).length}`)
      }, 50)
    }, { deep: true })

  }
  return states[chId]
}



/* -------------------- Totals per chapter (questions count) -------------------- */
// const totals = reactive<Record<string, number>>({})
// pages/index.vue (script setup)
// const idIndex = reactive<Record<string, string[]>>({}) // current question IDs per chapter

async function ensureTotal(chId: string) {
  if (totals[chId] != null && idIndex[chId]) return
  try {
    const cfg = useRuntimeConfig().public
    const data = await $fetch<any[]>(`/material/${chId}.json?ver=${cfg.appVersion}`)
    totals[chId] = Array.isArray(data) ? data.length : 0
    idIndex[chId] = Array.isArray(data) ? data.map(q => q.id) : []

    // IMPORTANT: prune progress to the currently valid ids
    const { reconcile } = useLeitner(chId)
    reconcile(new Set(idIndex[chId]))
  } catch (err) {
    console.warn(`[index] totals fetch failed for ${chId}`, err)
    totals[chId] = 0
    idIndex[chId] = []
  }
}


async function hardReloadAll(reason: string) {
  if (!isClient.value) return
  console.info(`[index] hardReloadAll (${reason})`)
  chapters.value.forEach(ch => {
    const key = `leitner:${ch.id}`
    const ref = getState(ch.id)
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        // always refresh from LS (even if ref already has something)
        ref.value = parsed
      }
    } catch (e) {
      console.warn(`[index] hardReloadAll parse fail for ${key}`, e)
    }
  })
  await Promise.all(chapters.value.map(ch => ensureTotal(ch.id)))
  await nextTick()
  console.info('[index] snapshot after hardReloadAll:', snapshotProgress())
}


// helper to iterate only valid entries
function entriesFor(chId: string) {
  const ids = new Set(idIndex[chId] || [])
  const s = isClient.value ? getState(chId).value : {}
  return Object.entries(s || {}).filter(([id]) => ids.has(id))
}

const doneMap = computed<Record<string, number>>(() => {
  const m: Record<string, number> = {}
  for (const ch of chapters.value) m[ch.id] = entriesFor(ch.id).length
  return m
})

const dueMap = computed<Record<string, number>>(() => {
  const m: Record<string, number> = {}
  for (const ch of chapters.value) {
    m[ch.id] = entriesFor(ch.id).filter(([, v]) => Date.now() >= (v.next || 0)).length
  }
  return m
})

const wrongMap = computed<Record<string, number>>(() => {
  const m: Record<string, number> = {}
  for (const ch of chapters.value) {
    m[ch.id] = entriesFor(ch.id).filter(([, v]) => v.log?.length && v.log.at(-1)!.ok === false).length
  }
  return m
})

const starMap = computed<Record<string, number>>(() => {
  const m: Record<string, number> = {}
  for (const ch of chapters.value) m[ch.id] = entriesFor(ch.id).filter(([, v]) => v.highlight).length
  return m
})

const lastTouchedMap = computed<Record<string, number>>(() => {
  const m: Record<string, number> = {}
  for (const ch of chapters.value) {
    const ts = entriesFor(ch.id).flatMap(([, v]) => [...(v.log?.map(l => l.t) || []), v.revealedAt || 0])
    m[ch.id] = ts.length ? Math.max(...ts) : 0
  }
  return m
})



function snapshotProgress() {
  const out: Record<string, any> = {}
  chapters.value.forEach(ch => {
    out[ch.id] = {
      total: totals[ch.id] ?? 0,
      done:  doneMap.value[ch.id] ?? 0,
      due:   dueMap.value[ch.id] ?? 0,
      wrong: wrongMap.value[ch.id] ?? 0,
      star:  starMap.value[ch.id] ?? 0,
      last:  lastTouchedMap.value[ch.id] ?? 0
    }
  })
  return out
}

/* -------------------- Helpers -------------------- */
const coverageCount = (chId: string) =>
  chapters.value.find(c => c.id === chId)?.coverage_items?.length ?? 0

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0)
// const chapterProgressPct = (chId: string) => {
//   const total = totals[chId] ?? 0
//   const done  = doneMap.value[chId] ?? 0
//   if (total > 0) return Math.round((done / total) * 100)
//   // fallback to coverage if total isn't fetched yet
//   const cov = coverageCount(chId)
//   return cov > 0 ? Math.round((done / cov) * 100) : 0
// }

// function shortTimeAgo(ts: number) {
//   if (!ts) return '—'
//   const d = Date.now() - ts
//   const m = Math.floor(d / 60000), h = Math.floor(m / 60), days = Math.floor(h / 24)
//   if (days >= 1) return `${days} روز قبل`
//   if (h >= 1) return `${h} ساعت قبل`
//   if (m >= 1) return `${m} دقیقه قبل`
//   return 'لحظاتی پیش'
// }

// drop-in helpers now become simple getters:
const chapterProgressPct = (chId: string) => statsFor(chId).value.progressPct
const shortTimeAgo = (ts: number) => { /* keep your same function */ }

/* -------------------- UI state -------------------- */
const searchTerm = ref('')
const filterMode = ref<'all'|'done'|'undone'>('all')
const sortBy = ref<'alpha'|'progress'|'coverage'|'recent'>('alpha')

/* -------------------- Details Modal -------------------- */
const detailsOpen = ref(false)
const detailsFor  = ref<Chapter | null>(null)

function openDetails(ch: Chapter) {
  detailsFor.value = ch
  detailsOpen.value = true
  console.info('[index] openDetails:', ch.id, ch.title)
}
function closeDetails() {
  detailsOpen.value = false
  detailsFor.value = null
}

const detailsId = computed(() => detailsFor.value?.id ?? '')
const detailsProgressPct = computed(() => detailsId.value ? chapterProgressPct(detailsId.value) : 0)
// const detailsStats = computed(() => {
//   const id = detailsId.value
//   if (!id) return { done: 0, total: 0, due: 0, wrong: 0, star: 0, last: 0 }
//   return {
//     done: doneMap.value[id] ?? 0,
//     total: totals[id] ?? 0,
//     due:  dueMap.value[id] ?? 0,
//     wrong: wrongMap.value[id] ?? 0,
//     star: starMap.value[id] ?? 0,
//     last: lastTouchedMap.value[id] ?? 0
//   }
// })

const detailsStats = computed(() => detailsFor.value ? statsFor(detailsFor.value.id).value : {
  done:0, due:0, wrong:0, star:0, last:0, progressPct:0
})


/* -------------------- List -------------------- */
const visibleChapters = computed(() => {
  let list = chapters.value

  if (searchTerm.value.trim()) {
    const term = searchTerm.value.trim().toLowerCase()
    list = list.filter(ch => {
      const inTitle = ch.title.toLowerCase().includes(term)
      const inDesc = (ch.desc || '').toLowerCase().includes(term)
      const inCoverage = (ch.coverage_items || []).some(i => i.toLowerCase().includes(term))
      return inTitle || inDesc || inCoverage
    })
  }

  list = list.filter(ch => {
    const hasProgress = (doneMap.value[ch.id] ?? 0) > 0
    if (filterMode.value === 'done') return hasProgress
    if (filterMode.value === 'undone') return !hasProgress
    return true
  })

  const sorted = [...list]
  if (sortBy.value === 'progress') {
    sorted.sort((a, b) => chapterProgressPct(b.id) - chapterProgressPct(a.id))
  } else if (sortBy.value === 'coverage') {
    sorted.sort((a, b) => (coverageCount(b.id) - coverageCount(a.id)) || (Number(a.id.replace(/^ch/, '')) - Number(b.id.replace(/^ch/, ''))))
  } else if (sortBy.value === 'recent') {
    sorted.sort((a, b) => (lastTouchedMap.value[b.id] - lastTouchedMap.value[a.id]) || (Number(a.id.replace(/^ch/, '')) - Number(b.id.replace(/^ch/, ''))))
  } else {
    sorted.sort((a, b) => Number(a.id.replace(/^ch/, '')) - Number(b.id.replace(/^ch/, '')))
  }

  // ensure totals for first screen
  // sorted.slice(0, 16).forEach(ch => ensureTotal(ch.id))
  return sorted

    // ensure ids/totals for the first page of cards
  // const first = [...list].slice(0, 16)
  // ensureMany(first.map(c => c.id))
  // return list

})

let _prefetched = false
watch(() => chapters.value, async () => {
  if (!chapters.value?.length) return
  if (_prefetched) return
  _prefetched = true

  const list = visibleChapters.value.length ? visibleChapters.value : chapters.value
  const firstIds = list.slice(0, 16).map(c => c.id)

  try {
    await ensureMany(firstIds)
    console.info('[useMaterial] Prefetch ensureMany done for first page')
  } catch (err) {
    console.warn('[useMaterial] Prefetch ensureMany failed', err)
  }
}, { immediate: true })


watch(visibleChapters, (list) => {
  list.slice(0, 16).forEach(ch => ensureTotal(ch.id))
}, { immediate: true })

// log when maps change
watch([doneMap, dueMap, wrongMap, starMap, lastTouchedMap], () => {
  console.info('[index] maps changed → snapshot:', snapshotProgress())
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
        <button @click="refetch(true).then(()=>prewarmAll('manual refetch'))" :disabled="fetching" class="px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition disabled:opacity-50">
          {{ fetching ? 'در حال بروزرسانی…' : 'بروزرسانی' }}
        </button>
      </div>
    </div>

    <!-- grid -->
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      <div v-for="ch in visibleChapters" :key="ch.id" class="group relative flex flex-col border rounded-2xl p-6 bg-white hover:shadow-lg transition">
        <!-- title link -->
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
            پیشرفت<br><span class="font-semibold">{{ statsFor(ch.id).value.done }}/{{ totals[ch.id] ?? '—' }}</span>
          </div>
          <div class="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-center">
            Due<br><span class="font-semibold">{{ statsFor(ch.id).value.due }}</span>
          </div>
          <div class="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-center">
            غلط اخیر<br><span class="font-semibold">{{ statsFor(ch.id).value.wrong }}</span>
          </div>
          <div class="px-2 py-1 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-center">
            ★<br><span class="font-semibold">{{ statsFor(ch.id).value.star }}</span>
          </div>
        </div>

        <!-- progress bar + last touched -->
        <div class="mt-2 text-xs flex items-center justify-between text-gray-600">
          <span>{{ statsFor(ch.id).value.progressPct }}%</span>
          <span class="text-gray-400">آخرین فعالیت: {{ shortTimeAgo(statsFor(ch.id).value.last || 0) }}</span>
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
            <!-- FIX: refs auto-unwrapped, use detailsStats.last NOT detailsStats.value.last -->
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
            درصد<br><span class="font-semibold">{{ detailsProgressPct }}%</span>
          </div>
        </div>

        <div class="mt-3">
          <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div class="h-full bg-indigo-500 transition-all" :style="{ width: detailsProgressPct + '%' }" />
          </div>
        </div>

        <div class="mt-5">
          <div class="text-sm font-semibold mb-2">پوشش: {{ (detailsFor?.coverage_items?.length || 0) }} مورد</div>
          <div class="flex flex-wrap gap-2">
            <span v-for="(item, i) in (detailsFor?.coverage_items || [])" :key="i" class="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200" :title="item">
              {{ item }}
            </span>
          </div>
        </div>

        <div class="mt-6 flex items-center justify-end gap-2">
          <NuxtLink v-if="detailsFor" :to="`/study/${detailsFor.id}`" class="px-3 py-2 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-sm" @click="closeDetails">
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
