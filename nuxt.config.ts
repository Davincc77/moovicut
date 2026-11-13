import { joinAppPath } from './app/utils/urls.js'
const baseURL = process.env.NUXT_APP_BASE_URL || '/'
const siteOrigin = 'https://moovicut.studio'
function canonicalUrl(routePath = '/') {
  let path = String(routePath || '/').split('?')[0]
  path = path.replace(/\/index\.html$/, '/').replace(/^index\.html$/, '/')
  if (path === '/404.html' || path === '/200.html') path = '/'
  const normalized = path === '/' ? '/' : path.replace(/\/+$/, '') || '/'
  return siteOrigin + (normalized.startsWith('/') ? normalized : `/${normalized}`)
}
export default defineNuxtConfig({
  ssr: false,
  future: { compatibilityVersion: 4 },
  srcDir: 'app/',
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  css: [
    '@fontsource/inter/400.css',
    '@fontsource/inter/500.css',
    '@fontsource/inter/600.css',
    '@fontsource/ibm-plex-sans/400.css',
    '@fontsource/ibm-plex-sans/500.css',
    '@fontsource/ibm-plex-sans/600.css',
    '@fontsource/space-grotesk/400.css',
    '@fontsource/space-grotesk/500.css',
    '@fontsource/space-grotesk/600.css',
    '~/assets/css/main.css',
  ],
  app: {
    // Served from / on https://moovicut.studio. NUXT_APP_BASE_URL can still mount a copy.
    baseURL,
    // Relative assets can be packaged or copied to a mount without rewriting HTML.
    buildAssetsDir: '_nuxt/',
    // Nuxt joins this mount-aware prefix with _nuxt/, so nested routes never
    // request /studio/_nuxt from a nested document.
    cdnURL: baseURL,
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Moovicut — local storyboard studio',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0a0a0f' },
        { name: 'description', content: 'Turn a story premise into a free local storyboard. Copy the prompts into Grok Imagine, Google, or any other AI image or video model. Moovicut does not render video.' },
        { property: 'og:title', content: 'Moovicut — local storyboard studio' },
        { property: 'og:description', content: 'Turn a story premise into a free local storyboard. Copy the prompts into Grok Imagine, Google, or any other AI image or video model. Moovicut does not render video.' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Moovicut — local storyboard studio' },
        { name: 'twitter:description', content: 'Turn a story premise into a free local storyboard. Copy the prompts into Grok Imagine, Google, or any other AI image or video model. Moovicut does not render video.' },
        { name: 'color-scheme', content: 'dark' },
        { property: 'og:url', content: canonicalUrl('/') },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Moovicut' },
        { name: 'application-name', content: 'Moovicut' },
        { name: 'apple-mobile-web-app-title', content: 'Moovicut' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: joinAppPath(baseURL, '/favicon.svg') },
        { rel: 'apple-touch-icon', href: joinAppPath(baseURL, '/apple-touch-icon.png') },
        { rel: 'manifest', href: joinAppPath(baseURL, '/manifest.webmanifest') },
        { rel: 'canonical', href: canonicalUrl('/') }
      ],
      script: [
        {
          src: 'https://static.cloudflareinsights.com/beacon.min.js',
          type: 'module',
          tagPosition: 'bodyClose',
          'data-cf-beacon': '{"token": "d4d43f476a9e4f7b9f3d9d8d4dd75a3b"}'
        }
      ]
    }
  },
  runtimeConfig: { public: { appUrl: siteOrigin, productionOrigin: siteOrigin } },
  nitro: {
    preset: 'static',
    prerender: {
      crawlLinks: true,
      routes: [
        ...['/', '/faq', '/studio', '/agents', '/privacy', '/terms', '/content-policy']
      ].map(route => joinAppPath(baseURL, route))
    }
  },
  hooks: {
    'nitro:init'(nitro) {
      nitro.hooks.hook('prerender:generate', (route) => {
        if (!route.contents) return
        const file = String(route.fileName || route.route || '')
        if (!file.endsWith('.html') && !String(route.route || '').startsWith('/')) return
        const url = canonicalUrl(route.route)
        let html = Buffer.isBuffer(route.contents) ? route.contents.toString('utf8') : String(route.contents)
        if (!html.includes('<html')) return
        html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`)
        html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`)
        if (!html.includes('rel="canonical"')) html = html.replace('</head>', `<link rel="canonical" href="${url}"></head>`)
        if (!html.includes('property="og:url"')) html = html.replace('</head>', `<meta property="og:url" content="${url}"></head>`)
        route.contents = html
      })
    }
  }
})
