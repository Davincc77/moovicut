# Moovicut product guide

## Local planning

Moovicut uses a deterministic local story engine. Enter a premise, choose a prompt target, and generate a starting shot list. The default list is 5 scenes of 3 seconds (15s). Step-by-step mode can replace any scene’s action, duration, camera, lighting, or notes. Agents can pass the same `scenes` array to `POST /api/v1/storyboard` or `/mcp`. The picker offers Grok Imagine and Google. The prompts work with Grok Imagine, Google, or any other AI image or video model. Every cinematic field remains editable.

Scenario mode keeps one film sheet (characters, places, style, light) and resolves those names in every generated shot. Style presets cover anime, cinema, and documentary. A prompt edited by hand is marked and is not replaced by a sheet or preset change until you reset that shot. Regenerate this shot rebuilds one prompt in any mode. Risk warnings suggest a fix and never block creation. Quick idea, Step-by-step, continuous story, and scenario share that film sheet, and switching modes keeps it. Style presets are available in each mode. A personal library of characters, places, and styles stays in the browser and exports as a file. format agent returns one compact board for every mode. The prompt target can be Grok Imagine, Veo, Sora, Kling, Runway, Luma, Wan, or a generic profile. Shot length, aspect, and the risk check follow the cited limits for that model. The studio supports shot insertion, deletion, and movement; undo and redo; model-specific prompt regeneration; prompt copying; and project save, import, and export. The `shotboard.v1` JSON document is flat: its `shots` array is at the top level, and each shot has a stable ID and numeric order.

## Storage

Saved projects stay in this browser. Export a JSON file to share or back up a project. The studio can also export or restore a local library backup of saved projects. Deleting a saved project asks for confirmation. There is no remote copy.

## Accounts

There is no account and no profile page. The storyboard stays in this browser.

## Price

Planning, editing, and JSON export are free. Moovicut does not sell plans or subscriptions. Optional tips open https://buymeacoffee.com/enzoc1977r in a new tab. Moovicut does not take payment itself. The old `/pricing` address redirects to `/studio`.

## Output

Moovicut prepares editable prompts and storyboard documents. It does not render video, and it does not synchronize work across devices.
