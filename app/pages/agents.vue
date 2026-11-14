<script setup>
const { copyText } = useNotifier()
const copied = ref(false)
const agentPrompt = `Use Moovicut to plan a storyboard. No API key and no account. Moovicut does not render video and does not store the premise.

Default board: 5 scenes × 3 seconds (15s total).

REST: POST https://moovicut.studio/api/v1/storyboard
MCP: POST https://moovicut.studio/mcp
OpenAPI: https://moovicut.studio/openapi.json
Discovery: https://moovicut.studio/.well-known/mcp.json
Guide: https://moovicut.studio/agents.md

Send compact:true for a short payload (title, premise, model, aspectRatio, studioUrl, shots with order, duration, prompt).
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
useSeoMeta({
  title: 'Agents — Moovicut',
  description: 'Free storyboard API and MCP for AI agents. No API key and no account. The default board is 5 scenes of 3 seconds.'
})
</script>
<template>
 <div class="site-shell"><AppHeader /><main class="docs-page"><div class="container-docs">
  <div class="page-intro"><p class="eyebrow">AGENTS</p><h1>Plan a storyboard from an agent</h1><p class="studio-local-badge">Free · No API key · No account</p><p>The home page stays for people. This page is the map for connectors. Moovicut does not render video, and it does not save the premise.</p></div>
  <section class="docs-section"><h2>Default board</h2><p>Out of the box, every plan is <strong>5 scenes × 3 seconds (15s total)</strong>. Pass <code>shots</code> and <code>duration</code>, or a <code>scenes</code> array, when you want a different length. People can do the same in <a href="/studio">/studio</a> with the 15s, 30s, and 60s presets or Step-by-step mode.</p></section>
  <section class="docs-section"><h2>Endpoints</h2><ul class="agent-capability-grid"><li class="card"><h3>MCP</h3><p><code>POST /mcp</code></p><p>JSON-RPC <code>initialize</code>, <code>tools/list</code>, and <code>tools/call</code>. Tools: <code>plan_storyboard</code>, <code>export_prompts</code>, <code>validate_storyboard</code>.</p></li><li class="card"><h3>OpenAPI</h3><p><code>GET /openapi.json</code></p><p>OpenAPI 3.1 for GPT, Gemini, Muse, and other connector agents.</p></li><li class="card"><h3>Storyboard</h3><p><code>POST /api/v1/storyboard</code></p><p>JSON in, storyboard out. <code>compact: true</code> or <code>?compact=1</code> returns the short payload.</p></li></ul><p>Discovery file: <a href="/.well-known/mcp.json">/.well-known/mcp.json</a>. Guide: <a href="/agents.md">/agents.md</a>. Rate limit: 30 requests per minute per IP. Bodies are limited to 32 KB on the storyboard route and 128 KB on MCP.</p></section>
  <section class="docs-section"><h2>Minimal request</h2><div class="code-sample"><div class="code-sample-header"><span>curl</span></div><pre>{{ curlExample }}</pre></div><p>The response includes <code>studioUrl</code>, a <code>/studio#board=</code> link. The hash stays in the browser, so opening it does not upload the premise again.</p></section>
  <section class="docs-section"><h2>Custom scenes</h2><p>Omit <code>scenes</code> for the 5 × 3s default. Include it when each scene needs its own beat, duration, camera, or lighting. The array length becomes the scene count.</p><div class="code-sample"><div class="code-sample-header"><span>scenes</span></div><pre>{{ scenesExample }}</pre></div></section>
  <section class="docs-section"><h2>Scenario</h2><p>Send <code>scenario</code> or set <code>mode</code> to <code>scenario</code>. Characters, places, and light are stored once and resolved in each generated prompt. <code>style</code> can be <code>anime</code> (<code>manga</code> is an alias), <code>cinema</code>, or <code>documentary</code>, with a genre from that family. The same preset locks a plain premise too. An unknown family is 400. The default preset is cinema / drama. <code>input: "prose"</code> detects the same structure from free text and returns confidence and warnings. A normal premise is not auto-detected. A <code>prompt</code> on a scene is kept unless <code>overwritePrompt</code> is true. Validation errors come back together in <code>errors</code>. <code>regenerateShot</code> plus <code>project</code> rebuilds one shot. <code>warnings</code> appears only when a shot looks risky and never blocks the board. <code>format: "agent"</code> returns <code>shotboard.compact.v1</code> for every mode. Post that document back to resume it. Shots marked <code>promptEdited</code> stay unless <code>overwritePrompt</code> is true. The rate limit uses Railway's <code>X-Real-IP</code> and ignores <code>X-Forwarded-For</code>. It counts across connections. A repeated model warning is returned once per board. <code>model</code> accepts <code>grok</code>, <code>google</code>, <code>sora</code>, <code>kling</code>, <code>runway</code>, <code>luma</code>, <code>wan</code>, or <code>generic</code>. A full response includes <code>modelProfile</code> and the source URLs.</p></section>
  <section class="docs-section"><h2>Ad, series, and explainer</h2><p><code>mode</code> <code>ad</code> takes a product and a benefit, plus an optional call to action, and plans hook, hero, proof, and pack shot. The product stays locked on the film sheet. <code>mode</code> <code>series</code> plans 3 to 8 vertical episodes that share one character and one place. <code>mode</code> <code>explainer</code> turns a numbered list into one action per shot and snaps each duration to the selected model. A shot marked <code>promptEdited</code> is kept unless <code>overwritePrompt</code> is true.</p></section>
  <section class="docs-section"><h2>Copy prompt for your AI</h2><p>Paste this into Cursor, Claude, ChatGPT, or Grok.</p><div class="code-sample"><div class="code-sample-header"><span>Setup</span><button type="button" @click="copyAgentPrompt">{{ copied ? 'Copied' : 'Copy prompt for your AI' }}</button></div><pre>{{ agentPrompt }}</pre></div></section>
 </div></main><SiteFooter /></div>
</template>
