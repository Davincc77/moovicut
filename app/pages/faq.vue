<script setup>
const items = [
  ['What is Moovicut?', 'Moovicut is a free, local-first storyboard and shot list. You edit the shots in the browser and copy prompts for Grok Imagine, Google, or any other AI image or video model.'],
  ['How does Moovicut work?', 'A premise becomes an ordered shot list on this device, with camera, action, lighting, sound, and continuity you can edit. Paste a prompt into the model you already use. Moovicut does not call that model.'],
  ['Does Moovicut render video?', 'No. It writes prompts. Nothing is rendered inside Moovicut.'],
  ['Which models does it support?', 'The home page and the studio list eight prompt targets: Grok Imagine, Google (Veo / Gemini), Sora, Kling, Runway, Luma, Wan, and a generic profile. These names are prompt targets, not included accounts or rendering.'],
  ['Is an account required?', 'No. The storyboard stays in this browser. There is no sign-in.'],
  ['Can I import or export work?', 'Yes. Projects use the shotboard.v1 JSON format. The studio can export a project or a local library backup, and it can import a compatible file. Files stay on your device.'],
  ['Is Moovicut free?', 'Yes. Planning, editing, and JSON export are free. There is no subscription. Optional tips open Buy Me a Coffee in a new tab. Moovicut does not take payment itself.'],
  ['Are visits counted?', 'Anonymous, cookieless visit counts via Cloudflare Web Analytics. The site also keeps a simple server-side visit count (POST /api/visits) stored on a persistent volume, with no personal data. Storyboards never leave the device.'],
  ['Can an AI agent build a storyboard?', 'Yes. The default board is 5 scenes of 3 seconds (15s total). Step-by-step mode in /studio, or a shots count or scenes array on POST /api/v1/storyboard and /mcp, builds a custom scene list. Scenario mode and input prose are on the same endpoints. Open /agents for the endpoints. No API key and no account. Mode ad, series, and explainer are light presets on the same endpoints. A shot marked promptEdited is kept when the film sheet, style preset, or model changes. Regenerate this shot rebuilds one prompt. Risk warnings never block the board. Quick idea, Step-by-step, continuous story, and scenario share one film sheet. format agent resumes any of them. The model can be Grok Imagine, Veo, Sora, Kling, Runway, Luma, Wan, or a generic profile. Shot length and aspect follow that model’s documented limits.'],
  ['What happens if browser storage is unavailable?', 'The studio reports the failure instead of claiming the save worked. Export JSON if you want a copy outside the browser.']
]
useSeoMeta({ title: 'FAQ — Moovicut', description: 'Moovicut is a free, local-first storyboard and shot list. No account and no video rendering. Prompts work with Grok Imagine, Google, or any other AI image or video model.' })
</script>
<template>
 <div class="site-shell"><AppHeader /><main class="legal-page"><div class="container-docs"><div class="page-intro"><p class="eyebrow">FAQ</p><h1>Questions, answered plainly</h1><p>Free and local. Prompts work with Grok Imagine, Google, or any other AI image or video model.</p></div><section v-for="[question, answer] in items" :key="question" class="legal-section"><h2>{{ question }}</h2><p>{{ answer }}</p></section></div></main><SiteFooter /></div>
</template>
