<script setup>
const items = [
  ['What is Moovicut?', 'Moovicut is a free, local-first storyboard and shot list. You edit the shots in the browser and copy prompts for Grok Imagine, Google, or any other AI image or video model.'],
  ['How does Moovicut work?', 'A premise becomes an ordered shot list on this device, with camera, action, lighting, sound, and continuity you can edit. Paste a prompt into the model you already use. Moovicut does not call that model.'],
  ['Does Moovicut render video?', 'No. It writes prompts. Nothing is rendered inside Moovicut.'],
  ['Which models does it support?', 'The picker offers Grok Imagine and Google. The same prompts work with any other AI image or video model. These names are prompt targets, not included accounts or rendering.'],
  ['Is an account required?', 'No. The storyboard stays in this browser. There is no sign-in.'],
  ['Can I import or export work?', 'Yes. Projects use the shotboard.v1 JSON format. The studio can export a project or a local library backup, and it can import a compatible file. Files stay on your device.'],
  ['Is Moovicut free?', 'Yes. Planning, editing, and JSON export are free. There is no subscription. Optional tips open Buy Me a Coffee in a new tab. Moovicut does not take payment itself.'],
  ['Are visits counted?', 'Anonymous, cookieless visit counts via Cloudflare Web Analytics; storyboards never leave the device.'],
  ['Can an AI agent build a storyboard?', 'Yes. The default board is 5 scenes of 3 seconds (15s total). Step-by-step mode in /studio, or a shots count or scenes array on POST /api/v1/storyboard and /mcp, builds a custom scene list. Open /agents for the endpoints. No API key and no account.'],
  ['What happens if browser storage is unavailable?', 'The studio reports the failure instead of claiming the save worked. Export JSON if you want a copy outside the browser.']
]
useSeoMeta({ title: 'FAQ — Moovicut', description: 'Moovicut is a free, local-first storyboard and shot list. No account and no video rendering. Prompts work with Grok Imagine, Google, or any other AI image or video model.' })
</script>
<template>
 <div class="site-shell"><AppHeader /><main class="legal-page"><div class="container-docs"><div class="page-intro"><p class="eyebrow">FAQ</p><h1>Questions, answered plainly</h1><p>Free and local. Prompts work with Grok Imagine, Google, or any other AI image or video model.</p></div><section v-for="[question, answer] in items" :key="question" class="legal-section"><h2>{{ question }}</h2><p>{{ answer }}</p></section><p><a class="button button-primary" href="https://buymeacoffee.com/enzoc1977r" target="_blank" rel="noopener">Tips</a></p></div></main><SiteFooter /></div>
</template>
