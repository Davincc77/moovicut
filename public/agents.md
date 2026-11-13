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
