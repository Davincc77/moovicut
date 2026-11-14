/** A deterministic local story planner. No remote AI or video generation. */
import { canonicalModel, modelRegistry } from '../integrations/models/model-registry.js'
import { profileFor, snapAspect, snapDuration } from './model-profiles.js'
import { CAMERAS, LIGHTS, MOODS, describeCast, describePlace, findByName, foldName, looksLikeScenario, parseScenario, scenarioFromProject, scenarioPremise, sequencePacks } from './scenario.js'
import { cameraFor, episodePacks, isPresetMode, parseAd, parseExplainer, parseSeries } from './preset-modes.js'
import { detectProse } from './prose-detect.js'
import { canonicalStyleFamily, formatPresetBlock, listPresets, presetFamilies, presetGenres, resolvePreset } from './presets/index.js'
import { cleanText, sentence } from './text.js'
export { CAMERAS, LIGHTS, MOODS, looksLikeScenario, parseScenario, scenarioFromProject } from './scenario.js'
export { canonicalStyleFamily, formatPresetBlock, listPresets, presetFamilies, presetGenres, resolvePreset } from './presets/index.js'
export { MODEL_IDS, MODEL_OPTIONS, REFERENCE_MODEL_NAMES, canonicalModel, modelRegistry } from '../integrations/models/model-registry.js'
// Shared text helpers stay in text.js to avoid duplicate auto-imports in hosts.
export const GENRES = {
  cinematic: { label: 'Cinematic', tag: 'Balanced & intentional', glyph: 'clapperboard', look: 'grounded cinematic realism, restrained colour palette, natural textures', pace: 'measured visual storytelling, deliberate reveals', subject: 'a solitary traveller', location: 'a weathered railway platform at blue hour' },
  noir: { label: 'Neo-noir', tag: 'Shadow & tension', glyph: 'moon', look: 'neo-noir, wet asphalt, restrained neon accents, rich blacks and textured shadows', pace: 'quiet suspense with a sudden shift in momentum', subject: 'a guarded detective in a dark overcoat', location: 'a rain-soaked city street at night' },
  scifi: { label: 'Science fiction', tag: 'Alternative worlds', glyph: 'orbit', look: 'grounded retro-futurism, practical sets, luminous technology and subtle film grain', pace: 'wonderful discovery that turns into uncertainty', subject: 'an orbital engineer in a worn flight suit', location: 'an abandoned observatory above the clouds' },
  drama: { label: 'Drama', tag: 'Human & intimate', glyph: 'heart', look: 'intimate naturalism, soft available light, expressive faces and tactile details', pace: 'emotionally restrained, carried by small gestures', subject: 'a young ceramicist with paint-stained hands', location: 'a sunlit apartment filled with unfinished objects' },
  adventure: { label: 'Adventure', tag: 'Scale & discovery', glyph: 'compass', look: 'sweeping cinematic adventure, warm natural highlights, atmospheric depth', pace: 'building momentum, landmark reveals and movement', subject: 'a determined field cartographer with a canvas satchel', location: 'a windswept mountain pass at first light' },
  comedy: { label: 'Comedy', tag: 'Timing & lightness', glyph: 'smile', look: 'bright editorial colour, precisely framed performances and subtle visual irony', pace: 'clear setup, visual escalation and a well-timed reaction', subject: 'an overly serious event planner in a pressed suit', location: 'a slightly chaotic neighbourhood bakery' },
  horror: { label: 'Horror', tag: 'Atmospheric unease', glyph: 'eye', look: 'restrained psychological horror, desaturated colours, dense shadows and practical textures', pace: 'slow unease, held silence and a restrained final reveal', subject: 'a cautious night archivist holding a small flashlight', location: 'a narrow records room after closing time' },
  documentary: { label: 'Documentary', tag: 'Authentic observation', glyph: 'video', look: 'observational documentary, available light, honest textures and unstaged detail', pace: 'observant, patient and led by real gestures', subject: 'an experienced lighthouse keeper in a wool jacket', location: 'a remote coastal workshop in morning light' }
}
export const SHOT_STYLE_PROFILES = {
  Fun: { suffix: 'bright playful colour and a buoyant, smiling mood', camera: 'light bouncing camera with a cheerful push-in', lighting: 'high-key warm light with soft sunny shadows', mood: 'Playful and lighthearted' },
  Normal: { suffix: 'natural cinematic texture and a clear, grounded mood', camera: 'steady eye-level camera with a measured move', lighting: 'balanced natural light with soft cinematic shadow', mood: 'Grounded and clear' },
  Spicy: { suffix: 'bold saturated colour and a charged, high-contrast mood', camera: 'bold close camera with a sharp push-in', lighting: 'hard rim light with deep contrast and hot highlights', mood: 'Intense and charged' }
}
export const STYLES = [
  { id: 'cinematic', label: 'Cinematic', note: 'Natural film texture', suffix: '35mm film texture, fine grain, natural skin and material detail' },
  { id: 'analog', label: 'Analog film', note: 'Warm, imperfect, human', suffix: '16mm film grain, slightly soft lens character, halated highlights' },
  { id: 'editorial', label: 'Modern editorial', note: 'Clean, graphic, refined', suffix: 'high-end commercial photography, crisp geometry, considered negative space' },
  { id: 'animation', label: '3D animation', note: 'Tactile crafted world', suffix: 'stylized three-dimensional animation, physically based materials, handcrafted miniature feeling' },
  { id: 'illustrative', label: 'Illustration', note: 'Painterly graphic shapes', suffix: 'painterly gouache illustration, expressive silhouettes, layered colour fields' },
  { id: 'wireframe', label: 'Previs', note: 'Neutral blocking study', suffix: 'neutral grey three-dimensional previsualization, wireframe guides, clear spatial blocking' }
]
const TEMPLATES = [
  { stage: 'Opening', title: 'Establish the world', framing: 'Extreme wide establishing shot', lens: '24mm wide-angle lens', camera: 'Slow lateral push toward the scene', action: 'the character crosses a puddle as a distant signal flickers', directions: 'Open wide and let one small movement lead in.', continuity: 'Establish protagonist wardrobe and props, geography, direction of travel and ambient weather for the entire sequence.', cue: 'distant ambience and a low, unobtrusive score' },
  { stage: 'Introduction', title: 'Meet the protagonist', framing: 'Medium tracking shot', lens: '35mm standard lens', camera: 'Gentle backward tracking at eye level', action: 'they quietly assess an unforeseen arrival', directions: 'Stay on posture and intention.', continuity: 'Keep wardrobe, carried objects and movement direction exactly as established in the previous shot.', cue: 'soft footsteps, fabric rustle and outdoor room tone' },
  { stage: 'Discovery', title: 'Something catches their eye', framing: 'Close-up insert', lens: '85mm close-up lens', camera: 'A precise, slow push-in with shallow depth of field', action: 'a reflected glow reveals an unexpected detail', directions: 'Hold on the one new detail.', continuity: 'Hold eyeline and focal-point direction consistent with the preceding medium shot; preserve weather and prop placement.', cue: 'ambience drops away; one clear detail sound' },
  { stage: 'Shift', title: 'The moment turns', framing: 'Over-the-shoulder shot', lens: '40mm compact cinema lens', camera: 'A controlled arc to the protagonist’s right', action: 'a sudden realization interrupts the quiet', directions: 'Show the turn in one move.', continuity: 'Maintain screen direction, previously established wardrobe, and consistent position of the newly revealed object.', cue: 'a restrained musical pulse begins underneath the ambience' },
  { stage: 'Response', title: 'A choice in motion', framing: 'Full-body lateral tracking shot', lens: '32mm wide-normal lens', camera: 'Measured dolly alongside the protagonist', action: 'the atmosphere thickens as they move forward', directions: 'Follow the choice in one direction.', continuity: 'Move along the established line of action. Keep the protagonist travelling in the same screen direction.', cue: 'footsteps sharpen, wind rises, rhythmic score develops' },
  { stage: 'Release', title: 'A quiet final image', framing: 'Wide closing tableau', lens: '50mm natural-perspective lens', camera: 'Slow crane back, ending on a locked-off frame', action: 'a final gust carries the last of the tension away', directions: 'Hold the last image.', continuity: 'Return to wide geography from the opening with visible consequences of the decision; preserve character appearance.', cue: 'the pulse resolves into one quiet sustained note; ambience returns' }
]
export const SCENE_STUDIES = ['Snow Fight', 'Dragon Chase', 'The Lab', 'The Climb', 'Mech Reveal', 'Solo Corridor', 'Machine Room', 'High Country']
const EXAMPLE_TERMS = [
  { title: 'Station screenplay study', subtitle: 'Angle · beat · cut · dialogue · detective · creation', premise: 'A guarded detective follows a screen clue through a rain-lit station, where each dialogue beat reveals the angle of a larger mystery.' },
  { title: 'Foundation plaque study', subtitle: 'Foundation · angle · beat · cut · creation · dialogue', premise: 'A determined mountain explorer finds a foundation plaque beneath the snow, then follows its hand-drawn directions to a forgotten shelter.' }
]
export const EXAMPLES = [
  ...EXAMPLE_TERMS.map(item => ({ ...item, slug: item.title.toLowerCase().replace(/ /g, '-'), category: 'Screenplay study', duration: 'Original scene direction for a screenplay exercise: use an angle, a beat, a cut and dialogue to shape your own story.', color: '#8d795c' })),
  { slug: 'last-light', category: 'Drama', title: 'Last Light', premise: 'A lighthouse keeper races the dusk to repair a failing beacon before a fishing boat reaches the rocks.', duration: 'A quiet race against the fading sun, practical details and one final, distant light.', color: '#bd8b4f' },
  { slug: 'borrowed-orbit', category: 'Sci-fi', title: 'Borrowed Orbit', premise: 'An apprentice astronaut must guide a damaged observation capsule home using only a paper star map.', duration: 'A small human gesture in a vast, silent machine.', color: '#7199aa' },
  { slug: 'after-the-rain', category: 'Noir', title: 'After the Rain', premise: 'A violinist follows a mysterious handwritten melody through the empty streets of a sleeping city.', duration: 'Neon reflections, cautious footsteps and a tune leading somewhere unknown.', color: '#88709b' },
  { slug: 'north-window', category: 'Adventure', title: 'The North Window', premise: 'A young mapmaker climbs a forgotten mountain observatory to find the valley that was left off every map.', duration: 'Weathered paper, immense landscapes and the courage to take another step.', color: '#899d79' },
  { slug: 'small-rebellion', category: 'Comedy', title: 'A Small Rebellion', premise: 'A meticulous hotel concierge tries to stop one determined house cat from reaching the grand breakfast room.', duration: 'Perfect symmetry meets very imperfect guest behaviour.', color: '#b8795b' },
  { slug: 'night-archive', category: 'Mystery', title: 'The Night Archive', premise: 'An archivist discovers that one file in the collection describes tomorrow before it happens.', duration: 'Dusty shelves, a numbered folder and a quiet change in the clock.', color: '#8b8972' },
  { slug: 'paper-compass', category: 'Adventure', title: 'The Paper Compass', premise: 'Two siblings follow a hand-drawn map through a windswept valley to find their grandfather’s weather station.', duration: 'A family mystery told through changing skies and a trail of handwritten clues.', color: '#889b79' },
  { slug: 'small-hours', category: 'Drama', title: 'The Small Hours', premise: 'A night baker finds an unsigned note in an order book and decides to deliver one last loaf before sunrise.', duration: 'Quiet streets, warm windows and a small act of unexpected kindness.', color: '#ad8e68' }
]
export const DEFAULT_SHOT_COUNT = 5
export const DEFAULT_SHOT_DURATION = 3
export const MAX_SCENE_OVERRIDES = 48
/** Out of the box the board is 5 scenes × 3s = 15s. Longer presets keep 3s scenes and add shots. */
export const DURATION_PRESETS = Object.freeze([
  { id: '15s', label: '15s', total: 15, count: 5, duration: 3 },
  { id: '30s', label: '30s', total: 30, count: 10, duration: 3 },
  { id: '60s', label: '60s', total: 60, count: 20, duration: 3 }
])
/** Preset buttons and settings for the active model. Totals stay inside the named length when a shot must be longer than 3s. */
export function durationPlans(modelId) {
  const profile = profileFor(modelId)
  return DURATION_PRESETS.map(preset => {
    const duration = snapDuration(preset.duration, profile)
    const count = Math.min(48, Math.max(1, Math.floor(preset.total / duration)))
    const total = count * duration
    return { id: preset.id, label: `${total}s`, total, count, duration }
  })
}
export function canonicalDuration(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return DEFAULT_SHOT_DURATION
  return Math.max(2, Math.min(15, Math.round(number)))
}
export function canonicalShotCount(value) {
  const number = Math.floor(Number(value))
  if (!Number.isFinite(number) || number < 1) return DEFAULT_SHOT_COUNT
  return number
}
export const FAQS = [
  { q: 'What is Moovicut?', a: 'Moovicut is a free, local-first storyboard and shot list. You edit the shots in the browser and copy prompts for Grok Imagine, Google, or any other AI image or video model.' },
  { q: 'Can an AI agent build a storyboard?', a: 'Yes. The default board is 5 scenes of 3 seconds (15s total). Humans can use Step-by-step mode in /studio, and agents can pass shots, a scenes array, a scenario, input prose, or format agent to POST /api/v1/storyboard, /mcp, or a /studio# share link. Open /agents for the endpoints. No API key and no account. Every mode shares one film sheet. model can be grok, google, sora, kling, runway, luma, wan, or generic. A prompt edited by hand is kept unless overwrite is explicit.' },
  { q: 'How does Moovicut work?', a: 'A premise becomes an ordered shot list on this device, with camera, action, lighting, sound, and continuity you can edit. Paste a prompt into the model you already use. Moovicut does not call that model.' },
  { q: 'Does Moovicut render video?', a: 'No. It writes prompts. Nothing is rendered inside Moovicut.' },
  { q: 'Which models does it support?', a: 'The home page and the studio list eight prompt targets: Grok Imagine, Google (Veo / Gemini), Sora, Kling, Runway, Luma, Wan, and a generic profile. These names are prompt targets, not included accounts or rendering.' },
  { q: 'Is an account required?', a: 'No. The storyboard stays in this browser. There is no sign-in.' },
  { q: 'Can I import or export work?', a: 'Yes. Projects use the shotboard.v1 JSON format. The studio can export a project or a local library backup, and it can import a compatible file. Files stay on your device.' },
  { q: 'Is Moovicut free?', a: 'Yes. Planning, editing, and JSON export are free. There is no subscription. Optional tips open Buy Me a Coffee in a new tab. Moovicut does not take payment itself.' },
  { q: 'Are visits counted?', a: 'Anonymous, cookieless visit counts via Cloudflare Web Analytics. The site also keeps a simple server-side visit count (POST /api/visits) stored on a persistent volume, with no personal data. Storyboards never leave the device.' }
]
export function titleFromPremise(text) { const cleaned = cleanText(text).replace(/^(a|an|the)\s+/i, ''); if (!cleaned) return 'Untitled story'; const words = cleaned.split(' ').slice(0, 5).join(' '); return sentence(words) + (cleaned.split(' ').length > 5 ? '…' : '') }
export function detectGenre(premise, preferred = 'cinematic') {
  const text = cleanText(premise).toLowerCase()
  if (preferred && preferred !== 'cinematic' && GENRES[preferred]) return preferred
  if (/\b(robot|space|astronaut|future|android|spaceship|cyber|alien|orbital|artificial)\b/.test(text)) return 'scifi'
  if (/\b(detective|noir|crime|neon|mystery|investigation|investigator)\b/.test(text)) return 'noir'
  if (/\b(dragon|quest|mountain|journey|expedition|map|treasure|ancient|climb)\b/.test(text)) return 'adventure'
  if (/\b(ghost|haunt|nightmare|monster|creep|supernatural)\b/.test(text)) return 'horror'
  if (/\b(cat|dog|funny|comedy|awkward|chaos|llama)\b/.test(text)) return 'comedy'
  if (/\b(documentary|interview|real life|documentaire|documental)\b/.test(text)) return 'documentary'
  if (/love|family|mother|father|daughter|son|friend|memory|grief|home|wedding|relationship|famille|familia|семья/.test(text)) return 'drama'
  if (/[宇宙ロボット]|espacio|vaisseau|космос|космонавт|宇宙船/.test(text)) return 'scifi'
  if (/détective|детектив|刑事/.test(text)) return 'noir'
  if (/montaña|montagne|гора|登山/.test(text)) return 'adventure'
  if (/fantasma|fantôme|幽霊|призрак/.test(text)) return 'horror'
  if (/\bgato\b|猫咪|猫|кот/.test(text)) return 'comedy'
  return GENRES[preferred] ? preferred : 'cinematic'
}
const STORY_VERBS = 'runs|races|crosses|discovers|walks|finds|follows|chases|meets|opens|enters|leaves|fights|searches|delivers|climbs|watches|hears|sees|goes|comes|travels|escapes|hides|builds|paints|sings|plays|repairs|guides|arrives|returns|carries|writes|reads|calls|breaks|saves|loses|falls|stands|looks|turns|reaches|holds|gives|takes|makes|moves|flies|rides|jumps|flees|flee|steals|perd|perds|pierde|sigue|encuentra|camina|corre|repara|répare|rennt|folgt|findet|läuft|geht'
const STORY_VERB = new RegExp(`\\b(?:${STORY_VERBS})\\b`, 'iu')
export function looksLikeStory(premise) {
  const text = cleanText(premise)
  if (text.length < 8) return true
  if (STORY_VERB.test(text) && /\b(a|an|the|he|she|they|un|une|el|la|der|die|das|ein|eine)\b/iu.test(text)) return true
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,}(?:が|は|を)/u.test(text)) return true
  if (/\p{Script=Cyrillic}/u.test(text) && STORY_VERB.test(text)) return true
  return false
}
export function inferSequenceMode(premise) { return looksLikeStory(premise) ? 'continuous' : 'varied' }
const PLACE_WORDS = ['luxembourg', 'space station', 'railway station', 'lighthouse', 'open field', 'observatory', 'mountain pasture', 'pasture', 'capsule', 'bakery', 'station', 'field', 'cliff', 'city', 'desert', 'mountain', 'kitchen', 'corridor', 'street', 'beach', 'forest', 'harbour', 'harbor', 'coast', 'platform', 'bridge', 'records room']
const WEATHER_WORDS = new Set(['rain', 'night', 'day', 'dusk', 'dawn', 'snow', 'dark', 'light', 'morning', 'evening', 'midnight', 'storm', 'fog', 'sun', 'wind'])
/** A cue counts only as a whole word, and not when the premise denies it. */
export function mentionedCue(text, word) {
  const source = String(text || '')
  if (!new RegExp(`\\b${word}\\b`, 'i').test(source)) return false
  return !new RegExp(`\\b(?:no|not|without|never|none)\\b(?:\\s+\\w+){0,3}\\s+${word}\\b`, 'i').test(source)
}
export function extractDialogue(text) {
  return [...String(text || '').matchAll(/["“]([^"”]{1,180})["”]/g)].map(match => cleanText(match[1])).filter(Boolean)
}
const CHARACTER_VERBS = `${STORY_VERBS}|racing|repairing|guiding|losing|delivering|chasing|climbing|walking|running|crossing|following`
const CONTENT_STOP = new Set(['a', 'an', 'the', 'un', 'une', 'el', 'la', 'los', 'las', 'der', 'die', 'das', 'ein', 'eine', 'in', 'at', 'on', 'of', 'to', 'and', 'with', 'for', 'from', 'before', 'after', 'while', 'when', 'no', 'not', 'into', 'over', 'under'])
function contentWords(source) {
  return cleanText(source).replace(/[^\p{L}\p{N}\s'’-]/gu, ' ').split(/\s+/).filter(word => word && !CONTENT_STOP.has(word.toLowerCase()))
}
function fallbackPhrase(source, skip = []) {
  const skipped = new Set(skip.map(word => String(word).toLowerCase()))
  const verb = new RegExp(`^(?:${STORY_VERBS})$`, 'iu')
  const words = contentWords(source).filter(word => !verb.test(word) && !skipped.has(word.toLowerCase()))
  const chosen = (words.length ? words : contentWords(source)).slice(0, 3)
  return chosen.length ? sentence(chosen.join(' ')) : sentence(cleanText(source).slice(0, 48))
}
export function parseCharacter(text) {
  const source = cleanText(text)
  const cjk = source.match(/^([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]{1,16})(?:が|は)/u)
  if (cjk) return cjk[1]
  const cyrillic = source.match(/^([\p{Script=Cyrillic}][\p{Script=Cyrillic}'’-]{1,32})(?=\s+\p{Script=Cyrillic})/u)
  if (cyrillic) return sentence(cyrillic[1])
  const verbMatch = new RegExp(`\\b(?:${CHARACTER_VERBS})\\b`, 'iu').exec(source)
  if (verbMatch) {
    const before = source.slice(0, verbMatch.index)
    const phrases = [...before.matchAll(new RegExp(`\\b(?:a|an|the|un|une|el|la|der|die|das|ein|eine)\\s+([\\p{L}][\\p{L}'’-]*(?:\\s+(?!a\\b|an\\b|the\\b|un\\b|une\\b)[\\p{L}][\\p{L}'’-]*){0,4})`, 'giu'))]
    const phrase = phrases.at(-1)
    if (phrase) {
      const name = phrase[1].split(/\s+(?:in|at|on|through|inside|under|over|across|of|à|en|de|im|auf|dans|sur)(?=\s|$)/iu)[0].trim()
      if (name) return sentence(name)
    }
    const loose = contentWords(before).slice(-3)
    if (loose.length) return sentence(loose.join(' '))
  }
  return fallbackPhrase(source)
}
export function parsePlace(text) {
  const source = cleanText(text)
  const lower = source.toLowerCase()
  const known = PLACE_WORDS.find(word => new RegExp(`\\b${word}\\b`, 'i').test(lower))
  if (known) return sentence(known)
  const afterSubject = source.replace(/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]{1,16}(?:が|は)/u, '')
  const cjkPlace = afterSubject.match(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]{1,18}?)(?:で|に)/u)
  if (cjkPlace) return cjkPlace[1]
  const pattern = /\b(?:in|at|inside|through|across|along|under|over|on|à|en|dans|sur|im|auf)\s+(?:a|an|the|un|une|el|la|der|die|das\s+)?([\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){0,4})/giu
  let match
  while ((match = pattern.exec(source))) {
    const words = []
    for (const word of match[1].split(/\s+/)) {
      const bare = word.toLowerCase().replace(/[^\p{L}'’-]/gu, '')
      if (!bare || WEATHER_WORDS.has(bare) || new RegExp(`^(?:${STORY_VERBS}|before|after|while|when|and|with|to|of|no|not)$`, 'iu').test(bare)) break
      words.push(word.replace(/[^\p{L}'’-]/gu, ''))
    }
    if (words.length) return sentence(words.join(' '))
  }
  return fallbackPhrase(source, parseCharacter(source).split(/\s+/))
}
export const ASPECT_RATIOS = Object.freeze([
  { id: '9:16', label: '9:16', note: 'Reels, TikTok, Shorts' },
  { id: '1:1', label: '1:1', note: 'Square' },
  { id: '4:5', label: '4:5', note: 'Feed' },
  { id: '16:9', label: '16:9', note: 'YouTube' }
])
export function canonicalAspect(value) { return ASPECT_RATIOS.some(item => item.id === value) ? value : '16:9' }
export function ideaAnchor(premise) { return cleanText(premise) }
const VISUAL_STYLE_CUES = [
  ['wireframe', /\b(?:wireframes?|previs(?:ualization)?|previz)\b/i],
  ['animation', /\b(?:3d animation|animated|animation|claymation)\b/i],
  ['illustrative', /\b(?:illustrations?|illustrated|painterly|gouache|watercolours?|watercolors?|sketch)\b/i],
  ['editorial', /\b(?:editorial|commercial photography)\b/i],
  ['analog', /\b(?:analog film|16mm|super 8|film grain)\b/i]
]
/** The first medium named in the idea, if any. One board gets one result. */
export function inferVisualStyleId(premise) {
  const text = cleanText(premise)
  let best = null
  for (const [id, pattern] of VISUAL_STYLE_CUES) {
    const index = text.search(pattern)
    if (index >= 0 && (!best || index < best.index)) best = { id, index }
  }
  return best?.id || ''
}
/**
 * One style phrase for the whole board. A chosen visual style wins.
 * Otherwise the idea is scanned once. Mood (Fun, Normal, Spicy) is appended
 * the same way on every shot and never picks a new look per shot.
 */
export function lockBoardStyle(premise, styleName, genreId) {
  const genre = GENRES[genreId] || GENRES.cinematic
  const chosen = STYLES.find(item => item.id === styleName)
  const inferred = chosen ? null : STYLES.find(item => item.id === inferVisualStyleId(premise))
  const visual = chosen || inferred
  const mood = SHOT_STYLE_PROFILES[styleName]
  if (visual) return visual.suffix
  return mood ? `${genre.look}. ${mood.suffix}` : genre.look
}
export function buildContinuitySheet(premise) {
  const text = cleanText(premise)
  const lower = text.toLowerCase()
  const times = ['golden hour', 'blue hour', 'sunrise', 'sunset', 'dawn', 'dusk', 'morning', 'afternoon', 'evening', 'midnight', 'night', 'twilight']
  let time = times.find(item => mentionedCue(lower, item) || lower.includes(item) && item.includes(' ')) || (mentionedCue(lower, 'moon') ? 'night' : '')
  if (!time && /夕暮れ|黄昏|crépuscule|crepuscule|anochecer|dämmerung|сумерк/.test(text)) time = 'dusk'
  if (!time && (/夜|ночь/.test(text) || mentionedCue(lower, 'nuit') || mentionedCue(lower, 'noche') || mentionedCue(lower, 'nacht'))) time = 'night'
  if (!time && (mentionedCue(lower, 'storm') || mentionedCue(lower, 'thunder') || mentionedCue(lower, 'tempest'))) time = 'storm'
  if (!time && (mentionedCue(lower, 'rain') || mentionedCue(lower, 'pluie') || mentionedCue(lower, 'lluvia') || mentionedCue(lower, 'regen') || /雨/.test(text))) time = 'rain'
  if (!time) time = 'daylight consistent with the idea'
  const snow = mentionedCue(lower, 'snow') || mentionedCue(lower, 'ice') || mentionedCue(lower, 'winter') || mentionedCue(lower, 'frost') || mentionedCue(lower, 'neige') || mentionedCue(lower, 'nieve')
  let palette = 'natural cinematic colour with restrained contrast'
  if (mentionedCue(lower, 'dusk') || mentionedCue(lower, 'sunset') || /golden hour/.test(lower)) palette = 'warm amber light, deep shadows and muted gold'
  else if (mentionedCue(lower, 'dawn') || mentionedCue(lower, 'sunrise') || mentionedCue(lower, 'morning')) palette = 'cool blue shadows warming into soft gold'
  else if (mentionedCue(lower, 'night') || mentionedCue(lower, 'midnight') || mentionedCue(lower, 'neon')) palette = 'deep navy, sparse practical lights and cool highlights'
  else if (mentionedCue(lower, 'storm') || mentionedCue(lower, 'thunder') || mentionedCue(lower, 'rain') || mentionedCue(lower, 'pluie') || mentionedCue(lower, 'lluvia') || mentionedCue(lower, 'regen') || /雨/.test(text)) palette = 'wet dark tones, reflected light and cool teal'
  else if (snow) palette = 'cold whites, steel blue and a pale gold accent'
  const dialogue = extractDialogue(text)
  const avoid = []
  if (/\bsnow\b/i.test(text) && !mentionedCue(text, 'snow')) avoid.push('snow')
  const character = parseCharacter(text)
  const sheet = { character, appearance: appearanceFor(character), place: parsePlace(text), time, palette, lighting: `${time}, ${palette}`, style: 'cinematic, consistent from shot to shot' }
  if (dialogue[0]) sheet.dialogue = dialogue[0]
  if (avoid.length) sheet.avoid = avoid.join(', ')
  return sheet
}
export function formatContinuitySheet(sheet) {
  if (!sheet) return ''
  const outfit = sheet.appearance || appearanceFor(sheet.character)
  const lighting = sheet.lighting || `${sheet.time}, ${sheet.palette}`
  const lines = ['CONTINUITY SHEET', `Character: ${sheet.character}`, `Wardrobe: ${outfit}`, `Place: ${sheet.place}`, `Location: ${sheet.place}`, `Time / moment: ${sheet.time}`, `Lighting: ${lighting}`, `Palette: ${sheet.palette}`, `Style: ${sheet.style}`]
  if (sheet.dialogue) lines.push(`Dialogue: “${sheet.dialogue}”`)
  if (sheet.avoid) lines.push(`Do not show: ${sheet.avoid}`)
  return lines.join('\n')
}
const CORE_BEATS = ['Opening', 'Introduction', 'Discovery', 'Shift', 'Response', 'Climax', 'Release', 'Ending']
const EXTRA_BEATS = ['Arrival', 'Detail', 'Question', 'Complication', 'Pressure', 'Pursuit', 'Revelation', 'Turn', 'Crisis', 'Choice', 'Consequence', 'Aftermath', 'Resolution', 'Return', 'Coda', 'Threshold', 'Signal', 'Crossing', 'Reckoning', 'Echo', 'Horizon', 'Promise', 'Farewell', 'Pulse', 'Witness', 'Ascent', 'Descent', 'Spark', 'Shadow', 'Passage', 'Stillness', 'Approach', 'Tension', 'Reversal', 'Sacrifice', 'Breakthrough', 'Fallout', 'Reunion', 'Departure', 'Epilogue']
export function shotStages(total) {
  const count = Math.max(1, Math.floor(Number(total) || 1))
  if (count === 1) return ['Opening']
  if (count <= CORE_BEATS.length) {
    const used = new Set()
    const picks = []
    for (let index = 0; index < count; index++) {
      let pick = index === count - 1 ? CORE_BEATS.length - 1 : Math.round((index * (CORE_BEATS.length - 1)) / (count - 1))
      if (used.has(pick)) {
        for (let step = 1; step < CORE_BEATS.length && used.has(pick); step++) {
          if (pick + step < CORE_BEATS.length && !used.has(pick + step)) pick += step
          else if (pick - step >= 0 && !used.has(pick - step)) pick -= step
        }
      }
      used.add(pick)
      picks.push(pick)
    }
    return picks.sort((a, b) => a - b).map(index => CORE_BEATS[index])
  }
  const head = CORE_BEATS.slice(0, -1)
  const extras = Array.from({ length: count - CORE_BEATS.length }, (_, index) => EXTRA_BEATS[index] || `Development ${index - EXTRA_BEATS.length + 1}`)
  const buckets = head.map(() => [])
  extras.forEach((name, index) => buckets[index % head.length].push(name))
  return [...head.flatMap((name, index) => [name, ...buckets[index]]), 'Ending']
}
export function assignShotStages(shots) {
  const names = shotStages(shots.length)
  shots.forEach((shot, index) => { shot.stage = names[index] })
  return shots
}
const CONTINUOUS_TRANSITIONS = ['The story opens as', 'Right after,', 'Moments later,', 'Then,', 'In the middle of it,', 'As the story turns,', 'Near the end,', 'Finally,']
const VARIED_ANGLES = [
  { framing: 'Extreme wide establishing shot', camera: 'Slow crane rising over the scene', mood: 'awe and scale', setting: 'an open cliff at dusk' },
  { framing: 'Tight close-up', camera: 'Handheld micro-moves at eye level', mood: 'intimate detail', setting: 'a rain-lit street corner' },
  { framing: 'Low-angle hero shot', camera: 'Slow push-in from below', mood: 'bold presence', setting: 'a sunlit workshop' },
  { framing: 'Overhead tableau', camera: 'Locked-off top-down view', mood: 'graphic calm', setting: 'an empty station platform' },
  { framing: 'Silhouette against the light', camera: 'Gentle lateral drift', mood: 'mystery', setting: 'a foggy harbour wall' },
  { framing: 'Insert of a telling object', camera: 'Macro push-in', mood: 'tactile detail', setting: 'a candlelit stair' },
  { framing: 'Medium portrait', camera: 'Slow arc around the subject', mood: 'character', setting: 'a desert track at noon' },
  { framing: 'Wide environmental frame', camera: 'Static wide with a small foreground move', mood: 'atmosphere', setting: 'a night bakery window' }
]
function cameraForFraming(framing, profile) {
  const wide = /wide|establishing|tableau|overhead|environmental|silhouette/i.test(framing || '')
  if (!wide) return profile.camera
  if (profile.mood.startsWith('Playful')) return 'light wide crane with a cheerful drift across the scene'
  if (profile.mood.startsWith('Intense')) return 'bold wide crane with a sharp lateral move across the scene'
  return 'steady wide camera with a measured move'
}
function applyShotStyle(shot, styleName, keepLighting = false) {
  const profile = SHOT_STYLE_PROFILES[styleName]
  if (!profile) return shot
  const mood = styleName === 'Normal' ? '' : `${profile.mood}: `
  return { ...shot, camera: cameraForFraming(shot.framing, profile), lighting: keepLighting ? shot.lighting : profile.lighting, action: `${mood}${shot.action}`.replace(/^:\s*/, ''), directions: styleName === 'Normal' ? (shot.directions || '').trim() : `${profile.mood} mood. ${shot.directions || ''}`.trim() }
}
function appearanceFor(character) {
  const name = String(character || '').toLowerCase()
  if (name.includes('baker') || name.includes('boulanger')) return 'the same flour-dusted apron, rolled sleeves, and worn shoes'
  if (name.includes('keeper') || name.includes('farero') || name.includes('gardien')) return 'the same wool jacket, knit cap, and weathered boots'
  if (name.includes('astronaut')) return 'the same worn flight suit and scuffed boots'
  return 'the same clothes, hair, and face from the first shot'
}
function stageBeat(stage, facts, genre) {
  const who = facts.character
  const where = facts.place
  const when = facts.time
  const pace = genre?.pace || 'measured visual storytelling'
  const line = facts.dialogue
  const core = {
    Opening: `A wide view of ${where} at ${when}, with ${who} entering the frame.`,
    Introduction: `${who} is readable in a closer frame, hands and posture clear.`,
    Discovery: `One new detail appears in ${where} and changes the next gesture.`,
    Shift: `${who} stops as the situation turns.`,
    Response: line ? `${who} says “${line}.”` : `${who} chooses a direction and moves through ${where}.`,
    Climax: `The result of that choice is visible around ${who}.`,
    Release: `A quiet hold on ${where} at ${when}.`,
    Ending: `The last image stays on ${who} in ${where}.`
  }
  if (core[stage]) return core[stage]
  return `${who} plays the ${String(stage || 'next').toLowerCase()} beat in ${where} at ${when}, ${pace}.`
}
function applyContinuousShot(shot, sheet, index, styleName) {
  const profile = SHOT_STYLE_PROFILES[styleName]
  const appearance = sheet.appearance || appearanceFor(sheet.character)
  const genre = GENRES[shot.genre] || GENRES.cinematic
  const beat = stageBeat(shot.stage, { ...sheet, appearance }, genre)
  const mood = styleName && styleName !== 'Normal' && profile ? `${profile.mood}: ` : ''
  const lighting = sheet.lighting || `${sheet.time}, ${sheet.palette}`
  return {
    ...shot,
    action: `${mood}${beat}`,
    lighting: profile ? `${lighting}. ${profile.lighting}` : lighting,
    directions: 'One clear action.',
    continuity: `Same character: ${sheet.character}. Same wardrobe: ${appearance}. Same place: ${sheet.place}. Same time of day: ${sheet.time}.`
  }
}
const VARIED_LIGHTING = [
  'soft side light with a gentle falloff',
  'hard overhead light and crisp shadows',
  'dim practical light from one source',
  'bright diffuse daylight',
  'backlight with a bright rim',
  'low warm key and cool fill',
  'flat even light',
  'narrow pool of light in a darker surround'
]
function variedLocation(place, index) {
  const spots = [
    `a far edge of ${place}`,
    `a close corner of ${place}`,
    `ground level at ${place}`,
    `an overhead view of ${place}`,
    `the shadowed side of ${place}`,
    `a foreground detail within ${place}`,
    `eye level inside ${place}`,
    `the opposite side of ${place}`
  ]
  return spots[index % spots.length]
}
function applyVariedShot(shot, premise, index) {
  const angle = VARIED_ANGLES[index % VARIED_ANGLES.length]
  const location = variedLocation(parsePlace(premise), index)
  return {
    ...shot,
    title: angle.framing,
    stage: angle.framing,
    framing: angle.framing,
    camera: angle.camera,
    action: `A standalone ${angle.mood} frame of ${parseCharacter(premise)} in ${location}, shot ${index + 1}.`,
    directions: 'Vary the location, angle, and lighting for this frame only. Keep the idea and the locked style.',
    continuity: 'This shot stands alone and does not continue a previous shot',
    lighting: VARIED_LIGHTING[index % VARIED_LIGHTING.length]
  }
}
function sceneOverrides(value) {
  if (!Array.isArray(value)) return []
  return value.slice(0, MAX_SCENE_OVERRIDES).map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const text = (field, max) => typeof raw[field] === 'string' ? cleanText(raw[field]).slice(0, max) : ''
    const duration = raw.duration == null || raw.duration === '' ? null : canonicalDuration(raw.duration)
    return {
      action: text('action', 2000) || text('beat', 2000) || text('description', 2000),
      notes: text('notes', 1000) || text('note', 1000),
      framing: text('framing', 150),
      camera: text('camera', 300),
      lighting: text('lighting', 300) || text('mood', 300),
      duration,
      prompt: sceneOverridePrompt(raw)
    }
  })
}
function applySceneOverrides(shot, override) {
  if (!override) return shot
  const next = { ...shot }
  if (override.action) next.action = override.action
  if (override.framing) next.framing = override.framing
  if (override.camera) next.camera = override.camera
  if (override.lighting) next.lighting = override.lighting
  if (override.notes) { next.notes = override.notes; next.directions = override.notes }
  if (override.duration) { next.duration = override.duration; next.duration_seconds = override.duration }
  if (override.prompt) { next.prompt = override.prompt; next.promptEdited = true }
  return next
}
function sceneOverridePrompt(raw) {
  return typeof raw.prompt === 'string' ? raw.prompt.trim().slice(0, 16000) : ''
}
function stampPreset(project, preset) {
  if (!preset) return project
  project.preset = preset
  project.genre = preset.genre
  project.lockedStyle = preset.visual
  project.style = preset.family
  if (project.filmSheet) project.filmSheet = { ...project.filmSheet, style: preset.visual, preset }
  if (project.continuitySheet) {
    project.continuitySheet = {
      ...project.continuitySheet,
      style: preset.visual,
      lighting: preset.lighting || project.continuitySheet.lighting,
      palette: preset.palette || project.continuitySheet.palette
    }
  }
  return project
}

/** A preset family on any mode, including a plain premise. Unknown families throw 400. */
export function requestedStylePreset(options = {}) {
  const raw = String(options.style || '').trim()
  if (!raw) return null
  if (SHOT_STYLE_PROFILES[raw] || STYLES.some(item => item.id === raw.toLowerCase())) return null
  const family = canonicalStyleFamily(raw)
  if (!family) resolvePreset(raw, options.genre)
  return resolvePreset(family, options.genre)
}

export function createStoryboard(options = {}) {
  const chosenPreset = requestedStylePreset(options)
  const requestedMode = options.sequenceMode || options.mode || ''
  if (requestedMode === 'ad' || options.ad) return createPresetStoryboard(options, 'ad')
  if (requestedMode === 'series' || options.series) return createPresetStoryboard(options, 'series')
  if (requestedMode === 'explainer' || options.explainer || (options.steps && !requestedMode)) return createPresetStoryboard(options, 'explainer')
  if (options.scenario != null || requestedMode === 'scenario' || looksLikeScenario(options.premise)) return createScenarioStoryboard(options)
  const premise = cleanText(options.premise)
  if (premise.length < 8) throw new Error('Add a little more detail to your story premise (at least 8 characters).')
  if (premise.length > 6000) throw new Error('Keep your premise under 6,000 characters.')
  const model = canonicalModel(options.model || 'grok'); if (!model) throw new Error('Choose a target model: grok, google, sora, kling, runway, luma, wan, or generic.')
  const sequenceMode = options.sequenceMode === 'varied' || options.sequenceMode === 'continuous' ? options.sequenceMode : undefined
  const shotStyle = SHOT_STYLE_PROFILES[options.style] ? options.style : ''
  const genre = detectGenre(premise, options.genre)
  const lockedStyle = lockBoardStyle(premise, options.style, genre)
  const scenes = sceneOverrides(options.scenes)
  const count = scenes.length ? scenes.length : canonicalShotCount(options.count)
  const density = options.promptDensity === 'concise' || options.density === 'concise' ? 'concise' : 'standard'
  const project = { schema: 'shotboard.v1', id: options.id || newId('story'), title: titleFromPremise(premise), premise, model, target_model: model, genre, style: shotStyle || (STYLES.some(item => item.id === options.style) ? options.style : 'cinematic'), lockedStyle, promptDensity: density, aspectRatio: canonicalAspect(options.aspectRatio), duration: canonicalDuration(options.duration), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), generationMode: 'local', shots: [] }
  if (sequenceMode) project.sequenceMode = sequenceMode
  if (sequenceMode === 'continuous') {
    const sheet = { ...(options.continuitySheet || buildContinuitySheet(premise)) }
    if (!options.continuitySheet?.style) sheet.style = lockedStyle
    if (!sheet.lighting) sheet.lighting = `${sheet.time}, ${sheet.palette}`
    if (!sheet.appearance) sheet.appearance = appearanceFor(sheet.character)
    project.continuitySheet = sheet
    project.continuityStrength = options.continuityStrength === 'strict' ? 'strict' : 'standard'
  }
  project.shots = breakdownPremise(premise, count).map((shot, index) => ({ ...shot, duration: project.duration, duration_seconds: project.duration, palette: ['#b69263', '#7c99a1', '#a88a64', '#696b80', '#af8061', '#657b6f'][index % 6] }))
  if (sequenceMode === 'varied') project.shots = project.shots.map((shot, index) => applyVariedShot(shot, premise, index))
  if (shotStyle) project.shots = project.shots.map(shot => applyShotStyle(shot, shotStyle, sequenceMode === 'varied'))
  if (sequenceMode === 'continuous' && project.continuitySheet) project.shots = project.shots.map((shot, index) => applyContinuousShot(shot, project.continuitySheet, index, shotStyle))
  if (scenes.length) project.shots = project.shots.map((shot, index) => applySceneOverrides(shot, scenes[index]))
  const baseSheet = project.continuitySheet || buildContinuitySheet(premise)
  project.filmSheet = options.filmSheet || {
    characters: [{ name: baseSheet.character, look: '', outfit: baseSheet.appearance || '' }],
    places: [{ name: baseSheet.place, description: '' }],
    light: baseSheet.time || '',
    mood: '',
    style: baseSheet.style || lockedStyle
  }
  if (options.skipDetection !== true) {
    const detected = detectProse(premise)
    const hints = (detected.warnings || []).filter(item => item.code === 'missing_character')
    project.detection = {
      language: detected.language,
      confidence: detected.confidence,
      warnings: (detected.warnings || []).filter(item => item.code !== 'missing_character'),
      hints
    }
    mergeDetectedSheet(project.filmSheet, detected, options.detectionLocks || {})
  }
  stampPreset(project, chosenPreset)
  fitBoard(project)
  if (options.overwritePrompt) project.shots = project.shots.map(shot => { const next = { ...shot }; delete next.prompt; delete next.promptEdited; return next })
  project.shots = project.shots.map((shot, index) => refreshShotPrompt(shot, project, index, { overwrite: options.overwritePrompt === true }))
  return project
}
export function mergeDetectedSheet(sheet, detected, locks = {}) {
  if (!sheet || !detected) return sheet
  if (!locks.characters) {
    ;(detected.characters || []).forEach(character => {
      if (!character?.name) return
      const existing = findByName(sheet.characters, character.name)
      if (existing) {
        if (!existing.look && character.look) existing.look = character.look
        if (!existing.outfit && character.outfit) existing.outfit = character.outfit
      } else if (character.look || character.outfit) sheet.characters.push({ name: character.name, look: character.look || '', outfit: character.outfit || '' })
    })
  }
  if (!locks.places) {
    ;(detected.places || []).forEach(place => {
      if (!place?.name || findByName(sheet.places, place.name)) return
      sheet.places.push({ name: place.name, description: place.description || '' })
    })
  }
  if (!locks.light && detected.light) sheet.light = detected.light
  if (!locks.mood && detected.mood) sheet.mood = detected.mood
  return sheet
}
export function formatFilmSheet(sheet, project = {}) {
  if (!sheet) return ''
  const wardrobe = project.sequenceMode === 'continuous' ? project.continuitySheet?.appearance : ''
  const people = (sheet.characters || []).map(item => {
    const parts = [item.name]
    if (item.look && item.look !== item.outfit) parts.push(item.look)
    if (item.outfit && item.outfit !== wardrobe) parts.push(item.outfit)
    return parts.filter(Boolean).join(', ')
  }).filter(Boolean)
  const seenPlaces = new Set()
  const places = []
  ;(sheet.places || []).forEach(item => {
    const key = foldName(item?.name)
    if (!key || seenPlaces.has(key)) return
    seenPlaces.add(key)
    const description = item.description && foldName(item.description) !== key ? item.description : ''
    places.push([item.name, description].filter(Boolean).join(', '))
  })
  const product = sheet.product?.name ? `Product (locked): ${sheet.product.name}. ${sheet.product.benefit || ''}`.trim() : ''
  if (!people.length && !places.length && !product && !sheet.topic) return ''
  const lines = ['FILM SHEET']
  if (product) {
    lines.push(product)
    lines.push('Keep this product identical in every shot. No lettering in the frame.')
    if (sheet.product.cta) lines.push(`Spoken line: ${sheet.product.cta}`)
  }
  if (sheet.topic) lines.push(`Topic: ${sheet.topic}`)
  if (sheet.audience) lines.push(`Audience: ${sheet.audience}`)
  if (people.length) lines.push(`People: ${people.join('; ')}`)
  if (places.length) lines.push(`Places: ${places.join('; ')}`)
  if (sheet.light) lines.push(`Light: ${sheet.light}`)
  return lines.join('\n')
}
const LEGACY_PRESET = Object.freeze({
  scifi: ['cinema', 'scifi'],
  noir: ['cinema', 'noir'],
  horror: ['cinema', 'horror'],
  comedy: ['cinema', 'comedy'],
  drama: ['cinema', 'drama'],
  documentary: ['documentary', 'nature']
})
export function resolveScenarioPreset(options = {}) {
  const raw = String(options.style || '').trim()
  const style = raw.toLowerCase()
  const family = canonicalStyleFamily(style)
  if (style && !family && !SHOT_STYLE_PROFILES[raw]) resolvePreset(style, options.genre)
  const genre = String(options.genre || '').trim().toLowerCase()
  if (family) return resolvePreset(family, genre)
  const legacy = LEGACY_PRESET[genre]
  if (legacy) return resolvePreset(legacy[0], legacy[1])
  if (genre && presetFamilies().some(id => presetGenres(id).includes(genre))) return resolvePreset('', genre)
  return resolvePreset('', '')
}
export function applyStylePreset(project, family, genre) {
  const preset = resolvePreset(family, genre)
  const choice = CAMERAS[preset.defaultCam] || CAMERAS.medium
  const next = {
    ...project,
    preset,
    genre: preset.genre,
    lockedStyle: preset.visual,
    style: presetFamilies().includes(String(family || '').trim().toLowerCase()) ? preset.family : project.style,
    filmSheet: project.filmSheet ? { ...project.filmSheet, style: preset.visual, preset } : project.filmSheet
  }
  next.shots = (project.shots || []).map(shot => {
    if (shot.promptEdited) return { ...shot }
    const patched = { ...shot, lens: preset.lens }
    if (!shot.light) patched.lighting = preset.lighting
    if (!shot.camChosen) {
      patched.framing = choice.framing
      patched.camera = choice.camera
      patched.cam = preset.defaultCam
    }
    if (preset.voiceOver) patched.sound = preset.voiceOver
    return patched
  })
  if (next.sequenceMode === 'continuous' && next.continuitySheet) {
    next.continuitySheet = { ...next.continuitySheet, style: preset.visual, lighting: preset.lighting, palette: preset.palette }
  }
  return refreshProjectPrompts(next)
}
function presetFailure(parsed, code) {
  const message = parsed.errors.length === 1 ? parsed.errors[0].message : `This board has ${parsed.errors.length} problems.`
  const error = new Error(message || 'This board needs a correction.')
  error.status = 400
  error.code = code
  error.errors = parsed.errors
  return error
}
function createPresetStoryboard(options, mode) {
  const parsed = mode === 'ad' ? parseAd(options) : mode === 'series' ? parseSeries(options) : parseExplainer(options)
  if (!parsed.ok) throw presetFailure(parsed, `invalid_${mode}`)
  const model = canonicalModel(options.model || 'grok')
  if (!model) throw new Error('Choose a target model: grok, google, sora, kling, runway, luma, wan, or generic.')
  const explicit = cleanText(options.premise)
  const premise = explicit.length >= 8 && explicit.length <= 6000 && !looksLikeScenario(explicit) ? explicit : parsed.premise
  if (premise.length < 8) throw new Error('Add a little more detail to your story premise (at least 8 characters).')
  if (premise.length > 6000) throw new Error('Keep your premise under 6,000 characters.')
  const preset = resolveScenarioPreset(options)
  const shotStyle = SHOT_STYLE_PROFILES[options.style] ? options.style : ''
  const density = options.promptDensity === 'concise' || options.density === 'concise' ? 'concise' : 'standard'
  const defaultDuration = canonicalDuration(options.duration)
  const aspectRatio = options.aspectRatio ? canonicalAspect(options.aspectRatio) : parsed.aspectRatio
  const filmSheet = { ...parsed.filmSheet, style: preset.visual, preset }
  const shots = parsed.shots.map((draft, index) => {
    const choice = cameraFor(draft.cam)
    const duration = draft.duration || defaultDuration
    const shot = {
      id: `shot-${String(index + 1).padStart(2, '0')}`,
      shot_id: `shot-${String(index + 1).padStart(2, '0')}`,
      order: index + 1,
      stage: draft.stage,
      title: draft.title,
      framing: choice.framing,
      lens: preset.lens,
      camera: choice.camera,
      cam: draft.cam || preset.defaultCam,
      camChosen: Boolean(draft.cam),
      action: draft.action,
      what: draft.what || draft.action,
      who: draft.who || '',
      where: draft.where || '',
      episode: draft.episode,
      directions: draft.action,
      continuity: filmSheet.product?.name ? `Same product: ${filmSheet.product.name}.` : `${draft.who || 'the subject'} at ${draft.where || 'the place'}.`,
      cue: 'natural ambience',
      sound: preset.voiceOver || 'natural ambience consistent with the place',
      lighting: preset.lighting,
      duration,
      duration_seconds: duration,
      palette: ['#b69263', '#7c99a1', '#a88a64', '#696b80', '#af8061', '#657b6f'][index % 6]
    }
    if (!shot.episode) delete shot.episode
    if (draft.prompt && !options.overwritePrompt) { shot.prompt = draft.prompt; shot.promptEdited = true }
    return shot
  })
  const project = {
    schema: 'shotboard.v1',
    id: options.id || newId('story'),
    title: parsed.title || titleFromPremise(premise),
    premise,
    model,
    target_model: model,
    genre: preset.genre,
    style: shotStyle || (presetFamilies().includes(String(options.style || '').trim().toLowerCase()) ? preset.family : 'cinematic'),
    lockedStyle: preset.visual,
    preset,
    promptDensity: density,
    aspectRatio,
    duration: defaultDuration,
    sequenceMode: mode,
    filmSheet,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    generationMode: 'local',
    shots
  }
  fitBoard(project)
  project.shots = project.shots.map((shot, index) => refreshShotPrompt(shot, project, index, { overwrite: options.overwritePrompt === true }))
  return syncSequences(project)
}
function scenarioFailure(parsed) {
  const message = parsed.errors.length === 1 ? parsed.errors[0].message : `The scenario has ${parsed.errors.length} problems.`
  const error = new Error(message || 'The scenario needs a correction.')
  error.status = 400
  error.code = 'invalid_scenario'
  error.errors = parsed.errors
  return error
}
function createScenarioStoryboard(options) {
  const source = options.scenario != null ? options.scenario : options.premise
  const parsed = parseScenario(source)
  if (!parsed.ok) throw scenarioFailure(parsed)
  const model = canonicalModel(options.model || 'grok')
  if (!model) throw new Error('Choose a target model: grok, google, sora, kling, runway, luma, wan, or generic.')
  const explicit = cleanText(options.premise)
  const premise = explicit.length >= 8 && explicit.length <= 6000 && !looksLikeScenario(explicit) ? explicit : parsed.premise
  if (premise.length < 8) throw new Error('Add a little more detail to your story premise (at least 8 characters).')
  const preset = resolveScenarioPreset(options)
  const genre = preset.genre
  const shotStyle = SHOT_STYLE_PROFILES[options.style] ? options.style : ''
  const lockedStyle = preset.visual
  const density = options.promptDensity === 'concise' || options.density === 'concise' ? 'concise' : 'standard'
  const defaultDuration = canonicalDuration(options.duration)
  const defaultCam = CAMERAS[preset.defaultCam] || CAMERAS.medium
  const filmSheet = { characters: parsed.characters, places: parsed.places, light: parsed.light || '', mood: parsed.mood || '', style: preset.visual, preset }
  const shots = parsed.scenes.map((scene, index) => {
    const choice = scene.camera ? (CAMERAS[scene.camera] || defaultCam) : defaultCam
    const lightId = scene.light || parsed.light || ''
    const moodId = scene.mood || parsed.mood || ''
    const duration = scene.duration || defaultDuration
    const shot = {
      id: `shot-${String(index + 1).padStart(2, '0')}`,
      shot_id: `shot-${String(index + 1).padStart(2, '0')}`,
      order: index + 1,
      stage: `Scene ${scene.number || index + 1}`,
      title: sentence(scene.what).slice(0, 80) || `Scene ${index + 1}`,
      framing: choice.framing,
      lens: preset.lens,
      camera: choice.camera,
      cam: scene.camera || preset.defaultCam,
      camChosen: Boolean(scene.camera),
      action: scene.what,
      what: scene.what,
      who: scene.who,
      where: scene.where,
      light: scene.light || '',
      mood: scene.mood || '',
      directions: [MOODS[moodId], scene.what, preset.voiceOver].filter(Boolean).join('. '),
      continuity: `${scene.who} at ${scene.where}.`,
      cue: 'natural ambience',
      sound: preset.voiceOver || 'natural ambience consistent with the place',
      lighting: lightId ? (LIGHTS[lightId] || preset.lighting) : preset.lighting,
      duration,
      duration_seconds: duration,
      palette: ['#b69263', '#7c99a1', '#a88a64', '#696b80', '#af8061', '#657b6f'][index % 6]
    }
    if (scene.prompt && !options.overwritePrompt) { shot.prompt = scene.prompt; shot.promptEdited = true }
    return shot
  })
  const project = {
    schema: 'shotboard.v1',
    id: options.id || newId('story'),
    title: titleFromPremise(premise),
    premise,
    model,
    target_model: model,
    genre,
    style: shotStyle || (presetFamilies().includes(String(options.style || '').trim().toLowerCase()) ? preset.family : (STYLES.some(item => item.id === options.style) ? options.style : 'cinematic')),
    lockedStyle,
    preset,
    promptDensity: density,
    aspectRatio: canonicalAspect(options.aspectRatio),
    duration: defaultDuration,
    sequenceMode: 'scenario',
    filmSheet,
    scenarioBudget: parsed.budget,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    generationMode: 'local',
    shots
  }
  fitBoard(project)
  project.shots = project.shots.map((shot, index) => refreshShotPrompt(shot, project, index, { overwrite: options.overwritePrompt === true }))
  project.sequences = sequencePacks(project)
  return project
}
function scenarioShotForPrompt(shot, project) {
  const sheet = project.filmSheet
  if (!sheet) return shot
  const cast = describeCast(shot.who, sheet.characters)
  const place = describePlace(shot.where, sheet.places)
  const what = cleanText(shot.what || shot.action)
  const setting = cast && place ? `${cast} at ${place}` : (cast || place)
  const moodId = shot.mood || sheet.mood
  const lightId = shot.light || sheet.light
  return {
    ...shot,
    action: [setting, what].filter(Boolean).join('. ') || shot.action,
    lighting: shot.lighting || LIGHTS[lightId] || 'consistent natural light',
    directions: [MOODS[moodId], what || shot.directions, project.preset?.voiceOver].filter(Boolean).join('. '),
    continuity: [cast ? `Same character: ${cast}` : '', place ? `Same place: ${place}` : ''].filter(Boolean).join('. ') || shot.continuity
  }
}
export function breakdownPremise(premise, count = DEFAULT_SHOT_COUNT) {
  const text = cleanText(premise); if (text.length < 8) throw new Error('Add a little more detail to your story premise (at least 8 characters).')
  const genre = detectGenre(text)
  const total = canonicalShotCount(count)
  const stages = shotStages(total)
  const night = ['night', 'midnight', 'evening', 'neon', 'moon', 'nuit', 'noche', 'nacht'].some(word => mentionedCue(text, word)) || /夜|ночь/.test(text)
  const rain = ['rain', 'storm', 'puddle', 'drizzle', 'pluie', 'lluvia', 'regen'].some(word => mentionedCue(text, word)) || /雨/.test(text)
  const snow = ['snow', 'ice', 'winter', 'frost', 'neige', 'nieve'].some(word => mentionedCue(text, word))
  return Array.from({length:total},(_,index)=>{const template=TEMPLATES[index%TEMPLATES.length];return { ...template, sound: template.cue, lighting: index === 0 ? 'soft environmental light with cinematic shadow detail' : 'consistent with the established scene', id: `shot-${String(index + 1).padStart(2, '0')}`, shot_id: `shot-${String(index + 1).padStart(2, '0')}`, order: index + 1, story_has_night: night, story_has_rain: rain, story_has_snow: snow, genre, stage: stages[index], action: actionForBeat(text, index, stages[index]) } })
}
function styleLockFor(project) {
  if (project.sequenceMode === 'continuous' && project.continuitySheet?.style) return project.continuitySheet.style
  if ((project.sequenceMode === 'scenario' || isPresetMode(project.sequenceMode)) && project.filmSheet?.style) return project.filmSheet.style
  return project.lockedStyle || lockBoardStyle(project.premise, project.style, project.genre)
}
function shortContinuity(sheet) {
  const appearance = sheet.appearance || appearanceFor(sheet.character)
  return `${sheet.character}; ${appearance}; ${sheet.place}; ${sheet.time}.`
}
function spokenShot(shot, project) {
  if (project.promptDensity === 'concise' && project.sequenceMode === 'continuous' && project.continuitySheet && project.continuityStrength !== 'strict') {
    return { ...shot, continuity: shortContinuity(project.continuitySheet) }
  }
  return shot
}
function promptHeader(project) {
  const lines = [`Idea: ${ideaAnchor(project.premise || '')}`, `Style lock: ${styleLockFor(project)}`, `aspect ratio ${canonicalAspect(project.aspectRatio)}`]
  if (project.preset) lines.push(formatPresetBlock(project.preset))
  const film = formatFilmSheet(project.filmSheet, project)
  if (film) lines.push(film)
  return lines.join('\n')
}
export function createPrompt(shot, project, index = 0) {
  const genre = GENRES[project.genre] || GENRES.cinematic; const style = SHOT_STYLE_PROFILES[project.style] || STYLES.find(item => item.id === project.style) || STYLES[0]
  const premise = project.premise || 'a visual story'; const aspect = canonicalAspect(project.aspectRatio); const duration = shot.duration_seconds || shot.duration || project.duration || DEFAULT_SHOT_DURATION
  const lockedStyle = styleLockFor(project)
  const guided = project.sequenceMode === 'scenario' || isPresetMode(project.sequenceMode)
  const spoken = guided ? scenarioShotForPrompt(shot, project) : spokenShot(shot, project)
  const body = modelRegistry.get(project.model || project.target_model).compose({ shot: spoken, project, index, premise, aspect, duration, genre, style, lockedStyle })
  const total = Math.max(project.shots?.length || 0, index + 1)
  const header = promptHeader(project)
  if (guided && project.filmSheet) return `${header}\n${body}`
  if (project.sequenceMode === 'continuous' && project.continuitySheet) {
    const transition = index === 0 ? CONTINUOUS_TRANSITIONS[0] : index === total - 1 ? 'Finally,' : CONTINUOUS_TRANSITIONS[index] || 'Moments later,'
    const sheetText = formatContinuitySheet(project.continuitySheet)
    const follow = index === 0 ? 'The story begins in this shot.' : 'This shot follows directly from the previous shot.'
    if (project.continuityStrength === 'strict') return `${header}\n${sheetText}\n\nShot ${index + 1} of ${total}. ${transition}\nRepeat this continuity sheet verbatim:\n${sheetText}\n${follow}\n${body}`
    if (project.promptDensity === 'concise') return `${header}\nShot ${index + 1} of ${total}. ${transition}\n${follow}\n${body}`
    return `${header}\n${sheetText}\n\nShot ${index + 1} of ${total}. ${transition}\n${follow}\n${body}`
  }
  if (project.sequenceMode === 'varied') return `${header}\nIndependent shot ${index + 1} of ${total}. A separate angle, not a continuation.\n${body}`
  return `${header}\n${body}`
}
export function refreshShotPrompt(shot, project, index, { overwrite = false } = {}) {
  if (shot?.promptEdited && !overwrite) return { ...shot }
  const next = { ...shot }
  delete next.promptEdited
  next.prompt = createPrompt(next, project, index)
  return next
}
export function syncSequences(project) {
  if (!project) return project
  if (project.sequenceMode === 'scenario') project.sequences = sequencePacks(project)
  else if (isPresetMode(project.sequenceMode)) project.sequences = episodePacks(project)
  return project
}
export function refreshProjectPrompts(project, options = {}) {
  const next = { ...project, shots: (project.shots || []).map((shot, index) => refreshShotPrompt(shot, project, index, options)) }
  return syncSequences(next)
}
export function retargetMode(project, mode) {
  const allowed = mode === 'varied' || mode === 'continuous' || mode === 'scenario' || isPresetMode(mode)
  const sequenceMode = allowed ? mode : (project.sequenceMode || 'continuous')
  const next = {
    ...project,
    sequenceMode,
    filmSheet: project.filmSheet ? {
      ...project.filmSheet,
      characters: project.filmSheet.characters.map(item => ({ ...item })),
      places: project.filmSheet.places.map(item => ({ ...item }))
    } : project.filmSheet
  }
  if (sequenceMode === 'continuous' && !next.continuitySheet && next.filmSheet) {
    const character = next.filmSheet.characters[0] || {}
    const place = next.filmSheet.places[0] || {}
    next.continuitySheet = {
      character: character.name || 'the protagonist',
      appearance: [character.look, character.outfit].filter(Boolean).join(', '),
      place: place.name || 'the location',
      time: next.filmSheet.light || 'daylight consistent with the idea',
      palette: next.lockedStyle || 'natural cinematic colour',
      style: next.filmSheet.style || next.lockedStyle || 'cinematic, consistent from shot to shot',
      lighting: next.filmSheet.light || 'consistent light'
    }
    if (!next.continuityStrength) next.continuityStrength = 'standard'
  }
  return refreshProjectPrompts(next)
}
function fitBoard(project) {
  const profile = profileFor(project.model || project.target_model)
  if (!profile) return project
  project.aspectRatio = snapAspect(project.aspectRatio, profile)
  project.duration = snapDuration(project.duration, profile)
  project.shots = (project.shots || []).map(shot => {
    const duration = snapDuration(shot.duration_seconds || shot.duration || project.duration, profile)
    return { ...shot, duration, duration_seconds: duration }
  })
  return project
}
export function applyModelProfile(project, modelId) {
  const model = canonicalModel(modelId)
  if (!model) throw new Error('Choose a target model: grok, google, sora, kling, runway, luma, wan, or generic.')
  const next = { ...project, model, target_model: model, shots: (project.shots || []).map(shot => ({ ...shot })) }
  fitBoard(next)
  return refreshProjectPrompts(next)
}
export function regenerateShotPrompts(project, model = project.model || project.target_model, options = {}) {
  return refreshProjectPrompts({ ...project, model, target_model: model }, options)
}
export function regenerateOneShot(project, shotId, { overwrite = false, prompt } = {}) {
  const shots = (project?.shots || []).map(shot => ({ ...shot }))
  const index = shots.findIndex(shot => shot.id === shotId || shot.shot_id === shotId)
  if (index < 0) {
    const error = new Error(`Shot not found: ${shotId}`)
    error.status = 400
    error.code = 'invalid_shot'
    throw error
  }
  const current = shots[index]
  const untouched = shots.filter((_, item) => item !== index).map(shot => shot.prompt)
  if (typeof prompt === 'string' && !overwrite) {
    shots[index] = { ...current, prompt: prompt.slice(0, 16000), promptEdited: true }
    return { project: { ...project, shots }, skipped: true, shotId: current.id }
  }
  if (current.promptEdited && !overwrite) {
    return { project: { ...project, shots }, skipped: true, shotId: current.id }
  }
  const nextProject = { ...project, shots }
  shots[index] = refreshShotPrompt(current, nextProject, index, { overwrite: true })
  const unchanged = shots.filter((_, item) => item !== index).every((shot, item) => shot.prompt === untouched[item])
  if (!unchanged) {
    const error = new Error('Regenerating one shot changed another prompt.')
    error.status = 500
    throw error
  }
  syncSequences(nextProject)
  return { project: nextProject, skipped: false, shotId: shots[index].id }
}
export function addShot(project, index = project.shots.length) {
  const next = JSON.parse(JSON.stringify(project)); const at = Math.max(0, Math.min(index, next.shots.length))
  const shot = { id: newId('shot'), shot_id: newId('shot'), stage: 'Additional', title: `New shot ${at + 1}`, framing: 'Medium shot', lens: '35mm standard lens', camera: 'Slow push-in at eye level', action: next.premise, directions: 'Introduce a deliberate moment that advances the story. Keep the action motivated and the camera intentional.', continuity: 'Match established character appearance, props, geography, light and time of day.', cue: 'consistent ambience and restrained score', sound: 'natural ambience consistent with the previous shot', lighting: 'consistent with the previous shot', duration: project.duration, duration_seconds: project.duration || DEFAULT_SHOT_DURATION, story_has_night: false, story_has_rain: false, story_has_snow: false, order: at + 1 }
  shot.id = shot.shot_id; shot.prompt = createPrompt(shot, next, at)
  next.shots.splice(at, 0, shot); assignShotStages(next.shots); next.shots.forEach((item, index) => { item.order = index + 1; next.shots[index] = refreshShotPrompt(item, next, index) }); return next
}
export function normalizeProject(project) {
  if (!project || typeof project !== 'object' || Array.isArray(project)) throw new Error('A saved project must be an object.')
  if (project.schema != null && project.schema !== 'shotboard.v1') throw new Error('This project schema is not supported.')
  const shots = Array.isArray(project.shots) ? project.shots.filter(shot => shot && typeof shot === 'object' && !Array.isArray(shot)) : []
  const model = canonicalModel(project.model || project.target_model) || project.model || project.target_model
  return { ...project, model, target_model: model, shots: shots.map((shot, index) => {
    const id = shot.id || shot.shot_id || `shot-${String(index + 1).padStart(2, '0')}`
    const duration = canonicalDuration(shot.duration_seconds ?? shot.duration)
    const normalized = { ...shot, id, shot_id: shot.shot_id || id, order: index + 1, duration_seconds: duration, duration, prompt: shot.prompt || createPrompt(shot, project, index) }
    if (shot.promptEdited === true) normalized.promptEdited = true
    else delete normalized.promptEdited
    return normalized
  }) }
}
export function validateProject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('The document must be a JSON object.')
  const project = input.project && typeof input.project === 'object' && !Array.isArray(input.project) ? input.project : input
  const premise = cleanText(project.premise); if (premise.length < 8) throw new Error('The story premise must be at least 8 characters.'); if (premise.length > 6000) throw new Error('The story premise exceeds the 6,000-character limit.')
  const model = canonicalModel(project.model || project.target_model); if (!model) throw new Error('Choose a target model: grok, google, sora, kling, runway, luma, wan, or generic.')
  const schema = input.schema || input.schema_version || input.version || project.schema_version; if (schema != null && schema !== 'shotboard.v1') throw new Error('This project schema is not supported. Expected shotboard.v1.')
  if (!Array.isArray(project.shots) || project.shots.length < 1) throw new Error('The storyboard must contain at least one shot.')
  const ids = new Set()
  const shots = project.shots.map((shot, index) => {
    if (!shot || typeof shot !== 'object' || Array.isArray(shot)) throw new Error(`Shot ${index + 1} is not an object.`)
    if (shot.prompt != null && (typeof shot.prompt !== 'string' || shot.prompt.length > 16000)) throw new Error(`Shot ${index + 1} prompt is too long or not text.`)
    if (shot.id != null && typeof shot.id !== 'string' || shot.shot_id != null && typeof shot.shot_id !== 'string') throw new Error(`Shot ${index + 1} ID must be text.`)
    const id = String(shot.shot_id || shot.id || `shot-${String(index + 1).padStart(2, '0')}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
    if (!id || ids.has(id)) throw new Error('Shot IDs must be unique and contain only letters, digits, hyphens or underscores.'); ids.add(id)
    const duration = canonicalDuration(shot.duration_seconds ?? shot.duration)
    const normalized = { ...shot, id, shot_id: id, order: index + 1, title: cleanText(shot.title || `Shot ${index + 1}`).slice(0, 120), action: cleanText(shot.action || premise).slice(0, 6000), camera: cleanText(shot.camera?.movement || shot.camera || 'Slow push-in').slice(0, 1000), framing: cleanText(shot.camera?.framing || shot.framing || 'Medium shot').slice(0, 150), lens: cleanText(shot.camera?.lens || shot.lens || '35mm lens').slice(0, 150), lighting: cleanText(shot.lighting || 'consistent with adjacent shots').slice(0, 1500), sound: cleanText(shot.sound || 'natural environmental ambience').slice(0, 2000), continuity: cleanText(shot.continuity || 'match adjacent shot appearance').slice(0, 2000), prompt: shot.prompt || createPrompt(shot, project, index), duration_seconds: duration, duration }
    if (shot.promptEdited === true) normalized.promptEdited = true
    else delete normalized.promptEdited
    return normalized
  })
  return { version: 'shotboard.v1', project: { ...project, premise: premise.slice(0, 6000), model, target_model: model, shots } }
}
export function serializeProject(project) {
  const canonical = validateProject(project).project
  const { model, ...rest } = canonical
  return JSON.stringify({ ...rest, schema: 'shotboard.v1', model, target_model: model, exported_at: new Date().toISOString() }, null, 2)
}
export const STARTER = createStoryboard({ id: 'starter-project', premise: 'A lighthouse keeper races the dusk to repair a failing beacon before a fishing boat reaches the rocks.', title: 'Last light at the edge', genre: 'cinematic' })
function actionForBeat(premise, index, stage) {
  const facts = buildContinuitySheet(premise)
  const genre = GENRES[detectGenre(premise)] || GENRES.cinematic
  return stageBeat(stage || shotStages(index + 1)[index] || 'Opening', facts, genre)
}
function newId(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` }
