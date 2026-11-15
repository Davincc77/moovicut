<script setup>
import { socialPreviewSeo } from '~/utils/social-preview.js'
const runtimeConfig = useRuntimeConfig()
const socialPreview = socialPreviewSeo(runtimeConfig.public.productionOrigin || runtimeConfig.public.appUrl, runtimeConfig.app.baseURL)
const { copyText } = useNotifier()
const copied = ref(false)
const agentPrompt = `Use Moovicut to plan a storyboard. No API key and no account. Moovicut does not render video and does not store the premise.

Default board: 5 scenes × 3 seconds (15s total).

REST: POST https://moovicut.studio/api/v1/storyboard
MCP: POST https://moovicut.studio/mcp
OpenAPI: https://moovicut.studio/openapi.json
Discovery: https://moovicut.studio/.well-known/mcp.json
Guide: https://moovicut.studio/agents.md

Send compact:true for a short payload (title, premise, model, aspectRatio, studioUrl, shots with order, duration, prompt). A board longer than 40 shots is split into parts of at most 40 shots, cut at a scene boundary. parts lists the part index, the inclusive shot range, and the starting place and time. A board of 40 shots or fewer omits parts.
Open studioUrl in a browser. It is a /studio#board= link. The board is in the hash and is not saved on the server.

Custom boards: pass shots and duration, or a scenes array. Each scene may set action (or beat), duration, framing, camera, lighting (or mood), and notes. Humans can do the same with Step-by-step mode in /studio.

Rate limit: 30 requests per minute per IP.`
const curlExample = `curl -s https://moovicut.studio/api/v1/storyboard \\
  -H 'content-type: application/json' \\
  -d '{"premise":"A lighthouse keeper races the dusk to repair a failing beacon.","model":"grok","compact":true}'`
