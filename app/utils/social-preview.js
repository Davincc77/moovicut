import { joinAppPath } from './urls.js'

export const PRODUCTION_ORIGIN = 'https://moovicut.studio'
export const SOCIAL_PREVIEW_ALT = 'Moovicut — free local storyboard planner. Consistent shot prompts for humans and AI agents.'

/** Absolute PNG used for Open Graph and Twitter summary_large_image cards. */
export function socialPreviewUrl(origin = PRODUCTION_ORIGIN, baseURL = '/') {
  const host = String(origin || PRODUCTION_ORIGIN).trim().replace(/\/+$/, '') || PRODUCTION_ORIGIN
  const path = joinAppPath(baseURL || '/', '/og-image.png')
  return `${host}${path.startsWith('/') ? path : `/${path}`}`
}

export function socialPreviewSeo(origin = PRODUCTION_ORIGIN, baseURL = '/') {
  const image = socialPreviewUrl(origin, baseURL)
  return {
    ogImage: image,
    ogImageWidth: '1200',
    ogImageHeight: '630',
    ogImageAlt: SOCIAL_PREVIEW_ALT,
    twitterCard: 'summary_large_image',
    twitterImage: image,
    twitterImageAlt: SOCIAL_PREVIEW_ALT
  }
}

export function socialPreviewMeta(origin = PRODUCTION_ORIGIN, baseURL = '/') {
  const image = socialPreviewUrl(origin, baseURL)
  return [
    { property: 'og:image', content: image },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: SOCIAL_PREVIEW_ALT },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:image', content: image },
    { name: 'twitter:image:alt', content: SOCIAL_PREVIEW_ALT }
  ]
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

/** Keep one social meta tag, and never leave it empty. */
export function upsertMetaTag(html, attr, key, content) {
  const tag = `<meta ${attr}="${key}" content="${escapeAttr(content)}">`
  const pattern = new RegExp(`<meta\\b[^>]*\\b${attr}="${key}"[^>]*>`, 'gi')
  if (!pattern.test(html)) return html.replace('</head>', `${tag}</head>`)
  pattern.lastIndex = 0
  let seen = false
  return html.replace(pattern, () => {
    if (seen) return ''
    seen = true
    return tag
  })
}

/** Write the production social preview tags into prerendered HTML. */
export function upsertSocialMeta(html, origin = PRODUCTION_ORIGIN, baseURL = '/') {
  let next = String(html || '')
  for (const tag of socialPreviewMeta(origin, baseURL)) {
    const attr = tag.property ? 'property' : 'name'
    const key = tag.property || tag.name
    next = upsertMetaTag(next, attr, key, tag.content)
  }
  return next
}
