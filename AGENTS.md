# Moovicut for AI agents

Moovicut plans an editable storyboard. It does not render video, it does not require an API key or an account, and it does not store the premise.

The human site stays at `/`. Agent instructions live here, at `/agents`, and at `/agents.md`.

## Default board

Out of the box, a plan is **5 scenes × 3 seconds (15s total)**.

That matches a short Grok Imagine generation. Pass `shots` and `duration`, or a `scenes` array, only when you want a different board. People can do the same in `/studio`: the 15s preset is selected by default, 30s is 10 × 3s, 60s is 20 × 3s, and **Step-by-step storyboard** (off by default) edits each scene.

Per-scene duration must stay between 2 and 15 seconds. A board longer than 40 shots is split into parts. Each part holds at most 40 shots. The cut is the last scene boundary at or before shot 40, so a scene is not split. If one scene alone is longer than 40 shots, that scene is cut at a shot boundary and the response adds a `part_split_inside_scene` warning. No action is dropped. Every part uses the same film sheet, including each character lock line. The next part starts from the place and time in effect at the end of the previous part. The continuity checker runs on each part and across the join.

## Studio wizard

People opening `/studio` start in a six-step guide: idea, characters, places and style, shots, check, then generate. The idea step runs the same deterministic prose detection and prefills later steps. A character needs a name, age, build or face, hair, outfit, colours, and one distinctive feature. A place needs a description. Each shot needs someone from that cast, a place, one action, and a framing term from the fixed list. A line with more than one action offers a split. The check step runs the continuity checker and the risk check. Blocking issues have to be cleared before **Generate prompts** is enabled. The prompts are the ones the full editor builds from the same sheet. **Advanced mode**, one click away, keeps the full editor, Step-by-step, scenario, ad, series, and explainer. The guide is saved in this browser. The API, MCP, and `shotboard.compact.v1` are unchanged.

## Which endpoint

Use `POST /mcp` when the client speaks MCP (Cursor, Claude, and other JSON-RPC tool hosts). The call is stateless. Methods: `initialize`, `tools/list`, `tools/call`. Tools:

- `plan_storyboard` — plan a board. Returns a compact payload unless `compact` is false.
- `export_prompts` — return shot prompts only.
- `validate_storyboard` — check a `shotboard.v1` document.

Use `POST /api/v1/storyboard` for a plain JSON request. Send `compact: true` or `?compact=1` when you want only `title`, `premise`, `model`, `aspectRatio`, `studioUrl`, and `shots` of `{ order, duration, prompt }`. When the board has more than one part, the same payload adds `parts`: `{ index, from, to, place, time }`. `from` and `to` are inclusive shot orders. `place` and `time` are in effect at the start of that part. A board of 40 shots or fewer omits `parts` and stays the same payload. `format: "agent"` and `shotboard.compact.v1` include `parts` on the same rule.

Use `GET /openapi.json` for an OpenAPI 3.1 document. `GET /.well-known/mcp.json` is the discovery file. `GET /mcp` describes the endpoint.

`studioUrl` is a `/studio#board=` link. The board is in the URL fragment, so opening it does not send the premise to the server again. Very large boards fall back to `/studio` without the fragment; export JSON in that case.

## Limits

- No API key.
- 30 requests per minute per IP on `/api/*` and `/mcp`.
- Storyboard bodies: 32 KB. MCP bodies: 128 KB.
- Premise: 8 to 6,000 characters.
- Nothing is written to a database.

## Custom scenes

Humans use Step-by-step mode in `/studio`. Agents pass `shots` or `scenes` to `POST /api/v1/storyboard`, the `plan_storyboard` tool, or a `/studio#board=` link.

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

When `scenes` is present, its length is the scene count. `action` (or `beat` / `description`), `duration`, `framing`, `camera`, `lighting` (or `mood`), and `notes` override that scene. Omitted fields stay on the deterministic plan. The same JSON can be encoded into a `/studio#board=` link.

## Minimal request

```sh
curl -s https://moovicut.studio/api/v1/storyboard \
  -H 'content-type: application/json' \
  -d '{"premise":"A lighthouse keeper races the dusk to repair a failing beacon.","model":"grok","compact":true}'
```

The prompt is shaped for the model you chose. Paste it into the model you already use. Moovicut does not call that model.

## Scenario mode

