# Moovicut for AI agents

Moovicut plans an editable storyboard. It does not render video, it does not require an API key or an account, and it does not store the premise.

The human site stays at `/`. Agent instructions live here, at `/agents`, and at `/agents.md`.

## Default board

Out of the box, a plan is **5 scenes × 3 seconds (15s total)**.

That matches a short Grok Imagine generation. Pass `shots` and `duration`, or a `scenes` array, only when you want a different board. People can do the same in `/studio`: the 15s preset is selected by default, 30s is 10 × 3s, 60s is 20 × 3s, and **Step-by-step storyboard** (off by default) edits each scene.

Per-scene duration must stay between 2 and 15 seconds. The HTTP API accepts at most 48 scenes.

## Which endpoint

Use `POST /mcp` when the client speaks MCP (Cursor, Claude, and other JSON-RPC tool hosts). The call is stateless. Methods: `initialize`, `tools/list`, `tools/call`. Tools:

- `plan_storyboard` — plan a board. Returns a compact payload unless `compact` is false.
- `export_prompts` — return shot prompts only.
- `validate_storyboard` — check a `shotboard.v1` document.

Use `POST /api/v1/storyboard` for a plain JSON request. Send `compact: true` or `?compact=1` when you want only `title`, `premise`, `model`, `aspectRatio`, `studioUrl`, and `shots` of `{ order, duration, prompt }`.

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

Prompts still target Grok Imagine or Google. Paste them into the model you already use. Moovicut does not call that model.

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

JSON shape uses short fields: characters `name`/`n`, `look`/`l`, `outfit`/`o`; places `name`/`n`, `description`/`desc`/`d`; scenes `who`/`w`, `where`/`at`, `what`/`do`, plus optional `camera`, `light`, `mood`, `duration`, and `prompt`. Camera is `wide`, `medium`, `close`, `insert`, `tracking`, `static`, `push`, `crane`, or `handheld`. Light is `day`, `dawn`, `dusk`, `night`, `warm`, `cool`, `hard`, `soft`, `neon`, or `practical`. Mood is `grounded`, `playful`, `tense`, `intimate`, `bold`, `quiet`, `hopeful`, or `uneasy`. Every problem comes back in one `errors` array.

Characters, places, and light live on one film sheet. Each shot names them. The generated prompt fills in the look, outfit, and place. A prompt you send on a scene is kept. Send `overwritePrompt: true` when that prompt should be replaced.

Style presets lock one base sheet for every shot: `style` `anime`, `cinema`, or `documentary`, and a `genre` from that family (anime: shonen, shojo, seinen, slice-of-life, mecha, fantasy, ghibli; cinema: thriller, comedy, scifi, horror, drama, western, noir, romance, action; documentary: nature, history, portrait, investigation, travel). Omitted preset fields use cinema / drama. An unknown family or genre returns 400 and the allowed list. Changing the preset rewrites generated prompts and leaves a hand-edited prompt in place.

Scenes are packed into sequences of 15–60 seconds. Each sequence is copied separately. Aim for about 1,500 characters per minute. The response warns from 6,000 characters and stops at 8,000. A normal premise stays 8–6,000 characters.

Free text is detected only when `input` or `type` is `prose` (the text is `prose`, `text`, or `premise`, 8–8,000 characters). The response includes `language`, `confidence`, `warnings`, and `scenario`. A normal premise is not auto-detected. Detection is deterministic and does not call a model. In the studio, a line you already edited is not replaced when detection runs again.

## One shot, and risk warnings

Send `regenerateShot` (or `shotId`) plus `project` or `storyboard` to rebuild one shot. Every other prompt stays as it was. A shot marked `promptEdited`, or a `prompt` included in that request, is kept unless `overwritePrompt` is true. The same action is **Regenerate this shot** in `/studio`, in every mode.

`warnings` is added to a response only when a shot looks risky: too many actions for a short shot, on-screen text, a crowd, more than two people, a name that is not on the film sheet, or two camera moves that fight each other. Each warning has `shotId`, `order`, `code`, `message`, and `fix`. Warnings never reject the board. A default 5 × 3s plan has no `warnings` key.

## Shared film sheet

Quick idea, Step-by-step, continuous story, and scenario share one film sheet: characters, places, style, and light. Switching modes keeps that sheet and every prompt you edited. Style presets are the same families in every mode. A quick idea also detects names and places and shows the warnings so you can correct them. A field you already edited is not replaced.

The personal library (`shotboard.library.v1`) saves characters, places, and styles in this browser only. Export and import that JSON file from `/studio`. Nothing is uploaded.

Send `format: "agent"` to get `shotboard.compact.v1` for any mode: title, premise, model, aspect, mode, style, genre, film sheet, and shots. Post that document back to resume it. Shots with `promptEdited` stay as written. The default compact plan response does not add these fields.
