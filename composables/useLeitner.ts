// composables/useLeitner.ts
import { useStorage } from '@vueuse/core'
import { computed } from 'vue'

export interface QuestionState {
  box: number
  next: number
  highlight?: boolean
  log: { t: number; ok: boolean }[]
  lastChosen?: number
}

const BOX_INTERVAL = [0, 1, 3, 7, 14, 30] // in days

export function useLeitner(chapter: string) {
  const state = useStorage<Record<string, QuestionState>>(
    `leitner:${chapter}`,
    {}
  )

  function record(id: string, ok: boolean, chosenIdx?: number) {
    const now = Date.now()
    const existing = state.value[id] ?? { box: 0, next: now, log: [] }
    const box = Math.min(Math.max(ok ? existing.box + 1 : 0, 0), BOX_INTERVAL.length - 1)
    const next = now + BOX_INTERVAL[box] * 86_400_000
    const log = [...existing.log, { t: now, ok }]
    state.value = {
      ...state.value,
      [id]: {
        box,
        next,
        highlight: existing.highlight,
        log,
        lastChosen: chosenIdx
      }
    }
  }

  function toggleHighlight(id: string) {
    const existing = state.value[id]
    if (!existing) return
    state.value = {
      ...state.value,
      [id]: { ...existing, highlight: !existing.highlight }
    }
  }

  function reset(id: string) {
    const { [id]: _, ...rest } = state.value
    state.value = rest
  }

  const dueIds = computed(() =>
    Object.entries(state.value)
      .filter(([, v]) => Date.now() >= v.next)
      .map(([id]) => id)
  )

  return { state, record, toggleHighlight, reset, dueIds }
}
