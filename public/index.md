# Moovicut

Moovicut is a free, local-first storyboard and shot list for short films. It does not generate video.

## Start

- `/` explains the local planning workflow.
- `/studio` opens a six-step guide by default (idea, characters, places and style, shots, check, generate). Advanced mode keeps the full editor. The guide requires a name, age, build or face, hair, and outfit for each character. Colours and a distinctive feature are optional. No character skips only the cast. A place needs a real name and a description, plus light, mood, style, and genre. The setting and O lugar are not place names, and a shot action that only repeats the idea is not an action. Each shot needs one person, unless it is marked no character, plus one place, one action, a framing term, and a duration from 2 to 15 seconds. Next and the stepper stay on a step until every one of those fields is filled, and a saved guide reopens on the first incomplete step. A shot with nobody selected stays on Shots unless that shot or the story has no character. Check names the first unfinished step and offers a button that opens it. Generate prompts stays off until the check step has no blocking issue. It also creates and edits storyboards. The open studio page exposes `window.Shotboard` (and the `window.Moovicut` alias) for in-page automation. The default board is 5 scenes × 3 seconds. Step-by-step mode, off by default, edits each scene. Scenario mode takes characters, places, and scene lines, and can detect them from pasted prose. A premise shaped as `Name, trait, trait` keeps those people and the real actions. Ad, series, and explainer are light presets on the same film sheet. A shot marked promptEdited is kept. Any mode can regenerate one shot and shows risk warnings that do not block the board. Every mode shares one film sheet. Each character has a lock line copied unchanged into every shot, plus a character sheet and a JSON or Markdown packet. A browser library can save characters, places, and styles. The prompt target can be Grok Imagine, Veo, Sora, ChatGPT video, Midjourney video, MiniMax Hailuo, ByteDance Seedance, Pika, Kling, Runway, Luma, Wan, or a generic profile.
- `/faq` answers common questions. The page follows the language selected in the header.
- The interface is available in English and Português. The header control stores the choice in this browser. A first visit follows `navigator.language` when it matches, and otherwise stays in English. `?lang=pt` is the shareable form. English omits `lang`. The studio guide uses the same catalogs. Fixed prompt lines follow the site language. Optional `promptLanguage` defaults to English for API clients. Free-prose detection reads English and Portuguese and does not call a model. Nothing is sent to an external AI. A long story is split on place and time cues (`splitScenes`, default true). The current firm place wins, and a sentence with no listed verb is kept. An article inside a venue name is not a place cue. Each cut includes the cue and a reason. A character with no look still returns a board and a warning.
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
