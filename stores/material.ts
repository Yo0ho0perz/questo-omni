// stores/material.ts
import { defineStore } from 'pinia'
import { useTimeAgo } from '@vueuse/core'

export interface Chapter { id: string; title: string; desc?: string; coverage_items?: string[] }
export interface QItem {
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

type ChapterItems = Record<string, QItem[]>

export const useMaterialStore = defineStore('material', () => {
  const cfg = useRuntimeConfig().public
  const chapters = ref<Chapter[]>([])
  const itemsByChapter = ref<ChapterItems>({})
  const fetchedAt = ref(0)
  const loading = ref(false)

  async function _fetchJSON<T>(path: string): Promise<T> {
    return await $fetch<T>(`${path}?ver=${cfg.appVersion}`)
  }

  async function fetchChapters(force = false) {
    if (loading.value) return
    if (!force && chapters.value.length) return
    loading.value = true
    try {
      const data = await _fetchJSON<Chapter[]>('/material/chapters.json')
      chapters.value = (Array.isArray(data) ? data : []).map(ch => ({
        ...ch,
        coverage_items: Array.isArray(ch.coverage_items) ? ch.coverage_items : [],
      }))
      fetchedAt.value = Date.now()
    } finally {
      loading.value = false
    }
  }

  async function fetchChapterItems(chId: string, force = false) {
    if (!force && itemsByChapter.value[chId]) return
    const data = await _fetchJSON<QItem[]>(`/material/${chId}.json`)
    itemsByChapter.value = { ...itemsByChapter.value, [chId]: Array.isArray(data) ? data : [] }
  }

  async function ensureMany(chIds: string[]) {
    await Promise.all(chIds.map(id => fetchChapterItems(id)))
  }

  const idIndex = computed<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {}
    for (const ch of chapters.value) {
      out[ch.id] = (itemsByChapter.value[ch.id] || []).map(i => i.id)
    }
    return out
  })

  const totals = computed<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    for (const ch of chapters.value) {
      out[ch.id] = (itemsByChapter.value[ch.id] || []).length
    }
    return out
  })

  // SSR-safe: render string on server, becomes reactive on client
  const timeAgo = useTimeAgo(fetchedAt, { showSecond: false })

  return {
    chapters, itemsByChapter, fetchedAt, loading,
    fetchChapters, fetchChapterItems, ensureMany,
    idIndex, totals, timeAgo,
  }
})
