<template>
  <nav
    class="fixed bottom-0 inset-x-0 z-20 bg-white/90 backdrop-blur
           border-t flex gap3 px4 py2 overflow-x-auto
           [&>button]:shrink-0 touch-pan-x"
  >
    <button class="icn" @click="$emit('toggleView')">
      <icon :name="view === 'card' ? 'ph:list' : 'ph:squares-four'" />
    </button>

    <button class="icn" @click="$emit('toggleSort')">
      <icon :name="sort === 'page' ? 'ph:shuffle' : 'ph:sort-ascending'" />
    </button>

    <button class="icn" @click="$emit('toggleReveal')">
      <icon :name="reveal ? 'ph:eye-slash' : 'ph:eye'" />
    </button>

    <button
      v-for="f in filters"
      :key="f.key"
      class="tag "
      :class="{ active: filter === f.key }"
      @click="$emit('setFilter', f.key)"
    >
      <icon :name="f.icon" /> {{ f.label }}
    </button>

    <div class="ml-auto flex items-center gap2">
      <!-- <progress :value="done" :max="total" class="h2 rounded" /> -->
      <button class="icn" @click="$emit('export')">
        <icon name="ph:export" />
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
defineProps<{
  view: 'card' | 'list'
  sort: 'page' | 'random'
  reveal: boolean
  filter: 'due' | 'wrong' | 'highlight' | 'all'
  total: number
  done: number
}>()

const filters = [
  { key: 'due', label: 'Due', icon: 'ph:clock-counter-clockwise' },
  { key: 'wrong', label: 'Wrong', icon: 'ph:x-circle' },
  { key: 'highlight', label: '★', icon: 'ph:star' },
  { key: 'all', label: 'All', icon: 'ph:list-bullets' },
]
</script>

<style scoped>
.icn{
  --at-apply: w-8 h-8 flex items-center justify-center rounded
         hover:bg-gray-100 active:bg-gray-200 transition;
}

.tag{
  --at-apply: flex items-center gap-1 px-3 py-1 rounded-full text-sm whitespace-nowrap
         hover:bg-gray-100 active:bg-gray-200;

}

.tag.active{
  --at-apply: bg-blue-100 text-blue-600;
}

nav::-webkit-scrollbar{
  display: none;
}

</style>
