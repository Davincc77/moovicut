# Process audit

German (`de`) is not a supported language. The six languages are English, Simplified Chinese, Portuguese, Japanese, French, and Italian. A `promptLanguage` of `de` is HTTP 400 `invalid_prompt_language`, the same as any other code outside that list, and the message lists the six codes. `?lang=de`, a stored `de`, and a browser tag of `de` or `de-LU` are skipped, the same way `es` is skipped. The notes below are the audit from before German was removed. Those German rules no longer run.

Audit of the planner on this branch, done before the place, Chinese, and German fixes in the same change. Each stage says what the code does, what was checked, and the bug or doc mismatch found. Fixes are covered by `tests/process-audit.test.mjs` plus the existing suite.

## 1. Input parsing, per language

`detectProse` scores the text and routes English and French through `prose-detect.js`. Portuguese, German, and Italian go through `detectSpaced`. Japanese and Chinese go through `detectCjk`. Markers are closed lists (`FR_MARK`, `EN_MARK`, `OTHER_MARKS`). Chinese is Han with no kana. Japanese needs kana. A premise shaped as `Name, trait, trait` is read in English. Scenario blocks (`CHARACTERS` / `PLACES` / `SCENES`) and Fountain are separate parsers.

Checked: `languageScores`, the seven marker lists, and the language sample in `tests/prompt-language.test.mjs` (each sample stays in its language, with two named people and a look and an outfit).

Bug: none in the router. German `im` also matches the English marker `in`, and the German marker list still wins when `im`, `einen`, or `liest` are present. No change.

## 2. Sentence and beat split

English and French narrative cuts are `splitNarrative` in `scene-split.js`: sentence boundaries on `.!?。！？`, then place, time, and sequence cues. A sequence word alone stays inside the scene. A portrait line is not a shot. Portuguese, German, and Italian split on `.!?。！？` and keep every remaining narrative sentence. Chinese and Japanese used to split only on `。！？`.

Checked: `cjkSentences`, `sentences` in `prose-extra.js`, `sentencesOf`, and the baseline stories `en_long`, `fr_long`, `en_medium`, `fr_medium`.

Bug: a Chinese sentence kept every `，` clause in one shot, and a `；` did not start a new sentence. A portrait line (`出头` / `岁` with no verb) was also eligible to be split. Fix: split Chinese on `。！？；`, and split a `，` sentence only when at least two parts are verb clauses. A portrait line stays one skipped sentence.

## 3. Character detection and the sheet

English and French take capitalized names that are introduced, that take a human verb, or that repeat, and they reject calendar words, kinship words, and function words. German, Portuguese, and Italian use `findCharacters`. German keeps a name only with an age appositive or a listed verb, and the verb must not sit after an article. Chinese and Japanese read quote names, `は` / `が`, and an age frame. Look and outfit are harvested from the window after the name. A portrait fills the sheet and is not a shot.

Checked: `keepPerson`, `findCharacters`, the Chinese age regex, and the German sample (Maya / Rui).

Bug: a German common noun after `der` / `die` / `das` / `dem` / `im` / `am` / `beim` / `zum` / `zur` was still eligible as a name when a verb followed it (`Bootshaus wartet`). A separable particle (`hinaus`, `hinein`, `her`, `hin`) could be read as a name when capitalized. Fix: skip a capitalized token in that frame, and treat the particles as function words. A Chinese name regex that started after a comma could swallow the following `在` (`玛雅在`). Fix: reject a candidate that ends in `在` or a particle.

## 4. Place detection, the sheet, and persistence

`locativeHeads` takes the noun phrase after a strong preposition. `libraryHits` adds sure library places, and ambiguous places only in a locative. The shot keeps the last place until a new firm locative. A quoted or remembered place does not move the scene. An unlisted place is flagged.

Checked: `locativeHeads`, `libraryHits`, `findPlaceCue`, `detectScenes`, `findScenes`, and the baseline false-cut count.

Bugs:

- An unlisted phrase could still be a time word plus a pronoun plus a verb, because those tokens were only stopped when they were the first word.
- Unlisted locative heads were dropped before the film sheet, so a German compound that is not in the library never landed on the sheet. Sheet recall for German stayed empty even when a shot had a where.
- `to` / `into` / `zum` / `zur` was a firm locative, so a destination the sentence does not reach replaced the scene. A glance was already uncertain in `findPlaceCue` but a locative head could still override it.
- Body parts, garments, and abstract nouns lived in `NOT_A_PLACE` for the cue finder and not in the locative-head reject list.
- A longer unlisted phrase (`Cais chuvoso`) was added beside the library place (`Cais`).
- French `même quai` and `crépuscule` became extra places on `fr_long`.

