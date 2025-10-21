// composables/useChapterProgress.ts
import { reactive, computed, watch } from 'vue'
import { useLeitner } from '~/composables/useLeitner'

export type QuestionState = ReturnType<typeof useLeitner> extends infer R
  ? R extends { state: any } ? R : never
  : never

type Stats = {
  done: number
  due: number
  wrong: number
  star: number
  last: number
  progressPct: number
}

const totals = reactive<Record<string, number>>({})
const idIndex = reactive<Record<string, string[]>>({})

/** Fetch /material/<chapter>.json, cache ids+totals, and reconcile progress. */
async function ensureIndex(chId: string) {
  if (idIndex[chId] && totals[chId] != null) return
  const cfg = useRuntimeConfig().public
  const data = await $fetch<any[]>(`/material/${chId}.json?ver=${cfg.appVersion}`)
  idIndex[chId] = Array.isArray(data) ? data.map(q => q.id) : []
  totals[chId]  = Array.isArray(data) ? data.length : 0
  const { reconcile } = useLeitner(chId)
  reconcile(new Set(idIndex[chId]))
}

/** Reconcile using an array of current questions (useful in the chapter page). */
function reconcileFromQuestions(chId: string, questions: { id: string }[]) {
  idIndex[chId] = (questions || []).map(q => q.id)
  totals[chId]  = idIndex[chId].length
  const { reconcile } = useLeitner(chId)
  reconcile(new Set(idIndex[chId]))
}

/** Return entries (id,state) that are STILL valid for this chapter. */
function entriesFor(chId: string) {
  const ids = new Set(idIndex[chId] || [])
  const { state } = useLeitner(chId)
  return computed(() =>
    Object.entries(state.value || {}).filter(([id]) => ids.has(id))
  )
}

/** Reactive stats for a chapter (based ONLY on current ids). */
function statsFor(chId: string) {
  const entries = entriesFor(chId)
  const done  = computed(() => entries.value.length)
  const due   = computed(() => entries.value.filter(([, v]: any) => Date.now() >= (v?.next || 0)).length)
  const wrong = computed(() => entries.value.filter(([, v]: any) => v?.log?.length && v.log.at(-1)!.ok === false).length)
  const star  = computed(() => entries.value.filter(([, v]: any) => v?.highlight).length)
  const last  = computed(() => {
    const ts = entries.value.flatMap(([, v]: any) => [...(v?.log?.map((l: any) => l.t) || []), v?.revealedAt || 0])
    return ts.length ? Math.max(...ts) : 0
  })
  const progressPct = computed(() => {
    const total = totals[chId] ?? 0
    return total > 0 ? Math.round((done.value / total) * 100) : 0
  })

  return computed<Stats>(() => ({
    done: done.value,
    due : due.value,
    wrong: wrong.value,
    star : star.value,
    last : last.value,
    progressPct: progressPct.value,
  }))
}

/** Utility to refresh ids+totals for many chapters at once. */
async function ensureMany(chIds: string[]) {
  await Promise.all(chIds.map(ensureIndex))
}

export function useChapterProgress() {
  return {
    // state
    totals,
    idIndex,

    // actions
    ensureIndex,
    ensureMany,
    reconcileFromQuestions,

    // selectors
    entriesFor,
    statsFor,
  }
}
