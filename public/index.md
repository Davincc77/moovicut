# Moovicut

Moovicut is a free, local-first storyboard and shot list for short films. It does not generate video.

## Start

- `/` explains the local planning workflow.
- `/studio` creates and edits storyboards. The open studio page exposes `window.Shotboard` (and the `window.Moovicut` alias) for in-page automation. The default board is 5 scenes × 3 seconds. Step-by-step mode, off by default, edits each scene. Scenario mode takes characters, places, and scene lines, and can detect them from pasted prose. Any mode can regenerate one shot and shows risk warnings that do not block the board. Every mode shares one film sheet, and a browser library can save characters, places, and styles. The prompt target can be Grok Imagine, Veo, Sora, Kling, Runway, Luma, Wan, or a generic profile.
- `/faq` answers common questions in English.
- `/agents` documents `POST /mcp`, `GET /openapi.json`, and `POST /api/v1/storyboard`. `/agents.md` and `/.well-known/mcp.json` are the text and discovery files. No API key is required, and premises are not stored.
- Optional tips open https://buymeacoffee.com/enzoc1977r in a new tab. Moovicut does not take payment itself.

A premise becomes an ordered shot list. Camera, lens, framing, action, lighting, sound, continuity, and the complete prompt are editable. The prompts work with Grok Imagine, Google, or any other AI image or video model. Grok Imagine and Google are the prompt-format targets in the picker, not bundled generation services.

Projects stay in this browser unless you export a file. No account is required.

Older addresses such as `/dashboard/ai-video/home`, `/desktop`, `/pricing`, `/profile`, `/developers`, and `/login` redirect to `/studio`. Locale copies of those pages redirect to `/studio` or to the matching English page. `/shotboard` and paths under it redirect to the same path at the site root.

## Commands

```sh
node cli/moovicut.mjs --premise "A lighthouse keeper races the dusk." --model google --output storyboard.json
node cli/moovicut.mjs --input storyboard.json --export-prompts
```

The `shotboard` command is the same CLI. Project files use the `shotboard.v1` schema.

See `product.md`, `faq.md`, `llms.txt` and `llms-full.txt` for the text-only guide.
