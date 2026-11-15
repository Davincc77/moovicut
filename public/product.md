# Moovicut product guide

## Local planning

Moovicut uses a deterministic local story engine. `/studio` opens a six-step guide (idea, characters, places and style, shots, check, generate). Required character fields are name, age, build or face, hair, outfit, colours, and one distinctive feature. A place needs a description. Each shot needs a person, a place, one action, and a framing term. Generate prompts stays off until those fields are filled and the check step has no blocking issue. Advanced mode keeps the full editor. Enter a premise, choose a prompt target, and generate a starting shot list. A premise shaped as `Name, trait, trait` keeps those people and turns the real sentences into shots. The default list is 5 scenes of 3 seconds (15s). Step-by-step mode can replace any scene’s action, duration, camera, lighting, or notes. Agents can pass the same `scenes` array to `POST /api/v1/storyboard` or `/mcp`. The home page and the studio list thirteen prompt targets: Grok Imagine, Google (Veo / Gemini), Sora, ChatGPT video, Midjourney video, MiniMax Hailuo, ByteDance Seedance, Pika, Kling, Runway, Luma, Wan, and a generic profile. The prompts also work with any other AI image or video model. Every cinematic field remains editable.

Scenario mode keeps one film sheet (characters, places, style, light) and resolves those names in every generated shot. Style presets cover anime, cinema, and documentary. The video prompt is short by default: the framing term in the prompt language, the character name, and the action, then each person’s full lock line, the full place, one light, and the style with a locked-off camera unless a movement was set. The order is the same in every language. Detailed keeps the full sheet in every prompt. The film sheet stays on the board either way. A prompt edited by hand is marked `promptEdited` and is not replaced by a sheet, preset, prompt style, or model change until you reset that shot. Undo restores the edit. Ad, series, and explainer are light presets on that same sheet. Regenerate this shot rebuilds one prompt in any mode. Risk warnings suggest a fix and never block creation. A scene whose only names are public figures, brands, or trademarks shows the neutral risk note and does not add missing-character or missing-place lines. Quick idea, Step-by-step, continuous story, and scenario share that film sheet, and switching modes keeps it. Style presets are available in each mode. A personal library of characters, places, and styles stays in the browser and exports as a file. format agent returns one compact board for every mode. The prompt target can be Grok Imagine, Veo, Sora, ChatGPT video, Midjourney video, MiniMax Hailuo, ByteDance Seedance, Pika, Kling, Runway, Luma, Wan, or a generic profile. Shot length, aspect, and the risk check follow the cited limits for that model. The studio supports shot insertion, deletion, and movement; undo and redo; model-specific prompt regeneration; prompt copying; and project save, import, and export. The `shotboard.v1` JSON document is flat: its `shots` array is at the top level, and each shot has a stable ID and numeric order.

## Storage

Saved projects stay in this browser. Export a JSON file to share or back up a project. The studio can also export or restore a local library backup of saved projects. Deleting a saved project asks for confirmation. There is no remote copy.

## Languages

The interface is available in English (default), Simplified Chinese, Portuguese, Japanese, French, German, and Italian. The header control is keyboard accessible, remembers the choice in this browser, and on a first visit follows `navigator.language` or stays in English. `?lang=` is the shareable form. Catalogs are `app/i18n/locales/*.json`, with the English string as the key. The six-step studio guide uses those same catalogs. Fixed prompt lines follow the site language. Optional `promptLanguage` defaults to English on the API. JSON field names stay English. Free-prose detection reads all seven site languages and does not call a model. Nothing is sent to an external AI. An uncertain reading does not fill names. A long story is split on place and time cues (`splitScenes`, default true). The current firm place wins, and a sentence with no listed verb is kept. An article inside a venue name is not a place cue. Each cut includes the cue and a reason. A character with no look still returns a board and a warning.

## Accounts

There is no account and no profile page. The storyboard stays in this browser.

## Price

Planning, editing, and JSON export are free. Moovicut does not sell plans or subscriptions. Optional tips open https://buymeacoffee.com/enzoc1977r in a new tab. Moovicut does not take payment itself. The old `/pricing` address redirects to `/studio`.

## Output

Moovicut prepares editable prompts and storyboard documents. It does not render video, and it does not synchronize work across devices.
