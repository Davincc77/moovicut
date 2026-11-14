/**
 * Per-model clip limits, taken from each provider's official documentation.
 * A value that the cited page does not state is marked unverified.
 * Checked 2026-11-14. Moovicut does not call these models.
 */
const CHECKED = '2026-11-14'
const STUDIO_ASPECTS = ['9:16', '1:1', '4:5', '16:9']

function source(url, note) {
  return { url, checked: CHECKED, ...(note ? { note } : {}) }
}

export const MODEL_PROFILES = Object.freeze({
  grok: {
    id: 'grok',
    label: 'Grok Imagine',
    providerModel: 'grok-imagine-video-1.5',
    promptForm: 'structured',
    promptFormNote: 'The video guide examples are prose. This profile keeps Moovicut’s existing labeled Grok Imagine prompt.',
    durations: { kind: 'range', min: 1, max: 15, default: 8 },
    durationNote: 'Text-to-video accepts 1–15 seconds and defaults to 8. Reference-to-video on grok-imagine-video allows up to 10 seconds. Moovicut scenes stay between 2 and 15 seconds, so a 1 second clip is documented and not offered here.',
    aspects: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9', '5:2'],
    defaultAspect: '16:9',
    idealPromptLength: { unverified: true, note: 'The generation page does not give an ideal or maximum prompt length. It does say an invalid request can mean a prompt that is too long.' },
    features: {
      seed: { supported: null, unverified: true, note: 'Seed is not mentioned on the video generation page.' },
      negativePrompt: { supported: null, unverified: true, note: 'A negative prompt is not mentioned on the video generation page.' }
    },
    weakSpots: [],
    weakSpotsNote: { unverified: true, note: 'The generation page does not list known weak spots.' },
    dialogueQuotes: false,
    sources: [source('https://docs.x.ai/developers/model-capabilities/video/generation')]
  },
  google: {
    id: 'google',
    label: 'Google (Veo / Gemini)',
    providerModel: 'veo-3.1-generate-preview',
    promptForm: 'structured',
    promptFormNote: 'The Veo prompt guide asks for descriptive prose covering subject, action, style, camera, composition, and light. This profile keeps Moovicut’s existing labeled Veo prompt, which names those same parts.',
    durations: { kind: 'enum', values: [4, 6, 8], default: 8 },
    durationNote: 'Veo 3.1 accepts 4, 6, or 8 seconds. 1080p, 4K, reference images, and extension require 8 seconds. Veo 2 accepts 5, 6, or 8 and is not the profile used here.',
    aspects: ['16:9', '9:16'],
    defaultAspect: '16:9',
    idealPromptLength: { unverified: true, note: 'The Gemini API lists a 1,024 token text input for Veo 3.1 and does not publish a character count.' },
    features: {
      seed: { supported: true, deterministic: false, note: 'Seed is available for Veo 3 models and does not guarantee determinism.' },
      negativePrompt: { supported: null, unverified: true, note: 'A negative prompt is not listed in the Gemini API parameter table.' }
    },
    weakSpots: [
      { code: 'veo_people_region', message: 'In EU, UK, CH, and MENA locations, Veo 3.1 allows only adult people in personGeneration.', fix: 'Keep the request within the documented personGeneration values for that region.' }
    ],
    dialogueQuotes: true,
    sources: [source('https://ai.google.dev/gemini-api/docs/video')]
  },
  sora: {
    id: 'sora',
    label: 'Sora',
    providerModel: 'sora-2',
    available: false,
    availabilityNote: 'The official video guide says the Sora 2 models and Videos API were shut down on September 24, 2026. The page is kept for historical reference. Moovicut still shapes the prompt and does not call the API.',
    promptForm: 'prose',
    durations: { kind: 'enum', values: [4, 8, 12], default: 4 },
    durationNote: 'The Videos API reference lists 4, 8, and 12 seconds. The prompting guide and the retained video guide also list 16 and 20. Those two extra lengths are unverified because the official pages disagree.',
    unverifiedDurations: [16, 20],
    aspects: ['16:9', '9:16'],
    aspectNote: 'The API reference lists 1280x720, 720x1280, 1024x1792, and 1792x1024. 1280x720 and 720x1280 are 16:9 and 9:16. 1024x1792 and 1792x1024 are not those ratios. The prompting guide also lists 1920x1080 and 1080x1920 for sora-2-pro.',
    defaultAspect: '16:9',
    idealPromptLength: { unverified: true, note: 'The prompting guide says shorter clips follow instructions more reliably and does not give a character target. The API reference sets the prompt maximum at 32,000 characters.' },
    maxPromptLength: 32000,
    features: {
      seed: { supported: false, note: 'Seed is not a parameter on the documented POST /videos method.' },
      negativePrompt: { supported: false, note: 'A negative prompt is not a parameter on the documented POST /videos method.' }
    },
    weakSpots: [
      { code: 'sora_long_clip', message: 'Sora follows instructions more reliably in a shorter clip.', fix: 'Prefer a 4 second clip, or cut the beat into two 4 second clips.', when: 'duration>=8' }
    ],
    dialogueQuotes: true,
    sources: [
      source('https://developers.openai.com/api/docs/guides/video-generation', 'Shutdown date and the 16 and 20 second claim.'),
      source('https://developers.openai.com/api/reference/resources/videos/methods/create', 'Prompt maximum, seconds 4/8/12, and the listed sizes.'),
      source('https://developers.openai.com/cookbook/examples/sora/sora2_prompting_guide', 'Prose prompt form and the shorter-clip note.')
    ]
  },
  kling: {
    id: 'kling',
    label: 'Kling',
    providerModel: 'kling-4.0',
    promptForm: 'prose',
    durations: { kind: 'range', min: 3, max: 30, default: 10 },
    durationNote: 'Kling 4.0 text-to-video accepts every integer from 3 through 30. The default is 10 when the prompt does not name a length. Moovicut scenes stay at or below 15 seconds, so 16–30 are documented and not offered on a scene.',
    aspects: ['21:9', '16:9', '9:16', '1:1', '4:3', '3:4'],
    defaultAspect: '16:9',
    idealPromptLength: { unverified: true, note: 'The page does not give an ideal length. A pure-English prompt may be up to 26,000 characters, a non-English prompt up to 11,000, and a mix must keep English characters / 26,000 + other characters / 11,000 at or below 1.' },
    maxPromptLength: { english: 26000, other: 11000 },
    features: {
      seed: { supported: null, unverified: true, note: 'Seed is not listed on the Kling 4.0 text-to-video page.' },
      negativePrompt: { supported: 'in-prompt', note: 'The prompt field can include a negative description. A separate negative-prompt parameter is not listed.' }
    },
    weakSpots: [],
    weakSpotsNote: { unverified: true, note: 'The text-to-video page does not list known weak spots.' },
    dialogueQuotes: false,
    sources: [source('https://klingai.com/document-api/api/video/4-0/text-to-video.md')]
  },
  runway: {
    id: 'runway',
    label: 'Runway',
    providerModel: 'gen4.5',
    promptForm: 'prose',
    durations: { kind: 'range', min: 2, max: 10, default: 2 },
    durationNote: 'gen4.5 text-to-video requires an integer duration from 2 to 10. The reference does not name a default, so the default here is the documented minimum.',
    aspects: ['16:9', '9:16'],
    aspectNote: 'Text-to-video ratios are 1280:720 and 720:1280. Image-to-video lists more ratios and is not this profile.',
    defaultAspect: '16:9',
    idealPromptLength: { unverified: true, note: 'The reference says to describe in detail what should appear, up to 1,000 UTF-16 code units, and does not give a shorter ideal.' },
    maxPromptLength: 1000,
    features: {
      seed: { supported: true, note: 'Seed is an integer from 0 to 4294967295. The same seed on an identical request produces similar results.' },
      negativePrompt: { supported: false, note: 'negativePrompt is not a field on gen4.5 text-to-video. Other models on the same reference do list it.' }
    },
    weakSpots: [],
    weakSpotsNote: { unverified: true, note: 'The gen4.5 text-to-video section does not list known weak spots.' },
    dialogueQuotes: false,
    sources: [source('https://docs.dev.runwayml.com/api.md', 'POST /v1/text_to_video model gen4.5.')]
  },
  luma: {
    id: 'luma',
    label: 'Luma',
    providerModel: 'ray-2',
    promptForm: 'prose',
    durations: { kind: 'enum', values: [5, 9], default: 5 },
    durationNote: 'The create-generation schema enumerates 5s and 9s, and also allows an arbitrary string. Other lengths are unverified. The reframe page lists a 10 second maximum for ray-2 and a 30 second maximum for ray-flash-2; that page is about reframing, not a new generation.',
    unverifiedDurations: 'any duration other than 5 or 9',
    aspects: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
    defaultAspect: '16:9',
    idealPromptLength: { unverified: true, note: 'The create-generation reference describes prompt as a string and does not give a length.' },
    features: {
      seed: { supported: null, unverified: true, note: 'Seed is not a field on the documented generation request.' },
      negativePrompt: { supported: null, unverified: true, note: 'A negative prompt is not a field on the documented generation request.' }
    },
    weakSpots: [],
    weakSpotsNote: { unverified: true, note: 'The generation reference does not list known weak spots.' },
    dialogueQuotes: false,
    sources: [
      source('https://docs.lumalabs.ai/reference/creategeneration'),
      source('https://docs.lumalabs.ai/docs/video-generation', 'Ray 2 examples use a 5s duration. Resolution examples include 540p, 720p, 1080p, and 4k.'),
      source('https://docs.lumalabs.ai/docs/reframe-video-image', 'Reframe maxima, not generation durations.')
    ]
  },
  wan: {
    id: 'wan',
    label: 'Wan',
    providerModel: 'wan3.0-video',
    promptForm: 'prose',
    durations: { kind: 'range', min: 2, max: 30, default: 5 },
    durationNote: 'Without a video input, duration is an integer from 2 to 30 and defaults to 5. With a video input, input plus output must stay within 30 seconds. -1 means the model picks a length. Moovicut scenes stay at or below 15 seconds, so 16–30 and -1 are documented and not offered on a scene.',
    aspects: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    aspectNote: 'ratio also accepts adaptive, which follows the input. The studio has no adaptive control, so a board uses one of the listed ratios.',
    defaultAspect: '16:9',
    idealPromptLength: { unverified: true, note: 'The reference allows 20,000 characters and does not give a shorter ideal. Chinese and English both count by character.' },
    maxPromptLength: 20000,
    features: {
      seed: { supported: true, deterministic: false, note: 'Seed is -1 or an integer from 0 to 2147483647. The same seed may not reproduce an identical video.' },
      negativePrompt: { supported: null, unverified: true, note: 'A negative prompt is not listed on the Wan 3.0 video generation reference.' }
    },
    weakSpots: [
      { code: 'wan_prompt_extend', message: 'Wan prompt_extend is on unless you turn it off, and it rewrites the prompt.', fix: 'If the wording has to stay exact, turn prompt_extend off in the provider request. Moovicut does not send that request.' }
    ],
    dialogueQuotes: false,
    sources: [source('https://www.alibabacloud.com/help/en/model-studio/wan3-video-generation-api-reference')]
  },
  generic: {
    id: 'generic',
    label: 'Generic',
    providerModel: '',
    promptForm: 'prose',
    durations: { unverified: true, note: 'No provider is named, so clip length stays inside Moovicut’s 2–15 second scene limit.' },
    aspects: { unverified: true, note: 'No provider is named, so the studio aspect stays as chosen: 9:16, 1:1, 4:5, or 16:9.' },
    idealPromptLength: { unverified: true, note: 'No provider page applies.' },
    features: {
      seed: { supported: null, unverified: true, note: 'No provider page applies.' },
      negativePrompt: { supported: null, unverified: true, note: 'No provider page applies.' }
    },
    weakSpots: [],
    weakSpotsNote: { unverified: true, note: 'No provider page applies.' },
    dialogueQuotes: false,
    sources: []
  }
})