Scenario mode is a guided board. Send `scenario` (an object or text) or set `mode` to `scenario`. A premise that already contains `CHARACTERS`, `PLACES`, and `SCENES` blocks is read the same way. When `scenario` is present it sets the scene count and wins over `scenes`.

Text shape:

```text
CHARACTERS
Léa — curly hair, round glasses — green apron

PLACES
Café — a small morning cafe

SCENES
Scène 1 — Léa — Café — She pours a latte
```

JSON shape uses short fields: characters `name`/`n`, `look`/`l`, `outfit`/`o`; places `name`/`n`, `description`/`desc`/`d`; scenes `who`/`w`, `where`/`at`, `what`/`do`, plus optional `camera`, `light`, `mood`, `duration`, and `prompt`. Camera is `wide`, `medium`, `close`, `insert`, `tracking`, `static`, `push`, `crane`, or `handheld`. `wide`, `medium`, `close`, and `insert` set the framing only. `tracking`, `static`, `push`, `crane`, and `handheld` set a movement. With no movement, the short prompt says `locked-off camera` and names no lens. Light is `day`, `dawn`, `dusk`, `night`, `warm`, `cool`, `hard`, `soft`, `neon`, or `practical`. Mood is `grounded`, `playful`, `tense`, `intimate`, `bold`, `quiet`, `hopeful`, or `uneasy`. Every problem comes back in one `errors` array, and the top-level `message` lists each problem. A names-only object such as a character with only `name`, a place with only `name`, and a scene with only `who` and `where` is 400. The message names the missing look, outfit, description, and action. It does not add “Add at least one character” when those fields are already named. `premise` may be omitted when `scenario` is sent. The idea line on every shot is then the character and place names only. It does not repeat the first scene’s action.

Characters, places, and light live on one film sheet. Each shot names them. The generated prompt fills in the look, outfit, and place. A prompt you send on a scene is kept. Send `overwritePrompt: true` when that prompt should be replaced.

Style presets lock one base sheet for every shot, in every mode, including a plain premise: `style` `anime`, `cinema`, or `documentary`, and a `genre` from that family (anime: shonen, shojo, seinen, slice-of-life, mecha, fantasy, ghibli; cinema: thriller, comedy, scifi, horror, drama, western, noir, romance, action; documentary: nature, history, portrait, investigation, travel). `manga` is an alias of `anime`. Omitted preset fields use cinema / drama. An unknown family or genre returns 400 and the allowed list. Changing the preset rewrites generated prompts and leaves a hand-edited prompt in place.

Scenes are packed into sequences of 15–60 seconds. Each sequence is copied separately. Aim for about 1,500 characters per minute. The response warns from 6,000 characters and stops at 8,000. A normal premise stays 8–6,000 characters.

Free text is detected only when `input` or `type` is `prose` (the text is `prose`, `text`, or `premise`, 8–8,000 characters). Detection reads English, French, Portuguese, German, Italian, Luxembourgish, Japanese, and Simplified Chinese. It is rule-based and does not call a model. Japanese and Chinese names are read from 「」, 『』, or straight double quotes. When a text has no quoted name, Japanese reads one to four kanji immediately before は or が, and Chinese reads one to three characters immediately before 把 or 是. The Japanese and Simplified Chinese studio screens say this next to the idea field. Other languages do not show that tip. When a reading is uncertain, `reliable` is false and the studio does not fill names and places from that pass. The response includes `language`, `confidence`, `warnings`, `scenario`, and the shots. A premise that does not use the `Name, trait, trait` shape is not turned into a scenario. Detection is deterministic and does not call a model. In the studio, a line you already edited is not replaced when detection runs again. When a scene’s only names are public figures, brands, or trademarks, detection adds the neutral risk note and does not add missing-character or missing-place lines for that scene. When the text cannot be planned, the response is HTTP 400 with a top-level `error`, a `message` that lists each missing piece, and `errors`.

