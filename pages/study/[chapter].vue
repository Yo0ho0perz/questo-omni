<!-- pages/study/[chapter].vue -->
<script setup lang="ts">
import QuestionCard from '~/components/QuestionCard.vue'
import QuickRow from '~/components/QuickRow.vue'
import ControlBar from '~/components/ControlBar.vue'
import MarkdownText from '~/components/MarkdownText.vue'
import { useMaterialStore } from '~/stores/material'
import { useProgressStore } from '~/stores/progress'
import shuffle from 'lodash-es/shuffle'

const chapter = useRoute().params.chapter as string
const mat = useMaterialStore()
const prog = useProgressStore()

await mat.fetchChapters()
await mat.fetchChapterItems(chapter)

const chapterMeta = computed(() => mat.chapters.find(c => c.id === chapter) || null)
const questions   = computed(() => mat.itemsByChapter[chapter] || [])

// reconcile once per material change
watch(questions, (qs) => {
  const ids = new Set(qs.map(q => q.id))
  prog.reconcile(chapter, ids)
}, { immediate: true })

/* header stats */
const total = computed(() => questions.value.length)
const chStats = computed(() => {
  const ids = questions.value.map(q => q.id)
  const st = prog.statsFor(chapter, ids)
  const progressPct = total.value > 0 ? Math.round((st.done / total.value) * 100) : 0
  return { ...st, progressPct }
})

/* controls */
const view   = ref<'card' | 'list'>('card')
const sort   = ref<'page' | 'random'>('page')
const filter = ref<'due'|'wrong'|'highlight'|'all'>('all')
const reveal = ref(false)

/* filtered/sorted list */
const visible = computed(() => {
  let list = questions.value || []
  const ids = list.map(q => q.id)
  const entries = new Map(prog.entriesFor(chapter, ids))
  list = list.filter((q) => {
    const s = entries.get(q.id)
    switch (filter.value) {
      case 'due':       return !s || Date.now() >= (s.next || 0)
      case 'wrong': {
        const hasLog = s?.log && s.log.length
        if (!hasLog) return false
        const lastEntry = s!.log[s!.log.length - 1]
        return !!lastEntry && lastEntry.ok === false
      }
      case 'highlight': return !!s?.highlight
      default:          return true
    }
  })
  return (sort.value === 'random') ? shuffle(list) : [...list].sort((a,b) => a.page - b.page)
})

/* export */
function exportLog() {
  const blob = new Blob([JSON.stringify(prog.store.value[chapter] || {})], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${chapter}-progress.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <NuxtLink class="fixed bg-black w-full h-min top-0 z-10 text-white items-center flex justify-center right-0 px-2 py-2 hover:bg-gray hover:pr-28 transition-all hover:py-4 -mr-2" to="/" aria-label="Back">
    <Icon name="ph:arrow-left"/>
  </NuxtLink>

  <main class="pt-14 pb-24 max-w-6xl mx-auto px-4 sm:px-6">
    <section class="mb-6">
      <div class="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div class="p-5 flex items-start gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="text-2xl font-extrabold truncate">
                {{ chapterMeta?.title || `Chapter ${chapter.replace(/^ch/, '')}` }}
              </h1>
              <span v-if="total" class="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {{ total }} سؤال
              </span>
              <span class="text-xs text-gray-500">
                آخرین به‌روزرسانی فهرست: {{ (mat.timeAgo as any) }}
              </span>
            </div>

            <span class="px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
              پیشرفت: {{ chStats.done }}/{{ total }} ({{ chStats.progressPct }}%)
            </span>
            <span class="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              موعد (Due): {{ chStats.due }}
            </span>
            <span class="px-2 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700">
              پاسخ غلط اخیر: {{ chStats.wrong }}
            </span>
            <span class="px-2 py-1 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700">
              نشان‌شده (★): {{ chStats.star }}
            </span>

            <div v-if="chapterMeta?.desc" class="mt-3">
              <MarkdownText :content="chapterMeta.desc" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <section>
      <component
        v-for="(q, i) in visible"
        :is="view==='card' ? QuestionCard : QuickRow"
        :key="q.id"
        :q="q"
        :chapter="chapter"
        :idx="i"
        :reveal="reveal"
      />
    </section>
  </main>

  <ControlBar
    :view="view" :sort="sort" :reveal="reveal" :filter="filter"
    :total="total" :done="chStats.done"
    @toggleView="view = view === 'card' ? 'list' : 'card'"
    @toggleSort="sort = sort === 'page' ? 'random' : 'page'"
    @toggleReveal="reveal = !reveal"
    @setFilter="filter = $event"
    @export="exportLog"
  />
</template>
