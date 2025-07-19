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

  async function logToTelegram(text: string) {
    await $fetch('/api/log-action', {
      method: 'POST',
      body: { msg: text }
    })
  }

  // 1) record now logs the actual choice or “short:<text>”
  async function record(id: string, ok: boolean, chosenIdx?: number, shortText?: string) {
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
    const choiceDesc = chosenIdx != null
      ? `choice=${String.fromCharCode(65 + chosenIdx)}`
      : shortText != null
        ? `short="${shortText}"`
        : ''
    // await logToTelegram(`📝 Q:#${id} – ${ok ? '✅' : '❌'} ${choiceDesc}`)
  }

  // 2) new reveal logger
  async function logReveal(id: string) {
    const now = Date.now()
    // await logToTelegram(`👁️ Q:${id} – show answer`)
  }

  async function toggleHighlight(id: string) {
    const existing = state.value[id]
    if (!existing) return
    state.value = {
      ...state.value,
      [id]: { ...existing, highlight: !existing.highlight }
    }
    !existing.highlight ? await logToTelegram(`⭐ #${id} ^_^`) : await logToTelegram(`😐 #${id} 🙆`)
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

  return { state, record, logReveal, toggleHighlight, reset, dueIds }
}
