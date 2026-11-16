---
name: moovicut
description: Turn a user's idea into a Moovicut storyboard. Use when planning shots, calling POST /api/v1/storyboard, checking characters, places, one action per shot, framing, the 40-shot cap, promptLanguage, or warnings.
---

# Moovicut

Moovicut plans an editable storyboard. It does not render video, it does not need an API key, and it does not store the premise. Nothing is sent to an external AI. Paste the returned prompt into the model the user already uses.

The live skill is [https://moovicut.studio/skill](https://moovicut.studio/skill). Raw Markdown is [https://moovicut.studio/SKILL.md](https://moovicut.studio/SKILL.md).

## Turn an idea into a request

1. Keep one action in each shot. If the idea joins two verbs with and, then, or while, make two shots. The API splits those lines unless `splitActions` is false.
2. A scenario character needs `name`, `look`, and `outfit` (`n`, `l`, and `o` are the short names). A place needs `name` and `description` (`d` or `desc`). A scene needs `who`, `where`, and `what` (`w`, `at`, and `do`). `who` and `w` are a name or a list of names, joined in order. A number, an object, or any other shape is 400, and the message says a string or a list of names is expected. It does not say the field is missing. One missing piece returns 400 and `errors` lists each one.
3. Give every shot one framing term from the fixed list: `wide shot`, `medium shot`, `close-up`, `extreme close-up`, `high angle`, `low angle`, `over-the-shoulder`, `POV`, `tracking shot`, `static shot`, `crane shot`.
4. Stay at or under 40 shots. A longer board is one chapter. Send the next chapter as its own request and reuse the exported character sheet so the faces stay the same.
5. Set `promptLanguage` to one of `en`, `zh-Hans`, `pt`, `ja`, `fr`, `it`. Omit it to get English. `de` and any other code are rejected.

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

`premise` `scenario` `model` `shots` `mode` `sequenceMode` `continuity` `density` `prompt_style` `promptStyle` `promptLanguage` `prompt_language` `aspectRatio` `genre` `style` `input` `type` `prose` `text` `overwritePrompt` `splitActions` `splitScenes` `format` `schema` `regenerateShot` `shotId` `project` `storyboard` `prompt` `ad` `product` `benefit` `cta` `setting` `series` `seriesTitle` `hook` `episodes` `character` `place` `explainer` `topic` `audience` `steps` `duration` `compact` `scenes`

`premise` is 8 to 6,000 characters. It may be omitted when `scenario` is sent. `shots` defaults to 5 and cannot exceed 40. `duration` is 2 to 15 seconds. Per-scene `duration` uses the same range.

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

`en` `zh-Hans` `pt` `ja` `fr` `it`

### prompt_language

`en` `zh-Hans` `pt` `ja` `fr` `it`

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

### mood

`grounded` `playful` `tense` `intimate` `bold` `quiet` `hopeful` `uneasy`

## Error codes

A 400 body has error, message, and an errors array that lists every problem. Fix the request and send it again. Do not retry an unchanged 400.

- `invalid_json`: the body is not JSON. Send `content-type: application/json` and valid JSON.
- `invalid_body`: the JSON is not an object.
- `invalid_premise`: under 8 characters or over 6,000. Lengthen or shorten `premise`.
- `invalid_scenario`: the scenario is over 8,000 characters, or a character, place, or scene is missing `look`, `outfit`, `description`, or the action. Add the named field. A present `who` with the wrong shape is this code too, and the message says `who` must be a string or a list of names.
- `invalid_plan`: a premise names people or several actions, but those shots cannot be planned. The response is 400, not a generic board, a placeholder line such as someone entering the frame, or an invented style. The message names every dropped person and quotes every dropped action. Send a scenario: characters with `name`, `look`, and `outfit`; places with `name` and `description`; scenes with `who` (a string or a list of names), `where`, and `what`.
- `invalid_prompt_language`: `promptLanguage` is not one of the six codes. Omit it, or send `en`, `zh-Hans`, `pt`, `ja`, `fr`, or `it`.
- `invalid_model`: `model` is not in the model enum.
- `invalid_mode`: `mode` is not in the mode enum.
- `invalid_duration`: `duration` is outside 2 to 15 seconds.
- `invalid_shots`: `shots` is not a whole number of at least 1.
- `too_many_shots`: the board is over 40 shots. Split the story into chapters of at most 40 shots. Send each chapter as its own request and reuse the character sheet from `format` `agent`.
- `invalid_scenes`: an entry in `scenes` is not an object.
- `invalid_continuity`: `continuity` is not `standard` or `strict`.
- `invalid_density`: `density` is not `standard` or `concise`.
- `invalid_prompt_style`: `prompt_style` is not `short` or `detailed`.
- `invalid_preset`: `style` or `genre` is not in that family.
- `invalid_prose`: prose is under 8 or over 8,000 characters.
- `invalid_fountain`: a Fountain body has no scene heading and action.
- `invalid_shot`: `regenerateShot` was sent without `project` or a shot id.
- `unknown_tool`: the MCP tool name is not one of the three tools.
- `payload_too_large`: the storyboard body is over 32 KB, or the MCP body is over 128 KB. Shorten the request.
- `invalid_request`: a planner error that has no more specific code.
- `rate_limited`: 30 requests in a minute from this IP. Wait and retry. HTTP 429.
- `method_not_allowed`: the verb does not match the endpoint.
- `not_found`: the path is not an agent route.

## Warnings and continuity

Warnings do not reject the board. They are present only when a shot looks risky. Each warning has `shotId`, `order`, `code`, `message`, and `fix`. A warning with `fixId` is the one-click fix in `/studio`.

Read `flags` on each shot when `format` is `agent`. `place_missing` means the shot has no place: prefer a generic setting over a guess. `place_unlisted` means the place was kept from a locative but is not in the library. `place_carried` and `light_carried` mean the value came from the previous shot. `who_missing` and `who_carried` mean the person was absent or copied forward.

`format` `agent` also warns when characters or places come out empty. `empty_characters` and `empty_places` mean that list has no name. `empty_who` and `empty_where` mean a scenario shot left that field empty. A body part, a garment, or a similar noun is never a place, in English, French, Portuguese, Italian, Japanese, and Chinese. A Chinese short prompt names the subject, then the place with 在, then the action, with no full stop between the name and the verb.

`continuity` `strict` repeats the continuity sheet in a detailed prompt. `standard` keeps one shared sheet. A short prompt still copies each character's lock line, not the whole sheet, and stays under about 700 characters.
