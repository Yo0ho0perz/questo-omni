// composables/useLeitner.ts
import { useStorage } from '@vueuse/core'
import { computed, watch } from 'vue'

export interface QuestionState {
  box: number
  next: number
  highlight?: boolean
  revealed?: boolean
  revealedAt?: number
  lastText?: string      // short-answer text
  log: { t: number; ok: boolean }[]
  lastChosen?: number
}

const BOX_INTERVAL = [0, 1, 3, 7, 14, 30] // days
const DAY_MS = 86_400_000

export function useLeitner(chapter: string, opts?: { debug?: boolean }) {
  const key = `leitner:${chapter}`

  // IMPORTANT: writeDefaults:false so we never overwrite existing LS with {}
  const state = useStorage<Record<string, QuestionState>>(
    key,
    {},
    undefined,
    {
      mergeDefaults: true,
      listenToStorageChanges: true,
      writeDefaults: false
    }
  )

  // Optional hydration (defensive): if ref empty but LS has data
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Object.keys(state.value || {}).length) {
        if (opts?.debug) console.info(`[leitner] hydrate ${key} with ${Object.keys(parsed).length} items`)
        state.value = parsed
      }
    }
  } catch (e) {
    if (opts?.debug) console.warn(`[leitner] hydrate failed for ${key}`, e)
  }

  if (opts?.debug) {
    watch(state, (val) => {
      console.info(`[leitner] ${key} changed: size=${Object.keys(val || {}).length}`, val)
    }, { deep: true })
  }

  function ensure(id: string) {
    if (!state.value[id]) {
      const now = Date.now()
      state.value = {
        ...state.value,
        [id]: { box: 0, next: now, log: [], revealed: false }
      }
      if (opts?.debug) console.info(`[leitner] ensure ${key} -> ${id}`)
    }
    return state.value[id]
  }

  /** Record an answer (MCQ/Short). Also marks revealed. */
  async function record(id: string, ok: boolean, chosenIdx?: number, shortText?: string) {
    const now = Date.now()
    const existing = ensure(id)
    const newBox = Math.min(Math.max(ok ? existing.box + 1 : 0, 0), BOX_INTERVAL.length - 1)
    const next = now + BOX_INTERVAL[newBox] * DAY_MS
    const log = [...(existing.log || []), { t: now, ok }]

    state.value = {
      ...state.value,
      [id]: {
        ...existing,
        box: newBox,
        next,
        log,
        lastChosen: chosenIdx,
        lastText: shortText ?? existing.lastText,
        revealed: true,
        revealedAt: now
      }
    }
    if (opts?.debug) console.info(`[leitner] record ${key} -> ${id} ok=${ok} box=${newBox}`)
  }

  /** Cache "show answer" without answering */
  async function markRevealed(id: string) {
    const now = Date.now()
    const existing = ensure(id)
    state.value = {
      ...state.value,
      [id]: { ...existing, revealed: true, revealedAt: now }
    }
    if (opts?.debug) console.info(`[leitner] reveal ${key} -> ${id}`)
  }

  async function toggleHighlight(id: string) {
    const existing = ensure(id)
    const highlight = !existing.highlight
    state.value = {
      ...state.value,
      [id]: { ...existing, highlight }
    }
    if (opts?.debug) console.info(`[leitner] star ${key} -> ${id} = ${highlight}`)
  }

  async function reset(id: string) {
    const { [id]: _, ...rest } = state.value
    state.value = rest
    if (opts?.debug) console.info(`[leitner] reset ${key} -> ${id}`)
  }

  /** Computed: list of due question IDs (today/past) */
  const dueIds = computed(() =>
    Object.entries(state.value)
      .filter(([, v]) => Date.now() >= (v?.next ?? 0))
      .map(([id]) => id)
  )

  /**
   * Helper: stats based on *only* a provided list of question IDs.
   * Usage in chapter page:
   *   const qIds = computed(() => (questions.value||[]).map(q=>q.id))
   *   const stats = makeStats(qIds)
   *   stats.done.value, stats.due.value, …
   */
  function makeStats(idsRef: { value: string[] }) {
    const idSet = computed(() => new Set(idsRef.value))
    const validEntries = computed(() =>
      Object.entries(state.value || {}).filter(([id, v]) =>
        idSet.value.has(id) && v && typeof v.box === 'number' && typeof v.next === 'number'
      )
    )
    const done = computed(() => validEntries.value.length)
    const due  = computed(() => validEntries.value.filter(([,v]) => Date.now() >= v.next).length)
    const wrong= computed(() => validEntries.value.filter(([,v]) => Array.isArray(v.log) && v.log.length && v.log.at(-1)!.ok === false).length)
    const star = computed(() => validEntries.value.filter(([,v]) => v.highlight).length)
    return { done, due, wrong, star, entries: validEntries }
  }

  return { state, record, markRevealed, toggleHighlight, reset, dueIds, makeStats }
}
