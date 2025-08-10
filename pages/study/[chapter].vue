<!-- pages/study/[chapter].vue -->
<script setup lang="ts">
import QuestionCard from '~/components/QuestionCard.vue'
import QuickRow from '~/components/QuickRow.vue'
import ControlBar from '~/components/ControlBar.vue'
import MarkdownText from '~/components/MarkdownText.vue'
import { useLeitner } from '~/composables/useLeitner'
import { useMaterial } from '~/composables/useMaterial'
import { useStorage } from '@vueuse/core'
import shuffle from 'lodash-es/shuffle'

type QType = {
  id: string
  type: 'mcq' | 'short'
  question: string
  options?: string[]
  answer: number | string
  hint?: string
  extra?: string
  page: number
  Rel?: string
  meta?: Record<string, string>
}

interface ChapterMeta {
  id: string
  title: string
  desc?: string
  coverage_items?: string[]
}

const chapter = useRoute().params.chapter as string

/* pull questions for this chapter */
const { material: questions } = useMaterial<QType>(chapter)

/* pull chapter metadata from chapters.json */
const { material: allChapters, timeAgo: chaptersTimeAgo } = useMaterial<ChapterMeta>('chapters')
const chapterMeta = computed<ChapterMeta | null>(() => {
  const list = allChapters.value || []
  return (list.find(c => c.id === chapter) ?? null)
})

/* leitner state */
const { state, dueIds } = useLeitner(chapter)

/* control states */
const view   = ref<'card' | 'list'>('card')
const sort   = ref<'page' | 'random'>('page')
const filter = ref<'due'|'wrong'|'highlight'|'all'>('all')
const reveal = ref(false)

/* header expand/collapse persisted per chapter */
const collapsed = useStorage<boolean>(`hdr:${chapter}:collapsed`, true)

/* list according to controls */
const visible = computed(() => {
  let list = questions.value || []
  // filter
  list = list.filter((q) => {
    const s = state.value[q.id]
    switch (filter.value) {
      case 'due':       return !s || Date.now() >= s.next
      case 'wrong':     return s?.log?.at(-1)?.ok === false
      case 'highlight': return !!s?.highlight
      default:          return true
    }
  })
  // sort
  list = sort.value === 'random'
    ? shuffle(list)
    : [...list].sort((a, b) => a.page - b.page)
  return list
})

/* progress + stats */
const total = computed(() => questions.value?.length ?? 0)
const done  = computed(() => Object.keys(state.value).length)
const dueCount = computed(() =>
  Object.entries(state.value).filter(([, v]) => Date.now() >= v.next).length
)
const wrongCount = computed(() =>
  Object.values(state.value).filter(v => v.log?.length && v.log[v.log.length-1].ok === false).length
)
const highlightCount = computed(() =>
  Object.values(state.value).filter(v => v.highlight).length
)

/* pretty % helper */
const pct = (num: number, den: number) => den > 0 ? Math.round((num/den)*100) : 0

/* export */
function exportLog() {
  const blob = new Blob([JSON.stringify(state.value)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${chapter}-progress.json`
  a.click()
  URL.revokeObjectURL(url)
}

/* debug */
watchEffect(() => {
  // console.log(`[study:${chapter}] visible`, visible.value)
  // console.log(`[study:${chapter}] state`, state.value)
})
</script>

<template>
  <NuxtLink
    class="fixed bg-black w-full h-min top-0 z-10 text-white items-center flex justify-center right-0 px-2 py-2 hover:bg-gray hover:pr-28 transition-all hover:py-4 -mr-2"
    to="/"
    aria-label="Back"
  >
    <Icon name="ph:arrow-left"/>
  </NuxtLink>

  <main class="pt-14 pb-24 max-w-6xl mx-auto px-4 sm:px-6">
    <!-- chapter header -->
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
                آخرین به‌روزرسانی فهرست: {{ chaptersTimeAgo }}
              </span>
            </div>

            <!-- top stats pills -->
            <div class="mt-3 flex flex-wrap gap-2 text-xs">
              <span class="px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                پیشرفت: {{ done }}/{{ total }} ({{ pct(done, total) }}%)
              </span>
              <span class="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                موعد (Due): {{ dueCount }}
              </span>
              <span class="px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                پاسخ غلط اخیر: {{ wrongCount }}
              </span>
              <span class="px-2 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                نشان‌شده (★): {{ highlightCount }}
              </span>
            </div>

            <!-- description markdown (always visible if exists) -->
            <div v-if="chapterMeta?.desc" class="mt-3">
              <MarkdownText :content="chapterMeta.desc" />
            </div>
          </div>

          <!-- collapse toggle -->
          <button
            @click="collapsed = !collapsed"
            class="shrink-0 px-3 py-2 rounded-xl border hover:bg-gray-50 transition text-sm"
            :aria-expanded="!collapsed"
          >
            {{ collapsed ? 'نمایش جزئیات پوشش' : 'بستن جزئیات' }}
          </button>
        </div>

        <!-- coverage panel -->
        <div
          class="transition-[max-height] duration-300 ease-in-out border-t"
          :style="{ maxHeight: collapsed ? '0px' : '1000px' }"
        >
          <div class="p-5">
            <div class="flex items-center justify-between mb-3">
              <h2 class="font-semibold">این فصل از زمینهٔ کلّی شما چه چیزهایی را پوشش می‌دهد؟</h2>
              <div class="text-xs text-gray-500">
                {{ chapterMeta?.coverage_items?.length || 0 }} مورد
              </div>
            </div>

            <!-- coverage chips -->
            <div v-if="chapterMeta?.coverage_items?.length" class="flex flex-wrap gap-2">
              <span
                v-for="(item, i) in chapterMeta.coverage_items"
                :key="i"
                class="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200"
                :title="item"
              >
                {{ item }}
              </span>
            </div>

            <!-- helpful legend -->
            <div class="mt-5 grid sm:grid-cols-3 gap-3 text-xs">
              <div class="rounded-xl border p-3 bg-gray-50">
                <div class="font-semibold mb-1">راهنما</div>
                <ul class="space-y-1 list-disc ms-4">
                  <li>هر آیتم = چیزی که باید در این فصل به‌طور کامل پوشش داده شود.</li>
                  <li>اگر چیزی جا افتاده بود، یک Issue باز کنید یا به من بگو.</li>
                </ul>
              </div>
              <div class="rounded-xl border p-3">
                <div class="font-semibold mb-1">فیلترهای تمرین</div>
                <ul class="space-y-1 list-disc ms-4">
                  <li><span class="font-medium">Due</span>: سوال‌های موعد مرور.</li>
                  <li><span class="font-medium">Wrong</span>: آخرین پاسخ غلط.</li>
                  <li><span class="font-medium">★</span>: نشان‌شده‌ها برای مرور سریع.</li>
                </ul>
              </div>
              <div class="rounded-xl border p-3">
                <div class="font-semibold mb-1">نحوهٔ سنجش</div>
                <ul class="space-y-1 list-disc ms-4">
                  <li>Leitner Box با فواصل افزایشی.</li>
                  <li>پیشرفت = تعداد سوال‌هایی که interacted شده‌اند.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>

    <!-- questions -->
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
    :total="total" :done="done"
    @toggleView="view = view === 'card' ? 'list' : 'card'"
    @toggleSort="sort = sort === 'page' ? 'random' : 'page'"
    @toggleReveal="reveal = !reveal"
    @setFilter="filter = $event"
    @export="exportLog"
  />
</template>

<style scoped>
/* for header expand animation: container controls max-height inline */
</style>
