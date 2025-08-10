// composables/useLeitner.ts
import { useStorage } from '@vueuse/core'
import { computed } from 'vue'

export interface QuestionState {
  box: number
  next: number
  highlight?: boolean
  revealed?: boolean
  revealedAt?: number
  lastText?: string         // برای short-answer
  log: { t: number; ok: boolean }[]
  lastChosen?: number
}

const BOX_INTERVAL = [0, 1, 3, 7, 14, 30] // days

export function useLeitner(chapter: string) {
  const state = useStorage<Record<string, QuestionState>>(
    `leitner:${chapter}`,
    {}
  )

  async function logToTelegram(text: string) {
    await $fetch('/api/log-action', { method: 'POST', body: { msg: text } })
  }

  function ensure(id: string) {
    if (!state.value[id]) {
      const now = Date.now()
      state.value[id] = { box: 0, next: now, log: [], revealed: false }
    }
    return state.value[id]
  }

  // پاسخ ثبت‌شده (MCQ/Short)، و حتماً revealed هم می‌شود
  async function record(id: string, ok: boolean, chosenIdx?: number, shortText?: string) {
    const now = Date.now()
    const existing = ensure(id)
    const box = Math.min(Math.max(ok ? existing.box + 1 : 0, 0), BOX_INTERVAL.length - 1)
    const next = now + BOX_INTERVAL[box] * 86_400_000
    const log = [...existing.log, { t: now, ok }]
    state.value = {
      ...state.value,
      [id]: {
        ...existing,
        box,
        next,
        log,
        lastChosen: chosenIdx,
        lastText: shortText ?? existing.lastText,
        revealed: true,
        revealedAt: now
      }
    }
    // await logToTelegram(`📝 Q:#${id} – ${ok ? '✅' : '❌'}`)
  }

  // فقط «دیدن پاسخ» را کش کن
  async function markRevealed(id: string) {
    const now = Date.now()
    const existing = ensure(id)
    state.value = {
      ...state.value,
      [id]: { ...existing, revealed: true, revealedAt: now }
    }
    // await logToTelegram(`👁️ Q:${id} – show answer`)
  }

  async function toggleHighlight(id: string) {
    const existing = ensure(id)
    const newVal = !existing.highlight
    state.value = {
      ...state.value,
      [id]: { ...existing, highlight: newVal }
    }
    // اختیاری: لاگ
    // await logToTelegram(newVal ? `⭐ #${id}` : `😐 #${id}`)
  }

  async function reset(id: string) {
    const { [id]: _, ...rest } = state.value
    state.value = rest
    await logToTelegram(`♻️ #${id} reset`)
  }

  const dueIds = computed(() =>
    Object.entries(state.value)
      .filter(([, v]) => Date.now() >= v.next)
      .map(([id]) => id)
  )

  return { state, record, markRevealed, toggleHighlight, reset, dueIds }
}
