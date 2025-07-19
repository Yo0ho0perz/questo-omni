export default defineNuxtPlugin(() => {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    useAppConfig().installPrompt = e as BeforeInstallPromptEvent
    // 🔈 dev log
    console.info('[PWA] captured beforeinstallprompt event')
  })
})