const scenesExample = `{
  "premise": "A lighthouse keeper races the dusk to repair a failing beacon.",
  "model": "grok",
  "scenes": [
    { "action": "Wide view of the lighthouse at dusk", "duration": 3, "framing": "Extreme wide", "camera": "Slow push-in", "lighting": "Blue hour" },
    { "action": "Close on the keeper repairing the lens", "duration": 4, "lighting": "Warm practical lamp", "notes": "Wind on the gallery" }
  ]
}`
async function copyAgentPrompt() {
  copied.value = await copyText(agentPrompt, 'Agent prompt copied.')
}
const { t } = useI18n()
useSeoMeta({
  title: computed(() => t('Agents — Moovicut')),
  ogTitle: computed(() => t('Agents — Moovicut')),
  twitterTitle: computed(() => t('Agents — Moovicut')),
  description: computed(() => t('Free storyboard API and MCP for AI agents. No API key and no account. The default board is 5 scenes of 3 seconds.')),
  ogDescription: computed(() => t('Free storyboard API and MCP for AI agents. No API key and no account. The default board is 5 scenes of 3 seconds.')),
  twitterDescription: computed(() => t('Free storyboard API and MCP for AI agents. No API key and no account. The default board is 5 scenes of 3 seconds.')),
  ...socialPreview
})
const copy1 = `Out of the box, every plan is <strong>5 scenes × 3 seconds (15s total)</strong>. Pass <code>shots</code> and <code>duration</code>, or a <code>scenes</code> array, when you want a different length. People opening <a href="/studio">/studio</a> start in a six-step guide. Advanced mode keeps the 15s, 30s, and 60s presets and Step-by-step mode. The API is unchanged.`
const copy13 = `A board longer than 40 shots is split into parts. Each part holds at most 40 shots, and the cut is at a scene boundary. One scene longer than 40 shots is cut at a shot boundary and marked. The same film sheet, including each character lock line, is used in every part. The next part starts from the place and time in effect at the end of the previous part. <code>parts</code> is added only when there is more than one part. A board of 40 shots or fewer stays the same.`
const copy2 = `<code>POST /mcp</code>`
const copy3 = `JSON-RPC <code>initialize</code>, <code>tools/list</code>, and <code>tools/call</code>. Tools: <code>plan_storyboard</code>, <code>export_prompts</code>, <code>validate_storyboard</code>.`
const copy4 = `<code>GET /openapi.json</code>`
const copy5 = `<code>POST /api/v1/storyboard</code>`
const copy6 = `JSON in, storyboard out. <code>compact: true</code> or <code>?compact=1</code> returns the short payload.`
const copy7 = `Discovery file: <a href="/.well-known/mcp.json">/.well-known/mcp.json</a>. Guide: <a href="/agents.md">/agents.md</a>. Rate limit: 30 requests per minute per IP. Bodies are limited to 32 KB on the storyboard route and 128 KB on MCP.`
const copy8 = `The response includes <code>studioUrl</code>, a <code>/studio#board=</code> link. The hash stays in the browser, so opening it does not upload the premise again.`
const copy9 = `Omit <code>scenes</code> for the 5 × 3s default. Include it when each scene needs its own beat, duration, camera, or lighting. The array length becomes the scene count.`
const copy10 = `The prompt for the video model is <strong>short by default</strong>. <code>prompt_style</code> is <code>short</code> or <code>detailed</code> (<code>promptStyle</code> is the same field). Short leads with the framing term in the prompt language, the character name, and the action, then only the people in that shot with their full lock line, the full place, one light, and the style with <code>locked-off camera</code> unless a movement was set. No lens is added unless one was set. The lock line is edited once on the character sheet and is not shortened per shot. A character packet exports that line, the turnaround, and the prompts as JSON or Markdown. Reference images are ones you supply. Moovicut does not call an image or video API. Hands or a held object add one stability line. The film sheet, preset, and continuity text stay on the board and in <code>shotboard.compact.v1</code>. They are not pasted into every short prompt. Short prompts stay under about 700 characters, and fitting shortens style, light, and place before the action or the lock line. <code>detailed</code> keeps the previous long prompt. In <a href="/studio">/studio</a> the control is Short / Detailed. A hand-edited prompt is kept when you switch that control, change mode, or regenerate, until you reset it. Undo puts the edit back.`
const copy11 = `Send <code>scenario</code> or set <code>mode</code> to <code>scenario</code>. <code>premise</code> may be omitted. The idea line is then the character and place names, not the first scene’s action. Characters, places, and light are stored once and resolved in each generated prompt. <code>style</code> can be <code>anime</code> (<code>manga</code> is an alias), <code>cinema</code>, or <code>documentary</code>, with a genre from that family. The same preset locks a plain premise too. An unknown family is 400. The default preset is cinema / drama. <code>input: "prose"</code> detects the same structure from free text and returns the shots, confidence, and warnings. A paragraph that cannot be planned is HTTP 400 and the message lists each missing piece. A premise shaped as <code>Name, trait, trait</code> keeps those people, splits look and outfit, and uses the real action sentences. <code>splitActions: false</code> keeps a multi-action line in one shot. When a scene’s only names are public figures, brands, or trademarks, the studio shows the neutral risk note and does not add missing-character or missing-place lines. A <code>prompt</code> on a scene is kept unless <code>overwritePrompt</code> is true. Validation errors come back together in <code>errors</code>. <code>regenerateShot</code> plus <code>project</code> rebuilds one shot. <code>warnings</code> appears only when a shot looks risky and never blocks the board. <code>format: "agent"</code> returns <code>shotboard.compact.v1</code> for every mode, including <code>warnings</code> when a shot looks risky. Post that document back to resume it. Minified JSON, with no extra whitespace, is the token-efficient way to send that compact document. Shots marked <code>promptEdited</code> stay unless <code>overwritePrompt</code> is true. The rate limit uses Railway's <code>X-Real-IP</code> and ignores <code>X-Forwarded-For</code>. It counts across connections. A repeated model warning is returned once per board. <code>model</code> accepts <code>grok</code>, <code>google</code>, <code>sora</code>, <code>kling</code>, <code>runway</code>, <code>luma</code>, <code>wan</code>, or <code>generic</code>. A full response includes <code>modelProfile</code> and the source URLs.`
const copy12 = `<code>mode</code> <code>ad</code> takes a product and a benefit, plus an optional call to action, and plans hook, hero, proof, and pack shot. The product stays locked on the film sheet. <code>mode</code> <code>series</code> plans 3 to 8 vertical episodes that share one character and one place. <code>mode</code> <code>explainer</code> turns a numbered list into one action per shot and snaps each duration to the selected model. A shot marked <code>promptEdited</code> is kept unless <code>overwritePrompt</code> is true.`
</script>
<template>
 <div class="site-shell"><AppHeader /><main class="docs-page"><div class="container-docs">
  <div class="page-intro"><p class="eyebrow">AGENTS</p><h1>{{ $t('Plan a storyboard from an agent') }}</h1><p class="studio-local-badge">{{ $t('Free · No API key · No account') }}</p><p>{{ $t('The home page stays for people. This page is the map for connectors. Moovicut does not render video, and it does not save the premise.') }}</p></div>
  <p>{{ $t('Fixed prompt lines follow the site language. Optional promptLanguage on the API defaults to en, so an existing client still gets English. Free-prose detection reads English, French, Portuguese, German, Italian, Luxembourgish, Japanese, and Simplified Chinese. It does not call a model. Japanese and Chinese names are read from 「」 or from は/が and 是/把. When a reading is uncertain, the studio says so and does not fill names. Your own words stay as typed.') }}</p>
  <p>{{ $t('Free prose is split on place and time cues. A sequence word alone stays in the same scene. splitScenes defaults to true. Each cut has a cue and a reason. A character with no look still returns a board and a warning.') }}</p>
  <section class="docs-section"><h2>{{ $t('Default board') }}</h2><p v-html="$th(copy1)"></p><p v-html="$th(copy13)"></p></section>
  <section class="docs-section"><h2>{{ $t('Endpoints') }}</h2><ul class="agent-capability-grid"><li class="card"><h3>{{ $t('MCP') }}</h3><p v-html="$th(copy2)"></p><p v-html="$th(copy3)"></p></li><li class="card"><h3>{{ $t('OpenAPI') }}</h3><p v-html="$th(copy4)"></p><p>{{ $t('OpenAPI 3.1 for GPT, Gemini, Muse, and other connector agents.') }}</p></li><li class="card"><h3>{{ $t('Storyboard') }}</h3><p v-html="$th(copy5)"></p><p v-html="$th(copy6)"></p></li></ul><p v-html="$th(copy7)"></p></section>
  <section class="docs-section"><h2>{{ $t('Minimal request') }}</h2><div class="code-sample"><div class="code-sample-header"><span>curl</span></div><pre>{{ curlExample }}</pre></div><p v-html="$th(copy8)"></p></section>
  <section class="docs-section"><h2>{{ $t('Custom scenes') }}</h2><p v-html="$th(copy9)"></p><div class="code-sample"><div class="code-sample-header"><span>scenes</span></div><pre>{{ scenesExample }}</pre></div></section>
  <section class="docs-section"><h2>{{ $t('Video prompt') }}</h2><p v-html="$th(copy10)"></p></section>
  <section class="docs-section"><h2>{{ $t('Scenario') }}</h2><p v-html="$th(copy11)"></p></section>
  <section class="docs-section"><h2>{{ $t('Ad, series, and explainer') }}</h2><p v-html="$th(copy12)"></p></section>
  <section class="docs-section"><h2>{{ $t('Copy prompt for your AI') }}</h2><p>{{ $t('Paste this into Cursor, Claude, ChatGPT, or Grok.') }}</p><div class="code-sample"><div class="code-sample-header"><span>Setup</span><button type="button" @click="copyAgentPrompt">{{ copied ? $t('Copied') : $t('Copy prompt for your AI') }}</button></div><pre>{{ agentPrompt }}</pre></div></section>
 </div></main><SiteFooter /></div>
</template>