export const PROFILE_IDS = Object.freeze(Object.keys(MODEL_PROFILES))

const ALIASES = Object.freeze({
  grok: 'grok',
  grokimagine: 'grok',
  x: 'grok',
  happyhorse: 'grok',
  muse: 'grok',
  omni: 'grok',
  re: 'grok',
  '24fps': 'grok',
  cinema: 'grok',
  portrait: 'grok',
  commercial: 'grok',
  google: 'google',
  veo: 'google',
  gemini: 'google',
  googlevoe: 'google',
  googlevegemini: 'google',
  vegemini: 'google',
  googlevoemini: 'google',
  sora: 'sora',
  sora2: 'sora',
  kling: 'kling',
  kling40: 'kling',
  runway: 'runway',
  gen45: 'runway',
  luma: 'luma',
  ray2: 'luma',
  dreammachine: 'luma',
  wan: 'wan',
  wan30: 'wan',
  generic: 'generic'
})

export function profileFor(id) {
  const key = ALIASES[String(id ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')] || ''
  return MODEL_PROFILES[key] || null
}

export function canonicalProfileId(value) {
  return profileFor(value)?.id || ''
}

function ratioOf(id) {
  const [width, height] = String(id).split(':').map(Number)
  return width > 0 && height > 0 ? width / height : 1
}

export function allowedDurations(profile) {
  if (!profile || profile.durations?.unverified) return null
  if (profile.durations.kind === 'enum') return profile.durations.values.filter(value => value >= 2 && value <= 15)
  const min = Math.max(2, profile.durations.min)
  const max = Math.min(15, profile.durations.max)
  const values = []
  for (let value = min; value <= max; value += 1) values.push(value)
  return values
}

export function snapDuration(value, profile) {
  const allowed = allowedDurations(profile)
  const number = Number(value)
  const target = !Number.isFinite(number) || number === 0 ? 3 : Math.max(2, Math.min(15, Math.round(number)))
  if (!allowed?.length || allowed.includes(target)) return target
  return allowed.reduce((best, item) => Math.abs(item - target) < Math.abs(best - target) ? item : best)
}

export function snapAspect(value, profile) {
  const current = STUDIO_ASPECTS.includes(value) ? value : '16:9'
  const official = Array.isArray(profile?.aspects) ? profile.aspects : null
  if (!official) return current
  const usable = official.filter(id => STUDIO_ASPECTS.includes(id))
  if (!usable.length || usable.includes(current)) return current
  return usable.reduce((best, item) => Math.abs(ratioOf(item) - ratioOf(current)) < Math.abs(ratioOf(best) - ratioOf(current)) ? item : best)
}

export function publicProfile(id) {
  const profile = profileFor(id)
  if (!profile) return null
  return {
    id: profile.id,
    label: profile.label,
    providerModel: profile.providerModel,
    promptForm: profile.promptForm,
    durations: profile.durations,
    aspects: profile.aspects,
    idealPromptLength: profile.idealPromptLength,
    features: profile.features,
    weakSpots: profile.weakSpots,
    sources: profile.sources
  }
}