A comma list after a name keeps the age, the look, the clothes, and a carried item in the lock line, and it stops at the clause or sentence boundary. A later first name or last name aliases the full-name character. A sentence that only describes someone (`Colette is forty-two`, `She has long auburn curls and wears a blue apron`) fills that sheet and is not a shot. Traits attach to the named subject of that clause. Capitalisation alone does not make a character: a name needs an age or role introduction, a human verb, or a repeated mention. Weekdays, months, and sentence-initial words such as `Early` or `Together` are not characters. A locative (`in`, `at`, `on`, or `inside` the noun phrase) is a place even when the noun is not on a fixed list. Quoted speech is not a place, and a person's name is not a place. If the text names no place, the board still plans and that place is returned with `uncertain: true`. Time of day applies from the sentence that states it, forward only. Before any cue the shot stays on the default light. A part's `place` and `time` are the first shot in that part. A place description uses nearby words from the text, or the place name when the text gives no further description. A place noun that only modifies an object (`office window`) does not move the scene.

Free prose is split on cues. `splitScenes` defaults to true (`split_scenes` is the same field). A real change of place or time opens one scene. A sequence word alone (`puis`, `then`, `dann`, `然后`, `それから`, and the same family in Portuguese, Italian, and Luxembourgish) opens a shot inside the current scene. Several cues in one sentence make one cut and become that scene’s settings. A cue-only sentence such as `Le lendemain.` attaches to the next sentence. A firm place in the current sentence wins over a place that was only waiting to attach. A sentence with a place or a time opens a shot even with no listed verb, and any other sentence with no known verb still becomes a shot in the current place. A place inside quotes, or after a memory or speech verb, does not move the scene, and a place named only inside quotes is not added to the sheet. An article or other stopword in a venue name (`The`, `Le`, `La`, `Les`, `Der`, `El`, and the same words in the other site languages) is not a place cue, so a later `in the` does not return to that venue. A firm locative with a real place noun wins over a match on a generic token. That family includes prefixes and endings (`pense`, `repense`, `se souvient`, `thinks`, `recalls`, `dreamed`, `记得`, and the same stems in the other site languages). A costume line is a real wear verb with a list of traits (`porte un manteau`, `wears a coat`). `la porte`, `the door`, and `ouvre la porte` are not costume lines. A listed verb also matches a regular ending (`eats` from `eat`, `lancent` from `lance` or `lancer`, `soulève` from `soulever`). Body parts, clothing, and abstract nouns are not places. A clock a few minutes later (`10:05` after `10:00`) is not a new scene. An ambiguous cue is not silent: the cut is returned with `uncertain: true` and a `reason`, and it does not become the scene’s place, so the next firm place change is not measured from that uncertain target. Number words, spelled or digits, are never characters. A venue type plus a proper name (`librairie Atlas`, `Harbottle's bookshop`, `Bäckerei Krause`, `the Blue Moon bar`, and the same pattern in the other site languages) is a place, not a character, and can open a scene. The response field `cuts` lists each cut with `cue`, `reason`, `kind` (`scene` or `shot`), `place`, `time`, `order`, and `uncertain`. The same list is on a prose response, on `shotboard.compact.v1` when the board carries cuts, and in `/studio` before generation. An uncertain cut is drawn dashed. Merge puts those shots back in the previous scene. Split promotes a shot cue into a scene. Set `splitScenes` to false to omit the cut list. A detected character with no look or outfit does not reject the board. Each one is a `missing_look` or `missing_outfit` warning. `promptLanguage` translates that warning; the studio uses the site language. An explicit scenario object stays strict: a names-only character is still 400. Characters, place, and time of day carry forward until a cue changes them. The continuity checker flags a place or time change that has no cue.

A plain premise can name people as `Name, trait, trait`. `Maya, early 30s, short black pixie cut, charcoal wool coat, meets Rui, 50s, grey stubble, navy peacoat, rust-red scarf, on a rainy quay. She hands him a letter. He reads it and walks away.` keeps Maya (look: early 30s, short black pixie cut; outfit: charcoal wool coat) and Rui (look: 50s, grey stubble; outfit: navy peacoat, rust-red scarf), the place rainy quay, and one shot per real action: she hands him a letter, he reads it, he walks away. `she` and `he` follow the person introduced in the first sentence. A premise without that shape stays the default 5 × 3s board. The same paragraph sent as `{"input":"prose","prose":"..."}` returns those shots.

## Ad, series, and explainer

These are light presets on the same planner. They share the film sheet, `promptEdited`, and the model profile.

