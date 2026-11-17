# Moovicut

Moovicut is a free, local-first storyboard and shot list. You write a premise, edit the shots, and copy prompts for Grok Imagine, Google, or any other AI image or video model. It does not render video and it does not require an account.

Moovicut is independent. It is not affiliated with, endorsed by, or sponsored by xAI, Grok, Google, OpenAI, DeepSeek, or any other AI company.

Optional tips open https://buymeacoffee.com/enzoc1977r in a new tab. Moovicut does not take payment itself.

The browser and the command-line interface share one prompt engine and the `shotboard.v1` project format. The site is responsive. There is no desktop app.

## Languages

The site UI is in two languages. English is the default. The other is Portuguese (Português, `pt`).

A language control sits in the header of every page. It is a native `<select>`, so it is keyboard accessible, and each option uses that language’s own name. The choice is saved in this browser under `moovicut.language`. On a first visit, with nothing saved and no `lang` query, the site picks the first `navigator.languages` tag that matches one of those two and otherwise stays in English. `zh`, `zh-Hans`, `zh-CN`, `fr`, `ja`, `it`, `de`, and `de-LU` are not a site language. They are skipped, the same way `es` is skipped, and the site uses the next match or English. A `promptLanguage` of `zh-Hans`, `fr`, `ja`, `it`, or `de` is HTTP 400, and the message lists `en` and `pt`. An explicit choice is written into the address as `?lang=` (English omits the parameter) and keeps the path, the other query parameters, and the hash, including a `/studio#board=` link. Opening `?lang=pt` selects Portuguese even when another language is stored. `?lang=fr`, `?lang=ja`, and `?lang=it` do not select a language.

`<html lang>` follows the active language. Shareable alternates are `hreflang` links for `x-default`, `en`, and `pt`. English and `x-default` use the URL without `lang`. Older path prefixes such as `/zh`, `/zh-Hans`, `/fr`, `/ja`, `/it`, and `/de` still redirect to the English page. They are not language routes.

Catalogs are JSON files in `app/i18n/locales/`. English is the source of truth: the key is the English string, and every other file has exactly those keys. There is no translation API at runtime. To add a language, add `app/i18n/locales/<code>.json` with the same keys, add a row to `LOCALES` in `app/i18n/logic.js` (`code`, `htmlLang`, `native`), and import the file in `app/i18n/index.js`. `tests/i18n.test.mjs` checks that the keys match and that the switcher lists all three names.

The interface is translated, including the six-step studio guide. In the studio, fixed prompt lines follow that same language: framing, light, mood, style preset, the camera line, lock-line labels, and shot structure. The person’s own idea, names, places, and actions stay as typed. The short-prompt order is the same in every language, and fitting still shortens the style, the light, and the place before the action. API and MCP clients send optional `promptLanguage` (or `prompt_language`). Omitted means `en`, so an existing client gets the English prompt. JSON field names stay English. Free-prose detection (`input` or `type` set to `prose`) reads English and Portuguese. It does not call a model. A medium or long story is split on place and time cues (`splitScenes`, default true). The current firm place wins over a place that was waiting to attach, and a sentence is not dropped when it has no listed verb. An article inside a venue name is not a place cue, and a place named only inside quotes is not added to the sheet. A sequence word alone stays in the same scene. Each cut comes back with the cue and a reason. A character found without a look still returns a board, plus a warning in the site language. Number words are not characters. A named shop such as `librairie Atlas` or `Harbottle's bookshop` is a place. An uncertain “toward” cue does not move the scene. The check step in `/studio` lists those cuts before generation: an uncertain cut is dashed, and you can merge it or split a shot into a scene. An explicit scenario that names a character without a look is still rejected. Chinese names need 「」 or 『』 (straight quotes work too). With no quote, Chinese needs one to three characters immediately before 把 or 是. That limit is written next to the idea field in the Simplified Chinese studio only. French, Japanese, and Italian are not read. When a reading is uncertain, the studio says so and does not fill the names. A typed language that differs from the site language shows a soft hint. A premise shaped as `Name, trait, trait` is English-shaped. The guide’s strings live in the same catalogs as the rest of the interface.

## Place library licence

Place names come from a static file, `app/data/place-lexicon.json`. It is a compilation. Portuguese entries are from OpenWN-PT, which is ShareAlike, so the shipped file is under **CC BY-SA 4.0**. If you share that file or an adaptation, credit the sources and use CC BY-SA 4.0.

