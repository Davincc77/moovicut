---
name: moovicut
description: Turn a user's idea into a Moovicut storyboard. Use when planning shots, calling POST /api/v1/storyboard, checking characters, places, one action per shot, framing, the 40-shot part cap, promptLanguage, or warnings.
---

# Moovicut

Moovicut plans an editable storyboard. It does not render video, it does not need an API key, and it does not store the premise. Nothing is sent to an external AI. Paste the returned prompt into the model the user already uses.

The live skill is [https://moovicut.studio/skill](https://moovicut.studio/skill). Raw Markdown is [https://moovicut.studio/SKILL.md](https://moovicut.studio/SKILL.md).

## Turn an idea into a request

1. One action beat is one shot. Count the actions and send exactly one scene for each. Never merge beats, and never shorten the story or drop actions to get under a limit. If the idea joins two verbs with and, then, or while, or packs several action sentences into one scene, make one shot per beat. Send the whole scenario in one request. A story longer than 40 shots is split into parts of at most 40, and every part reuses the same character sheet and place sheet. When the story names people, do not send `input` `"prose"`. Send `scenario.characters` first, one full sheet per person, then one scene per beat. Prose is only for a premise that names nobody. The API returns 400 `invalid_plan` when a scenario packs many actions into far fewer shots. The message says how to resubmit the full story. Do not answer that 400 with a shorter board. Put in `who` only the characters who appear in that shot. Set `time` on a scene when the story names the time of day (`dawn`, `morning`, `midday`, `afternoon`, `dusk`, `evening`, `night`). That value drives the light line and carries forward until a later scene changes it. `light` stays the lighting quality (`day`, `dawn`, `dusk`, `night`, `warm`, `cool`, `hard`, `soft`, `neon`, `practical`). `evening`, `morning`, `afternoon`, and `midday` in `light` are stored as `time` and are not a 400. If you omit both, a cue in the action is used (`At night`, `The next morning`, `à tarde`, `De manhã`, `à noite`). Set `light` as well when you want a lighting quality. The API still splits a line on and, then, or while unless `splitActions` is false. `GET /api/v1/storyboard` does not plan a board: send `POST`.
2. Before the shots, fill one complete character sheet per character in `scenario.characters`. This is required whenever the story names a person. A scenario character needs `name`, `look`, and `outfit` (`n`, `l`, and `o` are the short names). Put the age in `age` or inside `look`, every garment worn at the first shot in `outfit`, carried items or props in `items` (or inside `outfit`), and distinctive features inside `look`. A later change is `locks`: `{ "fromOrder": 4, "outfit": "green cape" }` or `{ "fromOrder": 6, "items": "tin whistle" }`. Do not put the change sentence, or a garment the character has not put on yet, into the starting outfit. If you send `input` `"prose"` with `format` `"agent"` anyway, the response stays HTTP 200 and the board is still planned, but `sheets_missing` is true, `message` tells you to resubmit, and `sheets` is the list to paste into `scenario.characters`. The same warning is first in `warnings` with code `sheets_missing`. Resubmit those sheets. Do not keep the prose board. These are the same fields a hand-filled scenario uses, and the lock line is copied from that sheet onto every shot where the character appears, including Part 2. If the story names an age, a garment, or a carried item and the sheet omits it, Moovicut fills that field from the text and returns 200 with a warning of `character`, `field`, `value`, and `source`. It does not invent an attribute the text does not name. `strict_sheet` true (`strictSheet` is the same field) keeps the 400 `invalid_scenario`, and the message names the character, the field (`age`, `outfit`, or `items`), and the missing text. Each character has an ordered list of lock versions. A new version starts at the shot where that character puts on, changes into, or takes off a garment, or picks up, grabs, drops, sets down, carries, or hands an item. Portuguese cues are veste, põe, tira, despe, troca de roupa, pega, agarra, larga, pousa, entrega, and carrega. The object of a carry, hand, pick-up, or drop verb starts an item version when it is any concrete noun, such as a letter, a pastry, a key, or a basket, in English or Portuguese. An abstract noun or a place is not an item. Shots before the change keep the earlier version, including Part 2. A note-only `states` entry such as `{ "fromOrder": 3, "change": "coat removed" }` removes only that garment from the previous version, and `puts on a plum cloak` adds only that garment. Age, every other garment, and every carried item stay. A story `takes off`, `tira`, or `despe` does not raise `undeclared_wardrobe` when that version already applied the change. Every version stays complete: age, every garment still worn, and every carried item. Declare one with `locks`, for example `{ "fromOrder": 3, "outfit": "plum cloak" }`. An out-of-range `fromOrder` is a warning and is not applied. A prose request still returns a board, and with `format` `agent` it also returns `sheets_missing` so you can resubmit the sheets. On that path the rules engine keeps every outfit item, every carried item, and the age on that character's own lock line, and it does not copy a trait from another character. A place needs `name` and `description` (`d` or `desc`). A scene needs `who`, `where`, and `what` (`w`, `at`, and `do`). Omit `who`, or send `characters: []`, when the shot has no person. The prompt then has no character name and no lock line. `who` and `w` are a name or a list of names, joined in order. A number, an object, or any other shape is 400, and the message says a string or a list of names is expected. It does not say the field is missing. One missing piece returns 400 and `errors` lists each one. Put `characters`, `places`, and `scenes` inside `scenario`. The same fields at the top level are 400 `misplaced_scenario_fields`, not a template board and not `invalid_premise`. `age` and `role` on a character stay in the lock line. A shot size written in `what` is used once. A constraint such as "without touching" stays in the short and the detailed prompt.
3. Give every shot one framing term from the fixed list: `wide shot`, `medium shot`, `close-up`, `extreme close-up`, `high angle`, `low angle`, `over-the-shoulder`, `POV`, `tracking shot`, `static shot`, `crane shot`.
4. Each part stays at or under 40 shots. A longer story comes back as Part 1, Part 2, and so on, and every part reuses the same character sheet and place sheet.
5. Set `promptLanguage` to `en` or `pt`. Omit it to get English. `zh-Hans`, `fr`, `ja`, `it`, `de`, and any other code are rejected.

## Endpoints

- `POST` `/api/v1/storyboard`
- `GET` `/openapi.json`
- `GET` `/mcp`
- `POST` `/mcp`

`POST /mcp` speaks JSON-RPC: `initialize`, `tools/list`, `tools/call`. Tools: `plan_storyboard`, `export_prompts`, `validate_storyboard`. No API key. 30 requests a minute per IP. Storyboard bodies are 32 KB. MCP bodies are 128 KB.

## Example request

```json
{
  "premise": "A lighthouse keeper races the dusk to repair a failing beacon.",
  "model": "grok",
  "promptLanguage": "en",
  "compact": true
}
```

`compact: true` or `?compact=1` returns `title`, `premise`, `model`, `aspectRatio`, `studioUrl`, and `shots` of `order`, `duration`, and `prompt`. Open `studioUrl`. The board is in the `/studio#board=` fragment and is not sent to the server again.

Send `format` `agent` when you need the film sheet, each shot's `source` and `flags`, and `warnings`.

## Request fields

`premise` `scenario` `model` `shots` `mode` `sequenceMode` `continuity` `density` `prompt_style` `promptStyle` `promptLanguage` `prompt_language` `aspectRatio` `genre` `style` `input` `type` `prose` `text` `overwritePrompt` `splitActions` `splitScenes` `strict_sheet` `strictSheet` `format` `schema` `regenerateShot` `shotId` `project` `storyboard` `prompt` `ad` `product` `benefit` `cta` `setting` `series` `seriesTitle` `hook` `episodes` `character` `place` `explainer` `topic` `audience` `steps` `duration` `compact` `scenes`

`premise` is 8 to 6,000 characters. It may be omitted when `scenario` is sent. `shots` defaults to 5. A board longer than 40 shots is split into parts of at most 40. `duration` is 2 to 15 seconds. Per-scene `duration` uses the same range.

## Enums

### model

`grok` `google` `sora` `chatgpt` `midjourney` `hailuo` `seedance` `pika` `kling` `runway` `luma` `wan` `generic`

### mode

`continuous` `varied` `scenario` `ad` `series` `explainer`

### sequenceMode

`continuous` `varied` `scenario` `ad` `series` `explainer`

### continuity

`standard` `strict`

### density

`standard` `concise`

### prompt_style

`short` `detailed`

### promptStyle

`short` `detailed`

### promptLanguage

`en` `pt`

### prompt_language

`en` `pt`

### aspectRatio

`9:16` `1:1` `4:5` `16:9`

### input

`prose`

### type

`prose`

### format

`agent`

### schema

`shotboard.compact.v1`

### camera

`wide` `medium` `close` `insert` `tracking` `static` `push` `crane` `handheld`

### cam

`wide` `medium` `close` `insert` `tracking` `static` `push` `crane` `handheld`

### light

`day` `dawn` `dusk` `night` `warm` `cool` `hard` `soft` `neon` `practical`

### lighting

`day` `dawn` `dusk` `night` `warm` `cool` `hard` `soft` `neon` `practical`

### time

`dawn` `morning` `midday` `afternoon` `dusk` `evening` `night`

### mood

`grounded` `playful` `tense` `intimate` `bold` `quiet` `hopeful` `uneasy`

## Error codes

A 400 body has error, message, and an errors array that lists every problem. Fix the request and send it again. Do not retry an unchanged 400.

- `invalid_json`: the body is not JSON. Send `content-type: application/json` and valid JSON.
- `invalid_body`: the JSON is not an object.
- `invalid_premise`: under 8 characters or over 6,000, and the body has no scenario fields at the top level. Lengthen or shorten `premise`.
- `misplaced_scenario_fields`: `characters`, `places`, `scenes`, or another scenario field was sent at the top level instead of inside `scenario`. The message names each field and includes a short example. This outranks `invalid_premise` when the premise is missing or short.
- `invalid_scenario`: the scenario is over 8,000 characters, or a character, place, or scene is missing `look`, `outfit`, `description`, or the action. Add the named field. The same code is returned when `strict_sheet` is true and a character sheet omits an age, a garment, or a carried item that the story text names. The message names the character, the field (`age`, `outfit`, or `items`), and the missing text. Without `strict_sheet`, that omission is filled from the text and returned as a `sheet_filled` warning with `character`, `field`, `value`, and `source`. A present `who` with the wrong shape is this code too, and the message says `who` must be a string or a list of names.
- `invalid_plan`: a premise names people or several actions, or a scene `what` / `who` names an action or a person, but those shots cannot be planned. The response is 400, not a generic board, a placeholder line such as someone entering the frame, or an invented style. The message names every dropped person and quotes every dropped action, each action ending in a period: `This action was not planned: "Maya hands Rui a letter on the quay".` Send the full story again, either as one scene per beat or as plain prose in `premise` with `input` `"prose"` so every beat is split automatically. Do not shorten the story and do not drop actions. The same 400 is returned when a scenario packs many action beats into few shots, or has far fewer shots than the action sentences in the premise or the scene text. The message says to give one action per shot, not to merge beats, and that a story longer than 40 shots is split into parts of at most 40.
- `invalid_prompt_language`: `promptLanguage` is not `en` or `pt`. Omit it, or send `en` or `pt`.
- `invalid_model`: `model` is not in the model enum.
- `invalid_mode`: `mode` is not in the mode enum.
- `invalid_duration`: `duration` is outside 2 to 15 seconds.
- `invalid_shots`: `shots` is not a whole number of at least 1.
- `invalid_scenes`: an entry in `scenes` is not an object.
- `invalid_continuity`: `continuity` is not `standard` or `strict`.
- `invalid_density`: `density` is not `standard` or `concise`.
- `invalid_prompt_style`: `prompt_style` is not `short` or `detailed`.
- `invalid_preset`: `style` or `genre` is not in that family.
- `invalid_prose`: prose is under 8 or over 8,000 characters. Prose under 600 characters is not an error: the board is planned and the response carries a `short_story` warning (`action` `none`, `fix`: send an idea as `premise`).
- `invalid_fountain`: a Fountain body has no scene heading and action.
- `invalid_shot`: `regenerateShot` was sent without `project` or a shot id.
- `unknown_tool`: the MCP tool name is not one of the three tools.
- `payload_too_large`: the storyboard body is over 32 KB, or the MCP body is over 128 KB. Shorten the request.
- `invalid_request`: a planner error that has no more specific code.
- `rate_limited`: 30 requests in a minute from this IP. Wait and retry. HTTP 429.
- `method_not_allowed`: the verb does not match the endpoint. `GET /api/v1/storyboard` returns this, and the message says to `POST` the full story in `premise` (or `input` `"prose"`). GET does not plan a board.
- `not_found`: the path is not an agent route.

## Warnings and continuity

Warnings do not reject the board. They are present only when a shot looks risky, or when a thin sheet was filled. Each warning has `shotId`, `order`, `code`, `message`, `fix`, and `action`. `action` is `none`, `optional`, or `required`. `none` is informational: hands, a crowd, and `sheet_filled` need no change, and the board is done. `optional` is a suggestion. `required` means a field is empty. A `format` `agent` response includes `note`: the board is complete, do not re-post only the scenes a warning mentions, and any re-post must resend the whole scenario, every scene. `stage` and `snow` named in scene text are not places and do not raise `unresolved_place`. A warning with `fixId` is the one-click fix in `/studio`.

Read `flags` on each shot when `format` is `agent`. `place_missing` means the shot has no place: prefer a generic setting over a guess. `place_unlisted` means the place was kept from a locative but is not in the library. `place_carried` and `light_carried` mean the value came from the previous shot. `who_missing` and `who_carried` mean the person was absent or copied forward.

`format` `agent` also warns when characters or places come out empty. `empty_characters` and `empty_places` mean that list has no name. `empty_who` and `empty_where` mean a scenario shot left that field empty. A body part, a garment, a room surface, an object, a clothing phrase, a language or nationality, a vehicle part, or an abstract noun such as `place` or `circle` is never a place, in English and Portuguese. A rejected candidate is not carried forward. A movement into a new location (`enters`, `goes to`, `entra no`, `chega ao`, `vai para`, or `in` / `no` / `na` plus the noun) adopts that noun phrase even when it is not already in the lexicon. Return, board, pilot, voltar, atravessar, pilotar, and embarcar do the same. The full place phrase is kept. Leaving an interior with no destination returns to the previous outdoor place. A walk from a stage or palco into snow or water leaves that stage. The lexicon also names lighthouse, farol, sleeper compartment, sleeper car, red carpet, mercado, kiln, forno, and fornalha. Checking a sure place adopts it, and a possessive such as do palco after a time cue or a new paragraph adopts that place. Church, igreja, stage, palco, cellar, and adega are sure places. A definite locative whose noun is not already in the lexicon still produces a PLACE line, such as `in the oast`. A short beat such as `Mara applauds` is one shot. Portuguese `veste o fato` is one shot. `veste um vestido` still fills the sheet and is not a shot. A lock version keeps that character's own age, every garment still worn, and every carried item, and it does not take a trait from someone else. Shots before a wardrobe or item change keep the earlier version. Conservatory, atrium, study, sea, átrio, escritório, estufa, and mar are sure places. A watch, the object or the verb, is never a place. A beat whose subject names a new place, and a movement such as crosses, wades into, caminha até, or vai para, replaces the carried place. Sea and beach stay different places. A hair phrase, a garment led by a or an, and a noun phrase such as jaqueta de couro stay in the lock line. A later sentence that uses the item does not replace it. Carrying or calling is still a shot. A sentence that only states age, hair, or clothes is not. Portuguese night and evening cues (`à noite`, `de noite`, `meia-noite`, `madrugada`, `ao anoitecer`, `crepúsculo`, `ao luar`) set night light from that sentence until the next time cue. An explicit morning or dawn cue (`The next morning`, `at dawn`, `Na manhã seguinte`, `ao amanhecer`) replaces that night. A clothing phrase, a manner adverb (`in a hurry`), an idiom (`entra em cena`), and a label that would end on a preposition are not places. A trailing `com` or `with` plus a tool is stripped, so the place is the setting only. A locative in a time-jump sentence (`at the`, `in the`, `to the`, `na`, `no`, `à`, `ao`) adopts the new place from that shot on. A description sentence that also sets the time keeps its place on the following shots. A lock version keeps age, hair, outfit, every carried item, and role. That full line is copied into every shot that uses the version, in English and Portuguese, including Part 2. A later version does not rewrite the shots before the change. A carried item such as a camera, a ticket punch, a fan, or a walkie-talkie stays in the line. A board with far fewer shots than the sentences in the premise adds a `short_board` warning and still returns the board. The phrase does not end on a preposition, and matching is on word boundaries. A character introduced later gets that lock line. A Portuguese role keeps the gender written in the text. A sentence that only describes the setting or a person fills that context and is not a shot. An empty `where` omits the PLACE line.

`continuity` `strict` repeats the continuity sheet in a detailed prompt. `standard` keeps one shared sheet. A short prompt still copies each character's lock line, not the whole sheet, and stays under about 700 characters.