- `mode` `ad`: send `product` and `benefit`, or an `ad` object. Optional `cta` and `setting`. The board is four shots: hook, hero, proof, and pack shot. The product is locked on the film sheet and named in every generated prompt. The default aspect is 9:16.
- `mode` `series`: send `seriesTitle` and `hook`, or a `series` object, plus `episodes` as a count from 3 to 8 or one line per episode. Episodes share one character and one place. Each episode is three shots. The default aspect is 9:16.
- `mode` `explainer`: send `topic` and `steps` (a numbered list or an array). Each line is exactly one shot. Duration is snapped to the selected model profile (Veo accepts 4, 6, or 8 seconds; Luma accepts 5 or 9). The default aspect is 16:9.

A `prompt` on an ad shot, an episode, or a step sets `promptEdited` and is kept unless `overwritePrompt` is true. An unknown mode returns 400 and the allowed list: continuous, varied, scenario, ad, series, explainer. A normal premise without these fields stays the default 5 × 3s board.

## One shot, and risk warnings

Send `regenerateShot` (or `shotId`) plus `project` or `storyboard` to rebuild one shot. Every other prompt stays as it was. A shot marked `promptEdited`, or a `prompt` included in that request, is kept unless `overwritePrompt` is true. The same action is **Regenerate this shot** in `/studio`, in every mode.

`warnings` is added to a response only when a shot looks risky: too many actions for a short shot, on-screen text, a crowd, more than two people, a name that is not on the film sheet, two camera moves that fight each other, a hand-off / very visible hands / held object (`hands_or_held_object`), a missing or contradicted character lock, a duplicated trait, an unknown character, an undeclared wardrobe change, more than one action (`several_actions`), or a missing framing term. Each warning has `shotId`, `order`, `code`, `message`, and `fix`. A warning with `fixId` is the one-click fix in `/studio`. Warnings never reject the board. A default 5 × 3s plan has no `warnings` key. The same verb is not counted twice when `what` and `action` repeat each other, so `He walks away` is not `too_many_actions`. `POST /api/v1/storyboard` splits a multi-action shot into one shot per action unless `splitActions` is false. A shot marked `promptEdited` stays in one shot. The studio Fix button still splits one shot. `format: "agent"` includes `warnings` when any shot looks risky.

## Video prompt

The text copied for the video model is **short by default**. Send `prompt_style` or `promptStyle` as `short` or `detailed`. An unknown value is 400 and lists the two allowed values. Send optional `promptLanguage` or `prompt_language` as `en`, `zh-Hans`, `pt`, `ja`, `fr`, `de`, `lb`, or `it`. Omitted means `en`. An unknown value is 400 and lists the eight codes. In the studio the same choice is the site language. There is no separate English-prompt control.

A short prompt is one shot, in this order, in every prompt language: the framing term, the character name or names, and the action with that subject named; then only the characters in that shot, each with their full lock line; then the full place description, shortened only on a comma or clause when the prompt must fit; then exactly one light sentence, where the shot’s light wins and the preset’s lighting is left out when the shot defines light; then the style without that preset lighting, and the camera line (`locked-off camera` in English) unless the user set a movement. No lens is added unless the user set one. The person’s own idea, names, places, and actions stay as typed. Fixed lines follow `promptLanguage`. A shot with hands or a held object adds one line, `Simple hands, the held object stays the same shape.` It does not paste the full film sheet, a list of everyone who is absent, or the continuity paragraph, and it does not say who is not yet in frame. The hard cap is about 700 characters. Fitting shortens the style, the light, and the place first. The action and the lock line are never shortened.

`prompt_style: "detailed"` keeps the previous long prompt, with the film sheet, the style preset block, and the continuity text in every shot, and it also pastes the same lock line. The same choice is the **Short / Detailed** control in `/studio`.

The film sheet, presets, and continuity data stay on the board, in the studio, and in `shotboard.compact.v1`. They are how the next shot stays consistent. A short prompt copies each character's lock line, not the whole sheet.

## Character lock

Each character has one lock line built from the film sheet: body or age, face, hair, outfit, colors, and distinctive marks. That line is pasted unchanged into every shot where the character appears, in short prompts, detailed prompts, scenario, quick idea, and `shotboard.compact.v1`. Edit it once on the character sheet. A wardrobe change is `states` on that character, `{ "fromOrder": 3, "change": "coat removed" }`. It replaces the outfit from that shot forward. The face, hair, and marks stay the same.

