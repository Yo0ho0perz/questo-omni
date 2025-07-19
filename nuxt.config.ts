import { version } from './package.json'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@nuxt/image',
    '@nuxt/ui',
    '@unocss/nuxt',
    '@vueuse/nuxt',
    '@vite-pwa/nuxt'
  ],
   runtimeConfig: {
    public: {
      appVersion: version,
      refreshInterval: 6 * 60 * 60 * 1_000, // 6 h
    },
  },

  pwa: {
    registerType: 'prompt',
    manifest: {
      name: 'Exam Trainer',
      short_name: 'Trainer',
      start_url: '/',
      display: 'standalone',
      theme_color: '#3b82f6',
      background_color: '#ffffff',
      icons: [
        { src: '/icons/192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,jpg,json,woff2}'],
      runtimeCaching: [
        {
          urlPattern: ({ url }) => url.pathname.startsWith('/material/'),
          handler: 'CacheFirst',
          options: { cacheName: 'materials', expiration: { maxEntries: 100, maxAgeSeconds: 31536000 } },
        },
        {
          urlPattern: ({ url }) => url.pathname.endsWith('.pdf'),
          handler: 'CacheFirst',
          options: { cacheName: 'pdfs', expiration: { maxEntries: 50, maxAgeSeconds: 31536000 } },
        },
      ],
    },
  },

    app: {
    head: {
      link: [
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap'
        }
      ]
    }
  },
  css: ['~/assets/css/main.css']  // see next step

})