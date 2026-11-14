// Local reconstruction content. External model names are labels, not integrations.
export const EXTERNAL_MODEL_DIRECTORY = [
  'Grok Imagine', 'Google (Veo / Gemini)'
]

/** Index order matches the former original-0..3 placeholders. */
export const SCENE_STILLS = [
  { file: 'dragon-silhouette', alt: 'Dragon silhouette', caption: 'Dragon silhouette' },
  { file: 'wireframe-corridor', alt: 'Wireframe corridor', caption: 'Wireframe corridor' },
  { file: 'scaffold-in-the-rain', alt: 'Scaffold in the rain', caption: 'Scaffold in the rain' },
  { file: 'mountain-pasture', alt: 'Mountain pasture', caption: 'Mountain pasture' }
]

export function stillSrc(index, extension = 'webp') {
  const still = SCENE_STILLS[Math.abs(Number(index) || 0) % SCENE_STILLS.length]
  const ext = extension === 'jpg' ? 'jpg' : 'webp'
  return `media/${still.file}.${ext}`
}

export function stillSrcSet(index) {
  const still = SCENE_STILLS[Math.abs(Number(index) || 0) % SCENE_STILLS.length]
  return `media/${still.file}-400.webp 400w, media/${still.file}-800.webp 800w`
}

export const STUDIO_INSPIRATIONS = [
  { file: 'paper-star-map', genre: 'Sci-fi', model: 'Grok Imagine', title: 'Paper Star Map', premise: 'An apprentice astronaut crosses a silent space station to recover a paper star map.' },
  { file: 'sunlit-pear-ad', genre: 'Ad', model: 'Google (Veo / Gemini)', title: 'Sunlit Pear Ad', premise: 'A single pear becomes the hero of a precise, sunlit tabletop commercial.' },
  { file: 'horse-at-dawn', genre: 'Family', model: 'Grok Imagine', title: 'Horse at Dawn', premise: 'A happy horse runs through an open field at sunrise in a gentle family film.' },
  { file: 'cliffside-courier', genre: 'Adventure', model: 'Grok Imagine', title: 'Cliffside Courier', premise: 'A mountain courier races along a cliff path to deliver a mysterious letter.' },
  { file: 'the-prophetic-canvas', genre: 'Fantasy', model: 'Grok Imagine', title: 'The Prophetic Canvas', premise: 'A painter discovers that the colors on a canvas predict the next morning.' },
  { file: 'city-wakes-up', genre: 'City', model: 'Google (Veo / Gemini)', title: 'City Wakes Up', premise: 'Three quiet clips follow a city waking through windows, bicycles and street cafés.' },
  { file: 'buried-observatory', genre: 'Exploration', model: 'Grok Imagine', title: 'Buried Observatory', premise: 'An explorer re-discovers an observatory hidden beneath desert sand.' },
  { file: 'rain-station-melody', genre: 'Drama', model: 'Grok Imagine', title: 'Rain Station Melody', premise: 'A violinist crosses a rain-soaked station as twenty-four reflections reveal a melody.' }
]

export function promptImageSrc(file, extension = 'webp') {
  const safe = String(file || 'paper-star-map').replace(/[^a-z0-9-]/g, '')
  const ext = extension === 'jpg' ? 'jpg' : 'webp'
  return `media/prompts/${safe}.${ext}`
}

/** Relative media path. Join with the app base URL before using it in the browser. */
export function artworkPath(index) {
  return stillSrc(index, 'webp')
}