Every shot gets one framing term from a fixed list, written in the prompt in English: `wide shot`, `medium shot`, `close-up`, `extreme close-up`, `high angle`, `low angle`, `over-the-shoulder`, `POV`, `tracking shot`, `static shot`, `crane shot`. Aliases such as plan d'ensemble, gros plan, plongée, contre-plongée, and amorce map to those English terms. The studio picker can change the term. One action per shot: a line with several verbs joined by and, then, or while, or more than one sentence of action, can be split into separate shots.

The character sheet stores a turnaround (front, side, back), expressions, palette, outfit, props, and image slots for references you supply. Nothing is uploaded. Moovicut does not call an image or video API. Export a character packet as JSON or Markdown from `/studio`. `format: "agent"` includes `lockLine` and the sheet on each character.

A prompt marked `promptEdited` is left untouched when the prompt style, mode, style preset, or model changes, and when **Regenerate this shot** runs. Reset still replaces that one prompt, and Undo puts the edit back. `overwritePrompt: true` is the explicit regenerate.

## Shared film sheet

Quick idea, Step-by-step, continuous story, scenario, ad, series, and explainer share one film sheet: characters, places, style, and light. An ad also locks the product. Switching modes keeps that sheet and every prompt marked `promptEdited`. Style presets are the same families in every mode. A quick idea also detects names and places and shows the warnings so you can correct them. A field you already edited is not replaced.

The personal library (`shotboard.library.v1`) saves characters, places, and styles in this browser only. Export and import that JSON file from `/studio`. Nothing is uploaded.

Send `format: "agent"` to get `shotboard.compact.v1` for any mode: title, premise, model, aspect, mode, style, genre, film sheet, shots, and `warnings` when a shot looks risky. Post that document back to resume it. Minified JSON, with no extra whitespace, is the token-efficient way to send that compact document. Shots with `promptEdited` stay as written unless `overwritePrompt` is true, which regenerates them. The default compact plan response does not add these fields. `/api/*` and `/mcp` are limited to 30 requests a minute per client IP. The limiter uses Railway's `X-Real-IP` (the visitor address; Cloudflare sits in front, so `X-Forwarded-For` is not read) and falls back to the socket address. The same bucket applies across connections.

## Target models

`model` accepts `grok`, `google` (Veo), `sora`, `kling`, `runway`, `luma`, `wan`, or `generic`. The same id works on `POST /api/v1/storyboard` and `plan_storyboard`. Choosing a model keeps the film sheet and any prompt you edited, and it fits shot length, aspect, prompt form, and the risk check to that model.

The limits live in `app/utils/model-profiles.js`. Each profile cites the provider’s official page and the date it was checked. A value the page does not state is marked unverified. Veo accepts 4, 6, or 8 seconds, in 16:9 or 9:16. Grok Imagine and Google keep their existing labeled prompts. The other profiles export prose. A full storyboard response includes `modelProfile`. The default compact payload does not.

## Interface languages

The website is available in English (default), Simplified Chinese (`zh-Hans`), Portuguese (`pt`), Japanese (`ja`), French (`fr`), German (`de`), Luxembourgish (`lb`), and Italian (`it`). A header control on every page lists those languages by their own names. The choice is remembered in browser storage (`moovicut.language`). The first visit, with nothing stored, follows `navigator.language` when it matches one of the eight, and otherwise English. Shareable URLs use `?lang=` (English omits it). `<html lang>` and `hreflang` alternates follow that choice. Path prefixes such as `/fr` still redirect to the English page.

String catalogs are `app/i18n/locales/<code>.json`. English is the source of truth: each key is the English UI string, and every catalog has exactly the same keys. Nothing is translated by a model or a paid API at runtime. To add a language, add a catalog with those keys, a `LOCALES` row in `app/i18n/logic.js`, and an import in `app/i18n/index.js`.

The interface changes, including the six-step studio guide. In the studio the fixed prompt lines follow the site language. Optional `promptLanguage` or `prompt_language` on `POST /api/v1/storyboard`, `/mcp`, and `shotboard.compact.v1` is `en`, `zh-Hans`, `pt`, `ja`, `fr`, `de`, `lb`, or `it`. Omitted means `en`, so an existing client still receives the English prompt. JSON field names stay English. A typed language that differs from the prompt language is a soft hint, not an error. The `Name, trait, trait` premise shape is English-shaped.
