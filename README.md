# Moovicut

Moovicut is a free, local-first storyboard and shot list. You write a premise, edit the shots, and copy prompts for Grok Imagine, Google, or any other AI image or video model. It does not render video and it does not require an account.

Moovicut is independent. It is not affiliated with, endorsed by, or sponsored by xAI, Grok, Google, OpenAI, DeepSeek, or any other AI company.

Optional tips open https://buymeacoffee.com/enzoc1977r in a new tab. Moovicut does not take payment itself.

The browser and the command-line interface share one prompt engine and the `shotboard.v1` project format. The site is responsive. There is no desktop app.

## Languages

The site UI is in eight languages. English is the default. The others are Simplified Chinese (中文, `zh-Hans`), Portuguese (Português, `pt`), Japanese (日本語, `ja`), French (Français, `fr`), German (Deutsch, `de`), Luxembourgish (Lëtzebuergesch, `lb`), and Italian (Italiano, `it`).

A language control sits in the header of every page. It is a native `<select>`, so it is keyboard accessible, and each option uses that language’s own name. The choice is saved in this browser under `moovicut.language`. On a first visit, with nothing saved and no `lang` query, the site picks the first `navigator.languages` tag that matches one of those eight and otherwise stays in English. Traditional Chinese does not match Simplified Chinese. `de-LU` matches German, because German is listed before Luxembourgish. An explicit choice is written into the address as `?lang=` (English omits the parameter) and keeps the path, the other query parameters, and the hash, including a `/studio#board=` link. Opening `?lang=fr` selects French even when another language is stored.

`<html lang>` follows the active language. Shareable alternates are `hreflang` links for `x-default`, `en`, `zh-Hans`, `pt`, `ja`, `fr`, `de`, `lb`, and `it`. English and `x-default` use the URL without `lang`. Older path prefixes such as `/fr` and `/ja` still redirect to the English page. They are not language routes.

Catalogs are JSON files in `app/i18n/locales/`. English is the source of truth: the key is the English string, and every other file has exactly those keys. There is no translation API at runtime. To add a language, add `app/i18n/locales/<code>.json` with the same keys, add a row to `LOCALES` in `app/i18n/logic.js` (`code`, `htmlLang`, `native`), and import the file in `app/i18n/index.js`. `tests/i18n.test.mjs` checks that the keys match and that the switcher lists all eight names.

The interface is translated, including the six-step studio guide. In the studio, fixed prompt lines follow that same language: framing, light, mood, style preset, the camera line, lock-line labels, and shot structure. The person’s own idea, names, places, and actions stay as typed. The short-prompt order is the same in every language, and fitting still shortens the style, the light, and the place before the action. API and MCP clients send optional `promptLanguage` (or `prompt_language`). Omitted means `en`, so an existing client gets the English prompt. JSON field names stay English. Free-prose detection (`input` or `type` set to `prose`) reads all eight languages. It does not call a model. Japanese and Chinese names need 「」 or 『』 (straight quotes work too). With no quote, Japanese needs one to four kanji immediately before は or が, and Chinese needs one to three characters immediately before 把 or 是. That limit is written next to the idea field in the Japanese and Simplified Chinese studio only. When a reading is uncertain, the studio says so and does not fill the names. A typed language that differs from the site language shows a soft hint. A premise shaped as `Name, trait, trait` is English-shaped. The guide’s strings live in the same catalogs as the rest of the interface.

## Requirements

- **Node.js 20 or newer**, matching `package.json` `"engines": { "node": ">=20" }`. A current Node.js LTS release is recommended.
- **npm**, installed with Node.js.

```sh
node --version
npm --version
```

## Run the web app

```sh
npm ci
npm run dev
```

Open the address printed in the terminal, normally `http://localhost:3000`. The studio is at `/studio`. Stop the server with **Ctrl+C**.

```sh
npm run dev -- --port 3001
```

`npm start` serves a built site with `server/index.mjs`, including visit counts. Production on Railway uses `server/prod-server.mjs`, which serves the generated site from `/`. Both servers keep the visit count in `COUNTER_FILE` when that path can be written. The default is `/data/visits.json`.

### Quick start

1. Open **Studio**. The guide is the default.
2. **Idea.** Write one sentence or a short paragraph. Detection fills the later steps when it can, and marks what it guessed.
3. **Characters.** Each person needs a name, age, build or face, hair, outfit, colours, and one distinctive feature. The lock line updates as you type. Add or remove people.
4. **Places and style.** Each place needs a description. Choose light and mood from the lists, and a style preset (anime / manga, cinema, or documentary, plus a genre). The preset locks the film sheet.
5. **Shots.** One shot at a time: who, place, one action, and a framing term (wide shot, medium shot, close-up, high angle, over-the-shoulder, and the rest of that list). If the action line contains more than one action, split it.
6. **Check.** Continuity and the risk check run here. Blocking issues have a one-click fix and must be cleared.
7. **Generate prompts.** The button stays off until every required field is filled and the check has no blocking issue. Then copy a shot prompt, copy the compact agent JSON, export the character sheet, or regenerate one shot.

