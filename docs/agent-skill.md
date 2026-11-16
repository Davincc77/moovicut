# Agent skill

The instructions an agent follows are `SKILL.md` in the repository root. The site serves that file at `/SKILL.md` (`text/markdown`) and renders the same text at `/skill`.

`llms.txt`, the README, `/agents`, and the OpenAPI description link to it. `tests/skill.test.mjs` checks that every field, enum, endpoint, and error code named there exists in the API, and that the skill's example request returns HTTP 200.

`who` accepts a string or a list of names. A premise that names people or actions and cannot be planned is HTTP 400 `invalid_plan`, not a placeholder board.
