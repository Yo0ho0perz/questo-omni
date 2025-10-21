// stores/progress.ts
import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'

export type LogEntry = { t: number; ok: boolean }
export interface QuestionState {
  box: number
  next: number
  highlight?: boolean
  revealed?: boolean
  revealedAt?: number
  lastText?: string
  lastChosen?: number
  log: LogEntry[]
}
type ChapterProgress = Record<string, QuestionState>
type AllProgress = Record<string, ChapterProgress>

const BOX_INTERVAL = [0, 1, 3, 7, 14, 30]
const DAY_MS = 86_400_000

export const useProgressStore = defineStore('progress', () => {
  const store = useStorage<AllProgress>('leitner:all', {}, undefined, {
    mergeDefaults: true,
    listenToStorageChanges: true,
    writeDefaults: false,
  })

  function ensureState(prev: AllProgress, chId: string, qId: string): QuestionState {
    const ch = prev[chId] ?? {}
    const s  = ch[qId] ?? { box: 0, next: Date.now(), log: [], revealed: false } as QuestionState
    // return fresh copies (no mutation of prev)
    return s
  }

  function record(chId: string, qId: string, ok: boolean, chosenIdx?: number, shortText?: string) {
    const prev = store.value || {}
    const now  = Date.now()
    const s    = ensureState(prev, chId, qId)

    const newBox = Math.min(Math.max(ok ? s.box + 1 : 0, 0), BOX_INTERVAL.length - 1)
    const next   = now + BOX_INTERVAL[newBox] * DAY_MS
    const log    = [...(s.log || []), { t: now, ok }]

    const newQ: QuestionState = {
      ...s,
      box: newBox,
      next,
      log,
      lastChosen: chosenIdx,
      lastText: shortText ?? s.lastText,
      revealed: true,
      revealedAt: now,
    }

    const newCh: ChapterProgress = { ...(prev[chId] || {}), [qId]: newQ }
    store.value = { ...prev, [chId]: newCh }
  }

  function markRevealed(chId: string, qId: string) {
    const prev = store.value || {}
    const now  = Date.now()
    const s    = ensureState(prev, chId, qId)

    const newQ: QuestionState = { ...s, revealed: true, revealedAt: now }
    const newCh: ChapterProgress = { ...(prev[chId] || {}), [qId]: newQ }
    store.value = { ...prev, [chId]: newCh }
  }

  function toggleHighlight(chId: string, qId: string) {
    const prev = store.value || {}
    const s    = ensureState(prev, chId, qId)

    const newQ: QuestionState = { ...s, highlight: !s.highlight }
    const newCh: ChapterProgress = { ...(prev[chId] || {}), [qId]: newQ }
    store.value = { ...prev, [chId]: newCh }
  }

  function resetQuestion(chId: string, qId: string) {
    const prev = store.value || {}
    const ch   = prev[chId] || {}
    const { [qId]: _omit, ...rest } = ch
    store.value = { ...prev, [chId]: rest }
  }

  function reconcile(chId: string, validIds: Set<string>) {
    const prev = store.value || {}
    const current = prev[chId] || {}
    const nextCh: ChapterProgress = {}
    for (const id of Object.keys(current)) {
      if (validIds.has(id)) nextCh[id] = current[id]
    }
    store.value = { ...prev, [chId]: nextCh }
  }

  function entriesFor(chId: string, ids: string[]) {
    const set = new Set(ids || [])
    const ch = (store.value?.[chId]) || {}
    return Object.entries(ch).filter(([id]) => set.has(id))
  }

  function statsFor(chId: string, ids: string[]) {
    const ent = entriesFor(chId, ids)
    const done = ent.length
    let due = 0, wrong = 0, star = 0
    const times: number[] = []
    for (const [, v] of ent) {
      if (Date.now() >= (v.next || 0)) due++
      if (v.highlight) star++
      if (Array.isArray(v.log) && v.log.length) {
        const lastEntry = v.log[v.log.length - 1]
        if (lastEntry && lastEntry.ok === false) wrong++
        for (const l of v.log) times.push(l.t)
      }
      if (v.revealedAt) times.push(v.revealedAt)
    }
    const last = times.length ? Math.max(...times) : 0
    return { done, due, wrong, star, last }
  }

  function dueIds(chId: string, ids: string[]) {
    const set = new Set(ids || [])
    const ch = (store.value?.[chId]) || {}
    const out: string[] = []
    for (const [id, v] of Object.entries(ch)) {
      if (set.has(id) && Date.now() >= (v.next || 0)) out.push(id)
    }
    return out
  }

  return {
    store,
    record, markRevealed, toggleHighlight, resetQuestion, reconcile,
    entriesFor, statsFor, dueIds,
  }
})
