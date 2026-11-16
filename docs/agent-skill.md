# Agent skill

The instructions an agent follows are `SKILL.md` in the repository root. The site serves that file at `/SKILL.md` (`text/markdown`) and renders the same text at `/skill`.

`llms.txt`, the README, `/agents`, and the OpenAPI description link to it. `tests/skill.test.mjs` checks that every field, enum, endpoint, and error code named there exists in the API, and that the skill's example request returns HTTP 200.

`who` accepts a string or a list of names. A premise that names people or actions and cannot be planned is HTTP 400 `invalid_plan`, not a placeholder board. The message names every dropped person and quotes every dropped action, each one ending in a period (`This action was not planned: "Maya hands Rui a letter on the quay".`). Scene `what` and `who` count in that check. `characters`, `places`, and `scenes` sent at the top level, instead of inside `scenario`, are HTTP 400 `misplaced_scenario_fields`. The message names each field and shows the shape to use. That error outranks `invalid_premise` when the premise is missing. Age and role stay on the character lock line. A negative constraint such as "without touching" stays in the short and the detailed prompt. A shot size written in the action is used once, and the response warns with `shot_size_in_action`.
