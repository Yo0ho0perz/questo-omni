// composables/useMaterial.ts
import { useStorage, useTimeAgo, useIntervalFn } from '@vueuse/core'

interface Stored<T> { data: T[]; fetched: number }
const TIMEOUT = 60_000

export function useMaterial<T = any>(chapter: string) {
  const cfg = useRuntimeConfig().public
  const store = useStorage<Stored<T>>(`material:${chapter}`, { data: [], fetched: 0 })
  const fetching = ref(false)

  async function refetch(force = false) {
    if (fetching.value) return
    if (!force && !navigator.onLine) return
    fetching.value = true
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
    try {
          console.info(`[material] fetching ${chapter}.json`)

      const data = await $fetch<T[]>(`/material/${chapter}.json?ver=${cfg.appVersion}`, { signal: ctrl.signal })
      store.value = { data, fetched: Date.now() }
        console.info(`[material] ${chapter} fetched OK (${data.length} records)`)

    } catch (err) {
          console.warn(`[material] failed for ${chapter}:`, err)

    } finally {
      clearTimeout(timer)
      fetching.value = false
    }
  }

  onMounted(() => { if (!store.value.data.length) refetch(true) })
  useIntervalFn(() => refetch(false), cfg.refreshInterval)

  const timeAgo = useTimeAgo(() => store.value.fetched, { showSecond: false })

  return {
    material: computed(() => store.value.data),
    fetched: computed(() => store.value.fetched),
    timeAgo,
    refetch,
    fetching,
  }
}
