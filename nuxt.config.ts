import { joinAppPath } from './app/utils/urls.js'
import { socialPreviewMeta, upsertSocialMeta } from './app/utils/social-preview.js'
import { hreflangEntries } from './app/i18n/logic.js'
const baseURL = process.env.NUXT_APP_BASE_URL || '/'
const siteOrigin = 'https://moovicut.studio'
const socialPreview = socialPreviewMeta(siteOrigin, baseURL)
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
        { name: 'twitter:title', content: 'Moovicut — local storyboard studio' },
        { name: 'twitter:description', content: 'Turn a story premise into a free local storyboard. Copy the prompts into Grok Imagine, Google, or any other AI image or video model. Moovicut does not render video.' },
        ...socialPreview,
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
          innerHTML: `(function(){try{var q=new URLSearchParams(location.search).get('lang');var s='';try{s=localStorage.getItem('moovicut.language')||''}catch(e){}function g(t){t=String(t||'').toLowerCase().replace(/_/g,'-');if(t==='zh-hans'||t.indexOf('zh-hans-')===0||t==='zh-cn'||t.indexOf('zh-cn-')===0||t==='zh-sg'||t.indexOf('zh-sg-')===0||t==='zh')return 'zh-Hans';if(t.indexOf('pt')===0)return 'pt';if(t.indexOf('ja')===0)return 'ja';if(t.indexOf('fr')===0)return 'fr';if(t.indexOf('it')===0)return 'it';if(t.indexOf('en')===0)return 'en';return ''}var list=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language];var n='';for(var i=0;i<list.length&&!n;i++)n=g(list[i]);var allowed={en:1,'zh-Hans':1,pt:1,ja:1,fr:1,it:1};var lang=allowed[q]?q:(allowed[s]?s:(n||'en'));document.documentElement.lang=lang;}catch(e){}})();`,
          tagPosition: 'head'
        },
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
  vite: {
    plugins: [
      {
        name: 'json-import-for-client',
        enforce: 'pre',
        transform(code: string, id: string) {
          const file = id.split('?')[0]
          if (!file.endsWith('/app/utils/place-lexicon.js') && !file.endsWith('/app/i18n/index.js')) return
          if (!code.includes('createRequire')) return
          const next = code
            .replace("import { createRequire } from 'node:module'\n", '')
            .replace('const require = createRequire(import.meta.url)\n', '')
            .replace("const data = require('../data/place-lexicon.json')\n", "import data from '../data/place-lexicon.json'\n")
            .replace(/const (\w+) = require\('(\.\/locales\/[^']+\.json)'\)\n/g, "import $1 from '$2'\n")
          return next === code ? undefined : { code: next, map: null }
        }
      }
    ]
  },
  nitro: {
    preset: 'static',
    prerender: {
      crawlLinks: true,
      routes: [
        ...['/', '/faq', '/studio', '/agents', '/privacy', '/terms', '/content-policy', '/credits', '/readme', '/skill']
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
        html = upsertSocialMeta(html, siteOrigin, baseURL)
        if (!html.includes('hreflang="x-default"')) {
          const alternates = hreflangEntries({ origin: siteOrigin, path: url.replace(siteOrigin, '') || '/' })
            .map(item => `<link rel="alternate" hreflang="${item.hreflang}" href="${item.href}">`)
            .join('')
          html = html.replace('</head>', `${alternates}</head>`)
        }
        route.contents = html
      })
    }
  }
})
