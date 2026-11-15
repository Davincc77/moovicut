export default defineNuxtPlugin(nuxtApp => {
  const { t, th, boot } = useI18n()
  boot()
  nuxtApp.vueApp.config.globalProperties.$t = t
  nuxtApp.vueApp.config.globalProperties.$th = th
})
