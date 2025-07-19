<!-- components/QuestionCard.vue -->
<template>
  <article class="rtl bg-white rounded-2xl px-2 py-6 my-6 shadow-lg flex flex-col gap-4">
    <header class="flex items-start justify-between">
      <h3 class="text-xl font-semibold flex-1">{{ q.question }}</h3>
      <div @click="toggleHighlight(q.id)" class="p-2 rounded-full hover:bg-gray-100 transition">
        <icon :name="qState?.highlight ? 'ph:star-fill' : 'ph:star'" class=" mt-2 text-yellow-500 text-lg" />
      </div>
    </header>

    <!-- MCQ -->
    <div v-if="q.type === 'mcq'" class="grid gap-3">
      <button
        v-for="(opt, idx) in q.options"
        :key="idx"
        @click="recordAnswer(idx === q.answer, idx)"
        :class="[
          'w-full text-left px-4 py-2 rounded-xl border transition',
          revealed
            ? (idx === q.answer
                ? 'bg-green-100 border-green-400 text-green-800'
                : idx === lastChosen && lastCorrect === false
                  ? 'bg-red-100 border-red-400 text-red-700'
                  : 'opacity-50')
            : 'hover:bg-gray-50 focus:ring-2 focus:ring-offset-1 focus:ring-indigo-200'
        ]"
      >
        {{ String.fromCharCode(65 + idx) }}. {{ opt }}
      </button>
    </div>

    <!-- Short-answer -->
    <div v-else class="flex flex-col gap-3">
      <input
        v-model="user"
        :disabled="revealed"
        placeholder="پاسخ خود را تایپ کنید…"
        class="w-60 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-200 transition"
      />
    </div>

    <!-- Controls -->
    <div class="flex items-center gap-4 mt-4">
      <button
        v-if="q.type === 'short' && !revealed"
        @click="submitShort"
        class="bg-indigo-600 text-white px-5 py-2 rounded-full hover:bg-indigo-700 transition"
      >
        ارسال
      </button>
      <button
        v-if="!revealed"
        @click="reveal"
        class="text-indigo-600 px-4 py-2 rounded-full border border-indigo-200 hover:bg-indigo-50 transition"
      >
        دیدن پاسخ
      </button>
      <button
        v-if="revealed"
        @click="resetAnswer"
        class="text-sm text-gray-600 hover:underline"
      >
        دوباره پاسخ بده
      </button>
    </div>

    <!-- Answer Panel -->
    <div v-if="revealed" class="mt-0 space-y-2 border-t pt-0">
      <p class="font-semibold text-green-700">
        پاسخ:
        <span v-if="q.type === 'mcq'">{{ q.options[q.answer] }}</span>
        <span v-else>{{ q.answer }}</span>
      </p>
      <p v-if="q.hint"><strong>نکته:</strong> {{ q.hint }}</p>
      <p>{{ q.extra }}</p>
      <a :href="`/pdf#page=${q.page}`" target="_blank" class="text-sm underline">
        دیدن صفحه {{ q.page }}
      </a>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useLeitner } from '~/composables/useLeitner'

const props = defineProps<{
  q: {
    id: string
    type: 'mcq' | 'short'
    question: string
    options?: string[]
    answer: number | string
    hint?: string
    extra?: string
    page: number
  }
  chapter: string
}>()

const { record, toggleHighlight, state, reset } = useLeitner(props.chapter)
const qState = computed(() => state.value[props.q.id] || {})

const revealed = ref(false)
const lastChosen = ref<number|undefined>(undefined)
const lastCorrect = ref<boolean|undefined>(undefined)
const user = ref('')

onMounted(() => {
  const s = qState.value
  if (s.log?.length) {
    revealed.value = true
    const last = s.log[s.log.length - 1]
    lastCorrect.value = last.ok
    lastChosen.value = s.lastChosen
  }
})

function recordAnswer(ok: boolean, idx: number) {
  record(props.q.id, ok, idx)
  lastChosen.value = idx
  lastCorrect.value = ok
  revealed.value = true
}

function submitShort() {
  const ok = user.value.trim().toLowerCase() === String(props.q.answer).toLowerCase()
  recordAnswer(ok, -1)
}

function reveal() {
  revealed.value = true
}

function resetAnswer() {
  reset(props.q.id)
  revealed.value = false
  lastChosen.value = undefined
  lastCorrect.value = undefined
  user.value = ''
}
</script>

<style scoped>
.rtl { direction: rtl; }
</style>
