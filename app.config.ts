export default defineAppConfig({
  // was boolean — now nullable event
  installPrompt: null as null | BeforeInstallPromptEvent,
})