Fix: reject a phrase that contains a pronoun, a time word, or a verb. Keep one German noun after the articles and modifiers, so the verb stays out of the phrase. Put a locative head on the sheet, including an unlisted one, and do not add it again when it only extends a place already on the sheet. A toward-preposition with no arrival verb does not move the scene and is not added. Garments, body parts, and state nouns are in the head reject list. `crépuscule` and the other twilight words are time words. A leading `même` is not part of the place name.

## 5. Time and light

Time cues (`dawn`, `Am Abend`, clock times, `翌日`) set the light from that sentence forward. A later night does not light earlier shots. A time phrase is not a character and not a place.

Checked: `cueLight`, `timeCues`, `isPortraitSentence`, and tests R8 / R8b.

Bug: none new. Twilight words that were missing from the place reject list are covered in stage 4.

## 6. Action extraction

English and French split a line on `and` / `then` / `while` and on extra sentences, unless the shot is `promptEdited`. One verb is one action. `He walks away` is one action. German, Portuguese, and Italian keep the sentence as the action. Chinese used a short verb list and dropped a sentence that had no listed verb and no named person.

Checked: `splitActionText`, `hasAction`, the Chinese skip in `detectCjk`, and R5 / R5b.

Bug: Chinese dropped or merged action clauses that were not in the short verb list, including `，` clauses. Fix: a clause with `了` / `着` / `过` or a general action character is kept, and two or more of those in one sentence become separate shots. Japanese still uses the listed verbs plus `る` / `た` / `ます`.

## 7. Shot building and the 40-shot cap

`planProse` builds shots from the detected scenes. Duration comes from the model profile when the request omits it. More than 40 shots is HTTP 400 `too_many_shots`. There is no part split. The same five long stories still refuse.

Checked: `server/agent-api.mjs` (`too_many_shots`, OpenAPI `maxItems: 40`) and the baseline test that expects 400 for `en_long` and `fr_long`.

Bug: none. The cap is unchanged.

## 8. Continuity checker

`continuityWarnings` flags a missing lock line, a wardrobe state that the prompt dropped, a trait that contradicts the lock, and the other shot-risk codes (crowd, several actions, hands, missing framing). Warnings do not reject the board.

Checked: `app/utils/continuity-check.js` and the continuity tests already in the suite.

Bug: none found in this pass.

## 9. Model profile, duration, and the 700-character prompt

`MODEL_PROFILES` holds the thirteen targets. `shotSeconds` is the planned length. `createPrompt` uses labeled short prompts for Grok and Veo (`promptForm: structured`) and prose for the others. `fitShortPrompt` caps a short prompt at 700 characters and shortens style, light, and place before the action and the lock line.

Checked: `plannedShotSeconds`, `createStructuredShort`, `createShortPrompt`, and `tests/model-profiles.test.mjs`.

Bug: none. Durations and the labeled-versus-prose split are unchanged.

## 10. `POST /api/v1/storyboard`

`dispatchAgentRequest` plans from a premise, from `shots` / `scenes`, from a scenario, or from `input: "prose"`. Compact responses stay `title`, `premise`, `model`, `aspectRatio`, `studioUrl`, `shots`. `format: "agent"` adds the film sheet, `source`, `flags`, and `warnings` when a shot looks risky. The body limit is 32 KB. The rate limit is 30 requests a minute.

Checked: the prose branch in `server/agent-api.mjs` (source and flags copied onto each shot) and a compact-key test in the suite.

Bug: none in the response shape.

## 11. Wizard and advanced editor

Both call the same planner. The wizard is the six-step guide. Advanced mode keeps Step-by-step, scenario, ad, series, and explainer. Prompt text is built by `createPrompt` for either surface.

Checked: `tests/prompt-language.test.mjs` (“the wizard and the advanced editor build the same prompts in every language”), which passed. The studio screen was not clicked in a browser in this pass. The change is the planner, not the layout.

Bug: none in the shared prompt path.

## 12. Interface languages

Seven catalogs. The English value equals the key. The site language is the prompt language. `promptLanguage` on the API defaults to `en`.

Checked: `tests/i18n.test.mjs` in the full suite.

Bug: none. No new English string was added, so the catalogs did not change.

## 13. Export packet

`exportAgentBoard` writes `shotboard.compact.v1`: title, premise, model, aspect, mode, style, genre, film sheet, shots, lock lines, `source`, and `flags`. A character packet exports the lock line as JSON or Markdown. Nothing is uploaded.

Checked: `app/utils/agent-board.js`.

Bug: none.

## 14. README and docs against the code

Checked: `README.md`, `AGENTS.md`, `docs/place-library.md`, and the served copies.

Mismatch: the README said both “the whole noun phrase” and “the first noun after the preposition”, and it said an unlisted noun is always kept. The code now keeps an unlisted noun only in a locative frame, does not move the scene for a destination that is not reached, keeps Chinese comma clauses, and does not treat a German noun after an article as a name. `README.md`, `AGENTS.md`, `docs/place-library.md`, and the public copies are updated to say that. `docs/model-profiles.md` still matches the duration and prompt-form code.
