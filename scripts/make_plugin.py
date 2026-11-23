# -*- coding: utf-8 -*-
"""make_plugin — génère le dépôt marketplace Portable Agent Plugins v1.

Même doctrine que mechacut : le pack n'est JAMAIS copié à la main, il est
régénéré depuis le SKILL.md vivant du dépôt (celui qui est servi sur
moovicut.studio/SKILL.md — même fichier, vérifié par tests/skill.test.mjs).
Un skill périmé au marketplace serait le mensonge de doc qu'on refuse.

Usage : node ignore — python scripts/make_plugin.py [cible]
        (défaut ~/Projets/moovicut-plugin)
"""
import json
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1
                            else "~/Projets/moovicut-plugin")

PLUGIN = {
    "$schema": "https://agent-plugins.org/schemas/1.0.0/"
               "plugin.schema.json",
    "name": "moovicut",
    "version": "1.0.0",
    "description": (
        "Skills-only package (Agent Plugins v1): teaches agents the "
        "Moovicut storyboard contract — turn an idea into an editable, "
        "shot-by-shot storyboard via one keyless HTTPS call "
        "(POST /api/v1/storyboard), with characters, places, framing, "
        "one action per shot and a prompt the user pastes into their "
        "own model. No plugin code, no MCP server bundled, nothing "
        "stored, no external AI in the loop."
    ),
    "author": {"name": "C.V.", "url": "https://github.com/Davincc77"},
    "homepage": "https://moovicut.studio",
    "repository": "https://github.com/Davincc77/moovicut-plugin",
    "license": "MIT",
    "keywords": ["storyboard", "video", "planning", "shots", "agents",
                 "local-first", "skills-only"],
}

README = """# moovicut — Hermes plugin (Portable Agent Plugins v1)

Skills-only package: one instructions file, zero code, zero daemon.
An agent that installs this can turn an idea into an editable Moovicut
storyboard — correctly, on the first call.

## What installs
- `skills/moovicut` — the live skill, byte-identical to
  https://moovicut.studio/SKILL.md (the site serves the same file the
  repo keeps; this pack is REGENERATED from that source, never copied
  by hand). It teaches: premise -> structured request (characters,
  places, one action per shot, framing, promptLanguage), the
  POST /api/v1/storyboard contract, the 40-shot part cap, reading the
  warnings the API returns, and the rule that Moovicut PLANS — it does
  not render, and the prompt goes to the model the USER already uses.

## Disclosure (what the skill makes an agent do)
- One kind of network call: HTTPS POST/GET to moovicut.studio, gated
  by the harness's own approvals like any curl. Keyless, free, and
  nothing is stored server-side — no premise leaves the request body.
- No external AI service is called by Moovicut: the storyboard
  mechanics are deterministic planning; the generated PROMPT is text
  the human pastes into their own model of choice.
- No install scripts, no downloads, no MCP server bundled.

## Related
- Live product: https://moovicut.studio — local-first storyboard
  planner; the same skill ships at /SKILL.md and /skill.
- Sister surface for exact mechanics (math, dates, money, units):
  the `mechacut` plugin in this same catalog.

## Install / validate
```bash
hermes plugins validate .
hermes plugins install Davincc77/moovicut-plugin
```
"""


def main():
    src = os.path.join(REPO, "SKILL.md")
    body = open(src, encoding="utf-8").read().strip()
    fm = re.match(r"^---\n(.*?)\n---\n", body, re.S)
    assert fm, "SKILL.md source doit avoir son frontmatter"
    assert re.search(r"^name: moovicut$", fm.group(1), re.M), \
        "frontmatter name != moovicut"
    os.makedirs(os.path.join(TARGET, "skills", "moovicut"),
                exist_ok=True)
    with open(os.path.join(TARGET, "plugin.json"), "w") as f:
        json.dump(PLUGIN, f, indent=2)
        f.write("\n")
    with open(os.path.join(TARGET, "skills", "moovicut",
                           "SKILL.md"), "w") as f:
        f.write(body + "\n")
    with open(os.path.join(TARGET, "README.md"), "w") as f:
        f.write(README)
    lic = os.path.join(REPO, "LICENSE")
    if os.path.exists(lic):
        with open(lic) as s, open(os.path.join(TARGET, "LICENSE"),
                                  "w") as d:
            d.write(s.read())
    # garde de non-derives : le pack est le fichier vivant, octet à octet
    pack = open(os.path.join(TARGET, "skills", "moovicut",
                             "SKILL.md"), encoding="utf-8").read()
    live = os.path.join(REPO, "public", "SKILL.md")
    if os.path.exists(live):
        import hashlib
        h1 = hashlib.sha256(pack.encode()).hexdigest()
        h2 = hashlib.sha256(open(live, encoding="utf-8").read()
                           .strip().encode() + b"\n").hexdigest()
        print("sha pack:", h1[:16], "| sha public:", h2[:16],
              "| identique:" if h1 == h2 else "| DIVERGENT —",
              h1 == h2)
    print("pack généré:", TARGET)


if __name__ == "__main__":
    main()