**Advanced mode** opens the full editor (Step-by-step, scenario, ad, series, explainer, and the rest). **Back to the guide** returns to the wizard. Refreshing the page keeps the guide in this browser.

Projects stay in this browser. They are not synced to another browser or computer. Export JSON if you want a backup.

## Free core, dark mode and optional support

Planning, editing, reordering, undo and redo, local projects, JSON import and export, and the CLI are free. There is no account and no subscription.

**Dark mode** in the studio header is saved on this device. **Support the project** opens https://buymeacoffee.com/enzoc1977r in a new tab.

## Tests and production build

```sh
npm test
NUXT_APP_BASE_URL=/ npm run build
```

`npm test` runs the prompt engine, CLI, project store, Vue checks, and redirect checks.

`npm run build` and `npm run generate` both run `nuxt generate`. Nuxt writes the static site to `.output/public/`. That folder is generated output. Railway uses `NUXT_APP_BASE_URL=/ npm run build`, then `node server/prod-server.mjs`.

### Deploy

The public site is [https://moovicut.studio](https://moovicut.studio), served from `/` by `node server/prod-server.mjs`.

These addresses answer **301** and keep the query string:

- `/shotboard` and `/shotboard/...` go to the same path at the site root. `npm start` applies the same redirects.
- `/dashboard/ai-video/home` goes to `/studio`, including locale copies such as `/ja/dashboard/ai-video/home`.
- `/pricing`, `/profile`, `/developers`, `/login`, `/signin`, `/auth/...`, and `/desktop` go to `/studio`, including locale copies such as `/ja/desktop`.
- Locale copies of FAQ, privacy, terms, and content policy go to the English page. A locale root such as `/de` goes to `/`.

`shotboard.v1`, `shotboard.backup.v1`, the `shotboard` CLI name, `window.Shotboard`, and the `/shotboard` redirects stay as they are.

### Visit count

Mount a Railway volume at `/data` on the service that runs `node server/prod-server.mjs`. The visit count is a JSON file. `COUNTER_FILE` sets the path and defaults to `/data/visits.json`. When `COUNTER_FILE` is unset, `STATS_DATA_PATH` is used instead. `npm start` uses the same file.

On startup the server reads the file and continues the count. It writes at most every few seconds, and it writes again when the process receives SIGTERM or SIGINT, which is the signal a redeploy sends. The write goes to a temporary file in the same directory and is renamed into place.

A missing file starts the count at 0 and is created on the next save. A malformed file starts at 0 and is replaced on the next save. When the file or `/data` cannot be written, the server logs one warning and keeps the count in memory for that process. Visit requests return from the in-memory count, and a storage problem leaves the rest of the server running.

## Use the CLI

The command name is `moovicut`. `shotboard` remains an alias in the package bin. No API key is required. With no `--shots` or `--duration`, the CLI plans **5 scenes × 3 seconds (15s total)**.

## Agents

`/agents` documents the stateless API. `POST /api/v1/storyboard` and the MCP tool `plan_storyboard` use the same default: 5 scenes of 3 seconds. Pass `shots` and `duration`, or a `scenes` array, for a custom scene-by-scene board. People can do that in `/studio` with Step-by-step mode. Scenario mode accepts a `scenario` object or a `CHARACTERS` / `PLACES` / `SCENES` block, and `input: "prose"` detects that structure from free text in English, French, Portuguese, German, Italian, Luxembourgish, Japanese, or Simplified Chinese. A plain premise shaped as `Name, trait, trait` keeps those people, splits look and outfit, and builds shots from the action sentences instead of the five template beats. The same paragraph as prose returns those shots; a paragraph that cannot be planned is HTTP 400 and the message lists each missing piece. A names-only scenario object is 400 and the message names each missing field. `POST` splits a multi-action shot unless `splitActions` is false. `format: "agent"` includes `warnings` when a shot looks risky. `He walks away` is one action. `mode` `ad` turns a product and a benefit into hook, hero, proof, and pack shot, with the product locked on the film sheet. `mode` `series` plans 3 to 8 vertical episodes on one sheet. `mode` `explainer` turns a numbered list into one action per shot and snaps duration to the selected model profile. Style presets (`anime`, with `manga` as an alias, `cinema`, `documentary`, plus a genre) lock one film sheet into every generated shot, including a plain premise. An unknown family is rejected. The video prompt is short by default (`prompt_style` `short` or `detailed`). Short leads with the English framing, the character name, and the action, then each person’s full lock line, the full place, one light sentence, and the style with `locked-off camera` unless a movement was set. No lens is added unless one was set. It stays under about 700 characters, and fitting never shortens the action or the lock line. Detailed keeps the full sheet and the same lock line. The film sheet, the character sheet, and `shotboard.compact.v1` still hold the lock. A character packet (JSON or Markdown) exports the lock lines, the turnaround text, and the shot prompts. Reference images are ones you supply. Moovicut does not call an image or video API. A shot marked `promptEdited`, or a `prompt` you send on a scene or on a posted agent board, is kept unless you reset it or send `overwritePrompt: true`. Reset can be undone. A scene whose only names are public figures, brands, or trademarks shows the neutral risk note and does not add missing-character or missing-place lines. Send `regenerateShot` with the existing `project` to rebuild one shot. The response adds `warnings` only when a shot looks risky, and those warnings never block the board. Every mode shares one film sheet, and switching modes keeps it. `format: "agent"` returns `shotboard.compact.v1` so an agent can resume any project. Minified JSON, with no extra whitespace, is the token-efficient way to send that compact document. A scenario may omit `premise`; the idea line is then the character and place names, not the first scene’s action. Characters, places, and styles can be saved in the browser library and exported as a file. `model` can be `grok`, `google`, `sora`, `kling`, `runway`, `luma`, `wan`, or `generic`. Shot length, aspect, prompt form, and the risk check follow that model’s official limits, which are cited in `app/utils/model-profiles.js`. A prompt you edited stays as you left it. `studioUrl` opens `/studio#board=` in the browser. Nothing is stored. See `AGENTS.md`, `GET /openapi.json`, and `/.well-known/mcp.json`.

```json
{
  "premise": "A lighthouse keeper races the dusk to repair a failing beacon.",
  "model": "grok",
  "scenes": [
    { "action": "Wide view of the lighthouse at dusk", "duration": 3, "framing": "Extreme wide", "camera": "Slow push-in", "lighting": "Blue hour" },
    { "action": "Close on the keeper repairing the lens", "duration": 4, "lighting": "Warm practical lamp", "notes": "Wind on the gallery" }
  ]
}
```

```sh
node cli/moovicut.mjs --premise "A lighthouse keeper races the dusk" --model grok
node cli/moovicut.mjs --premise "A paper map in space" --model google --shots 4 --output storyboard.json
node cli/moovicut.mjs --input storyboard.json --export-prompts
node cli/moovicut.mjs --help
```

Edit a `shotboard.v1` document:

```sh
node cli/moovicut.mjs --input storyboard.json --set-title "Night Crossing" --output renamed.json
node cli/moovicut.mjs --input storyboard.json --shot-id shot-02 --patch '{"camera":"Slow dolly"}' --output edited.json
node cli/moovicut.mjs --input storyboard.json --move shot-02 --direction -1 --output reordered.json
node cli/moovicut.mjs --input storyboard.json --delete shot-02 --output shortened.json
```

You can pipe a `shotboard.v1` JSON document through standard input. Use `--capabilities` for the supported fields. Each shot keeps a stable `shot_id`.

## JSON format

A project file looks like this:

```json
{
  "schema": "shotboard.v1",
  "title": "Night Crossing",
  "premise": "A lighthouse keeper races the dusk.",
  "target_model": "grok",
  "aspectRatio": "16:9",
  "shots": [
    {
      "shot_id": "shot-01",
      "order": 1,
      "title": "The lamp",
      "camera": "Slow push in",
      "framing": "Wide",
      "prompt": "A lighthouse lamp flares against a dark sea."
    }
  ]
}
```

A library backup uses `shotboard.backup.v1` and holds saved projects from this browser. Import it from the studio.

## Project structure

```text
Moovicut/
├── app/                       # Nuxt application (srcDir: app/)
│   ├── assets/css/main.css    # Application styles
│   ├── components/            # Navigation, studio, and FAQ UI
│   ├── composables/           # Project store and notices
│   ├── pages/                 # Home, Studio, FAQ, Agents, and legal pages
│   ├── plugins/               # window.Shotboard on the open studio page
│   └── utils/                 # Prompt engine and reference content
├── cli/moovicut.mjs           # Offline editor (moovicut and shotboard)
├── public/                    # Artwork, favicon, and agent guides
├── server/                    # Production static server and visit server
├── tests/                     # Node test suite
├── nuxt.config.ts
├── package.json
└── README.md
```

## No account

Moovicut does not create an account, store a password, or keep a hosted project history. Old sign-in addresses redirect to `/studio`.

## Browser automation

An open studio page exposes `window.Shotboard`. `window.Moovicut` is the same object. It can create a project, edit a shot, and export JSON. It is not a public HTTP API.

```js
const result = window.Shotboard.createProject({
  premise: 'A lighthouse keeper races the dusk',
  model: 'grok'
})
const project = window.Shotboard.exportJSON()
```

See `public/llms.txt` and `public/product.md`.

## Planned measurement

Grok Imagine video is billed per second of output by resolution, not by prompt tokens. Public pricing for grok-imagine-video-1.5 lists $0.08, $0.14, and $0.25 per second at 480p, 720p, and 1080p. A later comparison would measure cost per usable video, the usable rate, the median number of attempts until a clip is acceptable, and agent-side text tokens. Moovicut does not call that video API. This repository does not run the comparison and does not include an API key.

The planned protocol is two arms, model grok-imagine-video-1.5, 15 seconds, 720p, 16:9, three ideas, five runs each, and blind pairwise ratings. A clip counts as usable when every criterion is at least 2 and character consistency is at least 3. The notes behind that plan cite xAI video pricing, Promptfoo, Artificial Analysis Video Arena, StoryEval, and ViStoryBench.

## License: MIT

Copyright (c) 2026 Davincc77. The full text is in [LICENSE](LICENSE).