| Source | What it supplies | Licence |
|---|---|---|
| Princeton WordNet 3.0 | English place-type hyponyms | [WordNet licence](https://wordnet.princeton.edu/license-and-commercial-use) |
| Open Multilingual Wordnet 1.4 (Francis Bond and Kyonghee Paik) | The synset links for Portuguese | Compilation of the wordnet below |
| OpenWN-PT | Portuguese lemmas | CC BY-SA |

The same credits are on the site at [/credits](https://moovicut.studio/credits). Detail is in `docs/place-library.md`.

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

This README is on the site as a page at [/readme](https://moovicut.studio/readme) and as raw markdown at [/README.md](https://moovicut.studio/README.md). The agent skill is a page at [/skill](https://moovicut.studio/skill) and raw Markdown at [/SKILL.md](https://moovicut.studio/SKILL.md).

`/agents` documents the stateless API. `POST /api/v1/storyboard` and the MCP tool `plan_storyboard` use the same default: 5 scenes of 3 seconds. A description sentence fills the character sheet and is not a shot. A sentence that only sets the place, the time, or a person's appearance is the same: it feeds context and does not become a shot. Age, every garment, and every carried item stay in that character's lock line, including Part 2, and a trait does not move from one character to another. An agent sending a scenario should fill one complete character sheet per character before the shots. A sheet that omits an age, garment, or carried item the story names is filled from that text and returned with a warning (`character`, `field`, `value`, `source`). `strict_sheet` true keeps HTTP 400. Lock lines are versioned: a wardrobe or item change starts a new version, and earlier shots, including Part 2 when the change is later, keep the previous one. The object of a carry, hand, pick-up, or drop verb starts an item version when it is any concrete noun, such as a letter, a pastry, a key, or a basket, in English or Portuguese. An abstract noun or a place is not an item. A note such as coat removed removes only that garment, and puts on X adds only that garment. A takes off, tira, or despe that the version already applied does not raise undeclared_wardrobe. Kiln and forno are places. A definite locative with an unknown place noun still produces a PLACE line. A short beat such as an applause is one shot, and Portuguese `veste o fato` is one shot. The phrase is complete, it does not end on a preposition, and a carried item such as a camera, a ticket punch, a fan, or a walkie-talkie stays in the line. Matching is on word boundaries. A character introduced later gets that lock line. A Portuguese role keeps the gender written in the text. A later first name aliases the full name. A story with no named place still plans, and that place is marked uncertain. Time of day applies from the sentence that states it, forward only. A story longer than 40 shots is split into parts of at most 40 shots. The same character sheet and place sheet are reused across parts. The response includes `parts`. Nothing is sent to an external AI. Detection stays rule-based. Places come from a static library for English and Portuguese (`docs/place-library.md`). A sure place can name the setting when it appears. The place after a preposition is the whole noun phrase. A time word, a verb, a pronoun, a body part, a garment, a room surface, an object, a clothing phrase, a language, or an abstract noun is never that phrase. A rejected candidate is not carried. A movement into a new location adopts the noun phrase even when it is not already in the lexicon. Portuguese night and evening cues set night light from that sentence until the next time cue. An explicit morning or dawn cue (`The next morning`, `at dawn`, `Na manhã seguinte`, `ao amanhecer`) replaces that carried night. A clothing phrase, a manner adverb, an idiom such as `entra em cena`, and a label that would end on a preposition are not places. A trailing `com` or `with` plus a tool is stripped. A locative in a time-jump sentence (`at` / `in` / `to the`, `na` / `no` / `à` / `ao`) adopts the new place from that shot on. A description sentence that also sets the time keeps its place on the following shots. A lock line repeats age, hair, outfit, a carried item, and role on every shot of that character. A hair phrase, a garment led by a or an, and a noun phrase such as jaqueta de couro stay in that line. A later sentence that uses the item does not replace it. A board with far fewer shots than the sentences in the premise adds a `short_board` warning. `invalid_plan` tells the agent to resubmit the full story as one scene per beat or as plain prose (`input` `prose`) and not to shorten it. `GET /api/v1/storyboard` does not plan a board and points to `POST`. One action beat is one shot: do not merge beats, list only the people in that shot, set light on every shot, and split a story over 40 shots into parts. A scenario that packs many actions into few shots is HTTP 400 `invalid_plan`. An ambiguous word counts only in a locative. An unlisted noun is kept only inside a locative frame, and the shot is flagged. Each shot keeps its source sentence and a flag on every guessed field. A later place is not copied onto an earlier shot. A pronoun continues the last person only when that person is the only candidate. A scene keeps its place until a new locative sentence, a beat whose subject names a new place, or a movement such as crosses, wades into, caminha até, or vai para replaces it. Sea and beach stay different places. Conservatory, atrium, study, sea, átrio, escritório, estufa, and mar are sure places. A watch, the object or the verb, is never a place. A sentence where someone enters also replaces the place. A place inside dialogue, a memory, a glance, or a destination the sentence does not reach does not move the scene. A later place is not copied onto earlier shots, and a shot is not dropped because its place is still unknown. An adjective, a garment, and a possessive are never the place. A pronoun continues the last person when that person is the only candidate; otherwise the person field is empty and flagged. Each shot keeps the source sentence. In Portuguese every narrative sentence is a shot; a portrait line is not. A time phrase such as “in the evening” is not a character. A held, worn, or used noun is never the place, and a person's name wins over a place word. Pass `shots` and `duration`, or a `scenes` array, for a custom scene-by-scene board. People can do that in `/studio` with Step-by-step mode. Scenario mode accepts a `scenario` object or a `CHARACTERS` / `PLACES` / `SCENES` block, and `input: "prose"` detects that structure from free text in English, Portuguese, or Simplified Chinese. French, Japanese, and Italian are not read. A plain premise shaped as `Name, trait, trait` keeps those people, splits look and outfit, and builds shots from the action sentences instead of the five template beats. The same paragraph as prose returns those shots; a paragraph that cannot be planned is HTTP 400 and the message lists each missing piece. A premise that names people or several actions, and that cannot be planned into those shots, is HTTP 400 `invalid_plan`, not a template board. Characters, places, and scenes sent at the top level, instead of inside `scenario`, are HTTP 400 `misplaced_scenario_fields`. The message names each field and shows a short example. That error outranks `invalid_premise` when the premise is missing. Scene `what` and `who` count toward `invalid_plan`. Age and role stay in the character lock line. A constraint such as "without touching", "不接触", or "sem se tocar" stays in the short prompt and the detailed prompt. A shot size already written in the action is used once, and the response adds a `shot_size_in_action` warning. The message names every dropped person and quotes every dropped action, each one ending in a period (`This action was not planned: "Maya hands Rui a letter on the quay".`). Send a scenario. `who` and `w` accept a string or a list of names. A wrong shape says that a string or a list of names is expected. `format: "agent"` warns with `empty_characters` or `empty_places` when that list is empty, and with `empty_who` or `empty_where` on a scenario shot. A Chinese short prompt names the subject, then the place with 在, then the action, with no full stop between the name and the verb. A names-only scenario object is 400 and the message names each missing field. `POST` splits a multi-action shot unless `splitActions` is false. `format: "agent"` includes `warnings` when a shot looks risky. `He walks away` is one action. `mode` `ad` turns a product and a benefit into hook, hero, proof, and pack shot, with the product locked on the film sheet. `mode` `series` plans 3 to 8 vertical episodes on one sheet. `mode` `explainer` turns a numbered list into one action per shot and snaps duration to the selected model profile. Style presets (`anime`, with `manga` as an alias, `cinema`, `documentary`, plus a genre) lock one film sheet into every generated shot, including a plain premise. An unknown family is rejected. The video prompt is short by default (`prompt_style` `short` or `detailed`). Short leads with the English framing, the character name, and the action, then each person’s full lock line, the full place, one light sentence, and the style with `locked-off camera` unless a movement was set. No lens is added unless one was set. It stays under about 700 characters, and fitting never shortens the action or the lock line. Detailed keeps the full sheet and the same lock line. The film sheet, the character sheet, and `shotboard.compact.v1` still hold the lock. A character packet (JSON or Markdown) exports the lock lines, the turnaround text, and the shot prompts. Reference images are ones you supply. Moovicut does not call an image or video API. A shot marked `promptEdited`, or a `prompt` you send on a scene or on a posted agent board, is kept unless you reset it or send `overwritePrompt: true`. Reset can be undone. A scene whose only names are public figures, brands, or trademarks shows the neutral risk note and does not add missing-character or missing-place lines. Send `regenerateShot` with the existing `project` to rebuild one shot. The response adds `warnings` only when a shot looks risky, and those warnings never block the board. Every mode shares one film sheet, and switching modes keeps it. `format: "agent"` returns `shotboard.compact.v1` so an agent can resume any project. Minified JSON, with no extra whitespace, is the token-efficient way to send that compact document. A scenario may omit `premise`; the idea line is then the character and place names, not the first scene’s action. Characters, places, and styles can be saved in the browser library and exported as a file. `model` can be `grok`, `google`, `sora`, `chatgpt`, `midjourney`, `hailuo`, `seedance`, `pika`, `kling`, `runway`, `luma`, `wan`, or `generic`. Shot length, aspect, prompt form, and the risk check follow that model’s official limits, which are cited in `app/utils/model-profiles.js` and `docs/model-profiles.md`. A prompt you edited stays as you left it. `studioUrl` opens `/studio#board=` in the browser. Nothing is stored. See `AGENTS.md`, `GET /openapi.json`, and `/.well-known/mcp.json`.

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
├── SKILL.md
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
