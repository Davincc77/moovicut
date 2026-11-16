# Agent skill

The instructions an agent follows are `SKILL.md` in the repository root. The site serves that file at `/SKILL.md` (`text/markdown`) and renders the same text at `/skill`.

`llms.txt`, the README, `/agents`, and the OpenAPI description link to it. `tests/skill.test.mjs` checks that every field, enum, endpoint, and error code named there exists in the API, and that the skill's example request returns HTTP 200.
