# Moovicut

Moovicut is a free, local-first storyboard and shot list for short films. It does not generate video.

## Start

- `/` explains the local planning workflow.
- `/studio` opens a six-step guide by default (idea, characters, places and style, shots, check, generate). Advanced mode keeps the full editor. The guide requires a name, age, build or face, hair, outfit, colours, and one distinctive feature for each character; a description for each place; and one person, one place, one action, and a framing term for each shot. Generate prompts stays off until the check step has no blocking issue. It also creates and edits storyboards. The open studio page exposes `window.Shotboard` (and the `window.Moovicut` alias) for in-page automation. The default board is 5 scenes × 3 seconds. Step-by-step mode, off by default, edits each scene. Scenario mode takes characters, places, and scene lines, and can detect them from pasted prose. A premise shaped as `Name, trait, trait` keeps those people and the real actions. Ad, series, and explainer are light presets on the same film sheet. A shot marked promptEdited is kept. Any mode can regenerate one shot and shows risk warnings that do not block the board. Every mode shares one film sheet. Each character has a lock line copied unchanged into every shot, plus a character sheet and a JSON or Markdown packet. A browser library can save characters, places, and styles. The prompt target can be Grok Imagine, Veo, Sora, ChatGPT video, Midjourney video, MiniMax Hailuo, ByteDance Seedance, Pika, Kling, Runway, Luma, Wan, or a generic profile.
- `/faq` answers common questions. The page follows the language selected in the header.
- The interface is available in English, 中文 (`zh-Hans`), and Português. The header control stores the choice in this browser. A first visit follows `navigator.language` when it matches, and otherwise stays in English. `?lang=pt` or `?lang=zh-Hans` is the shareable form. English omits `lang`. The studio guide uses the same catalogs. Fixed prompt lines follow the site language. Optional `promptLanguage` defaults to English for API clients. Free-prose detection reads English, Portuguese, and Simplified Chinese and does not call a model. Nothing is sent to an external AI. A long story is split on place and time cues (`splitScenes`, default true). The current firm place wins, and a sentence with no listed verb is kept. An article inside a venue name is not a place cue. Each cut includes the cue and a reason. A character with no look still returns a board and a warning.
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
