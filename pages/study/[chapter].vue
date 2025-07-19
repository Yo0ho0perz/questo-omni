<script setup lang="ts">
import QuestionCard from '~/components/QuestionCard.vue'
import QuickRow from '~/components/QuickRow.vue'
import ControlBar from '~/components/ControlBar.vue'
import { useLeitner } from '~/composables/useLeitner'
import { useMaterial } from '~/composables/useMaterial'
import shuffle from 'lodash-es/shuffle'

const chapter = useRoute().params.chapter as string

/* material + storage */
const { material: questions } = useMaterial(chapter)
const { state, dueIds, record } = useLeitner(chapter)

/* control states */
const view   = ref<'card' | 'list'>('card')
const sort   = ref<'page' | 'random'>('page')
const filter = ref<'due'|'wrong'|'highlight'|'all'>('all')

const reveal = ref(false)

/* list according to controls */
const visible = computed(() => {
  let list = questions.value
  if (!list) return []

  list = list.filter((q) => {
    const s = state.value[q.id]
    switch (filter.value) {
      case 'due':  return !s || Date.now() >= s.next
      case 'wrong':return s?.log?.at(-1)?.ok === false
      case 'highlight': return s?.highlight
      default:     return true
    }
  })

  list = sort.value === 'random' ? shuffle(list) : [...list].sort((a, b) => a.page - b.page)
  return list
})

/* progress */
const done = computed(() => Object.keys(state.value).length)
const total= computed(() => questions.value.length)

/* import / export identical to previous answer */
function exportLog() {
  const blob = new Blob([JSON.stringify(state.value)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${chapter}-progress.json`
  a.click()
  URL.revokeObjectURL(url)
}


watchEffect(() => {
  console.log(`[study:${chapter}] visible`, visible.value)
})

watchEffect(() => {
  console.log(`[study:${chapter}] Leitner state`, state.value)
})

</script>

<template>
    <NuxtLink class="fixed bg-black w-full h-min top-0  z-10 text-white items-center flex justify-center right-0 px-2 py-2 hover:bg-gray hover:pr-28 transition-all hover:py-4 -mr-2" to="/"><Icon name="ph:arrow-left"/></NuxtLink>
  <main class="pb22">
    <!-- <component
      v-for="(q, i) in visible"
      :is="view === 'card' ? QuestionCard : QuickRow"
      :key="q.id"
      :q="q"
      :chapter="chapter"
      :idx="i"
      :reveal="reveal"
      @answered="record(q.id, $event)"
    /> -->

     <component
   v-for="(q, i) in visible"
   :is="view==='card' ? QuestionCard : QuickRow"
   :key="q.id"
   :q="q"
   :chapter="chapter"
   :idx="i"
   :reveal="reveal"
 />

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
